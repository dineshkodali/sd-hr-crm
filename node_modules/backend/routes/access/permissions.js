import express from "express";
import pool from "../../config/db.js";
import { protect } from "../../middleware/auth.js";

const router = express.Router();

// GET all permissions for all users (admin only)
router.get("/", protect, async (req, res) => {
    if (req.user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
        const usersQ = await pool.query("SELECT id, name, email, role FROM users WHERE role IN ('staff','manager') ORDER BY name");
        const permsQ = await pool.query(`
      SELECT user_id, module, can_read, can_create, can_update, can_delete 
      FROM user_permissions
    `);
        const users = usersQ.rows;
        const perms = permsQ.rows;
        // Map permissions by user
        const permissions = {};
        perms.forEach(p => {
            if (!permissions[p.user_id]) permissions[p.user_id] = {};
            permissions[p.user_id][p.module] = {
                read: p.can_read || false,
                create: p.can_create || false,
                update: p.can_update || false,
                delete: p.can_delete || false
            };
        });
        res.json({ users, permissions });
    } catch (err) {
        console.error("Error in GET /api/access:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// POST/PUT update a user's permission for a module (admin only)
router.post("/", protect, async (req, res) => {
    if (req.user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const { user_id, module, can_read, can_create, can_update, can_delete } = req.body;
    if (!user_id || !module) return res.status(400).json({ message: "Missing user_id or module" });

    try {
        const finalRead = !!can_read;
        const finalCreate = finalRead ? !!can_create : false;
        const finalUpdate = finalRead ? !!can_update : false;
        const finalDelete = finalRead ? !!can_delete : false;

        await pool.query(
            `INSERT INTO user_permissions (user_id, module, can_read, can_create, can_update, can_delete)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, module)
       DO UPDATE SET 
         can_read = EXCLUDED.can_read,
         can_create = EXCLUDED.can_create,
         can_update = EXCLUDED.can_update,
         can_delete = EXCLUDED.can_delete`,
            [user_id, module, finalRead, finalCreate, finalUpdate, finalDelete]
        );
        res.json({ success: true });
    } catch (err) {
        console.error("Error in POST /api/access:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// GET current user's permissions (for frontend to check access)
router.get("/me", protect, async (req, res) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ message: "Not authenticated" });

        if (user.role === "admin") {
            return res.json({ permissions: {} });
        }

        const userPermsQuery = await pool.query(`
      SELECT module, can_read, can_create, can_update, can_delete 
      FROM user_permissions 
      WHERE user_id = $1
    `, [user.id]);

        const groupPermsQuery = await pool.query(`
      SELECT gp.module, gp.can_read, gp.can_create, gp.can_update, gp.can_delete 
      FROM group_permissions gp
      INNER JOIN user_groups ug ON gp.group_id = ug.group_id
      WHERE ug.user_id = $1
    `, [user.id]);

        const rolePermsQuery = await pool.query(`
      SELECT rp.module, rp.can_read, rp.can_create, rp.can_update, rp.can_delete 
      FROM role_permissions rp
      INNER JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = $1
    `, [user.id]);

        const permissions = {};

        const mergePermission = (module, perm) => {
            if (!permissions[module]) {
                permissions[module] = {
                    read: false,
                    create: false,
                    update: false,
                    delete: false
                };
            }
            permissions[module].read = permissions[module].read || perm.can_read;
            permissions[module].create = permissions[module].create || perm.can_create;
            permissions[module].update = permissions[module].update || perm.can_update;
            permissions[module].delete = permissions[module].delete || perm.can_delete;
        };

        rolePermsQuery.rows.forEach(p => mergePermission(p.module, p));
        groupPermsQuery.rows.forEach(p => mergePermission(p.module, p));
        userPermsQuery.rows.forEach(p => mergePermission(p.module, p));

        res.json({ permissions });
    } catch (err) {
        console.error("Error in GET /api/access/me:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

export default router;
