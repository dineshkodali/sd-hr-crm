// controllers/maintenanceController.js
import pool from "../config/db.js";

/**
 * Helpers
 */
const toIntOrNull = (v) => {
  // Accept numbers or numeric strings; otherwise return null.
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
 * createTask
 * POST /api/maintenance
 * body: { title, description, start_date, due_date, status, ... }
 */
export async function createTask(req, res) {
  const {
    title,
    description,
    start_date,
    due_date,
    status = "open",
    category = null,
    site = null,
    hotel_name = null,
    hotel_id = null,
    property_id = null,
    hotelId = null,
    room = null,
    raised_by = null,
    action = null,
    closed_date = null,
  } = req.body ?? {};

  const resolvedSite = site ?? hotel_name ?? null;
  const resolvedHotelId = toIntOrNull(hotel_id ?? property_id ?? hotelId);

  const createdBy = toIntOrNull(req.user?.id);

  if (!title || typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ success: false, error: "Title is required" });
  }

  const client = await pool.connect();
  try {
    const now = new Date();

    // Get existing columns in maintenance_tasks table
    let existingCols = [];
    try {
      const { rows: colRows } = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'maintenance_tasks' AND table_schema = 'public'
      `);
      existingCols = colRows.map(r => r.column_name);
    } catch (schemaErr) {
      console.error('Error querying schema:', schemaErr);
      // Fallback to basic columns if schema query fails
      existingCols = ['title', 'description', 'start_date', 'due_date', 'status', 'category', 'site', 'room', 'raised_by', 'action', 'closed', 'created_by', 'created_at', 'updated_at', 'deleted'];
    }

    // Build dynamic INSERT
    const columnsToInsert = [];
    const valuesToInsert = [];
    let idx = 1;
    const placeholders = [];

    // Standard fields
    const standardFields = {
      title: String(title).trim(),
      description: description ?? null,
      start_date: start_date ? new Date(start_date) : null,
      due_date: due_date ? new Date(due_date) : null,
      status,
      category: category ?? null,
      site: resolvedSite,
      room: room ?? null,
      raised_by: raised_by ?? null,
      action: action ?? null,
      closed: closed_date ? new Date(closed_date) : null,
      created_by: createdBy,
      created_at: now,
      updated_at: now,
      deleted: false
    };

    if (resolvedHotelId !== null) {
      if (existingCols.includes('hotel_id')) {
        standardFields.hotel_id = resolvedHotelId;
      } else if (existingCols.includes('property_id')) {
        standardFields.property_id = resolvedHotelId;
      }
    }

    for (const [key, value] of Object.entries(standardFields)) {
      if (existingCols.includes(key)) {
        columnsToInsert.push(key);
        valuesToInsert.push(value);
        placeholders.push(`$${idx++}`);
      }
    }

    // Handle custom columns from Forms Builder
    const standardCols = ['id', 'title', 'description', 'start_date', 'due_date', 'status',
      'category', 'site', 'room', 'raised_by', 'action', 'closed',
      'created_by', 'created_at', 'updated_at', 'deleted', 'deleted_at'];
    for (const col of existingCols) {
      if (!standardCols.includes(col) && req.body[col] !== undefined) {
        columnsToInsert.push(col);
        valuesToInsert.push(req.body[col]);
        placeholders.push(`$${idx++}`);
      }
    }

    const insertQ = `
      INSERT INTO maintenance_tasks (${columnsToInsert.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *;
    `;

    const { rows } = await client.query(insertQ, valuesToInsert);
    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('createTask error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  } finally {
    client.release();
  }
}

/**
 * listTasks
 * GET /api/maintenance
 */
export async function listTasks(req, res) {
  const {
    status,
    includeDeleted = "false",
    limit = "100",
    offset = "0",
    search,
  } = req.query ?? {};

  const hotelParam = req.query.hotel_id ?? req.query.property_id ?? req.query.hotelId;
  const hotelNameParam = req.query.hotel_name ?? req.query.site;

  const includeDeletedBool = String(includeDeleted).toLowerCase() === "true";
  const limitNum = Math.min(Math.max(Number(limit) || 100, 1), 1000);
  const offsetNum = Math.max(Number(offset) || 0, 0);

  const client = await pool.connect();
  try {
    let hotelIdCol = null;
    if (hotelParam) {
      try {
        const { rows: colRows } = await client.query(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'maintenance_tasks' AND table_schema = 'public'
        `);
        const cols = colRows.map((r) => r.column_name);
        if (cols.includes('hotel_id')) hotelIdCol = 'hotel_id';
        else if (cols.includes('property_id')) hotelIdCol = 'property_id';
      } catch {
        hotelIdCol = null;
      }
    }

    const whereParts = [];
    const values = [];
    let idx = 1;

    if (!includeDeletedBool) whereParts.push(`deleted = false`);

    if (status) {
      whereParts.push(`status = $${idx++}`);
      values.push(status);
    }

    if (search) {
      whereParts.push(`(title ILIKE $${idx} OR description ILIKE $${idx})`);
      values.push(`%${search}%`);
      idx++;
    }

    if (hotelParam && hotelIdCol) {
      const n = Number(hotelParam);
      if (Number.isFinite(n) && Number.isInteger(n)) {
        whereParts.push(`${hotelIdCol} = $${idx++}`);
        values.push(n);
      }
    }

    if (!hotelIdCol && hotelNameParam) {
      whereParts.push(`site ILIKE $${idx++}`);
      values.push(`%${String(hotelNameParam)}%`);
    }

    const whereClause = whereParts.length ? "WHERE " + whereParts.join(" AND ") : "";

    const q = `
      SELECT *
      FROM maintenance_tasks
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    values.push(limitNum, offsetNum);

    const { rows } = await client.query(q, values);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('listTasks error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  } finally {
    client.release();
  }
}

/**
 * getTaskById
 * GET /api/maintenance/:id
 */
export async function getTaskById(req, res) {
  const id = parseId(req.params.id);
  const client = await pool.connect();
  try {
    const q = `
      SELECT *
      FROM maintenance_tasks
      WHERE id = $1
      LIMIT 1;
    `;
    const { rows } = await client.query(q, [id]);
    if (!rows.length) return res.status(404).json({ success: false, error: "Task not found" });

    const task = rows[0];

    const commentsQ = `
      SELECT id, task_id, user_id, comment, created_at
      FROM maintenance_comments
      WHERE task_id = $1
      ORDER BY created_at ASC;
    `;
    const historyQ = `
      SELECT id, task_id, old_status, new_status, changed_by, changed_at, note
      FROM maintenance_status_history
      WHERE task_id = $1
      ORDER BY changed_at ASC;
    `;

    const [commentsRes, historyRes] = await Promise.all([
      client.query(commentsQ, [id]),
      client.query(historyQ, [id]),
    ]);

    return res.json({
      success: true,
      data: {
        task,
        comments: commentsRes.rows,
        statusHistory: historyRes.rows,
      },
    });
  } catch (err) {
    console.error('getTaskById error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  } finally {
    client.release();
  }
}

/**
 * updateTask
 * PUT /api/maintenance/:id
 */
export async function updateTask(req, res) {
  const id = parseId(req.params.id);
  const { title, description, due_date, start_date, category, site, hotel_name, hotel_id, property_id, hotelId, room, raised_by, action, status, closed_date } = req.body ?? {};

  const resolvedSite = site ?? hotel_name;
  const resolvedHotelId = toIntOrNull(hotel_id ?? property_id ?? hotelId);

  const client = await pool.connect();
  try {
    // Get existing columns
    let existingCols = [];
    try {
      const { rows: colRows } = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'maintenance_tasks' AND table_schema = 'public'
      `);
      existingCols = colRows.map(r => r.column_name);
    } catch (schemaErr) {
      console.error('Error querying schema:', schemaErr);
      // Fallback to basic columns if schema query fails
      existingCols = ['title', 'description', 'start_date', 'due_date', 'status', 'category', 'site', 'room', 'raised_by', 'action', 'closed', 'created_by', 'created_at', 'updated_at', 'deleted'];
    }

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

    if (start_date !== undefined) {
      setParts.push(`start_date = $${idx++}`);
      values.push(start_date ? new Date(start_date) : null);
    }

    if (due_date !== undefined) {
      setParts.push(`due_date = $${idx++}`);
      values.push(due_date ? new Date(due_date) : null);
    }

    if (category !== undefined) {
      setParts.push(`category = $${idx++}`);
      values.push(category ?? null);
    }

    if (resolvedSite !== undefined) {
      setParts.push(`site = $${idx++}`);
      values.push(resolvedSite ?? null);
    }

    if (resolvedHotelId !== null) {
      const hasHotelId = existingCols.includes('hotel_id');
      const hasPropertyId = existingCols.includes('property_id');
      if (hasHotelId) {
        setParts.push(`hotel_id = $${idx++}`);
        values.push(resolvedHotelId);
      } else if (hasPropertyId) {
        setParts.push(`property_id = $${idx++}`);
        values.push(resolvedHotelId);
      }
    }

    if (room !== undefined) {
      setParts.push(`room = $${idx++}`);
      values.push(room ?? null);
    }

    if (raised_by !== undefined) {
      setParts.push(`raised_by = $${idx++}`);
      values.push(raised_by ?? null);
    }

    if (action !== undefined) {
      setParts.push(`action = $${idx++}`);
      values.push(action ?? null);
    }

    if (status !== undefined) {
      setParts.push(`status = $${idx++}`);
      values.push(status ?? null);
    }

    if (closed_date !== undefined) {
      setParts.push(`closed = $${idx++}`);
      values.push(closed_date ? new Date(closed_date) : null);
    }

    // Handle custom columns from Forms Builder
    const standardCols = ['id', 'title', 'description', 'start_date', 'due_date', 'status',
      'category', 'site', 'room', 'raised_by', 'action', 'closed',
      'created_by', 'created_at', 'updated_at', 'deleted', 'deleted_at'];
    for (const col of existingCols) {
      if (!standardCols.includes(col) && req.body[col] !== undefined) {
        setParts.push(`${col} = $${idx++}`);
        values.push(req.body[col]);
      }
    }

    if (setParts.length === 0) {
      return res.status(400).json({ success: false, error: "No updatable fields provided" });
    }

    setParts.push(`updated_at = $${idx++}`);
    values.push(new Date());

    values.push(id);
    const updateQ = `
      UPDATE maintenance_tasks
      SET ${setParts.join(", ")}
      WHERE id = $${idx} AND deleted = false
      RETURNING *;
    `;

    const { rows } = await client.query(updateQ, values);
    if (!rows.length) {
      return res.status(404).json({ success: false, error: "Task not found or already deleted" });
    }
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('updateTask error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  } finally {
    client.release();
  }
}

/**
 * changeTaskStatus
 * PATCH /api/maintenance/:id/status
 * body: { status, note }
 */
export async function changeTaskStatus(req, res) {
  const id = parseId(req.params.id);
  const { status: newStatus, note } = req.body ?? {};
  const changedBy = toIntOrNull(req.user?.id);

  if (!newStatus || typeof newStatus !== "string") {
    return res.status(400).json({ success: false, error: "New status is required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const curQ = `SELECT status FROM maintenance_tasks WHERE id = $1 FOR UPDATE;`;
    const curRes = await client.query(curQ, [id]);
    if (!curRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "Task not found" });
    }
    const oldStatus = curRes.rows[0].status;

    const updQ = `
      UPDATE maintenance_tasks
      SET status = $1, updated_at = $2
      WHERE id = $3
      RETURNING id, title, description, start_date, due_date, status, category, site, room, raised_by, action, closed, created_by, created_at, updated_at;
    `;
    const updRes = await client.query(updQ, [newStatus, new Date(), id]);

    const histQ = `
      INSERT INTO maintenance_status_history
        (task_id, old_status, new_status, changed_by, changed_at, note)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, task_id, old_status, new_status, changed_by, changed_at, note;
    `;
    const histRes = await client.query(histQ, [id, oldStatus, newStatus, changedBy, new Date(), note ?? null]);

    await client.query("COMMIT");

    return res.json({
      success: true,
      data: {
        task: updRes.rows[0],
        history: histRes.rows[0],
      },
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => { });
    throw err;
  } finally {
    client.release();
  }
}

/**
 * deleteTask
 * DELETE /api/maintenance/:id
 */
export async function deleteTask(req, res) {
  const id = parseId(req.params.id);
  const deletedBy = toIntOrNull(req.user?.id);

  const client = await pool.connect();
  try {
    const q = `
      UPDATE maintenance_tasks
      SET deleted = true, deleted_at = $1, updated_at = $1
      WHERE id = $2 AND deleted = false
      RETURNING id;
    `;
    const now = new Date();
    const { rows } = await client.query(q, [now, id]);
    if (!rows.length) return res.status(404).json({ success: false, error: "Task not found or already deleted" });

    const histQ = `
      INSERT INTO maintenance_status_history
        (task_id, old_status, new_status, changed_by, changed_at, note)
      VALUES ($1, NULL, 'deleted', $2, $3, $4)
    `;
    await client.query(histQ, [id, deletedBy, now, "soft delete"]);

    return res.json({ success: true, message: "Deleted", id: rows[0].id });
  } finally {
    client.release();
  }
}

/**
 * addComment
 * POST /api/maintenance/:id/comments
 * body: { comment }
 */
export async function addComment(req, res) {
  const id = parseId(req.params.id);
  const { comment } = req.body ?? {};
  const userId = toIntOrNull(req.user?.id);

  if (!comment || String(comment).trim() === "") {
    return res.status(400).json({ success: false, error: "Comment cannot be empty" });
  }

  const client = await pool.connect();
  try {
    const tRes = await client.query("SELECT id FROM maintenance_tasks WHERE id = $1 AND deleted = false", [id]);
    if (!tRes.rows.length) return res.status(404).json({ success: false, error: "Task not found" });

    const q = `
      INSERT INTO maintenance_comments
        (task_id, user_id, comment, created_at)
      VALUES ($1, $2, $3, $4)
      RETURNING id, task_id, user_id, comment, created_at;
    `;
    const now = new Date();
    const { rows } = await client.query(q, [id, userId, String(comment).trim(), now]);

    return res.status(201).json({ success: true, data: rows[0] });
  } finally {
    client.release();
  }
}

/**
 * getComments
 * GET /api/maintenance/:id/comments
 */
export async function getComments(req, res) {
  const id = parseId(req.params.id);
  const client = await pool.connect();
  try {
    const tRes = await client.query("SELECT id FROM maintenance_tasks WHERE id = $1 LIMIT 1", [id]);
    if (!tRes.rows.length) return res.status(404).json({ success: false, error: "Task not found" });

    const q = `
      SELECT c.id, c.task_id, c.user_id, c.comment, c.created_at
      FROM maintenance_comments c
      WHERE c.task_id = $1
      ORDER BY c.created_at ASC;
    `;
    const { rows } = await client.query(q, [id]);
    return res.json({ success: true, data: rows });
  } finally {
    client.release();
  }
}
