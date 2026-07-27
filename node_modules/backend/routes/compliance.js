// C:\PostgreAuth\Backend\routes\compliance.js
import express from "express";
import multer from "multer";
import { protect } from "../middleware/auth.js";

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

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

let CERT_PROPERTY_FK_CACHE = { at: 0, target: null };
async function getCertificatesPropertyFkTarget() {
  const now = Date.now();
  if (CERT_PROPERTY_FK_CACHE.target && now - CERT_PROPERTY_FK_CACHE.at < 60_000) return CERT_PROPERTY_FK_CACHE.target;
  const r = await safeQuery(
    `SELECT
      ccu.table_schema AS foreign_table_schema,
      ccu.table_name   AS foreign_table_name,
      ccu.column_name  AS foreign_column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = 'certificates'
      AND kcu.column_name = 'property_id'
    LIMIT 1`,
    []
  );
  const row = r.ok ? r.rows?.[0] : null;
  const target = row?.foreign_table_name
    ? {
      schema: row.foreign_table_schema || 'public',
      table: row.foreign_table_name,
      column: row.foreign_column_name || 'id'
    }
    : null;
  CERT_PROPERTY_FK_CACHE = { at: now, target };
  return target;
}

async function resolveCertificatePropertyId(candidate) {
  const raw = String(candidate ?? '').trim();
  if (!/^\d+$/.test(raw)) return null;
  const fk = await getCertificatesPropertyFkTarget();
  if (!fk?.table || !fk?.column) return null;

  const schema = fk.schema && String(fk.schema).trim() ? String(fk.schema).trim() : 'public';
  const table = String(fk.table).trim();
  const column = String(fk.column).trim();
  if (!table || !column) return null;

  const r = await safeQuery(
    `SELECT 1 FROM ${quoteIdent(schema)}.${quoteIdent(table)} WHERE ${quoteIdent(column)}::text = $1 LIMIT 1`,
    [raw]
  );
  if (!r.ok || r.rowCount <= 0) return null;
  return Number(raw);
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
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(Math.min(parseInt(req.query.limit || "50", 10) || 50, 100), 1);
    const offset = (page - 1) * limit;

    const selectableCols = Array.from(cols || [])
      .filter(Boolean)
      .filter((c) => !['document_data', 'document_mime'].includes(String(c).toLowerCase()));
    const selectList = selectableCols.length ? selectableCols.map(quoteIdent).join(', ') : '*';

    // Get total count for pagination
    const countSql = `SELECT COUNT(*) FROM public.certificates ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`;
    const countResult = await safeQuery(countSql, params);
    const total = countResult.ok ? parseInt(countResult.rows[0].count) : 0;

    const sql = `SELECT ${selectList},
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
    return res.json({
      ok: true,
      data: out,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total
      }
    });
  } catch (err) {
    console.error("GET /api/compliance error:", err && (err.stack || err.message || err));
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
});

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

    const r = await safeQuery(
      "SELECT * FROM public.certificates WHERE id::text = $1 AND is_active = true LIMIT 1",
      [String(id)]
    );

    if (!r.ok) return res.status(500).json({ ok: false, error: "Server error" });
    if (!r.rows[0]) return res.status(404).json({ ok: false, error: "Not found" });

    const row = r.rows[0];

    if (!recordAllowedByScope(row, allowedHotelIds, allowedHotelNamesLower)) {
      return res.status(403).json({ ok: false, error: "Access denied" });
    }

    if (row.property_id != null && String(row.property_id).trim() !== "") {
      const pk = await getHotelsPkColumn();
      const col = pk ? pk : "id";
      const hr = await safeQuery(
        `SELECT name FROM public.hotels WHERE ${quoteIdent(col)}::text = $1 LIMIT 1`,
        [String(row.property_id)]
      );
      if (hr.ok && hr.rows?.[0]?.name != null) {
        row.hotel_name = String(hr.rows[0].name);
      }
    }

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
    const cols = await getCertificateColumns();

    // Determine hotel_name and property_id
    const {
      hotel_id: in_hotel_id,
      property_id: in_property_id,
      hotel_name: in_hotel_name,
    } = req.body || {};

    let hotelNameToStore = null;
    if (in_hotel_name && String(in_hotel_name).trim() !== "") {
      hotelNameToStore = String(in_hotel_name).trim();
    } else {
      const candid = String(in_hotel_id || in_property_id || "").trim();
      if (/^\d+$/.test(candid)) {
        const pk = await getHotelsPkColumn();
        const sql = pk ? `SELECT name FROM hotels WHERE ${pk} = $1 LIMIT 1` : "SELECT name FROM hotels WHERE id = $1 LIMIT 1";
        const r = await safeQuery(sql, [Number(candid)]);
        if (r.ok && r.rowCount > 0) hotelNameToStore = r.rows[0].name;
        else if (candid) hotelNameToStore = candid;
      } else if (candid) {
        hotelNameToStore = candid;
      }
    }

    const resolvedPropertyId = await resolveCertificatePropertyId(in_property_id || in_hotel_id);
    const fkTarget = await getCertificatesPropertyFkTarget();
    const fkIsHotels = String(fkTarget?.table || '').toLowerCase() === 'hotels';

    // Permission check
    const allowedHotelIds = await getAllowedHotelIds(req.session?.user || req.user);
    const allowedHotelNamesLower = await getAllowedHotelNamesLower(allowedHotelIds);
    if (allowedHotelIds !== null) {
      if (allowedHotelIds.length === 0) return res.status(403).json({ ok: false, error: "Access denied" });
      const hn = hotelNameToStore ? hotelNameToStore.toLowerCase().trim() : "";
      if (hn && !allowedHotelNamesLower.includes(hn)) return res.status(403).json({ ok: false, error: "Access denied for this property" });
      if (fkIsHotels && resolvedPropertyId && !allowedHotelIds.includes(Number(resolvedPropertyId))) {
        return res.status(403).json({ ok: false, error: "Access denied for this property" });
      }
    }

    // Build Payload
    const data = { ...req.body };
    delete data.id;
    data.property_id = resolvedPropertyId;
    data.hotel_name = hotelNameToStore;
    data.is_active = true;
    data.created_by = toIntOrNull(req.session?.user?.id || req.user?.id || null);

    if (req.file) {
      data.document_name = req.file.originalname;
      data.document_mime = req.file.mimetype;
      data.document_data = req.file.buffer;
      data.file_path = data.file_path || req.file.originalname;
    }

    // Dynamic Insert
    const fields = [];
    const placeholders = [];
    const values = [];
    let idx = 1;

    for (const [k, v] of Object.entries(data)) {
      if (cols.has(k)) {
        fields.push(quoteIdent(k));
        placeholders.push(`$${idx++}`);
        values.push(v === "" ? null : v);
      }
    }

    if (fields.length === 0) return res.status(400).json({ ok: false, error: "No valid fields provided" });

    const sql = `INSERT INTO public.certificates (${fields.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING id`;
    const r = await safeQuery(sql, values);
    if (!r.ok) return res.status(500).json({ ok: false, error: "Insert failed" });

    const insertedId = r.rows[0].id;
    const fetch = await safeQuery("SELECT * FROM public.certificates WHERE id::text = $1 LIMIT 1", [String(insertedId)]);
    return res.status(201).json({ ok: true, data: fetch.rows?.[0] || { id: insertedId } });

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

    const cols = await getCertificateColumns();

    // Check existing
    const allowedHotelIds = await getAllowedHotelIds(req.session?.user || req.user);
    const allowedHotelNamesLower = await getAllowedHotelNamesLower(allowedHotelIds);
    const chk = await safeQuery("SELECT property_id, hotel_name FROM public.certificates WHERE id::text = $1 AND is_active = true", [String(id)]);
    if (!chk.ok || !chk.rows[0]) return res.status(404).json({ ok: false, error: "Not found" });
    if (!recordAllowedByScope(chk.rows[0], allowedHotelIds, allowedHotelNamesLower)) return res.status(403).json({ ok: false, error: "Access denied" });

    // Determine hotel_name and property_id
    const {
      hotel_id: in_hotel_id,
      property_id: in_property_id,
      hotel_name: in_hotel_name,
    } = req.body || {};

    let hotelNameToStore = null;
    if (in_hotel_name && String(in_hotel_name).trim() !== "") {
      hotelNameToStore = String(in_hotel_name).trim();
    } else if (in_hotel_id || in_property_id) {
      const candid = String(in_hotel_id || in_property_id || "").trim();
      if (/^\d+$/.test(candid)) {
        const pk = await getHotelsPkColumn();
        const sql = pk ? `SELECT name FROM hotels WHERE ${pk} = $1 LIMIT 1` : "SELECT name FROM hotels WHERE id = $1 LIMIT 1";
        const r = await safeQuery(sql, [Number(candid)]);
        if (r.ok && r.rowCount > 0) hotelNameToStore = r.rows[0].name;
        else hotelNameToStore = candid;
      } else if (candid) {
        hotelNameToStore = candid;
      }
    }

    const resolvedPropertyId = await resolveCertificatePropertyId(in_property_id || in_hotel_id);
    const fkTarget = await getCertificatesPropertyFkTarget();
    const fkIsHotels = String(fkTarget?.table || '').toLowerCase() === 'hotels';

    // Permission check for target property
    if (allowedHotelIds !== null && (hotelNameToStore || resolvedPropertyId)) {
      const hn = hotelNameToStore ? hotelNameToStore.toLowerCase().trim() : "";
      if (hn && !allowedHotelNamesLower.includes(hn)) return res.status(403).json({ ok: false, error: "Access denied for target property" });
      if (fkIsHotels && resolvedPropertyId && !allowedHotelIds.includes(Number(resolvedPropertyId))) {
        return res.status(403).json({ ok: false, error: "Access denied for target property" });
      }
    }

    // Build Payload
    const data = { ...req.body };
    delete data.id;
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "property_id") || Object.prototype.hasOwnProperty.call(req.body || {}, "hotel_id")) {
      data.property_id = resolvedPropertyId;
    }
    if (hotelNameToStore) data.hotel_name = hotelNameToStore;
    data.updated_at = "now()";

    if (req.file) {
      data.document_name = req.file.originalname;
      data.document_mime = req.file.mimetype;
      data.document_data = req.file.buffer;
    }

    // Dynamic Update
    const sets = [];
    const values = [];
    let idx = 1;

    for (const [k, v] of Object.entries(data)) {
      if (cols.has(k)) {
        if (k === "updated_at") {
          sets.push(`${quoteIdent(k)} = now()`);
        } else {
          sets.push(`${quoteIdent(k)} = $${idx++}`);
          values.push(v === "" ? null : v);
        }
      }
    }

    if (sets.length === 0) return res.status(404).json({ ok: false, error: "Nothing to update" });

    values.push(String(id));
    const sql = `UPDATE public.certificates SET ${sets.join(", ")} WHERE id::text = $${idx} RETURNING id`;
    const r = await safeQuery(sql, values);
    if (!r.ok) return res.status(500).json({ ok: false, error: "Update failed" });

    const fetch = await safeQuery("SELECT * FROM public.certificates WHERE id::text = $1 LIMIT 1", [String(id)]);
    return res.json({ ok: true, data: fetch.rows?.[0] || { id } });

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
