import express from 'express';
import { protect } from '../middleware/auth.js';
import pool from '../config/db.js';

const router = express.Router();

function genRef() {
  const year = new Date().getFullYear();
  const random = Math.random().toString(16).slice(2, 10);
  return `HSRM-${year}-${random}`;
}

// GET list
router.get('/risk-management', protect, async (req, res) => {
  try {
    const limit = req.query.limit || 500;
    const result = await pool.query('SELECT * FROM public.hse_risk_management ORDER BY created_at DESC LIMIT $1', [limit]);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /risk-management error', err);
    res.status(500).json({ message: err.message });
  }
});

// GET single
router.get('/risk-management/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM public.hse_risk_management WHERE id=$1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /risk-management/:id error', err);
    res.status(500).json({ message: err.message });
  }
});

// POST create
router.post('/risk-management', protect, async (req, res) => {
  try {
    const reference = genRef();

    // Get all columns from the table
    const columnsResult = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'hse_risk_management'`
    );

    const allColumns = columnsResult.rows.map(r => r.column_name);

    // Build separate lists for columns, placeholder strings, and parameter values
    const cols = ['reference', 'title', 'description', 'property_id', 'property_name', 'category', 'priority', 'reported_by', 'assigned_to', 'scheduled_date', 'status', 'created_at', 'updated_at'];
    const params = [
      reference,
      req.body.title,
      req.body.description,
      req.body.property_id || null,
      req.body.property_name || null,
      req.body.category || null,
      req.body.priority || 'Medium',
      req.body.reported_by || null,
      req.body.assigned_to || null,
      req.body.scheduled_date || null,
      req.body.status || 'Open'
    ];

    // Identify custom columns (columns in DB but not in our explicit standard list above)
    // Note: The 'cols' array above includes standard fields. We check against allColumns to find extras.
    const standardCols = new Set(cols);
    // Also include id, created_by, updated_by as standard ignored ones for custom check
    standardCols.add('id');
    standardCols.add('created_by');
    standardCols.add('updated_by');

    const customColumns = allColumns.filter(c => !standardCols.has(c));

    // Handle custom columns
    customColumns.forEach(col => {
      if (req.body[col] !== undefined) {
        cols.push(col);
        params.push(req.body[col]);
      }
    });

    // Build placeholders
    // We have 'params' array. 'created_at' and 'updated_at' are in 'cols' but NOT in 'params' because they use NOW().
    // Wait, I put created_at/updated_at in 'cols'. I need to match them.

    const valuesPart = [];
    let paramIdx = 1;

    cols.forEach(col => {
      if (col === 'created_at' || col === 'updated_at') {
        valuesPart.push('NOW()');
      } else {
        valuesPart.push(`$${paramIdx++}`);
      }
    });

    // Re-verify params matches logic:
    // cols has 13 items initially. Params has 11 methods.
    // 11 items get $N. 2 items (created_at, updated_at) get NOW().
    // Custom columns added to cols AND params -> behave like normal params.
    // This logic works.

    const query = `INSERT INTO public.hse_risk_management (${cols.join(', ')}) VALUES (${valuesPart.join(', ')}) RETURNING *`;

    const result = await pool.query(query, params);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /risk-management error', err);
    res.status(500).json({ message: err.message });
  }
});

// PATCH
router.patch('/risk-management/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;

    // Get all columns from the table
    const columnsResult = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'hse_risk_management'`
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
    const standardFields = ['title', 'description', 'property_id', 'property_name', 'category', 'priority', 'reported_by', 'assigned_to', 'scheduled_date', 'status'];
    standardFields.forEach(field => {
      if (req.body[field] !== undefined) {
        setClauses.push(`${field}=$${paramIndex}`);
        values.push(req.body[field]);
        paramIndex++;
      }
    });

    // Custom columns
    updatableColumns.forEach(col => {
      if (!standardFields.includes(col) && req.body[col] !== undefined) {
        setClauses.push(`${col}=$${paramIndex}`);
        values.push(req.body[col]);
        paramIndex++;
      }
    });

    // Always update updated_at
    setClauses.push('updated_at=NOW()');

    // Add id as the last parameter
    values.push(id);

    const query = `UPDATE public.hse_risk_management SET ${setClauses.join(', ')} WHERE id=$${paramIndex} RETURNING *`;

    const result = await pool.query(query, values);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /risk-management/:id error', err);
    res.status(500).json({ message: err.message });
  }
});

// DELETE
router.delete('/risk-management/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM public.hse_risk_management WHERE id=$1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted', record: result.rows[0] });
  } catch (err) {
    console.error('DELETE /risk-management/:id error', err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
