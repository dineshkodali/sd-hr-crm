// routes/payroll.js
import express from "express";
import {
  createTask,
  listTasks,
  getTaskById,
  updateTask,
  deleteTask,
} from "../controllers/payrollController.js";

import { protect } from "../middleware/auth.js";
import { applyCrudLogging } from "../middleware/activityMiddleware.js"; // Enhanced logging

const router = express.Router();


// Apply CRUD logging to all operations
applyCrudLogging(router, 'payroll', 'payroll');
// safe wrapper
const safe = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    console.error("\n❌ PAYROLL ROUTE ERROR:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Internal Server Error",
    });
  }
};

// POST   /api/payroll
router.post("/", protect, safe(createTask));
// GET    /api/payroll
router.get("/", protect, safe(listTasks));
// GET    /api/payroll/:id
router.get("/:id", protect, safe(getTaskById));
// PUT    /api/payroll/:id
router.put("/:id", protect, safe(updateTask));
// DELETE /api/payroll/:id
router.delete("/:id", protect, safe(deleteTask));

export default router;


