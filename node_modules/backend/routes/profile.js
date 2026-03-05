// Backend/routes/profile.js
import express from "express";
import pool from "../config/db.js";
import { protect } from "../middleware/auth.js";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, "-");
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});
const upload = multer({ storage });

const router = express.Router();

/**
 * Helper: build synthetic admin profile from env
 */
function syntheticAdminProfile() {
  return {
    id: "admin-synthetic",
    name: process.env.ADMIN_NAME || "Site Admin",
    email: process.env.ADMIN_EMAIL || "admin@example.com",
    role: "admin",
    branch: process.env.ADMIN_BRANCH || null,
    phone: process.env.ADMIN_PHONE || null,
    gender: null,
    dob: null,
    nationality: null,
    religion: null,
    marital_status: null,
    address: null,
    city: null,
    state: null,
    country: null,
    resume_url: null,
    created_at: null,
  };
}

/**
 * detectUsersHotelColumn
 * Same candidate list as manager code — returns the actual column name or null.
 * We keep this local because it avoids circular imports and is cheap to run.
 */
async function detectUsersHotelColumn() {
  const candidates = ["hotel_id", "hotelId", "hotel", "hotelid"];
  for (const col of candidates) {
    try {
      const r = await pool.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = $1 LIMIT 1`,
        [col]
      );
      if (r.rows && r.rows.length) return col;
    } catch (err) {
      // ignore and continue
      console.warn("detectUsersHotelColumn check failed for", col, err && err.message);
    }
  }
  return null;
}

/**
 * GET /api/profile
 * Returns user's profile (protected)
 */
router.get("/", protect, async (req, res) => {
  try {
    // If synthetic admin (dev), return env-based profile instead of querying DB
    if (req.user && req.user.id === "admin-synthetic") {
      return res.json({ profile: syntheticAdminProfile() });
    }

    const id = req.user.id;

    // Detect possible hotel assignment column and include it as hotel_id if present
    const hotelCol = await detectUsersHotelColumn();
    const fields = [
      "id","name","email","role","branch","phone","gender","dob","nationality","religion",
      "marital_status","address","city","state","country","resume_url","created_at"
    ];
    if (hotelCol) {
      fields.push(`"${hotelCol}" as hotel_id`);
    }

    const q = `SELECT ${fields.join(", ")} FROM users WHERE id = $1`;
    const r = await pool.query(q, [id]);
    if (!r.rows.length) return res.status(404).json({ message: "Profile not found" });
    return res.json({ profile: r.rows[0] });
  } catch (err) {
    console.error("GET /api/profile error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * PUT /api/profile
 * Update user's profile fields (protected)
 */
router.put("/", protect, async (req, res) => {
  try {
    // If synthetic admin, don't touch DB — just return a merged object and a warning
    if (req.user && req.user.id === "admin-synthetic") {
      const base = syntheticAdminProfile();
      const payload = req.body || {};
      const merged = { ...base, ...payload };
      return res.json({
        profile: merged,
        message:
          "Synthetic admin profile - changes are not persisted to database in this development mode.",
      });
    }

    const id = req.user.id;
    const {
      name,
      phone,
      gender,
      dob,
      nationality,
      religion,
      marital_status,
      address,
      city,
      state,
      country,
    } = req.body;

    const q = `UPDATE users SET
                name = COALESCE($1, name),
                phone = COALESCE($2, phone),
                gender = COALESCE($3, gender),
                dob = COALESCE($4, dob),
                nationality = COALESCE($5, nationality),
                religion = COALESCE($6, religion),
                marital_status = COALESCE($7, marital_status),
                address = COALESCE($8, address),
                city = COALESCE($9, city),
                state = COALESCE($10, state),
                country = COALESCE($11, country),
                updated_at = NOW()
             WHERE id = $12
             RETURNING id, name, email, role, branch, phone, gender, dob, nationality, religion, marital_status, address, city, state, country, resume_url, created_at`;

    const values = [
      name || null,
      phone || null,
      gender || null,
      dob || null,
      nationality || null,
      religion || null,
      marital_status || null,
      address || null,
      city || null,
      state || null,
      country || null,
      id,
    ];

    const r = await pool.query(q, values);
    return res.json({ profile: r.rows[0] });
  } catch (err) {
    console.error("PUT /api/profile error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/profile/resume
 * Upload resume file (multipart/form-data) field name: 'resume'
 * Returns resume_url
 */
router.post("/resume", protect, upload.single("resume"), async (req, res) => {
  try {
    // Disallow resume upload for synthetic admin (no DB row)
    if (req.user && req.user.id === "admin-synthetic") {
      // we allowed GET/PUT to return synthetic responses, but file persistence to DB is unsupported
      return res
        .status(400)
        .json({ message: "Uploads disabled for synthetic admin account in development mode." });
    }

    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const resumeUrl = `/uploads/${req.file.filename}`;

    const r = await pool.query("UPDATE users SET resume_url = $1 WHERE id = $2 RETURNING resume_url", [
      resumeUrl,
      req.user.id,
    ]);

    return res.json({ resume_url: r.rows[0].resume_url });
  } catch (err) {
    console.error("POST /api/profile/resume error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
