// C:\PostgreAuth\Backend\routes\compliance.js
import express from "express";
import multer from "multer";

let pool;
try {
  // try to load configured DB pool; tolerate different module shapes
  const mod = await import("../config/db.js").catch(async (e) => {
    try {
      return await import("../db/pool.js");
    } catch {
      throw e;
    }
  });
  pool = mod?.default || mod;
} catch (err) {
  console.warn(
    "⚠️ Compliance router: failed to import DB pool. Falling back to stub. Error:",
    err?.message || err
  );
  const errMsg = new Error("DB pool not available for compliance routes; operations will fail");
  errMsg.code = "DB_POOL_MISSING";
  pool = {
    query: async () => {
      throw errMsg;
    },
    connect: async () => {
      throw errMsg;
    },
    on: () => { },
    end: async () => { },
  };
}

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function requireAuth(req, res, next) {
  try {
    if (req.session?.user || req.user) return next();
  } catch { }
  return next();
}

async function safeQuery(sql, params = []) {
  try {
    const result = await pool.query(sql, params);
    return { ok: true, rows: result.rows, rowCount: result.rowCount };
  } catch (err) {
    console.error("Compliance safeQuery error:", err && (err.stack || err.message || err));
    return { ok: false, error: err };
  }
}

let HOTEL_PK_COL = null;
async function getHotelsPkColumn() {
  if (HOTEL_PK_COL) return HOTEL_PK_COL;
  try {
    const r = await safeQuery(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'hotels'`,
      []
    );
    const cols = (r.ok ? r.rows : []).map((x) => x.column_name);
    if (cols.includes('id')) HOTEL_PK_COL = 'id';
    else if (cols.includes('hotel_id')) HOTEL_PK_COL = 'hotel_id';
    else if (cols.includes('property_id')) HOTEL_PK_COL = 'property_id';
    else HOTEL_PK_COL = null;
  } catch {
    HOTEL_PK_COL = null;
  }
  return HOTEL_PK_COL;
}

/* ensure denormalized column exists */
(async function ensureHotelNameColumn() {
  try {
    await safeQuery("ALTER TABLE certificates ADD COLUMN IF NOT EXISTS hotel_name TEXT");
  } catch (err) {
    console.warn("Could not ensure hotel_name column exists:", err && (err.message || err));
  }
})();

(async function ensureCertificateDocumentColumns() {
  try {
    await safeQuery("ALTER TABLE certificates ADD COLUMN IF NOT EXISTS document_name TEXT");
    await safeQuery("ALTER TABLE certificates ADD COLUMN IF NOT EXISTS document_mime TEXT");
    await safeQuery("ALTER TABLE certificates ADD COLUMN IF NOT EXISTS document_data BYTEA");
  } catch (err) {
    console.warn("Could not ensure certificate document columns exist:", err && (err.message || err));
  }
})();

/* join: resolve hotels.name using certificates.hotel_name (text) as canonical source, but prefer ID match */
const HOTEL_JOIN = `
  LEFT JOIN hotels h
    ON (c.property_id IS NOT NULL AND h.id::text = c.property_id::text)
    OR (c.property_id IS NULL AND c.hotel_name IS NOT NULL AND h.name ILIKE c.hotel_name)
`;

/* stats */
router.get("/stats/summary", requireAuth, async (req, res) => {
  try {
    const q = `SELECT
      COUNT(*) FILTER (WHERE expiry_date > (current_date + INTERVAL '30 days') AND is_active IS TRUE) AS valid_count,
      COUNT(*) FILTER (WHERE expiry_date <= (current_date + INTERVAL '30 days') AND expiry_date >= current_date AND is_active IS TRUE) AS expiring_count,
      COUNT(*) FILTER (WHERE expiry_date < current_date AND is_active IS TRUE) AS expired_count
    FROM certificates;`;

    const r = await safeQuery(q);
    if (!r.ok) return res.json({ ok: true, data: { valid_count: 0, expiring_count: 0, expired_count: 0 } });
    return res.json({ ok: true, data: r.rows[0] || { valid_count: 0, expiring_count: 0, expired_count: 0 } });
  } catch (err) {
    console.error("GET /api/compliance/stats/summary unexpected error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* list */
router.get("/", requireAuth, async (req, res) => {
  try {
    // Support both hotel_id (or property_id) param; treat it as either hotel id or hotel name fragment
    const hotelParam = req.query.hotel_id ?? req.query.property_id;
    const hotelNameParam = req.query.hotel_name ?? req.query.site;
    const { status, search } = req.query;

    const hotelPkCol = await getHotelsPkColumn();

    const where = ["c.is_active IS TRUE"];
    const params = [];

    if (hotelParam) {
      // we push the same param (string) and will compare against h.<pk>::text (if available), h.name ILIKE, or c.hotel_name ILIKE
      params.push(String(hotelParam));
      const idx = params.length;
      const pkClause = hotelPkCol ? `h.${hotelPkCol}::text = $${idx} OR ` : "";
      where.push(`(${pkClause}h.name ILIKE '%' || $${idx} || '%' OR c.hotel_name ILIKE '%' || $${idx} || '%')`);
    }

    if (hotelNameParam) {
      params.push(String(hotelNameParam));
      const idx = params.length;
      where.push(`(h.name ILIKE '%' || $${idx} || '%' OR c.hotel_name ILIKE '%' || $${idx} || '%')`);
    }

    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      where.push(`(c.certificate_type ILIKE $${idx} OR c.issued_by ILIKE $${idx} OR c.notes ILIKE $${idx} OR c.hotel_name ILIKE $${idx})`);
    }

    if (status === "expired") where.push("c.expiry_date < current_date");
    else if (status === "expiring") where.push("c.expiry_date BETWEEN current_date AND (current_date + INTERVAL '30 days')");
    else if (status === "valid") where.push("c.expiry_date > (current_date + INTERVAL '30 days')");

    // limit & offset (append after filters so parameter indexes are correct)
    const limit = Math.max(parseInt(req.query.limit || "100", 10) || 100, 1);
    const offset = Math.max(parseInt(req.query.offset || "0", 10) || 0, 0);
    params.push(limit);
    params.push(offset);

    const sql = `SELECT c.*,
      COALESCE(h.name, c.hotel_name) AS hotel_name,
      CASE
        WHEN c.expiry_date < current_date THEN 'expired'
        WHEN c.expiry_date <= (current_date + INTERVAL '30 days') THEN 'expiring'
        ELSE 'valid'
      END AS status
    FROM certificates c
    ${HOTEL_JOIN}
    WHERE ${where.join(" AND ")}
    ORDER BY c.expiry_date ASC
    LIMIT $${params.length - 1} OFFSET $${params.length};`;

    const r = await safeQuery(sql, params);
    if (!r.ok) {
      console.error("Compliance List Query Failed:", r.error);
      return res.status(500).json({ ok: false, error: r.error?.message || "Database Query Warning" });
    }

    const out = (r.rows || []).map((row) => {
      row.hotel_name = row.hotel_name && String(row.hotel_name).trim() ? String(row.hotel_name).trim() : "";
      return row;
    });

    return res.json({ ok: true, data: out });
  } catch (err) {
    console.error("GET /api/compliance error:", err && (err.stack || err.message || err));
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
});

/* get one */
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ ok: false, error: "Invalid id" });

    const sql = `
      SELECT c.*,
        COALESCE(h.name, c.hotel_name) AS hotel_name
      FROM certificates c
      ${HOTEL_JOIN}
      WHERE c.id::text = $1 AND c.is_active = true
    `;
    const r = await safeQuery(sql, [String(id)]);

    if (!r.ok) return res.status(500).json({ ok: false, error: "Server error" });
    if (!r.rows[0]) return res.status(404).json({ ok: false, error: "Not found" });

    const row = r.rows[0];
    row.hotel_name = row.hotel_name && String(row.hotel_name).trim() ? String(row.hotel_name).trim() : "";
    return res.json({ ok: true, data: row });
  } catch (err) {
    console.error("GET /api/compliance/:id error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

router.get("/:id/document", requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ ok: false, error: "Invalid id" });

    const r = await safeQuery(
      "SELECT document_name, document_mime, document_data FROM certificates WHERE id::text = $1 AND is_active = true LIMIT 1",
      [String(id)]
    );
    if (!r.ok) return res.status(500).json({ ok: false, error: "Server error" });
    const row = r.rows?.[0];
    if (!row || !row.document_data) return res.status(404).json({ ok: false, error: "No document" });

    const mime = row.document_mime || "application/octet-stream";
    const filename = row.document_name || `certificate-${id}`;
    res.setHeader("Content-Type", mime);
    res.setHeader(
      "Content-Disposition",
      `inline; filename=\"${String(filename).replace(/\"/g, '')}\"`
    );
    return res.send(row.document_data);
  } catch (err) {
    console.error("GET /api/compliance/:id/document error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* create */
router.post("/", requireAuth, upload.single("document"), async (req, res) => {
  try {
    const {
      certificate_type,
      // accept either a textual hotel name (preferred) or hotel_id/property_id (legacy)
      hotel_id: in_hotel_id,
      property_id: in_property_id,
      hotel_name: in_hotel_name,
      issue_date,
      expiry_date,
      issued_by,
      file_path,
      notes,
    } = req.body || {};

    const document_name = req.file?.originalname || null;
    const document_mime = req.file?.mimetype || null;
    const document_data = req.file?.buffer || null;

    if (!certificate_type || !issue_date || !expiry_date)
      return res.status(400).json({ ok: false, error: "Missing required fields" });

    // Determine hotel_name to store:
    // Priority: explicit hotel_name field > in_hotel_id (if numeric try to lookup hotels.name) > in_property_id (try lookup) > null
    let hotelNameToStore = null;

    if (in_hotel_name && String(in_hotel_name).trim() !== "") {
      hotelNameToStore = String(in_hotel_name).trim();
    } else if (in_hotel_id !== undefined && in_hotel_id !== null && String(in_hotel_id).trim() !== "") {
      // if numeric: try to fetch hotels.name by id
      const candid = String(in_hotel_id).trim();
      if (/^\d+$/.test(candid)) {
        try {
          const hotelPkCol = await getHotelsPkColumn();
          const pk = hotelPkCol && /^[A-Za-z_][A-Za-z0-9_]*$/.test(hotelPkCol) ? hotelPkCol : null;
          const sql = pk ? `SELECT name FROM hotels WHERE ${pk} = $1 LIMIT 1` : "SELECT name FROM hotels WHERE id = $1 LIMIT 1";
          const r = await safeQuery(sql, [Number(candid)]);
          if (r.ok && r.rowCount > 0) hotelNameToStore = r.rows[0].name;
          else hotelNameToStore = candid; // fallback to string provided
        } catch {
          hotelNameToStore = candid;
        }
      } else {
        hotelNameToStore = candid;
      }
    } else if (in_property_id !== undefined && in_property_id !== null && String(in_property_id).trim() !== "") {
      const candid = String(in_property_id).trim();
      if (/^\d+$/.test(candid)) {
        try {
          const hotelPkCol = await getHotelsPkColumn();
          const pk = hotelPkCol && /^[A-Za-z_][A-Za-z0-9_]*$/.test(hotelPkCol) ? hotelPkCol : null;
          const sql = pk ? `SELECT name FROM hotels WHERE ${pk} = $1 LIMIT 1` : "SELECT name FROM hotels WHERE id = $1 LIMIT 1";
          const r = await safeQuery(sql, [Number(candid)]);
          if (r.ok && r.rowCount > 0) hotelNameToStore = r.rows[0].name;
          else hotelNameToStore = candid;
        } catch {
          hotelNameToStore = candid;
        }
      } else {
        hotelNameToStore = candid;
      }
    }

    const insertSql = `INSERT INTO certificates (certificate_type, property_id, hotel_name, issue_date, expiry_date, issued_by, file_path, document_name, document_mime, document_data, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`;
    // property_id we keep as null unless user provided an actual property id that resolves to a properties.id
    let resolvedPropertyId = null;
    // try quick resolve if they provided a numeric property_id (backwards-compatible)
    if (in_property_id !== undefined && in_property_id !== null && /^\d+$/.test(String(in_property_id).trim())) {
      const tryId = Number(String(in_property_id).trim());
      const rp = await safeQuery("SELECT id FROM properties WHERE id = $1 LIMIT 1", [tryId]);
      if (rp.ok && rp.rowCount > 0) resolvedPropertyId = rp.rows[0].id;
    }

    const params = [
      certificate_type,
      resolvedPropertyId,
      hotelNameToStore,
      issue_date,
      expiry_date,
      issued_by || null,
      file_path || document_name || null,
      document_name,
      document_mime,
      document_data,
      notes || null,
      (req.session?.user?.id || req.user?.id || null),
    ];

    const r = await safeQuery(insertSql, params);
    if (!r.ok) {
      const err = r.error;
      if (err && typeof err.code === "string" && err.code === "23503") {
        return res
          .status(400)
          .json({ ok: false, error: `Invalid foreign key value (property_id). Attempted value: ${String(resolvedPropertyId)}` });
      }
      return res.status(500).json({ ok: false, error: "Server error" });
    }

    try {
      const insertedId = r.rows[0]?.id;
      const fetchSql = `
        SELECT c.*,
          COALESCE(h.name, c.hotel_name) AS hotel_name
        FROM certificates c
        ${HOTEL_JOIN}
        WHERE c.id::text = $1
      `;
      const fetch = await safeQuery(fetchSql, [String(insertedId)]);
      if (!fetch.ok) return res.status(201).json({ ok: true, data: r.rows[0] });
      const row = fetch.rows[0];
      row.hotel_name = row.hotel_name && String(row.hotel_name).trim() ? String(row.hotel_name).trim() : "";
      return res.status(201).json({ ok: true, data: row });
    } catch (err2) {
      console.error("After-insert select error:", err2);
      return res.status(201).json({ ok: true, data: r.rows[0] });
    }
  } catch (err) {
    console.error("POST /api/compliance error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* update */
router.put("/:id", requireAuth, upload.single("document"), async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ ok: false, error: "Invalid id" });

    const {
      certificate_type,
      hotel_id: in_hotel_id,
      property_id: in_property_id,
      hotel_name: in_hotel_name,
      issue_date,
      expiry_date,
      issued_by,
      file_path,
      notes,
      is_active,
    } = req.body || {};

    const document_name = req.file?.originalname || null;
    const document_mime = req.file?.mimetype || null;
    const document_data = req.file?.buffer || null;

    // Determine hotel_name to store (same priority as create)
    let hotelNameToStore = null;
    if (in_hotel_name && String(in_hotel_name).trim() !== "") {
      hotelNameToStore = String(in_hotel_name).trim();
    } else if (in_hotel_id !== undefined && in_hotel_id !== null && String(in_hotel_id).trim() !== "") {
      const candid = String(in_hotel_id).trim();
      if (/^\d+$/.test(candid)) {
        try {
          const hotelPkCol = await getHotelsPkColumn();
          const pk = hotelPkCol && /^[A-Za-z_][A-Za-z0-9_]*$/.test(hotelPkCol) ? hotelPkCol : null;
          const sql = pk ? `SELECT name FROM hotels WHERE ${pk} = $1 LIMIT 1` : "SELECT name FROM hotels WHERE id = $1 LIMIT 1";
          const r = await safeQuery(sql, [Number(candid)]);
          if (r.ok && r.rowCount > 0) hotelNameToStore = r.rows[0].name;
          else hotelNameToStore = candid;
        } catch {
          hotelNameToStore = candid;
        }
      } else {
        hotelNameToStore = candid;
      }
    } else if (in_property_id !== undefined && in_property_id !== null && String(in_property_id).trim() !== "") {
      const candid = String(in_property_id).trim();
      if (/^\d+$/.test(candid)) {
        try {
          const hotelPkCol = await getHotelsPkColumn();
          const pk = hotelPkCol && /^[A-Za-z_][A-Za-z0-9_]*$/.test(hotelPkCol) ? hotelPkCol : null;
          const sql = pk ? `SELECT name FROM hotels WHERE ${pk} = $1 LIMIT 1` : "SELECT name FROM hotels WHERE id = $1 LIMIT 1";
          const r = await safeQuery(sql, [Number(candid)]);
          if (r.ok && r.rowCount > 0) hotelNameToStore = r.rows[0].name;
          else hotelNameToStore = candid;
        } catch {
          hotelNameToStore = candid;
        }
      } else {
        hotelNameToStore = candid;
      }
    }

    // Resolve property_id only if numeric and exists (backwards-compatible)
    let resolvedPropertyId = null;
    if (in_property_id !== undefined && in_property_id !== null && /^\d+$/.test(String(in_property_id).trim())) {
      const tryId = Number(String(in_property_id).trim());
      const rp = await safeQuery("SELECT id FROM properties WHERE id = $1 LIMIT 1", [tryId]);
      if (rp.ok && rp.rowCount > 0) resolvedPropertyId = rp.rows[0].id;
    }

    const sql = `UPDATE certificates SET certificate_type = $1, property_id = $2, hotel_name = $3, issue_date = $4, expiry_date = $5, issued_by = $6, file_path = $7, document_name = COALESCE($8, document_name), document_mime = COALESCE($9, document_mime), document_data = COALESCE($10, document_data), notes = $11, is_active = $12, updated_at = now() WHERE id::text = $13 RETURNING id`;
    const params = [
      certificate_type,
      resolvedPropertyId,
      hotelNameToStore,
      issue_date,
      expiry_date,
      issued_by || null,
      file_path || document_name || null,
      document_name,
      document_mime,
      document_data,
      notes || null,
      (is_active === false ? false : true),
      String(id),
    ];

    const r = await safeQuery(sql, params);
    if (!r.ok) {
      const err = r.error;
      if (err && typeof err.code === "string" && err.code === "23503") {
        return res
          .status(400)
          .json({ ok: false, error: `Invalid foreign key value (property_id). Attempted value: ${String(resolvedPropertyId)}` });
      }
      return res.status(500).json({ ok: false, error: "Server error" });
    }

    if (!r.rows[0]) return res.status(404).json({ ok: false, error: "Not found" });

    try {
      const fetchSql = `
        SELECT c.*,
          COALESCE(h.name, c.hotel_name) AS hotel_name
        FROM certificates c
        ${HOTEL_JOIN}
        WHERE c.id::text = $1
      `;
      const fetch = await safeQuery(fetchSql, [String(id)]);
      if (!fetch.ok) return res.json({ ok: true, data: r.rows[0] });
      const row = fetch.rows[0];
      row.hotel_name = row.hotel_name && String(row.hotel_name).trim() ? String(row.hotel_name).trim() : "";
      return res.json({ ok: true, data: row });
    } catch (err2) {
      console.error("After-update select error:", err2);
      return res.json({ ok: true, data: r.rows[0] });
    }
  } catch (err) {
    console.error("PUT /api/compliance/:id error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* soft delete */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ ok: false, error: "Invalid id" });

    const r = await safeQuery("UPDATE certificates SET is_active=false, updated_at=now() WHERE id::text = $1 RETURNING *", [String(id)]);
    if (!r.ok) return res.status(500).json({ ok: false, error: "Server error" });
    if (!r.rows[0]) return res.status(404).json({ ok: false, error: "Not found" });
    return res.json({ ok: true, data: r.rows[0] });
  } catch (err) {
    console.error("DELETE /api/compliance/:id error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;
