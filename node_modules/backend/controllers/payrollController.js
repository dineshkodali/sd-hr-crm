// controllers/payrollController.js
import pool from "../config/db.js";

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

// Generate reference number: PRL-YYYY-{random8chars}
function generateReference() {
  const year = new Date().getFullYear();
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let random = "";
  for (let i = 0; i < 8; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `PRL-${year}-${random}`;
}

// POST /api/payroll  -> create payroll task
export async function createTask(req, res) {
  const {
    title,
    description,
    property_id,
    property_name,
    category,
    priority = "Medium",
    reported_by,
    assigned_to_id,
    assigned_to_name,
    scheduled_date,
    due_date,
  } = req.body ?? {};

  const createdBy = toIntOrNull(req.user?.id);

  if (!title || typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ success: false, error: "Title is required" });
  }

  const client = await pool.connect();
  try {
    const reference = generateReference();
    const now = new Date();
    const insertQ = `
      INSERT INTO payroll_tasks
        (reference, type, title, description, property_id, property_name, category, priority, reported_by, assigned_to_id, assigned_to_name, scheduled_date, due_date, status, created_by_id, created_at, updated_at, deleted)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16, false)
      RETURNING id, reference, type, title, description, property_id, property_name, category, priority, status, reported_by, assigned_to_id, assigned_to_name, scheduled_date, due_date, completed_date, notes, created_by_id, created_at, updated_at;
    `;

    const values = [
      reference,
      "Payroll",
      String(title).trim(),
      description ?? null,
      toIntOrNull(property_id),
      property_name ?? null,
      category ?? null,
      priority,
      reported_by ?? null,
      toIntOrNull(assigned_to_id),
      assigned_to_name ?? null,
      scheduled_date ? new Date(scheduled_date) : null,
      due_date ? new Date(due_date) : null,
      "Pending",
      createdBy,
      now,
    ];

    const { rows } = await client.query(insertQ, values);
    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("payroll createTask error:", err);
    throw err;
  } finally {
    client.release();
  }
}

// GET /api/payroll -> list tasks
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

    const q = `
      SELECT id, reference, type, title, description, property_id, property_name, category, priority, status, reported_by, assigned_to_id, assigned_to_name, scheduled_date, due_date, completed_date, notes, created_by_id, created_at, updated_at
      FROM payroll_tasks
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    values.push(limitNum, offsetNum);

    const { rows } = await client.query(q, values);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("payroll listTasks error:", err);
    throw err;
  } finally {
    client.release();
  }
}

// GET /api/payroll/:id
export async function getTaskById(req, res) {
  const id = parseId(req.params.id);
  const client = await pool.connect();
  try {
    const q = `
      WHERE id = $1
      LIMIT 1;
    `;
    const { rows } = await client.query(
      `SELECT id, reference, type, title, description, property_id, property_name, category, priority, status, reported_by, assigned_to_id, assigned_to_name, scheduled_date, due_date, completed_date, notes, created_by_id, created_at, updated_at, deleted, deleted_at
       FROM payroll_tasks
       ${q}`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: "Task not found" });
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("payroll getTaskById error:", err);
    throw err;
  } finally {
    client.release();
  }
}

// PUT /api/payroll/:id
export async function updateTask(req, res) {
  const id = parseId(req.params.id);
  const {
    title,
    description,
    property_id,
    property_name,
    category,
    priority,
    status,
    reported_by,
    assigned_to_id,
    assigned_to_name,
    scheduled_date,
    due_date,
    notes,
  } = req.body ?? {};

  if (
    title === undefined &&
    description === undefined &&
    property_id === undefined &&
    category === undefined &&
    priority === undefined &&
    status === undefined &&
    reported_by === undefined &&
    assigned_to_id === undefined &&
    assigned_to_name === undefined &&
    scheduled_date === undefined &&
    due_date === undefined &&
    notes === undefined
  ) {
    return res.status(400).json({ success: false, error: "No updatable fields provided" });
  }

  const client = await pool.connect();
  try {
    const setParts = [];
    const values = [];
    let idx = 1;

    if (title !== undefined) {
      if (!title || String(title).trim() === "") {
        return res.status(400).json({ success: false, error: "Title cannot be empty" });
      }
      setParts.push(`title = $${idx++}`);
      values.push(String(title).trim());
    }

    if (description !== undefined) {
      setParts.push(`description = $${idx++}`);
      values.push(description === null ? null : String(description));
    }

    if (property_id !== undefined) {
      setParts.push(`property_id = $${idx++}`);
      values.push(toIntOrNull(property_id));
    }

    if (property_name !== undefined) {
      setParts.push(`property_name = $${idx++}`);
      values.push(property_name ?? null);
    }

    if (category !== undefined) {
      setParts.push(`category = $${idx++}`);
      values.push(category ?? null);
    }

    if (priority !== undefined) {
      setParts.push(`priority = $${idx++}`);
      values.push(priority ?? null);
    }

    if (status !== undefined) {
      setParts.push(`status = $${idx++}`);
      values.push(status ?? null);
    }

    if (reported_by !== undefined) {
      setParts.push(`reported_by = $${idx++}`);
      values.push(reported_by ?? null);
    }

    if (assigned_to_id !== undefined) {
      setParts.push(`assigned_to_id = $${idx++}`);
      values.push(toIntOrNull(assigned_to_id));
    }

    if (assigned_to_name !== undefined) {
      setParts.push(`assigned_to_name = $${idx++}`);
      values.push(assigned_to_name ?? null);
    }

    if (scheduled_date !== undefined) {
      setParts.push(`scheduled_date = $${idx++}`);
      values.push(scheduled_date ? new Date(scheduled_date) : null);
    }

    if (due_date !== undefined) {
      setParts.push(`due_date = $${idx++}`);
      values.push(due_date ? new Date(due_date) : null);
    }

    if (notes !== undefined) {
      setParts.push(`notes = $${idx++}`);
      values.push(notes ?? null);
    }

    setParts.push(`updated_at = $${idx++}`);
    values.push(new Date());

    const q = `
      UPDATE payroll_tasks
      SET ${setParts.join(", ")}
      WHERE id = $${idx++} AND deleted = false
      RETURNING id, reference, type, title, description, property_id, property_name, category, priority, status, reported_by, assigned_to_id, assigned_to_name, scheduled_date, due_date, completed_date, notes, created_by_id, created_at, updated_at;
    `;
    values.push(id);

    const { rows } = await client.query(q, values);
    if (!rows.length) return res.status(404).json({ success: false, error: "Task not found or already deleted" });

    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("payroll updateTask error:", err);
    throw err;
  } finally {
    client.release();
  }
}

// DELETE /api/payroll/:id
export async function deleteTask(req, res) {
  const id = parseId(req.params.id);

  const client = await pool.connect();
  try {
    const q = `
      UPDATE payroll_tasks
      SET deleted = true, deleted_at = $1, updated_at = $1
      WHERE id = $2 AND deleted = false
      RETURNING id;
    `;
    const now = new Date();
    const { rows } = await client.query(q, [now, id]);
    if (!rows.length) return res.status(404).json({ success: false, error: "Task not found or already deleted" });

    return res.json({ success: true, message: "Deleted", id: rows[0].id });
  } catch (err) {
    console.error("payroll deleteTask error:", err);
    throw err;
  } finally {
    client.release();
  }
}


