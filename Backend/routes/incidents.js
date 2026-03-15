import express from 'express';
import poolImport from '../config/db.js';
import { protect } from '../middleware/auth.js';
import multer from 'multer';
const router = express.Router();
const pool = poolImport && poolImport.default ? poolImport.default : poolImport;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

let incidentsTableReady = false;
async function ensureIncidentsTable() {
  if (incidentsTableReady) return true;
  try {
    const check = await pool.query(`SELECT to_regclass('maintenance.incidents') AS exists`);
    if (check.rows?.[0]?.exists) {
      try {
        await pool.query("ALTER TABLE maintenance.incidents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
      } catch (e) {
        // ignore
      }
      try {
        await pool.query("ALTER TABLE maintenance.incidents ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb");
      } catch (e) {
        // ignore
      }

      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS maintenance.incident_attachments (
            id SERIAL PRIMARY KEY,
            incident_id INTEGER,
            file_name TEXT,
            mime_type TEXT,
            file_data BYTEA NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_incident_attachments_incident_id ON maintenance.incident_attachments(incident_id)`);
      } catch (e) {
        // ignore
      }
      incidentsTableReady = true;
      return true;
    }
    console.warn('incidents table missing in maintenance schema. Creating it now...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS maintenance.incidents (
        id SERIAL PRIMARY KEY,
        reference VARCHAR(255) UNIQUE NOT NULL,
        type VARCHAR(255) NOT NULL,
        severity VARCHAR(50) DEFAULT 'Medium',
        property_id INTEGER,
        property_name VARCHAR(255),
        service_user_id INTEGER,
        description TEXT,
        reported_by VARCHAR(255),
        reported_date DATE,
        assigned_to VARCHAR(255),
        status VARCHAR(50) DEFAULT 'Open',
        attachments JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS maintenance.incident_attachments (
        id SERIAL PRIMARY KEY,
        incident_id INTEGER,
        file_name TEXT,
        mime_type TEXT,
        file_data BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_incident_attachments_incident_id ON maintenance.incident_attachments(incident_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_incidents_status ON maintenance.incidents(status)`);
    incidentsTableReady = true;
    return true;
  } catch (err) {
    console.error('Failed to ensure incidents table:', err?.message || err);
    return false;
  }
}

function makeReference() {
  const rnd = Math.floor(1000 + Math.random() * 9000);
  const year = new Date().getFullYear();
  return `INC-${year}-${rnd}`;
}

async function insertIncidentAttachments(incidentId, files = []) {
  if (!Array.isArray(files) || files.length === 0) return [];
  const ids = [];
  for (const f of files) {
    if (!f || !f.buffer) continue;
    const r = await pool.query(
      `INSERT INTO maintenance.incident_attachments (incident_id, file_name, mime_type, file_data)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [incidentId ?? null, f.originalname ?? null, f.mimetype ?? null, f.buffer]
    );
    if (r.rows?.[0]?.id != null) ids.push(r.rows[0].id);
  }
  return ids;
}

router.get('/attachments/:id', protect, async (req, res) => {
  try {
    const ready = await ensureIncidentsTable();
    if (!ready) return res.status(500).end();

    const id = req.params.id;
    if (!/^\d+$/.test(String(id))) return res.status(400).end();

    const r = await pool.query(
      `SELECT id, file_name, mime_type, file_data
       FROM maintenance.incident_attachments
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
    console.error('GET /api/incidents/attachments/:id error:', err);
    return res.status(500).end();
  }
});

router.delete('/attachments/:id', protect, async (req, res) => {
  try {
    const ready = await ensureIncidentsTable();
    if (!ready) return res.status(500).json({ success: false, message: 'Database not initialized' });

    const id = req.params.id;
    if (!/^[0-9]+$/.test(String(id))) return res.status(400).json({ success: false, message: 'Invalid attachment id' });

    const find = await pool.query(
      `SELECT id, incident_id
       FROM maintenance.incident_attachments
       WHERE id = $1
       LIMIT 1`,
      [Number(id)]
    );

    if (!find.rows?.length) return res.status(404).json({ success: false, message: 'Attachment not found' });

    const incidentId = find.rows[0].incident_id;

    await pool.query(
      `DELETE FROM maintenance.incident_attachments
       WHERE id = $1`,
      [Number(id)]
    );

    if (incidentId) {
      await pool.query(
        `UPDATE maintenance.incidents
         SET attachments = COALESCE((
           SELECT jsonb_agg(elem)
           FROM jsonb_array_elements(COALESCE(attachments, '[]'::jsonb)) elem
           WHERE elem::text <> to_jsonb($2::int)::text
         ), '[]'::jsonb)
         WHERE id = $1`,
        [Number(incidentId), Number(id)]
      );
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/incidents/attachments/:id error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* LIST */
router.get('/', protect, async (req, res) => {
  try {
    const ready = await ensureIncidentsTable();
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

    const { limit = 200, offset = 0, property_id, propertyId } = req.query;
    const pidRaw = property_id ?? propertyId ?? null;

    const where = [];
    const values = [];
    let idx = 1;

    // Apply strict filtering if restricted
    if (restrictedHotelIds !== null) {
      if (restrictedHotelIds.length === 0) {
        return res.json({ success: true, data: [] });
      }
      where.push(`property_id = ANY($${idx++})`);
      values.push(restrictedHotelIds);
    }

    if (pidRaw !== null && pidRaw !== undefined && String(pidRaw).trim() !== '') {
      where.push(`CAST(property_id AS text) = $${idx++}::text`);
      values.push(String(pidRaw));
    }

    values.push(Number(limit));
    values.push(Number(offset));

    // Adjust indices for limit/offset
    // If we added restrictedHotelIds, idx was 2. If pidRaw too, idx was 3.
    // The LIMIT $X OFFSET $Y parameters need to match the push order.
    // Actually, safer to rebuild SQL string with specific parameter positions if mixed,
    // but here we pushed them in order: restrictedIds, pidRaw, limit, offset.

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT * FROM maintenance.incidents ${whereClause} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
      values
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('GET /api/incidents error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* GET */
router.get('/:id', protect, async (req, res) => {
  try {
    const ready = await ensureIncidentsTable();
    if (!ready) return res.status(500).json({ success: false, message: 'Database not initialized' });
    const { id } = req.params;
    const { rows } = await pool.query('SELECT * FROM maintenance.incidents WHERE id = $1 LIMIT 1', [id]);
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
    console.error('GET /api/incidents/:id error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* CREATE */
router.post('/', protect, upload.array('photos', 10), async (req, res) => {
  try {
    const ready = await ensureIncidentsTable();
    if (!ready) return res.status(500).json({ success: false, message: 'Database not initialized' });

    // Accept snake_case or camelCase from clients
    const reference = req.body.reference ?? req.body.ref ?? null;
    const type = req.body.type ?? req.body.incidentType ?? null;
    const severity = req.body.severity ?? req.body.severityLevel ?? null;
    const description = req.body.description ?? req.body.desc ?? null;
    const reported_by = req.body.reported_by ?? req.body.reportedBy ?? null;
    const reported_date = req.body.reported_date ?? req.body.reportedDate ?? null;
    const assigned_to = req.body.assigned_to ?? req.body.assignedTo ?? null;
    const status = req.body.status ?? null;

    // property id may be sent as property_id or propertyId or property
    let propertyId = req.body.property_id ?? req.body.propertyId ?? req.body.property ?? null;
    const serviceUserId = req.body.service_user_id ?? req.body.serviceUserId ?? req.body.serviceUser ?? null;
    const propertyNameBody = req.body.property_name ?? req.body.propertyName ?? null;

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

    const missing = [];
    if (!type) missing.push('type');
    if (!severity) missing.push('severity');
    if (!propertyId) missing.push('property_id');
    if (serviceUserId === undefined || serviceUserId === null || String(serviceUserId).trim() === '') missing.push('service_user_id');
    if (!description || String(description).trim() === '') missing.push('description');
    if (!reported_by || String(reported_by).trim() === '') missing.push('reported_by');
    if (!reported_date || String(reported_date).trim() === '') missing.push('reported_date');
    if (!assigned_to || String(assigned_to).trim() === '') missing.push('assigned_to');
    if (!status || String(status).trim() === '') missing.push('status');

    const { rows: colRows } = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'maintenance' AND table_name = 'incidents'");
    const existingCols = colRows.map(r => r.column_name).filter(c => c !== 'id' && c !== 'created_at' && c !== 'updated_at');
    const standardCols = new Set([
      'reference', 'type', 'severity', 'property_id', 'property_name', 'service_user_id',
      'description', 'reported_by', 'reported_date', 'assigned_to', 'status', 'attachments'
    ]);

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

    for (const col of existingCols) {
      if (standardCols.has(col)) continue;
      const v = req.body[col];
      const camel = col.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      const v2 = v === undefined ? req.body[camel] : v;
      if (v2 === undefined || v2 === null || String(v2).trim() === '') {
        missing.push(col);
      }
    }

    if (missing.length) {
      console.error('POST /api/incidents error: Missing required fields', { missing, body: req.body });
      return res.status(400).json({ success: false, message: `Missing required fields: ${missing.join(', ')}` });
    }

    const ref = reference || makeReference();

    const columns = [];
    const values = [];
    for (const col of existingCols) {
      let val = null;
      // Map known aliases for legacy fields
      if (col === 'reference') val = reference || makeReference();
      else if (col === 'type') val = type;
      else if (col === 'severity') val = severity;
      else if (col === 'description') val = description;
      else if (col === 'reported_by') val = reported_by;
      else if (col === 'reported_date') val = reported_date;
      else if (col === 'assigned_to') val = assigned_to;
      else if (col === 'status') val = status || 'Open';
      else if (col === 'property_id') val = propertyId;
      else if (col === 'service_user_id') val = serviceUserId;
      else if (col === 'attachments') val = JSON.stringify(Array.isArray(attachments) ? attachments : []);
      else if (col === 'property_name') {
        val = propertyNameBody ?? req.body.propertyName ?? null;
        if (!val && propertyId) {
          try {
            const r = await pool.query('SELECT name FROM hotels WHERE id = $1 LIMIT 1', [propertyId]);
            if (r.rows && r.rows[0] && r.rows[0].name) val = r.rows[0].name;
          } catch (e) { }
        }
        if (!val) val = String(propertyId ?? '');
      } else {
        // For custom columns, check both snake_case and camelCase
        val = req.body[col];
        if (val === undefined) {
          const camelCase = col.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
          val = req.body[camelCase];
        }
        // Allow null values to be explicitly set (null !== undefined)
        // Only skip if the column is completely missing from the request
        if (val === undefined && !(col in req.body) && !(col.replace(/_([a-z])/g, (g) => g[1].toUpperCase()) in req.body)) {
          // Column not in request, skip it
          continue;
        }
      }
      // Include the column if value is defined (including null)
      if (val !== undefined) {
        if (!standardCols.has(col) && typeof val === 'string') {
          val = val.trim();
        }
        columns.push(col);
        values.push(val);
      }
    }
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(',');
    const query = `INSERT INTO maintenance.incidents (${columns.join(',')}) VALUES (${placeholders}) RETURNING *`;
    console.log('POST /api/incidents - request body:', req.body);
    console.log('POST /api/incidents - columns:', columns);
    console.log('POST /api/incidents - values:', values);
    console.log('POST /api/incidents - executing query:', query);
    try {
      const { rows } = await pool.query(query, values);
      console.log('POST /api/incidents - inserted row:', rows[0]);
      const created = rows[0];

      if (existingCols.includes('attachments')) {
        const newAttachmentIds = await insertIncidentAttachments(created?.id ?? null, req.files || []);
        if (newAttachmentIds.length) {
          const next = [...(Array.isArray(attachments) ? attachments : []), ...newAttachmentIds];
          try {
            const up = await pool.query(
              `UPDATE maintenance.incidents SET attachments = $1::jsonb WHERE id = $2 RETURNING *`,
              [JSON.stringify(next), created.id]
            );
            return res.status(201).json({ success: true, data: up.rows?.[0] || created });
          } catch (e) {
            console.error("Error updating incident with attachment IDs:", e);
            return res.status(201).json({
              success: true,
              data: created,
              warning: "Incident created but photo attachments failed to link."
            });
          }
        }
      }

      return res.status(201).json({ success: true, data: created });
    } catch (err2) {
      console.error('POST /api/incidents DB error:', err2 && err2.stack ? err2.stack : err2);
      return res.status(500).json({ success: false, message: err2 && err2.message ? err2.message : String(err2) });
    }
  } catch (err) {
    console.error('POST /api/incidents error:', err && err.stack ? err.stack : err);
    res.status(500).json({ success: false, message: err && err.message ? err.message : String(err) });
  }
});

/* UPDATE */
router.put('/:id', protect, upload.array('photos', 10), async (req, res) => {
  try {
    const ready = await ensureIncidentsTable();
    if (!ready) return res.status(500).json({ success: false, message: 'Database not initialized' });
    const { id } = req.params;

    const { rows: colRows } = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'maintenance' AND table_name = 'incidents'");
    const existingCols = colRows.map(r => r.column_name).filter(c => c !== 'id' && c !== 'created_at' && c !== 'updated_at');

    // First, verify the incident exists
    const checkExists = await pool.query('SELECT id, property_id, attachments FROM maintenance.incidents WHERE id = $1', [id]);
    if (!checkExists.rows || checkExists.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
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
      if (restrictedHotelIds.length === 0) {
        return res.status(404).json({ success: false, message: 'Incident not found' });
      }
      const existingPid = checkExists.rows[0]?.property_id;
      if (!existingPid || !restrictedHotelIds.some((x) => String(x) === String(existingPid))) {
        return res.status(404).json({ success: false, message: 'Incident not found' });
      }
    }

    const updates = [];
    const values = [];
    let idx = 1;

    if (existingCols.includes('attachments')) {
      const newAttachmentIds = await insertIncidentAttachments(checkExists.rows[0]?.id ?? null, req.files || []);
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
    for (const col of existingCols) {
      let val = null;
      // Skip reference field during updates - it should not be changed
      if (col === 'reference') {
        continue; // Don't update reference on edit
      } else if (col === 'type') val = req.body.type ?? req.body.incidentType ?? null;
      else if (col === 'severity') val = req.body.severity ?? req.body.severityLevel ?? null;
      else if (col === 'description') val = req.body.description ?? req.body.desc ?? null;
      else if (col === 'reported_by') val = req.body.reported_by ?? req.body.reportedBy ?? null;
      else if (col === 'reported_date') val = req.body.reported_date ?? req.body.reportedDate ?? null;
      else if (col === 'assigned_to') val = req.body.assigned_to ?? req.body.assignedTo ?? null;
      else if (col === 'status') val = req.body.status ?? null;
      else if (col === 'attachments') {
        continue;
      }
      else if (col === 'property_id') {
        const requestedPid = req.body.property_id ?? req.body.propertyId ?? req.body.property ?? null;
        if (req.user?.role === 'staff') {
          const assignedHotelId = req.user.hotel_id || req.user.hotelId || req.user.hotel || null;
          val = assignedHotelId ?? requestedPid;
        } else {
          val = requestedPid;
        }
      }
      else if (col === 'service_user_id') val = req.body.service_user_id ?? req.body.serviceUserId ?? req.body.serviceUser ?? null;
      else if (col === 'property_name') {
        val = req.body.property_name ?? req.body.propertyName ?? null;
        if (!val) {
          const finalProperty = req.body.property ?? req.body.propertyId ?? req.body.property_id ?? null;
          if (finalProperty) {
            try {
              const r = await pool.query(`SELECT name FROM hotels WHERE id = $1 LIMIT 1`, [finalProperty]);
              if (r.rows && r.rows[0] && r.rows[0].name) val = r.rows[0].name;
            } catch (e) { }
          }
        }
        if (val === null || val === undefined) {
          val = String(req.body.property ?? req.body.propertyId ?? req.body.property_id ?? "");
        }
      } else {
        // For custom columns, check both snake_case and camelCase
        val = req.body[col];
        if (val === undefined) {
          const camelCase = col.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
          val = req.body[camelCase];
        }
        // Allow null values to be explicitly set
        // Only skip if the column is completely missing from the request
        if (val === undefined && !(col in req.body) && !(col.replace(/_([a-z])/g, (g) => g[1].toUpperCase()) in req.body)) {
          // Column not in request, skip it
          continue;
        }
      }
      // Include the update if value is defined (including null)
      if (val !== undefined) {
        updates.push(`${col} = $${idx}`);

        let finalVal = val;
        // Basic type coercion for specific fields if needed
        const meta = colRows.find(r => r.column_name === col);
        if (meta && meta.data_type === 'boolean' && val !== null) {
          if (typeof val === 'boolean') finalVal = val;
          else {
            const s = String(val).toLowerCase().trim();
            finalVal = ['true', '1', 'yes', 'on'].includes(s);
          }
        } else if (meta && (meta.data_type === 'integer' || meta.data_type === 'numeric') && val !== null) {
          if (typeof val === 'string' && val.trim() === '') finalVal = null;
          else {
            const n = Number(val);
            if (!isNaN(n)) finalVal = n;
          }
        } else if (typeof val === 'string' && val.trim() === '') {
          // Fallback: empty strings to null for everything else too if they are optional
          finalVal = null;
        }

        values.push(finalVal);
        idx++;
      }
    }
    if (!updates.length) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    // Always update the updated_at timestamp
    if (colRows.map(r => r.column_name).includes('updated_at')) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
    }

    const query = `UPDATE maintenance.incidents SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`;
    values.push(id);

    console.log('PUT /api/incidents/:id - request body:', req.body);
    console.log('PUT /api/incidents/:id - incident ID:', id);
    console.log('PUT /api/incidents/:id - updates:', updates);
    console.log('PUT /api/incidents/:id - values:', values);
    console.log('PUT /api/incidents/:id - executing query:', query);

    try {
      const { rows } = await pool.query(query, values);
      console.log('PUT /api/incidents/:id - updated row:', rows[0]);

      if (!rows || rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Incident not found or update failed' });
      }

      res.json({ success: true, data: rows[0] });
    } catch (err2) {
      console.error('PUT /api/incidents/:id DB error:', err2 && err2.stack ? err2.stack : err2);
      return res.status(500).json({
        success: false,
        message: err2 && err2.message ? err2.message : String(err2),
        error: err2?.code || 'DATABASE_ERROR'
      });
    }
  } catch (err) {
    console.error('PUT /api/incidents/:id error:', err && err.stack ? err.stack : err);
    res.status(500).json({ success: false, message: err && err.message ? err.message : String(err) });
  }
});

/* DELETE */
router.delete('/:id', protect, async (req, res) => {
  try {
    const ready = await ensureIncidentsTable();
    if (!ready) return res.status(500).json({ success: false, message: 'Database not initialized' });
    const { id } = req.params;

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
      if (restrictedHotelIds.length === 0) {
        return res.status(404).json({ success: false, message: 'Not found' });
      }
      const existing = await pool.query('SELECT property_id FROM maintenance.incidents WHERE id = $1 LIMIT 1', [id]);
      const existingPid = existing.rows?.[0]?.property_id;
      if (!existingPid || !restrictedHotelIds.some((x) => String(x) === String(existingPid))) {
        return res.status(404).json({ success: false, message: 'Not found' });
      }
    }
    console.log('DELETE /api/incidents - id:', id);
    const { rows } = await pool.query('DELETE FROM maintenance.incidents WHERE id = $1 RETURNING *', [id]);
    console.log('DELETE /api/incidents - deleted row:', rows[0]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('DELETE /api/incidents/:id error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* DIAGNOSTIC: returns DB info and where incidents table exists and counts per schema */
router.get('/_diagnose', async (req, res) => {
  try {
    const ready = await ensureIncidentsTable();
    if (!ready) return res.status(500).json({ success: false, message: 'Database not initialized' });
    const info = await pool.query(`SELECT current_database() AS db, current_user AS user, current_schema() AS schema`);
    const sp = await pool.query(`SHOW search_path`);
    const tables = await pool.query(`SELECT schemaname FROM pg_tables WHERE tablename = 'incidents' AND schemaname = 'maintenance'`);
    const schemas = tables.rows.map(r => r.schemaname);
    const counts = {};
    for (const s of schemas) {
      try {
        const c = await pool.query(`SELECT count(*)::int AS cnt FROM maintenance.incidents`);
        counts[s] = c.rows[0].cnt;
      } catch (e) {
        counts[s] = `error: ${String(e.message)}`;
      }
    }
    res.json({ success: true, db: info.rows[0], search_path: sp.rows[0].search_path, schemas, counts });
  } catch (err) {
    console.error('GET /api/incidents/_diagnose error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
