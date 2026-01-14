// backend/routes/rooms.js
import express from "express";
import pool from "../config/db.js";
import { protect } from "../middleware/auth.js";

const router = express.Router({ mergeParams: true }); // <- important: reads :hotelId from parent mount

/**
 * Helper: check whether the current authenticated user may manage rooms
 * for the provided hotelId.
 *
 * Rules:
 * - admin: always allowed
 * - manager: allowed if hotels.manager_id === req.user.id
 * - staff: allowed if either
 *     - req.user.hotel_id === hotelId (explicit assignment), OR
 *     - req.user.branch exists and equals the hotel's branch (branch-level access)
 */
async function canManageHotel(reqUser, hotelId) {
  if (!reqUser) return false;

  // admin has full rights
  if (reqUser.role === "admin") return true;

  // manager must be the manager of hotel
  if (reqUser.role === "manager") {
    try {
      const r = await pool.query("SELECT manager_id FROM hotels WHERE id = $1 LIMIT 1", [hotelId]);
      if (!r.rows.length) return false;
      return String(r.rows[0].manager_id) === String(reqUser.id);
    } catch (err) {
      console.error("canManageHotel (manager) error:", err);
      return false;
    }
  }

  // staff may manage if assigned to that hotel or if branch matches hotel's branch
  if (reqUser.role === "staff") {
    try {
      // explicit hotel assignment check (users.hotel_id)
      const userHotelId = reqUser.hotel_id || reqUser.hotelId || reqUser.hotel || null;
      if (userHotelId && String(userHotelId) === String(hotelId)) return true;

      // branch-level access
      if (reqUser.branch) {
        const r = await pool.query("SELECT branch FROM hotels WHERE id = $1 LIMIT 1", [hotelId]);
        if (!r.rows.length) return false;
        const hotelBranch = r.rows[0].branch;
        if (hotelBranch && String(hotelBranch) === String(reqUser.branch)) return true;
      }

      return false;
    } catch (err) {
      console.error("canManageHotel (staff) error:", err);
      return false;
    }
  }

  // other roles: not allowed
  return false;
}

/**
 * Routes are relative to mount:
 * mountRoute("/api/hotels/:hotelId/rooms", roomsRoutes, "roomsRoutes")
 *
 * - GET    /           -> list rooms (returns { rooms: [...] })
 * - POST   /           -> create room (returns { message, room })
 * - GET    /:roomId    -> get single room (returns room object)
 * - PUT    /:roomId    -> update room (returns { message, room })
 * - DELETE /:roomId    -> delete room (returns { message })
 */

/* -----------------------
   List rooms for a hotel
   GET /api/hotels/:hotelId/rooms
   ----------------------- */
router.get("/", protect, async (req, res) => {
  try {
    const { hotelId } = req.params;
    if (!hotelId) return res.status(400).json({ message: "hotelId required in URL" });

    const q = `SELECT id, hotel_id, room_number, type, rate, status, created_at, updated_at
               FROM rooms
               WHERE CAST(hotel_id AS text) = $1
               ORDER BY room_number`;
    const r = await pool.query(q, [String(hotelId)]);
    return res.json({ rooms: r.rows || [] });
  } catch (err) {
    console.error("list rooms:", err && err.stack ? err.stack : err);
    return res.status(500).json({ message: "Server error", detail: err?.message });
  }
});

/* -----------------------
   Create room
   POST /api/hotels/:hotelId/rooms
   Body: { room_number, type, rate }
   ----------------------- */
router.post("/", protect, async (req, res) => {
  try {
    const { hotelId } = req.params;
    if (!hotelId) return res.status(400).json({ message: "hotelId required in URL" });

    const { room_number, type, rate } = req.body || {};

    // permission check
    const allowed = await canManageHotel(req.user, hotelId);
    if (!allowed) return res.status(403).json({ message: "Forbidden — not allowed to manage rooms for this hotel" });

    if (!room_number || String(room_number).trim() === "") {
      return res.status(400).json({ message: "room_number is required" });
    }
    if (!type || String(type).trim() === "") {
      return res.status(400).json({ message: "type is required" });
    }
    const rateNum = rate !== undefined && rate !== null ? Number(rate) : null;
    if (rate !== undefined && Number.isNaN(rateNum)) {
      return res.status(400).json({ message: "rate must be a number" });
    }

    const q = `INSERT INTO rooms (hotel_id, room_number, type, rate, status, created_at, updated_at)
               VALUES ($1,$2,$3,$4,$5, now(), now())
               RETURNING id, hotel_id, room_number, type, rate, status, created_at, updated_at`;
    const vals = [String(hotelId), String(room_number), String(type), rateNum, 'available'];
    const r = await pool.query(q, vals);
    return res.status(201).json({ message: "Room created", room: r.rows[0] });
  } catch (err) {
    console.error("create room:", err && err.stack ? err.stack : err);
    return res.status(500).json({ message: "Server error", detail: err?.message });
  }
});

/* -----------------------
   Get specific room
   GET /api/hotels/:hotelId/rooms/:roomId
   ----------------------- */
router.get("/:roomId", protect, async (req, res) => {
  try {
    const { hotelId, roomId } = req.params;
    if (!hotelId) return res.status(400).json({ message: "hotelId required in URL" });

    const q = `SELECT id, hotel_id, room_number, type, rate, status, created_at, updated_at
               FROM rooms WHERE id = $1 AND CAST(hotel_id AS text) = $2 LIMIT 1`;
    const r = await pool.query(q, [roomId, String(hotelId)]);
    if (!r.rows.length) return res.status(404).json({ message: "Room not found for this hotel" });
    return res.json(r.rows[0]);
  } catch (err) {
    console.error("get room:", err && err.stack ? err.stack : err);
    return res.status(500).json({ message: "Server error", detail: err?.message });
  }
});

/* -----------------------
   Get bedspaces for a room
   GET /api/hotels/:hotelId/rooms/:roomId/bedspaces
   ----------------------- */
router.get("/:roomId/bedspaces", protect, async (req, res) => {
  try {
    const { hotelId, roomId } = req.params;
    if (!hotelId || !roomId) return res.status(400).json({ message: "hotelId and roomId required in URL" });

    // Candidate table names which may hold bed/bedspace records
    const candidateTables = ["bedspaces", "beds", "room_bedspaces", "room_beds", "room_bedspace"];

    // Try to find a table that exists and has a room FK column
    const client = pool;
    let found = null;
    for (const t of candidateTables) {
      try {
        const check = await client.query(
          `SELECT 1 FROM information_schema.tables WHERE table_name = $1 LIMIT 1`,
          [t]
        );
        if (!check.rows.length) continue;

        // Check for potential room FK column
        const possibleRoomCols = ["room_id", "roomid", "room", "room_ref"];
        for (const col of possibleRoomCols) {
          const colCheck = await client.query(
            `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2 LIMIT 1`,
            [t, col]
          );
          if (colCheck.rows.length) {
            found = { table: t, roomCol: col };
            break;
          }
        }
        if (found) break;
      } catch (e) {
        // ignore and try next
      }
    }

    if (!found) {
      return res.json({ bedspaces: [] });
    }

    // Identify a label column for display
    const labelCandidates = ["label", "name", "bed_label", "bed_name", "identifier"];
    let labelCol = null;
    for (const c of labelCandidates) {
      try {
        const l = await client.query(
          `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2 LIMIT 1`,
          [found.table, c]
        );
        if (l.rows.length) { labelCol = c; break; }
      } catch (e) {}
    }

    const selectCols = ["id", `${found.roomCol} AS room_id`, (labelCol ? `${labelCol} AS label` : "NULL AS label")].join(", ");
    const q = `SELECT ${selectCols} FROM ${found.table} WHERE CAST(${found.roomCol} AS text) = $1 ORDER BY id`;
    const { rows } = await client.query(q, [String(roomId)]);
    const normalized = (rows || []).map(r => ({ id: r.id, name: r.label ?? String(r.id) }));
    return res.json({ bedspaces: normalized });
  } catch (err) {
    console.error("get bedspaces:", err && err.stack ? err.stack : err);
    return res.status(500).json({ message: "Server error", detail: err?.message });
  }
});

/* -----------------------
   Update room (EDIT)
   PUT /api/hotels/:hotelId/rooms/:roomId
   Body: { room_number?, type?, rate?, status? }
   ----------------------- */
router.put("/:roomId", protect, async (req, res) => {
  try {
    const { hotelId, roomId } = req.params;
    if (!hotelId) return res.status(400).json({ message: "hotelId required in URL" });

    // ensure room belongs to this hotel
    const rr = await pool.query("SELECT hotel_id FROM rooms WHERE id = $1 LIMIT 1", [roomId]);
    if (!rr.rows.length) return res.status(404).json({ message: "Room not found" });
    if (String(rr.rows[0].hotel_id) !== String(hotelId)) {
      return res.status(400).json({ message: "Room not associated with this hotel" });
    }

    const allowed = await canManageHotel(req.user, hotelId);
    if (!allowed) return res.status(403).json({ message: "Forbidden — not allowed to manage rooms for this hotel" });

    const { room_number, type, rate, status } = req.body || {};
    const fields = [];
    const params = [];
    let idx = 1;

    if (room_number !== undefined) { fields.push(`room_number = $${idx++}`); params.push(String(room_number)); }
    if (type !== undefined) { fields.push(`type = $${idx++}`); params.push(String(type)); }
    if (rate !== undefined) {
      const v = rate === null ? null : Number(rate);
      if (rate !== null && Number.isNaN(v)) return res.status(400).json({ message: "rate must be numeric or null" });
      fields.push(`rate = $${idx++}`); params.push(v);
    }
    if (status !== undefined) { fields.push(`status = $${idx++}`); params.push(String(status)); }

    if (fields.length === 0) return res.status(400).json({ message: "No fields to update" });

    params.push(roomId);
    params.push(String(hotelId));

    const sql = `UPDATE rooms SET ${fields.join(", ")}, updated_at = NOW()
                 WHERE id = $${idx++} AND CAST(hotel_id AS text) = $${idx}
                 RETURNING id, hotel_id, room_number, type, rate, status, created_at, updated_at`;
    const u = await pool.query(sql, params);
    if (!u.rows.length) return res.status(404).json({ message: "Room not found or update failed" });
    return res.json({ message: "Room updated", room: u.rows[0] });
  } catch (err) {
    console.error("update room:", err && err.stack ? err.stack : err);
    return res.status(500).json({ message: "Server error", detail: err?.message });
  }
});

/* -----------------------
   Delete room
   DELETE /api/hotels/:hotelId/rooms/:roomId
   ----------------------- */
router.delete("/:roomId", protect, async (req, res) => {
  try {
    const { hotelId, roomId } = req.params;
    if (!hotelId) return res.status(400).json({ message: "hotelId required in URL" });

    const rr = await pool.query("SELECT hotel_id FROM rooms WHERE id = $1 LIMIT 1", [roomId]);
    if (!rr.rows.length) return res.status(404).json({ message: "Room not found" });
    const roomHotelId = rr.rows[0].hotel_id;
    if (String(roomHotelId) !== String(hotelId)) {
      return res.status(400).json({ message: "Room not associated with this hotel" });
    }

    const allowed = await canManageHotel(req.user, hotelId);
    if (!allowed) return res.status(403).json({ message: "Forbidden — not allowed to delete rooms for this hotel" });

    await pool.query("DELETE FROM rooms WHERE id = $1", [roomId]);
    return res.json({ message: "Room deleted" });
  } catch (err) {
    console.error("delete room:", err && err.stack ? err.stack : err);
    return res.status(500).json({ message: "Server error", detail: err?.message });
  }
});

export default router;
