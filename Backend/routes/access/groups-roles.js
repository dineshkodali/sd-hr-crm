import express from "express";
import pool from "../../config/db.js";
import { protect } from "../../middleware/auth.js";

const router = express.Router();

// ============================================
// GROUPS ROUTES
// ============================================

// GET all groups
router.get("/groups", protect, async (req, res) => {
    if (req.user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    try {
        const groupsQuery = await pool.query(`
      SELECT g.*, 
        COUNT(DISTINCT ug.user_id) as member_count,
        COUNT(DISTINCT gp.module) as permission_count
      FROM permission_groups g
      LEFT JOIN user_groups ug ON g.id = ug.group_id
      LEFT JOIN group_permissions gp ON g.id = gp.group_id
      GROUP BY g.id
      ORDER BY g.name
    `);

        res.json({ groups: groupsQuery.rows });
    } catch (err) {
        console.error("Error fetching groups:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// GET single group with details
router.get("/groups/:id", protect, async (req, res) => {
    if (req.user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    try {
        const { id } = req.params;

        // Get group details
        const groupQuery = await pool.query("SELECT * FROM permission_groups WHERE id = $1", [id]);
        if (groupQuery.rows.length === 0) {
            return res.status(404).json({ message: "Group not found" });
        }

        // Get group permissions
        const permsQuery = await pool.query(`
      SELECT module, can_read, can_create, can_update, can_delete 
      FROM group_permissions 
      WHERE group_id = $1
    `, [id]);

        // Get group members
        const membersQuery = await pool.query(`
      SELECT u.id, u.name, u.email, u.role 
      FROM users u
      INNER JOIN user_groups ug ON u.id = ug.user_id
      WHERE ug.group_id = $1
    `, [id]);

        const permissions = {};
        permsQuery.rows.forEach(p => {
            permissions[p.module] = {
                read: p.can_read,
                create: p.can_create,
                update: p.can_update,
                delete: p.can_delete
            };
        });

        res.json({
            group: groupQuery.rows[0],
            permissions,
            members: membersQuery.rows
        });
    } catch (err) {
        console.error("Error fetching group:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// POST create new group
router.post("/groups", protect, async (req, res) => {
    if (req.user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: "Group name is required" });

    try {
        const result = await pool.query(
            "INSERT INTO permission_groups (name, description) VALUES ($1, $2) RETURNING *",
            [name, description || ""]
        );

        res.json({ group: result.rows[0] });
    } catch (err) {
        console.error("Error creating group:", err);
        if (err.code === "23505") { // Unique violation
            res.status(400).json({ message: "Group name already exists" });
        } else {
            res.status(500).json({ message: "Server error", error: err.message });
        }
    }
});

// PUT update group
router.put("/groups/:id", protect, async (req, res) => {
    if (req.user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    const { id } = req.params;
    const { name, description } = req.body;

    try {
        const result = await pool.query(
            "UPDATE permission_groups SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *",
            [name, description, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Group not found" });
        }

        res.json({ group: result.rows[0] });
    } catch (err) {
        console.error("Error updating group:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// DELETE group
router.delete("/groups/:id", protect, async (req, res) => {
    if (req.user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    const { id } = req.params;

    try {
        await pool.query("DELETE FROM permission_groups WHERE id = $1", [id]);
        res.json({ success: true });
    } catch (err) {
        console.error("Error deleting group:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// POST update group permissions
router.post("/groups/:id/permissions", protect, async (req, res) => {
    if (req.user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    const { id } = req.params;
    const { module, can_read, can_create, can_update, can_delete } = req.body;

    if (!module) return res.status(400).json({ message: "Module is required" });

    try {
        const finalRead = !!can_read;
        const finalCreate = finalRead ? !!can_create : false;
        const finalUpdate = finalRead ? !!can_update : false;
        const finalDelete = finalRead ? !!can_delete : false;

        await pool.query(
            `INSERT INTO group_permissions (group_id, module, can_read, can_create, can_update, can_delete)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (group_id, module)
       DO UPDATE SET 
         can_read = EXCLUDED.can_read,
         can_create = EXCLUDED.can_create,
         can_update = EXCLUDED.can_update,
         can_delete = EXCLUDED.can_delete`,
            [id, module, finalRead, finalCreate, finalUpdate, finalDelete]
        );

        res.json({ success: true });
    } catch (err) {
        console.error("Error updating group permissions:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// POST add user to group
router.post("/groups/:id/members", protect, async (req, res) => {
    if (req.user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    const { id } = req.params;
    const { user_id } = req.body;

    if (!user_id) return res.status(400).json({ message: "User ID is required" });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Add user to group
        await client.query(
            "INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            [user_id, id]
        );

        // Get group permissions
        const permsQuery = await client.query(
            "SELECT module, can_read, can_create, can_update, can_delete FROM group_permissions WHERE group_id = $1",
            [id]
        );

        // Apply group permissions to user
        for (const perm of permsQuery.rows) {
            await client.query(
                `INSERT INTO user_permissions (user_id, module, can_read, can_create, can_update, can_delete)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, module)
         DO UPDATE SET 
           can_read = GREATEST(user_permissions.can_read, EXCLUDED.can_read),
           can_create = GREATEST(user_permissions.can_create, EXCLUDED.can_create),
           can_update = GREATEST(user_permissions.can_update, EXCLUDED.can_update),
           can_delete = GREATEST(user_permissions.can_delete, EXCLUDED.can_delete)`,
                [user_id, perm.module, perm.can_read, perm.can_create, perm.can_update, perm.can_delete]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error adding user to group:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    } finally {
        client.release();
    }
});

// DELETE remove user from group
router.delete("/groups/:id/members/:userId", protect, async (req, res) => {
    if (req.user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    const { id, userId } = req.params;

    try {
        await pool.query("DELETE FROM user_groups WHERE user_id = $1 AND group_id = $2", [userId, id]);
        res.json({ success: true });
    } catch (err) {
        console.error("Error removing user from group:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// ============================================
// ROLES ROUTES
// ============================================

// GET all roles
router.get("/roles", protect, async (req, res) => {
    if (req.user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    try {
        const rolesQuery = await pool.query(`
      SELECT r.*, 
        COUNT(DISTINCT ur.user_id) as user_count,
        COUNT(DISTINCT rp.module) as permission_count
      FROM permission_roles r
      LEFT JOIN user_roles ur ON r.id = ur.role_id
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      GROUP BY r.id
      ORDER BY r.name
    `);

        res.json({ roles: rolesQuery.rows });
    } catch (err) {
        console.error("Error fetching roles:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// GET single role with details
router.get("/roles/:id", protect, async (req, res) => {
    if (req.user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    try {
        const { id } = req.params;

        const roleQuery = await pool.query("SELECT * FROM permission_roles WHERE id = $1", [id]);
        if (roleQuery.rows.length === 0) {
            return res.status(404).json({ message: "Role not found" });
        }

        const permsQuery = await pool.query(`
      SELECT module, can_read, can_create, can_update, can_delete 
      FROM role_permissions 
      WHERE role_id = $1
    `, [id]);

        const usersQuery = await pool.query(`
      SELECT u.id, u.name, u.email, u.role 
      FROM users u
      INNER JOIN user_roles ur ON u.id = ur.user_id
      WHERE ur.role_id = $1
    `, [id]);

        const permissions = {};
        permsQuery.rows.forEach(p => {
            permissions[p.module] = {
                read: p.can_read,
                create: p.can_create,
                update: p.can_update,
                delete: p.can_delete
            };
        });

        res.json({
            role: roleQuery.rows[0],
            permissions,
            users: usersQuery.rows
        });
    } catch (err) {
        console.error("Error fetching role:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// POST create new role
router.post("/roles", protect, async (req, res) => {
    if (req.user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    const { name, description, level } = req.body;
    if (!name || !level) return res.status(400).json({ message: "Name and level are required" });

    try {
        const result = await pool.query(
            "INSERT INTO permission_roles (name, description, level) VALUES ($1, $2, $3) RETURNING *",
            [name, description || "", level]
        );

        res.json({ role: result.rows[0] });
    } catch (err) {
        console.error("Error creating role:", err);
        if (err.code === "23505") {
            res.status(400).json({ message: "Role name already exists" });
        } else {
            res.status(500).json({ message: "Server error", error: err.message });
        }
    }
});

// PUT update role
router.put("/roles/:id", protect, async (req, res) => {
    if (req.user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    const { id } = req.params;
    const { name, description, level } = req.body;

    try {
        const result = await pool.query(
            "UPDATE permission_roles SET name = $1, description = $2, level = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *",
            [name, description, level, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Role not found" });
        }

        res.json({ role: result.rows[0] });
    } catch (err) {
        console.error("Error updating role:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// DELETE role
router.delete("/roles/:id", protect, async (req, res) => {
    if (req.user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    const { id } = req.params;

    try {
        await pool.query("DELETE FROM permission_roles WHERE id = $1", [id]);
        res.json({ success: true });
    } catch (err) {
        console.error("Error deleting role:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// POST update role permissions
router.post("/roles/:id/permissions", protect, async (req, res) => {
    if (req.user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    const { id } = req.params;
    const { module, can_read, can_create, can_update, can_delete } = req.body;

    if (!module) return res.status(400).json({ message: "Module is required" });

    try {
        const finalRead = !!can_read;
        const finalCreate = finalRead ? !!can_create : false;
        const finalUpdate = finalRead ? !!can_update : false;
        const finalDelete = finalRead ? !!can_delete : false;

        await pool.query(
            `INSERT INTO role_permissions (role_id, module, can_read, can_create, can_update, can_delete)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (role_id, module)
       DO UPDATE SET 
         can_read = EXCLUDED.can_read,
         can_create = EXCLUDED.can_create,
         can_update = EXCLUDED.can_update,
         can_delete = EXCLUDED.can_delete`,
            [id, module, finalRead, finalCreate, finalUpdate, finalDelete]
        );

        res.json({ success: true });
    } catch (err) {
        console.error("Error updating role permissions:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// POST assign role to user
router.post("/roles/:id/users", protect, async (req, res) => {
    if (req.user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    const { id } = req.params;
    const { user_id } = req.body;

    if (!user_id) return res.status(400).json({ message: "User ID is required" });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Assign role to user
        await client.query(
            "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            [user_id, id]
        );

        // Get role permissions
        const permsQuery = await client.query(
            "SELECT module, can_read, can_create, can_update, can_delete FROM role_permissions WHERE role_id = $1",
            [id]
        );

        // Apply role permissions to user
        for (const perm of permsQuery.rows) {
            await client.query(
                `INSERT INTO user_permissions (user_id, module, can_read, can_create, can_update, can_delete)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, module)
         DO UPDATE SET 
           can_read = GREATEST(user_permissions.can_read, EXCLUDED.can_read),
           can_create = GREATEST(user_permissions.can_create, EXCLUDED.can_create),
           can_update = GREATEST(user_permissions.can_update, EXCLUDED.can_update),
           can_delete = GREATEST(user_permissions.can_delete, EXCLUDED.can_delete)`,
                [user_id, perm.module, perm.can_read, perm.can_create, perm.can_update, perm.can_delete]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error assigning role to user:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    } finally {
        client.release();
    }
});

// DELETE remove role from user
router.delete("/roles/:id/users/:userId", protect, async (req, res) => {
    if (req.user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    const { id, userId } = req.params;

    try {
        await pool.query("DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2", [userId, id]);
        res.json({ success: true });
    } catch (err) {
        console.error("Error removing role from user:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

export default router;
