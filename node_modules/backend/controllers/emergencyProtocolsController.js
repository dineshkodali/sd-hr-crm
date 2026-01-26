/**
 * getColumns
 * GET /api/emergency-protocols/columns
 */
export async function getColumns(req, res) {
  const client = await pool.connect();
  try {
    const columnsResult = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'emergency_protocols'`
    );
    const columns = columnsResult.rows.map(r => r.column_name);
    return res.json({ success: true, columns });
  } catch (err) {
    console.error("getColumns error:", err);
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
}
// controllers/emergencyProtocolsController.js
import pool from "../config/db.js";

/**
 * Helpers
 */
const toIntOrNull = (v) => {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n;
};

const parseId = (val) => {
  const id = Number(val);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid id");
  return id;
};

/**
 * Generate reference number: EMP-YYYY-{random8chars}
 */
function generateReference() {
  const year = new Date().getFullYear();
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let random = "";
  for (let i = 0; i < 8; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `EMP-${year}-${random}`;
}

/**
 * createTask
 * POST /api/emergency-protocols
 * body: { title, description, property_id, category, priority, reported_by, assigned_to_name, scheduled_date }
 */
export async function createTask(req, res) {
  const client = await pool.connect();
  try {
    // Get all columns from the table
    const columnsResult = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'emergency_protocols'`
    );
    const allColumns = columnsResult.rows.map(r => r.column_name);
    // Standard columns
    const standardColumns = [
      'id', 'reference', 'type', 'title', 'description', 'property_id', 'property_name', 'category', 'priority', 'reported_by', 'assigned_to_id', 'assigned_to_name', 'scheduled_date', 'due_date', 'status', 'created_by_id', 'created_at', 'updated_at', 'deleted', 'completed_date', 'notes'
    ];
    // Find custom columns
    const customColumns = allColumns.filter(col => !standardColumns.includes(col));
    // Build column list and values for standard fields
    const reference = generateReference();
    const now = new Date();
    let columns = ['reference', 'type', 'title', 'description', 'property_id', 'property_name', 'category', 'priority', 'reported_by', 'assigned_to_id', 'assigned_to_name', 'scheduled_date', 'due_date', 'status', 'created_by_id', 'created_at', 'updated_at', 'deleted'];
    let values = [
      reference,
      "Emergency Protocols",
      req.body.title,
      req.body.description ?? null,
      toIntOrNull(req.body.property_id),
      req.body.property_name ?? null,
      req.body.category ?? null,
      req.body.priority ?? "Medium",
      req.body.reported_by ?? null,
      toIntOrNull(req.body.assigned_to_id),
      req.body.assigned_to_name ?? null,
      req.body.scheduled_date ? new Date(req.body.scheduled_date) : null,
      req.body.due_date ? new Date(req.body.due_date) : null,
      "Pending",
      toIntOrNull(req.user?.id),
      now,
      now,
      false
    ];
    // Add custom columns if present in request
    customColumns.forEach(col => {
      if (req.body.hasOwnProperty(col)) {
        columns.push(col);
        values.push(req.body[col]);
      }
    });
    // Build parameterized query
    const placeholders = values.map((_, i) => `$${i + 1}`);
    const query = `INSERT INTO emergency_protocols (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    const { rows } = await client.query(query, values);
    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("createTask error:", err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * listTasks
 * GET /api/emergency-protocols
 */
export async function listTasks(req, res) {
  const {
    status,
    priority,
    property_id,
    includeDeleted = "false",
    limit = "200",
    offset = "0",
    search,
  } = req.query ?? {};

  const includeDeletedBool = String(includeDeleted).toLowerCase() === "true";
  const limitNum = Math.min(Math.max(Number(limit) || 200, 1), 1000);
  const offsetNum = Math.max(Number(offset) || 0, 0);

  const client = await pool.connect();
  try {
    const whereParts = [];
    const values = [];
    let idx = 1;

    if (!includeDeletedBool) whereParts.push(`deleted = false`);

    if (status) {
      whereParts.push(`status = $${idx++}`);
      values.push(status);
    }

    if (priority) {
      whereParts.push(`priority = $${idx++}`);
      values.push(priority);
    }

    if (property_id) {
      whereParts.push(`property_id = $${idx++}`);
      values.push(toIntOrNull(property_id));
    }

    if (search) {
      whereParts.push(`(title ILIKE $${idx} OR description ILIKE $${idx} OR reference ILIKE $${idx})`);
      values.push(`%${search}%`);
      idx++;
    }

    const whereClause = whereParts.length ? "WHERE " + whereParts.join(" AND ") : "";

    // Dynamically select all columns
    const columnsResult = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'emergency_protocols'`
    );
    const allColumns = columnsResult.rows.map(r => r.column_name);
    const q = `
      SELECT ${allColumns.join(', ')}
      FROM emergency_protocols
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    values.push(limitNum, offsetNum);

    const { rows } = await client.query(q, values);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("listTasks error:", err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * getTaskById
 * GET /api/emergency-protocols/:id
 */
export async function getTaskById(req, res) {
  const id = parseId(req.params.id);
  const client = await pool.connect();
  try {
    // Dynamically select all columns
    const columnsResult = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'emergency_protocols'`
    );
    const allColumns = columnsResult.rows.map(r => r.column_name);
    const q = `
      SELECT ${allColumns.join(', ')}
      FROM emergency_protocols
      WHERE id = $1
      LIMIT 1;
    `;
    const { rows } = await client.query(q, [id]);
    if (!rows.length) return res.status(404).json({ success: false, error: "Task not found" });

    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("getTaskById error:", err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * updateTask
 * PUT /api/emergency-protocols/:id
 */
export async function updateTask(req, res) {
  const id = parseId(req.params.id);
  const client = await pool.connect();
  try {
    // Get all columns from the table
    const columnsResult = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'emergency_protocols'`
    );
    const allColumns = columnsResult.rows.map(r => r.column_name);
    // Standard columns
    const standardColumns = [
      'id', 'reference', 'type', 'title', 'description', 'property_id', 'property_name', 'category', 'priority', 'reported_by', 'assigned_to_id', 'assigned_to_name', 'scheduled_date', 'due_date', 'status', 'created_by_id', 'created_at', 'updated_at', 'deleted', 'completed_date', 'notes'
    ];
    // Find updatable columns
    const updatableColumns = allColumns.filter(col => col !== 'id' && col !== 'created_at' && col !== 'reference');
    // Build SET clause dynamically
    const setParts = [];
    const values = [];
    let idx = 1;
    updatableColumns.forEach(col => {
      if (req.body.hasOwnProperty(col)) {
        setParts.push(`${col} = $${idx++}`);
        values.push(req.body[col]);
      }
    });
    setParts.push(`updated_at = $${idx++}`);
    values.push(new Date());
    const q = `UPDATE emergency_protocols SET ${setParts.join(', ')} WHERE id = $${idx++} AND deleted = false RETURNING *`;
    values.push(id);
    const { rows } = await client.query(q, values);
    if (!rows.length) return res.status(404).json({ success: false, error: "Task not found or already deleted" });
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("updateTask error:", err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * deleteTask
 * DELETE /api/emergency-protocols/:id
 */
export async function deleteTask(req, res) {
  const id = parseId(req.params.id);

  const client = await pool.connect();
  try {
    const q = `
      UPDATE emergency_protocols
      SET deleted = true, deleted_at = $1, updated_at = $1
      WHERE id = $2 AND deleted = false
      RETURNING id;
    `;
    const now = new Date();
    const { rows } = await client.query(q, [now, id]);
    if (!rows.length) return res.status(404).json({ success: false, error: "Task not found or already deleted" });

    return res.json({ success: true, message: "Deleted", id: rows[0].id });
  } catch (err) {
    console.error("deleteTask error:", err);
    throw err;
  } finally {
    client.release();
  }
}

