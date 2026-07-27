// controllers/maintenanceController.js
import pool from "../config/db.js";

let maintenanceAttachmentsReady = false;
async function ensureMaintenanceAttachments(client) {
  if (maintenanceAttachmentsReady) return true;
  try {
    await client.query("ALTER TABLE public.maintenance_tasks ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb");
  } catch {
    // ignore
  }
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.maintenance_task_attachments (
        id SERIAL PRIMARY KEY,
        task_id INTEGER,
        file_name TEXT,
        mime_type TEXT,
        file_data BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_maintenance_task_attachments_task_id ON public.maintenance_task_attachments(task_id)`);
  } catch {
    // ignore
  }
  maintenanceAttachmentsReady = true;
  return true;
}

async function insertMaintenanceTaskAttachments(client, taskId, files = []) {
  if (!Array.isArray(files) || files.length === 0) return [];
  const ids = [];
  for (const f of files) {
    if (!f || !f.buffer) continue;
    const r = await client.query(
      `INSERT INTO public.maintenance_task_attachments (task_id, file_name, mime_type, file_data)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [taskId ?? null, f.originalname ?? null, f.mimetype ?? null, f.buffer]
    );
    if (r.rows?.[0]?.id != null) ids.push(r.rows[0].id);
  }
  return ids;
}

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

const quoteIdent = (ident) => {
  const s = String(ident);
  return '"' + s.replace(/"/g, '""') + '"';
};

async function getAllowedHotelIds(clientOrPool, user) {
  if (!user) return [];
  if (user.role === "admin") return null;

  const q = (sql, params) => (clientOrPool?.query ? clientOrPool.query(sql, params) : pool.query(sql, params));

  let query = "";
  let params = [];

  if (user.role === "manager") {
    query = "SELECT id FROM public.hotels WHERE manager_id = $1";
    params = [user.id];
    if (user.branch) {
      query += " OR branch = $2";
      params.push(user.branch);
    }
  } else if (user.role === "staff") {
    const assignedHotelId = user.hotel_id || user.hotelId || user.hotel || null;
    if (!assignedHotelId) return [];
    query = "SELECT id FROM public.hotels WHERE id = $1";
    params = [assignedHotelId];
  } else {
    return [];
  }

  const res = await q(query, params);
  return (res.rows || []).map((r) => r.id);
}

async function getAllowedHotelNamesLower(clientOrPool, allowedIds) {
  if (allowedIds === null) return null;
  if (!Array.isArray(allowedIds) || allowedIds.length === 0) return [];
  const q = (sql, params) => (clientOrPool?.query ? clientOrPool.query(sql, params) : pool.query(sql, params));
  const res = await q("SELECT name FROM public.hotels WHERE id = ANY($1::int[])", [allowedIds]);
  return (res.rows || []).map((r) => String(r.name || "").trim().toLowerCase()).filter(Boolean);
}

function getTaskHotelId(taskRow) {
  if (!taskRow) return null;
  const candid = taskRow.hotel_id ?? taskRow.property_id ?? null;
  if (candid === null || candid === undefined) return null;
  const n = Number(candid);
  return Number.isFinite(n) && Number.isInteger(n) ? n : null;
}

function getTaskSiteLower(taskRow) {
  if (!taskRow) return null;
  const s = taskRow.site ?? taskRow.hotel_name ?? null;
  if (!s) return null;
  const v = String(s).trim().toLowerCase();
  return v ? v : null;
}

let maintenanceHotelIdColCache = null;
async function getMaintenanceHotelIdCol(client) {
  if (maintenanceHotelIdColCache) return maintenanceHotelIdColCache;
  try {
    const { rows } = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'maintenance_tasks'`
    );
    const cols = (rows || []).map((r) => r.column_name);
    if (cols.includes('hotel_id')) maintenanceHotelIdColCache = 'hotel_id';
    else if (cols.includes('property_id')) maintenanceHotelIdColCache = 'property_id';
    else maintenanceHotelIdColCache = null;
  } catch {
    maintenanceHotelIdColCache = null;
  }
  return maintenanceHotelIdColCache;
}

async function assertTaskAccess(client, user, taskId) {
  const allowedIds = await getAllowedHotelIds(client, user);
  if (allowedIds === null) return { allowed: true, allowedIds: null };
  if (allowedIds.length === 0) return { allowed: false, allowedIds };

  const idCol = await getMaintenanceHotelIdCol(client);
  const selectId = idCol ? `${quoteIdent(idCol)} AS hotel_id` : `NULL::int AS hotel_id`;
  const { rows } = await client.query(
    `SELECT ${selectId}, site FROM maintenance_tasks WHERE id = $1 LIMIT 1`,
    [taskId]
  );
  if (!rows.length) return { allowed: false, allowedIds, notFound: true };

  const taskHotelId = getTaskHotelId(rows[0]);

  if (taskHotelId !== null) {
    if (!allowedIds.includes(taskHotelId)) return { allowed: false, allowedIds };
    return { allowed: true, allowedIds };
  }

  const allowedNamesLower = await getAllowedHotelNamesLower(client, allowedIds);
  if (!allowedNamesLower.length) return { allowed: false, allowedIds };
  const taskSiteLower = getTaskSiteLower(rows[0]);
  if (!taskSiteLower) return { allowed: false, allowedIds };
  if (!allowedNamesLower.includes(taskSiteLower)) return { allowed: false, allowedIds };

  return { allowed: true, allowedIds };
}

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
    assigned_to = null,
    action = null,
    priority = "Medium",
    closed_date = null,
  } = req.body ?? {};

  const resolvedSite = site ?? hotel_name ?? null;
  const resolvedHotelId = toIntOrNull(hotel_id ?? property_id ?? hotelId);

  const createdBy = toIntOrNull(req.user?.id);

  if (!title || typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ success: false, error: "Title is required" });
  }

  const missing = [];
  if (!description || String(description).trim() === "") missing.push("description");
  if (!start_date || String(start_date).trim() === "") missing.push("start_date");
  if (!due_date || String(due_date).trim() === "") missing.push("due_date");
  if (!status || String(status).trim() === "") missing.push("status");
  if (!category || String(category).trim() === "") missing.push("category");
  if (!resolvedSite || String(resolvedSite).trim() === "") missing.push("site");
  if (!room || String(room).trim() === "") missing.push("room");
  if (!raised_by || String(raised_by).trim() === "") missing.push("raised_by");
  if (!assigned_to || String(assigned_to).trim() === "") missing.push("assigned_to");
  if (!action || String(action).trim() === "") missing.push("action");
  if (!priority || String(priority).trim() === "") missing.push("priority");

  const client = await pool.connect();
  try {
    await ensureMaintenanceAttachments(client);
    const allowedIds = await getAllowedHotelIds(client, req.user);
    if (allowedIds !== null) {
      if (allowedIds.length === 0) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }
      if (resolvedHotelId === null || !allowedIds.includes(resolvedHotelId)) {
        return res.status(403).json({
          success: false,
          error: "Cannot create task for a property outside your access",
        });
      }
    }

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
      existingCols = ['title', 'description', 'start_date', 'due_date', 'status', 'category', 'site', 'room', 'raised_by', 'assigned_to', 'action', 'priority', 'closed', 'created_by', 'created_at', 'updated_at', 'deleted'];
    }

    // Require all custom columns
    const standardColsRequired = new Set([
      'id', 'title', 'description', 'start_date', 'due_date', 'status',
      'category', 'site', 'hotel_name', 'hotel_id', 'property_id', 'room',
      'raised_by', 'assigned_to', 'action', 'priority', 'closed', 'closed_date',
      'created_by', 'created_at', 'updated_at', 'deleted', 'deleted_at',
      'attachments',
      'service_user_id'
    ]);
    for (const col of existingCols) {
      if (standardColsRequired.has(col)) continue;
      const v = req.body?.[col];
      const camel = String(col).replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      const v2 = v === undefined ? req.body?.[camel] : v;
      if (v2 === undefined || v2 === null || String(v2).trim() === "") {
        missing.push(col);
      }
    }

    if (missing.length) {
      return res.status(400).json({ success: false, error: `Missing required fields: ${missing.join(', ')}` });
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
      assigned_to: assigned_to ?? null,
      action: action ?? null,
      priority: priority || "Medium",
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
    const standardCols = [
      'id', 'title', 'description', 'start_date', 'due_date', 'status',
      'category', 'site', 'hotel_name', 'hotel_id', 'property_id', 'room',
      'raised_by', 'assigned_to', 'action', 'priority', 'closed', 'closed_date',
      'created_by', 'created_at', 'updated_at', 'deleted', 'deleted_at', 'attachments'
    ];
    for (const col of existingCols) {
      if (!standardCols.includes(col) && req.body[col] !== undefined) {
        columnsToInsert.push(quoteIdent(col));
        valuesToInsert.push(req.body[col]);
        placeholders.push(`$${idx++}`);
      }
    }

    const insertQ = `
      INSERT INTO maintenance_tasks (${columnsToInsert.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *;
    `;

    console.log('--- CREATE MAINTENANCE TASK ---');
    console.log('Query:', insertQ);
    console.log('Values:', JSON.stringify(valuesToInsert));

    const { rows } = await client.query(insertQ, valuesToInsert);
    const created = rows[0];

    if (created?.id && Array.isArray(req.files) && req.files.length) {
      const newIds = await insertMaintenanceTaskAttachments(client, created.id, req.files);
      if (newIds.length) {
        try {
          const up = await client.query(
            `UPDATE public.maintenance_tasks SET attachments = $1::jsonb, updated_at = $2 WHERE id = $3 RETURNING *`,
            [JSON.stringify(newIds), new Date(), created.id]
          );
          return res.status(201).json({ success: true, data: up.rows?.[0] || created });
        } catch {
          // ignore and return created
        }
      }
    }

    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('createTask error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  } finally {
    client.release();
  }
}

export async function deleteAttachmentById(req, res) {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: "Invalid attachment id" });

  const client = await pool.connect();
  try {
    await ensureMaintenanceAttachments(client);
    const existing = await client.query(
      `SELECT id, task_id FROM public.maintenance_task_attachments WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (!existing.rows?.length) return res.status(404).json({ success: false, error: "Attachment not found" });

    const taskId = existing.rows[0]?.task_id ?? null;
    await client.query(`DELETE FROM public.maintenance_task_attachments WHERE id = $1`, [id]);

    if (taskId) {
      await client.query(
        `UPDATE public.maintenance_tasks
         SET attachments = COALESCE(
           (SELECT jsonb_agg(value)
            FROM jsonb_array_elements(COALESCE(attachments, '[]'::jsonb)) value
            WHERE value::text <> to_jsonb($1::int)::text
           ),
           '[]'::jsonb
         ),
         updated_at = $2
         WHERE id = $3`,
        [id, new Date(), taskId]
      );
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('deleteAttachmentById error:', err);
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
    const allowedIds = await getAllowedHotelIds(client, req.user);
    if (allowedIds !== null && allowedIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const allowedNamesLower = await getAllowedHotelNamesLower(client, allowedIds);

    let hotelIdCol = null;
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

    if (allowedIds !== null) {
      if (hotelIdCol) {
        whereParts.push(`${hotelIdCol} = ANY($${idx++}::int[])`);
        values.push(allowedIds);
      } else {
        if (!allowedNamesLower.length) {
          return res.json({ success: true, data: [] });
        }
        whereParts.push(`LOWER(site) = ANY($${idx++}::text[])`);
        values.push(allowedNamesLower);
      }
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
    const access = await assertTaskAccess(client, req.user, id);
    if (!access.allowed) {
      if (access.notFound) return res.status(404).json({ success: false, error: "Task not found" });
      return res.status(403).json({ success: false, error: "Access denied" });
    }

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
  console.log('Backend updateTask: received req.body', JSON.stringify(req.body, null, 2));
  const id = parseId(req.params.id);
  const { title, description, due_date, start_date, category, site, hotel_name, hotel_id, property_id, hotelId, room, raised_by, assigned_to, action, status, priority, closed_date } = req.body ?? {};

  const resolvedSite = site ?? hotel_name;
  const resolvedHotelId = toIntOrNull(hotel_id ?? property_id ?? hotelId);
  console.log('Backend updateTask: resolvedSite', resolvedSite);
  console.log('Backend updateTask: resolvedHotelId', resolvedHotelId);

  const client = await pool.connect();
  try {
    await ensureMaintenanceAttachments(client);
    const access = await assertTaskAccess(client, req.user, id);
    if (!access.allowed) {
      if (access.notFound) return res.status(404).json({ success: false, error: "Task not found or already deleted" });
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const allowedIds = access.allowedIds;
    if (allowedIds !== null && resolvedHotelId !== null && !allowedIds.includes(resolvedHotelId)) {
      return res.status(403).json({ success: false, error: "Cannot move task to a property outside your access" });
    }

    // Get existing columns
    let existingCols = [];
    try {
      const { rows: colRows } = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'maintenance_tasks' AND table_schema = 'public'
      `);
      existingCols = colRows.map(r => r.column_name);
      console.log('Backend updateTask: existingCols', existingCols); // Added logging
    } catch (schemaErr) {
      console.error('Error querying schema:', schemaErr);
      // Fallback to basic columns if schema query fails
      existingCols = ['title', 'description', 'start_date', 'due_date', 'status', 'category', 'site', 'room', 'raised_by', 'assigned_to', 'action', 'priority', 'closed', 'created_by', 'created_at', 'updated_at', 'deleted'];
      console.log('Backend updateTask: existingCols (fallback)', existingCols); // Added logging
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
      const d = start_date ? new Date(start_date) : null;
      values.push(d && !isNaN(d.getTime()) ? d : null);
      console.log('Backend updateTask: adding start_date', start_date, '->', d); // Added logging
    }

    if (due_date !== undefined) {
      setParts.push(`due_date = $${idx++}`);
      const d = due_date ? new Date(due_date) : null;
      values.push(d && !isNaN(d.getTime()) ? d : null);
      console.log('Backend updateTask: adding due_date', due_date, '->', d); // Added logging
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

    if (room !== undefined && existingCols.includes('room')) {
      setParts.push(`room = $${idx++}`);
      values.push(room ?? null);
    }

    if (raised_by !== undefined && existingCols.includes('raised_by')) {
      setParts.push(`raised_by = $${idx++}`);
      values.push(raised_by ?? null);
    }

    if (assigned_to !== undefined && existingCols.includes('assigned_to')) {
      setParts.push(`assigned_to = $${idx++}`);
      values.push(assigned_to ?? null);
      console.log('Backend updateTask: adding assigned_to', assigned_to); // Added logging
    }

    if (action !== undefined && existingCols.includes('action')) {
      setParts.push(`action = $${idx++}`);
      values.push(action ?? null);
    }

    if (status !== undefined && existingCols.includes('status')) {
      setParts.push(`status = $${idx++}`);
      values.push(status ?? null);
    }

    if (priority !== undefined && existingCols.includes('priority')) {
      setParts.push(`priority = $${idx++}`);
      values.push(priority ?? null);
    }

    if (closed_date !== undefined) {
      if (existingCols.includes('closed')) {
        setParts.push(`closed = $${idx++}`);
        const d = closed_date ? new Date(closed_date) : null;
        values.push(d && !isNaN(d.getTime()) ? d : null);
      } else if (existingCols.includes('closed_date')) {
        setParts.push(`closed_date = $${idx++}`);
        const d = closed_date ? new Date(closed_date) : null;
        values.push(d && !isNaN(d.getTime()) ? d : null);
      }
    }

    // Handle custom columns from Forms Builder
    const standardCols = [
      'id', 'title', 'description', 'start_date', 'due_date', 'status',
      'category', 'site', 'hotel_name', 'hotel_id', 'property_id', 'room',
      'raised_by', 'assigned_to', 'action', 'priority', 'closed', 'closed_date',
      'created_by', 'created_at', 'updated_at', 'deleted', 'deleted_at', 'attachments'
    ];
    for (const col of existingCols) {
      if (!standardCols.includes(col) && req.body[col] !== undefined) {
        setParts.push(`${quoteIdent(col)} = $${idx++}`);
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

    console.log('--- UPDATE MAINTENANCE TASK ---');
    console.log('ID:', id);
    console.log('Backend updateTask: setParts', setParts);
    console.log('Backend updateTask: values (before final push of id)', JSON.stringify(values, null, 2));
    console.log('Query:', updateQ);
    console.log('Values:', JSON.stringify(values));

    const { rows } = await client.query(updateQ, values);
    if (!rows.length) {
      return res.status(404).json({ success: false, error: "Task not found or already deleted" });
    }

    let updated = rows[0];
    if (updated?.id && Array.isArray(req.files) && req.files.length) {
      const newIds = await insertMaintenanceTaskAttachments(client, updated.id, req.files);
      if (newIds.length) {
        let prev = [];
        try {
          const rawPrev = updated.attachments;
          if (Array.isArray(rawPrev)) prev = rawPrev;
          else if (typeof rawPrev === 'string' && rawPrev) prev = JSON.parse(rawPrev);
          else if (rawPrev && typeof rawPrev === 'object') prev = rawPrev;
        } catch {
          prev = [];
        }
        const next = [...(Array.isArray(prev) ? prev : []), ...newIds];
        try {
          const up = await client.query(
            `UPDATE public.maintenance_tasks SET attachments = $1::jsonb, updated_at = $2 WHERE id = $3 RETURNING *`,
            [JSON.stringify(next), new Date(), updated.id]
          );
          updated = up.rows?.[0] || updated;
        } catch {
          // ignore
        }
      }
    }

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('updateTask error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  } finally {
    client.release();
  }
}

export async function getAttachmentById(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).end();

  const client = await pool.connect();
  try {
    await ensureMaintenanceAttachments(client);
    const r = await client.query(
      `SELECT id, file_name, mime_type, file_data
       FROM public.maintenance_task_attachments
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    if (!r.rows?.length) return res.status(404).end();

    const row = r.rows[0];
    const mime = row.mime_type || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    if (row.file_name) {
      res.setHeader('Content-Disposition', `inline; filename="${String(row.file_name).replace(/"/g, '')}"`);
    }
    return res.send(row.file_data);
  } catch (err) {
    console.error('GET /api/maintenance/attachments/:id error:', err);
    return res.status(500).end();
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
    const access = await assertTaskAccess(client, req.user, id);
    if (!access.allowed) {
      if (access.notFound) return res.status(404).json({ success: false, error: "Task not found" });
      return res.status(403).json({ success: false, error: "Access denied" });
    }

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
    const access = await assertTaskAccess(client, req.user, id);
    if (!access.allowed) {
      if (access.notFound) return res.status(404).json({ success: false, error: "Task not found or already deleted" });
      return res.status(403).json({ success: false, error: "Access denied" });
    }

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
    const access = await assertTaskAccess(client, req.user, id);
    if (!access.allowed) {
      if (access.notFound) return res.status(404).json({ success: false, error: "Task not found" });
      return res.status(403).json({ success: false, error: "Access denied" });
    }

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
    const access = await assertTaskAccess(client, req.user, id);
    if (!access.allowed) {
      if (access.notFound) return res.status(404).json({ success: false, error: "Task not found" });
      return res.status(403).json({ success: false, error: "Access denied" });
    }

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
