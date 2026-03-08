// routes/maintenance.js
import express from "express";
import multer from "multer";
import {
  createTask,
  listTasks,
  getTaskById,
  getAttachmentById,
  deleteAttachmentById,
  updateTask,
  changeTaskStatus,
  deleteTask,
  addComment,
  getComments,
} from "../controllers/maintenanceController.js";

import { protect } from "../middleware/auth.js";
import { applyCrudLogging } from "../middleware/activityMiddleware.js"; // Enhanced logging

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});


// Apply CRUD logging to all operations
applyCrudLogging(router, 'maintenance', 'maintenance');
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
router.get("/attachments/:id", protect, safe(getAttachmentById));
router.delete("/attachments/:id", protect, safe(deleteAttachmentById));

router.post("/", protect, upload.array('photos', 10), safe(createTask));
router.get("/", protect, safe(listTasks));
router.get("/:id", protect, safe(getTaskById));
router.put("/:id", protect, upload.array('photos', 10), safe(updateTask));
router.patch("/:id/status", protect, safe(changeTaskStatus));
router.delete("/:id", protect, safe(deleteTask));

router.post("/:id/comments", protect, safe(addComment));
router.get("/:id/comments", protect, safe(getComments));

export default router;
