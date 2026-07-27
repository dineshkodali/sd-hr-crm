// routes/emergency-protocols.js
import express from "express";
import multer from "multer";
import {
  createTask,
  listTasks,
  getTaskById,
  getAttachmentById,
  deleteAttachmentById,
  updateTask,
  deleteTask,
  getColumns,
} from "../controllers/emergencyProtocolsController.js";

import { protect } from "../middleware/auth.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

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
router.get("/attachments/:id", protect, safe(getAttachmentById));
router.delete("/attachments/:id", protect, safe(deleteAttachmentById));

router.post("/", protect, upload.array('photos', 10), safe(createTask));
router.get("/", protect, safe(listTasks));
// Add columns endpoint for frontend polling (must be before /:id)
router.get("/columns", protect, safe(getColumns));
router.get("/:id", protect, safe(getTaskById));
router.put("/:id", protect, upload.array('photos', 10), safe(updateTask));
router.delete("/:id", protect, safe(deleteTask));

export default router;
