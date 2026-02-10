// Backend/routes/inspections.js
import express from "express";
import poolImport from "../config/db.js"; // adjust path if needed
import { protect } from "../middleware/auth.js";

const router = express.Router();
const pool = poolImport && poolImport.default ? poolImport.default : poolImport;

/*
  Endpoints:
  GET    /api/inspections         -> list inspections (supports ?q, ?status, ?property, ?limit, ?offset)
  GET    /api/inspections/:id     -> get single inspection
  POST   /api/inspections         -> create inspection
  PUT    /api/inspections/:id     -> update inspection
  DELETE /api/inspections/:id     -> delete inspection
*/

// Helper: ensure inspections table exists
let inspectionsTableReady = false;
async function ensureInspectionsTable() {
  if (inspectionsTableReady) return true;
  try {
    const check = await pool.query(`SELECT to_regclass('public.inspections') AS exists`);
    if (check.rows?.[0]?.exists) {
      inspectionsTableReady = true;
      return true;
    }
    console.warn("inspections table missing. Creating it now...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inspections (
        id SERIAL PRIMARY KEY,
        reference VARCHAR(255) UNIQUE NOT NULL,
        inspection_type VARCHAR(255) NOT NULL,
        property INTEGER,
        service_user INTEGER,
        inspector_name VARCHAR(255) NOT NULL,
        inspection_date DATE NOT NULL,
        findings TEXT,
        issues_found INTEGER DEFAULT 0,
        action_required BOOLEAN DEFAULT FALSE,
        status VARCHAR(50) DEFAULT 'pending',
        priority VARCHAR(50) DEFAULT 'Medium',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Create indexes
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_inspections_status ON inspections(status)`
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_inspections_inspection_date ON inspections(inspection_date)`
    );
    inspectionsTableReady = true;
    return true;
  } catch (err) {
    console.error("Failed to ensure inspections table:", err?.message || err);
    return false;
  }
}

// Helper: generate unique reference if not provided
function makeReference() {
  const rnd = Math.floor(1000 + Math.random() * 9000);
  const year = new Date().getFullYear();
  return `ISPT-${year}-${rnd}`;
}

function coerceValueByPgType(pgType, value) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  // Most common culprit: empty string sent for numeric/date/boolean
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const t = String(pgType || "").toLowerCase();

  if (t.includes("boolean")) {
    if (typeof value === "boolean") return value;
    const s = String(value).trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(s)) return true;
    if (["false", "0", "no", "n", "off"].includes(s)) return false;
    throw new Error(`Invalid boolean value: ${value}`);
  }

  // numeric/decimal/real/double precision
  if (t.includes("numeric") || t.includes("decimal") || t.includes("real") || t.includes("double")) {
    const num = Number(value);
    if (Number.isNaN(num)) throw new Error(`Invalid number value: ${value}`);
    return num;
  }

  // integer / bigint
  if (t.includes("integer") || t.includes("bigint") || t.includes("smallint")) {
    const num = Number.parseInt(String(value), 10);
    if (Number.isNaN(num)) throw new Error(`Invalid integer value: ${value}`);
    return num;
  }

  // date / timestamp
  if (t.includes("date") || t.includes("timestamp")) {
    // Let Postgres parse valid ISO/date strings; only null out empty string above
    return value;
  }

  // fallback (text, varchar, etc)
  return value;
}



/* LIST */
router.get("/", protect, async (req, res) => {
  try {
    const ready = await ensureInspectionsTable();
    if (!ready) {
      return res.status(500).json({ success: false, message: "Database not initialized" });
    }

    const {
      q,
      status,
      property,
      property_id,
      propertyId,
      hotel_id,
      hotelId,
      property_name,
      propertyName,
      hotel_name,
      hotelName,
      limit = 100,
      offset = 0,
    } = req.query;

    const currentUser = req.user;
    let restrictedHotelIds = null;

    // --- Role-Based Restriction Logic ---
    if (currentUser.role === "manager") {
      // Managers see hotels they manage OR hotels in their branch
      const managedRes = await pool.query("SELECT id FROM hotels WHERE manager_id = $1", [currentUser.id]);
      const managedIds = managedRes.rows.map(r => r.id);

      let branchIds = [];
      if (currentUser.branch) {
        const branchRes = await pool.query("SELECT id FROM hotels WHERE branch = $1", [currentUser.branch]);
        branchIds = branchRes.rows.map(r => r.id);
      }

      restrictedHotelIds = [...new Set([...managedIds, ...branchIds])];
    } else if (currentUser.role === "staff") {
      // Staff: only assigned property
      const assignedHotelId = currentUser.hotel_id || currentUser.hotelId || currentUser.hotel || null;
      restrictedHotelIds = assignedHotelId ? [assignedHotelId] : [];
    }
    // Admin sees everything (restrictedHotelIds remains null)

    // Detect which property column exists in current inspections table
    const { rows: colRows } = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'inspections'`
    );
    const existingCols = new Set((colRows || []).map((r) => r.column_name));
    const propertyFilterColumn = existingCols.has("property_id")
      ? "property_id"
      : existingCols.has("hotel_id")
        ? "hotel_id"
        : existingCols.has("property_name")
          ? "property_name"
          : existingCols.has("property")
            ? "property"
            : null;

    // Determine the column to use for ID-based filtering (property, property_id, hotel_id)
    // We prefer an ID column for reliable filtering.
    const idColumn = existingCols.has("property") ? "property" :
      existingCols.has("property_id") ? "property_id" :
        existingCols.has("hotel_id") ? "hotel_id" : null;


    const propertyIdValue = property_id ?? propertyId ?? hotel_id ?? hotelId ?? property ?? null;
    const propertyNameValue = property_name ?? propertyName ?? hotel_name ?? hotelName ?? null;
    let propertyFilterValue = null;
    if (propertyFilterColumn === "property_name") {
      propertyFilterValue = propertyNameValue;
      // If we only have an id, try to resolve name from hotels table
      if (!propertyFilterValue && propertyIdValue) {
        try {
          const r = await pool.query(`SELECT name FROM hotels WHERE id = $1 LIMIT 1`, [propertyIdValue]);
          propertyFilterValue = r.rows?.[0]?.name ?? null;
        } catch (e) {
          // ignore lookup errors
        }
      }
    } else {
      propertyFilterValue = propertyIdValue;
    }

    // base query
    let text = `SELECT * FROM inspections`;
    const where = [];
    const params = [];

    // Apply Restriction
    if (restrictedHotelIds !== null) {
      if (restrictedHotelIds.length === 0) {
        // User has access to NO hotels -> return empty immediately
        return res.json({ success: true, data: [] });
      }

      if (idColumn) {
        // Filter by ID column
        // casting to int if needed, assuming IDs are ints in DB
        where.push(`"${idColumn}"::int = ANY($${params.length + 1}::int[])`);
        params.push(restrictedHotelIds);
      } else if (existingCols.has("property_name")) {
        // Fallback: If we only have property_name, we must fetch names for these IDs
        const nameRes = await pool.query("SELECT name FROM hotels WHERE id = ANY($1::int[])", [restrictedHotelIds]);
        const allowedNames = nameRes.rows.map(r => r.name);
        where.push(`property_name = ANY($${params.length + 1}::text[])`);
        params.push(allowedNames);
      }
    }

    if (q) {
      params.push(`%${q}%`);
      where.push(`(reference ILIKE $${params.length} OR findings ILIKE $${params.length} OR inspector_name ILIKE $${params.length})`);
    }
    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }
    if (
      propertyFilterColumn &&
      propertyFilterValue !== null &&
      propertyFilterValue !== undefined &&
      String(propertyFilterValue).trim() !== ""
    ) {
      params.push(propertyFilterValue);
      if (propertyFilterColumn === "property_name") {
        where.push(`CAST(${propertyFilterColumn} AS text) = $${params.length}`);
      } else {
        where.push(`${propertyFilterColumn} = $${params.length}`);
      }
    }
    if (where.length) {
      text += " WHERE " + where.join(" AND ");
    }

    // add ordering + limit/offset
    params.push(limit);
    params.push(offset);
    text += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const { rows } = await pool.query(text, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("GET /api/inspections error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* GET BY ID */
router.get("/:id", protect, async (req, res) => {
  try {
    const ready = await ensureInspectionsTable();
    if (!ready) {
      return res.status(500).json({ success: false, message: "Database not initialized" });
    }

    const { id } = req.params;
    const { rows } = await pool.query("SELECT * FROM inspections WHERE id = $1 LIMIT 1", [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: "Not found" });

    const currentUser = req.user;
    let restrictedHotelIds = null;
    if (currentUser.role === "manager") {
      const managedRes = await pool.query("SELECT id FROM hotels WHERE manager_id = $1", [currentUser.id]);
      const managedIds = managedRes.rows.map(r => r.id);
      let branchIds = [];
      if (currentUser.branch) {
        const branchRes = await pool.query("SELECT id FROM hotels WHERE branch = $1", [currentUser.branch]);
        branchIds = branchRes.rows.map(r => r.id);
      }
      restrictedHotelIds = [...new Set([...managedIds, ...branchIds])];
    } else if (currentUser.role === "staff") {
      const assignedHotelId = currentUser.hotel_id || currentUser.hotelId || currentUser.hotel || null;
      restrictedHotelIds = assignedHotelId ? [assignedHotelId] : [];
    }

    if (restrictedHotelIds !== null) {
      if (restrictedHotelIds.length === 0) return res.status(404).json({ success: false, message: "Not found" });
      const row = rows[0];
      const pid = row.property ?? row.property_id ?? row.hotel_id ?? null;
      if (!pid || !restrictedHotelIds.some((x) => String(x) === String(pid))) {
        return res.status(404).json({ success: false, message: "Not found" });
      }
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("GET /api/inspections/:id error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* CREATE */
router.post("/", protect, async (req, res) => {
  try {
    const ready = await ensureInspectionsTable();
    if (!ready) {
      return res.status(500).json({ success: false, message: "Database not initialized" });
    }

    const {
      reference,
      inspectionType,
      property,
      propertyId,
      serviceUser,
      inspectorName,
      inspectionDate,
      findings,
      issuesFound,
      actionRequired,
      status,
      priority
    } = req.body;

    // basic validation
    if (!inspectionType || !inspectorName || !inspectionDate) {
      return res.status(400).json({ success: false, message: "Missing required fields: inspectionType, inspectorName, inspectionDate" });
    }

    // Use property or propertyId (frontend might send either)
    let finalProperty = property || propertyId;

    // Restrict staff/manager to allowed properties
    const currentUser = req.user;
    let restrictedHotelIds = null;
    if (currentUser.role === "manager") {
      const managedRes = await pool.query("SELECT id FROM hotels WHERE manager_id = $1", [currentUser.id]);
      const managedIds = managedRes.rows.map(r => r.id);
      let branchIds = [];
      if (currentUser.branch) {
        const branchRes = await pool.query("SELECT id FROM hotels WHERE branch = $1", [currentUser.branch]);
        branchIds = branchRes.rows.map(r => r.id);
      }
      restrictedHotelIds = [...new Set([...managedIds, ...branchIds])];
    } else if (currentUser.role === "staff") {
      const assignedHotelId = currentUser.hotel_id || currentUser.hotelId || currentUser.hotel || null;
      restrictedHotelIds = assignedHotelId ? [assignedHotelId] : [];
      if (assignedHotelId) {
        finalProperty = assignedHotelId;
      }
    }

    if (restrictedHotelIds !== null) {
      if (restrictedHotelIds.length === 0) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
      if (!finalProperty || !restrictedHotelIds.some((x) => String(x) === String(finalProperty))) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
    }

    const ref = reference || makeReference();

    // Get existing columns in inspections table
    const { rows: colRows } = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'inspections'
    `);
    const existingCols = colRows.map(r => r.column_name);
    const colTypeMap = new Map(colRows.map(r => [String(r.column_name), String(r.data_type)]));

    // Build dynamic INSERT based on existing columns
    const columnsToInsert = ['reference', 'inspection_type', 'inspector_name', 'inspection_date', 'status'];
    const valuesToInsert = [ref, inspectionType, inspectorName, inspectionDate, status || "pending"];
    let paramIndex = valuesToInsert.length + 1;

    if (existingCols.includes('property') && finalProperty) {
      columnsToInsert.push('property');
      valuesToInsert.push(finalProperty);
    }

    // If inspections table expects a property_name, try to provide one (body -> hotel lookup -> fallback)
    if (existingCols.includes('property_name')) {
      let propName = req.body.propertyName ?? req.body.property_name ?? req.body.property ?? null;
      if (!propName) {
        // try to resolve from hotels table if we have a property id
        if (finalProperty) {
          try {
            const r = await pool.query(`SELECT name FROM hotels WHERE id = $1 LIMIT 1`, [finalProperty]);
            if (r.rows && r.rows[0] && r.rows[0].name) propName = r.rows[0].name;
          } catch (e) {
            // ignore lookup errors
          }
        }
      }
      // Ensure non-null value (inspections.property_name may be NOT NULL)
      if (!propName) propName = String(finalProperty ?? "");
      columnsToInsert.push('property_name');
      valuesToInsert.push(propName);
    }

    if (existingCols.includes('service_user') && serviceUser) {
      columnsToInsert.push('service_user');
      valuesToInsert.push(serviceUser);
    }

    if (existingCols.includes('findings') && findings) {
      columnsToInsert.push('findings');
      valuesToInsert.push(findings);
    }

    if (existingCols.includes('issues_found') && Number.isFinite(Number(issuesFound))) {
      columnsToInsert.push('issues_found');
      valuesToInsert.push(Number(issuesFound));
    }

    if (existingCols.includes('action_required') && actionRequired !== undefined) {
      columnsToInsert.push('action_required');
      valuesToInsert.push(!!actionRequired);
    }

    if (existingCols.includes('priority') && priority) {
      columnsToInsert.push('priority');
      valuesToInsert.push(priority);
    }

    // Handle custom columns from Forms Builder
    const standardCols = ['id', 'reference', 'inspection_type', 'inspector_name', 'inspection_date',
      'status', 'property', 'property_name', 'service_user', 'findings',
      'issues_found', 'action_required', 'priority', 'created_at', 'updated_at'];
    try {
      for (const col of existingCols) {
        if (standardCols.includes(col)) continue;
        if (req.body[col] === undefined) continue;

        const coerced = coerceValueByPgType(colTypeMap.get(col), req.body[col]);
        if (coerced === undefined) continue;

        columnsToInsert.push(col);
        valuesToInsert.push(coerced);
      }
    } catch (e) {
      return res.status(400).json({ success: false, message: e?.message || "Invalid custom field value" });
    }

    const placeholders = columnsToInsert.map((_, i) => `$${i + 1}`).join(',');
    const query = `
      INSERT INTO inspections
        (${columnsToInsert.join(', ')})
      VALUES
        (${placeholders})
      RETURNING *;
    `;

    const { rows } = await pool.query(query, valuesToInsert);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("POST /api/inspections error:", err);
    // handle unique reference conflict
    if (err.code === "23505") {
      return res.status(409).json({ success: false, message: "Reference already exists" });
    }
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* UPDATE (partial allowed) */
router.put("/:id", protect, async (req, res) => {
  try {
    const ready = await ensureInspectionsTable();
    if (!ready) {
      return res.status(500).json({ success: false, message: "Database not initialized" });
    }

    const { id } = req.params;

    // Enforce scoping by existing record property
    const existingRowRes = await pool.query("SELECT * FROM inspections WHERE id = $1 LIMIT 1", [id]);
    if (!existingRowRes.rows.length) return res.status(404).json({ success: false, message: "Not found" });

    const currentUser = req.user;
    let restrictedHotelIds = null;
    if (currentUser.role === "manager") {
      const managedRes = await pool.query("SELECT id FROM hotels WHERE manager_id = $1", [currentUser.id]);
      const managedIds = managedRes.rows.map(r => r.id);
      let branchIds = [];
      if (currentUser.branch) {
        const branchRes = await pool.query("SELECT id FROM hotels WHERE branch = $1", [currentUser.branch]);
        branchIds = branchRes.rows.map(r => r.id);
      }
      restrictedHotelIds = [...new Set([...managedIds, ...branchIds])];
    } else if (currentUser.role === "staff") {
      const assignedHotelId = currentUser.hotel_id || currentUser.hotelId || currentUser.hotel || null;
      restrictedHotelIds = assignedHotelId ? [assignedHotelId] : [];
    }

    if (restrictedHotelIds !== null) {
      if (restrictedHotelIds.length === 0) return res.status(404).json({ success: false, message: "Not found" });
      const pid = existingRowRes.rows[0]?.property ?? existingRowRes.rows[0]?.property_id ?? existingRowRes.rows[0]?.hotel_id ?? null;
      if (!pid || !restrictedHotelIds.some((x) => String(x) === String(pid))) {
        return res.status(404).json({ success: false, message: "Not found" });
      }
    }
    // get existing columns so we only try to update columns that exist
    const { rows: colRows } = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'inspections'
      `);
    const existingCols = colRows.map(r => r.column_name);
    const colTypeMap = new Map(colRows.map(r => [String(r.column_name), String(r.data_type)]));

    const fields = [
      "reference",
      "inspection_type",
      "property",
      "service_user",
      "inspector_name",
      "inspection_date",
      "findings",
      "issues_found",
      "action_required",
      "status",
      "priority",
      "property_name"
    ];

    // Build dynamic set clause only for existing columns
    const updates = [];
    const values = [];
    let idx = 1;
    for (const key of fields) {
      if (!existingCols.includes(key)) continue; // skip columns that don't exist in DB

      // accept camelCase keys from frontend (e.g., inspectionType)
      const camel = key.replace(/_([a-z])/g, g => g[1].toUpperCase());
      const camelAlt = camel; // e.g., inspectionType
      let bodyValue = req.body[camelAlt] !== undefined ? req.body[camelAlt] : req.body[key];

      // special handling for property_name: allow propertyName/property_name/property or lookup
      if (key === 'property_name') {
        bodyValue = bodyValue ?? req.body.propertyName ?? req.body.property_name ?? null;
        // if not provided, try to resolve from property/propertyId in body
        if (!bodyValue) {
          const finalProperty = req.body.property ?? req.body.propertyId ?? req.body.property_id ?? null;
          if (finalProperty) {
            try {
              const r = await pool.query(`SELECT name FROM hotels WHERE id = $1 LIMIT 1`, [finalProperty]);
              if (r.rows && r.rows[0] && r.rows[0].name) bodyValue = r.rows[0].name;
            } catch (e) {
              // ignore lookup errors
            }
          }
        }
        // fallback to string of property id if still empty (avoid NOT NULL)
        if (bodyValue === null || bodyValue === undefined) {
          bodyValue = String(req.body.property ?? req.body.propertyId ?? req.body.property_id ?? "");
        }
      }

      if (bodyValue !== undefined) {
        updates.push(`${key} = $${idx}`);
        let val = bodyValue;
        if (key === "issues_found") val = Number(bodyValue) || 0;
        if (key === "action_required") val = !!bodyValue;

        // Staff cannot change property; force to assigned
        if (req.user?.role === "staff" && key === "property") {
          const assignedHotelId = req.user.hotel_id || req.user.hotelId || req.user.hotel || null;
          if (assignedHotelId) {
            val = assignedHotelId;
          }
        }

        values.push(val);
        idx++;
      }
    }

    // Handle custom columns from Forms Builder
    const standardCols = ['id', 'reference', 'inspection_type', 'inspector_name', 'inspection_date',
      'status', 'property', 'property_name', 'service_user', 'findings',
      'issues_found', 'action_required', 'priority', 'created_at', 'updated_at'];
    try {
      for (const col of existingCols) {
        if (standardCols.includes(col)) continue;
        if (req.body[col] === undefined) continue;

        const coerced = coerceValueByPgType(colTypeMap.get(col), req.body[col]);
        if (coerced === undefined) continue;

        updates.push(`${col} = $${idx}`);
        values.push(coerced);
        idx++;
      }
    } catch (e) {
      return res.status(400).json({ success: false, message: e?.message || "Invalid custom field value" });
    }

    if (!updates.length) return res.status(400).json({ success: false, message: "No fields to update" });

    // updated_at: only add if column exists in DB
    if (existingCols.includes('updated_at')) {
      updates.push(`updated_at = now()`);
    }

    const query = `UPDATE inspections SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`;
    values.push(id);

    const { rows } = await pool.query(query, values);
    if (!rows.length) return res.status(404).json({ success: false, message: "Not found" });

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("PUT /api/inspections/:id error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* DELETE */
router.delete("/:id", protect, async (req, res) => {
  try {
    const ready = await ensureInspectionsTable();
    if (!ready) {
      return res.status(500).json({ success: false, message: "Database not initialized" });
    }

    const { id } = req.params;

    const existingRowRes = await pool.query("SELECT * FROM inspections WHERE id = $1 LIMIT 1", [id]);
    if (!existingRowRes.rows.length) return res.status(404).json({ success: false, message: "Not found" });

    const currentUser = req.user;
    let restrictedHotelIds = null;
    if (currentUser.role === "manager") {
      const managedRes = await pool.query("SELECT id FROM hotels WHERE manager_id = $1", [currentUser.id]);
      const managedIds = managedRes.rows.map(r => r.id);
      let branchIds = [];
      if (currentUser.branch) {
        const branchRes = await pool.query("SELECT id FROM hotels WHERE branch = $1", [currentUser.branch]);
        branchIds = branchRes.rows.map(r => r.id);
      }
      restrictedHotelIds = [...new Set([...managedIds, ...branchIds])];
    } else if (currentUser.role === "staff") {
      const assignedHotelId = currentUser.hotel_id || currentUser.hotelId || currentUser.hotel || null;
      restrictedHotelIds = assignedHotelId ? [assignedHotelId] : [];
    }

    if (restrictedHotelIds !== null) {
      if (restrictedHotelIds.length === 0) return res.status(404).json({ success: false, message: "Not found" });
      const pid = existingRowRes.rows[0]?.property ?? existingRowRes.rows[0]?.property_id ?? existingRowRes.rows[0]?.hotel_id ?? null;
      if (!pid || !restrictedHotelIds.some((x) => String(x) === String(pid))) {
        return res.status(404).json({ success: false, message: "Not found" });
      }
    }

    const { rows } = await pool.query("DELETE FROM inspections WHERE id = $1 RETURNING *", [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("DELETE /api/inspections/:id error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
