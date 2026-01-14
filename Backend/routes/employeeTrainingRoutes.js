// routes/employeeTrainingRoutes.js
import express from "express";
import {
  createTask,
  listTasks,
  getTaskById,
  updateTask,
  deleteTask,
} from "../controllers/employeeTrainingController.js";

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
    console.error("\n❌ EMPLOYEE TRAINING ROUTE ERROR:", err);

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
 * POST   /api/employee-training            -> create task
 * GET    /api/employee-training            -> list tasks
 * GET    /api/employee-training/:id        -> get single task
 * PUT    /api/employee-training/:id        -> update task
 * DELETE /api/employee-training/:id        -> delete task
 */

// protect all endpoints
router.post("/", protect, safe(createTask));
router.get("/", protect, safe(listTasks));
router.get("/:id", protect, safe(getTaskById));
router.put("/:id", protect, safe(updateTask));
router.delete("/:id", protect, safe(deleteTask));

export default router;
