import express from 'express';
import pool from '../../config/db.js';
import { protect } from '../../middleware/auth.js';
import { applyCrudLogging } from "../../middleware/activityMiddleware.js"; // Enhanced logging

const router = express.Router();


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
router.get('/:id', protect, async (req, res) => {
    try {
        const { id } = req.params;
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

// --- POST: Create new risk assessment ---
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
                return res.status(403).json({ message: 'Cannot create risk assessment for a property outside your access' });
            }
        }

        // Get all columns from the table
        const columnsResult = await pool.query(
            `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'risk_assessments'`
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
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('POST /risk-assessments error:', err);
        res.status(500).json({ message: 'Failed to create risk assessment' });
    }
});

// --- PATCH: Update risk assessment ---
router.patch('/:id', protect, async (req, res) => {
    try {
        const { id } = req.params;

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

        // Get all columns from the table
        const columnsResult = await pool.query(
            `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'risk_assessments'`
        );

        const allColumns = columnsResult.rows.map(r => r.column_name);

        // Standard columns (excluding id, timestamps, and auto-generated fields)
        const standardColumns = [
            'id', 'reference', 'created_at', 'updated_at', 'created_by', 'updated_by'
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
                setClauses.push(`${field}=$${paramIndex}`);
                values.push(req.body[field]);
                paramIndex++;
            }
        });

        // Custom columns
        updatableColumns.forEach(col => {
            if (!standardFields.includes(col) && req.body[col] !== undefined) {
                setClauses.push(`${col}=$${paramIndex}`);
                values.push(req.body[col]);
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
        res.json(result.rows[0]);
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
