import express from 'express';
import { protect } from '../../middleware/auth.js';
import pool from '../../config/db.js';
import multer from 'multer';

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
});

let hseTrainingAttachmentsReady = false;
async function ensureHseTrainingAttachments() {
    if (hseTrainingAttachmentsReady) return true;
    try {
        await pool.query("ALTER TABLE public.hse_training ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb");
    } catch {
    }
    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS public.hse_training_attachments (
        id SERIAL PRIMARY KEY,
        training_id INTEGER,
        file_name TEXT,
        mime_type TEXT,
        file_data BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_hse_training_attachments_training_id ON public.hse_training_attachments(training_id)`);
    } catch {
    }
    hseTrainingAttachmentsReady = true;
    return true;
}

async function insertHseTrainingAttachments(trainingId, files = []) {
    if (!Array.isArray(files) || files.length === 0) return [];
    const ids = [];
    for (const f of files) {
        if (!f || !f.buffer) continue;
        const r = await pool.query(
            `INSERT INTO public.hse_training_attachments (training_id, file_name, mime_type, file_data)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
            [trainingId ?? null, f.originalname ?? null, f.mimetype ?? null, f.buffer]
        );
        if (r.rows?.[0]?.id != null) ids.push(r.rows[0].id);
    }
    return ids;
}

function genRef() {
    const year = new Date().getFullYear();
    const random = Math.random().toString(16).slice(2, 10);
    return `HSET-${year}-${random}`;
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

// GET list
router.get('/', protect, async (req, res) => {
    try {
        await ensureHseTrainingAttachments();
        const limit = req.query.limit || 500;

        const allowedIds = await getAllowedPropertyIds(req.user);
        const allowedIdsText = allowedIds === null ? null : (allowedIds || []).map((x) => String(x));
        const values = [];
        let text = 'SELECT * FROM public.hse_training';

        if (allowedIdsText !== null) {
            if (allowedIdsText.length === 0) return res.json([]);
            text += ` WHERE property_id::text = ANY($1::text[])`;
            values.push(allowedIdsText);
        }

        values.push(limit);
        text += ` ORDER BY created_at DESC LIMIT $${values.length}`;

        const result = await pool.query(text, values);
        res.json(result.rows);
    } catch (err) {
        console.error('GET /training error', err);
        res.status(500).json({ message: err.message });
    }
});

router.get('/attachments/:id', protect, async (req, res) => {
    try {
        await ensureHseTrainingAttachments();
        const id = req.params.id;
        if (!/^\d+$/.test(String(id))) return res.status(400).end();
        const r = await pool.query(
            `SELECT id, file_name, mime_type, file_data
       FROM public.hse_training_attachments
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
        console.error('GET /api/hse/training/attachments/:id error:', err);
        return res.status(500).end();
    }
});

router.delete('/attachments/:id', protect, async (req, res) => {
    try {
        await ensureHseTrainingAttachments();
        const id = req.params.id;
        if (!/^[0-9]+$/.test(String(id))) return res.status(400).json({ success: false, message: 'Invalid attachment id' });

        const find = await pool.query(
            `SELECT id, training_id
       FROM public.hse_training_attachments
       WHERE id = $1
       LIMIT 1`,
            [Number(id)]
        );
        if (!find.rows?.length) return res.status(404).json({ success: false, message: 'Attachment not found' });
        const trainingId = find.rows[0].training_id;

        await pool.query(`DELETE FROM public.hse_training_attachments WHERE id = $1`, [Number(id)]);

        if (trainingId) {
            await pool.query(
                `UPDATE public.hse_training
         SET attachments = COALESCE((
           SELECT jsonb_agg(elem)
           FROM jsonb_array_elements(COALESCE(attachments, '[]'::jsonb)) elem
           WHERE elem::text <> to_jsonb($2::int)::text
         ), '[]'::jsonb)
         WHERE id = $1`,
                [Number(trainingId), Number(id)]
            );
        }

        return res.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/hse/training/attachments/:id error:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET single
router.get('/:id', protect, async (req, res, next) => {
    try {
        const { id } = req.params;
        if (String(id) === 'attachments') return next();
        if (!/^\d+$/.test(String(id))) return res.status(400).json({ message: 'Invalid id' });
        const result = await pool.query('SELECT * FROM public.hse_training WHERE id=$1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });

        const allowedIds = await getAllowedPropertyIds(req.user);
        const allowedIdsText = allowedIds === null ? null : (allowedIds || []).map((x) => String(x));
        const record = result.rows[0];
        if (allowedIdsText !== null && !allowedIdsText.includes(String(record.property_id))) {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json(record);
    } catch (err) {
        console.error('GET /training/:id error', err);
        res.status(500).json({ message: err.message });
    }
});

// POST create
router.post('/', protect, upload.array('photos', 10), async (req, res) => {
    try {
        await ensureHseTrainingAttachments();
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
                return res.status(403).json({ message: 'Cannot create training record for a property outside your access' });
            }
        }

        // Get all columns from the table
        const columnsResult = await pool.query(
            `SELECT column_name, data_type, udt_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'hse_training'`
        );

        const allColumns = columnsResult.rows.map(r => r.column_name);
        const columnTypeByName = Object.fromEntries(
            columnsResult.rows.map((r) => [r.column_name, String(r.data_type || r.udt_name || '').toLowerCase()])
        );

        // Standard columns
        const cols = ['reference', 'title', 'description', 'property_id', 'property_name', 'category', 'priority', 'reported_by', 'assigned_to', 'scheduled_date', 'status', 'created_at', 'updated_at'];

        const now = new Date();

        const params = [
            reference,
            req.body.title || null,
            req.body.description || null,
            req.body.property_id || null,
            req.body.property_name || null,
            req.body.category || null,
            req.body.priority || 'Medium',
            req.body.reported_by || null,
            req.body.assigned_to || null,
            req.body.scheduled_date || null,
            req.body.status || 'Open',
            now,
            now
        ];

        // Identify custom columns
        const standardCols = new Set(cols);
        standardCols.add('id');
        standardCols.add('created_by');
        standardCols.add('updated_by');

        const customColumns = allColumns.filter(c => !standardCols.has(c));

        const missing = [];
        if (!req.body.title || String(req.body.title).trim() === '') missing.push('title');
        if (!req.body.description || String(req.body.description).trim() === '') missing.push('description');
        if (!req.body.property_id || String(req.body.property_id).trim() === '') missing.push('property_id');
        if (!req.body.property_name || String(req.body.property_name).trim() === '') missing.push('property_name');
        if (!req.body.category || String(req.body.category).trim() === '') missing.push('category');
        if (!req.body.priority || String(req.body.priority).trim() === '') missing.push('priority');
        if (!req.body.reported_by || String(req.body.reported_by).trim() === '') missing.push('reported_by');
        if (!req.body.assigned_to || String(req.body.assigned_to).trim() === '') missing.push('assigned_to');
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

        // Append custom columns
        customColumns.forEach(col => {
            if (req.body[col] !== undefined) {
                cols.push(col);
                params.push(req.body[col]);
            }
        });

        const placeholders = params.map((_, i) => `$${i + 1}`);

        const query = `INSERT INTO public.hse_training (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;

        const result = await pool.query(query, params);
        const created = result.rows[0];

        const files = req.files || [];
        const newIds = await insertHseTrainingAttachments(created?.id, files);
        if (newIds.length) {
            await pool.query(
                `UPDATE public.hse_training
         SET attachments = COALESCE(attachments, '[]'::jsonb) || to_jsonb($2::int[])
         WHERE id = $1`,
                [created.id, newIds]
            );
            created.attachments = [...newIds];
        }

        res.status(201).json(created);
    } catch (err) {
        console.error('POST /training error', err);
        res.status(500).json({ message: err.message });
    }
});

// PATCH
router.patch('/:id', protect, upload.array('photos', 10), async (req, res) => {
    try {
        await ensureHseTrainingAttachments();
        const { id } = req.params;
        if (!/^\d+$/.test(String(id))) return res.status(400).json({ message: 'Invalid id' });

        if (req.user?.role === 'staff') {
            const assignedHotelId = req.user.hotel_id || req.user.hotelId || req.user.hotel || null;
            if (assignedHotelId) {
                req.body.property_id = assignedHotelId;
            }
        }

        const allowedIds = await getAllowedPropertyIds(req.user);
        const allowedIdsText = allowedIds === null ? null : (allowedIds || []).map((x) => String(x));
        if (allowedIdsText !== null) {
            const checkRes = await pool.query('SELECT property_id FROM public.hse_training WHERE id=$1', [id]);
            if (checkRes.rows.length === 0) return res.status(404).json({ message: 'Not found' });
            const existingPropertyId = checkRes.rows[0].property_id;
            if (!allowedIdsText.includes(String(existingPropertyId))) {
                return res.status(403).json({ message: 'Access denied' });
            }

            if (req.body.property_id !== undefined && req.body.property_id !== null) {
                const nextPropertyId = parseInt(req.body.property_id, 10);
                if (!allowedIdsText.includes(String(nextPropertyId))) {
                    return res.status(403).json({ message: 'Cannot move training record to a property outside your access' });
                }
            }
        }

        // Get all columns from the table
        const columnsResult = await pool.query(
            `SELECT column_name, data_type, udt_name
       FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'hse_training'`
        );

        const allColumns = columnsResult.rows.map((r) => r.column_name);
        const columnTypeByName = Object.fromEntries(
            columnsResult.rows.map((r) => [r.column_name, String(r.data_type || r.udt_name || '').toLowerCase()])
        );

        // Standard columns (excluding id, timestamps, and auto-generated fields)
        const standardColumns = [
            'id', 'reference', 'created_at', 'updated_at', 'created_by', 'updated_by'
        ];

        // Find updatable columns (standard fields + custom columns)
        const updatableColumns = allColumns.filter(col => !standardColumns.includes(col));

        // Build SET clause dynamically based on what's in the request body
        const setClauses = [];
        const values = [];
        let paramIndex = 1;

        // Standard fields
        const standardFields = ['title', 'description', 'property_id', 'property_name', 'category', 'priority', 'reported_by', 'assigned_to', 'scheduled_date', 'status'];

        const normalizeUpdateValue = (col, val) => {
            if (val === '') return null;
            const t = columnTypeByName?.[col];
            const isJson = t === 'json' || t === 'jsonb';
            if (isJson && typeof val === 'string') {
                try {
                    JSON.parse(val);
                    return val;
                } catch {
                    return null;
                }
            }
            return val;
        };

        standardFields.forEach(field => {
            if (req.body[field] !== undefined) {
                setClauses.push(`${field}=$${paramIndex}`);
                values.push(normalizeUpdateValue(field, req.body[field]));
                paramIndex++;
            }
        });

        // Custom columns
        updatableColumns.forEach(col => {
            if (col !== 'attachments' && !standardFields.includes(col) && req.body[col] !== undefined) {
                setClauses.push(`${col}=$${paramIndex}`);
                values.push(normalizeUpdateValue(col, req.body[col]));
                paramIndex++;
            }
        });

        // Always update updated_at
        setClauses.push('updated_at=NOW()');

        // Add id as the last parameter
        values.push(id);

        const query = `UPDATE public.hse_training SET ${setClauses.join(', ')} WHERE id=$${paramIndex} RETURNING *`;

        const result = await pool.query(query, values);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
        const updated = result.rows[0];

        const files = req.files || [];
        const newIds = await insertHseTrainingAttachments(updated?.id, files);
        if (newIds.length) {
            await pool.query(
                `UPDATE public.hse_training
         SET attachments = COALESCE(attachments, '[]'::jsonb) || to_jsonb($2::int[])
         WHERE id = $1`,
                [updated.id, newIds]
            );
            let atts = updated.attachments ?? [];
            try {
                if (typeof atts === 'string' && atts) atts = JSON.parse(atts);
            } catch {
                atts = [];
            }
            updated.attachments = [...(Array.isArray(atts) ? atts : []), ...newIds];
        }

        res.json(updated);
    } catch (err) {
        console.error('PATCH /training/:id error', err);
        res.status(500).json({ message: err.message });
    }
});

// DELETE
router.delete('/:id', protect, async (req, res) => {
    try {
        await ensureHseTrainingAttachments();
        const { id } = req.params;
        if (!/^\d+$/.test(String(id))) return res.status(400).json({ message: 'Invalid id' });

        const allowedIds = await getAllowedPropertyIds(req.user);
        const allowedIdsText = allowedIds === null ? null : (allowedIds || []).map((x) => String(x));
        if (allowedIdsText !== null) {
            const checkRes = await pool.query('SELECT property_id FROM public.hse_training WHERE id=$1', [id]);
            if (checkRes.rows.length === 0) return res.status(404).json({ message: 'Not found' });
            if (!allowedIdsText.includes(String(checkRes.rows[0].property_id))) {
                return res.status(403).json({ message: 'Access denied' });
            }
        }

        const result = await pool.query('DELETE FROM public.hse_training WHERE id=$1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
        res.json({ message: 'Deleted', record: result.rows[0] });
    } catch (err) {
        console.error('DELETE /training/:id error', err);
        res.status(500).json({ message: err.message });
    }
});

export default router;
