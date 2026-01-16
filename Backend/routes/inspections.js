// Backend/routes/inspections.js
import express from "express";
import poolImport from "../config/db.js"; // adjust path if needed

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

/* LIST */
router.get("/", async (req, res) => {
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
router.get("/:id", async (req, res) => {
  try {
    const ready = await ensureInspectionsTable();
    if (!ready) {
      return res.status(500).json({ success: false, message: "Database not initialized" });
    }

    const { id } = req.params;
    const { rows } = await pool.query("SELECT * FROM inspections WHERE id = $1 LIMIT 1", [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("GET /api/inspections/:id error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* CREATE */
router.post("/", async (req, res) => {
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
    const finalProperty = property || propertyId;

    const ref = reference || makeReference();

    // Get existing columns in inspections table
    const { rows: colRows } = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'inspections'
    `);
    const existingCols = colRows.map(r => r.column_name);

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
    for (const col of existingCols) {
      if (!standardCols.includes(col) && req.body[col] !== undefined) {
        columnsToInsert.push(col);
        valuesToInsert.push(req.body[col]);
      }
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
router.put("/:id", async (req, res) => {
  try {
    const ready = await ensureInspectionsTable();
    if (!ready) {
      return res.status(500).json({ success: false, message: "Database not initialized" });
    }

    const { id } = req.params;
      // get existing columns so we only try to update columns that exist
      const { rows: colRows } = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'inspections'
      `);
      const existingCols = colRows.map(r => r.column_name);

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
          values.push(val);
          idx++;
        }
      }

    // Handle custom columns from Forms Builder
    const standardCols = ['id', 'reference', 'inspection_type', 'inspector_name', 'inspection_date', 
                          'status', 'property', 'property_name', 'service_user', 'findings', 
                          'issues_found', 'action_required', 'priority', 'created_at', 'updated_at'];
    for (const col of existingCols) {
      if (!standardCols.includes(col) && req.body[col] !== undefined) {
        updates.push(`${col} = $${idx}`);
        values.push(req.body[col]);
        idx++;
      }
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
router.delete("/:id", async (req, res) => {
  try {
    const ready = await ensureInspectionsTable();
    if (!ready) {
      return res.status(500).json({ success: false, message: "Database not initialized" });
    }

    const { id } = req.params;
    const { rows } = await pool.query("DELETE FROM inspections WHERE id = $1 RETURNING *", [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("DELETE /api/inspections/:id error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
