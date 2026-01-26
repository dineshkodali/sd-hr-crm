// routes/hr-management.js
import express from "express";
import {
  createTask,
  listTasks,
  getTaskById,
  updateTask,
  deleteTask,
} from "../controllers/hrManagementController.js";

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
    console.error("\n❌ HR MANAGEMENT ROUTE ERROR:", err);

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
 * POST   /api/hr-management            -> create task
 * GET    /api/hr-management            -> list tasks
 * GET    /api/hr-management/:id        -> get single task
 * PUT    /api/hr-management/:id        -> update task
 * DELETE /api/hr-management/:id        -> delete task
 */

// protect all endpoints
router.post("/", protect, safe(createTask));
router.get("/", protect, safe(listTasks));
router.get("/:id", protect, safe(getTaskById));
router.put("/:id", protect, safe(updateTask));
router.delete("/:id", protect, safe(deleteTask));

export default router;

