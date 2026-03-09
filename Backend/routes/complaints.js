import express from "express";
import pool from "../config/db.js";
import { protect } from "../middleware/auth.js";
import multer from "multer";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

let complaintsTableReady = false;

async function ensureComplaintsTable() {
  if (complaintsTableReady) return true;
  try {
    const check = await pool.query(`SELECT to_regclass('public.complaints') AS exists`);
    if (check.rows?.[0]?.exists) {
      try {
        await pool.query("ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb");
      } catch (e) {
        // ignore
      }

      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS public.complaint_attachments (
            id SERIAL PRIMARY KEY,
            complaint_id INTEGER,
            file_name TEXT,
            mime_type TEXT,
            file_data BYTEA NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_complaint_attachments_complaint_id ON public.complaint_attachments(complaint_id)`);
      } catch (e) {
        // ignore
      }
      complaintsTableReady = true;
      return true;
    }
    console.warn('complaints table missing. Creating it now...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.complaints (
        id SERIAL PRIMARY KEY,
        reference VARCHAR(255) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        priority VARCHAR(50) DEFAULT 'medium',
        property_id INTEGER,
        property_name VARCHAR(255),
        status VARCHAR(50) DEFAULT 'open',
        reported_by VARCHAR(255),
        reported_date DATE,
        assigned_to VARCHAR(255),
        scheduled_date DATE,
        notes TEXT,
        attachments JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.complaint_attachments (
        id SERIAL PRIMARY KEY,
        complaint_id INTEGER,
        file_name TEXT,
        mime_type TEXT,
        file_data BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_complaint_attachments_complaint_id ON public.complaint_attachments(complaint_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_complaints_priority ON public.complaints(priority)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON public.complaints(created_at DESC)`);
    complaintsTableReady = true;
    return true;
  } catch (err) {
    console.error('Failed to ensure complaints table:', err?.message || err);
    return false;
  }
}

function makeReference() {
  const rnd = Math.floor(1000 + Math.random() * 9000);
  const year = new Date().getFullYear();
  return `COMP-${year}-${rnd}`;
}

async function insertComplaintAttachments(complaintId, files = []) {
  if (!Array.isArray(files) || files.length === 0) return [];
  const ids = [];
  for (const f of files) {
    if (!f || !f.buffer) continue;
    const r = await pool.query(
      `INSERT INTO public.complaint_attachments (complaint_id, file_name, mime_type, file_data)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [complaintId ?? null, f.originalname ?? null, f.mimetype ?? null, f.buffer]
    );
    if (r.rows?.[0]?.id != null) ids.push(r.rows[0].id);
  }
  return ids;
}

router.get('/attachments/:id', protect, async (req, res) => {
  try {
    const ready = await ensureComplaintsTable();
    if (!ready) return res.status(500).end();

    const id = req.params.id;
    if (!/^\d+$/.test(String(id))) return res.status(400).end();

    const r = await pool.query(
      `SELECT id, file_name, mime_type, file_data
       FROM public.complaint_attachments
       WHERE id = $1
       LIMIT 1`,
      [Number(id)]
    );
    if (!r.rows?.length) return res.status(404).end();

    const row = r.rows[0];
    const mime = row.mime_type || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    if (row.file_name) {
      res.setHeader('Content-Disposition', `inline; filename="${String(row.file_name).replace(/"/g, '')}"`);
    }
    return res.send(row.file_data);
  } catch (err) {
    console.error('GET /api/complaints/attachments/:id error:', err);
    return res.status(500).end();
  }
});

router.delete('/attachments/:id', protect, async (req, res) => {
  try {
    const ready = await ensureComplaintsTable();
    if (!ready) return res.status(500).json({ success: false, message: 'Database not initialized' });

    const id = req.params.id;
    if (!/^[0-9]+$/.test(String(id))) return res.status(400).json({ success: false, message: 'Invalid attachment id' });

    const find = await pool.query(
      `SELECT id, complaint_id
       FROM public.complaint_attachments
       WHERE id = $1
       LIMIT 1`,
      [Number(id)]
    );
    if (!find.rows?.length) return res.status(404).json({ success: false, message: 'Attachment not found' });

    const complaintId = find.rows[0].complaint_id;

    await pool.query(
      `DELETE FROM public.complaint_attachments
       WHERE id = $1`,
      [Number(id)]
    );

    if (complaintId) {
      await pool.query(
        `UPDATE public.complaints
         SET attachments = COALESCE((
           SELECT jsonb_agg(elem)
           FROM jsonb_array_elements(COALESCE(attachments, '[]'::jsonb)) elem
           WHERE elem::text <> to_jsonb($2::int)::text
         ), '[]'::jsonb)
         WHERE id = $1`,
        [Number(complaintId), Number(id)]
      );
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/complaints/attachments/:id error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* LIST */
router.get('/', protect, async (req, res) => {
  try {
    const ready = await ensureComplaintsTable();
    if (!ready) return res.status(500).json({ success: false, message: 'Database not initialized' });

    const currentUser = req.user;
    let restrictedHotelIds = null;

    // Role-Based Restriction
    if (currentUser.role === "manager") {
      const managedRes = await pool.query("SELECT id FROM hotels WHERE manager_id = $1", [currentUser.id]);
      const managedIds = managedRes.rows.map(r => r.id);

      let branchIds = [];
      if (currentUser.branch) {
        const branchRes = await pool.query("SELECT id FROM hotels WHERE branch = $1", [currentUser.branch]);
        branchIds = branchRes.rows.map(r => r.id);
      }
      restrictedHotelIds = [...new Set([...managedIds, ...branchIds])];
    } else if (currentUser.role === "staff") {
      const assignedHotelId = currentUser.hotel_id || currentUser.hotelId || currentUser.hotel || null;
      restrictedHotelIds = assignedHotelId ? [assignedHotelId] : [];
    }

    const { limit = 200, offset = 0 } = req.query;

    let queryText = `SELECT * FROM public.complaints`;
    const params = [];
    const where = [];

    if (restrictedHotelIds !== null) {
      if (restrictedHotelIds.length === 0) {
        return res.json({ success: true, data: [] });
      }
      // Assuming 'property_id' is the column name in complaints table
      where.push(`property_id = ANY($${params.length + 1})`);
      params.push(restrictedHotelIds);
    }

    if (where.length > 0) {
      queryText += ` WHERE ${where.join(' AND ')}`;
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const { rows } = await pool.query(queryText, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('GET /api/complaints error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* GET BY ID */
router.get('/:id', protect, async (req, res) => {
  try {
    const ready = await ensureComplaintsTable();
    if (!ready) return res.status(500).json({ success: false, message: 'Database not initialized' });
    const { id } = req.params;
    const { rows } = await pool.query('SELECT * FROM public.complaints WHERE id = $1 LIMIT 1', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });

    const currentUser = req.user;
    let restrictedHotelIds = null;
    if (currentUser.role === "manager") {
      const managedRes = await pool.query("SELECT id FROM hotels WHERE manager_id = $1", [currentUser.id]);
      const managedIds = managedRes.rows.map(r => r.id);
      let branchIds = [];
      if (currentUser.branch) {
        const branchRes = await pool.query("SELECT id FROM hotels WHERE branch = $1", [currentUser.branch]);
        branchIds = branchRes.rows.map(r => r.id);
      }
      restrictedHotelIds = [...new Set([...managedIds, ...branchIds])];
    } else if (currentUser.role === "staff") {
      const assignedHotelId = currentUser.hotel_id || currentUser.hotelId || currentUser.hotel || null;
      restrictedHotelIds = assignedHotelId ? [assignedHotelId] : [];
    }

    if (restrictedHotelIds !== null) {
      if (restrictedHotelIds.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
      const pid = rows[0]?.property_id ?? null;
      if (!pid || !restrictedHotelIds.some((x) => String(x) === String(pid))) {
        return res.status(404).json({ success: false, message: 'Not found' });
      }
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('GET /api/complaints/:id error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* CREATE */
router.post('/', protect, upload.array('photos', 10), async (req, res) => {
  try {
    const ready = await ensureComplaintsTable();
    if (!ready) return res.status(500).json({ success: false, message: 'Database not initialized' });

    const title = req.body.title ?? null;
    const description = req.body.description ?? null;
    const category = req.body.category ?? null;
    const priority = req.body.priority ?? 'medium';
    let propertyId = req.body.property_id ?? req.body.propertyId ?? null;
    if (propertyId === '') propertyId = null;
    const propertyName = req.body.property_name ?? req.body.propertyName ?? null;
    const status = req.body.status ?? 'open';
    const reportedBy = req.body.reported_by ?? req.body.reportedBy ?? null;
    const reportedDate = (req.body.reported_date ?? req.body.reportedDate ?? null) || null;
    const assignedTo = req.body.assigned_to ?? req.body.assignedTo ?? null;
    const scheduledDate = (req.body.scheduled_date ?? req.body.scheduledDate ?? null) || null;
    const notes = req.body.notes ?? null;

    let attachments = [];
    try {
      const raw = req.body.attachments;
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed)) attachments = parsed;
      }
    } catch {
      attachments = [];
    }

    const missing = [];
    if (!title || String(title).trim() === '') missing.push('title');
    if (!description || String(description).trim() === '') missing.push('description');
    if (!propertyId) missing.push('property_id');
    if (!category || String(category).trim() === '') missing.push('category');
    if (!priority || String(priority).trim() === '') missing.push('priority');
    if (!reportedBy || String(reportedBy).trim() === '') missing.push('reported_by');
    if (!reportedDate || String(reportedDate).trim() === '') missing.push('reported_date');
    if (!assignedTo || String(assignedTo).trim() === '') missing.push('assigned_to');
    if (!scheduledDate || String(scheduledDate).trim() === '') missing.push('scheduled_date');

    // Get existing columns in complaints table
    const { rows: colRows } = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'complaints' AND table_schema = 'public'
    `);
    const existingCols = colRows.map(r => r.column_name);

    // Require all custom columns
    const standardColsRequired = ['id', 'reference', 'title', 'description', 'category', 'priority',
      'property_id', 'property_name', 'status', 'reported_by', 'reported_date',
      'assigned_to', 'scheduled_date', 'notes', 'attachments', 'created_at', 'updated_at'];
    for (const col of existingCols) {
      if (standardColsRequired.includes(col)) continue;
      const v = req.body[col];
      const camel = col.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      const v2 = v === undefined ? req.body[camel] : v;
      if (v2 === undefined || v2 === null || String(v2).trim() === '') {
        missing.push(col);
      }
    }

    if (missing.length) {
      return res.status(400).json({ success: false, message: `Missing required fields: ${missing.join(', ')}` });
    }

    // Restrict staff/manager to allowed properties
    const currentUser = req.user;
    let restrictedHotelIds = null;
    if (currentUser.role === "manager") {
      const managedRes = await pool.query("SELECT id FROM hotels WHERE manager_id = $1", [currentUser.id]);
      const managedIds = managedRes.rows.map(r => r.id);
      let branchIds = [];
      if (currentUser.branch) {
        const branchRes = await pool.query("SELECT id FROM hotels WHERE branch = $1", [currentUser.branch]);
        branchIds = branchRes.rows.map(r => r.id);
      }
      restrictedHotelIds = [...new Set([...managedIds, ...branchIds])];
    } else if (currentUser.role === "staff") {
      const assignedHotelId = currentUser.hotel_id || currentUser.hotelId || currentUser.hotel || null;
      restrictedHotelIds = assignedHotelId ? [assignedHotelId] : [];
      if (assignedHotelId) {
        propertyId = assignedHotelId;
      }
    }

    if (restrictedHotelIds !== null) {
      if (restrictedHotelIds.length === 0) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      if (!propertyId || !restrictedHotelIds.some((x) => String(x) === String(propertyId))) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
    }

    const ref = makeReference();

    // Build dynamic INSERT
    const columnsToInsert = ['reference', 'title', 'description'];
    const valuesToInsert = [ref, title, description];
    let paramIndex = valuesToInsert.length + 1;

    // Standard optional fields
    const standardFields = {
      category, priority, property_id: propertyId, property_name: propertyName,
      status, reported_by: reportedBy, reported_date: reportedDate,
      assigned_to: assignedTo, scheduled_date: scheduledDate, notes, attachments: JSON.stringify(attachments)
    };

    for (const [key, value] of Object.entries(standardFields)) {
      if (existingCols.includes(key) && value !== undefined) {
        columnsToInsert.push(key);
        valuesToInsert.push(value);
      }
    }

    // Handle custom columns from Forms Builder
    const standardCols = ['id', 'reference', 'title', 'description', 'category', 'priority',
      'property_id', 'property_name', 'status', 'reported_by', 'reported_date',
      'assigned_to', 'scheduled_date', 'notes', 'attachments', 'created_at', 'updated_at'];
    for (const col of existingCols) {
      if (!standardCols.includes(col) && req.body[col] !== undefined) {
        columnsToInsert.push(col);
        valuesToInsert.push(req.body[col]);
      }
    }

    const placeholders = columnsToInsert.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await pool.query(
      `INSERT INTO public.complaints (${columnsToInsert.join(', ')}) 
       VALUES (${placeholders}) 
       RETURNING *`,
      valuesToInsert
    );
    const created = rows[0];

    const newAttachmentIds = await insertComplaintAttachments(created?.id ?? null, req.files || []);
    if (newAttachmentIds.length) {
      const next = [...(Array.isArray(attachments) ? attachments : []), ...newAttachmentIds];
      try {
        const up = await pool.query(
          `UPDATE public.complaints SET attachments = $1::jsonb, updated_at = now() WHERE id = $2 RETURNING *`,
          [JSON.stringify(next), created.id]
        );
        return res.status(201).json({ success: true, data: up.rows?.[0] || created });
      } catch {
        // ignore
      }
    }

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('POST /api/complaints error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* UPDATE */
router.put('/:id', protect, upload.array('photos', 10), async (req, res) => {
  try {
    const ready = await ensureComplaintsTable();
    if (!ready) return res.status(500).json({ success: false, message: 'Database not initialized' });
    const { id } = req.params;

    // Enforce scoping by existing record property
    const checkExists = await pool.query('SELECT id, property_id, attachments FROM public.complaints WHERE id = $1 LIMIT 1', [id]);
    if (!checkExists.rows || checkExists.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    const currentUser = req.user;
    let restrictedHotelIds = null;
    if (currentUser.role === "manager") {
      const managedRes = await pool.query("SELECT id FROM hotels WHERE manager_id = $1", [currentUser.id]);
      const managedIds = managedRes.rows.map(r => r.id);
      let branchIds = [];
      if (currentUser.branch) {
        const branchRes = await pool.query("SELECT id FROM hotels WHERE branch = $1", [currentUser.branch]);
        branchIds = branchRes.rows.map(r => r.id);
      }
      restrictedHotelIds = [...new Set([...managedIds, ...branchIds])];
    } else if (currentUser.role === "staff") {
      const assignedHotelId = currentUser.hotel_id || currentUser.hotelId || currentUser.hotel || null;
      restrictedHotelIds = assignedHotelId ? [assignedHotelId] : [];
    }

    if (restrictedHotelIds !== null) {
      if (restrictedHotelIds.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
      const existingPid = checkExists.rows[0]?.property_id;
      if (!existingPid || !restrictedHotelIds.some((x) => String(x) === String(existingPid))) {
        return res.status(404).json({ success: false, message: 'Not found' });
      }
    }

    // Get existing columns
    const { rows: colRows } = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'complaints' AND table_schema = 'public'
    `);
    const existingCols = colRows.map(r => r.column_name);

    const updates = [];
    const values = [];
    let idx = 1;

    const fields = ['title', 'description', 'category', 'priority', 'property_id', 'property_name', 'status', 'reported_by', 'reported_date', 'assigned_to', 'scheduled_date', 'notes'];
    for (const field of fields) {
      if (!existingCols.includes(field)) continue;
      const camelCase = field.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      let val = req.body[camelCase] ?? req.body[field];
      if (field === 'property_id' && req.user?.role === 'staff') {
        const assignedHotelId = req.user.hotel_id || req.user.hotelId || req.user.hotel || null;
        if (assignedHotelId) {
          val = assignedHotelId;
        }
      }
      if (val !== undefined) {
        // Convert empty strings to null for fields that commonly submit '' from HTML inputs
        if (val === '' && (field === 'reported_date' || field === 'scheduled_date' || field === 'property_id')) {
          val = null;
        }
        updates.push(`${field} = $${idx}`);
        values.push(val);
        idx++;
      }
    }

    if (existingCols.includes('attachments')) {
      const newAttachmentIds = await insertComplaintAttachments(checkExists.rows[0]?.id ?? null, req.files || []);
      if (newAttachmentIds.length) {
        let prev = [];
        try {
          const rawPrev = checkExists.rows[0]?.attachments;
          if (Array.isArray(rawPrev)) prev = rawPrev;
          else if (typeof rawPrev === 'string' && rawPrev) prev = JSON.parse(rawPrev);
          else if (rawPrev && typeof rawPrev === 'object') prev = rawPrev;
        } catch {
          prev = [];
        }
        const next = [...prev, ...newAttachmentIds];
        updates.push(`attachments = $${idx}::jsonb`);
        values.push(JSON.stringify(next));
        idx++;
      }
    }

    // Handle custom columns from Forms Builder
    const standardCols = ['id', 'reference', 'title', 'description', 'category', 'priority',
      'property_id', 'property_name', 'status', 'reported_by', 'reported_date',
      'assigned_to', 'scheduled_date', 'notes', 'attachments', 'created_at', 'updated_at'];
    for (const col of existingCols) {
      if (!standardCols.includes(col) && req.body[col] !== undefined) {
        updates.push(`${col} = $${idx}`);
        values.push(req.body[col]);
        idx++;
      }
    }

    if (!updates.length) return res.status(400).json({ success: false, message: 'No fields to update' });
    updates.push('updated_at = now()');

    const query = `UPDATE public.complaints SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`;
    values.push(id);

    const { rows } = await pool.query(query, values);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('PUT /api/complaints/:id error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* DELETE */
router.delete('/:id', protect, async (req, res) => {
  try {
    const ready = await ensureComplaintsTable();
    if (!ready) return res.status(500).json({ success: false, message: 'Database not initialized' });
    const { id } = req.params;

    const checkExists = await pool.query('SELECT id, property_id FROM public.complaints WHERE id = $1 LIMIT 1', [id]);
    if (!checkExists.rows || checkExists.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    const currentUser = req.user;
    let restrictedHotelIds = null;
    if (currentUser.role === "manager") {
      const managedRes = await pool.query("SELECT id FROM hotels WHERE manager_id = $1", [currentUser.id]);
      const managedIds = managedRes.rows.map(r => r.id);
      let branchIds = [];
      if (currentUser.branch) {
        const branchRes = await pool.query("SELECT id FROM hotels WHERE branch = $1", [currentUser.branch]);
        branchIds = branchRes.rows.map(r => r.id);
      }
      restrictedHotelIds = [...new Set([...managedIds, ...branchIds])];
    } else if (currentUser.role === "staff") {
      const assignedHotelId = currentUser.hotel_id || currentUser.hotelId || currentUser.hotel || null;
      restrictedHotelIds = assignedHotelId ? [assignedHotelId] : [];
    }

    if (restrictedHotelIds !== null) {
      if (restrictedHotelIds.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
      const existingPid = checkExists.rows[0]?.property_id;
      if (!existingPid || !restrictedHotelIds.some((x) => String(x) === String(existingPid))) {
        return res.status(404).json({ success: false, message: 'Not found' });
      }
    }

    const { rows } = await pool.query('DELETE FROM public.complaints WHERE id = $1 RETURNING *', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('DELETE /api/complaints/:id error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
