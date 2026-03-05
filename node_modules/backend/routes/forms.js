// routes/forms.js
import express from "express";
import { protect } from "../middleware/auth.js";
import {
  createForm,
  listForms,
  getForm,
  submitFormData,
  getSubmissions,
  deleteForm,
} from "../controllers/formsController.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * POST /api/forms
 * Create a new form (admin/manager only)
 */
router.post("/", async (req, res) => {
  if (!req.user || !["admin", "manager"].includes(req.user.role)) {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }
  return createForm(req, res);
});

/**
 * GET /api/forms
 * List all forms (admin/manager can view)
 */
router.get("/", async (req, res) => {
  if (!req.user || !["admin", "manager"].includes(req.user.role)) {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }
  return listForms(req, res);
});

/**
 * GET /api/forms/:formId
 * Get form schema by ID
 */
router.get("/:formId", getForm);

/**
 * POST /api/forms/:formId/submit
 * Submit form data (any authenticated user)
 */
router.post("/:formId/submit", submitFormData);

/**
 * GET /api/forms/:formId/submissions
 * Get all submissions for a form (admin/manager can view)
 */
router.get("/:formId/submissions", async (req, res) => {
  if (!req.user || !["admin", "manager"].includes(req.user.role)) {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }
  return getSubmissions(req, res);
});

/**
 * DELETE /api/forms/:formId
 * Delete a form (admin/manager only)
 */
router.delete("/:formId", async (req, res) => {
  if (!req.user || !["admin", "manager"].includes(req.user.role)) {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }
  return deleteForm(req, res);
});

export default router;
