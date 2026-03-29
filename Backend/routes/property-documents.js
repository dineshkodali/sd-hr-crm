import express from "express";
import pool from "../config/db.js";
import { protect, requireRole } from "../middleware/auth.js";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, "-");
    cb(null, `prop-doc-${Date.now()}-${base}${ext}`);
  },
});
const upload = multer({ storage });

const router = express.Router({ mergeParams: true });

// GET all documents for a property
router.get("/:propertyId", protect, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const result = await pool.query(
      "SELECT id, property_id, document_type, file_name, file_url, uploaded_by, created_at FROM property_documents WHERE property_id = $1 ORDER BY created_at DESC",
      [propertyId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GET /api/property-documents error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST upload new document
router.post("/:propertyId", protect, requireRole(['admin', 'manager', 'housing_officer', 'staff']), upload.single("document"), async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { document_type } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    
    if (!document_type) {
        return res.status(400).json({ error: "document_type is required" });
    }

    const file_url = `/uploads/${req.file.filename}`;
    const file_name = req.file.originalname;

    const result = await pool.query(
      `INSERT INTO property_documents (property_id, document_type, file_name, file_url, uploaded_by) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [propertyId, document_type, file_name, file_url, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /api/property-documents error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE document
router.delete("/:id", protect, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const docQuery = await pool.query("SELECT file_url FROM property_documents WHERE id = $1", [id]);
    if (docQuery.rows.length > 0) {
      const fileUrl = docQuery.rows[0].file_url;
      const fileName = path.basename(fileUrl);
      const filePath = path.join(UPLOAD_DIR, fileName);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await pool.query("DELETE FROM property_documents WHERE id = $1", [id]);
    res.json({ message: "Document deleted successfully" });
  } catch (err) {
    console.error("DELETE /api/property-documents error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
