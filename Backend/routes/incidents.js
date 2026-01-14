import express from 'express';
import poolImport from '../config/db.js';
const router = express.Router();
const pool = poolImport && poolImport.default ? poolImport.default : poolImport;

let incidentsTableReady = false;
async function ensureIncidentsTable() {
  if (incidentsTableReady) return true;
  try {
    const check = await pool.query(`SELECT to_regclass('maintenance.incidents') AS exists`);
    if (check.rows?.[0]?.exists) {
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
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

/* LIST */
router.get('/', async (req, res) => {
  try {
    const ready = await ensureIncidentsTable();
    if (!ready) return res.status(500).json({ success: false, message: 'Database not initialized' });

    const { limit = 200, offset = 0 } = req.query;
    const { rows } = await pool.query(`SELECT * FROM maintenance.incidents ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('GET /api/incidents error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* GET */
router.get('/:id', async (req, res) => {
  try {
    const ready = await ensureIncidentsTable();
    if (!ready) return res.status(500).json({ success: false, message: 'Database not initialized' });
    const { id } = req.params;
    const { rows } = await pool.query('SELECT * FROM maintenance.incidents WHERE id = $1 LIMIT 1', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('GET /api/incidents/:id error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* CREATE */
router.post('/', async (req, res) => {
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
    const propertyId = req.body.property_id ?? req.body.propertyId ?? req.body.property ?? null;
    const serviceUserId = req.body.service_user_id ?? req.body.serviceUserId ?? req.body.serviceUser ?? null;
    const propertyNameBody = req.body.property_name ?? req.body.propertyName ?? null;

    if (!type || !propertyId || !description) {
      console.error('POST /api/incidents error: Missing required fields', { type, propertyId, description, body: req.body });
      return res.status(400).json({ success: false, message: 'Missing required fields: type, property_id (or propertyId), description' });
    }

    const ref = reference || makeReference();

    const { rows: colRows } = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'maintenance' AND table_name = 'incidents'");
    const existingCols = colRows.map(r => r.column_name).filter(c => c !== 'id' && c !== 'created_at' && c !== 'updated_at');

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
      else if (col === 'property_name') {
        val = propertyNameBody ?? req.body.propertyName ?? null;
        if (!val && propertyId) {
          try {
            const r = await pool.query('SELECT name FROM hotels WHERE id = $1 LIMIT 1', [propertyId]);
            if (r.rows && r.rows[0] && r.rows[0].name) val = r.rows[0].name;
          } catch (e) {}
        }
        if (!val) val = String(propertyId ?? '');
      } else {
        // For custom columns, accept any value from body (snake_case or camelCase)
        // Check both snake_case and camelCase versions
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
        columns.push(col);
        values.push(val);
      }
    }
    const placeholders = columns.map((_, i) => `$${i+1}`).join(',');
    const query = `INSERT INTO maintenance.incidents (${columns.join(',')}) VALUES (${placeholders}) RETURNING *`;
    console.log('POST /api/incidents - request body:', req.body);
    console.log('POST /api/incidents - columns:', columns);
    console.log('POST /api/incidents - values:', values);
    console.log('POST /api/incidents - executing query:', query);
    try {
      const { rows } = await pool.query(query, values);
      console.log('POST /api/incidents - inserted row:', rows[0]);
      res.status(201).json({ success: true, data: rows[0] });
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
router.put('/:id', async (req, res) => {
  try {
    const ready = await ensureIncidentsTable();
    if (!ready) return res.status(500).json({ success: false, message: 'Database not initialized' });
    const { id } = req.params;

    const { rows: colRows } = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'maintenance' AND table_name = 'incidents'");
    const existingCols = colRows.map(r => r.column_name).filter(c => c !== 'id' && c !== 'created_at' && c !== 'updated_at');

    // First, verify the incident exists
    const checkExists = await pool.query('SELECT id FROM maintenance.incidents WHERE id = $1', [id]);
    if (!checkExists.rows || checkExists.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }

    const updates = [];
    const values = [];
    let idx = 1;
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
      else if (col === 'property_id') val = req.body.property_id ?? req.body.propertyId ?? req.body.property ?? null;
      else if (col === 'service_user_id') val = req.body.service_user_id ?? req.body.serviceUserId ?? req.body.serviceUser ?? null;
      else if (col === 'property_name') {
        val = req.body.property_name ?? req.body.propertyName ?? null;
        if (!val) {
          const finalProperty = req.body.property ?? req.body.propertyId ?? req.body.property_id ?? null;
          if (finalProperty) {
            try {
              const r = await pool.query(`SELECT name FROM hotels WHERE id = $1 LIMIT 1`, [finalProperty]);
              if (r.rows && r.rows[0] && r.rows[0].name) val = r.rows[0].name;
            } catch (e) {}
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
        values.push(val);
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
router.delete('/:id', async (req, res) => {
  try {
    const ready = await ensureIncidentsTable();
    if (!ready) return res.status(500).json({ success: false, message: 'Database not initialized' });
    const { id } = req.params;
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
