import express from "express";
import pool from "../config/db.js";
import { protect, requireRole } from "../middleware/auth.js";

const router = express.Router({ mergeParams: true });

// GET all occupants for a service user (tenant)
router.get("/:serviceUserId", protect, async (req, res) => {
  try {
    const { serviceUserId } = req.params;
    const result = await pool.query(
      "SELECT * FROM occupants WHERE service_user_id = $1 ORDER BY created_at DESC",
      [serviceUserId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GET /api/occupants error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST add a new occupant
router.post("/:serviceUserId", protect, requireRole(['admin', 'manager', 'housing_officer', 'staff']), async (req, res) => {
  try {
    const { serviceUserId } = req.params;
    const { first_name, last_name, relation, dob, contact_info } = req.body;

    if (!first_name || !last_name) {
      return res.status(400).json({ error: "first_name and last_name are required" });
    }

    const result = await pool.query(
      `INSERT INTO occupants (service_user_id, first_name, last_name, relation, dob, contact_info) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [serviceUserId, first_name, last_name, relation, dob ? dob : null, contact_info]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /api/occupants error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT update an occupant
router.put("/:id", protect, requireRole(['admin', 'manager', 'housing_officer', 'staff']), async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, relation, dob, contact_info } = req.body;

    const result = await pool.query(
      `UPDATE occupants 
       SET first_name = COALESCE($1, first_name), 
           last_name = COALESCE($2, last_name), 
           relation = COALESCE($3, relation), 
           dob = COALESCE($4, dob), 
           contact_info = COALESCE($5, contact_info),
           updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [first_name, last_name, relation, dob ? dob : null, contact_info, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Occupant not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /api/occupants error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE occupant
router.delete("/:id", protect, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM occupants WHERE id = $1 RETURNING *", [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Occupant not found" });
    }
    
    res.json({ message: "Occupant deleted successfully" });
  } catch (err) {
    console.error("DELETE /api/occupants error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
