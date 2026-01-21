// File: routes/su.js
import express from "express";
import poolImport from "../config/db.js"; // adjust path if needed
import { protect } from "../middleware/auth.js"; // Add authentication middleware
import { logActivity } from "../utils/activityLogger.js"; // Add activity logging

const router = express.Router();
const pool = poolImport && poolImport.default ? poolImport.default : poolImport;

if (!pool || typeof pool.query !== "function") {
  console.error(
    "DB pool not found. Ensure ../config/db.js exports a pg Pool (default or named)."
  );
}

// Ensure service_users table exists (minimal schema) to avoid runtime 500s
let suTableReady = false;
async function ensureServiceUsersTable() {
  if (suTableReady) return true;
  try {
    const check = await pool.query(`SELECT to_regclass('service_users') AS exists`);
    if (check.rows?.[0]?.exists) {
      try {
        const roomIdExists = await columnExists('service_users', 'room_id');
        if (!roomIdExists) {
          await pool.query(`ALTER TABLE service_users ADD COLUMN room_id INTEGER`);
        }
      } catch (e) {
        // best-effort
      }
      suTableReady = true;
      return true;
    }
    console.warn("service_users table missing. Creating minimal table to unblock API.");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS service_users (
        id SERIAL PRIMARY KEY,
        first_name TEXT,
        last_name TEXT,
        dob DATE,
        date_of_birth DATE,
        nationality TEXT,
        home_office_reference TEXT,
        gender TEXT,
        immigration_status TEXT,
        family_type TEXT,
        number_of_dependents INTEGER,
        emergency_contact_name TEXT,
        emergency_contact_phone TEXT,
        vulnerabilities TEXT,
        medical_conditions TEXT,
        dietary_requirements TEXT,
        status TEXT DEFAULT 'Active',
        property_id INTEGER,
        hotel_id INTEGER,
        accommodation_id INTEGER,
        room_id INTEGER,
        room_number TEXT,
        room TEXT,
        admission_date DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    suTableReady = true;
    return true;
  } catch (err) {
    console.error("Failed to ensure service_users table:", err?.message || err);
    return false;
  }
}

/* -------------------- Helpers -------------------- */

function isValidIdentifier(name) {
  return typeof name === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

async function tableExists(tableName) {
  if (!isValidIdentifier(tableName)) return null;
  try {
    const q = `SELECT to_regclass($1) AS found`;
    const { rows } = await pool.query(q, [tableName]);
    return rows?.[0]?.found ? tableName : null;
  } catch (e) {
    console.warn("tableExists check failed for", tableName, e?.message || e);
    return null;
  }
}

async function columnExists(tableName, columnName) {
  if (!isValidIdentifier(tableName) || !isValidIdentifier(columnName)) return null;
  try {
    const q = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = $1
        AND column_name = $2
      LIMIT 1
    `;
    const { rows } = await pool.query(q, [tableName, columnName]);
    return rows?.length ? rows[0].column_name : null;
  } catch (e) {
    console.warn("columnExists check failed for", tableName, columnName, e?.message || e);
    return null;
  }
}

async function resolveTableFromCandidates(candidates = []) {
  for (const name of candidates) {
    const ok = await tableExists(name);
    if (ok) return ok;
  }
  return null;
}

async function discoverTableByKeyword(keyword) {
  try {
    const q = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
        AND table_schema NOT IN ('pg_catalog','information_schema')
        AND table_name ILIKE '%' || $1 || '%'
      ORDER BY table_name
      LIMIT 1
    `;
    const { rows } = await pool.query(q, [keyword]);
    return rows?.length ? rows[0].table_name : null;
  } catch (e) {
    console.warn("discoverTableByKeyword failed for", keyword, e?.message || e);
    return null;
  }
}

async function resolveFkColumnOnServiceUsers(keywords = [], candidates = []) {
  const suTable = "service_users";
  for (const col of candidates) {
    const ok = await columnExists(suTable, col);
    if (ok) return ok;
  }
  for (const kw of keywords) {
    try {
      const q = `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = $1
          AND column_name ILIKE '%' || $2 || '%'
        ORDER BY ordinal_position
        LIMIT 1
      `;
      const { rows } = await pool.query(q, [suTable, kw]);
      if (rows?.length) return rows[0].column_name;
    } catch (e) {
      console.warn(
        "resolveFkColumnOnServiceUsers keyword search failed",
        kw,
        e?.message || e
      );
    }
  }
  return null;
}

let cachedSchema = null;
async function resolveSchemaNames() {
  if (cachedSchema) return cachedSchema;

  // hotel table candidates
  const HOTEL_TABLE_CANDIDATES = [
    "hotel",
    "hotels",
    "property",
    "properties",
    "accommodation",
    "accommodations",
  ];
  const ROOM_TABLE_CANDIDATES = [
    "rooms",
    "room",
    "hotel_room",
    "hotel_rooms",
    "rooms_table",
  ];

  // Prefer explicit hotel/hotels
  let hotelTable = await tableExists("hotel");
  if (!hotelTable) hotelTable = await tableExists("hotels");
  if (!hotelTable) hotelTable = await resolveTableFromCandidates(HOTEL_TABLE_CANDIDATES);
  if (!hotelTable) {
    hotelTable =
      (await discoverTableByKeyword("hotel")) ||
      (await discoverTableByKeyword("property")) ||
      (await discoverTableByKeyword("accom"));
  }

  let roomTable = await tableExists("rooms");
  if (!roomTable) roomTable = await resolveTableFromCandidates(ROOM_TABLE_CANDIDATES);
  if (!roomTable) {
    roomTable =
      (await discoverTableByKeyword("room")) ||
      (await discoverTableByKeyword("room_number"));
  }

  const hotelFkCandidates = [
    "hotel_id",
    "hotels_id",
    "property_id",
    "accommodation_id",
    "accom_id",
    "hotelid",
    "propertyid",
  ];
  const roomFkCandidates = [
    "room_id",
    "rooms_id",
    "roomid",
    "room_number_id",
    "roomno_id",
  ];

  let hotelFk = await resolveFkColumnOnServiceUsers(
    ["hotel", "property", "accom", "hostel"],
    hotelFkCandidates
  );
  let roomFk = await resolveFkColumnOnServiceUsers(
    ["room", "room_no", "roomno", "roomnumber"],
    roomFkCandidates
  );

  cachedSchema = { hotelTable, roomTable, hotelFk, roomFk };
  console.log("Resolved schema names:", cachedSchema);
  return cachedSchema;
}

function quoteIdent(name) {
  return `"${name.replace(/"/g, '""')}"`;
}

/* -------------------- ROOT ROUTE -------------------- */

/**
 * GET /api/su
 * Get service users with optional filtering by hotel_id, hotelId, or hotel
 */
router.get("/", async (req, res) => {
  try {
    if (!pool || typeof pool.query !== "function")
      return res.status(500).json({ error: "DB not initialized" });

    // Support filtering by hotel_id via query parameters
    const { hotel_id, hotelId, hotel } = req.query;
    const filterHotelId = hotel_id || hotelId || hotel;

    const names = await resolveSchemaNames();
    const su = "service_users";
    const suAlias = "su";

    const joins = [];
    let selectHotelName = "NULL AS hotel_name";
    let selectRoomNumber = "NULL AS room_number";
    let whereClause = "";

    // Detect which column to use for hotel filtering
    let hotelFilterCol = null;
    if (names.hotelFk && isValidIdentifier(names.hotelFk)) {
      hotelFilterCol = names.hotelFk;
    } else {
      const hotelCols = ["hotel_id", "property_id", "accommodation_id", "hotelid", "propertyid"];
      for (const col of hotelCols) {
        const exists = await columnExists(su, col);
        if (exists) {
          hotelFilterCol = col;
          break;
        }
      }
    }

    if (filterHotelId && hotelFilterCol) {
      whereClause = `WHERE ${suAlias}.${quoteIdent(hotelFilterCol)} = $1`;
    }

    // Join hotel table if possible
    if (names.hotelTable && names.hotelFk && isValidIdentifier(names.hotelFk)) {
      joins.push(
        `LEFT JOIN ${quoteIdent(names.hotelTable)} h ON ${suAlias}.${quoteIdent(
          names.hotelFk
        )} = h.id`
      );
      selectHotelName = `h.name AS hotel_name`;
    } else if (names.hotelTable) {
      const fallbackCol = await columnExists(su, "hotel_id");
      if (fallbackCol) {
        joins.push(
          `LEFT JOIN ${quoteIdent(names.hotelTable)} h ON ${suAlias}.${quoteIdent(
            fallbackCol
          )} = h.id`
        );
        selectHotelName = `h.name AS hotel_name`;
      }
    }

    // Join room table if possible
    if (names.roomTable && names.roomFk && isValidIdentifier(names.roomFk)) {
      joins.push(
        `LEFT JOIN ${quoteIdent(names.roomTable)} r ON ${suAlias}.${quoteIdent(
          names.roomFk
        )} = r.id`
      );
      selectRoomNumber = `r.room_number::text AS room_number`;
    } else if (names.roomTable) {
      const fallbackCol = await columnExists(su, "room_id");
      if (fallbackCol) {
        joins.push(
          `LEFT JOIN ${quoteIdent(names.roomTable)} r ON ${suAlias}.${quoteIdent(
            fallbackCol
          )} = r.id`
        );
        selectRoomNumber = `r.room_number::text AS room_number`;
      }
    }

    // If we couldn't join room table, but service_users has a text column like room_number/room, select that
    const { rows: suColsRows } = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'service_users'
    `);
    const suCols = suColsRows.map((r) => r.column_name);

    if (selectRoomNumber.startsWith("NULL")) {
      if (suCols.includes("room_number")) {
        selectRoomNumber = `${suAlias}.room_number::text AS room_number`;
      } else if (suCols.includes("room")) {
        selectRoomNumber = `${suAlias}.room::text AS room_number`;
      }
    }

    if (selectHotelName.startsWith("NULL")) {
      if (suCols.includes("hotel_name")) {
        selectHotelName = `${suAlias}.hotel_name AS hotel_name`;
      } else if (suCols.includes("property")) {
        selectHotelName = `${suAlias}.property AS hotel_name`;
      } else if (suCols.includes("hotel")) {
        selectHotelName = `${suAlias}.hotel AS hotel_name`;
      } else if (suCols.includes("property_name")) {
        selectHotelName = `${suAlias}.property_name AS hotel_name`;
      }
    }

    const q = `
      SELECT ${suAlias}.*,
             ${selectHotelName},
             ${selectRoomNumber}
      FROM ${su} ${suAlias}
      ${joins.join("\n")}
      ${whereClause}
      ORDER BY ${suAlias}.id DESC
    `;

    const params = filterHotelId && hotelFilterCol ? [filterHotelId] : [];
    const { rows } = await pool.query(q, params);

    // Normalize data for consistent frontend consumption
    const normalizedRows = rows.map((row) => {
      // Ensure property/hotel_name is available
      if (!row.property && row.hotel_name) {
        row.property = row.hotel_name;
      }
      if (!row.property_name && row.hotel_name) {
        row.property_name = row.hotel_name;
      }

      // Ensure number_of_dependents is a number
      if (row.number_of_dependents === null || row.number_of_dependents === undefined) {
        row.number_of_dependents = 0;
      } else {
        row.number_of_dependents = Number(row.number_of_dependents) || 0;
      }

      return row;
    });

    return res.json(normalizedRows);
  } catch (err) {
    console.error(
      "GET /api/su error:",
      err && err.stack ? err.stack : err
    );
    return res.status(500).json({
      error: "Server error while fetching service users",
      details: err?.message,
    });
  }
});

/* -------------------- ROOMS ROUTE -------------------- */

/**
 * GET /api/su/rooms/:hotelId
 * Get rooms for a specific hotel (for dropdown selection)
 */
router.get("/rooms/:hotelId", async (req, res) => {
  try {
    const { hotelId } = req.params;
    if (!hotelId) {
      return res.status(400).json({ error: "hotelId is required" });
    }

    if (!pool || typeof pool.query !== "function") {
      return res.status(500).json({ error: "DB not initialized" });
    }

    const names = await resolveSchemaNames();
    const roomTable = names.roomTable || "rooms";

    if (!roomTable) {
      return res.json({ rooms: [] });
    }

    // Try to find the hotel_id column in the rooms table
    const possibleHotelCols = ["hotel_id", "hotelid", "property_id", "propertyid"];
    let hotelCol = null;

    for (const col of possibleHotelCols) {
      const exists = await columnExists(roomTable, col);
      if (exists) {
        hotelCol = exists;
        break;
      }
    }

    if (!hotelCol) {
      return res.json({ rooms: [] });
    }

    // Ensure room_number column exists
    const roomNumberExists = await columnExists(roomTable, "room_number");
    if (!roomNumberExists) {
      console.warn("room_number column not found in", roomTable, "table");
      return res.json({ rooms: [] });
    }

    const q = `
      SELECT id,
             ${quoteIdent(hotelCol)} AS hotel_id,
             ${quoteIdent("room_number")} AS room_number,
             type,
             rate,
             status
      FROM ${quoteIdent(roomTable)}
      WHERE CAST(${quoteIdent(hotelCol)} AS text) = $1
      ORDER BY ${quoteIdent("room_number")}
    `;

    const { rows } = await pool.query(q, [String(hotelId)]);
    return res.json({ rooms: rows || [] });
  } catch (err) {
    console.error(
      "GET /api/su/rooms/:hotelId error:",
      err && err.stack ? err.stack : err
    );
    return res.status(500).json({
      error: "Server error while fetching rooms",
      details: err?.message,
    });
  }
});

/* -------------------- LIST + GET USERS -------------------- */

/**
 * GET /api/su/users
 * List service users with hotel_name and room_number if available
 */
router.get("/users", protect, async (req, res) => {
  try {
    if (!pool || typeof pool.query !== "function")
      return res.status(500).json({ error: "DB not initialized" });

    // Support filtering by hotel_id via query parameters
    const { hotel_id, hotelId, hotel } = req.query;
    const filterHotelId = hotel_id || hotelId || hotel;

    const names = await resolveSchemaNames();
    const su = "service_users";
    const suAlias = "su";

    const joins = [];
    let selectHotelName = "NULL AS hotel_name";
    let selectRoomNumber = "NULL AS room_number";
    let whereClause = "";

    // Join hotel table if possible
    if (names.hotelTable && names.hotelFk && isValidIdentifier(names.hotelFk)) {
      joins.push(
        `LEFT JOIN ${quoteIdent(names.hotelTable)} h ON ${suAlias}.${quoteIdent(
          names.hotelFk
        )} = h.id`
      );
      selectHotelName = `h.name AS hotel_name`;
      if (filterHotelId) {
        whereClause = `WHERE ${suAlias}.${quoteIdent(names.hotelFk)} = $1`;
      }
    } else if (names.hotelTable) {
      const fallbackCol = await columnExists(su, "hotel_id");
      if (fallbackCol) {
        joins.push(
          `LEFT JOIN ${quoteIdent(names.hotelTable)} h ON ${suAlias}.${quoteIdent(
            fallbackCol
          )} = h.id`
        );
        selectHotelName = `h.name AS hotel_name`;
        if (filterHotelId) {
          whereClause = `WHERE ${suAlias}.${quoteIdent(fallbackCol)} = $1`;
        }
      }
    }

    // If no joins but table has hotel_id/property_id column, filter by it
    if (!whereClause && filterHotelId) {
      const hotelCols = ["hotel_id", "property_id", "accommodation_id", "hotelid", "propertyid"];
      for (const col of hotelCols) {
        const exists = await columnExists(su, col);
        if (exists) {
          whereClause = `WHERE ${suAlias}.${quoteIdent(col)} = $1`;
          break;
        }
      }
    }

    // Join room table if possible
    if (names.roomTable && names.roomFk && isValidIdentifier(names.roomFk)) {
      joins.push(
        `LEFT JOIN ${quoteIdent(names.roomTable)} r ON ${suAlias}.${quoteIdent(
          names.roomFk
        )} = r.id`
      );
      selectRoomNumber = `r.room_number::text AS room_number`;
    } else if (names.roomTable) {
      const fallbackCol = await columnExists(su, "room_id");
      if (fallbackCol) {
        joins.push(
          `LEFT JOIN ${quoteIdent(names.roomTable)} r ON ${suAlias}.${quoteIdent(
            fallbackCol
          )} = r.id`
        );
        selectRoomNumber = `r.room_number::text AS room_number`;
      }
    }

    // If we couldn't join room table, but service_users has a text column like room_number/room, select that
    const { rows: suColsRows } = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'service_users'
    `);
    const suCols = suColsRows.map((r) => r.column_name);

    if (selectRoomNumber.startsWith("NULL")) {
      if (suCols.includes("room_number")) {
        selectRoomNumber = `${suAlias}.room_number::text AS room_number`;
      } else if (suCols.includes("room")) {
        selectRoomNumber = `${suAlias}.room::text AS room_number`;
      }
    }

    if (selectHotelName.startsWith("NULL")) {
      if (suCols.includes("hotel_name")) {
        selectHotelName = `${suAlias}.hotel_name AS hotel_name`;
      } else if (suCols.includes("property")) {
        selectHotelName = `${suAlias}.property AS hotel_name`;
      } else if (suCols.includes("hotel")) {
        selectHotelName = `${suAlias}.hotel AS hotel_name`;
      } else if (suCols.includes("property_name")) {
        selectHotelName = `${suAlias}.property_name AS hotel_name`;
      }
    }

    const q = `
      SELECT ${suAlias}.*,
             ${selectHotelName},
             ${selectRoomNumber}
      FROM ${su} ${suAlias}
      ${joins.join("\n")}
      ${whereClause}
      ORDER BY ${suAlias}.id DESC
    `;

    const params = filterHotelId ? [filterHotelId] : [];
    const { rows } = await pool.query(q, params);

    // Normalize data for consistent frontend consumption
    const normalizedRows = rows.map((row) => {
      // Ensure property/hotel_name is available
      if (!row.property && row.hotel_name) {
        row.property = row.hotel_name;
      }
      if (!row.property_name && row.hotel_name) {
        row.property_name = row.hotel_name;
      }

      // Normalize array fields to strings
      if (Array.isArray(row.family_type)) {
        row.family_type = row.family_type[0] || row.family_type.join(", ");
      }
      if (Array.isArray(row.emergency_contact_name)) {
        row.emergency_contact_name = row.emergency_contact_name[0] || row.emergency_contact_name.join(", ");
      }
      if (Array.isArray(row.emergency_contact_phone)) {
        row.emergency_contact_phone = row.emergency_contact_phone[0] || row.emergency_contact_phone.join(", ");
      }

      // Ensure number_of_dependents is a number
      if (row.number_of_dependents === null || row.number_of_dependents === undefined) {
        row.number_of_dependents = 0;
      } else {
        row.number_of_dependents = Number(row.number_of_dependents) || 0;
      }

      return row;
    });

    return res.json(normalizedRows);
  } catch (err) {
    console.error(
      "GET /api/su/users error:",
      err && err.stack ? err.stack : err
    );
    return res.status(500).json({
      error: "Server error while fetching service users",
      details: err?.message,
    });
  }
});

/* -------------------- SAFE MEALS FALLBACK -------------------- */
/**
 * Some frontend code calls `/api/su/meals` as a fallback. If left unhandled,
 * the catch-all `GET /:hotelId` route will treat the literal "meals" as a hotelId
 * and attempt to convert it to an integer, causing a server error. Provide a
 * safe, lightweight handler that returns an empty array (or could be extended
 * to proxy to the real meals endpoint) so the frontend fallback is non-fatal.
 */
router.get("/meals", async (req, res) => {
  try {
    // Return an empty array so frontend will try other endpoints.
    return res.json([]);
  } catch (err) {
    console.error("GET /api/su/meals fallback error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/su/users/:id
 */
router.get("/users/:id", protect, async (req, res) => {
  try {
    const rawId = req.params.id;
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      return res
        .status(400)
        .json({ error: "Invalid id - must be a positive integer" });
    }

    if (!pool || typeof pool.query !== "function")
      return res.status(500).json({ error: "DB not initialized" });

    const names = await resolveSchemaNames();
    const su = "service_users";
    const suAlias = "su";

    const joins = [];
    let selectHotelName = "NULL AS hotel_name";
    let selectRoomNumber = "NULL AS room_number";

    if (names.hotelTable && names.hotelFk && isValidIdentifier(names.hotelFk)) {
      joins.push(
        `LEFT JOIN ${quoteIdent(names.hotelTable)} h ON ${suAlias}.${quoteIdent(
          names.hotelFk
        )} = h.id`
      );
      selectHotelName = `h.name AS hotel_name`;
    } else if (names.hotelTable) {
      const fallbackCol = await columnExists(su, "hotel_id");
      if (fallbackCol) {
        joins.push(
          `LEFT JOIN ${quoteIdent(names.hotelTable)} h ON ${suAlias}.${quoteIdent(
            fallbackCol
          )} = h.id`
        );
        selectHotelName = `h.name AS hotel_name`;
      }
    }

    if (names.roomTable && names.roomFk && isValidIdentifier(names.roomFk)) {
      joins.push(
        `LEFT JOIN ${quoteIdent(names.roomTable)} r ON ${suAlias}.${quoteIdent(
          names.roomFk
        )} = r.id`
      );
      selectRoomNumber = `r.room_number::text AS room_number`;
    } else if (names.roomTable) {
      const fallbackCol = await columnExists(su, "room_id");
      if (fallbackCol) {
        joins.push(
          `LEFT JOIN ${quoteIdent(names.roomTable)} r ON ${suAlias}.${quoteIdent(
            fallbackCol
          )} = r.id`
        );
        selectRoomNumber = `r.room_number::text AS room_number`;
      }
    }

    const { rows: suColsRows } = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'service_users'
    `);
    const suCols = suColsRows.map((r) => r.column_name);

    if (selectRoomNumber.startsWith("NULL")) {
      if (suCols.includes("room_number")) {
        selectRoomNumber = `${suAlias}.room_number::text AS room_number`;
      } else if (suCols.includes("room")) {
        selectRoomNumber = `${suAlias}.room::text AS room_number`;
      }
    }

    if (selectHotelName.startsWith("NULL")) {
      if (suCols.includes("hotel_name")) {
        selectHotelName = `${suAlias}.hotel_name AS hotel_name`;
      } else if (suCols.includes("property")) {
        selectHotelName = `${suAlias}.property AS hotel_name`;
      } else if (suCols.includes("hotel")) {
        selectHotelName = `${suAlias}.hotel AS hotel_name`;
      } else if (suCols.includes("property_name")) {
        selectHotelName = `${suAlias}.property_name AS hotel_name`;
      }
    }

    const q = `
      SELECT ${suAlias}.*,
             ${selectHotelName},
             ${selectRoomNumber}
      FROM ${su} ${suAlias}
      ${joins.join("\n")}
      WHERE ${suAlias}.id = $1
      LIMIT 1
    `;
    const { rows } = await pool.query(q, [id]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });

    // Ensure all fields are properly formatted and present
    const userData = rows[0];

    // Normalize property/hotel name
    if (!userData.property && userData.hotel_name) {
      userData.property = userData.hotel_name;
    }
    if (!userData.property_name && userData.hotel_name) {
      userData.property_name = userData.hotel_name;
    }

    // Ensure string fields are strings (not arrays)
    if (Array.isArray(userData.family_type)) {
      userData.family_type = userData.family_type[0] || userData.family_type.join(", ");
    }
    if (Array.isArray(userData.emergency_contact_name)) {
      userData.emergency_contact_name = userData.emergency_contact_name[0] || userData.emergency_contact_name.join(", ");
    }
    if (Array.isArray(userData.emergency_contact_phone)) {
      userData.emergency_contact_phone = userData.emergency_contact_phone[0] || userData.emergency_contact_phone.join(", ");
    }

    // Ensure number_of_dependents is a number
    if (userData.number_of_dependents === null || userData.number_of_dependents === undefined) {
      userData.number_of_dependents = 0;
    } else {
      userData.number_of_dependents = Number(userData.number_of_dependents) || 0;
    }

    return res.json(userData);
  } catch (err) {
    console.error(
      "GET /api/su/users/:id error:",
      err && err.stack ? err.stack : err
    );
    return res.status(500).json({ error: "Server error", details: err?.message });
  }
});

/* -------------------- CREATE -------------------- */

/**
 * POST /api/su/users
 *
 * Simplified & safer:
 * - Only inserts columns that actually exist on service_users
 * - Stores vulnerabilities/medical/dietary as plain TEXT (comma-separated if array)
 */
router.post("/users", protect, async (req, res) => {
  try {
    const ready = await ensureServiceUsersTable();
    if (!ready) {
      return res.status(500).json({ error: "service_users table not available" });
    }

    if (!pool || typeof pool.query !== "function") {
      return res.status(500).json({ error: "DB not initialized" });
    }

    const body = req.body;

    // Normalize date to YYYY-MM-DD or null
    const normalizeDate = (value) => {
      if (!value) return null;
      const d = new Date(value);
      if (isNaN(d.getTime())) return null;
      return d.toISOString().slice(0, 10);
    };

    const normalizedDob = normalizeDate(body.date_of_birth || body.dob);
    const normalizedAdmission = normalizeDate(body.admission_date);

    const normalizedDependents =
      body.number_of_dependents === undefined ||
        body.number_of_dependents === null ||
        body.number_of_dependents === ""
        ? null
        : isNaN(Number(body.number_of_dependents))
          ? null
          : Number(body.number_of_dependents);

    // Get existing columns on service_users
    const { rows: suColsRows } = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'service_users'
    `);
    const suCols = suColsRows.map((r) => r.column_name);

    const toInsert = [];
    const values = [];

    const pushIfExists = (col, val) => {
      if (!suCols.includes(col)) return;
      // treat empty string as NULL
      const v =
        typeof val === "string" && val.trim() === "" ? null : val;
      if (v === undefined) return;
      toInsert.push(col);
      values.push(v);
    };

    // Decide which FK column to use for property/hotel
    const propertyFkCandidates = [
      "property_id",
      "hotel_id",
      "accommodation_id",
    ];
    const propertyCol = propertyFkCandidates.find((c) =>
      suCols.includes(c)
    );

    if (propertyCol) {
      pushIfExists(
        propertyCol,
        body.property_id || body.hotel_id || body.accommodation_id || null
      );
    }

    // Room number column
    const roomCol = suCols.includes("room_number")
      ? "room_number"
      : suCols.includes("room")
        ? "room"
        : null;

    if (roomCol) {
      pushIfExists(roomCol, body.room_number || body.room || null);
    }

    // Basic fields
    pushIfExists("first_name", body.first_name);
    pushIfExists("last_name", body.last_name);
    pushIfExists("nationality", body.nationality);
    pushIfExists("home_office_reference", body.home_office_reference);
    pushIfExists("gender", body.gender);
    pushIfExists("immigration_status", body.immigration_status);
    pushIfExists("family_type", body.family_type);
    pushIfExists("number_of_dependents", normalizedDependents);
    pushIfExists("emergency_contact_name", body.emergency_contact_name);
    pushIfExists("emergency_contact_phone", body.emergency_contact_phone);

    // Dates
    pushIfExists("dob", normalizedDob);
    pushIfExists("date_of_birth", normalizedDob);
    pushIfExists("admission_date", normalizedAdmission);

    // Status (fallback Active)
    pushIfExists("status", body.status || "Active");

    // Convert array fields for PostgreSQL array columns
    // PostgreSQL expects arrays as JavaScript arrays or properly formatted array literals
    const arrToPgArray = (v) => {
      if (v === null || v === undefined) return null;
      if (Array.isArray(v)) {
        // Filter out empty strings and return array
        const filtered = v.filter(item => item !== null && item !== undefined && String(item).trim() !== "");
        return filtered.length > 0 ? filtered : null;
      }
      // If it's a string, check if it's comma-separated and convert to array
      if (typeof v === "string" && v.trim() !== "") {
        const split = v.split(",").map(s => s.trim()).filter(s => s !== "");
        return split.length > 0 ? split : null;
      }
      return null;
    };

    pushIfExists("vulnerabilities", arrToPgArray(body.vulnerabilities));
    pushIfExists("medical_conditions", arrToPgArray(body.medical_conditions));
    pushIfExists(
      "dietary_requirements",
      arrToPgArray(body.dietary_requirements)
    );

    if (!toInsert.length) {
      return res
        .status(400)
        .json({ error: "No valid fields provided for insertion" });
    }

    const placeholders = toInsert.map((_, idx) => `$${idx + 1}`);
    const insertQ = `
      INSERT INTO service_users (${toInsert
        .map((c) => quoteIdent(c))
        .join(", ")})
      VALUES (${placeholders.join(", ")})
      RETURNING *
    `;

    const { rows } = await pool.query(insertQ, values);
    if (!rows.length) {
      return res
        .status(500)
        .json({ error: "Failed to create service user" });
    }

    // Log the creation activity
    try {
      await logActivity({
        userId: req.user.id,
        action: 'create_service_user',
        actionType: 'crud',
        resource: 'service_users',
        resourceId: rows[0].id,
        description: `Created service user: ${body.first_name} ${body.last_name}`,
        metadata: {
          user_name: `${body.first_name} ${body.last_name}`,
          status: body.status || 'Active'
        },
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers['user-agent']
      });
    } catch (logError) {
      console.error('Failed to log service user creation:', logError);
    }

    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Error creating service user:", error);
    return res.status(500).json({
      error: "Error creating service user",
      details: error.message,
    });
  }
});

/* -------------------- UPDATE -------------------- */

/**
 * PUT /api/su/users/:id
 */
router.put("/users/:id", protect, async (req, res) => {
  try {
    const ready = await ensureServiceUsersTable();
    if (!ready) {
      return res.status(500).json({ error: "service_users table not available" });
    }

    const rawId = req.params.id;
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      return res
        .status(400)
        .json({ error: "Invalid id - must be a positive integer" });
    }

    if (!pool || typeof pool.query !== "function") {
      return res.status(500).json({ error: "DB not initialized" });
    }

    // Get all columns from service_users table
    const { rows: suColsRows } = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'service_users'
    `);
    const suCols = suColsRows.map((r) => r.column_name);

    // Destructure all possible fields from request body
    const {
      first_name,
      last_name,
      date_of_birth,
      dob,
      nationality,
      home_office_reference,
      gender,
      immigration_status,
      family_type,
      number_of_dependents,
      emergency_contact_name,
      emergency_contact_phone,
      vulnerabilities,
      medical_conditions,
      dietary_requirements,
      property_id,
      property,
      room_id,
      room_number,
      room,
      admission_date,
      status = "Active",
    } = req.body;

    const sets = [];
    const params = [];

    const pushSet = (colName, val) => {
      if (!suCols.includes(colName)) return;
      const v =
        typeof val === "string" && val.trim() === "" ? null : val;
      if (v !== undefined) {
        params.push(v);
        sets.push(`${quoteIdent(colName)} = $${params.length}`);
      }
    };

    // Basic fields
    pushSet("first_name", first_name);
    pushSet("last_name", last_name);
    pushSet("nationality", nationality);
    pushSet("home_office_reference", home_office_reference);
    pushSet("gender", gender);
    pushSet("immigration_status", immigration_status);
    pushSet("family_type", family_type);
    pushSet("number_of_dependents", number_of_dependents);
    pushSet("emergency_contact_name", emergency_contact_name);
    pushSet("emergency_contact_phone", emergency_contact_phone);
    pushSet("status", status);

    // DOB
    const normalizedDob = dob ?? date_of_birth;
    if (normalizedDob !== undefined) {
      if (suCols.includes("dob")) {
        pushSet("dob", normalizedDob);
      }
      if (suCols.includes("date_of_birth")) {
        pushSet("date_of_birth", normalizedDob);
      }
    }

    // property / hotel
    if (property_id !== undefined) {
      pushSet("property_id", property_id);
    }
    if (property !== undefined) {
      pushSet("property", property);
    }

    // room
    if (room_id !== undefined) {
      pushSet("room_id", room_id);
    }

    if (room_number !== undefined) {
      pushSet("room_number", room_number);
    } else if (room !== undefined) {
      pushSet("room", room);
    } else if (room_id !== undefined) {
      try {
        const names = await resolveSchemaNames();
        const roomTable = names.roomTable || "rooms";
        if (roomTable) {
          const roomNumberCol = await columnExists(roomTable, "room_number");
          if (roomNumberCol) {
            const r = await pool.query(
              `SELECT room_number::text AS room_number FROM ${quoteIdent(roomTable)} WHERE id = $1 LIMIT 1`,
              [Number(room_id)]
            );
            const rn = r.rows?.[0]?.room_number;
            if (rn !== undefined) {
              pushSet("room_number", rn);
            }
          }
        }
      } catch (e) {
        // best-effort
      }
    }

    // admission date
    if (admission_date !== undefined) {
      pushSet("admission_date", admission_date);
    }

    // Handle array-like fields for PostgreSQL array columns
    const handleArrayField = (value) => {
      if (value === undefined || value === null) return null;
      if (Array.isArray(value)) {
        // Filter out empty strings and return array
        const filtered = value.filter(item => item !== null && item !== undefined && String(item).trim() !== "");
        return filtered.length > 0 ? filtered : null;
      }
      // If it's a string, check if it's comma-separated and convert to array
      if (typeof value === "string" && value.trim() !== "") {
        const split = value.split(",").map(s => s.trim()).filter(s => s !== "");
        return split.length > 0 ? split : null;
      }
      return null;
    };

    const arrayFields = {
      vulnerabilities,
      medical_conditions,
      dietary_requirements,
    };

    for (const [field, value] of Object.entries(arrayFields)) {
      if (suCols.includes(field)) {
        const processedValue = handleArrayField(value);
        if (processedValue !== null) {
          pushSet(field, processedValue);
        } else {
          // Explicitly set to null if value is null/empty
          pushSet(field, null);
        }
      }
    }

    if (sets.length === 0) {
      return res
        .status(400)
        .json({ error: "No valid fields to update" });
    }

    params.push(id);
    const updateQ = `
      UPDATE service_users
      SET ${sets.join(", ")}
      WHERE id = $${params.length}
      RETURNING *
    `;

    const { rows } = await pool.query(updateQ, params);
    if (!rows.length) {
      return res.status(404).json({ error: "Service user not found" });
    }

    // Log the update activity
    try {
      await logActivity({
        userId: req.user.id,
        action: 'update_service_user',
        actionType: 'crud',
        resource: 'service_users',
        resourceId: id,
        description: `Updated service user: ${rows[0].first_name} ${rows[0].last_name}`,
        metadata: {
          user_name: `${rows[0].first_name} ${rows[0].last_name}`,
          updated_fields: sets.map(s => s.split(' = ')[0]).join(', ')
        },
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers['user-agent']
      });
    } catch (logError) {
      console.error('Failed to log service user update:', logError);
    }

    return res.json(rows[0]);
  } catch (error) {
    console.error("Error updating service user:", error);
    return res.status(500).json({
      error: "Error updating service user",
      details: error.message,
    });
  }
});

/* -------------------- DELETE -------------------- */

router.delete("/users/:id", protect, async (req, res) => {
  try {
    const rawId = req.params.id;
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      return res
        .status(400)
        .json({ error: "Invalid id - must be a positive integer" });
    }

    // Get user info before deleting for activity logging
    const { rows: userRows } = await pool.query(
      `SELECT first_name, last_name FROM service_users WHERE id = $1`,
      [id]
    );
    
    const { rowCount } = await pool.query(
      `DELETE FROM service_users WHERE id = $1`,
      [id]
    );
    if (!rowCount) return res.status(404).json({ error: "Not found" });

    // Log the deletion activity
    try {
      const deletedUser = userRows[0];
      await logActivity({
        userId: req.user.id,
        action: 'delete_service_user',
        actionType: 'crud',
        resource: 'service_users',
        resourceId: id,
        description: `Deleted service user: ${deletedUser?.first_name || 'Unknown'} ${deletedUser?.last_name || 'User'}`,
        metadata: {
          user_name: `${deletedUser?.first_name || 'Unknown'} ${deletedUser?.last_name || 'User'}`,
          deleted_id: id
        },
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers['user-agent']
      });
    } catch (logError) {
      console.error('Failed to log service user deletion:', logError);
    }

    return res.json({ ok: true, deletedId: id });
  } catch (err) {
    console.error(
      "DELETE /api/su/users/:id error:",
      err && err.stack ? err.stack : err
    );
    return res
      .status(500)
      .json({ error: "Server error", details: err?.message });
  }
});

/**
 * GET /api/su/:hotelId
 * Get service users for a specific hotel (alternative endpoint name)
 * NOTE: This route MUST be last to avoid matching /users/:id
 */
router.get("/:hotelId", async (req, res) => {
  try {
    const { hotelId } = req.params;

    if (!hotelId) {
      return res.status(400).json({ error: "hotelId is required" });
    }

    if (!pool || typeof pool.query !== "function")
      return res.status(500).json({ error: "DB not initialized" });

    const names = await resolveSchemaNames();
    const su = "service_users";
    const suAlias = "su";

    const joins = [];
    let selectHotelName = "NULL AS hotel_name";
    let selectRoomNumber = "NULL AS room_number";
    let whereClause = "";

    // Detect which column to use for hotel filtering
    let hotelFilterCol = null;
    if (names.hotelFk && isValidIdentifier(names.hotelFk)) {
      hotelFilterCol = names.hotelFk;
    } else {
      const hotelCols = ["hotel_id", "property_id", "accommodation_id", "hotelid", "propertyid"];
      for (const col of hotelCols) {
        const exists = await columnExists(su, col);
        if (exists) {
          hotelFilterCol = col;
          break;
        }
      }
    }

    if (hotelFilterCol) {
      whereClause = `WHERE ${suAlias}.${quoteIdent(hotelFilterCol)} = $1`;
    }

    // Join hotel table if possible
    if (names.hotelTable && names.hotelFk && isValidIdentifier(names.hotelFk)) {
      joins.push(
        `LEFT JOIN ${quoteIdent(names.hotelTable)} h ON ${suAlias}.${quoteIdent(
          names.hotelFk
        )} = h.id`
      );
      selectHotelName = `h.name AS hotel_name`;
    } else if (names.hotelTable) {
      const fallbackCol = await columnExists(su, "hotel_id");
      if (fallbackCol) {
        joins.push(
          `LEFT JOIN ${quoteIdent(names.hotelTable)} h ON ${suAlias}.${quoteIdent(
            fallbackCol
          )} = h.id`
        );
        selectHotelName = `h.name AS hotel_name`;
      }
    }

    // Join room table if possible
    if (names.roomTable && names.roomFk && isValidIdentifier(names.roomFk)) {
      joins.push(
        `LEFT JOIN ${quoteIdent(names.roomTable)} r ON ${suAlias}.${quoteIdent(
          names.roomFk
        )} = r.id`
      );
      selectRoomNumber = `r.room_number::text AS room_number`;
    } else if (names.roomTable) {
      const fallbackCol = await columnExists(su, "room_id");
      if (fallbackCol) {
        joins.push(
          `LEFT JOIN ${quoteIdent(names.roomTable)} r ON ${suAlias}.${quoteIdent(
            fallbackCol
          )} = r.id`
        );
        selectRoomNumber = `r.room_number::text AS room_number`;
      }
    }

    // If we couldn't join room table, but service_users has a text column like room_number/room, select that
    const { rows: suColsRows } = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'service_users'
    `);
    const suCols = suColsRows.map((r) => r.column_name);

    if (selectRoomNumber.startsWith("NULL")) {
      if (suCols.includes("room_number")) {
        selectRoomNumber = `${suAlias}.room_number::text AS room_number`;
      } else if (suCols.includes("room")) {
        selectRoomNumber = `${suAlias}.room::text AS room_number`;
      }
    }

    if (selectHotelName.startsWith("NULL")) {
      if (suCols.includes("hotel_name")) {
        selectHotelName = `${suAlias}.hotel_name AS hotel_name`;
      } else if (suCols.includes("property")) {
        selectHotelName = `${suAlias}.property AS hotel_name`;
      } else if (suCols.includes("hotel")) {
        selectHotelName = `${suAlias}.hotel AS hotel_name`;
      } else if (suCols.includes("property_name")) {
        selectHotelName = `${suAlias}.property_name AS hotel_name`;
      }
    }

    const q = `
      SELECT ${suAlias}.*,
             ${selectHotelName},
             ${selectRoomNumber}
      FROM ${su} ${suAlias}
      ${joins.join("\n")}
      ${whereClause}
      ORDER BY ${suAlias}.id DESC
    `;

    const params = [hotelId];
    const { rows } = await pool.query(q, params);

    // Normalize data for consistent frontend consumption
    const normalizedRows = rows.map((row) => {
      // Ensure property/hotel_name is available
      if (!row.property && row.hotel_name) {
        row.property = row.hotel_name;
      }
      if (!row.property_name && row.hotel_name) {
        row.property_name = row.hotel_name;
      }

      // Normalize array fields to strings
      if (Array.isArray(row.family_type)) {
        row.family_type = row.family_type[0] || row.family_type.join(", ");
      }
      if (Array.isArray(row.emergency_contact_name)) {
        row.emergency_contact_name = row.emergency_contact_name[0] || row.emergency_contact_name.join(", ");
      }
      if (Array.isArray(row.emergency_contact_phone)) {
        row.emergency_contact_phone = row.emergency_contact_phone[0] || row.emergency_contact_phone.join(", ");
      }

      // Ensure number_of_dependents is a number
      if (row.number_of_dependents === null || row.number_of_dependents === undefined) {
        row.number_of_dependents = 0;
      } else {
        row.number_of_dependents = Number(row.number_of_dependents) || 0;
      }

      return row;
    });

    return res.json(normalizedRows);
  } catch (err) {
    console.error(
      "GET /api/su/:hotelId error:",
      err && err.stack ? err.stack : err
    );
    return res.status(500).json({
      error: "Server error while fetching service users",
      details: err?.message,
    });
  }
});

export default router;
