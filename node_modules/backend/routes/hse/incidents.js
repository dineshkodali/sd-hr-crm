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

let cachedHseIncidentsSchema = null;
let cachedHseIncidentsSchemaAt = 0;
const HSE_INCIDENTS_SCHEMA_CACHE_TTL_MS = 5 * 60 * 1000;

async function getHseIncidentsSchema() {
    const now = Date.now();
    if (
        cachedHseIncidentsSchema &&
        cachedHseIncidentsSchemaAt &&
        now - cachedHseIncidentsSchemaAt < HSE_INCIDENTS_SCHEMA_CACHE_TTL_MS
    ) {
        return cachedHseIncidentsSchema;
    }

    try {
        const { rows: colRows } = await pool.query(
            `SELECT column_name, data_type, udt_name
         FROM information_schema.columns
         WHERE table_name = 'hse_incidents' AND table_schema = 'public'`
        );
        const existingCols = colRows.map((r) => r.column_name);
        const columnTypeByName = Object.fromEntries(
            colRows.map((r) => [r.column_name, String(r.data_type || r.udt_name || '').toLowerCase()])
        );

        cachedHseIncidentsSchema = { existingCols, columnTypeByName };
        cachedHseIncidentsSchemaAt = now;
        return cachedHseIncidentsSchema;
    } catch (schemaErr) {
        console.error('Error querying hse_incidents schema:', schemaErr);
        const existingCols = [
            'id',
            'reference',
            'incident_type',
            'severity',
            'property_id',
            'property_name',
            'affected_person',
            'reported_by',
            'details',
            'assigned_investigator',
            'status',
            'incident_date',
            'created_at',
            'updated_at',
            'attachments',
        ];
        const columnTypeByName = {};
        cachedHseIncidentsSchema = { existingCols, columnTypeByName };
        cachedHseIncidentsSchemaAt = now;
        return cachedHseIncidentsSchema;
    }
}

let hseIncidentsAttachmentsReady = false;
async function ensureHseIncidentsAttachments() {
    if (hseIncidentsAttachmentsReady) return true;
    try {
        await pool.query("ALTER TABLE public.hse_incidents ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb");
    } catch {
    }
    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS public.hse_incident_attachments (
        id SERIAL PRIMARY KEY,
        incident_id INTEGER,
        file_name TEXT,
        mime_type TEXT,
        file_data BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_hse_incident_attachments_incident_id ON public.hse_incident_attachments(incident_id)`);
    } catch {
    }
    hseIncidentsAttachmentsReady = true;
    return true;
}

async function insertHseIncidentAttachments(incidentId, files = []) {
    if (!Array.isArray(files) || files.length === 0) return [];
    const ids = [];
    for (const f of files) {
        if (!f || !f.buffer) continue;
        const r = await pool.query(
            `INSERT INTO public.hse_incident_attachments (incident_id, file_name, mime_type, file_data)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
            [incidentId ?? null, f.originalname ?? null, f.mimetype ?? null, f.buffer]
        );
        if (r.rows?.[0]?.id != null) ids.push(r.rows[0].id);
    }
    return ids;
}

function genRef() {
    const year = new Date().getFullYear();
    const random = Math.random().toString(16).slice(2, 10);
    return `HSE-${year}-${random}`;
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
        await ensureHseIncidentsAttachments();
        const limit = parseInt(req.query.limit) || 500;
        const allowedIds = await getAllowedPropertyIds(req.user);
        const allowedIdsText = allowedIds === null ? null : (allowedIds || []).map((x) => String(x));
        const { clause, params } = buildRoleWhere(req, 1);
        let text = 'SELECT * FROM public.hse_incidents';
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
        console.error('GET /hse-incidents error', err);
        res.status(500).json({ message: err.message });
    }
});

// GET single
router.get('/:id', protect, async (req, res, next) => {
    try {
        await ensureHseIncidentsAttachments();
        const { id } = req.params;
        if (String(id) === 'attachments') return next();
        if (!/^\d+$/.test(String(id))) return res.status(400).json({ message: 'Invalid id' });
        const result = await pool.query('SELECT * FROM public.hse_incidents WHERE id=$1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });

        const allowedIds = await getAllowedPropertyIds(req.user);
        const allowedIdsText = allowedIds === null ? null : (allowedIds || []).map((x) => String(x));
        const record = result.rows[0];
        if (allowedIdsText !== null && !allowedIdsText.includes(String(record.property_id))) {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json(record);
    } catch (err) {
        console.error('GET /hse-incidents/:id error', err);
        res.status(500).json({ message: err.message });
    }
});

router.get('/attachments/:id', protect, async (req, res) => {
    try {
        await ensureHseIncidentsAttachments();
        const id = req.params.id;
        if (!/^\d+$/.test(String(id))) return res.status(400).end();
        const r = await pool.query(
            `SELECT id, file_name, mime_type, file_data
       FROM public.hse_incident_attachments
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
        console.error('GET /api/hse/hse-incidents/attachments/:id error:', err);
        return res.status(500).end();
    }
});

router.delete('/attachments/:id', protect, async (req, res) => {
    try {
        await ensureHseIncidentsAttachments();
        const id = req.params.id;
        if (!/^[0-9]+$/.test(String(id))) return res.status(400).json({ success: false, message: 'Invalid attachment id' });

        const find = await pool.query(
            `SELECT id, incident_id
       FROM public.hse_incident_attachments
       WHERE id = $1
       LIMIT 1`,
            [Number(id)]
        );
        if (!find.rows?.length) return res.status(404).json({ success: false, message: 'Attachment not found' });
        const incidentId = find.rows[0].incident_id;

        await pool.query(`DELETE FROM public.hse_incident_attachments WHERE id = $1`, [Number(id)]);

        if (incidentId) {
            await pool.query(
                `UPDATE public.hse_incidents
         SET attachments = COALESCE((
           SELECT jsonb_agg(elem)
           FROM jsonb_array_elements(COALESCE(attachments, '[]'::jsonb)) elem
           WHERE elem::text <> to_jsonb($2::int)::text
         ), '[]'::jsonb)
         WHERE id = $1`,
                [Number(incidentId), Number(id)]
            );
        }

        return res.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/hse/hse-incidents/attachments/:id error:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST create
router.post('/', protect, upload.array('photos', 10), async (req, res) => {
    try {
        await ensureHseIncidentsAttachments();
        const { incident_type, severity, property_id, property_name, affected_person, reported_by, details, assigned_investigator, status, incident_date } = req.body;
        const reference = genRef();

        const allowedIds = await getAllowedPropertyIds(req.user);
        const allowedIdsText = allowedIds === null ? null : (allowedIds || []).map((x) => String(x));
        let resolvedPropertyId = property_id;
        if (req.user?.role === 'staff') {
            const assignedHotelId = req.user.hotel_id || req.user.hotelId || req.user.hotel || null;
            if (assignedHotelId) {
                resolvedPropertyId = assignedHotelId;
            }
        }
        if (allowedIdsText !== null) {
            if (!resolvedPropertyId || !allowedIdsText.includes(String(resolvedPropertyId))) {
                return res.status(403).json({ message: 'Cannot create incident for a property outside your access' });
            }
        }

        const missing = [];
        if (!incident_type || String(incident_type).trim() === '') missing.push('incident_type');
        if (!severity || String(severity).trim() === '') missing.push('severity');
        if (!resolvedPropertyId || String(resolvedPropertyId).trim() === '') missing.push('property_id');
        if (!property_name || String(property_name).trim() === '') missing.push('property_name');
        if (!affected_person || String(affected_person).trim() === '') missing.push('affected_person');
        if (!reported_by || String(reported_by).trim() === '') missing.push('reported_by');
        if (!details || String(details).trim() === '') missing.push('details');
        if (!assigned_investigator || String(assigned_investigator).trim() === '') missing.push('assigned_investigator');
        if (!status || String(status).trim() === '') missing.push('status');
        if (!incident_date || String(incident_date).trim() === '') missing.push('incident_date');

        const { existingCols, columnTypeByName } = await getHseIncidentsSchema();

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

        // Build dynamic INSERT
        const columnsToInsert = ['reference', 'incident_type', 'severity', 'property_id', 'property_name', 'affected_person', 'reported_by', 'details', 'assigned_investigator', 'status', 'incident_date', 'created_at', 'updated_at'];
        const valuesToInsert = [reference, incident_type, severity, resolvedPropertyId, property_name, affected_person, reported_by, details, assigned_investigator, status || 'Open', incident_date || null, new Date(), new Date()];
        let idx = valuesToInsert.length + 1;

        // Handle custom columns
        const standardCols = ['id', 'reference', 'incident_type', 'severity', 'property_id', 'property_name', 'affected_person', 'reported_by', 'details', 'assigned_investigator', 'status', 'incident_date', 'created_at', 'updated_at', 'attachments'];
        for (const col of existingCols) {
            if (standardCols.includes(col)) continue;
            if (col === 'attachments') continue;
            const v = req.body[col];
            const camel = String(col).replace(/_([a-z])/g, (g) => g[1].toUpperCase());
            const v2 = v === undefined ? req.body[camel] : v;

            if (v2 === undefined || v2 === null || (typeof v2 !== 'boolean' && String(v2).trim() === '')) {
                missing.push(col);
                continue;
            }

            if (v2 !== undefined) {
                columnsToInsert.push(col);
                valuesToInsert.push(v2);
            }
        }

        if (missing.length) {
            return res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` });
        }

        const placeholders = columnsToInsert.map((_, i) => `$${i + 1}`).join(', ');
        const query = `INSERT INTO public.hse_incidents (${columnsToInsert.join(', ')}) VALUES (${placeholders}) RETURNING *`;

        const result = await pool.query(query, valuesToInsert);
        const created = result.rows[0];

        const files = req.files || [];
        const newIds = await insertHseIncidentAttachments(created?.id, files);
        if (newIds.length) {
            await pool.query(
                `UPDATE public.hse_incidents
         SET attachments = COALESCE(attachments, '[]'::jsonb) || to_jsonb($2::int[])
         WHERE id = $1`,
                [created.id, newIds]
            );
            created.attachments = [...newIds];
        }

        res.status(201).json(created);
    } catch (err) {
        console.error('POST /hse-incidents error', err);
        res.status(500).json({ message: err.message });
    }
});

// PATCH
router.patch('/:id', protect, upload.array('photos', 10), async (req, res) => {
    try {
        await ensureHseIncidentsAttachments();
        const { id } = req.params;
        if (!/^\d+$/.test(String(id))) return res.status(400).json({ message: 'Invalid id' });
        const { incident_type, severity, property_id, property_name, affected_person, reported_by, details, assigned_investigator, status, incident_date } = req.body;

        if (req.user?.role === 'staff') {
            const assignedHotelId = req.user.hotel_id || req.user.hotelId || req.user.hotel || null;
            if (assignedHotelId) {
                req.body.property_id = assignedHotelId;
            }
        }

        const allowedIds = await getAllowedPropertyIds(req.user);
        const allowedIdsText = allowedIds === null ? null : (allowedIds || []).map((x) => String(x));
        if (allowedIdsText !== null) {
            const checkRes = await pool.query('SELECT property_id FROM public.hse_incidents WHERE id=$1', [id]);
            if (checkRes.rows.length === 0) return res.status(404).json({ message: 'Not found' });
            const existingPropertyId = checkRes.rows[0].property_id;
            if (!allowedIdsText.includes(String(existingPropertyId))) {
                return res.status(403).json({ message: 'Access denied' });
            }

            if (property_id !== undefined && property_id !== null) {
                const nextPropertyId = parseInt(property_id, 10);
                if (!allowedIdsText.includes(String(nextPropertyId))) {
                    return res.status(403).json({ message: 'Cannot move incident to a property outside your access' });
                }
            }
        }

        const { existingCols, columnTypeByName } = await getHseIncidentsSchema();

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

        // Build dynamic UPDATE
        const setParts = [];
        const values = [];
        let idx = 1;

        if (incident_type !== undefined) { setParts.push(`incident_type = $${idx++}`); values.push(normalizeUpdateValue('incident_type', incident_type)); }
        if (severity !== undefined) { setParts.push(`severity = $${idx++}`); values.push(normalizeUpdateValue('severity', severity)); }
        if (property_id !== undefined) { setParts.push(`property_id = $${idx++}`); values.push(normalizeUpdateValue('property_id', property_id)); }
        if (property_name !== undefined) { setParts.push(`property_name = $${idx++}`); values.push(normalizeUpdateValue('property_name', property_name)); }
        if (affected_person !== undefined) { setParts.push(`affected_person = $${idx++}`); values.push(normalizeUpdateValue('affected_person', affected_person)); }
        if (reported_by !== undefined) { setParts.push(`reported_by = $${idx++}`); values.push(normalizeUpdateValue('reported_by', reported_by)); }
        if (details !== undefined) { setParts.push(`details = $${idx++}`); values.push(normalizeUpdateValue('details', details)); }
        if (assigned_investigator !== undefined) { setParts.push(`assigned_investigator = $${idx++}`); values.push(normalizeUpdateValue('assigned_investigator', assigned_investigator)); }
        if (status !== undefined) { setParts.push(`status = $${idx++}`); values.push(normalizeUpdateValue('status', status)); }
        if (incident_date !== undefined) { setParts.push(`incident_date = $${idx++}`); values.push(normalizeUpdateValue('incident_date', incident_date)); }

        // Handle custom columns
        const standardCols = ['id', 'reference', 'incident_type', 'severity', 'property_id', 'property_name', 'affected_person', 'reported_by', 'details', 'assigned_investigator', 'status', 'incident_date', 'created_at', 'updated_at'];
        for (const col of existingCols) {
            if (col !== 'attachments' && !standardCols.includes(col) && req.body[col] !== undefined) {
                setParts.push(`${col} = $${idx++}`);
                values.push(normalizeUpdateValue(col, req.body[col]));
            }
        }

        setParts.push(`updated_at = $${idx++}`);
        values.push(new Date());
        values.push(id);

        const query = `UPDATE public.hse_incidents SET ${setParts.join(', ')} WHERE id = $${idx} RETURNING *`;
        const result = await pool.query(query, values);

        if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });

        const updated = result.rows[0];
        const files = req.files || [];
        const newIds = await insertHseIncidentAttachments(updated?.id, files);
        if (newIds.length) {
            await pool.query(
                `UPDATE public.hse_incidents
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
        console.error('PATCH /hse-incidents/:id error', err);
        res.status(500).json({ message: err.message });
    }
});

// DELETE
router.delete('/:id', protect, async (req, res) => {
    try {
        await ensureHseIncidentsAttachments();
        const { id } = req.params;
        if (!/^\d+$/.test(String(id))) return res.status(400).json({ message: 'Invalid id' });

        const allowedIds = await getAllowedPropertyIds(req.user);
        const allowedIdsText = allowedIds === null ? null : (allowedIds || []).map((x) => String(x));
        if (allowedIdsText !== null) {
            const checkRes = await pool.query('SELECT property_id FROM public.hse_incidents WHERE id=$1', [id]);
            if (checkRes.rows.length === 0) return res.status(404).json({ message: 'Not found' });
            if (!allowedIdsText.includes(String(checkRes.rows[0].property_id))) {
                return res.status(403).json({ message: 'Access denied' });
            }
        }

        const result = await pool.query('DELETE FROM public.hse_incidents WHERE id=$1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
        res.json({ message: 'Deleted', record: result.rows[0] });
    } catch (err) {
        console.error('DELETE /hse-incidents/:id error', err);
        res.status(500).json({ message: err.message });
    }
});

export default router;
