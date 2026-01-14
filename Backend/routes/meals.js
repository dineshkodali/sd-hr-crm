// backend/routes/meals.js
// CRUD for meal_schedules table

import express from "express";
import pool from "../config/db.js";
import { protect as authProtect } from "../middleware/auth.js";

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
   GET /api/meals
   Optional query: service_user_id, property_id, status, date (YYYY-MM-DD)
   ----------------------- */
// Public listing: allow unauthenticated reads so UI can display scheduled meals
// (POST/PATCH/DELETE remain protected)
router.get("/", async (req, res) => {
  try {
    const { service_user_id, property_id, status, date } = req.query || {};
    const params = [];
    const where = [];

    if (service_user_id !== undefined) {
      params.push(service_user_id);
      where.push(`service_user_id = $${params.length}`);
    }
    if (property_id !== undefined) {
      params.push(property_id);
      where.push(`property_id = $${params.length}`);
    }
    if (status !== undefined) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }
    if (date !== undefined) {
      // match scheduled_date
      params.push(date);
      where.push(`scheduled_date = $${params.length}`);
    }

    let sql = `SELECT id, service_user_id, service_user_name, property_id, property_name, meal_type, scheduled_date, portion, dietary, notes, status, created_at, updated_at FROM public.meal_schedules`;
    if (where.length) sql += " WHERE " + where.join(" AND ");
    sql += " ORDER BY scheduled_date DESC, id DESC LIMIT 1000";

    const r = await pool.query(sql, params);
    return res.json(r.rows || []);
  } catch (err) {
    console.error("GET /api/meals error:", err && (err.stack || err));
    return res.status(500).json({ message: "Server error", detail: err?.message });
  }
});

/* -----------------------
   GET /api/meals/scheduled
   Returns meals filtered by scheduled_date (query param `date`) and optional other filters.
  ----------------------- */
// Public scheduled view
router.get("/scheduled", async (req, res) => {
  try {
    const { service_user_id, property_id, status, date } = req.query || {};
    const params = [];
    const where = [];

    if (service_user_id !== undefined) {
      params.push(service_user_id);
      where.push(`service_user_id = $${params.length}`);
    }
    if (property_id !== undefined) {
      params.push(property_id);
      where.push(`property_id = $${params.length}`);
    }
    if (status !== undefined) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }
    if (date !== undefined) {
      params.push(date);
      where.push(`scheduled_date = $${params.length}`);
    }

    let sql = `SELECT id, service_user_id, service_user_name, property_id, property_name, meal_type, scheduled_date, portion, dietary, notes, status, created_at, updated_at FROM public.meal_schedules`;
    if (where.length) sql += " WHERE " + where.join(" AND ");
    sql += " ORDER BY scheduled_date DESC, id DESC LIMIT 1000";

    const r = await pool.query(sql, params);
    return res.json(r.rows || []);
  } catch (err) {
    console.error("GET /api/meals/scheduled error:", err && (err.stack || err));
    return res.status(500).json({ message: "Server error", detail: err?.message });
  }
});

/* -----------------------
   GET /api/meals/:id
  ----------------------- */
router.get("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(
      `SELECT id, service_user_id, service_user_name, property_id, property_name, meal_type, scheduled_date, portion, dietary, notes, status, created_at, updated_at FROM public.meal_schedules WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: "Meal not found" });
    return res.json(r.rows[0]);
  } catch (err) {
    console.error(`GET /api/meals/${req.params.id} error:`, err && (err.stack || err));
    return res.status(500).json({ message: "Server error", detail: err?.message });
  }
});

/* -----------------------
   POST /api/meals
   Body: { service_user_id, service_user_name?, property_id, property_name?, meal_type, scheduled_date, portion?, dietary?, notes?, status? }
  ----------------------- */
router.post("/", protect, async (req, res) => {
  try {
    const {
      service_user_id,
      service_user_name = null,
      property_id,
      property_name = null,
      meal_type,
      scheduled_date,
      portion = "Standard",
      dietary = null,
      notes = null,
      status = "Pending",
    } = req.body || {};

    if (!service_user_id) return res.status(400).json({ message: "service_user_id is required" });
    if (!property_id) return res.status(400).json({ message: "property_id is required" });
    if (!meal_type) return res.status(400).json({ message: "meal_type is required" });
    if (!scheduled_date) return res.status(400).json({ message: "scheduled_date is required (YYYY-MM-DD)" });

    const q = `INSERT INTO public.meal_schedules (service_user_id, service_user_name, property_id, property_name, meal_type, scheduled_date, portion, dietary, notes, status, created_at, updated_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now(), now())
               RETURNING id, service_user_id, service_user_name, property_id, property_name, meal_type, scheduled_date, portion, dietary, notes, status, created_at, updated_at`;

    const vals = [service_user_id, toText(service_user_name), property_id, toText(property_name), meal_type, scheduled_date, portion, toText(dietary), toText(notes), status];
    const r = await pool.query(q, vals);
    return res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error("POST /api/meals error:", err && (err.stack || err));
    return res.status(500).json({ message: "Server error", detail: err?.message });
  }
});

/* -----------------------
   PUT/PATCH /api/meals/:id
   Accept partial updates
  ----------------------- */
router.patch("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      service_user_id,
      service_user_name,
      property_id,
      property_name,
      meal_type,
      scheduled_date,
      portion,
      dietary,
      notes,
      status,
    } = req.body || {};

    const fields = [];
    const params = [];
    let idx = 1;

    if (service_user_id !== undefined) { fields.push(`service_user_id = $${idx++}`); params.push(service_user_id); }
    if (service_user_name !== undefined) { fields.push(`service_user_name = $${idx++}`); params.push(toText(service_user_name)); }
    if (property_id !== undefined) { fields.push(`property_id = $${idx++}`); params.push(property_id); }
    if (property_name !== undefined) { fields.push(`property_name = $${idx++}`); params.push(toText(property_name)); }
    if (meal_type !== undefined) { fields.push(`meal_type = $${idx++}`); params.push(meal_type); }
    if (scheduled_date !== undefined) { fields.push(`scheduled_date = $${idx++}`); params.push(scheduled_date); }
    if (portion !== undefined) { fields.push(`portion = $${idx++}`); params.push(portion); }
    if (dietary !== undefined) { fields.push(`dietary = $${idx++}`); params.push(toText(dietary)); }
    if (notes !== undefined) { fields.push(`notes = $${idx++}`); params.push(toText(notes)); }
    if (status !== undefined) { fields.push(`status = $${idx++}`); params.push(status); }

    if (fields.length === 0) return res.status(400).json({ message: "No fields to update" });

    params.push(id);
    const sql = `UPDATE public.meal_schedules SET ${fields.join(", ")}, updated_at = now() WHERE id = $${idx} RETURNING id, service_user_id, service_user_name, property_id, property_name, meal_type, scheduled_date, portion, dietary, notes, status, created_at, updated_at`;
    const r = await pool.query(sql, params);
    if (!r.rows[0]) return res.status(404).json({ message: "Meal not found" });
    return res.json(r.rows[0]);
  } catch (err) {
    console.error(`PATCH /api/meals/${req.params.id} error:`, err && (err.stack || err));
    return res.status(500).json({ message: "Server error", detail: err?.message });
  }
});

/* -----------------------
   DELETE /api/meals/:id
  ----------------------- */
router.delete("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(`DELETE FROM public.meal_schedules WHERE id = $1`, [id]);
    if (r.rowCount === 0) return res.status(404).json({ message: "Meal not found" });
    return res.json({ message: "Deleted" });
  } catch (err) {
    console.error(`DELETE /api/meals/${req.params.id} error:`, err && (err.stack || err));
    return res.status(500).json({ message: "Server error", detail: err?.message });
  }
});

export default router;
