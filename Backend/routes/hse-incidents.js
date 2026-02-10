import express from 'express';
import { protect } from '../middleware/auth.js';
import pool from '../config/db.js';

const router = express.Router();

// Helper to generate a unique reference
function genRef() {
  const year = new Date().getFullYear();
  const random = Math.random().toString(16).slice(2, 10);
  return `HSE-${year}-${random}`;
}

/**
 * Helper: Get allowed property IDs for the current user
 * Logic:
 * - Admin: returns null (no restriction)
 * - Manager: hotels where manager_id = user.id OR branch = user.branch
 * - Staff: hotels where branch = user.branch
 */
async function getAllowedPropertyIds(user) {
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
  }

  const result = await pool.query(query, params);
  return result.rows.map(r => r.id);
}

// --- ROUTES ---

// GET list with Role-Based Filtering
router.get('/hse-incidents', protect, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 500;
    const allowedIds = await getAllowedPropertyIds(req.user);
    const allowedIdsText = allowedIds === null ? null : (allowedIds || []).map((x) => String(x));

    let text = 'SELECT * FROM public.hse_incidents';
    const values = [];

    // Apply filtering if user is not admin
    if (allowedIdsText !== null) {
      if (allowedIdsText.length === 0) return res.json([]); // Security: Return empty if no properties assigned
      text += ' WHERE property_id::text = ANY($1::text[])';
      values.push(allowedIdsText);
    }

    const limitParamIndex = values.length + 1;
    text += ` ORDER BY created_at DESC LIMIT $${limitParamIndex}`;
    values.push(limit);

    const result = await pool.query(text, values);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /hse-incidents error', err);
    res.status(500).json({ message: 'Server error fetching incidents' });
  }
});

// GET single with Access Validation
router.get('/hse-incidents/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const allowedIds = await getAllowedPropertyIds(req.user);
    const allowedIdsText = allowedIds === null ? null : (allowedIds || []).map((x) => String(x));

    const result = await pool.query('SELECT * FROM public.hse_incidents WHERE id=$1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });

    const record = result.rows[0];

    // Security check: Verify if the record belongs to an allowed property
    if (allowedIdsText !== null && !allowedIdsText.includes(String(record.property_id))) {
      return res.status(403).json({ message: 'Access denied: You do not have permission to view this property' });
    }

    res.json(record);
  } catch (err) {
    console.error('GET /hse-incidents/:id error', err);
    res.status(500).json({ message: err.message });
  }
});

// POST create
router.post('/hse-incidents', protect, async (req, res) => {
  try {
    const { incident_type, severity, property_id, property_name, affected_person, reported_by, details, assigned_investigator, status, incident_date } = req.body;

    let resolvedPropertyId = property_id;
    if (req.user?.role === 'staff') {
      const assignedHotelId = req.user.hotel_id || req.user.hotelId || req.user.hotel || null;
      if (assignedHotelId) {
        resolvedPropertyId = assignedHotelId;
      }
    }

    // Security check: Prevent posting to a property the user doesn't manage
    const allowedIds = await getAllowedPropertyIds(req.user);
    const allowedIdsText = allowedIds === null ? null : (allowedIds || []).map((x) => String(x));
    if (allowedIdsText !== null && !allowedIdsText.includes(String(resolvedPropertyId))) {
      return res.status(403).json({ message: 'Cannot create incident for a property outside your branch/management' });
    }

    const reference = genRef();

    // Dynamically check columns to avoid crashes with Custom Forms
    const { rows: colRows } = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'hse_incidents' AND table_schema = 'public'
    `);
    const existingCols = colRows.map(r => r.column_name);

    const dataMap = {
      reference, incident_type, severity, property_id: resolvedPropertyId, property_name,
      affected_person, reported_by, details, assigned_investigator,
      status: status || 'Open',
      incident_date: incident_date || null,
      created_at: new Date(),
      updated_at: new Date()
    };

    const columns = [];
    const values = [];

    // Fill standard columns
    Object.keys(dataMap).forEach(key => {
      if (existingCols.includes(key)) {
        columns.push(key);
        values.push(dataMap[key]);
      }
    });

    // Fill custom columns from body
    for (const col of existingCols) {
      if (!Object.keys(dataMap).includes(col) && col !== 'id' && req.body[col] !== undefined) {
        columns.push(col);
        values.push(req.body[col]);
      }
    }

    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO public.hse_incidents (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;

    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /hse-incidents error', err);
    res.status(500).json({ message: err.message });
  }
});

// PATCH update
router.patch('/hse-incidents/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const allowedIds = await getAllowedPropertyIds(req.user);

    if (req.user?.role === 'staff') {
      const assignedHotelId = req.user.hotel_id || req.user.hotelId || req.user.hotel || null;
      if (assignedHotelId) {
        req.body.property_id = assignedHotelId;
      }
    }

    const allowedIdsText = allowedIds === null ? null : (allowedIds || []).map((x) => String(x));

    // 1. Check if user has access to the record they want to update
    const checkRes = await pool.query('SELECT property_id FROM public.hse_incidents WHERE id=$1', [id]);
    if (checkRes.rows.length === 0) return res.status(404).json({ message: 'Not found' });

    if (allowedIdsText !== null && !allowedIdsText.includes(String(checkRes.rows[0].property_id))) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // 2. Build dynamic update
    const { rows: colRows } = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'hse_incidents' AND table_schema = 'public'
    `);
    const existingCols = colRows.map(r => r.column_name);

    const setParts = [];
    const values = [];
    let idx = 1;

    // Fields allowed to be updated
    const updateable = [
      'incident_type', 'severity', 'property_id', 'property_name',
      'affected_person', 'reported_by', 'details', 'assigned_investigator',
      'status', 'incident_date'
    ];

    for (const col of existingCols) {
      if (col === 'id' || col === 'reference' || col === 'created_at') continue;

      let val = req.body[col];
      if (val !== undefined) {
        setParts.push(`${col} = $${idx++}`);
        values.push(val);
      }
    }

    if (existingCols.includes('updated_at')) {
      setParts.push(`updated_at = $${idx++}`);
      values.push(new Date());
    }

    if (setParts.length === 0) return res.status(400).json({ message: 'No fields provided' });

    values.push(id);
    const query = `UPDATE public.hse_incidents SET ${setParts.join(', ')} WHERE id = $${idx} RETURNING *`;
    const result = await pool.query(query, values);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /hse-incidents/:id error', err);
    res.status(500).json({ message: err.message });
  }
});

// DELETE
router.delete('/hse-incidents/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const allowedIds = await getAllowedPropertyIds(req.user);
    const allowedIdsText = allowedIds === null ? null : (allowedIds || []).map((x) => String(x));

    // Security Check
    const checkRes = await pool.query('SELECT property_id FROM public.hse_incidents WHERE id=$1', [id]);
    if (checkRes.rows.length === 0) return res.status(404).json({ message: 'Not found' });

    if (allowedIdsText !== null && !allowedIdsText.includes(String(checkRes.rows[0].property_id))) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const result = await pool.query('DELETE FROM public.hse_incidents WHERE id=$1 RETURNING *', [id]);
    res.json({ message: 'Deleted', record: result.rows[0] });
  } catch (err) {
    console.error('DELETE /hse-incidents/:id error', err);
    res.status(500).json({ message: err.message });
  }
});

export default router;