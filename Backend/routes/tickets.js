// backend/routes/tickets.js
// Ticket CRUD routes — moved out of admin.js.
// base mount: app.use('/api/tickets', require('./routes/tickets').default)

import express from "express";
import pool from "../config/db.js";
import { protect as authProtect } from "../middleware/auth.js"; // optional, fallback used below

const router = express.Router();
const protect = typeof authProtect === "function" ? authProtect : (req, res, next) => next();

/**
 * Helper: generate a readable ticket number
 * Format: TCK-<7 digit random>
 */
function genTicketNo() {
  const n = Math.floor(Math.random() * 9000000) + 1000000;
  return `TCK-${n}`;
}

/**
 * Helper: ensure value is string (for text columns); returns null for empty inputs
 */
function toText(val) {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  return s === "" ? null : s;
}

/* -----------------------
   GET /api/tickets/agent-open-counts
   Returns: accurate open ticket count from DB
   MUST be defined before routes with parameters (/:id)
----------------------- */
router.get("/agent-open-counts", protect, async (req, res) => {
  try {
    // 1) Get open ticket counts grouped by assignee_id (null => unassigned)
    const q1 = `
      SELECT 
        COALESCE(assignee_id::text, '__unassigned__') AS key,
        COUNT(*)::int AS open_count
      FROM public.tickets
      WHERE LOWER(COALESCE(status, 'open')) = 'open'
      GROUP BY COALESCE(assignee_id::text, '__unassigned__')
    `;
    const r1 = await pool.query(q1);

    const counts = {};
    (r1.rows || []).forEach(row => { counts[row.key] = Number(row.open_count || 0); });

    // 2) Get staff/agent users from DB
    const q2 = `
      SELECT id, name, avatar
      FROM public.users
      WHERE role IN ('staff','agent','manager') OR role IS NULL
      ORDER BY name NULLS LAST
    `;
    const r2 = await pool.query(q2);

    // 3) Build final agent list
    const agents = (r2.rows || []).map(u => ({
      id: u.id,
      name: u.name || `User ${u.id}`,
      avatar: u.avatar || null,
      open_count: counts[String(u.id)] || 0
    }));

    // 4) Unassigned bucket
    if (counts["__unassigned__"] && counts["__unassigned__"] > 0) {
      agents.push({ id: null, name: "Unassigned", avatar: null, open_count: counts["__unassigned__"] });
    }

    return res.json({ agents });
  } catch (err) {
    console.error("GET /api/tickets/agent-open-counts error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ message: "Server error", detail: err?.message });
  }
});

/* -----------------------
   GET /api/tickets
   Optional query params:
     - hotel_id (filters by hotel_id)
     - status, priority
     - limit, offset
   ----------------------- */
router.get("/", protect, async (req, res) => {
  try {
    const { hotel_id, status, priority } = req.query;
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit, 10) || 100));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

    const params = [];
    const where = [];

    if (hotel_id !== undefined) {
      params.push(toText(hotel_id));
      where.push(`hotel_id = $${params.length}::text`);
    }
    if (status !== undefined) {
      params.push(String(status));
      where.push(`status = $${params.length}`);
    }
    if (priority !== undefined) {
      params.push(String(priority));
      where.push(`priority = $${params.length}`);
    }

    let sql = `SELECT id, ticket_no, title, subject, category, description, assignee_id, priority, status, hotel_id, created_at, updated_at
               FROM public.tickets`;
    if (where.length) sql += " WHERE " + where.join(" AND ");
    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    params.push(limit);
    params.push(offset);

    const result = await pool.query(sql, params);
    return res.json(result.rows);
  } catch (err) {
    console.error("GET /api/tickets error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ message: "Server error", detail: err?.message });
  }
});

/* -----------------------
   GET /api/tickets/:id
   ----------------------- */
router.get("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, ticket_no, title, subject, category, description, assignee_id, priority, status, hotel_id, created_at, updated_at
       FROM public.tickets WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: "Ticket not found" });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(`GET /api/tickets/${req.params.id} error:`, err && err.stack ? err.stack : err);
    return res.status(500).json({ message: "Server error", detail: err?.message });
  }
});

/* -----------------------
   POST /api/tickets
   Body: { title, subject?, category?, description?, assignee_id?, priority?, status?, hotel_id? }
   ----------------------- */
router.post("/", protect, async (req, res) => {
  try {
    const {
      title,
      subject = null,
      category = null,
      description = null,
      assignee_id = null,
      priority = "medium",
      status = "open",
      hotel_id = null,
    } = req.body || {};

    if (!title || String(title).trim() === "") {
      return res.status(400).json({ message: "Title is required" });
    }

    // hotel_id stored as text in DB — coerce to string (or null)
    const hotelIdText = toText(hotel_id);
    const assigneeText = toText(assignee_id);

    const ticketNo = genTicketNo();

    const q = `
      INSERT INTO public.tickets
        (ticket_no, title, subject, category, description, assignee_id, priority, status, hotel_id, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
      RETURNING id, ticket_no, title, subject, category, description, assignee_id, priority, status, hotel_id, created_at, updated_at
    `;

    const values = [ticketNo, title, subject, category, description, assigneeText, priority, status, hotelIdText];

    const result = await pool.query(q, values);
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /api/tickets error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ message: "Server error", detail: err?.message });
  }
});

/* -----------------------
   PUT /api/tickets/:id
   Body: any of { title, subject, category, description, assignee_id, priority, status, hotel_id }
   ----------------------- */
router.put("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      subject,
      category,
      description,
      assignee_id,
      priority,
      status,
      hotel_id,
    } = req.body || {};

    const fields = [];
    const params = [];
    let idx = 1;

    if (title !== undefined) { fields.push(`title = $${idx++}`); params.push(title); }
    if (subject !== undefined) { fields.push(`subject = $${idx++}`); params.push(subject); }
    if (category !== undefined) { fields.push(`category = $${idx++}`); params.push(category); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); params.push(description); }
    if (assignee_id !== undefined) { fields.push(`assignee_id = $${idx++}`); params.push(toText(assignee_id)); }
    if (priority !== undefined) { fields.push(`priority = $${idx++}`); params.push(priority); }
    if (status !== undefined) { fields.push(`status = $${idx++}`); params.push(status); }
    if (hotel_id !== undefined) { fields.push(`hotel_id = $${idx++}`); params.push(toText(hotel_id)); }

    if (fields.length === 0) return res.status(400).json({ message: "No fields to update" });

    params.push(id);
    const sql = `UPDATE public.tickets SET ${fields.join(", ")}, updated_at = now() WHERE id = $${idx} RETURNING id, ticket_no, title, subject, category, description, assignee_id, priority, status, hotel_id, created_at, updated_at`;

    const result = await pool.query(sql, params);
    if (!result.rows[0]) return res.status(404).json({ message: "Ticket not found" });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(`PUT /api/tickets/${req.params.id} error:`, err && err.stack ? err.stack : err);
    return res.status(500).json({ message: "Server error", detail: err?.message });
  }
});

/* -----------------------
   DELETE /api/tickets/:id
   ----------------------- */
router.delete("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`DELETE FROM public.tickets WHERE id = $1`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ message: "Ticket not found" });
    return res.json({ message: "Deleted" });
  } catch (err) {
    console.error(`DELETE /api/tickets/${req.params.id} error:`, err && err.stack ? err.stack : err);
    return res.status(500).json({ message: "Server error", detail: err?.message });
  }
});

export default router;
