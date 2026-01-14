// C:/PostgreAuth/Backend/routes/holidays.js
import express from "express";
import pool from "../config/db.js";
import { protect as authProtect } from "../middleware/auth.js";

const router = express.Router();
const protect = typeof authProtect === "function" ? authProtect : (req, res, next) => next();

function iso(d) {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt.toISOString();
}

function rowToHoliday(row) {
  return {
    id: row.id,
    title: row.title,
    date: iso(row.date),
    description: row.description,
    status: row.status || "Active",
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

/* GET all holidays */
router.get("/", protect, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, date, description, status, created_at, updated_at 
       FROM public.holidays ORDER BY date DESC`
    );
    res.json(result.rows.map(rowToHoliday));
  } catch (err) {
    console.error("GET /holidays error:", err);
    res.status(500).json({ message: err.message });
  }
});

/* GET holiday by ID */
router.get("/:id", protect, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, date, description, status, created_at, updated_at 
       FROM public.holidays WHERE id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: "Holiday not found" });
    res.json(rowToHoliday(result.rows[0]));
  } catch (err) {
    console.error("GET /holidays/:id error:", err);
    res.status(500).json({ message: err.message });
  }
});

/* CREATE holiday */
router.post("/", protect, async (req, res) => {
  try {
    const { title, date, description, status } = req.body;

    if (!title || !date) return res.status(400).json({ message: "title and date are required" });

    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) return res.status(400).json({ message: "Invalid date format" });

    const result = await pool.query(
      `INSERT INTO public.holidays (title, date, description, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())
       RETURNING *`,
      [title, date, description || null, status || "Active"]
    );

    res.status(201).json(rowToHoliday(result.rows[0]));
  } catch (err) {
    console.error("POST /holidays error:", err);
    res.status(500).json({ message: err.message });
  }
});

/* UPDATE holiday */
router.put("/:id", protect, async (req, res) => {
  try {
    const { title, date, description, status } = req.body;

    const updates = [];
    const params = [];
    let idx = 1;

    if (title !== undefined) { updates.push(`title = $${idx++}`); params.push(title); }
    if (date !== undefined) {
      const parsed = new Date(date);
      if (isNaN(parsed.getTime())) return res.status(400).json({ message: "Invalid date format" });
      updates.push(`date = $${idx++}`); params.push(date);
    }
    if (description !== undefined) { updates.push(`description = $${idx++}`); params.push(description); }
    if (status !== undefined) { updates.push(`status = $${idx++}`); params.push(status); }

    if (updates.length === 0) return res.status(400).json({ message: "No fields to update" });

    params.push(req.params.id);

    const result = await pool.query(
      `UPDATE public.holidays 
       SET ${updates.join(", ")}, updated_at = now() 
       WHERE id = $${idx} RETURNING *`,
      params
    );

    if (!result.rows[0]) return res.status(404).json({ message: "Holiday not found" });
    res.json(rowToHoliday(result.rows[0]));
  } catch (err) {
    console.error("PUT /holidays error:", err);
    res.status(500).json({ message: err.message });
  }
});

/* DELETE holiday */
router.delete("/:id", protect, async (req, res) => {
  try {
    const result = await pool.query(`DELETE FROM public.holidays WHERE id = $1`, [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ message: "Holiday not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("DELETE /holidays error:", err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
