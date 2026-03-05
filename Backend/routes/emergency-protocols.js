// routes/emergency-protocols.js
import express from "express";
import {
  createTask,
  listTasks,
  getTaskById,
  updateTask,
  deleteTask,
  getColumns,
} from "../controllers/emergencyProtocolsController.js";

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
    console.error("\n❌ EMERGENCY PROTOCOLS ROUTE ERROR:", err);

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
 * POST   /api/emergency-protocols            -> create task
 * GET    /api/emergency-protocols            -> list tasks
 * GET    /api/emergency-protocols/:id        -> get single task
 * PUT    /api/emergency-protocols/:id        -> update task
 * DELETE /api/emergency-protocols/:id        -> delete task
 */


// protect all endpoints
router.post("/", protect, safe(createTask));
router.get("/", protect, safe(listTasks));
// Add columns endpoint for frontend polling (must be before /:id)
router.get("/columns", protect, safe(getColumns));
router.get("/:id", protect, safe(getTaskById));
router.put("/:id", protect, safe(updateTask));
router.delete("/:id", protect, safe(deleteTask));

export default router;

