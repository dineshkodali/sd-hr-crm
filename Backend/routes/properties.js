// src/routes/properties.js
import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// GET ALL PROPERTIES
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, code, address FROM properties ORDER BY name");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

// GET ROOMS FOR A PROPERTY (rooms.hotel_id -> properties.id)
router.get("/:id/rooms", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, room_number, type, rate, status
       FROM rooms
       WHERE hotel_id = $1
       ORDER BY room_number`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

export default router;
