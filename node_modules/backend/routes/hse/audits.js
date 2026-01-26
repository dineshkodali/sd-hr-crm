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

// GET list
router.get('/', protect, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 500;
        const { clause, params } = buildRoleWhere(req, 1);
        let text = 'SELECT * FROM public.hse_audits';
        const values = [];
        if (clause) {
            text += ' WHERE ' + clause;
            values.push(...params);
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
        res.json(result.rows[0]);
    } catch (err) {
        console.error('GET /audits/:id error', err);
        res.status(500).json({ message: err.message });
    }
});

// POST create
router.post('/', protect, async (req, res) => {
    try {
        const reference = genRef();

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
        const result = await pool.query('DELETE FROM public.hse_audits WHERE id=$1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
        res.json({ message: 'Deleted', record: result.rows[0] });
    } catch (err) {
        console.error('DELETE /audits/:id error', err);
        res.status(500).json({ message: err.message });
    }
});

export default router;
