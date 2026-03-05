// Backend route: CRUD for litigation tasks
import express from 'express';
import pool from '../config/db.js';
import { protect as authProtect } from '../middleware/auth.js';
import { applyCrudLogging } from "../middleware/activityMiddleware.js"; // Enhanced logging

const router = express.Router();

// Apply CRUD logging to all operations
applyCrudLogging(router, 'litigation', 'litigation');
const protect = typeof authProtect === 'function' ? authProtect : (req, res, next) => next();

function toText(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function genRef() {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(16).substr(2, 8);
  return `LIT-${year}-${rand}`;
}

// List
router.get('/', protect, async (req, res) => {
  try {
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit, 10) || 100));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const params = [];
    const where = [];

    // Role-Based Restriction logic (Litigation)
    const currentUser = req.user;
    if (currentUser && currentUser.role !== 'admin') {
      let restrictedIds = [];
      if (currentUser.role === 'manager') {
        const managedRes = await pool.query("SELECT id FROM hotels WHERE manager_id = $1", [currentUser.id]);
        const managedIds = managedRes.rows.map(r => r.id);
        let branchIds = [];
        if (currentUser.branch) {
          const branchRes = await pool.query("SELECT id FROM hotels WHERE branch = $1", [currentUser.branch]);
          branchIds = branchRes.rows.map(r => r.id);
        }
        restrictedIds = [...new Set([...managedIds, ...branchIds])];
      } else if (currentUser.role === 'staff') {
        const assignedHotelId = currentUser.hotel_id || currentUser.hotelId || currentUser.hotel || null;
        restrictedIds = assignedHotelId ? [assignedHotelId] : [];
      }

      if (restrictedIds.length === 0) {
        return res.json([]);
      }

      params.push(restrictedIds);
      where.push(`property_id = ANY($${params.length})`);
    }

    params.push(limit);
    params.push(offset);

    let sql = `SELECT * FROM public.litigation_tasks`;
    if (where.length > 0) {
      sql += ` WHERE ${where.join(' AND ')}`;
    }
    sql += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const r = await pool.query(sql, params);
    return res.json(r.rows || []);
  } catch (err) {
    console.error('GET /api/litigation error:', err && (err.stack || err));
    return res.status(500).json({ message: 'Server error', detail: err?.message });
  }
});

// Get single
router.get('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(`SELECT * FROM public.litigation_tasks WHERE id = $1 LIMIT 1`, [id]);
    if (!r.rows[0]) return res.status(404).json({ message: 'Litigation task not found' });

    const currentUser = req.user;
    if (currentUser && currentUser.role !== 'admin') {
      let restrictedIds = [];
      if (currentUser.role === 'manager') {
        const managedRes = await pool.query("SELECT id FROM hotels WHERE manager_id = $1", [currentUser.id]);
        const managedIds = managedRes.rows.map(r => r.id);
        let branchIds = [];
        if (currentUser.branch) {
          const branchRes = await pool.query("SELECT id FROM hotels WHERE branch = $1", [currentUser.branch]);
          branchIds = branchRes.rows.map(r => r.id);
        }
        restrictedIds = [...new Set([...managedIds, ...branchIds])];
      } else if (currentUser.role === 'staff') {
        const assignedHotelId = currentUser.hotel_id || currentUser.hotelId || currentUser.hotel || null;
        restrictedIds = assignedHotelId ? [assignedHotelId] : [];
      }

      if (restrictedIds.length === 0) {
        return res.status(404).json({ message: 'Litigation task not found' });
      }
      const pid = r.rows[0]?.property_id ?? null;
      if (!pid || !restrictedIds.some((x) => String(x) === String(pid))) {
        return res.status(404).json({ message: 'Litigation task not found' });
      }
    }

    return res.json(r.rows[0]);
  } catch (err) {
    console.error(`GET /api/litigation/${req.params.id} error:`, err && (err.stack || err));
    return res.status(500).json({ message: 'Server error', detail: err?.message });
  }
});

// Create
router.post('/', protect, async (req, res) => {
  try {
    const {
      title,
      description = null,
      priority = 'medium',
      status = 'open',
      assigned_to_id = null,
      assigned_to_name = null,
      service_user_id = null,
      property_id = null,
      property_name = null,
      scheduled_date = null,
      reported_by = null,
      category = null,
      notes = null,
    } = req.body || {};

    const missing = [];
    if (!title || String(title).trim() === '') missing.push('title');
    if (!description || String(description).trim() === '') missing.push('description');
    if (!priority || String(priority).trim() === '') missing.push('priority');
    if (!status || String(status).trim() === '') missing.push('status');
    if (!assigned_to_name || String(assigned_to_name).trim() === '') missing.push('assigned_to_name');
    if (!property_id || String(property_id).trim() === '') missing.push('property_id');
    if (!property_name || String(property_name).trim() === '') missing.push('property_name');
    if (!scheduled_date || String(scheduled_date).trim() === '') missing.push('scheduled_date');
    if (!reported_by || String(reported_by).trim() === '') missing.push('reported_by');
    if (!category || String(category).trim() === '') missing.push('category');

    const currentUser = req.user;
    if (currentUser && currentUser.role !== 'admin') {
      let restrictedIds = [];
      if (currentUser.role === 'manager') {
        const managedRes = await pool.query("SELECT id FROM hotels WHERE manager_id = $1", [currentUser.id]);
        const managedIds = managedRes.rows.map(r => r.id);
        let branchIds = [];
        if (currentUser.branch) {
          const branchRes = await pool.query("SELECT id FROM hotels WHERE branch = $1", [currentUser.branch]);
          branchIds = branchRes.rows.map(r => r.id);
        }
        restrictedIds = [...new Set([...managedIds, ...branchIds])];
      } else if (currentUser.role === 'staff') {
        const assignedHotelId = currentUser.hotel_id || currentUser.hotelId || currentUser.hotel || null;
        restrictedIds = assignedHotelId ? [assignedHotelId] : [];
        if (assignedHotelId && String(property_id) !== String(assignedHotelId)) {
          return res.status(403).json({ message: 'Forbidden' });
        }
      }
      if (restrictedIds.length === 0) return res.status(403).json({ message: 'Forbidden' });
      if (!restrictedIds.some((x) => String(x) === String(property_id))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
    }

    const reference = genRef();

    // Get existing columns in litigation_tasks table
    const { rows: colRows } = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'litigation_tasks' AND table_schema = 'public'
    `);
    const existingCols = colRows.map(r => r.column_name);

    // Require all custom columns (all columns not in standard set)
    const standardColsRequired = new Set([
      'id', 'reference', 'title', 'description', 'priority', 'status',
      'assigned_to_id', 'assigned_to_name', 'service_user_id', 'property_id',
      'property_name', 'scheduled_date', 'reported_by', 'category', 'notes',
      'created_at', 'updated_at'
    ]);
    for (const col of existingCols) {
      if (standardColsRequired.has(col)) continue;
      const v = req.body?.[col];
      const camel = String(col).replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      const v2 = v === undefined ? req.body?.[camel] : v;
      if (v2 === undefined || v2 === null || String(v2).trim() === '') {
        missing.push(col);
      }
    }

    if (missing.length) {
      return res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` });
    }

    // Build dynamic INSERT
    const columnsToInsert = ['reference', 'title'];
    const valuesToInsert = [reference, title];

    // Standard optional fields
    const standardFields = {
      description: toText(description),
      priority,
      status,
      assigned_to_id,
      assigned_to_name: toText(assigned_to_name),
      service_user_id,
      property_id,
      property_name: toText(property_name),
      scheduled_date,
      reported_by: toText(reported_by),
      category: toText(category),
      notes: toText(notes),
      created_at: null,
      updated_at: null
    };

    for (const [key, value] of Object.entries(standardFields)) {
      if (existingCols.includes(key)) {
        columnsToInsert.push(key);
        if (key === 'created_at' || key === 'updated_at') {
          valuesToInsert.push(null); // Will use now() in query
        } else {
          valuesToInsert.push(value);
        }
      }
    }

    // Handle custom columns from Forms Builder
    const standardCols = ['id', 'reference', 'title', 'description', 'priority', 'status',
      'assigned_to_id', 'assigned_to_name', 'service_user_id', 'property_id',
      'property_name', 'scheduled_date', 'reported_by', 'category', 'notes',
      'created_at', 'updated_at'];
    for (const col of existingCols) {
      if (!standardCols.includes(col) && req.body[col] !== undefined) {
        columnsToInsert.push(col);
        valuesToInsert.push(req.body[col]);
      }
    }

    // Correctly build placeholders and values
    const finalValues = [];
    const placeholders = [];
    let paramIdx = 1;

    for (let i = 0; i < columnsToInsert.length; i++) {
      const col = columnsToInsert[i];
      if (col === 'created_at' || col === 'updated_at') {
        placeholders.push('now()');
      } else {
        placeholders.push(`$${paramIdx++}`);
        finalValues.push(valuesToInsert[i]);
      }
    }

    const q = `INSERT INTO public.litigation_tasks (${columnsToInsert.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    const r = await pool.query(q, finalValues);
    return res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error('POST /api/litigation error:', err && (err.stack || err));
    return res.status(500).json({ message: 'Server error', detail: err?.message });
  }
});

// Patch
router.patch('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await pool.query(`SELECT property_id FROM public.litigation_tasks WHERE id = $1 LIMIT 1`, [id]);
    const existingPid = existing.rows?.[0]?.property_id;
    if (!existing.rows?.length) return res.status(404).json({ message: 'Litigation task not found' });

    const currentUser = req.user;
    if (currentUser && currentUser.role !== 'admin') {
      let restrictedIds = [];
      if (currentUser.role === 'manager') {
        const managedRes = await pool.query("SELECT id FROM hotels WHERE manager_id = $1", [currentUser.id]);
        const managedIds = managedRes.rows.map(r => r.id);
        let branchIds = [];
        if (currentUser.branch) {
          const branchRes = await pool.query("SELECT id FROM hotels WHERE branch = $1", [currentUser.branch]);
          branchIds = branchRes.rows.map(r => r.id);
        }
        restrictedIds = [...new Set([...managedIds, ...branchIds])];
      } else if (currentUser.role === 'staff') {
        const assignedHotelId = currentUser.hotel_id || currentUser.hotelId || currentUser.hotel || null;
        restrictedIds = assignedHotelId ? [assignedHotelId] : [];
        if (assignedHotelId) {
          req.body.property_id = assignedHotelId;
        }
      }

      if (restrictedIds.length === 0) return res.status(404).json({ message: 'Litigation task not found' });
      if (!existingPid || !restrictedIds.some((x) => String(x) === String(existingPid))) {
        return res.status(404).json({ message: 'Litigation task not found' });
      }
      if (req.body?.property_id !== undefined && !restrictedIds.some((x) => String(x) === String(req.body.property_id))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
    }
    const {
      title,
      description,
      priority,
      status,
      assigned_to_id,
      assigned_to_name,
      service_user_id,
      property_id,
      property_name,
      scheduled_date,
      reported_by,
      category,
      notes,
    } = req.body || {};

    // Get existing columns
    const { rows: colRows } = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'litigation_tasks' AND table_schema = 'public'
    `);
    const existingCols = colRows.map(r => r.column_name);

    const fields = [];
    const params = [];
    let idx = 1;

    if (title !== undefined) { fields.push(`title = $${idx++}`); params.push(title); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); params.push(toText(description)); }
    if (priority !== undefined) { fields.push(`priority = $${idx++}`); params.push(priority); }
    if (status !== undefined) { fields.push(`status = $${idx++}`); params.push(status); }
    if (assigned_to_id !== undefined) { fields.push(`assigned_to_id = $${idx++}`); params.push(assigned_to_id); }
    if (assigned_to_name !== undefined) { fields.push(`assigned_to_name = $${idx++}`); params.push(toText(assigned_to_name)); }
    if (service_user_id !== undefined) { fields.push(`service_user_id = $${idx++}`); params.push(service_user_id); }
    if (property_id !== undefined) { fields.push(`property_id = $${idx++}`); params.push(property_id); }
    if (property_name !== undefined) { fields.push(`property_name = $${idx++}`); params.push(toText(property_name)); }
    if (scheduled_date !== undefined) { fields.push(`scheduled_date = $${idx++}`); params.push(scheduled_date); }
    if (reported_by !== undefined) { fields.push(`reported_by = $${idx++}`); params.push(toText(reported_by)); }
    if (category !== undefined) { fields.push(`category = $${idx++}`); params.push(category); }
    if (notes !== undefined) { fields.push(`notes = $${idx++}`); params.push(toText(notes)); }

    // Handle custom columns from Forms Builder
    const standardCols = ['id', 'reference', 'title', 'description', 'priority', 'status',
      'assigned_to_id', 'assigned_to_name', 'service_user_id', 'property_id',
      'property_name', 'scheduled_date', 'reported_by', 'category', 'notes',
      'created_at', 'updated_at'];
    for (const col of existingCols) {
      if (!standardCols.includes(col) && req.body[col] !== undefined) {
        fields.push(`${col} = $${idx++}`);
        params.push(req.body[col]);
      }
    }

    if (fields.length === 0) return res.status(400).json({ message: 'No fields to update' });

    params.push(id);
    const sql = `UPDATE public.litigation_tasks SET ${fields.join(', ')}, updated_at = now() WHERE id = $${idx} RETURNING *`;
    const r = await pool.query(sql, params);
    if (!r.rows[0]) return res.status(404).json({ message: 'Litigation task not found' });
    return res.json(r.rows[0]);
  } catch (err) {
    console.error(`PATCH /api/litigation/${req.params.id} error:`, err && (err.stack || err));
    return res.status(500).json({ message: 'Server error', detail: err?.message });
  }
});

// Delete
router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await pool.query(`SELECT property_id FROM public.litigation_tasks WHERE id = $1 LIMIT 1`, [id]);
    if (!existing.rows?.length) return res.status(404).json({ message: 'Litigation task not found' });

    const currentUser = req.user;
    if (currentUser && currentUser.role !== 'admin') {
      let restrictedIds = [];
      if (currentUser.role === 'manager') {
        const managedRes = await pool.query("SELECT id FROM hotels WHERE manager_id = $1", [currentUser.id]);
        const managedIds = managedRes.rows.map(r => r.id);
        let branchIds = [];
        if (currentUser.branch) {
          const branchRes = await pool.query("SELECT id FROM hotels WHERE branch = $1", [currentUser.branch]);
          branchIds = branchRes.rows.map(r => r.id);
        }
        restrictedIds = [...new Set([...managedIds, ...branchIds])];
      } else if (currentUser.role === 'staff') {
        const assignedHotelId = currentUser.hotel_id || currentUser.hotelId || currentUser.hotel || null;
        restrictedIds = assignedHotelId ? [assignedHotelId] : [];
      }

      if (restrictedIds.length === 0) return res.status(404).json({ message: 'Litigation task not found' });
      const existingPid = existing.rows[0]?.property_id;
      if (!existingPid || !restrictedIds.some((x) => String(x) === String(existingPid))) {
        return res.status(404).json({ message: 'Litigation task not found' });
      }
    }
    const r = await pool.query(`DELETE FROM public.litigation_tasks WHERE id = $1`, [id]);
    if (r.rowCount === 0) return res.status(404).json({ message: 'Litigation task not found' });
    return res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(`DELETE /api/litigation/${req.params.id} error:`, err && (err.stack || err));
    return res.status(500).json({ message: 'Server error', detail: err?.message });
  }
});

export default router;
