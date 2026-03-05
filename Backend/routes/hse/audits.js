import express from 'express';
import { protect } from '../../middleware/auth.js';
import { buildRoleWhere } from '../../middleware/roleFilter.js';
import pool from '../../config/db.js';

const router = express.Router();

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

// GET single
router.get('/:id', protect, async (req, res) => {
    try {
        const { id } = req.params;
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
router.post('/', protect, async (req, res) => {
    try {
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
            'priority', 'reported_by', 'assigned_to', 'scheduled_date', 'status'
        ];

        // Identify custom columns
        const customColumns = allColumns.filter(col => !standardColumns.includes(col));

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
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('POST /audits error', err);
        res.status(500).json({ message: err.message });
    }
});

// PATCH
router.patch('/:id', protect, async (req, res) => {
    try {
        const { id } = req.params;

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
            `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'hse_audits'`
        );

        const allColumns = columnsResult.rows.map(r => r.column_name);

        // Standard columns
        const standardColumns = [
            'id', 'reference', 'created_at', 'updated_at', 'created_by', 'updated_by'
        ];

        const updatableColumns = allColumns.filter(col => !standardColumns.includes(col));

        const setClauses = [];
        const values = [];
        let paramIndex = 1;

        const standardFields = ['title', 'description', 'property_id', 'property_name', 'category', 'priority', 'reported_by', 'assigned_to', 'scheduled_date', 'status'];

        standardFields.forEach(field => {
            if (req.body[field] !== undefined) {
                setClauses.push(`${field}=$${paramIndex}`);
                values.push(req.body[field]);
                paramIndex++;
            }
        });

        updatableColumns.forEach(col => {
            if (!standardFields.includes(col) && req.body[col] !== undefined) {
                setClauses.push(`${col}=$${paramIndex}`);
                values.push(req.body[col]);
                paramIndex++;
            }
        });

        setClauses.push('updated_at=NOW()');
        values.push(id);

        const query = `UPDATE public.hse_audits SET ${setClauses.join(', ')} WHERE id=$${paramIndex} RETURNING *`;

        const result = await pool.query(query, values);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('PATCH /audits/:id error', err);
        res.status(500).json({ message: err.message });
    }
});

// DELETE
router.delete('/:id', protect, async (req, res) => {
    try {
        const { id } = req.params;

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
