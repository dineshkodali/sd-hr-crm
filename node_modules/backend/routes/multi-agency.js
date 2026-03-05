import express from 'express';
import { protect } from '../middleware/auth.js';
import { applyCrudLogging } from "../middleware/activityMiddleware.js"; // Enhanced logging
import pool from '../config/db.js';

const router = express.Router();


// Apply CRUD logging to all operations
applyCrudLogging(router, 'multi_agency', 'multi_agency');

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
    if (!user.branch) return { ids: [], namesLower: [] };
    query = 'SELECT id, name FROM public.hotels WHERE branch = $1';
    params = [user.branch];
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

function propertyMatchesAllowed(record, allowed) {
  if (allowed?.ids === null) return true;
  const idOk = record?.property_id != null && allowed.ids.includes(record.property_id);
  const nameLower = String(record?.property_name || '').trim().toLowerCase();
  const nameOk = !!nameLower && allowed.namesLower.includes(nameLower);
  return idOk || nameOk;
}

function genRef() {
  const year = new Date().getFullYear();
  const random = Math.random().toString(16).slice(2, 10);
  return `MA-${year}-${random}`;
}

// GET all
router.get('/multi-agency', protect, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 500;

    const allowed = await getAllowedHotels(req.user);
    if (allowed.ids !== null && allowed.ids.length === 0 && allowed.namesLower.length === 0) {
      return res.json([]);
    }

    const values = [];
    let text = 'SELECT * FROM public.multi_agency';
    if (allowed.ids !== null) {
      text += ' WHERE (property_id = ANY($1::int[]) OR LOWER(property_name) = ANY($2::text[]))';
      values.push(allowed.ids);
      values.push(allowed.namesLower);
    }
    values.push(limit);
    text += ` ORDER BY created_at DESC LIMIT $${values.length}`;

    const result = await pool.query(text, values);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /multi-agency error:', err);
    res.status(500).json({ message: err.message });
  }
});

// GET by id
router.get('/multi-agency/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM public.multi_agency WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Record not found' });

    const allowed = await getAllowedHotels(req.user);
    if (!propertyMatchesAllowed(result.rows[0], allowed)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /multi-agency/:id error:', err);
    res.status(500).json({ message: err.message });
  }
});

// POST create
router.post('/multi-agency', protect, async (req, res) => {
  try {
    const reference = genRef();

    const allowed = await getAllowedHotels(req.user);
    const propertyId = req.body.property_id != null ? parseInt(req.body.property_id, 10) : null;
    const propertyNameLower = String(req.body.property_name || '').trim().toLowerCase();
    if (allowed.ids !== null) {
      const ok =
        (propertyId !== null && Number.isFinite(propertyId) && allowed.ids.includes(propertyId)) ||
        (propertyNameLower && allowed.namesLower.includes(propertyNameLower));
      if (!ok) {
        return res.status(403).json({ message: 'Cannot create record for a property outside your access' });
      }
    }
    
    // Get all columns from the table
    const columnsResult = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'multi_agency'`
    );
    
    const allColumns = columnsResult.rows.map(r => r.column_name);
    
    // Standard columns (excluding id, timestamps, and auto-generated fields)
    const standardColumns = [
      'id', 'reference', 'created_at', 'updated_at', 'created_by', 'updated_by',
      'title', 'description', 'property_id', 'property_name', 'category',
      'priority', 'assigned_to', 'reported_by', 'scheduled_date', 'status'
    ];
    
    // Find custom columns
    const customColumns = allColumns.filter(col => !standardColumns.includes(col));
    
    // Build column list and values for standard fields
    const columns = ['reference', 'title', 'description', 'property_id', 'property_name', 'category', 'priority', 'assigned_to', 'reported_by', 'scheduled_date', 'status', 'created_at', 'updated_at'];
    const values = [
      reference,
      req.body.title,
      req.body.description,
      req.body.property_id || null,
      req.body.property_name || '',
      req.body.category,
      req.body.priority || 'Medium',
      req.body.assigned_to || '',
      req.body.reported_by || '',
      req.body.scheduled_date || null,
      req.body.status || 'New',
      'NOW()', // String literal for NOW()
      'NOW()'  // String literal for NOW()
    ];
    
    // Add custom columns if they exist in the request
    customColumns.forEach(col => {
      if (req.body[col] !== undefined) {
        // Insert custom column before timestamps
        columns.splice(columns.length - 2, 0, col);
        // Insert custom value before timestamps
        values.splice(values.length - 2, 0, req.body[col]);
      }
    });
    
    // Determine cutoff for actual parameters vs raw SQL strings
    const timestampStartIndex = values.length - 2;

    // Build parameterized query placeholders
    const placeholders = values.map((val, i) => {
      if (i >= timestampStartIndex) return val; // Returns 'NOW()'
      return `$${i + 1}`; // Returns $1, $2, etc.
    });
    
    // Prepare values array for the query execution (exclude 'NOW()' strings)
    const paramValues = values.slice(0, timestampStartIndex);

    const query = `INSERT INTO public.multi_agency (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    
    const result = await pool.query(query, paramValues);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /multi-agency error:', err);
    res.status(500).json({ message: err.message });
  }
});

// PATCH update
router.patch('/multi-agency/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;

    const allowed = await getAllowedHotels(req.user);
    if (allowed.ids !== null) {
      const check = await pool.query('SELECT property_id, property_name FROM public.multi_agency WHERE id=$1', [id]);
      if (!check.rows.length) return res.status(404).json({ message: 'Record not found' });
      if (!propertyMatchesAllowed(check.rows[0], allowed)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const nextPropertyId = req.body.property_id != null ? parseInt(req.body.property_id, 10) : null;
      const nextNameLower = String(req.body.property_name || '').trim().toLowerCase();
      if (nextPropertyId !== null || nextNameLower) {
        const nextOk =
          (nextPropertyId !== null && Number.isFinite(nextPropertyId) && allowed.ids.includes(nextPropertyId)) ||
          (nextNameLower && allowed.namesLower.includes(nextNameLower));
        if (!nextOk) {
          return res.status(403).json({ message: 'Cannot move record to a property outside your access' });
        }
      }
    }
    
    // Get all columns from the table
    const columnsResult = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'multi_agency'`
    );
    
    const allColumns = columnsResult.rows.map(r => r.column_name);
    
    // Standard columns not directly updatable via loop
    const standardColumns = [
      'id', 'reference', 'created_at', 'updated_at', 'created_by', 'updated_by'
    ];
    
    // Find updatable columns (standard + custom)
    const updatableColumns = allColumns.filter(col => !standardColumns.includes(col));
    
    // Build SET clause dynamically
    const setClauses = [];
    const values = [];
    let paramIndex = 1;
    
    // Standard fields whitelist
    const standardFields = ['title', 'description', 'property_id', 'property_name', 'category', 'priority', 'assigned_to', 'reported_by', 'scheduled_date', 'status'];
    
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
    
    // Always update updated_at
    setClauses.push('updated_at=NOW()');
    
    // Add id as the last parameter
    values.push(id);
    
    const query = `UPDATE public.multi_agency SET ${setClauses.join(', ')} WHERE id=$${paramIndex} RETURNING *`;
    
    const result = await pool.query(query, values);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Record not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /multi-agency/:id error:', err);
    res.status(500).json({ message: err.message });
  }
});

// DELETE
router.delete('/multi-agency/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;

    const allowed = await getAllowedHotels(req.user);
    if (allowed.ids !== null) {
      const check = await pool.query('SELECT property_id, property_name FROM public.multi_agency WHERE id=$1', [id]);
      if (!check.rows.length) return res.status(404).json({ message: 'Record not found' });
      if (!propertyMatchesAllowed(check.rows[0], allowed)) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const result = await pool.query('DELETE FROM public.multi_agency WHERE id=$1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: 'Record deleted', record: result.rows[0] });
  } catch (err) {
    console.error('DELETE /multi-agency/:id error:', err);
    res.status(500).json({ message: err.message });
  }
});

export default router;