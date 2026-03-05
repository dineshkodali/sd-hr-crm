import express from "express";
import pool from "../config/db.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

/**
 * @route   GET /api/shift-handovers
 * @desc    Get all shift handovers for the logged in user
 * @access  Private
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.get("/", protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const logFile = path.join(process.cwd(), "api_debug.log");
        fs.appendFileSync(logFile, `[${new Date().toISOString()}] GET /api/shift-handovers hit by user ${userId}\n`);
        const result = await pool.query(
            "SELECT * FROM shift_handovers WHERE user_id = $1 ORDER BY created_at DESC",
            [userId]
        );
        res.json({ success: true, handovers: result.rows });
    } catch (err) {
        const logFile = path.join(process.cwd(), "api_debug.log");
        fs.appendFileSync(logFile, `[${new Date().toISOString()}] GET /api/shift-handovers ERROR: ${err.message}\n`);
        console.error("Error fetching shift handovers:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/**
 * @route   POST /api/shift-handovers
 * @desc    Create a new shift handover
 * @access  Private
 */
router.post("/", protect, async (req, res) => {
    const { employee_name, shift_date, shift_type, tasks_completed, issues_reported, handover_notes } = req.body;

    if (!shift_date || !shift_type || !tasks_completed || !handover_notes) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    try {
        const userId = req.user.id;
        const result = await pool.query(
            `INSERT INTO shift_handovers 
       (user_id, employee_name, shift_date, shift_type, tasks_completed, issues_reported, handover_notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
            [userId, employee_name || req.user.name || "Employee", shift_date, shift_type, tasks_completed, issues_reported, handover_notes]
        );

        res.status(201).json({ success: true, handover: result.rows[0] });
    } catch (err) {
        console.error("Error creating shift handover:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

export default router;
