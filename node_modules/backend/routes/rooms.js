// backend/routes/rooms.js
import express from "express";
import pool from "../config/db.js";
import { protect } from "../middleware/auth.js";
import { applyCrudLogging } from "../middleware/activityMiddleware.js"; // Enhanced logging
import fs from "fs";

const router = express.Router({ mergeParams: true }); // <- important: reads :hotelId from parent mount

function parseBedspacesValue(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const asInt = Math.floor(n);
  if (asInt <= 0) return 0;
  return asInt;
}

async function applyHotelOccupiedBedsDelta(client, hotelId, delta) {
  const d = Number(delta);
  if (!Number.isFinite(d) || d === 0) return;

  const lock = await client.query(
    "SELECT total_beds, occupied_beds FROM hotels WHERE id = $1 FOR UPDATE",
    [hotelId]
  );
  if (!lock.rows.length) return;

  const total = Number(lock.rows[0].total_beds ?? 0) || 0;
  const occupied = Number(lock.rows[0].occupied_beds ?? 0) || 0;

  let next = occupied + d;
  if (next < 0) next = 0;
  if (total > 0 && next > total) next = total;

  await client.query("UPDATE hotels SET occupied_beds = $1, updated_at = NOW() WHERE id = $2", [next, hotelId]);
}

async function getHotelsColumns() {
  const { rows } = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name = 'hotels'`
  );
  return (rows || []).map(r => r.column_name);
}

async function applyHotelTotalBedsDelta(client, hotelId, delta) {
  const d = Number(delta);
  if (!Number.isFinite(d) || d === 0) return;

  const lock = await client.query(
    "SELECT total_beds, occupied_beds FROM hotels WHERE id = $1 FOR UPDATE",
    [hotelId]
  );
  if (!lock.rows.length) return;

  const total = Number(lock.rows[0].total_beds ?? 0) || 0;
  const occupied = Number(lock.rows[0].occupied_beds ?? 0) || 0;

  let nextTotal = total + d;
  if (nextTotal < 0) nextTotal = 0;
  if (occupied > 0 && nextTotal < occupied) nextTotal = occupied;

  await client.query("UPDATE hotels SET total_beds = $1, updated_at = NOW() WHERE id = $2", [nextTotal, hotelId]);
}

async function recalcHotelTotalsFromRooms(client, hotelId, roomsCols, hotelsCols) {
  if (!Array.isArray(roomsCols) || !Array.isArray(hotelsCols)) return;
  const hasBedspaces = roomsCols.includes("bedspaces") && hotelsCols.includes("total_beds");
  const hasFloor = roomsCols.includes("floor") && hotelsCols.includes("total_floors");
  if (!hasBedspaces && !hasFloor) return;

  const parts = [];
  if (hasBedspaces) parts.push("COALESCE(SUM(COALESCE(bedspaces, 0)), 0)::bigint AS total_beds");
  if (hasFloor) parts.push("COALESCE(COUNT(DISTINCT NULLIF(TRIM(floor::text), '')), 0)::bigint AS total_floors");

  const q = `SELECT ${parts.join(", ")}
             FROM rooms
             WHERE CAST(hotel_id AS text) = $1`;
  const r = await client.query(q, [String(hotelId)]);
  const row = r.rows?.[0] || {};

  const setParts = [];
  const params = [];
  let idx = 1;
  if (hasBedspaces) {
    setParts.push(`total_beds = $${idx++}`);
    params.push(Number(row.total_beds || 0));
  }
  if (hasFloor) {
    setParts.push(`total_floors = $${idx++}`);
    params.push(Number(row.total_floors || 0));
  }
  if (!setParts.length) return;

  params.push(hotelId);
  await client.query(`UPDATE hotels SET ${setParts.join(", ")}, updated_at = NOW() WHERE id = $${idx}`, params);
}

async function getRoomsColumns() {
  const { rows } = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name = 'rooms'`
  );
  return (rows || []).map(r => r.column_name);
}

async function getRoomsColumnsMeta() {
  const { rows } = await pool.query(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_name = 'rooms'`
  );
  return rows || [];
}

function coerceRoomColumnValueByType(value, dataType) {
  if (value === null || value === undefined) return null;

  if (!dataType) return value;

  const dt = String(dataType).toLowerCase();

  // Handle numeric types
  if (dt.includes('int') || dt.includes('numeric') || dt.includes('decimal') || dt.includes('float') || dt.includes('double')) {
    const num = Number(value);
    return Number.isNaN(num) ? null : num;
  }

  // Handle boolean types
  if (dt.includes('bool')) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true' || lower === '1' || lower === 'yes') return true;
      if (lower === 'false' || lower === '0' || lower === 'no') return false;
    }
    return Boolean(value);
  }

  // Handle date/timestamp types
  if (dt.includes('date') || dt.includes('timestamp')) {
    if (value instanceof Date) return value;
    if (typeof value === 'string' && value.trim() !== '') return value;
    return null;
  }

  // Default: return as string
  return String(value);
}

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

    const existingCols = await getRoomsColumns();
    const baseCols = [
      "id",
      "hotel_id",
      "room_number",
      "type",
      "rate",
      "status",
      "created_at",
      "updated_at",
    ];
    const customCols = existingCols.filter(
      (c) => !baseCols.includes(c) && c !== "hotel_id" && c !== "id"
    );
    const selectCols = [...baseCols, ...customCols].join(", ");

    const q = `SELECT ${selectCols}
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

    const existingCols = await getRoomsColumns();
    const columnsToInsert = ["hotel_id", "room_number", "type", "rate", "status"];
    const valuesToInsert = [String(hotelId), String(room_number), String(type), rateNum, "available"];

    const standardCols = [
      "id",
      "hotel_id",
      "room_number",
      "type",
      "rate",
      "status",
      "created_at",
      "updated_at",
    ];

    for (const col of existingCols) {
      if (standardCols.includes(col)) continue;
      if (req.body?.[col] !== undefined) {
        columnsToInsert.push(col);
        valuesToInsert.push(req.body[col]);
      }
    }

    const placeholders = columnsToInsert.map((_, i) => `$${i + 1}`).join(",");
    const q = `INSERT INTO rooms (${columnsToInsert.join(", ")}, created_at, updated_at)
               VALUES (${placeholders}, now(), now())
               RETURNING *`;

    const bedspacesColExists = existingCols.includes("bedspaces");
    const bedspacesToOccupy = bedspacesColExists ? parseBedspacesValue(req.body?.bedspaces) : null;

    const hotelsCols = await getHotelsColumns();

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const r = await client.query(q, valuesToInsert);
      if (bedspacesToOccupy !== null && bedspacesToOccupy > 0 && hotelsCols.includes("total_beds")) {
        await applyHotelTotalBedsDelta(client, hotelId, bedspacesToOccupy);
      }
      await recalcHotelTotalsFromRooms(client, hotelId, existingCols, hotelsCols);
      await client.query("COMMIT");
      return res.status(201).json({ message: "Room created", room: r.rows[0] });
    } catch (e) {
      try { await client.query("ROLLBACK"); } catch { }
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("create room:", err && err.stack ? err.stack : err);
    return res.status(500).json({ message: "Server error", detail: err?.message });
  }
});

/* -----------------------
   Import rooms
   POST /api/hotels/:hotelId/rooms/import
   Body: { rooms: [{ room_number, room_type, floor, bedspaces, size, kitchen, bathroom, fully_equipped, equipment }] }
   ----------------------- */
router.post("/import", protect, async (req, res) => {
  try {
    const { hotelId } = req.params;
    if (!hotelId) return res.status(400).json({ message: "hotelId required in URL" });

    // permission check
    const allowed = await canManageHotel(req.user, hotelId);
    if (!allowed) return res.status(403).json({ message: "Forbidden — not allowed to manage rooms for this hotel" });

    const roomsData = req.body.rooms || [];
    if (!Array.isArray(roomsData) || roomsData.length === 0) {
      return res.status(400).json({ message: "No rooms data provided" });
    }

    const existingCols = await getRoomsColumns();
    const hotelsCols = await getHotelsColumns();
    const client = await pool.connect();

    let totalImportedBedspaces = 0;

    try {
      await client.query("BEGIN");

      const importedRooms = [];

      for (const room of roomsData) {
        const columnsToInsert = ["hotel_id", "status"];
        const valuesToInsert = [String(hotelId), "available"];

        const addCol = (colName, val) => {
          if (existingCols.includes(colName)) {
            columnsToInsert.push(colName);
            valuesToInsert.push(val);
          }
        };

        if (room.room_number) addCol("room_number", String(room.room_number));
        if (room.room_type) addCol("type", String(room.room_type));
        if (room.floor) addCol("floor", String(room.floor));

        const bedspaces = parseBedspacesValue(room.bedspaces);
        if (bedspaces !== null) {
          addCol("bedspaces", bedspaces);
          totalImportedBedspaces += bedspaces;
        }

        if (room.size) {
          addCol("length", room.size);
          addCol("width", 1);
        }

        if (room.kitchen !== undefined) addCol("has_kitchen", room.kitchen);
        if (room.bathroom) {
          addCol("bathroom_type", room.bathroom);
          addCol("has_bathroom", room.bathroom.toLowerCase() !== 'no' && room.bathroom.toLowerCase() !== 'none' && room.bathroom !== '');
        }

        let inventory = [];
        if (room.equipment) {
          inventory.push(room.equipment);
        } else if (room.fully_equipped) {
          inventory.push("Fully Equipped");
        }
        if (inventory.length > 0) {
          addCol("inventory", inventory.join(", "));
        }

        const placeholders = columnsToInsert.map((_, i) => `$${i + 1}`).join(",");
        const q = `INSERT INTO rooms (${columnsToInsert.join(", ")}, created_at, updated_at)
                   VALUES (${placeholders}, now(), now())
                   RETURNING *`;

        const r = await client.query(q, valuesToInsert);
        importedRooms.push(r.rows[0]);
      }

      if (totalImportedBedspaces > 0 && hotelsCols.includes("total_beds")) {
        await applyHotelTotalBedsDelta(client, hotelId, totalImportedBedspaces);
      }
      await recalcHotelTotalsFromRooms(client, hotelId, existingCols, hotelsCols);

      await client.query("COMMIT");
      return res.status(201).json({ message: `Successfully imported ${importedRooms.length} rooms`, count: importedRooms.length });
    } catch (e) {
      try { await client.query("ROLLBACK"); } catch { }
      throw e;
    } finally {
      client.release();
    }

  } catch (err) {
    console.error("import rooms:", err && err.stack ? err.stack : err);
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

    const existingCols = await getRoomsColumns();
    const baseCols = [
      "id",
      "hotel_id",
      "room_number",
      "type",
      "rate",
      "status",
      "created_at",
      "updated_at",
    ];
    const customCols = existingCols.filter(
      (c) => !baseCols.includes(c) && c !== "hotel_id" && c !== "id"
    );
    const selectCols = [...baseCols, ...customCols].join(", ");

    const q = `SELECT ${selectCols}
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
      } catch (e) { }
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

    const existingCols = await getRoomsColumns();
    const colsMeta = await getRoomsColumnsMeta();
    const metaByName = new Map(colsMeta.map(r => [r.column_name, r.data_type]));
    const bedspacesColExists = existingCols.includes("bedspaces");
    const hotelsCols = await getHotelsColumns();

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

    const standardCols = [
      "id",
      "hotel_id",
      "room_number",
      "type",
      "rate",
      "status",
      "created_at",
      "updated_at",
    ];

    for (const col of existingCols) {
      if (standardCols.includes(col)) continue;
      if (req.body?.[col] !== undefined) {
        fields.push(`${col} = $${idx++}`);
        params.push(coerceRoomColumnValueByType(req.body[col], metaByName.get(col)));
      }
    }

    if (fields.length === 0) return res.status(400).json({ message: "No fields to update" });

    params.push(roomId);
    params.push(String(hotelId));

    const sql = `UPDATE rooms SET ${fields.join(", ")}, updated_at = NOW()
                 WHERE id = $${idx++} AND CAST(hotel_id AS text) = $${idx}
                 RETURNING *`;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // lock the room row to safely compute delta
      const locked = await client.query(
        `SELECT hotel_id${bedspacesColExists ? ", bedspaces" : ""}
         FROM rooms
         WHERE id = $1
         FOR UPDATE`,
        [roomId]
      );

      if (!locked.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Room not found" });
      }

      const roomHotelId = locked.rows[0].hotel_id;
      if (String(roomHotelId) !== String(hotelId)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Room not associated with this hotel" });
      }

      const oldBedspaces = bedspacesColExists
        ? parseBedspacesValue(locked.rows[0].bedspaces)
        : null;
      const newBedspaces = bedspacesColExists
        ? parseBedspacesValue(req.body?.bedspaces)
        : null;

      const u = await client.query(sql, params);
      if (!u.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Room not found or update failed" });
      }

      let delta = 0;
      if (bedspacesColExists) {
        const oldN = oldBedspaces === null ? 0 : Number(oldBedspaces);
        const newN = newBedspaces === null ? oldN : Number(newBedspaces);
        if (Number.isFinite(oldN) && Number.isFinite(newN)) {
          delta = newN - oldN;
        }
      }

      if (Number.isFinite(Number(delta)) && Number(delta) !== 0) {
        if (hotelsCols.includes("total_beds")) {
          await applyHotelTotalBedsDelta(client, hotelId, delta);
        }
      }

      await recalcHotelTotalsFromRooms(client, hotelId, existingCols, hotelsCols);

      await client.query("COMMIT");
      return res.json({ message: "Room updated", room: u.rows[0] });
    } catch (e) {
      try { await client.query("ROLLBACK"); } catch { }
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    try {
      fs.writeFileSync("rooms_put_error.log", `${new Date().toISOString()} - Update Room Error: ${err.message}\n${err.stack}\n`);
    } catch (e) { console.error("Failed to write log", e); }
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

    const existingCols = await getRoomsColumns();
    const bedspacesColExists = existingCols.includes("bedspaces");
    const hotelsCols = await getHotelsColumns();

    const allowed = await canManageHotel(req.user, hotelId);
    if (!allowed) return res.status(403).json({ message: "Forbidden — not allowed to delete rooms for this hotel" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const locked = await client.query(
        `SELECT hotel_id${bedspacesColExists ? ", bedspaces" : ""}
         FROM rooms
         WHERE id = $1
         FOR UPDATE`,
        [roomId]
      );
      if (!locked.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Room not found" });
      }

      const roomHotelId = locked.rows[0].hotel_id;
      if (String(roomHotelId) !== String(hotelId)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Room not associated with this hotel" });
      }

      const bedspacesToRelease = bedspacesColExists
        ? parseBedspacesValue(locked.rows[0].bedspaces)
        : null;

      await client.query("DELETE FROM rooms WHERE id = $1", [roomId]);
      if (bedspacesToRelease !== null && bedspacesToRelease > 0) {
        if (hotelsCols.includes("total_beds")) {
          await applyHotelTotalBedsDelta(client, hotelId, -bedspacesToRelease);
        }
      }

      await recalcHotelTotalsFromRooms(client, hotelId, existingCols, hotelsCols);

      await client.query("COMMIT");
      return res.json({ message: "Room deleted" });
    } catch (e) {
      try { await client.query("ROLLBACK"); } catch { }
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("delete room:", err && err.stack ? err.stack : err);
    return res.status(500).json({ message: "Server error", detail: err?.message });
  }
});

export default router;
