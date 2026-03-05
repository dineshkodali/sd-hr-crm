import express from 'express';
import pool from '../config/db.js';
import { protect } from '../middleware/auth.js';
import { applyCrudLogging } from "../middleware/activityMiddleware.js"; // Enhanced logging
import { buildRoleWhere } from '../middleware/roleFilter.js';

const router = express.Router();


// Apply CRUD logging to all operations
applyCrudLogging(router, 'safeguarding_referrals', 'safeguarding_referrals');
// Helper: Generate reference number (e.g., SFG-2025-xxxxx)
function genRef() {
  const year = new Date().getFullYear();
  const random = Math.random().toString(16).slice(2, 7).toUpperCase();
  return `SFG-${year}-${random}`;
}

// --- GET: List all referrals (with pagination) ---
router.get('/referrals', protect, async (req, res) => {
  try {
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

    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    let where = [];
    let values = [];
    let idx = 1;

    if (restrictedHotelIds !== null) {
      if (restrictedHotelIds.length === 0) {
        return res.json([]);
      }
      where.push(`property_id::text = ANY($${idx++}::text[])`);
      values.push(restrictedHotelIds.map((x) => String(x)));
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const query = `SELECT * FROM public.safeguarding_referrals ${whereClause} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);

    res.json(Array.isArray(result.rows) ? result.rows : []);
  } catch (err) {
    console.error('GET /safeguarding/referrals error:', err);
    res.status(500).json({ message: 'Failed to fetch referrals' });
  }
});

// --- GET: Single referral by ID ---
router.get('/referrals/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const query = 'SELECT * FROM public.safeguarding_referrals WHERE id = $1';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Referral not found' });
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
      if (restrictedHotelIds.length === 0) return res.status(404).json({ message: 'Referral not found' });
      const pid = result.rows[0]?.property_id ?? null;
      if (!pid || !restrictedHotelIds.some((x) => String(x) === String(pid))) {
        return res.status(404).json({ message: 'Referral not found' });
      }
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /safeguarding/referrals/:id error:', err);
    res.status(500).json({ message: 'Failed to fetch referral' });
  }
});

// --- POST: Create new referral ---
router.post('/referrals', protect, async (req, res) => {
  try {
    const reference = genRef();

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
        req.body.property_id = assignedHotelId;
      }
    }

    if (restrictedHotelIds !== null) {
      if (restrictedHotelIds.length === 0) return res.status(403).json({ message: 'Forbidden' });
      const requestedPid = req.body.property_id ?? null;
      if (!requestedPid || !restrictedHotelIds.some((x) => String(x) === String(requestedPid))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
    }

    // Get all columns from the table
    const columnsResult = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'safeguarding_referrals'`
    );

    const allColumns = columnsResult.rows.map(r => r.column_name);

    // Standard columns
    const standardColumns = [
      'id', 'reference', 'created_at', 'updated_at', 'created_by', 'updated_by',
      'title', 'description', 'property_id', 'property_name', 'category',
      'priority', 'assigned_to', 'reported_by', 'scheduled_date', 'status'
    ];

    // Find custom columns
    const customColumns = allColumns.filter(col => !standardColumns.includes(col));

    // Build column list and values
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
      'NOW()', // Timestamp placeholder string
      'NOW()'  // Timestamp placeholder string
    ];

    // Insert custom columns before timestamps
    customColumns.forEach(col => {
      if (req.body[col] !== undefined) {
        // Insert name into columns array (before created_at, updated_at)
        columns.splice(columns.length - 2, 0, col);
        // Insert value into values array (before NOW(), NOW())
        values.splice(values.length - 2, 0, req.body[col]);
      }
    });

    // Determine where timestamps start (last 2 items)
    const timestampStartIndex = values.length - 2;

    // Build parameterized placeholders ($1, $2...) vs raw strings (NOW())
    const placeholders = values.map((val, i) => {
      if (i >= timestampStartIndex) return val; // Returns 'NOW()'
      return `$${i + 1}`; // Returns $1, $2 etc.
    });

    // The actual params passed to pool.query must NOT contain 'NOW()'
    const paramValues = values.slice(0, timestampStartIndex);

    const query = `INSERT INTO public.safeguarding_referrals (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;

    const result = await pool.query(query, paramValues);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /safeguarding/referrals error:', err);
    res.status(500).json({ message: err.message || 'Failed to create referral' });
  }
});

// --- PATCH: Update referral ---
router.patch('/referrals/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;

    const checkRes = await pool.query('SELECT property_id FROM public.safeguarding_referrals WHERE id=$1', [id]);
    if (!checkRes.rows || checkRes.rows.length === 0) {
      return res.status(404).json({ message: 'Referral not found' });
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
      if (assignedHotelId) {
        req.body.property_id = assignedHotelId;
      }
    }

    if (restrictedHotelIds !== null) {
      if (restrictedHotelIds.length === 0) return res.status(404).json({ message: 'Referral not found' });
      const existingPid = checkRes.rows[0]?.property_id;
      if (!existingPid || !restrictedHotelIds.some((x) => String(x) === String(existingPid))) {
        return res.status(404).json({ message: 'Referral not found' });
      }
      if (req.body?.property_id !== undefined && !restrictedHotelIds.some((x) => String(x) === String(req.body.property_id))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
    }

    // Get all columns from the table
    const columnsResult = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'safeguarding_referrals'`
    );

    const allColumns = columnsResult.rows.map(r => r.column_name);
    const standardColumns = ['id', 'reference', 'created_at', 'updated_at', 'created_by', 'updated_by'];
    const updatableColumns = allColumns.filter(col => !standardColumns.includes(col));

    // Build SET clause dynamically
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    const standardFields = ['title', 'description', 'property_id', 'property_name', 'category', 'priority', 'assigned_to', 'reported_by', 'scheduled_date', 'status'];

    // Standard fields
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

    setClauses.push('updated_at=NOW()');
    values.push(id);

    const query = `UPDATE public.safeguarding_referrals SET ${setClauses.join(', ')} WHERE id=$${paramIndex} RETURNING *`;

    const result = await pool.query(query, values);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Referral not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /safeguarding/referrals/:id error:', err);
    res.status(500).json({ message: 'Failed to update referral' });
  }
});

// --- DELETE: Delete referral ---
router.delete('/referrals/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;

    const checkRes = await pool.query('SELECT property_id FROM public.safeguarding_referrals WHERE id=$1', [id]);
    if (!checkRes.rows || checkRes.rows.length === 0) {
      return res.status(404).json({ message: 'Referral not found' });
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
      if (restrictedHotelIds.length === 0) return res.status(404).json({ message: 'Referral not found' });
      const existingPid = checkRes.rows[0]?.property_id;
      if (!existingPid || !restrictedHotelIds.some((x) => String(x) === String(existingPid))) {
        return res.status(404).json({ message: 'Referral not found' });
      }
    }
    const query = 'DELETE FROM public.safeguarding_referrals WHERE id = $1 RETURNING id';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Referral not found' });
    }

    res.json({ message: 'Referral deleted', id });
  } catch (err) {
    console.error('DELETE /safeguarding/referrals/:id error:', err);
    res.status(500).json({ message: 'Failed to delete referral' });
  }
});

export default router;