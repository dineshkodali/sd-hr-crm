import express from 'express';
import { protect } from '../../middleware/auth.js';
import { buildRoleWhere } from '../../middleware/roleFilter.js';
import pool from '../../config/db.js';

const router = express.Router();

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
router.get('/:id', protect, async (req, res) => {
    try {
        const { id } = req.params;
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

// POST create
router.post('/', protect, async (req, res) => {
    try {
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

        // Get existing columns
        let existingCols = [];
        try {
            const { rows: colRows } = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'hse_incidents' AND table_schema = 'public'
      `);
            existingCols = colRows.map(r => r.column_name);
        } catch (schemaErr) {
            console.error('Error querying schema:', schemaErr);
            existingCols = ['id', 'reference', 'incident_type', 'severity', 'property_id', 'property_name', 'affected_person', 'reported_by', 'details', 'assigned_investigator', 'status', 'incident_date', 'created_at', 'updated_at'];
        }

        // Build dynamic INSERT
        const columnsToInsert = ['reference', 'incident_type', 'severity', 'property_id', 'property_name', 'affected_person', 'reported_by', 'details', 'assigned_investigator', 'status', 'incident_date', 'created_at', 'updated_at'];
        const valuesToInsert = [reference, incident_type, severity, resolvedPropertyId, property_name, affected_person, reported_by, details, assigned_investigator, status || 'Open', incident_date || null, new Date(), new Date()];
        let idx = valuesToInsert.length + 1;

        // Handle custom columns
        const standardCols = ['id', 'reference', 'incident_type', 'severity', 'property_id', 'property_name', 'affected_person', 'reported_by', 'details', 'assigned_investigator', 'status', 'incident_date', 'created_at', 'updated_at'];
        for (const col of existingCols) {
            if (!standardCols.includes(col) && req.body[col] !== undefined) {
                columnsToInsert.push(col);
                valuesToInsert.push(req.body[col]);
            }
        }

        const placeholders = columnsToInsert.map((_, i) => `$${i + 1}`).join(', ');
        const query = `INSERT INTO public.hse_incidents (${columnsToInsert.join(', ')}) VALUES (${placeholders}) RETURNING *`;

        const result = await pool.query(query, valuesToInsert);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('POST /hse-incidents error', err);
        res.status(500).json({ message: err.message });
    }
});

// PATCH
router.patch('/:id', protect, async (req, res) => {
    try {
        const { id } = req.params;
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

        // Get existing columns
        let existingCols = [];
        try {
            const { rows: colRows } = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'hse_incidents' AND table_schema = 'public'
      `);
            existingCols = colRows.map(r => r.column_name);
        } catch (schemaErr) {
            console.error('Error querying schema:', schemaErr);
            existingCols = ['id', 'reference', 'incident_type', 'severity', 'property_id', 'property_name', 'affected_person', 'reported_by', 'details', 'assigned_investigator', 'status', 'incident_date', 'created_at', 'updated_at'];
        }

        // Build dynamic UPDATE
        const setParts = [];
        const values = [];
        let idx = 1;

        if (incident_type !== undefined) { setParts.push(`incident_type = $${idx++}`); values.push(incident_type); }
        if (severity !== undefined) { setParts.push(`severity = $${idx++}`); values.push(severity); }
        if (property_id !== undefined) { setParts.push(`property_id = $${idx++}`); values.push(property_id); }
        if (property_name !== undefined) { setParts.push(`property_name = $${idx++}`); values.push(property_name); }
        if (affected_person !== undefined) { setParts.push(`affected_person = $${idx++}`); values.push(affected_person); }
        if (reported_by !== undefined) { setParts.push(`reported_by = $${idx++}`); values.push(reported_by); }
        if (details !== undefined) { setParts.push(`details = $${idx++}`); values.push(details); }
        if (assigned_investigator !== undefined) { setParts.push(`assigned_investigator = $${idx++}`); values.push(assigned_investigator); }
        if (status !== undefined) { setParts.push(`status = $${idx++}`); values.push(status); }
        if (incident_date !== undefined) { setParts.push(`incident_date = $${idx++}`); values.push(incident_date); }

        // Handle custom columns
        const standardCols = ['id', 'reference', 'incident_type', 'severity', 'property_id', 'property_name', 'affected_person', 'reported_by', 'details', 'assigned_investigator', 'status', 'incident_date', 'created_at', 'updated_at'];
        for (const col of existingCols) {
            if (!standardCols.includes(col) && req.body[col] !== undefined) {
                setParts.push(`${col} = $${idx++}`);
                values.push(req.body[col]);
            }
        }

        setParts.push(`updated_at = $${idx++}`);
        values.push(new Date());
        values.push(id);

        const query = `UPDATE public.hse_incidents SET ${setParts.join(', ')} WHERE id = $${idx} RETURNING *`;
        const result = await pool.query(query, values);

        if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('PATCH /hse-incidents/:id error', err);
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
