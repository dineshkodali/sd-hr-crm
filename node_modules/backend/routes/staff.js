// backend/routes/staff.js
import express from "express";
import pool from "../config/db.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

/** Sanitize identifier names to safe SQL identifiers (letters, numbers, underscore; start with letter/_). */
function sanitizeIdentifier(name) {
  if (!name || typeof name !== "string") return null;
  const cleaned = name.trim();
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(cleaned)) return cleaned;
  return null;
}

/** Detect a column on 'users' table by checking a list of candidate names. Returns actual column_name or null. */
async function detectUsersColumnByCandidates(candidates = []) {
  for (const cand of candidates) {
    try {
      const q = `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'users' AND lower(column_name) = lower($1)
        LIMIT 1
      `;
      const r = await pool.query(q, [cand]);
      if (r.rows && r.rows.length) {
        const actual = r.rows[0].column_name;
        const safe = sanitizeIdentifier(actual);
        if (safe) return safe;
      }
    } catch (err) {
      console.warn("detectUsersColumnByCandidates failed for", cand, err?.message || err);
    }
  }
  return null;
}

/** Check if a given users column is numeric-type (int/ bigint / numeric etc.). */
async function isUsersColumnNumeric(colName) {
  if (!colName) return false;
  try {
    const q =
      "SELECT data_type FROM information_schema.columns WHERE table_name='users' AND lower(column_name)=lower($1) LIMIT 1";
    const r = await pool.query(q, [colName]);
    const dt = r.rows?.[0]?.data_type;
    if (!dt) return false;
    return /int|numeric|decimal|bigint|smallint|real|double/i.test(dt);
  } catch (err) {
    console.warn("isUsersColumnNumeric failed:", err?.message || err);
    return false;
  }
}

/** Convenience detectors for hotel and manager columns in users table */
async function detectUsersHotelColumn() {
  return detectUsersColumnByCandidates(["hotel_id", "hotelId", "hotel", "hotelid"]);
}
async function detectUsersManagerColumn() {
  return detectUsersColumnByCandidates(["manager_id", "managerId", "manager", "managerid"]);
}

/**
 * GET /api/staff
 * Returns users (staff/managers) filtered by role and branch.
 * - manager: restrict to manager's branch
 * - admin: optionally filter by ?branch=
 * - other: restrict to user's branch
 *
 * Includes hotel_id (if users table has such column) and manager column (if present) in the SELECT results.
 */
router.get("/", protect, async (req, res) => {
  try {
    const cur = req.user || {};
    const qBranch = req.query.branch;

    const hotelCol = await detectUsersHotelColumn();
    const hotelColIsNumeric = await isUsersColumnNumeric(hotelCol);
    const managerCol = await detectUsersManagerColumn();
    const managerColIsNumeric = await isUsersColumnNumeric(managerCol);

    const baseFields = ["id", "name", "email", "role", "branch", "avatar"];
    const selectParts = baseFields.map(f => `"${f.replace(/"/g, '""')}"`);

    if (hotelCol) {
      const cast = hotelColIsNumeric ? `"${hotelCol}"::int` : `"${hotelCol}"::text`;
      selectParts.push(`${cast} AS hotel_id`);
    }
    if (managerCol) {
      const castMgr = managerColIsNumeric ? `"${managerCol}"::int` : `"${managerCol}"::text`;
      selectParts.push(`${castMgr} AS manager_col`);
    }

    // only include staff/manager roles (or null)
    let sql = `SELECT ${selectParts.join(", ")} FROM users WHERE (role IS NULL OR role IN ('staff','manager'))`;
    const params = [];
    let idx = 1;

    if (cur.role === "manager") {
      if (!cur.branch) return res.json({ users: [] });
      sql += ` AND "branch" = $${idx++}`;
      params.push(cur.branch);
    } else if (cur.role === "admin") {
      if (typeof qBranch !== "undefined" && qBranch !== null && String(qBranch).trim() !== "") {
        sql += ` AND "branch" = $${idx++}`;
        params.push(qBranch);
      }
    } else {
      // staff/other: restrict to user's branch
      if (!cur.branch) return res.json({ users: [] });
      sql += ` AND "branch" = $${idx++}`;
      params.push(cur.branch);
    }

    sql += ` ORDER BY role NULLS LAST, name LIMIT 1000`;

    const result = await pool.query(sql, params);
    return res.json({ users: result.rows || [] });
  } catch (err) {
    console.error("GET /api/staff error:", err?.message || err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /api/staff/for-hotel/:hotelId
 * Tolerant handler that returns staff relevant to a hotel.
 * Priority:
 *   1) users with same branch as hotel.branch (if hotel.branch exists)
 *   2) users where users.<manager_col> = hotel.manager_id (if users manager column exists AND hotel.manager_id present)
 *   3) users where users.<hotel_col> = hotel.id (if hotel_col exists)
 *   4) fallback: all users with role staff/user limited set
 *
 * The handler will NOT reference columns that do not exist.
 */
router.get("/for-hotel/:hotelId", protect, async (req, res) => {
  try {
    const hotelId = req.params.hotelId;
    if (!hotelId) return res.status(400).json({ message: "hotelId required" });

    // fetch hotel (we rely on hotels table having id; branch & manager_id may or may not be present)
    const hotelQ = await pool.query("SELECT id, branch, manager_id FROM hotels WHERE id = $1 LIMIT 1", [hotelId]);
    if (!hotelQ.rows.length) return res.status(404).json({ message: "Hotel not found" });
    const hotel = hotelQ.rows[0];

    // detect optional columns on users
    const hotelCol = await detectUsersHotelColumn();
    const hotelColIsNumeric = await isUsersColumnNumeric(hotelCol);
    const managerCol = await detectUsersManagerColumn();
    const managerColIsNumeric = await isUsersColumnNumeric(managerCol);

    let users = [];

    // 1) Try branch match
    if (hotel.branch) {
      try {
        const r = await pool.query(
          `SELECT id, name, email, role, avatar, branch${managerCol ? `, "${managerCol}" AS manager_col` : ""}${hotelCol ? `, ${hotelColIsNumeric ? `"${hotelCol}"::int` : `"${hotelCol}"::text`} AS hotel_id` : "" }
           FROM users
           WHERE branch = $1
           ORDER BY name
           LIMIT 200`,
          [hotel.branch]
        );
        users = r.rows || [];
      } catch (err) {
        console.warn("branch lookup failed:", err?.message || err);
      }
    }

    // 2) Try manager-based lookup (only if there's a managerCol in users and hotel.manager_id exists)
    if ((!users || users.length === 0) && managerCol && hotel.manager_id) {
      try {
        // safe identifier usage: managerCol is sanitized earlier
        const comp = managerColIsNumeric ? `"${managerCol}" = $1::int` : `"${managerCol}" = $1::text`;
        const mgrSelectExtra = hotelCol ? `, ${hotelColIsNumeric ? `"${hotelCol}"::int` : `"${hotelCol}"::text`} AS hotel_id` : "";
        const q = `
          SELECT id, name, email, role, avatar, branch ${managerCol ? `, "${managerCol}" AS manager_col` : ""} ${mgrSelectExtra}
          FROM users
          WHERE ${comp}
          ORDER BY name
          LIMIT 200
        `;
        const r2 = await pool.query(q, [hotel.manager_id]);
        users = r2.rows || [];
      } catch (err2) {
        console.warn("manager lookup failed:", err2?.message || err2);
      }
    }

    // 3) Try matching users.<hotelCol> = hotelId if hotelCol exists
    if ((!users || users.length === 0) && hotelCol) {
      try {
        const comp = hotelColIsNumeric ? `"${hotelCol}" = $1::int` : `"${hotelCol}" = $1::text`;
        const q = `
          SELECT id, name, email, role, avatar, branch ${managerCol ? `, "${managerCol}" AS manager_col` : ""}, ${hotelColIsNumeric ? `"${hotelCol}"::int` : `"${hotelCol}"::text`} AS hotel_id
          FROM users
          WHERE ${comp}
          ORDER BY name
          LIMIT 200
        `;
        const r3 = await pool.query(q, [hotelId]);
        users = r3.rows || [];
      } catch (err3) {
        console.warn("hotel-column lookup failed:", err3?.message || err3);
      }
    }

    // 4) Fallback: staff list
    if ((!users || users.length === 0)) {
      try {
        const rf = await pool.query(
          `SELECT id, name, email, role, avatar, branch ${managerCol ? `, "${managerCol}" AS manager_col` : ""} 
           FROM users
           WHERE role = 'staff' OR role = 'user'
           ORDER BY name
           LIMIT 200`
        );
        users = rf.rows || [];
      } catch (errFinal) {
        console.warn("final staff fallback failed:", errFinal?.message || errFinal);
        users = [];
      }
    }

    const normalized = (users || []).map(u => ({
      id: u.id,
      name: u.name || u.email || "Unknown",
      email: u.email || null,
      role: u.role || "staff",
      avatar: u.avatar || null,
      branch: u.branch || null,
      // manager_col and hotel_id may or may not exist depending on detection above
      manager_id: (u.manager_col !== undefined) ? u.manager_col : null,
      hotel_id: (u.hotel_id !== undefined) ? u.hotel_id : null
    }));

    return res.json({ staff: normalized });
  } catch (err) {
    console.error("GET /api/staff/for-hotel/:hotelId error:", err?.message || err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
