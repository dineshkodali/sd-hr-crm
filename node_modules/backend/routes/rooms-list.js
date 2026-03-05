// Rooms list route for getting all rooms across hotels
import express from "express";
import pool from "../config/db.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Get all rooms (across all hotels)
router.get("/", protect, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, h.name as hotel_name 
      FROM rooms r 
      LEFT JOIN hotels h ON r.hotel_id = h.id 
      ORDER BY h.name, r.room_number
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error("Get all rooms error:", error);
    res.status(500).json({ message: "Failed to fetch rooms" });
  }
});

export default router;
