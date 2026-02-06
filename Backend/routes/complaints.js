import express from "express";
import pool from "../config/db.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

let complaintsTableReady = false;

async function ensureComplaintsTable() {
  if (complaintsTableReady) return true;
  try {
    const check = await pool.query(`SELECT to_regclass('public.complaints') AS exists`);
    if (check.rows?.[0]?.exists) {
      complaintsTableReady = true;
      return true;
    }
    console.warn('complaints table missing. Creating it now...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.complaints (
        id SERIAL PRIMARY KEY,
        reference VARCHAR(255) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        priority VARCHAR(50) DEFAULT 'medium',
        property_id INTEGER,
        property_name VARCHAR(255),
        status VARCHAR(50) DEFAULT 'open',
        reported_by VARCHAR(255),
        reported_date DATE,
        assigned_to VARCHAR(255),
        scheduled_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_complaints_priority ON public.complaints(priority)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON public.complaints(created_at DESC)`);
    complaintsTableReady = true;
    return true;
  } catch (err) {
    console.error('Failed to ensure complaints table:', err?.message || err);
    return false;
  }
}

function makeReference() {
  const rnd = Math.floor(1000 + Math.random() * 9000);
  const year = new Date().getFullYear();
  return `COMP-${year}-${rnd}`;
}

/* LIST */
router.get('/', protect, async (req, res) => {
  try {
    const ready = await ensureComplaintsTable();
    if (!ready) return res.status(500).json({ success: false, message: 'Database not initialized' });

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
      if (currentUser.branch) {
        const branchRes = await pool.query("SELECT id FROM hotels WHERE branch = $1", [currentUser.branch]);
        restrictedHotelIds = branchRes.rows.map(r => r.id);
      } else {
        restrictedHotelIds = [];
      }
    }

    const { limit = 200, offset = 0 } = req.query;

    let queryText = `SELECT * FROM public.complaints`;
    const params = [];
    const where = [];

    if (restrictedHotelIds !== null) {
      if (restrictedHotelIds.length === 0) {
        return res.json({ success: true, data: [] });
      }
      // Assuming 'property_id' is the column name in complaints table
      where.push(`property_id = ANY($${params.length + 1})`);
      params.push(restrictedHotelIds);
    }

    if (where.length > 0) {
      queryText += ` WHERE ${where.join(' AND ')}`;
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const { rows } = await pool.query(queryText, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('GET /api/complaints error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* GET BY ID */
router.get('/:id', async (req, res) => {
  try {
    const ready = await ensureComplaintsTable();
    if (!ready) return res.status(500).json({ success: false, message: 'Database not initialized' });
    const { id } = req.params;
    const { rows } = await pool.query('SELECT * FROM public.complaints WHERE id = $1 LIMIT 1', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('GET /api/complaints/:id error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* CREATE */
router.post('/', async (req, res) => {
  try {
    const ready = await ensureComplaintsTable();
    if (!ready) return res.status(500).json({ success: false, message: 'Database not initialized' });

    const title = req.body.title ?? null;
    const description = req.body.description ?? null;
    const category = req.body.category ?? null;
    const priority = req.body.priority ?? 'medium';
    const propertyId = req.body.property_id ?? req.body.propertyId ?? null;
    const propertyName = req.body.property_name ?? req.body.propertyName ?? null;
    const status = req.body.status ?? 'open';
    const reportedBy = req.body.reported_by ?? req.body.reportedBy ?? null;
    const reportedDate = (req.body.reported_date ?? req.body.reportedDate ?? null) || null;
    const assignedTo = req.body.assigned_to ?? req.body.assignedTo ?? null;
    const scheduledDate = (req.body.scheduled_date ?? req.body.scheduledDate ?? null) || null;
    const notes = req.body.notes ?? null;

    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Missing required fields: title, description' });
    }

    const ref = makeReference();

    // Get existing columns in complaints table
    const { rows: colRows } = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'complaints' AND table_schema = 'public'
    `);
    const existingCols = colRows.map(r => r.column_name);

    // Build dynamic INSERT
    const columnsToInsert = ['reference', 'title', 'description'];
    const valuesToInsert = [ref, title, description];
    let paramIndex = valuesToInsert.length + 1;

    // Standard optional fields
    const standardFields = {
      category, priority, property_id: propertyId, property_name: propertyName,
      status, reported_by: reportedBy, reported_date: reportedDate,
      assigned_to: assignedTo, scheduled_date: scheduledDate, notes
    };

    for (const [key, value] of Object.entries(standardFields)) {
      if (existingCols.includes(key) && value !== undefined) {
        columnsToInsert.push(key);
        valuesToInsert.push(value);
      }
    }

    // Handle custom columns from Forms Builder
    const standardCols = ['id', 'reference', 'title', 'description', 'category', 'priority',
      'property_id', 'property_name', 'status', 'reported_by', 'reported_date',
      'assigned_to', 'scheduled_date', 'notes', 'created_at', 'updated_at'];
    for (const col of existingCols) {
      if (!standardCols.includes(col) && req.body[col] !== undefined) {
        columnsToInsert.push(col);
        valuesToInsert.push(req.body[col]);
      }
    }

    const placeholders = columnsToInsert.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await pool.query(
      `INSERT INTO public.complaints (${columnsToInsert.join(', ')}) 
       VALUES (${placeholders}) 
       RETURNING *`,
      valuesToInsert
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('POST /api/complaints error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* UPDATE */
router.put('/:id', async (req, res) => {
  try {
    const ready = await ensureComplaintsTable();
    if (!ready) return res.status(500).json({ success: false, message: 'Database not initialized' });
    const { id } = req.params;

    // Get existing columns
    const { rows: colRows } = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'complaints' AND table_schema = 'public'
    `);
    const existingCols = colRows.map(r => r.column_name);

    const updates = [];
    const values = [];
    let idx = 1;

    const fields = ['title', 'description', 'category', 'priority', 'property_id', 'property_name', 'status', 'reported_by', 'reported_date', 'assigned_to', 'scheduled_date', 'notes'];
    for (const field of fields) {
      if (!existingCols.includes(field)) continue;
      const camelCase = field.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      let val = req.body[camelCase] ?? req.body[field];
      if (val !== undefined) {
        // Convert empty strings to null for date fields
        if ((field === 'reported_date' || field === 'scheduled_date') && val === '') {
          val = null;
        }
        updates.push(`${field} = $${idx}`);
        values.push(val);
        idx++;
      }
    }

    // Handle custom columns from Forms Builder
    const standardCols = ['id', 'reference', 'title', 'description', 'category', 'priority',
      'property_id', 'property_name', 'status', 'reported_by', 'reported_date',
      'assigned_to', 'scheduled_date', 'notes', 'created_at', 'updated_at'];
    for (const col of existingCols) {
      if (!standardCols.includes(col) && req.body[col] !== undefined) {
        updates.push(`${col} = $${idx}`);
        values.push(req.body[col]);
        idx++;
      }
    }

    if (!updates.length) return res.status(400).json({ success: false, message: 'No fields to update' });
    updates.push('updated_at = now()');

    const query = `UPDATE public.complaints SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`;
    values.push(id);

    const { rows } = await pool.query(query, values);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('PUT /api/complaints/:id error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* DELETE */
router.delete('/:id', async (req, res) => {
  try {
    const ready = await ensureComplaintsTable();
    if (!ready) return res.status(500).json({ success: false, message: 'Database not initialized' });
    const { id } = req.params;

    const { rows } = await pool.query('DELETE FROM public.complaints WHERE id = $1 RETURNING *', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('DELETE /api/complaints/:id error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
