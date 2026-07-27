import express from 'express';
import { protect } from '../../middleware/auth.js';
import { buildRoleWhere } from '../../middleware/roleFilter.js';
import pool from '../../config/db.js';
import multer from 'multer';

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
});

let hseAuditsAttachmentsReady = false;
async function ensureHseAuditsAttachments() {
    if (hseAuditsAttachmentsReady) return true;
    try {
        await pool.query("ALTER TABLE public.hse_audits ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb");
    } catch {
    }
    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS public.hse_audit_attachments (
        id SERIAL PRIMARY KEY,
        audit_id INTEGER,
        file_name TEXT,
        mime_type TEXT,
        file_data BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_hse_audit_attachments_audit_id ON public.hse_audit_attachments(audit_id)`);
    } catch {
    }
    hseAuditsAttachmentsReady = true;
    return true;
}

async function insertHseAuditAttachments(auditId, files = []) {
    if (!Array.isArray(files) || files.length === 0) return [];
    const ids = [];
    for (const f of files) {
        if (!f || !f.buffer) continue;
        const r = await pool.query(
            `INSERT INTO public.hse_audit_attachments (audit_id, file_name, mime_type, file_data)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
            [auditId ?? null, f.originalname ?? null, f.mimetype ?? null, f.buffer]
        );
        if (r.rows?.[0]?.id != null) ids.push(r.rows[0].id);
    }
    return ids;
}

function genRef() {
    const year = new Date().getFullYear();
    const random = Math.random().toString(16).slice(2, 10);
    return `HSEA-${year}-${random}`;
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
        await ensureHseAuditsAttachments();
        const limit = parseInt(req.query.limit) || 500;
        const allowedIds = await getAllowedPropertyIds(req.user);
        const allowedIdsText = allowedIds === null ? null : (allowedIds || []).map((x) => String(x));
        const { clause, params } = buildRoleWhere(req, 1);
        let text = 'SELECT * FROM public.hse_audits';
        const values = [];

        const where = [];

        if (allowedIdsText !== null) {
            if (allowedIdsText.length === 0) return res.json([]);
            where.push(`property_id::text = ANY($${values.length + 1}::text[])`);
            values.push(allowedIdsText);
        }

        if (clause) {
            where.push(`(${clause})`);
            values.push(...params);
        }

        if (where.length) {
            text += ' WHERE ' + where.join(' AND ');
        }

        values.push(limit);
        text += ` ORDER BY created_at DESC LIMIT $${values.length}`;

        const result = await pool.query(text, values);
        res.json(result.rows);
    } catch (err) {
        console.error('GET /audits error', err);
        res.status(500).json({ message: err.message });
    }
});

router.get('/attachments/:id', protect, async (req, res) => {
    try {
        await ensureHseAuditsAttachments();
        const id = req.params.id;
        if (!/^\d+$/.test(String(id))) return res.status(400).end();
        const r = await pool.query(
            `SELECT id, file_name, mime_type, file_data
       FROM public.hse_audit_attachments
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
        console.error('GET /api/hse/audits/attachments/:id error:', err);
        return res.status(500).end();
    }
});

router.delete('/attachments/:id', protect, async (req, res) => {
    try {
        await ensureHseAuditsAttachments();
        const id = req.params.id;
        if (!/^[0-9]+$/.test(String(id))) return res.status(400).json({ success: false, message: 'Invalid attachment id' });

        const find = await pool.query(
            `SELECT id, audit_id
       FROM public.hse_audit_attachments
       WHERE id = $1
       LIMIT 1`,
            [Number(id)]
        );
        if (!find.rows?.length) return res.status(404).json({ success: false, message: 'Attachment not found' });
        const auditId = find.rows[0].audit_id;

        await pool.query(`DELETE FROM public.hse_audit_attachments WHERE id = $1`, [Number(id)]);

        if (auditId) {
            await pool.query(
                `UPDATE public.hse_audits
         SET attachments = COALESCE((
           SELECT jsonb_agg(elem)
           FROM jsonb_array_elements(COALESCE(attachments, '[]'::jsonb)) elem
           WHERE elem::text <> to_jsonb($2::int)::text
         ), '[]'::jsonb)
         WHERE id = $1`,
                [Number(auditId), Number(id)]
            );
        }

        return res.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/hse/audits/attachments/:id error:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET single
router.get('/:id', protect, async (req, res) => {
    try {
        const { id } = req.params;
        if (!/^\d+$/.test(String(id))) return res.status(400).json({ message: 'Invalid id' });
        const result = await pool.query('SELECT * FROM public.hse_audits WHERE id=$1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });

        const allowedIds = await getAllowedPropertyIds(req.user);
        const allowedIdsText = allowedIds === null ? null : (allowedIds || []).map((x) => String(x));
        const record = result.rows[0];
        if (allowedIdsText !== null && !allowedIdsText.includes(String(record.property_id))) {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json(record);
    } catch (err) {
        console.error('GET /audits/:id error', err);
        res.status(500).json({ message: err.message });
    }
});

// POST create
router.post('/', protect, upload.array('photos', 10), async (req, res) => {
    try {
        await ensureHseAuditsAttachments();
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
                return res.status(403).json({ message: 'Cannot create audit for a property outside your access' });
            }
        }

        // Get all columns from the table to check for custom fields
        const columnsResult = await pool.query(
            `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'hse_audits'`
        );

        const allColumns = columnsResult.rows.map(r => r.column_name);

        // Standard columns
        const standardColumns = [
            'id', 'reference', 'created_at', 'updated_at', 'created_by', 'updated_by',
            'title', 'description', 'property_id', 'property_name', 'category',
            'priority', 'reported_by', 'assigned_to', 'scheduled_date', 'status',
            'attachments', 'deleted', 'deleted_at'
        ];

        // Identify custom columns
        const standardCols = new Set(standardColumns);
        const customColumns = allColumns.filter(col => !standardCols.has(col));

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

        const columns = [
            'reference', 'title', 'description', 'property_id', 'property_name',
            'category', 'priority', 'reported_by', 'assigned_to',
            'scheduled_date', 'status', 'created_at', 'updated_at'
        ];

        const values = [
            reference,
            req.body.title,
            req.body.description,
            req.body.property_id || null,
            req.body.property_name || null,
            req.body.category || null,
            req.body.priority || 'Medium',
            req.body.reported_by || null,
            req.body.assigned_to || null,
            req.body.scheduled_date || null,
            req.body.status || 'Open',
            'NOW()',
            'NOW()'
        ];

        customColumns.forEach(col => {
            if (req.body[col] !== undefined) {
                columns.splice(columns.length - 2, 0, col);
                values.splice(values.length - 2, 0, req.body[col]);
            }
        });

        const timestampStartIndex = values.length - 2;

        const placeholders = values.map((val, i) => {
            if (i >= timestampStartIndex) return val;
            return `$${i + 1}`;
        });

        const paramValues = values.slice(0, timestampStartIndex);

        const query = `INSERT INTO public.hse_audits (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;

        const result = await pool.query(query, paramValues);
        const created = result.rows[0];

        const files = req.files || [];
        const newIds = await insertHseAuditAttachments(created?.id, files);
        if (newIds.length) {
            await pool.query(
                `UPDATE public.hse_audits
         SET attachments = COALESCE(attachments, '[]'::jsonb) || to_jsonb($2::int[])
         WHERE id = $1`,
                [created.id, newIds]
            );
            created.attachments = [...newIds];
        }

        res.status(201).json(created);
    } catch (err) {
        console.error('POST /audits error', err);
        res.status(500).json({ message: err.message });
    }
});

// PATCH
router.patch('/:id', protect, upload.array('photos', 10), async (req, res) => {
    try {
        await ensureHseAuditsAttachments();
        const { id } = req.params;
        if (!/^\d+$/.test(String(id))) return res.status(400).json({ message: 'Invalid id' });

        if (req.user?.role === 'staff') {
            const assignedHotelId = req.user.hotel_id || req.user.hotelId || req.user.hotel || null;
            if (assignedHotelId) {
                req.body.property_id = parseInt(assignedHotelId, 10);
            }
        }

        const allowedIds = await getAllowedPropertyIds(req.user);
        const allowedIdsText = allowedIds === null ? null : (allowedIds || []).map((x) => String(x));
        if (allowedIdsText !== null) {
            const checkRes = await pool.query('SELECT property_id FROM public.hse_audits WHERE id=$1', [id]);
            if (checkRes.rows.length === 0) return res.status(404).json({ message: 'Not found' });
            const existingPropertyId = checkRes.rows[0].property_id;
            if (!allowedIdsText.includes(String(existingPropertyId))) {
                return res.status(403).json({ message: 'Access denied' });
            }

            if (req.body.property_id !== undefined && req.body.property_id !== null) {
                const nextPropertyId = parseInt(req.body.property_id, 10);
                if (!allowedIdsText.includes(String(nextPropertyId))) {
                    return res.status(403).json({ message: 'Cannot move audit to a property outside your access' });
                }
            }
        }

        // Get all columns from the table
        const columnsResult = await pool.query(
            `SELECT column_name, data_type, udt_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'hse_audits'`
        );

        const allColumns = columnsResult.rows.map(r => r.column_name);
        const columnTypeByName = Object.fromEntries(
            columnsResult.rows.map((r) => [r.column_name, String(r.data_type || r.udt_name || '').toLowerCase()])
        );

        // Standard columns
        const standardColumns = [
            'id', 'reference', 'created_at', 'updated_at', 'created_by', 'updated_by'
        ];

        const updatableColumns = allColumns.filter(col => !standardColumns.includes(col));

        const setClauses = [];
        const values = [];
        let paramIndex = 1;

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

        updatableColumns.forEach(col => {
            if (col !== 'attachments' && !standardFields.includes(col) && req.body[col] !== undefined) {
                setClauses.push(`${col}=$${paramIndex}`);
                values.push(normalizeUpdateValue(col, req.body[col]));
                paramIndex++;
            }
        });

        setClauses.push('updated_at=NOW()');
        values.push(id);

        const query = `UPDATE public.hse_audits SET ${setClauses.join(', ')} WHERE id=$${paramIndex} RETURNING *`;

        const result = await pool.query(query, values);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
        const updated = result.rows[0];

        const files = req.files || [];
        const newIds = await insertHseAuditAttachments(updated?.id, files);
        if (newIds.length) {
            await pool.query(
                `UPDATE public.hse_audits
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
        console.error('PATCH /audits/:id error', err);
        res.status(500).json({ message: err.message });
    }
});

// DELETE
router.delete('/:id', protect, async (req, res) => {
    try {
        await ensureHseAuditsAttachments();
        const { id } = req.params;
        if (!/^\d+$/.test(String(id))) return res.status(400).json({ message: 'Invalid id' });

        const allowedIds = await getAllowedPropertyIds(req.user);
        const allowedIdsText = allowedIds === null ? null : (allowedIds || []).map((x) => String(x));
        if (allowedIdsText !== null) {
            const checkRes = await pool.query('SELECT property_id FROM public.hse_audits WHERE id=$1', [id]);
            if (checkRes.rows.length === 0) return res.status(404).json({ message: 'Not found' });
            if (!allowedIdsText.includes(String(checkRes.rows[0].property_id))) {
                return res.status(403).json({ message: 'Access denied' });
            }
        }

        const result = await pool.query('DELETE FROM public.hse_audits WHERE id=$1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
        res.json({ message: 'Deleted', record: result.rows[0] });
    } catch (err) {
        console.error('DELETE /audits/:id error', err);
        res.status(500).json({ message: err.message });
    }
});

export default router;
