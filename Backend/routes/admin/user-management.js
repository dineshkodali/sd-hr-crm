import express from 'express';
import pool from '../../config/db.js';
import bcrypt from 'bcryptjs';
import { protect } from '../../middleware/auth.js';
import { checkPermission } from '../../middleware/checkPermission.js';

const router = express.Router();

// Get all users with pagination and filters
router.get('/users', protect, checkPermission('manage_users'), async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', role = '', status = '' } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (search) {
      whereConditions.push(`(u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (role) {
      whereConditions.push(`u.role = $${paramIndex}`);
      queryParams.push(role);
      paramIndex++;
    }

    if (status) {
      whereConditions.push(`u.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM users u ${whereClause}`,
      queryParams
    );
    const totalUsers = parseInt(countResult.rows[0].count);

    // Get users with pagination
    const usersResult = await pool.query(
      `SELECT 
        u.id, u.name, u.email, u.role, u.status, u.branch, u.created_at, u.phone
      FROM users u
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, limit, offset]
    );

    res.json({
      users: usersResult.rows,
      pagination: {
        total: totalUsers,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalUsers / limit)
      }
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users', details: err.message });
  }
});

// Get single user by ID
router.get('/users/:id', protect, checkPermission('manage_users'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT 
        u.id, u.username, u.email, u.first_name, u.last_name, u.role, 
        u.is_active, u.created_at, u.last_login, u.phone_number, u.hotel_id,
        h.hotel_name as assigned_hotel
      FROM users u
      LEFT JOIN hotels h ON u.hotel_id = h.id
      WHERE u.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Failed to fetch user', details: err.message });
  }
});

// Create new user
router.post('/users', protect, async (req, res, next) => {
  // Admins can always create
  if (req.user?.role === 'admin') return next();

  // Managers can create staff only (even without manage_users permission)
  if (req.user?.role === 'manager') {
    const requestedRole = String(req.body?.role || '').toLowerCase();
    if (requestedRole === 'staff') return next();
    return res.status(403).json({ message: 'Forbidden — managers can only create staff users' });
  }

  // Staff can create staff only if they have employees:create permission.
  // Scope enforcement is done in the handler below.
  if (req.user?.role === 'staff') {
    const requestedRole = String(req.body?.role || '').toLowerCase();
    if (requestedRole !== 'staff') {
      return res.status(403).json({ message: 'Forbidden — staff can only create staff users' });
    }
    return checkPermission('employees', 'create')(req, res, next);
  }

  // Everyone else must have manage_users permission
  return checkPermission('manage_users')(req, res, next);
}, async (req, res) => {
  try {
    const {
      name, email, password, role, phone, branch, status = 'active'
    } = req.body;

    // Validation
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required' });
    }

    // Validate role
    const validRoles = ['admin', 'manager', 'staff'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be admin, manager, or staff' });
    }

    // Check if email already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Dynamic Insert Logic
    const existingColsResult = await pool.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'users' AND table_schema = 'public'`
    );
    const validColumns = existingColsResult.rows.map(r => r.column_name);

    // Explicitly allowed fields from body (including standard ones + any potential custom ones)
    // We filter req.body against validLines to avoid SQL injection or errors
    // We also overwrite standard fields to ensuring logic compliance

    // Staff creation: enforce scope
    if (req.user?.role === 'staff') {
      const staffHotelId = req.user?.hotel_id;
      if (staffHotelId) {
        // Force created user into the staff member's hotel
        req.body.hotel_id = staffHotelId;
      } else if (req.user?.branch) {
        // Force created user into the staff member's branch if present
        req.body.branch = req.user.branch;
      }
    }

    const insertData = {
      ...req.body,
      name,
      email,
      password: hashedPassword,
      role,
      phone,
      branch,
      status: status || 'active',
      created_at: new Date() // optional, DB has default
    };

    // Remove system fields we don't want to be set manually
    ['id', 'updated_at', 'last_login'].forEach(k => delete insertData[k]);

    // Build lists
    const cols = [];
    const vals = [];
    const placeholders = [];
    let idx = 1;

    Object.keys(insertData).forEach(key => {
      if (validColumns.includes(key)) {
        cols.push(`"${key}"`); // quote columns for safety
        vals.push(insertData[key]);
        placeholders.push(`$${idx++}`);
      }
    });

    if (cols.length === 0) {
      return res.status(400).json({ error: 'No valid data to insert' });
    }

    const query = `
      INSERT INTO users (${cols.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING id, name, email, role, status, phone, branch, created_at
    `;

    const result = await pool.query(query, vals);

    res.status(201).json({
      message: 'User created successfully',
      user: result.rows[0]
    });
  } catch (err) {
    console.error('Error creating user:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Failed to create user', details: err.message });
  }
});

// Update user
router.put('/users/:id', protect, checkPermission('manage_users'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      username, email, first_name, last_name,
      role, phone_number, hotel_id, is_active
    } = req.body;

    // Check if user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Validate role if provided
    if (role) {
      const validRoles = ['admin', 'manager', 'staff'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role. Must be admin, manager, or staff' });
      }
    }

    // Check if username/email is taken by another user
    if (username || email) {
      const duplicateCheck = await pool.query(
        'SELECT id FROM users WHERE (username = $1 OR email = $2) AND id != $3',
        [username, email, id]
      );
      if (duplicateCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Username or email already exists' });
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (username !== undefined) {
      updates.push(`username = $${paramIndex++}`);
      values.push(username);
    }
    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(email);
    }
    if (first_name !== undefined) {
      updates.push(`first_name = $${paramIndex++}`);
      values.push(first_name);
    }
    if (last_name !== undefined) {
      updates.push(`last_name = $${paramIndex++}`);
      values.push(last_name);
    }
    if (role !== undefined) {
      updates.push(`role = $${paramIndex++}`);
      values.push(role);
    }
    if (phone_number !== undefined) {
      updates.push(`phone_number = $${paramIndex++}`);
      values.push(phone_number);
    }
    if (hotel_id !== undefined) {
      updates.push(`hotel_id = $${paramIndex++}`);
      values.push(hotel_id);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, username, email, first_name, last_name, role, is_active, phone_number, hotel_id`,
      values
    );

    res.json({
      message: 'User updated successfully',
      user: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating user:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username or email already exists' });
    }
    res.status(500).json({ error: 'Failed to update user', details: err.message });
  }
});

// Delete user (soft delete by setting is_active to false)
router.delete('/users/:id', protect, checkPermission('manage_users'), async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent = false } = req.query;

    // Prevent deleting yourself
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Check if user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (permanent === 'true') {
      // Permanent delete
      await pool.query('DELETE FROM users WHERE id = $1', [id]);
      res.json({ message: 'User permanently deleted' });
    } else {
      // Soft delete
      await pool.query('UPDATE users SET status = $1 WHERE id = $2', ['inactive', id]);
      res.json({ message: 'User deactivated' });
    }
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user', details: err.message });
  }
});

// Reset/Change user password
router.post('/users/:id/password', protect, checkPermission('manage_users'), async (req, res) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;

    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Update password
    await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [hashedPassword, id]
    );

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('Error resetting password:', err);
    res.status(500).json({ error: 'Failed to reset password', details: err.message });
  }
});

// Get user statistics
router.get('/stats/users', protect, checkPermission('manage_users'), async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE status = 'active') as active_users,
        COUNT(*) FILTER (WHERE status != 'active') as inactive_users,
        COUNT(*) FILTER (WHERE role = 'admin') as admin_count,
        COUNT(*) FILTER (WHERE role = 'manager') as manager_count,
        COUNT(*) FILTER (WHERE role = 'staff') as staff_count,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as active_last_week
      FROM users
    `);

    res.json(stats.rows[0]);
  } catch (err) {
    console.error('Error fetching user stats:', err);
    res.status(500).json({ error: 'Failed to fetch user statistics', details: err.message });
  }
});

export default router;
