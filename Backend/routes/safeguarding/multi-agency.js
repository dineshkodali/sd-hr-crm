import express from 'express';
import { protect } from '../../middleware/auth.js';
import { applyCrudLogging } from "../../middleware/activityMiddleware.js"; // Enhanced logging
import pool from '../../config/db.js';
import multer from 'multer';

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
});

let multiAgencyAttachmentsReady = false;
async function ensureMultiAgencyAttachments() {
    if (multiAgencyAttachmentsReady) return true;
    try {
        await pool.query("ALTER TABLE public.multi_agency ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb");
    } catch {
        // ignore
    }
    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS public.multi_agency_attachments (
        id SERIAL PRIMARY KEY,
        record_id INTEGER,
        file_name TEXT,
        mime_type TEXT,
        file_data BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_multi_agency_attachments_record_id ON public.multi_agency_attachments(record_id)`);
    } catch {
        // ignore
    }
    multiAgencyAttachmentsReady = true;
    return true;
}

async function insertMultiAgencyAttachments(recordId, files = []) {
    if (!Array.isArray(files) || files.length === 0) return [];
    const ids = [];
    for (const f of files) {
        if (!f || !f.buffer) continue;
        const r = await pool.query(
            `INSERT INTO public.multi_agency_attachments (record_id, file_name, mime_type, file_data)
      VALUES ($1, $2, $3, $4)
      RETURNING id`,
            [recordId ?? null, f.originalname ?? null, f.mimetype ?? null, f.buffer]
        );
        if (r.rows?.[0]?.id != null) ids.push(r.rows[0].id);
    }
    return ids;
}

// Apply CRUD logging to all operations
applyCrudLogging(router, 'multi_agency', 'multi_agency');

// --- GET: Get multi-agency attachment ---
router.get('/attachments/:id', protect, async (req, res) => {
    try {
        await ensureMultiAgencyAttachments();
        const id = req.params.id;
        if (!/^\d+$/.test(String(id))) return res.status(400).end();
        const r = await pool.query(
            `SELECT id, file_name, mime_type, file_data
      FROM public.multi_agency_attachments
      WHERE id = $1
      LIMIT 1`,
            [Number(id)]
        );
        if (!r.rows?.length) return res.status(404).end();
        const row = r.rows[0];
        const mime = row.mime_type || 'application/octet-stream';
        res.setHeader('Content-Type', mime);
        if (row.file_name) {
            res.setHeader('Content-Disposition', `inline; filename="${String(row.file_name).replace(/"/g, '')}"`);
        }
        return res.send(row.file_data);
    } catch (err) {
        console.error('GET /api/safeguarding/multi-agency/attachments/:id error:', err && (err.stack || err));
        return res.status(500).end();
    }
});

// --- DELETE: Delete multi-agency attachment ---
router.delete('/attachments/:id', protect, async (req, res) => {
    try {
        await ensureMultiAgencyAttachments();
        const id = req.params.id;
        if (!/^\d+$/.test(String(id))) return res.status(400).json({ message: 'Invalid attachment id' });
        const attId = Number(id);

        const existing = await pool.query(
            `SELECT id, record_id FROM public.multi_agency_attachments WHERE id = $1 LIMIT 1`,
            [attId]
        );
        if (!existing.rows?.length) return res.status(404).json({ message: 'Attachment not found' });
        const recordId = existing.rows[0]?.record_id ?? null;

        await pool.query(`DELETE FROM public.multi_agency_attachments WHERE id = $1`, [attId]);

        if (recordId) {
            await pool.query(
                `UPDATE public.multi_agency
          SET attachments = COALESCE(
            (SELECT jsonb_agg(value)
             FROM jsonb_array_elements(COALESCE(attachments, '[]'::jsonb)) value
             WHERE value::text <> to_jsonb($1::int)::text
            ),
            '[]'::jsonb
          ),
          updated_at = NOW()
          WHERE id = $2`,
                [attId, recordId]
            );
        }

        return res.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/safeguarding/multi-agency/attachments/:id error:', err && (err.stack || err));
        return res.status(500).json({ message: 'Server error', detail: err?.message });
    }
});

function genRef() {
    const year = new Date().getFullYear();
    const random = Math.random().toString(16).slice(2, 10);
    return `MA-${year}-${random}`;
}

async function getRestrictedHotelIds(currentUser) {
    if (!currentUser) return null;
    if (currentUser.role === "admin") return null;

    if (currentUser.role === "manager") {
        const managedRes = await pool.query("SELECT id FROM hotels WHERE manager_id = $1", [currentUser.id]);
        const managedIds = managedRes.rows.map(r => r.id);

        let branchIds = [];
        if (currentUser.branch) {
            const branchRes = await pool.query("SELECT id FROM hotels WHERE branch = $1", [currentUser.branch]);
            branchIds = branchRes.rows.map(r => r.id);
        }
        return [...new Set([...managedIds, ...branchIds])];
    }

    if (currentUser.role === "staff") {
        const assignedHotelId = currentUser.hotel_id || currentUser.hotelId || currentUser.hotel || null;
        return assignedHotelId ? [assignedHotelId] : [];
    }

    return [];
}

// GET all
router.get('/', protect, async (req, res) => {
    try {
        const currentUser = req.user;
        const restrictedHotelIds = await getRestrictedHotelIds(currentUser);

        const limit = parseInt(req.query.limit) || 500;
        const offset = parseInt(req.query.offset) || 0;

        let where = [];
        let values = [];
        let idx = 1;

        if (restrictedHotelIds !== null) {
            if (restrictedHotelIds.length === 0) {
                return res.json([]);
            }
            where.push(`property_id = ANY($${idx++})`);
            values.push(restrictedHotelIds);
        }

        const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const query = `SELECT * FROM public.multi_agency ${whereClause} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`;
        values.push(limit, offset);

        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (err) {
        console.error('GET /multi-agency error:', err);
        res.status(500).json({ message: err.message });
    }
});

// GET by id
router.get('/:id', protect, async (req, res, next) => {
    try {
        const { id } = req.params;
        if (String(id) === 'attachments') return next();
        const result = await pool.query('SELECT * FROM public.multi_agency WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Record not found' });

        const restrictedHotelIds = await getRestrictedHotelIds(req.user);
        if (restrictedHotelIds !== null) {
            if (restrictedHotelIds.length === 0) return res.status(404).json({ message: 'Record not found' });
            const pid = result.rows[0]?.property_id ?? null;
            if (!pid || !restrictedHotelIds.some((x) => String(x) === String(pid))) {
                return res.status(404).json({ message: 'Record not found' });
            }
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('GET /multi-agency/:id error', err);
        res.status(500).json({ message: err.message });
    }
});

// POST create
router.post('/', protect, upload.array('photos', 10), async (req, res) => {
    try {
        await ensureMultiAgencyAttachments();
        const reference = genRef();

        const restrictedHotelIds = await getRestrictedHotelIds(req.user);
        if (restrictedHotelIds !== null) {
            if (restrictedHotelIds.length === 0) return res.status(403).json({ message: 'Forbidden' });
            const requestedPid = req.body.property_id ?? null;
            if (!requestedPid || !restrictedHotelIds.some((x) => String(x) === String(requestedPid))) {
                return res.status(403).json({ message: 'Forbidden' });
            }
        }

        // Get all columns from the table
        const columnsResult = await pool.query(
            `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'multi_agency'`
        );

        const columnsResultWithTypes = await pool.query(
            `SELECT column_name, data_type, udt_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'multi_agency'`
        );

        const colTypeMap = new Map(
            (columnsResultWithTypes.rows || []).map((r) => [r.column_name, r.data_type || r.udt_name])
        );

        const allColumns = columnsResult.rows.map(r => r.column_name);

        // Standard columns (excluding id, timestamps, and auto-generated fields)
        const standardColumns = [
            'id', 'reference', 'created_at', 'updated_at', 'created_by', 'updated_by',
            'title', 'description', 'property_id', 'property_name', 'category',
            'priority', 'assigned_to', 'reported_by', 'scheduled_date', 'status'
        ];

        // Find custom columns
        const customColumns = allColumns.filter(col => !standardColumns.includes(col));

        const missing = [];
        if (!req.body.title || String(req.body.title).trim() === '') missing.push('title');
        if (!req.body.description || String(req.body.description).trim() === '') missing.push('description');
        if (!req.body.property_id || String(req.body.property_id).trim() === '') missing.push('property_id');
        if (!req.body.property_name || String(req.body.property_name).trim() === '') missing.push('property_name');
        if (!req.body.category || String(req.body.category).trim() === '') missing.push('category');
        if (!req.body.priority || String(req.body.priority).trim() === '') missing.push('priority');
        if (!req.body.assigned_to || String(req.body.assigned_to).trim() === '') missing.push('assigned_to');
        if (!req.body.reported_by || String(req.body.reported_by).trim() === '') missing.push('reported_by');
        if (!req.body.scheduled_date || String(req.body.scheduled_date).trim() === '') missing.push('scheduled_date');
        if (!req.body.status || String(req.body.status).trim() === '') missing.push('status');

        for (const col of customColumns) {
            const v = req.body[col];
            const camel = String(col).replace(/_([a-z])/g, (g) => g[1].toUpperCase());
            const v2 = v === undefined ? req.body[camel] : v;
            if (v2 === undefined || v2 === null || (typeof v2 !== 'boolean' && String(v2).trim() === '')) {
                missing.push(col);
            }
        }

        if (missing.length) {
            return res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` });
        }

        // Build column list and values for standard fields
        const columns = ['reference', 'title', 'description', 'property_id', 'property_name', 'category', 'priority', 'assigned_to', 'reported_by', 'scheduled_date', 'status', 'created_at', 'updated_at'];
        const values = [
            reference,
            req.body.title,
            req.body.description,
            req.body.property_id || null,
            req.body.property_name || '',
            req.body.category,
            req.body.priority || 'Medium',
            req.body.assigned_to || '',
            req.body.reported_by || '',
            req.body.scheduled_date || null,
            req.body.status || 'New',
            'NOW()', // String literal for NOW()
            'NOW()'  // String literal for NOW()
        ];

        // Add custom columns if they exist in the request
        customColumns.forEach(col => {
            if (req.body[col] !== undefined) {
                // Insert custom column before timestamps
                columns.splice(columns.length - 2, 0, col);
                // Insert custom value before timestamps
                values.splice(values.length - 2, 0, req.body[col]);
            }
        });

        // Determine cutoff for actual parameters vs raw SQL strings
        const timestampStartIndex = values.length - 2;

        // Build parameterized query placeholders
        const placeholders = values.map((val, i) => {
            if (i >= timestampStartIndex) return val; // Returns 'NOW()'
            return `$${i + 1}`; // Returns $1, $2, etc.
        });

        // Prepare values array for the query execution (exclude 'NOW()' strings)
        const paramValues = values.slice(0, timestampStartIndex);

        const query = `INSERT INTO public.multi_agency (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;

        const result = await pool.query(query, paramValues);
        let created = result.rows[0];

        if (created?.id && Array.isArray(req.files) && req.files.length) {
            const newIds = await insertMultiAgencyAttachments(created.id, req.files);
            if (newIds.length) {
                try {
                    const up = await pool.query(
                        `UPDATE public.multi_agency SET attachments = $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING *`,
                        [JSON.stringify(newIds), created.id]
                    );
                    created = up.rows?.[0] || created;
                } catch {
                    // ignore
                }
            }
        }

        res.status(201).json(created);
    } catch (err) {
        console.error('POST /multi-agency error:', err);
        res.status(500).json({ message: err.message });
    }
});

// PATCH update
router.patch('/:id', protect, upload.array('photos', 10), async (req, res) => {
    try {
        await ensureMultiAgencyAttachments();
        const { id } = req.params;

        function quoteIdent(ident) {
            const s = String(ident);
            return '"' + s.replace(/"/g, '""') + '"';
        }

        function coerceValueByPgType(pgType, value) {
            if (value === undefined) return undefined;
            if (value === null) return null;
            if (typeof value === 'string' && value.trim() === '') {
                const t = String(pgType || '').toLowerCase();
                if (
                    t.includes('date') ||
                    t.includes('timestamp') ||
                    t.includes('time') ||
                    t.includes('int') ||
                    t.includes('numeric') ||
                    t.includes('decimal') ||
                    t.includes('double') ||
                    t.includes('real') ||
                    t.includes('bool')
                ) {
                    return null;
                }
            }
            return value;
        }

        const restrictedHotelIds = await getRestrictedHotelIds(req.user);
        if (restrictedHotelIds !== null) {
            if (restrictedHotelIds.length === 0) return res.status(404).json({ message: 'Record not found' });
            const checkRes = await pool.query('SELECT property_id FROM public.multi_agency WHERE id=$1', [id]);
            if (!checkRes.rows.length) return res.status(404).json({ message: 'Record not found' });
            const existingPid = checkRes.rows[0]?.property_id;
            if (!existingPid || !restrictedHotelIds.some((x) => String(x) === String(existingPid))) {
                return res.status(404).json({ message: 'Record not found' });
            }
            if (req.body?.property_id !== undefined && !restrictedHotelIds.some((x) => String(x) === String(req.body.property_id))) {
                return res.status(403).json({ message: 'Forbidden' });
            }
        }

        // Get all columns from the table
        const columnsResult = await pool.query(
            `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'multi_agency'`
        );

        const columnsResultWithTypes = await pool.query(
            `SELECT column_name, data_type, udt_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'multi_agency'`
        );

        const colTypeMap = new Map(
            (columnsResultWithTypes.rows || []).map((r) => [r.column_name, r.data_type || r.udt_name])
        );

        const allColumns = columnsResult.rows.map(r => r.column_name);

        // Standard columns not directly updatable via loop
        const standardColumns = [
            'id', 'reference', 'created_at', 'updated_at', 'created_by', 'updated_by', 'attachments'
        ];

        // Find updatable columns (standard + custom)
        const updatableColumns = allColumns.filter(col => !standardColumns.includes(col));

        // Build SET clause dynamically
        const setClauses = [];
        const values = [];
        let paramIndex = 1;

        // Standard fields whitelist
        const standardFields = ['title', 'description', 'property_id', 'property_name', 'category', 'priority', 'assigned_to', 'reported_by', 'scheduled_date', 'status'];

        // Add standard fields
        standardFields.forEach(field => {
            if (req.body[field] !== undefined) {
                setClauses.push(`${quoteIdent(field)}=$${paramIndex}`);
                values.push(coerceValueByPgType(colTypeMap.get(field), req.body[field]));
                paramIndex++;
            }
        });

        // Add custom columns
        updatableColumns.forEach(col => {
            if (!standardFields.includes(col) && req.body[col] !== undefined) {
                setClauses.push(`${quoteIdent(col)}=$${paramIndex}`);
                values.push(coerceValueByPgType(colTypeMap.get(col), req.body[col]));
                paramIndex++;
            }
        });

        // Always update updated_at
        setClauses.push('updated_at=NOW()');

        // Add id as the last parameter
        values.push(id);

        const query = `UPDATE public.multi_agency SET ${setClauses.join(', ')} WHERE id=$${paramIndex} RETURNING *`;

        const result = await pool.query(query, values);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Record not found' });

        let updated = result.rows[0];
        if (updated?.id && Array.isArray(req.files) && req.files.length) {
            const newIds = await insertMultiAgencyAttachments(updated.id, req.files);
            if (newIds.length) {
                let prev = [];
                try {
                    const rawPrev = updated.attachments;
                    if (Array.isArray(rawPrev)) prev = rawPrev;
                    else if (typeof rawPrev === 'string' && rawPrev) prev = JSON.parse(rawPrev);
                    else if (rawPrev && typeof rawPrev === 'object') prev = rawPrev;
                } catch {
                    prev = [];
                }
                const next = [...(Array.isArray(prev) ? prev : []), ...newIds];
                try {
                    const up = await pool.query(
                        `UPDATE public.multi_agency SET attachments = $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING *`,
                        [JSON.stringify(next), updated.id]
                    );
                    updated = up.rows?.[0] || updated;
                } catch {
                    // ignore
                }
            }
        }

        res.json(updated);
    } catch (err) {
        console.error('PATCH /multi-agency/:id error:', err);
        res.status(500).json({ message: err.message });
    }
});

// DELETE
router.delete('/:id', protect, async (req, res) => {
    try {
        const { id } = req.params;

        const restrictedHotelIds = await getRestrictedHotelIds(req.user);
        if (restrictedHotelIds !== null) {
            if (restrictedHotelIds.length === 0) return res.status(404).json({ message: 'Record not found' });
            const checkRes = await pool.query('SELECT property_id FROM public.multi_agency WHERE id=$1', [id]);
            if (!checkRes.rows.length) return res.status(404).json({ message: 'Record not found' });
            const existingPid = checkRes.rows[0]?.property_id;
            if (!existingPid || !restrictedHotelIds.some((x) => String(x) === String(existingPid))) {
                return res.status(404).json({ message: 'Record not found' });
            }
        }
        const result = await pool.query('DELETE FROM public.multi_agency WHERE id=$1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Record not found' });
        res.json({ message: 'Record deleted', record: result.rows[0] });
    } catch (err) {
        console.error('DELETE /multi-agency/:id error:', err);
        res.status(500).json({ message: err.message });
    }
});

export default router;
