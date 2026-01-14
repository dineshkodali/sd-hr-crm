// routes/performance-management.js
import express from "express";
import {
  createTask,
  listTasks,
  getTaskById,
  updateTask,
  deleteTask,
} from "../controllers/performanceManagementController.js";

import { protect } from "../middleware/auth.js";

const router = express.Router();

/* -----------------------------------------------------
   UNIVERSAL SAFE HANDLER
   - Wraps all controllers so they ALWAYS return proper
     JSON and never throw unhandled promise rejections.
----------------------------------------------------- */
const safe = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    console.error("\n❌ PERFORMANCE MANAGEMENT ROUTE ERROR:", err);

    return res.status(500).json({
      success: false,
      error: err.message || "Internal Server Error",
    });
  }
};

/* -----------------------------------------------------
   ROUTES
----------------------------------------------------- */

/**
 * POST   /api/performance-management            -> create task
 * GET    /api/performance-management            -> list tasks
 * GET    /api/performance-management/:id        -> get single task
 * PUT    /api/performance-management/:id        -> update task
 * DELETE /api/performance-management/:id        -> delete task
 */

// protect all endpoints
router.post("/", protect, safe(createTask));
router.get("/", protect, safe(listTasks));
router.get("/:id", protect, safe(getTaskById));
router.put("/:id", protect, safe(updateTask));
router.delete("/:id", protect, safe(deleteTask));

export default router;


