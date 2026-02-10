import express from 'express';
import { protect } from '../../middleware/auth.js';
import { applyCrudLogging } from "../../middleware/activityMiddleware.js"; // Enhanced logging
import pool from '../../config/db.js';
const router = express.Router();


// Apply CRUD logging to all operations
applyCrudLogging(router, 'vulnerable_users', 'vulnerable_users');
function genRef() {
    const year = new Date().getFullYear();
    const random = Math.random().toString(16).slice(2, 10);
    return `VUS-${year}-${random}`;
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

// GET all vulnerable users records
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
        const query = `SELECT * FROM public.vulnerable_users ${whereClause} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`;
        values.push(limit, offset);

        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (err) {
        console.error('GET /vulnerable-users error:', err);
        res.status(500).json({ message: err.message });
    }
});

// GET single vulnerable users record by ID
router.get('/:id', protect, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'SELECT * FROM public.vulnerable_users WHERE id = $1',
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Record not found' });
        }

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
        console.error('GET /vulnerable-users/:id error:', err);
        res.status(500).json({ message: err.message });
    }
});

// POST create new vulnerable users record
router.post('/', protect, async (req, res) => {
    try {
        const reference = genRef();

        if (req.user?.role === "staff") {
            const assignedHotelId = req.user.hotel_id || req.user.hotelId || req.user.hotel || null;
            if (assignedHotelId) {
                req.body.property_id = assignedHotelId;
            }
        }

        const restrictedHotelIds = await getRestrictedHotelIds(req.user);
        if (restrictedHotelIds !== null) {
            if (restrictedHotelIds.length === 0) return res.status(403).json({ message: 'Forbidden' });
            const requestedPid = req.body.property_id ?? null;
            if (!requestedPid || !restrictedHotelIds.some((x) => String(x) === String(requestedPid))) {
                return res.status(403).json({ message: 'Forbidden' });
            }
        }

        // Get all columns and their data types
        const columnsResult = await pool.query(
            `SELECT column_name, data_type, udt_name 
       FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'vulnerable_users'`
        );

        // Map column details for type checking
        const colTypes = {};
        columnsResult.rows.forEach(r => {
            colTypes[r.column_name] = r.data_type;
        });

        const allColumns = columnsResult.rows.map(r => r.column_name);

        // Standard columns (excluding id, timestamps, and auto-generated fields)
        const standardColumns = [
            'id', 'reference', 'created_at', 'updated_at', 'created_by', 'updated_by',
            'title', 'description', 'property_id', 'property_name', 'category',
            'priority', 'assigned_to', 'reported_by', 'scheduled_date', 'status'
        ];

        // Find custom columns
        const customColumns = allColumns.filter(col => !standardColumns.includes(col));

        // Build column list and values for standard fields
        const columns = ['reference', 'title', 'description', 'property_id', 'property_name', 'category', 'priority', 'assigned_to', 'reported_by', 'scheduled_date', 'status', 'created_at', 'updated_at'];

        // Helper to sanitize value based on type
        const sanitize = (col, val) => {
            if (val === '') {
                const type = colTypes[col];
                // Integer, Numeric, Date types should be null if empty string
                if (['integer', 'smallint', 'bigint', 'numeric', 'real', 'double precision', 'date', 'timestamp without time zone'].includes(type)) {
                    return null;
                }
            }
            return val;
        };

        const values = [
            reference,
            req.body.title,
            req.body.description,
            sanitize('property_id', req.body.property_id),
            req.body.property_name || '',
            req.body.category,
            req.body.priority || 'Medium',
            req.body.assigned_to || '',
            req.body.reported_by || '',
            sanitize('scheduled_date', req.body.scheduled_date),
            req.body.status || 'New',
            'NOW()',
            'NOW()'
        ];

        // Add custom columns if they exist in the request
        customColumns.forEach(col => {
            if (req.body[col] !== undefined) {
                // Insert custom column before created_at, updated_at
                columns.splice(columns.length - 2, 0, col);
                // Insert custom value before NOW(), NOW(), converting empty to null if needed
                const val = sanitize(col, req.body[col]);
                values.splice(values.length - 2, 0, val);
            }
        });

        // Determine cutoff for parameters (exclude last two "NOW()" strings)
        const timestampStartIndex = values.length - 2;

        // Build parameterized placeholders ($1, $2...) vs raw strings (NOW())
        const placeholders = values.map((val, i) => {
            if (i >= timestampStartIndex) return val; // Returns 'NOW()'
            return `$${i + 1}`; // Returns $1, $2 etc.
        });

        // The actual params passed to pool.query must NOT contain 'NOW()'
        const paramValues = values.slice(0, timestampStartIndex);

        const query = `INSERT INTO public.vulnerable_users (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;

        const result = await pool.query(query, paramValues);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('POST /vulnerable-users error:', err);
        res.status(500).json({ message: err.message });
    }
});

// PATCH update vulnerable users record
router.patch('/:id', protect, async (req, res) => {
    try {
        const { id } = req.params;

        if (req.user?.role === "staff") {
            const assignedHotelId = req.user.hotel_id || req.user.hotelId || req.user.hotel || null;
            if (assignedHotelId) {
                req.body.property_id = assignedHotelId;
            }
        }

        const restrictedHotelIds = await getRestrictedHotelIds(req.user);
        if (restrictedHotelIds !== null) {
            if (restrictedHotelIds.length === 0) return res.status(404).json({ message: 'Record not found' });
            const checkRes = await pool.query('SELECT property_id FROM public.vulnerable_users WHERE id=$1', [id]);
            if (!checkRes.rows.length) return res.status(404).json({ message: 'Record not found' });
            const existingPid = checkRes.rows[0]?.property_id;
            if (!existingPid || !restrictedHotelIds.some((x) => String(x) === String(existingPid))) {
                return res.status(404).json({ message: 'Record not found' });
            }
            if (req.body?.property_id !== undefined && !restrictedHotelIds.some((x) => String(x) === String(req.body.property_id))) {
                return res.status(403).json({ message: 'Forbidden' });
            }
        }

        // Get all columns and their data types
        const columnsResult = await pool.query(
            `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'vulnerable_users'`
        );

        // Map column details for type checking
        const colTypes = {};
        columnsResult.rows.forEach(r => {
            colTypes[r.column_name] = r.data_type;
        });

        const allColumns = columnsResult.rows.map(r => r.column_name);

        // Standard columns that are not directly updatable via generic loop
        const standardColumns = [
            'id', 'reference', 'created_at', 'updated_at', 'created_by', 'updated_by'
        ];

        // Find custom columns
        const customColumns = allColumns.filter(col => !standardColumns.includes(col));

        // Build SET clause dynamically
        const setClauses = [];
        const values = [];
        let paramIndex = 1;

        // Standard fields whitelist
        const standardFields = ['title', 'description', 'property_id', 'property_name', 'category', 'priority', 'assigned_to', 'reported_by', 'scheduled_date', 'status'];

        // Helper to sanitize value based on type
        const sanitize = (col, val) => {
            if (val === '') {
                const type = colTypes[col];
                // Integer, Numeric, Date types should be null if empty string
                if (['integer', 'smallint', 'bigint', 'numeric', 'real', 'double precision', 'date', 'timestamp without time zone'].includes(type)) {
                    return null;
                }
            }
            return val;
        };

        // Process Standard Fields
        standardFields.forEach(field => {
            if (req.body[field] !== undefined) {
                setClauses.push(`${field}=$${paramIndex}`);

                let val = req.body[field];
                val = sanitize(field, val);

                values.push(val);
                paramIndex++;
            }
        });

        // Process Custom Columns
        customColumns.forEach(col => {
            if (!standardFields.includes(col) && req.body[col] !== undefined) {
                setClauses.push(`${col}=$${paramIndex}`);

                let val = req.body[col];
                val = sanitize(col, val);

                values.push(val);
                paramIndex++;
            }
        });

        // Always update updated_at
        setClauses.push('updated_at=NOW()');

        // Add id as the last parameter
        values.push(id);

        const query = `UPDATE public.vulnerable_users SET ${setClauses.join(', ')} WHERE id=$${paramIndex} RETURNING *`;

        const result = await pool.query(query, values);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Record not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('PATCH /vulnerable-users/:id error:', err);
        res.status(500).json({ message: err.message });
    }
});

// DELETE vulnerable users record
router.delete('/:id', protect, async (req, res) => {
    try {
        const { id } = req.params;

        const restrictedHotelIds = await getRestrictedHotelIds(req.user);
        if (restrictedHotelIds !== null) {
            if (restrictedHotelIds.length === 0) return res.status(404).json({ message: 'Record not found' });
            const checkRes = await pool.query('SELECT property_id FROM public.vulnerable_users WHERE id=$1', [id]);
            if (!checkRes.rows.length) return res.status(404).json({ message: 'Record not found' });
            const existingPid = checkRes.rows[0]?.property_id;
            if (!existingPid || !restrictedHotelIds.some((x) => String(x) === String(existingPid))) {
                return res.status(404).json({ message: 'Record not found' });
            }
        }
        const result = await pool.query(
            'DELETE FROM public.vulnerable_users WHERE id = $1 RETURNING *',
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Record not found' });
        }
        res.json({ message: 'Record deleted', record: result.rows[0] });
    } catch (err) {
        console.error('DELETE /vulnerable-users/:id error:', err);
        res.status(500).json({ message: err.message });
    }
});

export default router;
