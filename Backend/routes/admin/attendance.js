/**
 * backend/routes/admin/attendance.js
 *
 * Postgres-friendly attendance admin routes which auto-detect database column names
 * to avoid "column does not exist" errors when your schema uses different names
 * (e.g. staff_id / employee_id / user_id).
 *
 * Endpoints:
 *  GET    /api/admin/attendance
 *  GET    /api/admin/attendance/stats
 *  GET    /api/admin/attendance/:id
 *  POST   /api/admin/attendance
 *  PUT    /api/admin/attendance/:id
 *  DELETE /api/admin/attendance/:id
 *  GET    /api/admin/attendance/export/csv
 *
 * Notes:
 *  - Requires ../../config/db.js (pg pool) and ../../middleware/auth.js (protect).
 *  - The router applies protect() to all routes (router.use(protect)).
 */

import express from "express";
import pool from "../../config/db.js";
import { protect } from "../../middleware/auth.js";

const router = express.Router();
router.use(protect);

/* ------------------------
   Helpers: detect column names in DB schema
   ------------------------ */
async function detectColumn(tableName, candidates = []) {
  if (!tableName || !Array.isArray(candidates) || candidates.length === 0) return null;
  try {
    for (const col of candidates) {
      const r = await pool.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2 LIMIT 1`,
        [tableName, col]
      );
      if (r && r.rows && r.rows.length) return col;
    }
  } catch (err) {
    console.warn("detectColumn error:", err && err.message ? err.message : err);
  }
  return null;
}

/* Run query helper (normalizes pg response) */
async function runQuery(sql, params = []) {
  try {
    const r = await pool.query(sql, params);
    // pg returns { rows }, normalize
    return r && r.rows ? r.rows : [];
  } catch (err) {
    // rethrow to allow caller to log/respond
    throw err;
  }
}

/* Build WHERE clause and params dynamically using detected attendance-user column */
async function buildWhereAndParamsPgDynamic(query, startParamIndex = 1, attendanceUserCol = "user_id", usersDeptCol = null) {
  const parts = [];
  const params = [];
  let idx = startParamIndex;

  const start = query.start || null;
  const end = query.end || null;

  if (start && end) {
    parts.push(`a.date BETWEEN $${idx} AND $${idx + 1}`);
    params.push(start, end);
    idx += 2;
  } else if (start) {
    parts.push(`a.date >= $${idx}`);
    params.push(start);
    idx += 1;
  } else if (end) {
    parts.push(`a.date <= $${idx}`);
    params.push(end);
    idx += 1;
  }

  if (query.dept && usersDeptCol) {
    parts.push(`u.${usersDeptCol} = $${idx}`);
    params.push(query.dept);
    idx += 1;
  }

  if (query.userId) {
    // map query.userId to whichever attendance column exists
    parts.push(`a.${attendanceUserCol} = $${idx}`);
    params.push(query.userId);
    idx += 1;
  }

  if (query.status) {
    parts.push(`LOWER(a.status) = LOWER($${idx})`);
    params.push(query.status);
    idx += 1;
  }

  return { whereClause: parts.length ? `WHERE ${parts.join(" AND ")}` : "", params, nextIndex: idx };
}

/* ------------------------
   Runtime-detect schema columns — cached per process for performance
   ------------------------ */
let DETECT_CACHE = {
  attendanceUserCol: null, // e.g. 'user_id' | 'employee_id' | 'staff_id'
  usersDeptCol: null, // e.g. 'department'
  usersAvatarCol: null, // avatar column name if present
  attendanceIsHolidayCol: null, // e.g. 'is_holiday'
  attendanceIsHalfdayCol: null, // e.g. 'is_halfday'
};

async function ensureDetected() {
  if (DETECT_CACHE.attendanceUserCol !== null) return DETECT_CACHE;

  // possible names for attendance user reference
  const attCandidates = ["user_id", "employee_id", "staff_id", "staffId", "employeeId"];
  const usersDeptCandidates = ["department", "dept", "department_name"];
  const usersAvatarCandidates = ["avatar", "avatar_url", "photo", "profile_pic"];
  const holidayCandidates = ["is_holiday", "isHoliday", "holiday", "holiday_flag"];
  const halfdayCandidates = ["is_halfday", "isHalfday", "halfday", "is_half_day"];

  try {
    const [
      attendanceUserCol,
      usersDeptCol,
      usersAvatarCol,
      attendanceIsHolidayCol,
      attendanceIsHalfdayCol,
    ] = await Promise.all([
      detectColumn("attendance", attCandidates),
      detectColumn("users", usersDeptCandidates),
      detectColumn("users", usersAvatarCandidates),
      detectColumn("attendance", holidayCandidates),
      detectColumn("attendance", halfdayCandidates),
    ]);

    // fallback default to 'user_id' if nothing detected (so older schema still works)
    DETECT_CACHE.attendanceUserCol = attendanceUserCol || "user_id";
    DETECT_CACHE.usersDeptCol = usersDeptCol || null;
    DETECT_CACHE.usersAvatarCol = usersAvatarCol || null;
    DETECT_CACHE.attendanceIsHolidayCol = attendanceIsHolidayCol || null;
    DETECT_CACHE.attendanceIsHalfdayCol = attendanceIsHalfdayCol || null;
  } catch (err) {
    // keep safe defaults
    DETECT_CACHE.attendanceUserCol = "user_id";
    DETECT_CACHE.usersDeptCol = null;
    DETECT_CACHE.usersAvatarCol = null;
    DETECT_CACHE.attendanceIsHolidayCol = null;
    DETECT_CACHE.attendanceIsHalfdayCol = null;
  }
  return DETECT_CACHE;
}

/* ------------------------
   Routes
   ------------------------ */

/**
 * GET / -> list attendance rows + pagination
 * Query params: start, end, dept, userId, status, limit, offset, includeCount=1
 */
router.get("/", async (req, res) => {
  try {
    const qLimit = Math.min(parseInt(req.query.limit || "200", 10), 2000);
    const qOffset = Math.max(parseInt(req.query.offset || "0", 10), 0);

    const detected = await ensureDetected();
    const attendanceUserCol = detected.attendanceUserCol;
    const usersDeptCol = detected.usersDeptCol;
    const usersAvatarCol = detected.usersAvatarCol;

    const built = await buildWhereAndParamsPgDynamic(req.query, 1, attendanceUserCol, usersDeptCol);
    const whereClause = built.whereClause;
    const baseParams = built.params;

    // Build SELECT with detected column names aliased to stable names for frontend
    // select attendance user id as staff_id (stable alias)
    const selectUserIdExpr = `a.${attendanceUserCol} AS staff_id`;
    const avatarExpr = usersAvatarCol ? `COALESCE(u.${usersAvatarCol}, '') AS avatar` : `COALESCE(u.avatar, '') AS avatar`;

    // department may not exist in users table — avoid referencing if absent by using COALESCE('') in select only when present
    const deptSelect = usersDeptCol ? `COALESCE(u.${usersDeptCol}, '') AS department` : `'' AS department`;

    const q = `
      SELECT
        a.id,
        ${selectUserIdExpr},
        COALESCE(u.name, '') AS name,
        ${deptSelect},
        ${avatarExpr},
        a.status,
        to_char(a.check_in, 'HH12:MI AM') as check_in,
        to_char(a.check_out, 'HH12:MI AM') as check_out,
        COALESCE(a.break_minutes,0)::int as break_minutes,
        COALESCE(a.late_minutes,0)::int as late_minutes,
        COALESCE(a.production_hours,0)::numeric as production_hours,
        COALESCE(a.notes, '') as notes,
        to_char(a.date, 'YYYY-MM-DD') as date
      FROM attendance a
      LEFT JOIN users u ON u.id = a.${attendanceUserCol}
      ${whereClause}
      ORDER BY a.date DESC, COALESCE(u.name,'') ASC
      LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}
    `;

    const params = [...baseParams, qLimit, qOffset];
    const rows = await runQuery(q, params);

    // includeCount optional
    let total = rows.length;
    if (req.query.includeCount === "1") {
      const countSql = `
        SELECT COUNT(*)::int AS total
        FROM attendance a
        LEFT JOIN users u ON u.id = a.${attendanceUserCol}
        ${whereClause}
      `;
      const countRows = await runQuery(countSql, baseParams);
      if (countRows && countRows[0] && typeof countRows[0].total !== "undefined") {
        total = Number(countRows[0].total);
      }
    }

    // stats (grouped counts by status) using same whereClause
    const statsQ = `
      SELECT LOWER(a.status) as status, COUNT(*)::int as cnt
      FROM attendance a
      LEFT JOIN users u ON u.id = a.${attendanceUserCol}
      ${whereClause}
      GROUP BY LOWER(a.status)
    `;
    const statsRows = await runQuery(statsQ, baseParams);

    const stats = {
      total: 0,
      present: 0,
      late: 0,
      uninformed: 0,
      permission: 0,
      absent: 0,
      remote: 0,
      on_leave: 0,
    };

    for (const r of statsRows) {
      const s = (r.status || "").toLowerCase();
      const cnt = Number(r.cnt || 0);
      stats.total += cnt;
      if (s === "present") stats.present = cnt;
      else if (s === "late") stats.late = cnt;
      else if (s === "uninformed") stats.uninformed = cnt;
      else if (s === "permission" || s === "permitted") stats.permission = cnt;
      else if (s === "absent") stats.absent = cnt;
      else if (s === "remote") stats.remote = cnt;
      else if (s === "on_leave" || s === "leave") stats.on_leave = cnt;
    }

    return res.json({ meta: { limit: qLimit, offset: qOffset, total }, stats, rows });
  } catch (err) {
    console.error("GET /api/admin/attendance error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ message: "Server error fetching attendance" });
  }
});

/**
 * GET /stats -> aggregated counts by status for the range
 */
router.get("/stats", async (req, res) => {
  try {
    const detected = await ensureDetected();
    const attendanceUserCol = detected.attendanceUserCol;
    const usersDeptCol = detected.usersDeptCol;

    const built = await buildWhereAndParamsPgDynamic(req.query, 1, attendanceUserCol, usersDeptCol);
    const whereClause = built.whereClause;
    const params = built.params;

    const q = `
      SELECT LOWER(a.status) as status, COUNT(*)::int as cnt
      FROM attendance a
      LEFT JOIN users u ON u.id = a.${attendanceUserCol}
      ${whereClause}
      GROUP BY LOWER(a.status)
    `;
    const rows = await runQuery(q, params);

    const stats = {
      total: 0,
      present: 0,
      late: 0,
      uninformed: 0,
      permission: 0,
      absent: 0,
      remote: 0,
      on_leave: 0,
    };

    for (const r of rows) {
      const s = (r.status || "").toLowerCase();
      const cnt = Number(r.cnt || 0);
      stats.total += cnt;
      if (s === "present") stats.present = cnt;
      else if (s === "late") stats.late = cnt;
      else if (s === "uninformed") stats.uninformed = cnt;
      else if (s === "permission" || s === "permitted") stats.permission = cnt;
      else if (s === "absent") stats.absent = cnt;
      else if (s === "remote") stats.remote = cnt;
      else if (s === "on_leave" || s === "leave") stats.on_leave = cnt;
    }

    return res.json({ stats });
  } catch (err) {
    console.error("GET /api/admin/attendance/stats error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /:id -> single attendance record
 */
router.get("/:id", async (req, res) => {
  try {
    const detected = await ensureDetected();
    const attendanceUserCol = detected.attendanceUserCol;
    const usersDeptCol = detected.usersDeptCol;
    const usersAvatarCol = detected.usersAvatarCol;

    const avatarExpr = usersAvatarCol ? `COALESCE(u.${usersAvatarCol}, '') AS avatar` : `COALESCE(u.avatar, '') AS avatar`;
    const deptSelect = usersDeptCol ? `COALESCE(u.${usersDeptCol}, '') AS department` : `'' AS department`;

    const q = `
      SELECT a.*,
             COALESCE(u.name,'') as name,
             ${deptSelect},
             ${avatarExpr},
             to_char(a.date, 'YYYY-MM-DD') as date,
             to_char(a.check_in, 'HH24:MI:SS') as check_in_raw,
             to_char(a.check_out, 'HH24:MI:SS') as check_out_raw
      FROM attendance a
      LEFT JOIN users u ON u.id = a.${attendanceUserCol}
      WHERE a.id = $1
      LIMIT 1
    `;
    const rows = await runQuery(q, [req.params.id]);
    if (!rows || rows.length === 0) return res.status(404).json({ message: "Attendance record not found" });
    return res.json(rows[0]);
  } catch (err) {
    console.error("GET /api/admin/attendance/:id error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST / -> create attendance record
 */
router.post("/", async (req, res) => {
  try {
    // Accept body keys - map to DB columns expecting standard names.
    // If your attendance table uses different column names you will need to pass keys that match DB.
    const {
      user_id,
      employee_id,
      staff_id,
      date,
      status = "present",
      check_in = null,
      check_out = null,
      break_minutes = 0,
      late_minutes = 0,
      production_hours = 0,
      notes = null,
    } = req.body || {};

    // determine which id to use from client: prefer staff_id, then employee_id, then user_id
    const providedUser = staff_id ?? employee_id ?? user_id;
    if (!providedUser || !date) return res.status(400).json({ message: "staff_id (or employee_id/user_id) and date are required" });

    // Insert using the canonical attendance column name detected earlier
    const detected = await ensureDetected();
    const attendanceUserCol = detected.attendanceUserCol;

    // Build dynamic INSERT (list of columns + params)
    const columns = [attendanceUserCol, "date", "status", "check_in", "check_out", "break_minutes", "late_minutes", "production_hours", "notes", "created_at"];
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
    const insertSql = `
      INSERT INTO attendance (${columns.join(", ")})
      VALUES (${placeholders})
      RETURNING id
    `;
    const insertParams = [
      providedUser,
      date,
      status,
      check_in,
      check_out,
      Number(break_minutes || 0),
      Number(late_minutes || 0),
      Number(production_hours || 0),
      notes,
      new Date(),
    ];
    const insertRes = await runQuery(insertSql, insertParams);
    const newId = insertRes && insertRes[0] && insertRes[0].id;
    if (!newId) return res.status(500).json({ message: "Failed to create attendance" });

    // return created record (select using detected user col)
    const [created] = await runQuery(
      `SELECT a.*, COALESCE(u.name,'') as name, ${detected.usersDeptCol ? `COALESCE(u.${detected.usersDeptCol},'') as department` : "'' as department"} FROM attendance a LEFT JOIN users u ON u.id = a.${attendanceUserCol} WHERE a.id = $1 LIMIT 1`,
      [newId]
    );

    return res.status(201).json(created || {});
  } catch (err) {
    console.error("POST /api/admin/attendance error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ message: "Server error creating attendance" });
  }
});

/**
 * PUT /:id -> update attendance record (partial allowed)
 */
router.put("/:id", async (req, res) => {
  try {
    const allowed = [
      "user_id",
      "employee_id",
      "staff_id",
      "date",
      "status",
      "check_in",
      "check_out",
      "break_minutes",
      "late_minutes",
      "production_hours",
      "notes",
    ];

    const detected = await ensureDetected();
    const attendanceUserCol = detected.attendanceUserCol;

    // Build updates mapping any of user id keys to the detected attendance user column
    const fields = [];
    const params = [];
    let idx = 1;

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        // map incoming user id keys to actual attendance column
        if (["user_id", "employee_id", "staff_id"].includes(key)) {
          fields.push(`${attendanceUserCol} = $${idx}`);
        } else {
          fields.push(`${key} = $${idx}`);
        }
        params.push(req.body[key]);
        idx++;
      }
    }

    if (fields.length === 0) return res.status(400).json({ message: "No valid fields to update" });

    // append id param
    params.push(req.params.id);
    const q = `UPDATE attendance SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${idx} RETURNING id`;
    const r = await runQuery(q, params);

    if (!r || r.length === 0) return res.status(404).json({ message: "Attendance record not found" });

    const [row] = await runQuery(`SELECT * FROM attendance WHERE id = $1 LIMIT 1`, [req.params.id]);
    return res.json(row || {});
  } catch (err) {
    console.error("PUT /api/admin/attendance/:id error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ message: "Server error updating attendance" });
  }
});

/**
 * DELETE /:id -> delete attendance record
 */
router.delete("/:id", async (req, res) => {
  try {
    await runQuery("DELETE FROM attendance WHERE id = $1", [req.params.id]);
    return res.json({ message: "Deleted" });
  } catch (err) {
    console.error("DELETE /api/admin/attendance/:id error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /export/csv -> CSV export
 */
router.get("/export/csv", async (req, res) => {
  try {
    const detected = await ensureDetected();
    const attendanceUserCol = detected.attendanceUserCol;
    const usersDeptCol = detected.usersDeptCol;
    const usersAvatarCol = detected.usersAvatarCol;

    const built = await buildWhereAndParamsPgDynamic(req.query, 1, attendanceUserCol, usersDeptCol);
    const whereClause = built.whereClause;
    const params = built.params;

    const userIdSelect = `a.${attendanceUserCol} AS staff_id`;
    const deptSelect = usersDeptCol ? `COALESCE(u.${usersDeptCol}, '') as department` : `'' as department`;

    const q = `
      SELECT
        a.id,
        ${userIdSelect},
        COALESCE(u.name,'') as user_name,
        ${deptSelect},
        to_char(a.date,'YYYY-MM-DD') as date,
        a.status,
        to_char(a.check_in,'HH24:MI:SS') as check_in,
        to_char(a.check_out,'HH24:MI:SS') as check_out,
        COALESCE(a.break_minutes,0)::int as break_minutes,
        COALESCE(a.late_minutes,0)::int as late_minutes,
        COALESCE(a.production_hours,0)::numeric as production_hours,
        COALESCE(a.notes,'') as notes
      FROM attendance a
      LEFT JOIN users u ON u.id = a.${attendanceUserCol}
      ${whereClause}
      ORDER BY a.date DESC, COALESCE(u.name,'') ASC
      LIMIT 20000
    `;

    const rows = await runQuery(q, params);

    // Build CSV
    const header = [
      "id",
      "staff_id",
      "user_name",
      "department",
      "date",
      "status",
      "check_in",
      "check_out",
      "break_minutes",
      "late_minutes",
      "production_hours",
      "notes",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      const row = header.map((h) => {
        let v = r[h] !== undefined ? r[h] : r[h.toLowerCase()];
        if (v === null || v === undefined) v = "";
        v = String(v).replace(/"/g, '""');
        if (/,|\n|"/.test(v)) return `"${v}"`;
        return v;
      });
      lines.push(row.join(","));
    }

    const filename = `attendance-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(lines.join("\n"));
  } catch (err) {
    console.error("GET /api/admin/attendance/export error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ message: "Server error exporting attendance" });
  }
});

export default router;
