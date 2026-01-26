// Branches management routes
import express from "express";
import pool from "../config/db.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Get all branches
router.get("/", protect, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*, u.name as manager_name 
      FROM branches b 
      LEFT JOIN users u ON b.manager_id = u.id 
      ORDER BY b.created_at DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error("Get branches error:", error);
    res.status(500).json({ message: "Failed to fetch branches" });
  }
});

// Get single branch
router.get("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT b.*, u.name as manager_name 
      FROM branches b 
      LEFT JOIN users u ON b.manager_id = u.id 
      WHERE b.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Branch not found" });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get branch error:", error);
    res.status(500).json({ message: "Failed to fetch branch" });
  }
});

// Create new branch
router.post("/", protect, async (req, res) => {
  try {
    const { name, address, phone, manager_id } = req.body;
    
    const result = await pool.query(`
      INSERT INTO branches (name, address, phone, manager_id) 
      VALUES ($1, $2, $3, $4) 
      RETURNING *
    `, [name, address, phone, manager_id]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Create branch error:", error);
    res.status(500).json({ message: "Failed to create branch" });
  }
});

// Update branch
router.put("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, phone, manager_id } = req.body;
    
    const result = await pool.query(`
      UPDATE branches 
      SET name = $1, address = $2, phone = $3, manager_id = $4, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $5 
      RETURNING *
    `, [name, address, phone, manager_id, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Branch not found" });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update branch error:", error);
    res.status(500).json({ message: "Failed to update branch" });
  }
});

// Delete branch
router.delete("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      "DELETE FROM branches WHERE id = $1 RETURNING *",
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Branch not found" });
    }
    
    res.json({ message: "Branch deleted successfully" });
  } catch (error) {
    console.error("Delete branch error:", error);
    res.status(500).json({ message: "Failed to delete branch" });
  }
});

export default router;
