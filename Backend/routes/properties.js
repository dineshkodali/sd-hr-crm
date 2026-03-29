// src/routes/properties.js
import express from "express";
import pool from "../config/db.js";

const router = express.Router();

// GET ALL PROPERTIES
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, code, address, branch_id, latitude, longitude FROM properties ORDER BY name");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

// QUICK SEARCH BY UNIT OR TENANT
router.get("/search", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    
    const searchTerm = `%${q}%`;
    const result = await pool.query(
      `SELECT DISTINCT p.id as property_id, p.name as property_name, r.room_number, su.first_name, su.last_name
       FROM properties p
       LEFT JOIN rooms r ON r.hotel_id = p.id
       LEFT JOIN service_users su ON su.room_id = r.id OR su.property_id = p.id
       WHERE p.name ILIKE $1 
          OR r.room_number ILIKE $1 
          OR su.first_name ILIKE $1 
          OR su.last_name ILIKE $1
       LIMIT 20`,
      [searchTerm]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

// BULK UPDATE PROPERTIES
router.put("/bulk", async (req, res) => {
  try {
    const { propertyIds, updates } = req.body;
    if (!propertyIds || !Array.isArray(propertyIds) || propertyIds.length === 0) {
      return res.status(400).json({ error: "propertyIds array is required" });
    }
    
    const setCols = [];
    const values = [];
    let idx = 1;
    
    // Only allow specific columns to be bulk updated
    const allowedUpdates = ['branch_id']; 
    for (const key of Object.keys(updates)) {
      if (allowedUpdates.includes(key)) {
        setCols.push(`${key} = $${idx}`);
        values.push(updates[key]);
        idx++;
      }
    }
    
    if (setCols.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }
    
    // add propertyIds
    values.push(propertyIds);
    const idIdx = idx;
    
    const query = `UPDATE properties SET ${setCols.join(", ")}, updated_at = NOW() WHERE id = ANY($${idIdx}::int[]) RETURNING *`;
    const result = await pool.query(query, values);
    
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
