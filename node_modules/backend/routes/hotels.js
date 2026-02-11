// backend/routes/hotels.js
// NOTE: screenshot / context file: /mnt/data/2025-11-25T04-06-53.196Z.png

import express from "express";
import pool from "../config/db.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

/**
 * Try to resolve a manager input (id, name, partial name, email) to a user id.
 * Returns numeric id or null.
 */
async function resolveManagerInput(managerInput) {
  if (managerInput === null || typeof managerInput === "undefined") return null;
  const raw = String(managerInput).trim();
  if (raw === "") return null;

  // numeric id
  if (/^\d+$/.test(raw)) return Number(raw);

  try {
    // Exact name match
    let r = await pool.query(
      `SELECT id FROM users WHERE name = $1 LIMIT 1`,
      [raw]
    );
    if (r.rows.length) return r.rows[0].id;

    // Case-insensitive partial match
    r = await pool.query(
      `SELECT id FROM users WHERE name ILIKE $1 LIMIT 1`,
      [`%${raw}%`]
    );
    if (r.rows.length) return r.rows[0].id;

    // Try email if input looks like email
    if (/^[^@]+@[^@]+\.[^@]+$/.test(raw)) {
      r = await pool.query(
        `SELECT id FROM users WHERE email = $1 LIMIT 1`,
        [raw]
      );
      if (r.rows.length) return r.rows[0].id;
    }
  } catch (err) {
    console.warn("resolveManagerInput error:", err?.message || err);
  }
  return null;
}

/**
 * Fetch hotels with manager info.
 * We SELECT h.* (so SQL won't fail when some optional columns are not present),
 * then normalize the row fields in JS to provide a consistent object shape.
 *
 * Optional sqlWhere should include WHERE and use parameter placeholders ($1...).
 */
async function fetchHotelsWithManager(sqlWhere = "", params = []) {
  const q = `
    SELECT h.*, u.name AS manager_name, u.email AS manager_email
    FROM hotels h
    LEFT JOIN users u ON u.id = h.manager_id
    ${sqlWhere}
    ORDER BY h.name
  `;
  const res = await pool.query(q, params);

  // Normalize several possible column names into consistent keys the frontend expects
  const normalized = res.rows.map((r) => {
    // r may have many possible shapes depending on your DB schema/migrations.
    // We safely pick whichever column exists and set defaults.
    const propertyTypeCandidates = [r.property_type, r.type, r.category];
    const postcodeCandidates = [r.postcode, r.zipcode, r.postal_code];
    const totalBedsCandidates = [r.total_beds, r.total_bed, r.beds];
    const occupiedBedsCandidates = [r.occupied_beds, r.occupied, r.occupied_bed];
    const totalFloorsCandidates = [r.total_floors, r.floors, r.no_of_floors, r.number_of_floors];

    const obj = {
      ...r, // keep all existing DB columns for backward compatibility
      // normalize phone/contact
      phone: r.manager_phone || r.phone || r.contact_phone || r.contact || null,
      // normalized manager fields already come from the join (manager_name, manager_email)
      manager_name: r.manager_name || r.manager_name || r.manager || null,
      manager_email: r.manager_email || r.manager_email || r.email || null,
      // normalized property_type
      property_type: propertyTypeCandidates.find(v => typeof v !== "undefined" && v !== null && String(v).trim() !== "") || "Hotel Style",
      // status / fallback
      status: (typeof r.status !== "undefined" && r.status !== null) ? r.status : (r.state_status || null),
      // postcode
      postcode: postcodeCandidates.find(v => typeof v !== "undefined" && v !== null) || null,
      // total beds / occupied beds as numbers
      total_beds: Number(totalBedsCandidates.find(v => typeof v !== "undefined" && v !== null) ?? 0) || 0,
      occupied_beds: Number(occupiedBedsCandidates.find(v => typeof v !== "undefined" && v !== null) ?? 0) || 0,
      // total floors normalized for RoomsManager floor dropdown
      total_floors: (() => {
        const v = totalFloorsCandidates.find(x => typeof x !== "undefined" && x !== null && String(x) !== "");
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      })(),
      // is_self_contained: if explicit column exists use it, else infer from property_type
      is_self_contained: (typeof r.is_self_contained !== "undefined" && r.is_self_contained !== null)
        ? !!r.is_self_contained
        : (String(propertyTypeCandidates.find(v => typeof v !== "undefined" && v !== null) || "").toLowerCase() === "self-contained"),
      // description/about
      description: r.description ?? r.about ?? r.notes ?? "",
      // logo url
      logo_url: r.logo_url ?? r.logo ?? null,
      // created/updated timestamps
      created_at: r.created_at ?? r.created_on ?? null,
      updated_at: r.updated_at ?? r.modified_at ?? null,
    };

    return obj;
  });

  return normalized;
}

/**
 * Ensure hotel_access table exists. Attempts to create it if missing.
 * Returns true if table exists or was created successfully.
 * Throws if creation fails for another reason (permissions etc.).
 */
async function ensureHotelAccessTableExists() {
  const createSQL = `
    CREATE TABLE IF NOT EXISTS hotel_access (
      hotel_id  bigint NOT NULL,
      user_id   bigint NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (hotel_id, user_id)
    );
  `;
  // Try a lightweight check first: query information_schema
  try {
    const check = await pool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'hotel_access' LIMIT 1`
    );
    if (check.rows && check.rows.length) return true;
  } catch (e) {
    // ignore and try to create below
  }

  try {
    await pool.query(createSQL);
    // Note: we intentionally avoid adding FK constraints here, to keep creation safe across environments
    return true;
  } catch (err) {
    console.error("ensureHotelAccessTableExists failed:", err?.message || err);
    throw err;
  }
}

/* Create hotel (admin OR manager) */
router.post("/", protect, async (req, res) => {
  try {
    const body = req.body || {};
    const name = (body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Property name required" });

    // normalize inputs and accept new fields
    const code = body.code ?? null;
    const address = body.address ?? body.address_line ?? null;
    const city = body.city ?? null;
    const state = body.state ?? null;
    const country = body.country ?? null;
    const phone = body.manager_phone ?? body.phone ?? body.contact_phone ?? null;
    const branchVal = body.branch ?? null;
    const rating = (typeof body.rating !== "undefined" && body.rating !== "") ? Number(body.rating) : null;

    const property_type = body.property_type ?? body.type ?? null;
    const status = body.status ?? null;
    const postcode = body.postcode ?? body.zipcode ?? body.postal_code ?? null;
    const total_beds = Number.isFinite(Number(body.total_beds)) ? Number(body.total_beds) : (Number.isFinite(Number(body.total_bed)) ? Number(body.total_bed) : 0);
    const occupied_beds = Number.isFinite(Number(body.occupied_beds)) ? Number(body.occupied_beds) : (Number.isFinite(Number(body.occupied)) ? Number(body.occupied) : 0);
    const total_floors = (typeof body.total_floors !== "undefined" && body.total_floors !== "") ? Number(body.total_floors) : null;
    const is_self_contained = (typeof body.is_self_contained !== "undefined") ? !!body.is_self_contained : undefined;
    const description = body.description ?? body.about ?? null;
    const managerInput = body.manager ?? body.manager_id ?? body.manager_name ?? body.managerName ?? null;

    // Admin can set manager and branch (manager resolved from input)
    if (req.user.role === "admin") {
      const managerId = managerInput ? await resolveManagerInput(managerInput) : null;

      const insertQ = `
        INSERT INTO hotels
          (name, code, address, city, state, country, phone, rating, manager_id, branch,
           property_type, status, postcode, total_beds, occupied_beds, total_floors, is_self_contained, description, created_at, updated_at)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW(),NOW())
        RETURNING id;
      `;
      const insertVals = [
        name, code, address, city, state, country, phone, rating, managerId, branchVal,
        property_type, status, postcode, total_beds, occupied_beds, total_floors, is_self_contained, description
      ];

      const insert = await pool.query(insertQ, insertVals);
      const createdId = insert.rows[0].id;
      const createdRows = await fetchHotelsWithManager("WHERE h.id = $1", [createdId]);
      return res.status(201).json(createdRows[0]);
    }

    // Manager: force manager_id and branch from req.user
    if (req.user.role === "manager") {
      const forcedManagerId = req.user.id;
      const forcedBranch = req.user.branch ?? null;

      const insertQ = `
        INSERT INTO hotels
          (name, code, address, city, state, country, phone, rating, manager_id, branch,
           property_type, status, postcode, total_beds, occupied_beds, total_floors, is_self_contained, description, created_at, updated_at)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW(),NOW())
        RETURNING id;
      `;
      const insertVals = [
        name, code, address, city, state, country, phone, rating, forcedManagerId, forcedBranch,
        property_type, status, postcode, total_beds, occupied_beds, total_floors, is_self_contained, description
      ];

      const insert = await pool.query(insertQ, insertVals);
      const createdId = insert.rows[0].id;
      const createdRows = await fetchHotelsWithManager("WHERE h.id = $1", [createdId]);
      return res.status(201).json(createdRows[0]);
    }

    return res.status(403).json({ message: "Forbidden" });
  } catch (err) {
    console.error("create property:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* List hotels */
router.get("/", protect, async (req, res) => {
  try {
    if (req.user.role === "admin") {
      const all = await fetchHotelsWithManager();
      return res.json({ hotels: all });
    }
    if (req.user.role === "manager") {
      const rows = await fetchHotelsWithManager("WHERE h.manager_id = $1", [req.user.id]);
      return res.json({ hotels: rows });
    }
    if (req.user.role === "staff") {
      const assignedHotelId = req.user.hotel_id;
      if (!assignedHotelId) {
        return res.json({ hotels: [] });
      }
      const rows = await fetchHotelsWithManager("WHERE h.id = $1", [assignedHotelId]);
      return res.json({ hotels: rows });
    }
    // other roles: default to empty to avoid accidental data exposure
    return res.json({ hotels: [] });
  } catch (err) {
    console.error("list properties:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* Get hotel / property details */
router.get("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await fetchHotelsWithManager("WHERE h.id = $1", [id]);
    if (!rows.length) return res.status(404).json({ message: "Property not found" });
    const hotel = rows[0];

    // If manager, ensure they manage this hotel
    if (req.user && req.user.role === "manager") {
      if (String(hotel.manager_id) !== String(req.user.id)) {
        return res.status(403).json({ message: "Forbidden — not your property" });
      }
    }

    // If staff, ensure they are assigned to this hotel
    if (req.user && req.user.role === "staff") {
      const assignedHotelId = req.user.hotel_id;
      if (!assignedHotelId || String(assignedHotelId) !== String(hotel.id)) {
        return res.status(403).json({ message: "Forbidden — not your assigned property" });
      }
    }

    return res.json(hotel);
  } catch (err) {
    console.error("get property:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* Update hotel (admin OR manager-of-that-hotel) */
router.put("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    // Accept new fields and normalize incoming names
    const name = (typeof body.name !== "undefined") ? body.name : null;
    const code = (typeof body.code !== "undefined") ? body.code : null;
    const address = (typeof body.address !== "undefined") ? (body.address ?? body.address_line ?? null) : null;
    const city = (typeof body.city !== "undefined") ? body.city : null;
    const state = (typeof body.state !== "undefined") ? body.state : null;
    const country = (typeof body.country !== "undefined") ? body.country : null;
    const phone = (typeof body.manager_phone !== "undefined") ? (body.manager_phone ?? body.phone ?? body.contact_phone ?? null) : null;
    const branch = (typeof body.branch !== "undefined") ? body.branch : null;
    const rating = (typeof body.rating !== "undefined") ? (body.rating === "" ? null : Number(body.rating)) : undefined;

    const property_type = (typeof body.property_type !== "undefined") ? body.property_type : undefined;
    const status = (typeof body.status !== "undefined") ? body.status : undefined;
    const postcode = (typeof body.postcode !== "undefined") ? body.postcode : (typeof body.zipcode !== "undefined" ? body.zipcode : undefined);
    const total_beds = (typeof body.total_beds !== "undefined") ? (Number.isFinite(Number(body.total_beds)) ? Number(body.total_beds) : 0) : undefined;
    const occupied_beds = (typeof body.occupied_beds !== "undefined") ? (Number.isFinite(Number(body.occupied_beds)) ? Number(body.occupied_beds) : 0) : undefined;
    const total_floors = (typeof body.total_floors !== "undefined" && body.total_floors !== "") ? Number(body.total_floors) : undefined;
    const is_self_contained = (typeof body.is_self_contained !== "undefined") ? !!body.is_self_contained : undefined;
    const description = (typeof body.description !== "undefined") ? body.description : (typeof body.about !== "undefined" ? body.about : undefined);

    const managerInput = body.manager ?? body.manager_id ?? body.manager_name ?? body.managerName ?? null;
    const managerId = managerInput ? await resolveManagerInput(managerInput) : null;

    // Admin: full rights (may reassign manager & branch)
    if (req.user.role === "admin") {
      // Build dynamic SET clause safely using COALESCE where appropriate
      const updateQ = `
        UPDATE hotels SET
          name = COALESCE($1, name),
          code = COALESCE($2, code),
          address = COALESCE($3, address),
          city = COALESCE($4, city),
          state = COALESCE($5, state),
          country = COALESCE($6, country),
          phone = COALESCE($7, phone),
          rating = COALESCE($8, rating),
          manager_id = COALESCE($9, manager_id),
          branch = COALESCE($10, branch),
          property_type = COALESCE($11, property_type),
          status = COALESCE($12, status),
          postcode = COALESCE($13, postcode),
          total_beds = COALESCE($14, total_beds),
          occupied_beds = COALESCE($15, occupied_beds),
          total_floors = COALESCE($16, total_floors),
          is_self_contained = COALESCE($17, is_self_contained),
          description = COALESCE($18, description),
          updated_at = NOW()
        WHERE id = $19
        RETURNING id;
      `;
      const vals = [
        name, code, address, city, state, country, phone,
        (typeof rating === "undefined") ? null : rating,
        managerId, branch, property_type, status, postcode,
        (typeof total_beds === "undefined") ? null : total_beds,
        (typeof occupied_beds === "undefined") ? null : occupied_beds,
        (typeof total_floors === "undefined") ? null : total_floors,
        (typeof is_self_contained === "undefined") ? null : is_self_contained,
        (typeof description === "undefined") ? null : description,
        id
      ];
      const update = await pool.query(updateQ, vals);
      if (!update.rows.length) return res.status(404).json({ message: "Property not found" });

      const rows = await fetchHotelsWithManager("WHERE h.id = $1", [id]);
      return res.json(rows[0]);
    }

    // Manager: only allowed for their own hotels; cannot change manager/branch
    if (req.user.role === "manager") {
      const check = await pool.query("SELECT manager_id FROM hotels WHERE id = $1 LIMIT 1", [id]);
      if (!check.rows.length) return res.status(404).json({ message: "Property not found" });

      if (String(check.rows[0].manager_id) !== String(req.user.id)) {
        return res.status(403).json({ message: "Forbidden — you are not the manager of this property" });
      }

      const updateQ = `
        UPDATE hotels SET
          name = COALESCE($1, name),
          code = COALESCE($2, code),
          address = COALESCE($3, address),
          city = COALESCE($4, city),
          state = COALESCE($5, state),
          country = COALESCE($6, country),
          phone = COALESCE($7, phone),
          rating = COALESCE($8, rating),
          property_type = COALESCE($9, property_type),
          status = COALESCE($10, status),
          postcode = COALESCE($11, postcode),
          total_beds = COALESCE($12, total_beds),
          occupied_beds = COALESCE($13, occupied_beds),
          total_floors = COALESCE($14, total_floors),
          is_self_contained = COALESCE($15, is_self_contained),
          description = COALESCE($16, description),
          updated_at = NOW()
        WHERE id = $17
        RETURNING id;
      `;
      const vals = [
        name, code, address, city, state, country, phone,
        (typeof rating === "undefined") ? null : rating,
        property_type, status, postcode,
        (typeof total_beds === "undefined") ? null : total_beds,
        (typeof occupied_beds === "undefined") ? null : occupied_beds,
        (typeof total_floors === "undefined") ? null : total_floors,
        (typeof is_self_contained === "undefined") ? null : is_self_contained,
        (typeof description === "undefined") ? null : description,
        id
      ];
      await pool.query(updateQ, vals);

      const rows = await fetchHotelsWithManager("WHERE h.id = $1", [id]);
      return res.json(rows[0]);
    }

    return res.status(403).json({ message: "Forbidden" });
  } catch (err) {
    console.error("update property:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* Delete hotel (admin OR manager-of-that-hotel) */
router.delete("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role === "admin") {
      await pool.query("DELETE FROM hotels WHERE id = $1", [id]);
      return res.json({ message: "Property deleted" });
    }

    if (req.user.role === "manager") {
      const check = await pool.query("SELECT manager_id FROM hotels WHERE id = $1 LIMIT 1", [id]);
      if (!check.rows.length) return res.status(404).json({ message: "Property not found" });
      if (String(check.rows[0].manager_id) !== String(req.user.id)) {
        return res.status(403).json({ message: "Forbidden — you are not the manager of this property" });
      }

      await pool.query("DELETE FROM hotels WHERE id = $1", [id]);
      return res.json({ message: "Property deleted" });
    }

    return res.status(403).json({ message: "Forbidden" });
  } catch (err) {
    console.error("delete property:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* -------------------------
   Access endpoints
   GET /api/hotels/:id/access  -> list users allowed for this hotel
   PUT /api/hotels/:id/access  -> update allowed users (replace)
   ------------------------- */

/**
 * Get users who currently have access to a hotel
 */
router.get("/:id/access", protect, async (req, res) => {
  try {
    const { id } = req.params;

    // If staff, only allow access to their assigned hotel
    if (req.user.role === "staff") {
      const assignedHotelId = req.user.hotel_id;
      if (!assignedHotelId || String(assignedHotelId) !== String(id)) {
        return res.status(403).json({ message: "Forbidden — not your assigned property" });
      }
    }

    // If manager, ensure they manage this hotel
    if (req.user.role === "manager") {
      const check = await pool.query("SELECT manager_id FROM hotels WHERE id = $1 LIMIT 1", [id]);
      if (!check.rows.length) return res.status(404).json({ message: "Property not found" });
      if (String(check.rows[0].manager_id) !== String(req.user.id)) {
        return res.status(403).json({ message: "Forbidden — not your property" });
      }
    }

    // Ensure table exists (creates if missing)
    try {
      await ensureHotelAccessTableExists();
    } catch (err) {
      console.warn("hotel_access table not available and could not be created:", err?.message || err);
      // return empty list to the client instead of failing hard
      return res.json({ users: [] });
    }

    // Return list of users who have been granted access (join to users)
    const q = `
      SELECT u.id, u.name, u.email, u.role, u.branch
      FROM hotel_access ha
      JOIN users u ON u.id = ha.user_id
      WHERE ha.hotel_id = $1
      ORDER BY u.name
    `;
    const r = await pool.query(q, [id]);
    return res.json({ users: r.rows });
  } catch (err) {
    // If table missing (Postgres error 42P01 - undefined_table), return empty list instead of crash
    if (err && err.code === "42P01") {
      console.warn("hotel_access table missing — returning empty users list while migration is applied");
      return res.json({ users: [] });
    }
    console.error("get hotel access:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * Update hotel's allowed users (replace existing list)
 * Body: { allowedUserIds: [1,2,3] }
 */
router.put("/:id/access", protect, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { allowedUserIds } = req.body;

    // Staff can never update access lists
    if (req.user.role === "staff") {
      client.release();
      return res.status(403).json({ message: "Forbidden" });
    }

    // validate hotel exists
    const exists = await pool.query("SELECT manager_id FROM hotels WHERE id = $1 LIMIT 1", [id]);
    if (!exists.rows.length) {
      client.release();
      return res.status(404).json({ message: "Property not found" });
    }

    // Only admin OR the manager of the hotel may update access
    if (req.user.role === "manager") {
      if (String(exists.rows[0].manager_id) !== String(req.user.id)) {
        client.release();
        return res.status(403).json({ message: "Forbidden — not your property" });
      }
    } else if (req.user.role !== "admin") {
      client.release();
      return res.status(403).json({ message: "Forbidden" });
    }

    // Ensure hotel_access table exists (create if missing)
    try {
      await ensureHotelAccessTableExists();
    } catch (err) {
      await client.query("ROLLBACK").catch(() => { });
      client.release();
      console.error("hotel_access table missing and could not be created:", err?.message || err);
      return res.status(500).json({ message: "Access table missing on server" });
    }

    // Begin transaction: delete existing then insert provided ids (if any)
    await client.query("BEGIN");
    await client.query("DELETE FROM hotel_access WHERE hotel_id = $1", [id]);

    if (Array.isArray(allowedUserIds) && allowedUserIds.length > 0) {
      // validate user ids are numeric
      const numericIds = allowedUserIds.map(x => Number(x)).filter(n => Number.isFinite(n));
      if (numericIds.length) {
        // Build parameterized bulk insert
        const placeholders = numericIds.map((_, i) => `($1, $${i + 2})`).join(",");
        const params = [id, ...numericIds];
        const insertQ = `INSERT INTO hotel_access (hotel_id, user_id) VALUES ${placeholders}`;
        await client.query(insertQ, params);
      }
    }

    await client.query("COMMIT");
    client.release();
    return res.json({ message: "Access updated" });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch (e) { }
    client.release();
    console.error("update hotel access:", err);
    // If table missing, surface a clear message
    if (err && err.code === "42P01") {
      return res.status(500).json({ message: "Access table missing on server" });
    }
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /api/hotels/:hotelId/service-users
 * Get service users (staff) assigned to a specific hotel
 */
router.get("/:hotelId/service-users", protect, async (req, res) => {
  try {
    const { hotelId } = req.params;

    // If staff, only allow service-users for their assigned hotel
    if (req.user.role === "staff") {
      const assignedHotelId = req.user.hotel_id;
      if (!assignedHotelId || String(assignedHotelId) !== String(hotelId)) {
        return res.status(403).json({ message: "Forbidden — not your assigned property" });
      }
    }

    if (!hotelId) {
      return res.status(400).json({ error: "hotelId is required" });
    }

    // Detect hotel column names
    const hotelCols = ["hotel_id", "property_id", "accommodation_id", "hotelid", "propertyid"];
    let hotelFilterCol = null;

    for (const col of hotelCols) {
      try {
        const r = await pool.query(
          `SELECT 1 FROM information_schema.columns WHERE table_name = 'service_users' AND column_name = $1 LIMIT 1`,
          [col]
        );
        if (r.rows.length) {
          hotelFilterCol = col;
          break;
        }
      } catch (e) {
        // continue
      }
    }

    if (!hotelFilterCol) {
      return res.json({ data: [] });
    }

    // Build dynamic SELECT with only columns that exist
    const selectCols = ['id', 'first_name', 'last_name', 'status'];

    // Check for optional columns
    try {
      const colCheck = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'service_users'
        AND column_name IN ('email', 'phone', 'created_at')
      `);
      const existingCols = colCheck.rows.map(r => r.column_name);
      if (existingCols.includes('email')) selectCols.push('email');
      if (existingCols.includes('phone')) selectCols.push('phone');
      if (existingCols.includes('created_at')) selectCols.push('created_at');
    } catch (e) {
      // continue with default columns
    }

    const query = `
      SELECT ${selectCols.join(', ')}
      FROM service_users
      WHERE "${hotelFilterCol}" = $1
      ORDER BY first_name, last_name
    `;

    const { rows } = await pool.query(query, [hotelId]);
    return res.json({ data: rows });
  } catch (err) {
    console.error("GET /api/hotels/:hotelId/service-users error:", err);
    return res.status(500).json({ error: "Server error", details: err?.message });
  }
});

/**
 * Public summary counts for hotels (properties).
 * GET /api/hotels/summary -> { properties: <number> }
 * This endpoint is intentionally public so landing/login pages can display counts
 * without requiring authentication. It only returns lightweight aggregate counts.
 */
router.get("/summary", async (req, res) => {
  try {
    const r = await pool.query("SELECT COUNT(*)::bigint AS cnt FROM hotels");
    const count = r.rows && r.rows[0] ? Number(r.rows[0].cnt || r.rows[0].count || 0) : 0;
    return res.json({ properties: count });
  } catch (err) {
    console.error("hotels summary error:", err?.message || err);
    return res.status(500).json({ properties: null });
  }
});

export default router;