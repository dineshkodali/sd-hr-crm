import express from 'express';
import { protect } from '../middleware/auth.js';
import { buildRoleWhere } from '../middleware/roleFilter.js';
import pool from '../config/db.js';

const router = express.Router();

function genRef() {
  const year = new Date().getFullYear();
  const random = Math.random().toString(16).slice(2, 10);
  return `HSEA-${year}-${random}`;
}

async function getAllowedPropertyIds(user) {
  if (!user) return [];
  if (user.role === 'admin') return null;

  let query = '';
  let params = [];

  if (user.role === 'manager') {
    query = 'SELECT id FROM public.hotels WHERE manager_id = $1';
    params = [user.id];
    if (user.branch) {
      query += ' OR branch = $2';
      params.push(user.branch);
    }
  } else if (user.role === 'staff') {
    if (!user.branch) return [];
    query = 'SELECT id FROM public.hotels WHERE branch = $1';
    params = [user.branch];
  } else {
    return [];
  }

  const result = await pool.query(query, params);
  return result.rows.map(r => r.id);
}

// GET list
router.get('/audits', protect, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 500;
    const allowedIds = await getAllowedPropertyIds(req.user);
    const { clause, params } = buildRoleWhere(req, 1);
    let text = 'SELECT * FROM public.hse_audits';
    const values = [];

    const where = [];
    if (allowedIds !== null) {
      if (allowedIds.length === 0) return res.json([]);
      where.push(`property_id = ANY($${values.length + 1}::int[])`);
      values.push(allowedIds);
    }

    if (clause) {
      where.push(`(${clause})`);
      values.push(...params);
    }

    if (where.length) {
      text += ' WHERE ' + where.join(' AND ');
    }

    values.push(limit);
    text += ` ORDER BY created_at DESC LIMIT $${values.length}`;

    const result = await pool.query(text, values);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /audits error', err);
    res.status(500).json({ message: err.message });
  }
});

// GET single
router.get('/audits/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM public.hse_audits WHERE id=$1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });

    const allowedIds = await getAllowedPropertyIds(req.user);
    const record = result.rows[0];
    if (allowedIds !== null && !allowedIds.includes(record.property_id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(record);
  } catch (err) {
    console.error('GET /audits/:id error', err);
    res.status(500).json({ message: err.message });
  }
});

// POST create
router.post('/audits', protect, async (req, res) => {
  try {
    const reference = genRef();

    const allowedIds = await getAllowedPropertyIds(req.user);
    const propertyId = req.body.property_id != null ? parseInt(req.body.property_id, 10) : null;
    if (allowedIds !== null) {
      if (!propertyId || !allowedIds.includes(propertyId)) {
        return res.status(403).json({ message: 'Cannot create audit for a property outside your access' });
      }
    }

    // Get all columns from the table to check for custom fields
    const columnsResult = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'hse_audits'`
    );

    const allColumns = columnsResult.rows.map(r => r.column_name);

    // Standard columns (excluding id, timestamps, and auto-generated fields)
    const standardColumns = [
      'id', 'reference', 'created_at', 'updated_at', 'created_by', 'updated_by',
      'title', 'description', 'property_id', 'property_name', 'category',
      'priority', 'reported_by', 'assigned_to', 'scheduled_date', 'status'
    ];

    // Identify custom columns defined in the DB but not in standard list
    const customColumns = allColumns.filter(col => !standardColumns.includes(col));

    // 1. Prepare base columns and values
    const columns = [
      'reference', 'title', 'description', 'property_id', 'property_name',
      'category', 'priority', 'reported_by', 'assigned_to',
      'scheduled_date', 'status', 'created_at', 'updated_at'
    ];

    const values = [
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
      req.body.status || 'Open',
      'NOW()', // Special placeholder string
      'NOW()'  // Special placeholder string
    ];

    // 2. Insert custom columns into the arrays (before the timestamps)
    // We insert them at index (length - 2) to keep NOW(), NOW() at the very end
    customColumns.forEach(col => {
      if (req.body[col] !== undefined) {
        // Insert column name
        columns.splice(columns.length - 2, 0, col);
        // Insert value
        values.splice(values.length - 2, 0, req.body[col]);
      }
    });

    // 3. Separate raw SQL strings ('NOW()') from actual query parameters
    const timestampStartIndex = values.length - 2;

    // Generate placeholders: $1, $2 for data, and keep raw values for timestamps
    const placeholders = values.map((val, i) => {
      if (i >= timestampStartIndex) return val; // Returns 'NOW()'
      return `$${i + 1}`; // Returns $1, $2, etc.
    });

    // The actual params array passed to pool.query must NOT contain 'NOW()'
    const paramValues = values.slice(0, timestampStartIndex);

    const query = `INSERT INTO public.hse_audits (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;

    const result = await pool.query(query, paramValues);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /audits error', err);
    res.status(500).json({ message: err.message });
  }
});

// PATCH
router.patch('/audits/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;

    const allowedIds = await getAllowedPropertyIds(req.user);
    if (allowedIds !== null) {
      const checkRes = await pool.query('SELECT property_id FROM public.hse_audits WHERE id=$1', [id]);
      if (checkRes.rows.length === 0) return res.status(404).json({ message: 'Not found' });
      const existingPropertyId = checkRes.rows[0].property_id;
      if (!allowedIds.includes(existingPropertyId)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      if (req.body.property_id !== undefined && req.body.property_id !== null) {
        const nextPropertyId = parseInt(req.body.property_id, 10);
        if (!allowedIds.includes(nextPropertyId)) {
          return res.status(403).json({ message: 'Cannot move audit to a property outside your access' });
        }
      }
    }

    // Get all columns from the table
    const columnsResult = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'hse_audits'`
    );

    const allColumns = columnsResult.rows.map(r => r.column_name);

    // Standard columns that shouldn't be updated generically
    const standardColumns = [
      'id', 'reference', 'created_at', 'updated_at', 'created_by', 'updated_by'
    ];

    const updatableColumns = allColumns.filter(col => !standardColumns.includes(col));

    // Build SET clause dynamically
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    // Standard fields whitelist
    const standardFields = ['title', 'description', 'property_id', 'property_name', 'category', 'priority', 'reported_by', 'assigned_to', 'scheduled_date', 'status'];

    // Add standard fields
    standardFields.forEach(field => {
      if (req.body[field] !== undefined) {
        setClauses.push(`${field}=$${paramIndex}`);
        values.push(req.body[field]);
        paramIndex++;
      }
    });

    // Add custom columns
    updatableColumns.forEach(col => {
      if (!standardFields.includes(col) && req.body[col] !== undefined) {
        setClauses.push(`${col}=$${paramIndex}`);
        values.push(req.body[col]);
        paramIndex++;
      }
    });

    // Always update timestamp
    setClauses.push('updated_at=NOW()');

    // Add id as the last parameter
    values.push(id);

    const query = `UPDATE public.hse_audits SET ${setClauses.join(', ')} WHERE id=$${paramIndex} RETURNING *`;

    const result = await pool.query(query, values);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /audits/:id error', err);
    res.status(500).json({ message: err.message });
  }
});

// DELETE
router.delete('/audits/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;

    const allowedIds = await getAllowedPropertyIds(req.user);
    if (allowedIds !== null) {
      const checkRes = await pool.query('SELECT property_id FROM public.hse_audits WHERE id=$1', [id]);
      if (checkRes.rows.length === 0) return res.status(404).json({ message: 'Not found' });
      if (!allowedIds.includes(checkRes.rows[0].property_id)) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const result = await pool.query('DELETE FROM public.hse_audits WHERE id=$1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted', record: result.rows[0] });
  } catch (err) {
    console.error('DELETE /audits/:id error', err);
    res.status(500).json({ message: err.message });
  }
});

export default router;