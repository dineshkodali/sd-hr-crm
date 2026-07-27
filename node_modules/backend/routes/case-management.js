import express from "express";
import pool from "../config/db.js";
import { protect } from "../middleware/auth.js";
import multer from "multer";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function makeCaseReference() {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return `CASE-${year}-${month}-${rnd}`;
}

async function getAllowedHotels(user) {
  if (!user) return { ids: [], namesLower: [] };
  if (user.role === 'admin') return { ids: null, namesLower: null };

  let query = '';
  let params = [];

  if (user.role === 'manager') {
    query = 'SELECT id, name FROM public.hotels WHERE manager_id = $1';
    params = [user.id];
    if (user.branch) {
      query += ' OR branch = $2';
      params.push(user.branch);
    }
  } else if (user.role === 'staff') {
    const assignedHotelId = user.hotel_id || user.hotelId || user.hotel || null;
    if (!assignedHotelId) return { ids: [], namesLower: [] };
    query = 'SELECT id, name FROM public.hotels WHERE id = $1';
    params = [assignedHotelId];
  } else {
    return { ids: [], namesLower: [] };
  }

  const result = await pool.query(query, params);
  const rows = Array.isArray(result.rows) ? result.rows : [];
  return {
    ids: rows.map(r => r.id).filter(v => v !== null && v !== undefined),
    namesLower: rows.map(r => String(r.name || '').trim().toLowerCase()).filter(Boolean),
  };
}

let caseTableReady = false;

async function ensureCaseTable() {
  if (caseTableReady) return true;
  try {
    const check = await pool.query(`SELECT to_regclass('public.case_management') AS exists`);
    if (check.rows?.[0]?.exists) {
      try {
        await pool.query("ALTER TABLE public.case_management ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb");
      } catch {
        // ignore
      }
      caseTableReady = true;
      return true;
    }
    console.warn('case_management table missing. Creating it now...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.case_management (
        id SERIAL PRIMARY KEY,
        reference VARCHAR(255) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        priority VARCHAR(50) DEFAULT 'medium',
        property_id INTEGER,
        property_name VARCHAR(255),
        status VARCHAR(50) DEFAULT 'open',
        assigned_to VARCHAR(255),
        reported_by VARCHAR(255),
        reported_date DATE,
        scheduled_date DATE,
        notes TEXT,
        attachments JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_case_status ON public.case_management(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_case_priority ON public.case_management(priority)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_case_created_at ON public.case_management(created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_case_property ON public.case_management(property_id)`);
    caseTableReady = true;
    return true;
  } catch (err) {
    console.error('Failed to ensure case_management table:', err?.message || err);
    return false;
  }
}

let caseAttachmentsReady = false;
async function ensureCaseAttachments() {
  if (caseAttachmentsReady) return true;
  await ensureCaseTable();
  try {
    await pool.query("ALTER TABLE public.case_management ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb");
  } catch {
    // ignore
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.case_management_attachments (
        id SERIAL PRIMARY KEY,
        case_id INTEGER,
        file_name TEXT,
        mime_type TEXT,
        file_data BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    try {
      await pool.query("ALTER TABLE public.case_management_attachments ADD COLUMN IF NOT EXISTS case_id INTEGER");
    } catch {
      // ignore
    }
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_case_management_attachments_case_id ON public.case_management_attachments(case_id)`);
  } catch {
    // ignore
  }
  caseAttachmentsReady = true;
  return true;
}

async function insertCaseAttachments(caseId, files = []) {
  if (!Array.isArray(files) || files.length === 0) return [];
  const ids = [];
  for (const f of files) {
    if (!f || !f.buffer) continue;
    const r = await pool.query(
      `INSERT INTO public.case_management_attachments (case_id, file_name, mime_type, file_data)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [caseId ?? null, f.originalname ?? null, f.mimetype ?? null, f.buffer]
    );
    if (r.rows?.[0]?.id != null) ids.push(r.rows[0].id);
  }
  return ids;
}

// GET all cases
router.get('/', protect, async (req, res) => {
  try {
    await ensureCaseTable();
    const limit = req.query.limit || 2000;

    const allowed = await getAllowedHotels(req.user);
    if (allowed.ids !== null && allowed.ids.length === 0 && allowed.namesLower.length === 0) {
      return res.json({ data: [] });
    }

    const values = [];
    let text = 'SELECT * FROM case_management';
    if (allowed.ids !== null) {
      text += ' WHERE (property_id = ANY($1::int[]) OR LOWER(property_name) = ANY($2::text[]))';
      values.push(allowed.ids);
      values.push(allowed.namesLower);
    }
    values.push(limit);
    text += ` ORDER BY created_at DESC LIMIT $${values.length}`;

    const result = await pool.query(text, values);
    res.json({ data: result.rows });
  } catch (err) {
    console.error('GET /api/case-management error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Columns polling endpoint for frontend
router.get('/columns', protect, async (req, res) => {
  try {
    await ensureCaseTable();
    const columnsResult = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'case_management'`
    );
    const columns = (columnsResult.rows || []).map((r) => r.column_name);
    return res.json({ success: true, columns });
  } catch (err) {
    console.error('GET /api/case-management/columns error:', err?.message || err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET single case
router.get('/:id', protect, async (req, res) => {
  try {
    await ensureCaseTable();

    const id = req.params.id;
    if (!/^\d+$/.test(String(id))) {
      return res.status(400).json({ error: 'Invalid case id' });
    }

    const result = await pool.query(
      `SELECT * FROM case_management WHERE id = $1`,
      [Number(id)]
    );

    if (!result.rows.length) return res.json(null);

    const allowed = await getAllowedHotels(req.user);
    const record = result.rows[0];
    const recNameLower = String(record.property_name || '').trim().toLowerCase();
    if (
      allowed.ids !== null &&
      !(allowed.ids.includes(record.property_id) || (recNameLower && allowed.namesLower.includes(recNameLower)))
    ) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(record);
  } catch (err) {
    console.error(`GET /api/case-management/:id error:`, err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/attachments/:id', protect, async (req, res) => {
  try {
    await ensureCaseAttachments();
    const id = req.params.id;
    if (!/^\d+$/.test(String(id))) return res.status(400).end();
    const r = await pool.query(
      `SELECT id, file_name, mime_type, file_data
       FROM public.case_management_attachments
       WHERE id = $1
       LIMIT 1`,
      [Number(id)]
    );
    if (!r.rows?.length) return res.status(404).end();
    const row = r.rows[0];
    const mime = row.mime_type || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    if (row.file_name) {
      res.setHeader('Content-Disposition', `inline; filename="${String(row.file_name).replace(/\"/g, '')}"`);
    }
    return res.send(row.file_data);
  } catch (err) {
    console.error('GET /api/case-management/attachments/:id error:', err && (err.stack || err));
    return res.status(500).end();
  }
});

router.delete('/attachments/:id', protect, async (req, res) => {
  try {
    await ensureCaseAttachments();
    const id = req.params.id;
    if (!/^\d+$/.test(String(id))) return res.status(400).json({ message: 'Invalid attachment id' });
    const attId = Number(id);

    const existing = await pool.query(
      `SELECT id, case_id FROM public.case_management_attachments WHERE id = $1 LIMIT 1`,
      [attId]
    );
    if (!existing.rows?.length) return res.status(404).json({ message: 'Attachment not found' });
    const caseId = existing.rows[0]?.case_id ?? null;

    await pool.query(`DELETE FROM public.case_management_attachments WHERE id = $1`, [attId]);

    if (caseId) {
      await pool.query(
        `UPDATE public.case_management
         SET attachments = COALESCE(
           (SELECT jsonb_agg(value)
            FROM jsonb_array_elements(COALESCE(attachments, '[]'::jsonb)) value
            WHERE value::text <> to_jsonb($1::int)::text
           ),
           '[]'::jsonb
         ),
         updated_at = now()
         WHERE id = $2`,
        [attId, caseId]
      );
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/case-management/attachments/:id error:', err && (err.stack || err));
    return res.status(500).json({ message: 'Server error', detail: err?.message });
  }
});

// CREATE
router.post('/', protect, upload.array('photos', 10), async (req, res) => {
  try {
    await ensureCaseAttachments();
    await ensureCaseTable();
    const reference = makeCaseReference();

    if (req.user?.role === 'staff') {
      const assignedHotelId = req.user.hotel_id || req.user.hotelId || req.user.hotel || null;
      if (assignedHotelId) {
        req.body.property_id = assignedHotelId;
      }
    }

    const allowed = await getAllowedHotels(req.user);
    const propertyId = req.body.property_id != null ? parseInt(req.body.property_id, 10) : null;
    const propertyNameLower = String(req.body.property_name || '').trim().toLowerCase();
    if (allowed.ids !== null) {
      const ok =
        (propertyId && allowed.ids.includes(propertyId)) ||
        (propertyNameLower && allowed.namesLower.includes(propertyNameLower));
      if (!ok) {
        return res.status(403).json({ error: 'Cannot create record for a property outside your access' });
      }
    }
    // Get all columns from the table
    const columnsResult = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'case_management'`
    );
    const allColumns = columnsResult.rows.map(r => r.column_name);
    // Standard columns (excluding id, timestamps, and auto-generated fields)
    const standardColumns = [
      'id', 'reference', 'created_at', 'updated_at', 'created_by', 'updated_by',
      'title', 'description', 'category', 'priority', 'property_id', 'property_name', 'status',
      'assigned_to', 'reported_by', 'reported_date', 'scheduled_date', 'notes', 'attachments'
    ];

    const allColsSet = new Set(allColumns);

    // Find custom columns
    const customColumns = allColumns.filter(col => !standardColumns.includes(col));

    const missing = [];
    if (!req.body.title || String(req.body.title).trim() === '') missing.push('title');
    if (!req.body.description || String(req.body.description).trim() === '') missing.push('description');
    if (!req.body.category || String(req.body.category).trim() === '') missing.push('category');
    if (!req.body.priority || String(req.body.priority).trim() === '') missing.push('priority');
    if (!req.body.property_id || String(req.body.property_id).trim() === '') missing.push('property_id');
    if (!req.body.property_name || String(req.body.property_name).trim() === '') missing.push('property_name');
    if (!req.body.status || String(req.body.status).trim() === '') missing.push('status');
    if (!req.body.assigned_to || String(req.body.assigned_to).trim() === '') missing.push('assigned_to');
    if (!req.body.reported_by || String(req.body.reported_by).trim() === '') missing.push('reported_by');
    if (!req.body.scheduled_date || String(req.body.scheduled_date).trim() === '') missing.push('scheduled_date');

    for (const col of customColumns) {
      const v = req.body[col];
      const camel = String(col).replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      const v2 = v === undefined ? req.body[camel] : v;
      if (v2 === undefined || v2 === null || (typeof v2 !== 'boolean' && String(v2).trim() === '')) {
        missing.push(col);
      }
    }

    if (missing.length) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }

    // Build column list and parameter values for standard fields.
    // Only include columns that actually exist in DB (schema can differ between environments).
    const basePairs = [
      ['reference', reference],
      ['title', req.body.title],
      ['description', req.body.description],
      ['category', req.body.category],
      ['priority', req.body.priority || 'medium'],
      ['property_id', req.body.property_id || null],
      ['property_name', req.body.property_name || ''],
      ['status', req.body.status || 'open'],
      ['reported_by', req.body.reported_by || ''],
      ['reported_date', (req.body.reported_date && String(req.body.reported_date).trim()) ? req.body.reported_date : null],
      ['assigned_to', req.body.assigned_to || ''],
      ['scheduled_date', (req.body.scheduled_date && String(req.body.scheduled_date).trim()) ? req.body.scheduled_date : null],
      ['notes', req.body.notes || ''],
    ];

    const columns = [];
    const values = [];
    for (const [col, val] of basePairs) {
      if (!allColsSet.has(col)) continue;
      columns.push(col);
      values.push(val);
    }
    // Add custom columns if they exist in the request and sanitize input
    customColumns.forEach(col => {
      if (Object.prototype.hasOwnProperty.call(req.body, col)) {
        let value = req.body[col];
        if (typeof value === 'string' && value.trim() === '') value = null;
        columns.push(col);
        values.push(value);
      }
    });
    // Build parameterized query (append timestamps as NOW() literals)
    const placeholders = values.map((_, i) => `$${i + 1}`);
    const query = `INSERT INTO case_management (${columns.join(', ')}, created_at, updated_at) VALUES (${placeholders.join(', ')}, NOW(), NOW()) RETURNING *`;
    const paramValues = values;
    console.log('POST /api/case-management body:', req.body);
    console.log('POST /api/case-management query:', query);
    console.log('POST /api/case-management params:', paramValues);
    try {
      const result = await pool.query(query, paramValues);
      let created = result.rows[0];

      if (created?.id && Array.isArray(req.files) && req.files.length) {
        const newIds = await insertCaseAttachments(created.id, req.files);
        if (newIds.length) {
          try {
            const up = await pool.query(
              `UPDATE public.case_management SET attachments = $1::jsonb, updated_at = now() WHERE id = $2 RETURNING *`,
              [JSON.stringify(newIds), created.id]
            );
            created = up.rows?.[0] || created;
          } catch {
            // ignore
          }
        }
      }

      res.status(201).json(created);
    } catch (err) {
      console.error('POST /api/case-management error:', err);
      res.status(500).json({ error: err.message, details: err, query, paramValues });
    }
  } catch (err) {
    console.error('POST /api/case-management error:', err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE
router.put('/:id', protect, upload.array('photos', 10), async (req, res) => {
  try {
    await ensureCaseAttachments();
    await ensureCaseTable();

    if (req.user?.role === 'staff') {
      const assignedHotelId = req.user.hotel_id || req.user.hotelId || req.user.hotel || null;
      if (assignedHotelId) {
        req.body.property_id = assignedHotelId;
      }
    }

    const allowed = await getAllowedHotels(req.user);
    if (allowed.ids !== null) {
      const checkRes = await pool.query('SELECT property_id, property_name FROM case_management WHERE id=$1', [req.params.id]);
      if (!checkRes.rows.length) return res.status(404).json({ error: 'Case not found' });
      const existingNameLower = String(checkRes.rows[0].property_name || '').trim().toLowerCase();
      const existingOk =
        allowed.ids.includes(checkRes.rows[0].property_id) ||
        (existingNameLower && allowed.namesLower.includes(existingNameLower));
      if (!existingOk) return res.status(403).json({ error: 'Access denied' });

      const nextPropertyId = req.body.property_id != null ? parseInt(req.body.property_id, 10) : null;
      const nextNameLower = String(req.body.property_name || '').trim().toLowerCase();
      if (nextPropertyId !== null || nextNameLower) {
        const nextOk =
          (nextPropertyId !== null && allowed.ids.includes(nextPropertyId)) ||
          (nextNameLower && allowed.namesLower.includes(nextNameLower));
        if (!nextOk) return res.status(403).json({ error: 'Cannot move record to a property outside your access' });
      }
    }
    // Get all columns from the table
    const columnsResult = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'case_management'`
    );
    const allColumns = columnsResult.rows.map(r => r.column_name);
    // Standard columns (excluding id, timestamps, and auto-generated fields)
    const standardColumns = [
      'id', 'reference', 'created_at', 'updated_at', 'created_by', 'updated_by'
    ];
    // Find updatable columns (standard fields + custom columns)
    const updatableColumns = allColumns.filter(col => !standardColumns.includes(col));
    // Build SET clause dynamically based on what's in the request body
    const setClauses = [];
    const values = [];
    let paramIndex = 1;
    const existingSet = new Set(allColumns);
    // Standard fields (only if exist)
    const standardFields = ['title', 'description', 'category', 'priority', 'property_id', 'property_name', 'status', 'reported_by', 'reported_date', 'assigned_to', 'scheduled_date', 'notes']
      .filter((f) => existingSet.has(f));
    standardFields.forEach(field => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        let value = req.body[field];
        if (typeof value === 'string' && value.trim() === '') value = null;
        setClauses.push(`${field}=$${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });
    // Custom columns
    updatableColumns.forEach(col => {
      if (!standardFields.includes(col) && Object.prototype.hasOwnProperty.call(req.body, col)) {
        let value = req.body[col];
        if (typeof value === 'string' && value.trim() === '') value = null;
        setClauses.push(`${col}=$${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });
    // Always update updated_at
    setClauses.push('updated_at=NOW()');
    // Add id as the last parameter
    values.push(req.params.id);
    const query = `UPDATE case_management SET ${setClauses.join(', ')} WHERE id=$${paramIndex} RETURNING *`;
    console.log('PUT /api/case-management/:id body:', req.body);
    console.log('PUT /api/case-management/:id query:', query);
    console.log('PUT /api/case-management/:id params:', values);
    try {
      const result = await pool.query(query, values);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Case not found' });
      }

      let updated = result.rows[0];
      if (updated?.id && Array.isArray(req.files) && req.files.length) {
        const newIds = await insertCaseAttachments(updated.id, req.files);
        if (newIds.length) {
          let prev = [];
          try {
            const rawPrev = updated.attachments;
            if (Array.isArray(rawPrev)) prev = rawPrev;
            else if (typeof rawPrev === 'string' && rawPrev) prev = JSON.parse(rawPrev);
            else if (rawPrev && typeof rawPrev === 'object') prev = rawPrev;
          } catch {
            prev = [];
          }
          const next = [...(Array.isArray(prev) ? prev : []), ...newIds];
          try {
            const up = await pool.query(
              `UPDATE public.case_management SET attachments = $1::jsonb, updated_at = now() WHERE id = $2 RETURNING *`,
              [JSON.stringify(next), updated.id]
            );
            updated = up.rows?.[0] || updated;
          } catch {
            // ignore
          }
        }
      }

      res.json(updated);
    } catch (err) {
      // Improved error message for debugging
      console.error('PUT /api/case-management/:id SQL error:', err);
      return res.status(500).json({ error: err.message, details: err, query, values });
    }
  } catch (err) {
    console.error('PUT /api/case-management/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE
router.delete('/:id', protect, async (req, res) => {
  try {
    await ensureCaseTable();

    const allowed = await getAllowedHotels(req.user);
    if (allowed.ids !== null) {
      const checkRes = await pool.query('SELECT property_id, property_name FROM case_management WHERE id=$1', [req.params.id]);
      if (!checkRes.rows.length) return res.status(404).json({ error: 'Case not found' });
      const existingNameLower = String(checkRes.rows[0].property_name || '').trim().toLowerCase();
      const existingOk =
        allowed.ids.includes(checkRes.rows[0].property_id) ||
        (existingNameLower && allowed.namesLower.includes(existingNameLower));
      if (!existingOk) return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(`DELETE FROM case_management WHERE id = $1 RETURNING id`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Case not found' });
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error('DELETE /api/case-management/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
