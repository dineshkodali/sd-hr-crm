// routes/maintenance.js
import express from "express";
import {
  createTask,
  listTasks,
  getTaskById,
  updateTask,
  changeTaskStatus,
  deleteTask,
  addComment,
  getComments,
} from "../controllers/maintenanceController.js";

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
    console.error("\n❌ MAINTENANCE ROUTE ERROR:", err);

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
 * POST   /api/maintenance            -> create task
 * GET    /api/maintenance            -> list tasks
 * GET    /api/maintenance/:id        -> get single task
 * PUT    /api/maintenance/:id        -> update task
 * PATCH  /api/maintenance/:id/status -> change status
 * DELETE /api/maintenance/:id        -> delete task
 *
 * Comments:
 * POST   /api/maintenance/:id/comments -> add comment
 * GET    /api/maintenance/:id/comments -> list comments
 */

// protect all endpoints
router.post("/", protect, safe(createTask));
router.get("/", protect, safe(listTasks));
router.get("/:id", protect, safe(getTaskById));
router.put("/:id", protect, safe(updateTask));
router.patch("/:id/status", protect, safe(changeTaskStatus));
router.delete("/:id", protect, safe(deleteTask));

router.post("/:id/comments", protect, safe(addComment));
router.get("/:id/comments", protect, safe(getComments));

export default router;
