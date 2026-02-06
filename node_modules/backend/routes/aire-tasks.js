// backend/routes/aire-tasks.js
// CRUD for aire_tasks table (AIRE work orders and tasks)

import express from "express";
import pool from "../config/db.js";
import { protect as authProtect } from "../middleware/auth.js";
import { buildRoleWhere } from "../middleware/roleFilter.js";

const router = express.Router();
const protect = typeof authProtect === "function" ? authProtect : (req, res, next) => next();

/* -----------------------
   Helper: coerce text or null
   ----------------------- */
function toText(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/* -----------------------
   Helper: generate unique reference number
   Format: AIRE-YYYY-<7 random hex chars>
   ----------------------- */
function genAIREReference() {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(16).substr(2, 8);
  return `AIRE-${year}-${rand}`;
}

/* -----------------------
   GET /api/aire-tasks
   Optional query: status, priority, assigned_to_id, property_id, category, due_date, limit, offset
   ----------------------- */
router.get("/", protect, async (req, res) => {
  try {
    const { status, priority, assigned_to_id, property_id, category, due_date } = req.query || {};
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit, 10) || 100));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

    const params = [];
    const where = [];

    if (status !== undefined) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }
    if (priority !== undefined) {
      params.push(priority);
      where.push(`priority = $${params.length}`);
    }
    if (assigned_to_id !== undefined) {
      params.push(assigned_to_id);
      where.push(`assigned_to_id = $${params.length}`);
    }
    if (property_id !== undefined) {
      params.push(property_id);
      where.push(`property_id = $${params.length}`);
    }
    if (category !== undefined) {
      params.push(category);
      where.push(`category = $${params.length}`);
    }
    if (due_date !== undefined) {
      params.push(due_date);
      where.push(`due_date = $${params.length}`);
    }


    // Role-Based Restriction (AIRE Tasks)
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
        if (currentUser.branch) {
          const branchRes = await pool.query("SELECT id FROM hotels WHERE branch = $1", [currentUser.branch]);
          restrictedIds = branchRes.rows.map(r => r.id);
        }
      }

      if (restrictedIds.length === 0) {
        return res.json([]);
      }

      // Filter by property_id
      params.push(restrictedIds);
      where.push(`property_id = ANY($${params.length})`);
    }

    // apply role based filter (aire_tasks uses assigned_to_id)
    // NOTE: We keep this existing role filter as it might be relevant for task assignment logic too?
    // But primary restriction should be property-based as per user request.
    // The previous code had:
    /*
    const roleWhere = buildRoleWhere(req, params.length + 1, { assignedColumn: 'assigned_to_id' });
    if (roleWhere.clause) {
      where.push(roleWhere.clause);
      params.push(...roleWhere.params);
    }
    */
    // We will retain it but property restriction is usually stricter/sufficient for "visibility". 
    // If strict property visibility is key, the above block handles it.
    // If we want to allow seeing tasks assigned to YOU even if not in your property list (rare), we might OR it.
    // But typically "Manager/Staff should get details ... for which property they exists only" implies strict property scope.
    // So we'll skip `buildRoleWhere` or let it add additional constraints if it does something else.
    // Given the prompt "for which property they are exists only", strict property filter is safest.
    // I will comment out buildRoleWhere to avoid conflict or double-filtering if buildRoleWhere does something different.
    // Actually, buildRoleWhere filters by 'assigned_to_id = user.id' for staff.
    // Accessing tasks assigned to you is valid, but if the task is for a property you don't belong to...
    // The requirement says "only for which property (hotel) they exists only". This implies property is the boundary.
    // So I will REMOVE buildRoleWhere usage here to be compliant with "property only" rule.


    let sql = `SELECT * FROM public.aire_tasks`;
    if (where.length) sql += " WHERE " + where.join(" AND ");
    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    params.push(limit);
    params.push(offset);

    const r = await pool.query(sql, params);
    return res.json(r.rows || []);
  } catch (err) {
    console.error("GET /api/aire-tasks error:", err && (err.stack || err));
    return res.status(500).json({ message: "Server error", detail: err?.message });
  }
});

/* -----------------------
   GET /api/aire-tasks/:id
   ----------------------- */
router.get("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(
      `SELECT id, reference, task_type, title, description, priority, status, assigned_to_id, assigned_to_name, service_user_id, property_id, property_name, due_date, scheduled_date, completed_date, notes, attachments, category, tags, created_by_id, created_at, updated_at FROM public.aire_tasks WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: "AIRE task not found" });
    return res.json(r.rows[0]);
  } catch (err) {
    console.error(`GET /api/aire-tasks/${req.params.id} error:`, err && (err.stack || err));
    return res.status(500).json({ message: "Server error", detail: err?.message });
  }
});

/* -----------------------
   POST /api/aire-tasks
   Body: { title (required), plus any other columns including custom ones }
   ----------------------- */
router.post("/", protect, async (req, res) => {
  try {
    const bodyData = req.body || {};

    // Title is required
    if (!bodyData.title || String(bodyData.title).trim() === "") {
      return res.status(400).json({ message: "Title is required" });
    }

    // First, get the actual columns from the table
    const tableColumnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'aire_tasks'
    `;
    const tableColumnsResult = await pool.query(tableColumnsQuery);
    const existingColumns = new Set(tableColumnsResult.rows.map(row => row.column_name));

    const reference = genAIREReference();

    // Build column names and values dynamically
    const columns = ['reference'];
    const values = [reference];
    const placeholders = ['$1'];
    let idx = 2;

    // Default values for standard columns
    const defaults = {
      priority: "Medium",
      status: "Pending",
      category: "AIRE"
    };

    // Merge defaults with body data
    const data = { ...defaults, ...bodyData };

    // Protected columns to skip
    const protectedColumns = ['id', 'reference', 'created_at', 'updated_at'];

    for (const [key, value] of Object.entries(data)) {
      if (protectedColumns.includes(key)) continue;

      // Skip columns that don't exist in the table
      if (!existingColumns.has(key)) {
        console.warn(`Skipping column '${key}' - does not exist in aire_tasks table`);
        continue;
      }

      columns.push(key);
      placeholders.push(`$${idx++}`);

      // Apply text sanitization for text fields
      if (typeof value === 'string') {
        values.push(toText(value));
      } else {
        values.push(value);
      }
    }

    // Add timestamp columns
    columns.push('created_at', 'updated_at');
    placeholders.push('now()', 'now()');

    const q = `
      INSERT INTO public.aire_tasks (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

    const result = await pool.query(q, values);
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /api/aire-tasks error:", err && (err.stack || err));
    return res.status(500).json({ message: "Server error", detail: err?.message });
  }
});

/* -----------------------
   PATCH /api/aire-tasks/:id
   Accept partial updates (including custom columns)
   ----------------------- */
router.patch("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;

    console.log('PATCH /api/aire-tasks/:id - Received body:', req.body);

    // First, get the actual columns from the table
    const tableColumnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'aire_tasks'
    `;
    const tableColumnsResult = await pool.query(tableColumnsQuery);
    const existingColumns = new Set(tableColumnsResult.rows.map(row => row.column_name));

    console.log('Existing columns in aire_tasks table:', Array.from(existingColumns));

    const fields = [];
    const params = [];
    let idx = 1;

    // Process all body fields, including custom columns
    for (const [key, value] of Object.entries(req.body || {})) {
      // Skip protected columns
      if (['id', 'reference', 'created_at', 'updated_at', 'created_by', 'updated_by'].includes(key)) {
        continue;
      }

      // Skip columns that don't exist in the table
      if (!existingColumns.has(key)) {
        console.warn(`Skipping column '${key}' - does not exist in aire_tasks table`);
        continue;
      }

      if (value !== undefined) {
        fields.push(`${key} = $${idx++}`);
        // Apply text sanitization for text fields
        if (typeof value === 'string') {
          params.push(toText(value));
        } else {
          params.push(value);
        }
      }
    }

    if (fields.length === 0) return res.status(400).json({ message: "No fields to update" });

    params.push(id);
    const sql = `UPDATE public.aire_tasks SET ${fields.join(", ")}, updated_at = now() WHERE id = $${idx} RETURNING *`;

    console.log('Executing SQL:', sql);
    console.log('With params:', params);

    const result = await pool.query(sql, params);
    if (!result.rows[0]) return res.status(404).json({ message: "AIRE task not found" });

    console.log('Update successful, returning:', result.rows[0]);
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(`PATCH /api/aire-tasks/${req.params.id} error:`, err && (err.stack || err));
    return res.status(500).json({ message: "Server error", detail: err?.message });
  }
});

/* -----------------------
   DELETE /api/aire-tasks/:id
   ----------------------- */
router.delete("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(`DELETE FROM public.aire_tasks WHERE id = $1`, [id]);
    if (r.rowCount === 0) return res.status(404).json({ message: "AIRE task not found" });
    return res.json({ message: "Deleted" });
  } catch (err) {
    console.error(`DELETE /api/aire-tasks/${req.params.id} error:`, err && (err.stack || err));
    return res.status(500).json({ message: "Server error", detail: err?.message });
  }
});

export default router;
