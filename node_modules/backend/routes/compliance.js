// C:\PostgreAuth\Backend\routes\compliance.js
import express from "express";
import multer from "multer";
import { protect } from "../middleware/auth.js";

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

function toIntOrNull(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

let COMPLIANCE_INIT_PROMISE = null;
async function ensureComplianceInitialized() {
  if (COMPLIANCE_INIT_PROMISE) return COMPLIANCE_INIT_PROMISE;
  COMPLIANCE_INIT_PROMISE = (async () => {
    try {
      await safeQuery("ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS hotel_name TEXT");
      await safeQuery("ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS document_name TEXT");
      await safeQuery("ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS document_mime TEXT");
      await safeQuery("ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS document_data BYTEA");

      await safeQuery("ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true");
      await safeQuery("ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()");
      await safeQuery("ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()");
      await safeQuery("ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS created_by TEXT");
    } catch (err) {
      console.warn("Compliance init warning:", err && (err.message || err));
    }
  })();
  return COMPLIANCE_INIT_PROMISE;
}

let CERT_COLS_CACHE = { at: 0, cols: null };
async function getCertificateColumns() {
  const now = Date.now();
  if (CERT_COLS_CACHE.cols && now - CERT_COLS_CACHE.at < 60_000) return CERT_COLS_CACHE.cols;
  const r = await safeQuery(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'certificates'`,
    []
  );
  const set = new Set((r.ok ? r.rows : []).map((x) => x.column_name));
  CERT_COLS_CACHE = { at: now, cols: set };
  return set;
}

async function getAllowedHotelIds(user) {
  if (!user) return [];
  if (user.role === "admin") return null;

  let query = "";
  let params = [];

  if (user.role === "manager") {
    const managerId = toIntOrNull(user.id);
    if (managerId === null) return [];
    query = "SELECT id FROM public.hotels WHERE manager_id = $1";
    params = [managerId];
    if (user.branch) {
      query += " OR branch = $2";
      params.push(user.branch);
    }
  } else if (user.role === "staff") {
    const assignedHotelId = user.hotel_id || user.hotelId || user.hotel || null;
    if (!assignedHotelId) return [];
    query = "SELECT id FROM public.hotels WHERE id = $1";
    params = [assignedHotelId];
  } else {
    return [];
  }

  const r = await safeQuery(query, params);
  if (!r.ok) return [];
  return (r.rows || []).map((x) => x.id);
}

async function getAllowedHotelNamesLower(allowedHotelIds) {
  if (allowedHotelIds === null) return null;
  if (!Array.isArray(allowedHotelIds) || allowedHotelIds.length === 0) return [];
  const r = await safeQuery("SELECT name FROM public.hotels WHERE id = ANY($1::int[])", [allowedHotelIds]);
  if (!r.ok) return [];
  return (r.rows || []).map((x) => String(x.name || "").trim().toLowerCase()).filter(Boolean);
}

function recordAllowedByScope(row, allowedHotelIds, allowedHotelNamesLower) {
  if (allowedHotelIds === null) return true;
  if (!row) return false;

  const allowedIdTexts = Array.isArray(allowedHotelIds) ? allowedHotelIds.map((x) => String(x)) : [];
  const propIdText = row.property_id != null && String(row.property_id).trim() !== "" ? String(row.property_id).trim() : null;
  if (propIdText && allowedIdTexts.includes(propIdText)) return true;

  const hn = row.hotel_name != null ? String(row.hotel_name).trim().toLowerCase() : "";
  if (hn && Array.isArray(allowedHotelNamesLower) && allowedHotelNamesLower.includes(hn)) return true;

  return false;
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


/* join: resolve hotels.name using certificates.hotel_name (text) as canonical source, but prefer ID match */
const HOTEL_JOIN = `
  LEFT JOIN public.hotels h
    ON (c.property_id IS NOT NULL AND h.id::text = c.property_id::text)
    OR (c.property_id IS NULL AND c.hotel_name IS NOT NULL AND h.name ILIKE c.hotel_name)
`;



/* stats */
router.get("/stats/summary", protect, async (req, res) => {
  try {
    await ensureComplianceInitialized();
    const cols = await getCertificateColumns();
    const allowedHotelIds = await getAllowedHotelIds(req.session?.user || req.user);
    if (allowedHotelIds !== null && allowedHotelIds.length === 0) {
      return res.json({ ok: true, data: { valid_count: 0, expiring_count: 0, expired_count: 0 } });
    }

    const allowedHotelNamesLower = await getAllowedHotelNamesLower(allowedHotelIds);

    const where = [];
    if (cols.has("is_active")) where.push("is_active IS TRUE");
    const params = [];
    let idx = 1;

    if (allowedHotelIds !== null) {
      if (cols.has("hotel_name")) {
        where.push(`(property_id::text = ANY($${idx}::text[]) OR (hotel_name IS NOT NULL AND lower(hotel_name) = ANY($${idx + 1}::text[])))`);
        params.push(allowedHotelIds.map((x) => String(x)));
        params.push(allowedHotelNamesLower);
        idx += 2;
      } else {
        where.push(`property_id::text = ANY($${idx}::text[])`);
        params.push(allowedHotelIds.map((x) => String(x)));
        idx += 1;
      }
    }

    const activeFilter = cols.has("is_active") ? " AND is_active IS TRUE" : "";
    const q = `SELECT
      COUNT(*) FILTER (WHERE expiry_date > (current_date + INTERVAL '30 days')${activeFilter}) AS valid_count,
      COUNT(*) FILTER (WHERE expiry_date <= (current_date + INTERVAL '30 days') AND expiry_date >= current_date${activeFilter}) AS expiring_count,
      COUNT(*) FILTER (WHERE expiry_date < current_date${activeFilter}) AS expired_count
    FROM public.certificates
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""};`;

    const r = await safeQuery(q, params);
    if (!r.ok) return res.json({ ok: true, data: { valid_count: 0, expiring_count: 0, expired_count: 0 } });
    return res.json({ ok: true, data: r.rows[0] || { valid_count: 0, expiring_count: 0, expired_count: 0 } });
  } catch (err) {
    console.error("GET /api/compliance/stats/summary unexpected error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* list */
router.get("/", protect, async (req, res) => {
  try {
    await ensureComplianceInitialized();
    const cols = await getCertificateColumns();
    // Support both hotel_id (or property_id) param; treat it as either hotel id or hotel name fragment
    const hotelParam = req.query.hotel_id ?? req.query.property_id;
    const hotelNameParam = req.query.hotel_name ?? req.query.site;
    const { status, search } = req.query;

    const allowedHotelIds = await getAllowedHotelIds(req.session?.user || req.user);
    if (allowedHotelIds !== null && allowedHotelIds.length === 0) {
      return res.json({ ok: true, data: [] });
    }

    const allowedHotelNamesLower = await getAllowedHotelNamesLower(allowedHotelIds);

    const where = [];
    if (cols.has("is_active")) where.push("is_active IS TRUE");
    const params = [];
    let idx = 1;

    if (allowedHotelIds !== null) {
      if (cols.has("hotel_name")) {
        where.push(`(property_id::text = ANY($${idx}::text[]) OR (hotel_name IS NOT NULL AND lower(hotel_name) = ANY($${idx + 1}::text[])))`);
        params.push(allowedHotelIds.map((x) => String(x)));
        params.push(allowedHotelNamesLower);
        idx += 2;
      } else {
        where.push(`property_id::text = ANY($${idx}::text[])`);
        params.push(allowedHotelIds.map((x) => String(x)));
        idx += 1;
      }
    }

    if (status === "expired") where.push("expiry_date < current_date");
    else if (status === "expiring") where.push("expiry_date BETWEEN current_date AND (current_date + INTERVAL '30 days')");
    else if (status === "valid") where.push("expiry_date > (current_date + INTERVAL '30 days')");

    if (search) {
      const parts = [`certificate_type ILIKE $${idx}`];
      if (cols.has("issued_by")) parts.push(`issued_by ILIKE $${idx}`);
      if (cols.has("notes")) parts.push(`notes ILIKE $${idx}`);
      if (cols.has("hotel_name")) parts.push(`hotel_name ILIKE $${idx}`);
      where.push(`(${parts.join(" OR ")})`);
      params.push(`%${search}%`);
      idx++;
    }

    if (hotelParam && String(hotelParam).trim() !== "") {
      const n = Number(hotelParam);
      if (Number.isFinite(n) && Number.isInteger(n)) {
        where.push(`property_id::text = $${idx}`);
        params.push(String(n));
        idx++;
      }
    }

    if (cols.has("hotel_name") && hotelNameParam && String(hotelNameParam).trim() !== "") {
      where.push(`hotel_name ILIKE $${idx}`);
      params.push(`%${String(hotelNameParam)}%`);
      idx++;
    }

    // limit & offset
    const limit = Math.max(Math.min(parseInt(req.query.limit || "50", 10) || 50, 100), 1);
    const offset = Math.max(parseInt(req.query.offset || "0", 10) || 0, 0);

    const sql = `SELECT *,
      CASE
        WHEN expiry_date < current_date THEN 'expired'
        WHEN expiry_date <= (current_date + INTERVAL '30 days') THEN 'expiring'
        ELSE 'valid'
      END AS status
    FROM public.certificates
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY expiry_date ASC
    LIMIT $${idx} OFFSET $${idx + 1};`;

    const start = Date.now();
    const r = await safeQuery(sql, [...params, limit, offset]);
    const elapsed = Date.now() - start;
    if (elapsed > 1000) {
      console.warn(`[PERF] /api/compliance query took ${elapsed}ms (limit=${limit}, offset=${offset})`);
    }
    if (!r.ok) {
      console.error("Compliance List Query Failed:", r.error);
      return res.status(500).json({
        ok: false,
        error: r.error?.message || "Database Query Warning",
        code: r.error?.code,
        detail: r.error?.detail,
        hint: r.error?.hint,
      });
    }

    const out = (r.rows || []).map((row) => {
      row.hotel_name = row.hotel_name && String(row.hotel_name).trim() ? String(row.hotel_name).trim() : "";
      return row;
    });

    console.log(`[Compliance] Returning ${out.length} certificates (stats showed data, list returning rows: ${out.length > 0})`);
    return res.json({ ok: true, data: out });
  } catch (err) {
    console.error("GET /api/compliance error:", err && (err.stack || err.message || err));
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
});

/* get one */
router.get("/:id", protect, async (req, res) => {
  try {
    await ensureComplianceInitialized();
    const id = req.params.id;
    if (!id) return res.status(400).json({ ok: false, error: "Invalid id" });

    const allowedHotelIds = await getAllowedHotelIds(req.session?.user || req.user);
    if (allowedHotelIds !== null && allowedHotelIds.length === 0) {
      return res.status(404).json({ ok: false, error: "Not found" });
    }

    const allowedHotelNamesLower = await getAllowedHotelNamesLower(allowedHotelIds);

    const sql = `
      SELECT c.*,
        COALESCE(h.name, c.hotel_name) AS hotel_name
      FROM public.certificates c
      ${HOTEL_JOIN}
      WHERE c.id::text = $1 AND c.is_active = true
    `;
    const r = await safeQuery(sql, [String(id)]);

    if (!r.ok) return res.status(500).json({ ok: false, error: "Server error" });
    if (!r.rows[0]) return res.status(404).json({ ok: false, error: "Not found" });

    if (!recordAllowedByScope(r.rows[0], allowedHotelIds, allowedHotelNamesLower)) {
      return res.status(403).json({ ok: false, error: "Access denied" });
    }

    const row = r.rows[0];
    row.hotel_name = row.hotel_name && String(row.hotel_name).trim() ? String(row.hotel_name).trim() : "";
    return res.json({ ok: true, data: row });
  } catch (err) {
    console.error("GET /api/compliance/:id error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

router.get("/:id/document", protect, async (req, res) => {
  try {
    await ensureComplianceInitialized();
    const id = req.params.id;
    if (!id) return res.status(400).json({ ok: false, error: "Invalid id" });

    const allowedHotelIds = await getAllowedHotelIds(req.session?.user || req.user);
    if (allowedHotelIds !== null && allowedHotelIds.length === 0) {
      return res.status(404).json({ ok: false, error: "No document" });
    }

    const allowedHotelNamesLower = await getAllowedHotelNamesLower(allowedHotelIds);

    if (allowedHotelIds !== null) {
      const chk = await safeQuery(
        "SELECT property_id, hotel_name FROM public.certificates WHERE id::text = $1 AND is_active = true LIMIT 1",
        [String(id)]
      );
      const row = chk.rows?.[0];
      if (!row) return res.status(404).json({ ok: false, error: "No document" });
      if (!recordAllowedByScope(row, allowedHotelIds, allowedHotelNamesLower)) {
        return res.status(403).json({ ok: false, error: "Access denied" });
      }
    }

    const r = await safeQuery(
      "SELECT document_name, document_mime, document_data FROM public.certificates WHERE id::text = $1 AND is_active = true LIMIT 1",
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
router.post("/", protect, upload.single("document"), async (req, res) => {
  try {
    await ensureComplianceInitialized();
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

    const allowedHotelIds = await getAllowedHotelIds(req.session?.user || req.user);
    const allowedHotelNamesLower = await getAllowedHotelNamesLower(allowedHotelIds);
    if (allowedHotelIds !== null && allowedHotelIds.length === 0) {
      return res.status(403).json({ ok: false, error: "Access denied" });
    }

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

    if (allowedHotelIds !== null) {
      const hn = hotelNameToStore != null ? String(hotelNameToStore).trim().toLowerCase() : "";
      if (hn && Array.isArray(allowedHotelNamesLower) && !allowedHotelNamesLower.includes(hn)) {
        return res.status(403).json({ ok: false, error: "Cannot create certificate for a property outside your access" });
      }
    }

    const insertSql = `INSERT INTO public.certificates (certificate_type, property_id, hotel_name, issue_date, expiry_date, issued_by, file_path, document_name, document_mime, document_data, notes, created_by, is_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`;
    // property_id we keep as null unless user provided an actual property id that resolves to a properties.id
    let resolvedPropertyId = null;
    // try quick resolve if they provided a numeric property_id (backwards-compatible)
    if (in_property_id !== undefined && in_property_id !== null && /^\d+$/.test(String(in_property_id).trim())) {
      const tryId = Number(String(in_property_id).trim());
      const rp = await safeQuery("SELECT id FROM properties WHERE id = $1 LIMIT 1", [tryId]);
      if (rp.ok && rp.rowCount > 0) resolvedPropertyId = rp.rows[0].id;
    }

    if (allowedHotelIds !== null && resolvedPropertyId != null && !allowedHotelIds.includes(Number(resolvedPropertyId))) {
      return res.status(403).json({ ok: false, error: "Cannot create certificate for a property outside your access" });
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
      toIntOrNull(req.session?.user?.id || req.user?.id || null),
      true, // is_active
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
        FROM public.certificates c
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
router.put("/:id", protect, upload.single("document"), async (req, res) => {
  try {
    await ensureComplianceInitialized();
    const id = req.params.id;
    if (!id) return res.status(400).json({ ok: false, error: "Invalid id" });

    const allowedHotelIds = await getAllowedHotelIds(req.session?.user || req.user);
    const allowedHotelNamesLower = await getAllowedHotelNamesLower(allowedHotelIds);
    if (allowedHotelIds !== null && allowedHotelIds.length === 0) {
      return res.status(403).json({ ok: false, error: "Access denied" });
    }

    if (allowedHotelIds !== null) {
      const chk = await safeQuery(
        "SELECT property_id, hotel_name FROM public.certificates WHERE id::text = $1 AND is_active = true LIMIT 1",
        [String(id)]
      );
      const row = chk.rows?.[0];
      if (!row) return res.status(404).json({ ok: false, error: "Not found" });
      if (!recordAllowedByScope(row, allowedHotelIds, allowedHotelNamesLower)) {
        return res.status(403).json({ ok: false, error: "Access denied" });
      }
    }

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

    if (allowedHotelIds !== null) {
      const hn = hotelNameToStore != null ? String(hotelNameToStore).trim().toLowerCase() : "";
      if (hn && Array.isArray(allowedHotelNamesLower) && !allowedHotelNamesLower.includes(hn)) {
        return res.status(403).json({ ok: false, error: "Cannot move certificate to a property outside your access" });
      }
    }

    // Resolve property_id only if numeric and exists (backwards-compatible)
    let resolvedPropertyId = null;
    if (in_property_id !== undefined && in_property_id !== null && /^\d+$/.test(String(in_property_id).trim())) {
      const tryId = Number(String(in_property_id).trim());
      const rp = await safeQuery("SELECT id FROM properties WHERE id = $1 LIMIT 1", [tryId]);
      if (rp.ok && rp.rowCount > 0) resolvedPropertyId = rp.rows[0].id;
    }

    if (allowedHotelIds !== null && resolvedPropertyId != null && !allowedHotelIds.includes(Number(resolvedPropertyId))) {
      return res.status(403).json({ ok: false, error: "Cannot move certificate to a property outside your access" });
    }

    const sql = `UPDATE public.certificates SET certificate_type = $1, property_id = $2, hotel_name = $3, issue_date = $4, expiry_date = $5, issued_by = $6, file_path = $7, document_name = COALESCE($8, document_name), document_mime = COALESCE($9, document_mime), document_data = COALESCE($10, document_data), notes = $11, is_active = $12, updated_at = now() WHERE id::text = $13 RETURNING id`;
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
        FROM public.certificates c
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
router.delete("/:id", protect, async (req, res) => {
  try {
    await ensureComplianceInitialized();
    const id = req.params.id;
    if (!id) return res.status(400).json({ ok: false, error: "Invalid id" });

    const allowedHotelIds = await getAllowedHotelIds(req.session?.user || req.user);
    const allowedHotelNamesLower = await getAllowedHotelNamesLower(allowedHotelIds);
    if (allowedHotelIds !== null) {
      if (allowedHotelIds.length === 0) return res.status(404).json({ ok: false, error: "Not found" });
      const chk = await safeQuery(
        "SELECT property_id, hotel_name FROM public.certificates WHERE id::text = $1 AND is_active = true LIMIT 1",
        [String(id)]
      );
      const row = chk.rows?.[0];
      if (!row) return res.status(404).json({ ok: false, error: "Not found" });
      if (!recordAllowedByScope(row, allowedHotelIds, allowedHotelNamesLower)) {
        return res.status(403).json({ ok: false, error: "Access denied" });
      }
    }

    const r = await safeQuery(
      "UPDATE public.certificates SET is_active=false, updated_at=now() WHERE id::text = $1 RETURNING *",
      [String(id)]
    );
    if (!r.ok) return res.status(500).json({ ok: false, error: "Server error" });
    if (!r.rows[0]) return res.status(404).json({ ok: false, error: "Not found" });
    return res.json({ ok: true, data: r.rows[0] });
  } catch (err) {
    console.error("DELETE /api/compliance/:id error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;
