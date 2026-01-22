import express from "express";
import pool from "../config/db.js";
import { protect } from "../middleware/auth.js";
import { applyCrudLogging } from "../middleware/activityMiddleware.js"; // Enhanced logging

const router = express.Router();


// Apply CRUD logging to all operations
applyCrudLogging(router, 'vcs_organisations', 'vcs_organisations');
let vcsTableReady = false;

async function ensureVCSTable() {
  if (vcsTableReady) return true;
  try {
    const check = await pool.query(`SELECT to_regclass('public.vcs_organisations') AS exists`);
    if (check.rows?.[0]?.exists) {
      vcsTableReady = true;
      return true;
    }
    console.warn('vcs_organisations table missing. Creating it now...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.vcs_organisations (
        id SERIAL PRIMARY KEY,
        reference VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        priority VARCHAR(50) DEFAULT 'medium',
        property_id INTEGER,
        property_name VARCHAR(255),
        status VARCHAR(50) DEFAULT 'new',
        assigned_to VARCHAR(255),
        reported_by VARCHAR(255),
        reported_date DATE,
        scheduled_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_vcs_status ON public.vcs_organisations(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_vcs_priority ON public.vcs_organisations(priority)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_vcs_created_at ON public.vcs_organisations(created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_vcs_property ON public.vcs_organisations(property_id)`);
    vcsTableReady = true;
    return true;
  } catch (err) {
    console.error('Failed to ensure vcs_organisations table:', err?.message || err);
    return false;
  }
}

function makeVCSReference() {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return `VCSO-${year}-${month}-${rnd}`;
}

// GET all VCS organisations
router.get('/', protect, async (req, res) => {
  try {
    await ensureVCSTable();
    const limit = req.query.limit || 2000;
    const result = await pool.query(
      `SELECT * FROM vcs_organisations ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('GET /api/vcs-organisations error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET single VCS organisation
router.get('/:id', protect, async (req, res) => {
  try {
    await ensureVCSTable();
    const result = await pool.query(
      `SELECT * FROM vcs_organisations WHERE id = $1`,
      [req.params.id]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error(`GET /api/vcs-organisations/:id error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// CREATE VCS organisation
router.post('/', protect, async (req, res) => {
  try {
    await ensureVCSTable();
    const reference = makeVCSReference();
    // Get all columns from the table
    const columnsResult = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'vcs_organisations'`
    );
    const allColumns = columnsResult.rows.map(r => r.column_name);
    // Standard columns (excluding id, timestamps, and auto-generated fields)
    const standardColumns = [
      'id', 'reference', 'created_at', 'updated_at', 'created_by', 'updated_by',
      'name', 'description', 'category', 'priority', 'property_id', 'property_name', 'status',
      'assigned_to', 'reported_by', 'reported_date', 'scheduled_date', 'notes'
    ];
    // Find custom columns
    const customColumns = allColumns.filter(col => !standardColumns.includes(col));
    // Build column list and values for standard fields
    const columns = ['reference', 'name', 'description', 'category', 'priority', 'property_id', 'property_name', 'status', 'reported_by', 'reported_date', 'assigned_to', 'scheduled_date', 'notes', 'created_at', 'updated_at'];
    const values = [
      reference,
      req.body.name,
      req.body.description,
      req.body.category,
      req.body.priority || 'medium',
      req.body.property_id || null,
      req.body.property_name || '',
      req.body.status || 'new',
      req.body.reported_by || '',
      req.body.reported_date && req.body.reported_date.trim() ? req.body.reported_date : null,
      req.body.assigned_to || '',
      req.body.scheduled_date && req.body.scheduled_date.trim() ? req.body.scheduled_date : null,
      req.body.notes || '',
      'NOW()',
      'NOW()'
    ];
    // Add custom columns if they exist in the request and sanitize input
    customColumns.forEach(col => {
      if (req.body.hasOwnProperty(col)) {
        let value = req.body[col];
        // Basic type sanitization: convert empty string to null for non-text columns
        if (typeof value === 'string' && value.trim() === '') value = null;
        columns.push(col);
        values.push(value);
      }
    });
    // Build parameterized query
    const placeholders = values.map((_, i) => {
      if (i === values.length - 2 || i === values.length - 1) return values[i]; // NOW() functions
      return `$${i + 1}`;
    });
    const query = `INSERT INTO vcs_organisations (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    const paramValues = values.filter((v, i) => i < values.length - 2 || typeof v !== 'string' || !v.includes('NOW'));
    console.log('POST /api/vcs-organisations body:', req.body);
    console.log('POST /api/vcs-organisations query:', query);
    console.log('POST /api/vcs-organisations params:', paramValues);
    const result = await pool.query(query, paramValues);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /api/vcs-organisations error:', err);
    res.status(500).json({ error: err.message, details: err });
  }
});

// UPDATE VCS organisation
router.put('/:id', protect, async (req, res) => {
  try {
    await ensureVCSTable();
    // Get all columns from the table
    const columnsResult = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'vcs_organisations'`
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
    // Standard fields
    const standardFields = ['name', 'description', 'category', 'priority', 'property_id', 'property_name', 'status', 'reported_by', 'reported_date', 'assigned_to', 'scheduled_date', 'notes'];
    standardFields.forEach(field => {
      if (req.body.hasOwnProperty(field)) {
        let value = req.body[field];
        if (typeof value === 'string' && value.trim() === '') value = null;
        setClauses.push(`${field}=$${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });
    // Custom columns
    updatableColumns.forEach(col => {
      if (!standardFields.includes(col) && req.body.hasOwnProperty(col)) {
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
    const query = `UPDATE vcs_organisations SET ${setClauses.join(', ')} WHERE id=$${paramIndex} RETURNING *`;
    console.log('PUT /api/vcs-organisations/:id body:', req.body);
    console.log('PUT /api/vcs-organisations/:id query:', query);
    console.log('PUT /api/vcs-organisations/:id params:', values);
    try {
      const result = await pool.query(query, values);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'VCS organisation not found' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      // Improved error message for debugging
      console.error('PUT /api/vcs-organisations/:id SQL error:', err);
      return res.status(500).json({ error: err.message, details: err, query, values });
    }
  } catch (err) {
    console.error('PUT /api/vcs-organisations/:id error:', err);
    res.status(500).json({ error: err.message, details: err });
  }
});

// DELETE VCS organisation
router.delete('/:id', protect, async (req, res) => {
  try {
    await ensureVCSTable();
    const result = await pool.query(
      `DELETE FROM vcs_organisations WHERE id = $1 RETURNING id`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'VCS organisation not found' });
    }

    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error('DELETE /api/vcs-organisations/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
