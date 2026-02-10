import express from 'express';
import { protect } from '../middleware/auth.js';
import pool from '../config/db.js';

const router = express.Router();

function genRef() {
  const year = new Date().getFullYear();
  const random = Math.random().toString(16).slice(2, 10);
  return `HSRM-${year}-${random}`;
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
    const assignedHotelId = user.hotel_id || user.hotelId || user.hotel || null;
    if (!assignedHotelId) return [];
    query = 'SELECT id FROM public.hotels WHERE id = $1';
    params = [assignedHotelId];
  } else {
    return [];
  }

  const result = await pool.query(query, params);
  return result.rows.map(r => r.id);
}

// GET list
router.get('/risk-management', protect, async (req, res) => {
  try {
    const limit = req.query.limit || 500;

    const allowedIds = await getAllowedPropertyIds(req.user);
    const allowedIdsText = allowedIds === null ? null : (allowedIds || []).map((x) => String(x));
    const values = [];
    let text = 'SELECT * FROM public.hse_risk_management';

    if (allowedIdsText !== null) {
      if (allowedIdsText.length === 0) return res.json([]);
      text += ' WHERE property_id::text = ANY($1::text[])';
      values.push(allowedIdsText);
    }

    values.push(limit);
    text += ` ORDER BY created_at DESC LIMIT $${values.length}`;

    const result = await pool.query(text, values);
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

    const allowedIds = await getAllowedPropertyIds(req.user);
    const record = result.rows[0];
    const allowedIdsText = allowedIds === null ? null : (allowedIds || []).map((x) => String(x));
    if (allowedIdsText !== null && !allowedIdsText.includes(String(record.property_id))) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(record);
  } catch (err) {
    console.error('GET /risk-management/:id error', err);
    res.status(500).json({ message: err.message });
  }
});

// POST create
router.post('/risk-management', protect, async (req, res) => {
  try {
    const reference = genRef();

    const allowedIds = await getAllowedPropertyIds(req.user);
    const allowedIdsText = allowedIds === null ? null : (allowedIds || []).map((x) => String(x));
    let propertyId = req.body.property_id != null ? parseInt(req.body.property_id, 10) : null;
    if (req.user?.role === 'staff') {
      const assignedHotelId = req.user.hotel_id || req.user.hotelId || req.user.hotel || null;
      if (assignedHotelId) {
        propertyId = parseInt(assignedHotelId, 10);
        req.body.property_id = propertyId;
      }
    }
    if (allowedIdsText !== null) {
      if (!propertyId || !allowedIdsText.includes(String(propertyId))) {
        return res.status(403).json({ message: 'Cannot create risk record for a property outside your access' });
      }
    }

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

    if (req.user?.role === 'staff') {
      const assignedHotelId = req.user.hotel_id || req.user.hotelId || req.user.hotel || null;
      if (assignedHotelId) {
        req.body.property_id = parseInt(assignedHotelId, 10);
      }
    }

    const allowedIds = await getAllowedPropertyIds(req.user);
    const allowedIdsText = allowedIds === null ? null : (allowedIds || []).map((x) => String(x));
    if (allowedIdsText !== null) {
      const checkRes = await pool.query('SELECT property_id FROM public.hse_risk_management WHERE id=$1', [id]);
      if (checkRes.rows.length === 0) return res.status(404).json({ message: 'Not found' });
      const existingPropertyId = checkRes.rows[0].property_id;
      if (!allowedIdsText.includes(String(existingPropertyId))) {
        return res.status(403).json({ message: 'Access denied' });
      }

      if (req.body.property_id !== undefined && req.body.property_id !== null) {
        const nextPropertyId = parseInt(req.body.property_id, 10);
        if (!allowedIdsText.includes(String(nextPropertyId))) {
          return res.status(403).json({ message: 'Cannot move risk record to a property outside your access' });
        }
      }
    }

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

    const allowedIds = await getAllowedPropertyIds(req.user);
    const allowedIdsText = allowedIds === null ? null : (allowedIds || []).map((x) => String(x));
    if (allowedIdsText !== null) {
      const checkRes = await pool.query('SELECT property_id FROM public.hse_risk_management WHERE id=$1', [id]);
      if (checkRes.rows.length === 0) return res.status(404).json({ message: 'Not found' });
      if (!allowedIdsText.includes(String(checkRes.rows[0].property_id))) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const result = await pool.query('DELETE FROM public.hse_risk_management WHERE id=$1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted', record: result.rows[0] });
  } catch (err) {
    console.error('DELETE /risk-management/:id error', err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
