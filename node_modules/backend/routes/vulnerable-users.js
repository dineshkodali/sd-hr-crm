import express from 'express';
import { protect } from '../middleware/auth.js';
import { applyCrudLogging } from "../middleware/activityMiddleware.js"; // Enhanced logging
import pool from '../config/db.js';
const router = express.Router();


// Apply CRUD logging to all operations
applyCrudLogging(router, 'vulnerable_users', 'vulnerable_users');

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
  return `VUS-${year}-${random}`;
}

// GET all vulnerable users records
router.get('/vulnerable-users', protect, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 50, 100));
    const offset = (page - 1) * limit;

    const allowed = await getAllowedHotels(req.user);
    if (allowed.ids !== null && allowed.ids.length === 0 && allowed.namesLower.length === 0) {
      return res.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0, hasMore: false } });
    }

    // Only select required columns
    const selectCols = [
      'id', 'reference', 'title', 'description', 'property_id', 'property_name',
      'category', 'priority', 'assigned_to', 'reported_by', 'scheduled_date', 'status', 'created_at', 'updated_at'
    ];

    let whereClause = '';
    const values = [];
    let idx = 1;
    if (allowed.ids !== null) {
      whereClause = ` WHERE (property_id = ANY($${idx++}::int[]) OR LOWER(property_name) = ANY($${idx++}::text[]))`;
      values.push(allowed.ids);
      values.push(allowed.namesLower);
    }

    // Get total count for pagination
    const countSql = `SELECT COUNT(*) FROM public.vulnerable_users${whereClause}`;
    const countResult = await pool.query(countSql, values);
    const total = countResult.rows && countResult.rows[0] ? parseInt(countResult.rows[0].count) : 0;

    // Get paginated data
    values.push(limit, offset);
    const dataSql = `SELECT ${selectCols.join(', ')} FROM public.vulnerable_users${whereClause} ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`;
    const result = await pool.query(dataSql, values);

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total
      }
    });
  } catch (err) {
    console.error('GET /vulnerable-users error:', err);
    res.status(500).json({ message: err.message });
  }
});

// GET single vulnerable users record by ID
router.get('/vulnerable-users/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM public.vulnerable_users WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Record not found' });
    }

    const allowed = await getAllowedHotels(req.user);
    if (!propertyMatchesAllowed(result.rows[0], allowed)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /vulnerable-users/:id error:', err);
    res.status(500).json({ message: err.message });
  }
});

// POST create new vulnerable users record
router.post('/vulnerable-users', protect, async (req, res) => {
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
       WHERE table_schema = 'public' AND table_name = 'vulnerable_users'`
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
      'NOW()',
      'NOW()'
    ];
    
    // Add custom columns if they exist in the request
    customColumns.forEach(col => {
      if (req.body[col] !== undefined) {
        // Insert custom column before created_at, updated_at
        columns.splice(columns.length - 2, 0, col);
        // Insert custom value before NOW(), NOW()
        values.splice(values.length - 2, 0, req.body[col]);
      }
    });
    
    // Determine cutoff for parameters (exclude last two "NOW()" strings)
    const timestampStartIndex = values.length - 2;

    // Build parameterized placeholders ($1, $2...) vs raw strings (NOW())
    const placeholders = values.map((val, i) => {
      if (i >= timestampStartIndex) return val; // Returns 'NOW()'
      return `$${i + 1}`; // Returns $1, $2 etc.
    });
    
    // The actual params passed to pool.query must NOT contain 'NOW()'
    const paramValues = values.slice(0, timestampStartIndex);
    
    const query = `INSERT INTO public.vulnerable_users (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;

    const result = await pool.query(query, paramValues);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /vulnerable-users error:', err);
    res.status(500).json({ message: err.message });
  }
});

// PATCH update vulnerable users record
router.patch('/vulnerable-users/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;

    const allowed = await getAllowedHotels(req.user);
    if (allowed.ids !== null) {
      const check = await pool.query('SELECT property_id, property_name FROM public.vulnerable_users WHERE id=$1', [id]);
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
       WHERE table_schema = 'public' AND table_name = 'vulnerable_users'`
    );
    
    const allColumns = columnsResult.rows.map(r => r.column_name);
    
    // Standard columns that are not directly updatable via generic loop
    const standardColumns = [
      'id', 'reference', 'created_at', 'updated_at', 'created_by', 'updated_by'
    ];
    
    // Find custom columns
    const customColumns = allColumns.filter(col => !standardColumns.includes(col));
    
    // Build SET clause dynamically
    const setClauses = [];
    const values = [];
    let paramIndex = 1;
    
    // Standard fields whitelist
    const standardFields = ['title', 'description', 'property_id', 'property_name', 'category', 'priority', 'assigned_to', 'reported_by', 'scheduled_date', 'status'];
    
    // Process Standard Fields
    standardFields.forEach(field => {
      if (req.body[field] !== undefined) {
        setClauses.push(`${field}=$${paramIndex}`);
        values.push(req.body[field]);
        paramIndex++;
      }
    });
    
    // Process Custom Columns
    customColumns.forEach(col => {
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
    
    const query = `UPDATE public.vulnerable_users SET ${setClauses.join(', ')} WHERE id=$${paramIndex} RETURNING *`;
    
    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Record not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /vulnerable-users/:id error:', err);
    res.status(500).json({ message: err.message });
  }
});

// DELETE vulnerable users record
router.delete('/vulnerable-users/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;

    const allowed = await getAllowedHotels(req.user);
    if (allowed.ids !== null) {
      const check = await pool.query('SELECT property_id, property_name FROM public.vulnerable_users WHERE id=$1', [id]);
      if (!check.rows.length) return res.status(404).json({ message: 'Record not found' });
      if (!propertyMatchesAllowed(check.rows[0], allowed)) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const result = await pool.query(
      'DELETE FROM public.vulnerable_users WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Record not found' });
    }
    res.json({ message: 'Record deleted', record: result.rows[0] });
  } catch (err) {
    console.error('DELETE /vulnerable-users/:id error:', err);
    res.status(500).json({ message: err.message });
  }
});

export default router;