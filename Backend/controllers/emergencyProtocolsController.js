import pool from "../config/db.js";

/**
 * getColumns
 * GET /api/emergency-protocols/columns
 */
const emergencyProtocolsColumnsCache = {
  ts: 0,
  columns: null,
};

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

function generateReference() {
  const year = new Date().getFullYear();
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let rnd = "";
  for (let i = 0; i < 4; i++) rnd += chars.charAt(Math.floor(Math.random() * chars.length));
  return `EMP-${year}-${rnd}`;
}

async function getAllowedHotels(clientOrPool, user) {
  const isUserFirstArg = clientOrPool && typeof clientOrPool === 'object' && user === undefined && 'role' in clientOrPool;
  const actualUser = isUserFirstArg ? clientOrPool : user;
  const q = (sql, params) => (isUserFirstArg ? pool.query(sql, params) : (clientOrPool?.query ? clientOrPool.query(sql, params) : pool.query(sql, params)));

  if (!actualUser) return { ids: [], namesLower: [] };
  if (actualUser.role === 'admin') return { ids: null, namesLower: null };

  let query = '';
  let params = [];

  if (actualUser.role === 'manager') {
    query = 'SELECT id, name FROM public.hotels WHERE manager_id = $1';
    params = [actualUser.id];
    if (actualUser.branch) {
      query += ' OR branch = $2';
      params.push(actualUser.branch);
    }
  } else if (actualUser.role === 'staff') {
    const assignedHotelId = actualUser.hotel_id || actualUser.hotelId || actualUser.hotel || null;
    if (!assignedHotelId) return { ids: [], namesLower: [] };
    query = 'SELECT id, name FROM public.hotels WHERE id = $1';
    params = [assignedHotelId];
  } else {
    return { ids: [], namesLower: [] };
  }

  const result = await q(query, params);
  const rows = Array.isArray(result.rows) ? result.rows : [];
  return {
    ids: rows.map((r) => r.id).filter((v) => v !== null && v !== undefined),
    namesLower: rows.map((r) => String(r.name || '').trim().toLowerCase()).filter(Boolean),
  };
}

async function assertEmergencyAccess(client, user, taskId) {
  const allowedHotels = await getAllowedHotels(client, user);
  if (allowedHotels.ids === null) return { allowed: true, allowedHotels };
  if (!Array.isArray(allowedHotels.ids) || allowedHotels.ids.length === 0) return { allowed: false, allowedHotels };

  const r = await client.query(
    `SELECT property_id, property_name
     FROM public.emergency_protocols
     WHERE id = $1 AND deleted = false
     LIMIT 1`,
    [taskId]
  );
  if (!r.rows?.length) return { allowed: false, allowedHotels, notFound: true };

  const row = r.rows[0];
  const pid = toIntOrNull(row.property_id);
  const pnameLower = String(row.property_name || '').trim().toLowerCase();
  const ok =
    (pid !== null && allowedHotels.ids.includes(pid)) ||
    (!!pnameLower && Array.isArray(allowedHotels.namesLower) && allowedHotels.namesLower.includes(pnameLower));

  return { allowed: !!ok, allowedHotels };
}

export async function getColumns(req, res) {
  try {
    const now = Date.now();
    if (emergencyProtocolsColumnsCache.columns && now - emergencyProtocolsColumnsCache.ts < 5 * 60_000) {
      return res.json({ success: true, columns: emergencyProtocolsColumnsCache.columns });
    }

    const columnsResult = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'emergency_protocols'`
    );
    const columns = columnsResult.rows.map(r => r.column_name);

    emergencyProtocolsColumnsCache.ts = now;
    emergencyProtocolsColumnsCache.columns = columns;
    return res.json({ success: true, columns });
  } catch (err) {
    console.error("getColumns error:", err);
    if (emergencyProtocolsColumnsCache.columns) {
      return res.json({ success: true, columns: emergencyProtocolsColumnsCache.columns });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
}

let emergencyAttachmentsReady = false;
async function ensureEmergencyAttachments(client) {
  if (emergencyAttachmentsReady) return true;
  const q = (sql, params) => (client?.query ? client.query(sql, params) : pool.query(sql, params));
  try {
    await q("ALTER TABLE public.emergency_protocols ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb");
  } catch {
    // ignore
  }
  try {
    await q(`
      CREATE TABLE IF NOT EXISTS public.emergency_protocol_attachments (
        id SERIAL PRIMARY KEY,
        task_id INTEGER,
        file_name TEXT,
        mime_type TEXT,
        file_data BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    try {
      await q("ALTER TABLE public.emergency_protocol_attachments ADD COLUMN IF NOT EXISTS task_id INTEGER");
    } catch {
      // ignore
    }
    await q(`CREATE INDEX IF NOT EXISTS idx_emergency_protocol_attachments_task_id ON public.emergency_protocol_attachments(task_id)`);
  } catch {
    // ignore
  }
  emergencyAttachmentsReady = true;
  return true;
}

async function insertEmergencyAttachments(client, taskId, files = []) {
  if (!Array.isArray(files) || files.length === 0) return [];
  const ids = [];
  for (const f of files) {
    if (!f || !f.buffer) continue;
    const r = await client.query(
      `INSERT INTO public.emergency_protocol_attachments (task_id, file_name, mime_type, file_data)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [taskId ?? null, f.originalname ?? null, f.mimetype ?? null, f.buffer]
    );
    if (r.rows?.[0]?.id != null) ids.push(r.rows[0].id);
  }
  return ids;
}

export async function getAttachmentById(req, res) {
  const client = await pool.connect();
  try {
    await ensureEmergencyAttachments(client);
    const id = req.params.id;
    if (!/^\d+$/.test(String(id))) return res.status(400).end();
    const r = await client.query(
      `SELECT id, file_name, mime_type, file_data
       FROM public.emergency_protocol_attachments
       WHERE id = $1
       LIMIT 1`,
      [Number(id)]
    );
    if (!r.rows?.length) return res.status(404).end();
    const row = r.rows[0];
    const mime = row.mime_type || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    if (row.file_name) {
      res.setHeader('Content-Disposition', `inline; filename="${String(row.file_name).replace(/\"/g, '')}"`);
    }
    return res.send(row.file_data);
  } catch (err) {
    console.error('GET /api/emergency-protocols/attachments/:id error:', err && (err.stack || err));
    return res.status(500).end();
  } finally {
    client.release();
  }
}

export async function deleteAttachmentById(req, res) {
  const client = await pool.connect();
  try {
    await ensureEmergencyAttachments(client);
    const id = req.params.id;
    if (!/^\d+$/.test(String(id))) return res.status(400).json({ message: 'Invalid attachment id' });
    const attId = Number(id);

    const existing = await client.query(
      `SELECT id, task_id FROM public.emergency_protocol_attachments WHERE id = $1 LIMIT 1`,
      [attId]
    );
    if (!existing.rows?.length) return res.status(404).json({ message: 'Attachment not found' });
    const taskId = existing.rows[0]?.task_id ?? null;

    if (taskId != null) {
      const access = await assertEmergencyAccess(client, req.user, Number(taskId));
      if (!access.allowed) {
        if (access.notFound) return res.status(404).json({ message: 'Task not found' });
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    await client.query(`DELETE FROM public.emergency_protocol_attachments WHERE id = $1`, [attId]);

    if (taskId) {
      await client.query(
        `UPDATE public.emergency_protocols
         SET attachments = COALESCE(
           (SELECT jsonb_agg(value)
            FROM jsonb_array_elements(COALESCE(attachments, '[]'::jsonb)) value
            WHERE value::text <> to_jsonb($1::int)::text
           ),
           '[]'::jsonb
         ),
         updated_at = now()
         WHERE id = $2`,
        [attId, taskId]
      );
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/emergency-protocols/attachments/:id error:', err && (err.stack || err));
    return res.status(500).json({ message: 'Server error', detail: err?.message });
  } finally {
    client.release();
  }
}

/**
 * listTasks
 * GET /api/emergency-protocols
 */
export async function listTasks(req, res) {
  const client = await pool.connect();
  try {
    await ensureEmergencyAttachments(client);
    const allowed = await getAllowedHotels(client, req.user);
    const limit = Math.min(Math.max(Number(req.query?.limit || 200) || 200, 1), 2000);

    if (allowed.ids !== null && (!Array.isArray(allowed.ids) || allowed.ids.length === 0)) {
      return res.json({ success: true, data: [] });
    }

    if (allowed.ids === null) {
      const r = await client.query(
        `SELECT * FROM public.emergency_protocols WHERE deleted = false ORDER BY id DESC LIMIT $1`,
        [limit]
      );
      return res.json({ success: true, data: r.rows || [] });
    }

    const r = await client.query(
      `SELECT *
     FROM public.emergency_protocols
     WHERE deleted = false
       AND (property_id = ANY($1::int[]))
     ORDER BY id DESC
     LIMIT $2`,
      [allowed.ids, limit]
    );
    return res.json({ success: true, data: r.rows || [] });
  } catch (err) {
    console.error('listTasks error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Server error' });
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
    await ensureEmergencyAttachments(client);
    const access = await assertEmergencyAccess(client, req.user, id);
    if (!access.allowed) {
      if (access.notFound) return res.status(404).json({ success: false, error: 'Task not found or already deleted' });
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const r = await client.query(
      `SELECT * FROM public.emergency_protocols WHERE id = $1 AND deleted = false LIMIT 1`,
      [id]
    );
    if (!r.rows?.length) return res.status(404).json({ success: false, error: 'Task not found or already deleted' });
    return res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    console.error('getTaskById error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Server error' });
  } finally {
    client.release();
  }
}

/**
 * createTask
 * POST /api/emergency-protocols
 * body: { title, description, property_id, category, priority, reported_by, assigned_to_name, scheduled_date }
 */
export async function createTask(req, res) {
  const client = await pool.connect();
  try {
    await ensureEmergencyAttachments(client);
    const allowed = await getAllowedHotels(client, req.user);
    const propertyId = toIntOrNull(req.body.property_id);
    const propertyNameLower = String(req.body.property_name || "").trim().toLowerCase();
    if (allowed.ids !== null) {
      const ok =
        (propertyId !== null && allowed.ids.includes(propertyId)) ||
        (propertyNameLower && allowed.namesLower.includes(propertyNameLower));
      if (!ok) {
        return res.status(403).json({ success: false, error: "Cannot create task for a property outside your access" });
      }
    }

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

    const missing = [];
    if (!req.body.title || String(req.body.title).trim() === '') missing.push('title');
    if (!req.body.description || String(req.body.description).trim() === '') missing.push('description');
    if (!req.body.property_id || String(req.body.property_id).trim() === '') missing.push('property_id');
    if (!req.body.property_name || String(req.body.property_name).trim() === '') missing.push('property_name');
    if (!req.body.category || String(req.body.category).trim() === '') missing.push('category');
    if (!req.body.priority || String(req.body.priority).trim() === '') missing.push('priority');
    if (!req.body.reported_by || String(req.body.reported_by).trim() === '') missing.push('reported_by');
    if (!req.body.assigned_to_name || String(req.body.assigned_to_name).trim() === '') missing.push('assigned_to_name');
    if (!req.body.scheduled_date || String(req.body.scheduled_date).trim() === '') missing.push('scheduled_date');

    for (const col of customColumns) {
      const v = req.body[col];
      const camel = String(col).replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      const v2 = v === undefined ? req.body[camel] : v;
      if (v2 === undefined || v2 === null || (typeof v2 !== 'boolean' && String(v2).trim() === '')) {
        missing.push(col);
      }
    }

    if (missing.length) {
      return res.status(400).json({ success: false, error: `Missing required fields: ${missing.join(', ')}` });
    }
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
      if (Object.prototype.hasOwnProperty.call(req.body, col)) {
        columns.push(col);
        values.push(req.body[col]);
      }
    });
    // Build parameterized query
    const placeholders = values.map((_, i) => `$${i + 1}`);
    const query = `INSERT INTO emergency_protocols (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    const { rows } = await client.query(query, values);
    let created = rows[0];

    if (created?.id && Array.isArray(req.files) && req.files.length) {
      const newIds = await insertEmergencyAttachments(client, created.id, req.files);
      if (newIds.length) {
        try {
          const up = await client.query(
            `UPDATE public.emergency_protocols SET attachments = $1::jsonb, updated_at = now() WHERE id = $2 RETURNING *`,
            [JSON.stringify(newIds), created.id]
          );
          created = up.rows?.[0] || created;
        } catch {
          // ignore
        }
      }
    }

    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error("createTask error:", err);
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
    await ensureEmergencyAttachments(client);
    const access = await assertEmergencyAccess(client, req.user, id);
    if (!access.allowed) {
      if (access.notFound) return res.status(404).json({ success: false, error: "Task not found or already deleted" });
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const allowed = access.allowedHotels;
    const nextPropertyId = req.body.property_id != null ? toIntOrNull(req.body.property_id) : null;
    const nextPropertyNameLower = String(req.body.property_name || "").trim().toLowerCase();
    if (allowed.ids !== null && (nextPropertyId !== null || nextPropertyNameLower)) {
      const ok =
        (nextPropertyId !== null && allowed.ids.includes(nextPropertyId)) ||
        (nextPropertyNameLower && allowed.namesLower.includes(nextPropertyNameLower));
      if (!ok) {
        return res.status(403).json({ success: false, error: "Cannot move task to a property outside your access" });
      }
    }

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
    const updatableColumns = allColumns.filter(col => col !== 'id' && col !== 'created_at' && col !== 'reference' && col !== 'attachments');
    // Build SET clause dynamically
    const setParts = [];
    const values = [];
    let idx = 1;
    updatableColumns.forEach(col => {
      if (Object.prototype.hasOwnProperty.call(req.body, col)) {
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

    let updated = rows[0];
    if (updated?.id && Array.isArray(req.files) && req.files.length) {
      const newIds = await insertEmergencyAttachments(client, updated.id, req.files);
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
            `UPDATE public.emergency_protocols SET attachments = $1::jsonb, updated_at = now() WHERE id = $2 RETURNING *`,
            [JSON.stringify(next), updated.id]
          );
          updated = up.rows?.[0] || updated;
        } catch {
          // ignore
        }
      }
    }

    return res.json({ success: true, data: updated });
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
    const access = await assertEmergencyAccess(client, req.user, id);
    if (!access.allowed) {
      if (access.notFound) return res.status(404).json({ success: false, error: "Task not found or already deleted" });
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const columnsRes = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'emergency_protocols'`
    );
    const cols = new Set((columnsRes.rows || []).map((r) => r.column_name));
    const hasDeletedAt = cols.has('deleted_at');

    const now = new Date();
    const q = hasDeletedAt
      ? `
      UPDATE emergency_protocols
      SET deleted = true, deleted_at = $1, updated_at = $1
      WHERE id = $2 AND deleted = false
      RETURNING id;
    `
      : `
      UPDATE emergency_protocols
      SET deleted = true, updated_at = $1
      WHERE id = $2 AND deleted = false
      RETURNING id;
    `;

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

