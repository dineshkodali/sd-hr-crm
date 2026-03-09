import express from 'express';
import pool from '../../config/db.js';
import { protect } from '../../middleware/auth.js';
import { applyCrudLogging } from "../../middleware/activityMiddleware.js"; // Enhanced logging
import multer from 'multer';

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
});

let riskAssessmentsAttachmentsReady = false;
async function ensureRiskAssessmentsAttachments() {
    if (riskAssessmentsAttachmentsReady) return true;
    try {
        await pool.query("ALTER TABLE public.risk_assessments ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb");
    } catch {
        // ignore
    }
    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS public.risk_assessment_attachments (
        id SERIAL PRIMARY KEY,
        assessment_id INTEGER,
        file_name TEXT,
        mime_type TEXT,
        file_data BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_risk_assessment_attachments_assessment_id ON public.risk_assessment_attachments(assessment_id)`);
    } catch {
        // ignore
    }
    riskAssessmentsAttachmentsReady = true;
    return true;
}

async function insertRiskAssessmentAttachments(assessmentId, files = []) {
    if (!Array.isArray(files) || files.length === 0) return [];
    const ids = [];
    for (const f of files) {
        if (!f || !f.buffer) continue;
        const r = await pool.query(
            `INSERT INTO public.risk_assessment_attachments (assessment_id, file_name, mime_type, file_data)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
            [assessmentId ?? null, f.originalname ?? null, f.mimetype ?? null, f.buffer]
        );
        if (r.rows?.[0]?.id != null) ids.push(r.rows[0].id);
    }
    return ids;
}

// Apply CRUD logging to all operations
applyCrudLogging(router, 'risk_assessments', 'risk_assessments');

// Helper: Generate reference number (e.g., RAST-2025-xxxxx)
function genRef() {
    const year = new Date().getFullYear();
    const random = Math.random().toString(16).slice(2, 7).toUpperCase();
    return `RAST-${year}-${random}`;
}

async function getAllowedPropertyIds(user) {
    if (!user) return [];
    if (user.role === 'admin') return null;

    let query = '';
    let params = [];

    if (user.role === 'manager') {
        query = 'SELECT id FROM public.hotels WHERE manager_id = $1';
        params = [user.id];
        if (user.branch) {
            query += ' OR branch = $2';
            params.push(user.branch);
        }
    } else if (user.role === 'staff') {
        const assignedHotelId = user.hotel_id || user.hotelId || user.hotel || null;
        if (!assignedHotelId) return [];
        query = 'SELECT id FROM public.hotels WHERE id = $1';
        params = [assignedHotelId];
    } else {
        return [];
    }

    const result = await pool.query(query, params);
    return result.rows.map(r => r.id);
}

// --- GET: List all risk assessments (with pagination) ---
router.get('/', protect, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        const allowedIds = await getAllowedPropertyIds(req.user);
        const allowedIdsText = allowedIds === null ? null : (allowedIds || []).map((x) => String(x));
        if (allowedIdsText !== null && allowedIdsText.length === 0) return res.json([]);

        const values = [];
        let text = 'SELECT * FROM public.risk_assessments';
        if (allowedIdsText !== null) {
            text += ' WHERE property_id::text = ANY($1::text[])';
            values.push(allowedIdsText);
        }
        values.push(limit, offset);
        text += ` ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`;

        const result = await pool.query(text, values);

        res.json(Array.isArray(result.rows) ? result.rows : []);
    } catch (err) {
        console.error('GET /risk-assessments error:', err);
        res.status(500).json({ message: 'Failed to fetch risk assessments' });
    }
});

// --- GET: Single risk assessment by ID ---
router.get('/:id', protect, async (req, res, next) => {
    try {
        const { id } = req.params;
        if (String(id) === 'attachments') return next();
        const query = 'SELECT * FROM public.risk_assessments WHERE id = $1';
        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Risk assessment not found' });
        }

        const allowedIds = await getAllowedPropertyIds(req.user);
        const allowedIdsText = allowedIds === null ? null : (allowedIds || []).map((x) => String(x));
        const record = result.rows[0];
        if (allowedIdsText !== null && !allowedIdsText.includes(String(record.property_id))) {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json(record);
    } catch (err) {
        console.error('GET /risk-assessments/:id error:', err);
        res.status(500).json({ message: 'Failed to fetch risk assessment' });
    }
});

// --- GET: Get risk assessment attachment ---
router.get('/attachments/:id', protect, async (req, res) => {
    try {
        await ensureRiskAssessmentsAttachments();
        const id = req.params.id;
        if (!/^\d+$/.test(String(id))) return res.status(400).end();
        const r = await pool.query(
            `SELECT id, file_name, mime_type, file_data
       FROM public.risk_assessment_attachments
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
        console.error('GET /api/safeguarding/risk-assessments/attachments/:id error:', err && (err.stack || err));
        return res.status(500).end();
    }
});

// --- DELETE: Delete risk assessment attachment ---
router.delete('/attachments/:id', protect, async (req, res) => {
    try {
        await ensureRiskAssessmentsAttachments();
        const id = req.params.id;
        if (!/^\d+$/.test(String(id))) return res.status(400).json({ message: 'Invalid attachment id' });
        const attId = Number(id);

        const existing = await pool.query(
            `SELECT id, assessment_id FROM public.risk_assessment_attachments WHERE id = $1 LIMIT 1`,
            [attId]
        );
        if (!existing.rows?.length) return res.status(404).json({ message: 'Attachment not found' });
        const assessmentId = existing.rows[0]?.assessment_id ?? null;

        await pool.query(`DELETE FROM public.risk_assessment_attachments WHERE id = $1`, [attId]);

        if (assessmentId) {
            await pool.query(
                `UPDATE public.risk_assessments
         SET attachments = COALESCE(
           (SELECT jsonb_agg(value)
            FROM jsonb_array_elements(COALESCE(attachments, '[]'::jsonb)) value
            WHERE value::text <> to_jsonb($1::int)::text
           ),
           '[]'::jsonb
         ),
         updated_at = NOW()
         WHERE id = $2`,
                [attId, assessmentId]
            );
        }

        return res.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/safeguarding/risk-assessments/attachments/:id error:', err && (err.stack || err));
        return res.status(500).json({ message: 'Server error', detail: err?.message });
    }
});

// --- POST: Create new risk assessment ---
router.post('/', protect, upload.array('photos', 10), async (req, res) => {
    try {
        await ensureRiskAssessmentsAttachments();
        const reference = genRef();

        const allowedIds = await getAllowedPropertyIds(req.user);
        const allowedIdsText = allowedIds === null ? null : (allowedIds || []).map((x) => String(x));
        let propertyId = req.body.property_id != null ? parseInt(req.body.property_id, 10) : null;
        if (req.user?.role === 'staff') {
            const assignedHotelId = req.user.hotel_id || req.user.hotelId || req.user.hotel || null;
            if (assignedHotelId) {
                propertyId = parseInt(assignedHotelId, 10);
                req.body.property_id = propertyId;
            }
        }
        if (allowedIdsText !== null) {
            if (!propertyId || !allowedIdsText.includes(String(propertyId))) {
                return res.status(403).json({ message: 'Cannot create risk assessment for a property outside your access' });
            }
        }

        // Get all columns from the table
        const columnsResult = await pool.query(
            `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'risk_assessments'`
        );

        const columnsResultWithTypes = await pool.query(
            `SELECT column_name, data_type, udt_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'risk_assessments'`
        );

        const colTypeMap = new Map(
            (columnsResultWithTypes.rows || []).map((r) => [r.column_name, r.data_type || r.udt_name])
        );

        const allColumns = columnsResult.rows.map(r => r.column_name);

        // Standard columns (excluding id, timestamps, and auto-generated fields)
        const standardColumns = [
            'id', 'reference', 'created_at', 'updated_at', 'created_by', 'updated_by',
            'title', 'description', 'property_id', 'property_name', 'category',
            'risk_level', 'assigned_to', 'reported_by', 'assessment_date', 'status',
            'findings', 'recommendations'
        ];

        // Find custom columns
        const customColumns = allColumns.filter(col => !standardColumns.includes(col));

        const missing = [];
        if (!req.body.title || String(req.body.title).trim() === '') missing.push('title');
        if (!req.body.description || String(req.body.description).trim() === '') missing.push('description');
        if (!req.body.property_id || String(req.body.property_id).trim() === '') missing.push('property_id');
        if (!req.body.property_name || String(req.body.property_name).trim() === '') missing.push('property_name');
        if (!req.body.category || String(req.body.category).trim() === '') missing.push('category');
        if (!req.body.risk_level || String(req.body.risk_level).trim() === '') missing.push('risk_level');
        if (!req.body.assigned_to || String(req.body.assigned_to).trim() === '') missing.push('assigned_to');
        if (!req.body.reported_by || String(req.body.reported_by).trim() === '') missing.push('reported_by');
        if (!req.body.assessment_date || String(req.body.assessment_date).trim() === '') missing.push('assessment_date');
        if (!req.body.status || String(req.body.status).trim() === '') missing.push('status');
        if (!req.body.findings || String(req.body.findings).trim() === '') missing.push('findings');
        if (!req.body.recommendations || String(req.body.recommendations).trim() === '') missing.push('recommendations');

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
        const columns = ['reference', 'title', 'description', 'property_id', 'property_name', 'category', 'risk_level', 'assigned_to', 'reported_by', 'assessment_date', 'status', 'findings', 'recommendations', 'created_at', 'updated_at'];

        const values = [
            reference,
            req.body.title,
            req.body.description,
            req.body.property_id || null,
            req.body.property_name || '',
            req.body.category,
            req.body.risk_level || 'Medium',
            req.body.assigned_to || '',
            req.body.reported_by || '',
            req.body.assessment_date || null,
            req.body.status || 'New',
            req.body.findings || '',
            req.body.recommendations || '',
            'NOW()', // String literal for SQL
            'NOW()'  // String literal for SQL
        ];

        // Add custom columns values (before timestamps)
        customColumns.forEach(col => {
            if (req.body[col] !== undefined) {
                columns.splice(columns.length - 2, 0, col);
                values.splice(values.length - 2, 0, req.body[col]);
            }
        });

        // Determine cutoff for parameters (exclude last two "NOW()" strings)
        const timestampStartIndex = values.length - 2;

        // Build placeholders ($1, $2) vs raw values ('NOW()')
        const placeholders = values.map((val, i) => {
            if (i >= timestampStartIndex) return val; // Returns 'NOW()'
            return `$${i + 1}`; // Returns $1, $2, etc.
        });

        // Extract only the bind parameters (exclude 'NOW()')
        const paramValues = values.slice(0, timestampStartIndex);

        const query = `INSERT INTO public.risk_assessments (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;

        const result = await pool.query(query, paramValues);
        let created = result.rows[0];

        if (created?.id && Array.isArray(req.files) && req.files.length) {
            const newIds = await insertRiskAssessmentAttachments(created.id, req.files);
            if (newIds.length) {
                try {
                    const up = await pool.query(
                        `UPDATE public.risk_assessments SET attachments = $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING *`,
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
        console.error('POST /risk-assessments error:', err);
        res.status(500).json({ message: 'Failed to create risk assessment' });
    }
});

// --- PATCH: Update risk assessment ---
router.patch('/:id', protect, upload.array('photos', 10), async (req, res) => {
    try {
        await ensureRiskAssessmentsAttachments();
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

        if (req.user?.role === 'staff') {
            const assignedHotelId = req.user.hotel_id || req.user.hotelId || req.user.hotel || null;
            if (assignedHotelId) {
                req.body.property_id = assignedHotelId;
            }
        }

        const allowedIds = await getAllowedPropertyIds(req.user);
        const allowedIdsText = allowedIds === null ? null : (allowedIds || []).map((x) => String(x));
        if (allowedIdsText !== null) {
            const checkRes = await pool.query('SELECT property_id FROM public.risk_assessments WHERE id=$1', [id]);
            if (checkRes.rows.length === 0) return res.status(404).json({ message: 'Risk assessment not found' });
            const existingPropertyId = checkRes.rows[0].property_id;
            if (!allowedIdsText.includes(String(existingPropertyId))) {
                return res.status(403).json({ message: 'Access denied' });
            }

            if (req.body.property_id !== undefined && req.body.property_id !== null) {
                const nextPropertyId = parseInt(req.body.property_id, 10);
                if (!allowedIdsText.includes(String(nextPropertyId))) {
                    return res.status(403).json({ message: 'Cannot move risk assessment to a property outside your access' });
                }
            }
        }

        const columnsResultWithTypes = await pool.query(
            `SELECT column_name, data_type, udt_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'risk_assessments'`
        );

        const colTypeMap = new Map(
            (columnsResultWithTypes.rows || []).map((r) => [r.column_name, r.data_type || r.udt_name])
        );

        // Get all columns from the table
        const columnsResult = await pool.query(
            `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'risk_assessments'`
        );

        const allColumns = columnsResult.rows.map(r => r.column_name);

        // Standard columns (excluding id, timestamps, and auto-generated fields)
        const standardColumns = [
            'id', 'reference', 'created_at', 'updated_at', 'created_by', 'updated_by', 'attachments'
        ];

        // Find updatable columns
        const updatableColumns = allColumns.filter(col => !standardColumns.includes(col));

        // Build SET clause dynamically
        const setClauses = [];
        const values = [];
        let paramIndex = 1;

        // Standard fields
        const standardFields = ['title', 'description', 'property_id', 'property_name', 'category', 'risk_level', 'assigned_to', 'reported_by', 'assessment_date', 'status', 'findings', 'recommendations'];

        standardFields.forEach(field => {
            if (req.body[field] !== undefined) {
                setClauses.push(`${quoteIdent(field)}=$${paramIndex}`);
                values.push(coerceValueByPgType(colTypeMap.get(field), req.body[field]));
                paramIndex++;
            }
        });

        // Custom columns
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

        const query = `UPDATE public.risk_assessments SET ${setClauses.join(', ')} WHERE id=$${paramIndex} RETURNING *`;

        const result = await pool.query(query, values);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Risk assessment not found' });

        let updated = result.rows[0];
        if (updated?.id && Array.isArray(req.files) && req.files.length) {
            const newIds = await insertRiskAssessmentAttachments(updated.id, req.files);
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
                        `UPDATE public.risk_assessments SET attachments = $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING *`,
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
        console.error('PATCH /risk-assessments/:id error:', err);
        res.status(500).json({ message: 'Failed to update risk assessment' });
    }
});

// --- DELETE: Delete risk assessment ---
router.delete('/:id', protect, async (req, res) => {
    try {
        const { id } = req.params;

        const allowedIds = await getAllowedPropertyIds(req.user);
        if (allowedIds !== null) {
            const checkRes = await pool.query('SELECT property_id FROM public.risk_assessments WHERE id=$1', [id]);
            if (checkRes.rows.length === 0) return res.status(404).json({ message: 'Risk assessment not found' });
            if (!allowedIds.includes(checkRes.rows[0].property_id)) {
                return res.status(403).json({ message: 'Access denied' });
            }
        }

        const query = 'DELETE FROM public.risk_assessments WHERE id = $1 RETURNING id';
        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Risk assessment not found' });
        }

        res.json({ message: 'Risk assessment deleted', id });
    } catch (err) {
        console.error('DELETE /risk-assessments/:id error:', err);
        res.status(500).json({ message: 'Failed to delete risk assessment' });
    }
});

export default router;
