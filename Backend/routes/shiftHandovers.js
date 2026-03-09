import express from "express";
import pool from "../config/db.js";
import { protect } from "../middleware/auth.js";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();

let hasEnsuredShiftHandoversTable = false;

const ensureShiftHandoversTable = async () => {
    if (hasEnsuredShiftHandoversTable) return;
    await pool.query(`
        CREATE TABLE IF NOT EXISTS shift_handovers (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            employee_name TEXT,
            shift_date DATE NOT NULL,
            shift_type TEXT NOT NULL,
            tasks_completed TEXT NOT NULL,
            issues_reported TEXT,
            handover_notes TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);

    // Auto-migrate older schema if it exists (user_id was previously INTEGER)
    try {
        await pool.query(`
            ALTER TABLE shift_handovers
            ALTER COLUMN user_id TYPE TEXT
            USING user_id::text;
        `);
    } catch {
        // ignore if already text or cannot be altered
    }
    hasEnsuredShiftHandoversTable = true;
};

/**
* @route   GET /api/shift-handovers
* @desc    Get all shift handovers for the logged in user
* @access  Private
*/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.get("/", protect, async (req, res) => {
    try {
        await ensureShiftHandoversTable();
        const userId = req.user.id;
        const isNumericUserId = /^\d+$/.test(String(userId));
        if (!isNumericUserId) {
            return res.json({ success: true, handovers: [] });
        }
        const logFile = path.join(process.cwd(), "api_debug.log");
        try {
            fs.appendFileSync(logFile, `[${new Date().toISOString()}] GET /api/shift-handovers hit by user ${userId}\n`);
        } catch {
            // ignore debug logging failures
        }
        const { startDate, endDate } = req.query;
        let query = "SELECT * FROM shift_handovers WHERE user_id = $1";
        const params = [Number(userId)];

        if (startDate) {
            params.push(startDate);
            query += ` AND shift_date >= $${params.length}`;
        }
        if (endDate) {
            params.push(endDate);
            query += ` AND shift_date <= $${params.length}`;
        }

        query += " ORDER BY shift_date DESC, created_at DESC";

        const result = await pool.query(query, params);
        res.json({ success: true, handovers: result.rows });
    } catch (err) {
        const logFile = path.join(process.cwd(), "api_debug.log");
        try {
            fs.appendFileSync(logFile, `[${new Date().toISOString()}] GET /api/shift-handovers ERROR: ${err.message}\n`);
        } catch {
            // ignore debug logging failures
        }
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
        await ensureShiftHandoversTable();
        const userId = req.user.id;
        const isNumericUserId = /^\d+$/.test(String(userId));
        if (!isNumericUserId) {
            return res.status(400).json({ success: false, message: "Invalid user id" });
        }
        const result = await pool.query(
            `INSERT INTO shift_handovers 
       (user_id, employee_name, shift_date, shift_type, tasks_completed, issues_reported, handover_notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
            [Number(userId), employee_name || req.user.name || "Employee", shift_date, shift_type, tasks_completed, issues_reported, handover_notes]
        );

        res.status(201).json({ success: true, handover: result.rows[0] });
    } catch (err) {
        console.error("Error creating shift handover:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

export default router;
