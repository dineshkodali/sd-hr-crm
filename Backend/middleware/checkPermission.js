// middleware/checkPermission.js
import pool from "../config/db.js";

/**
 * Middleware to check if user has permission to access a module
 * Usage: checkPermission('module_name', 'read')
 * 
 * @param {string} module - The module name (e.g., 'inspections', 'incidents')
 * @param {string} action - The action type: 'read', 'create', 'update', 'delete'
 */
export function checkPermission(module, action = 'read') {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Admins have full access
      if (user.role === "admin") {
        return next();
      }

      // Check if user has permission for this module and action
      const result = await pool.query(
        `SELECT can_read, can_create, can_update, can_delete 
         FROM user_permissions 
         WHERE user_id = $1 AND module = $2`,
        [user.id, module]
      );

      if (result.rows.length === 0) {
        // No permission record means no access
        return res.status(403).json({ 
          message: `Access denied: No permission for ${module}` 
        });
      }

      const perm = result.rows[0];
      let hasPermission = false;

      // Hierarchical permission checking:
      // - READ: requires can_read
      // - CREATE: requires can_read AND can_create
      // - UPDATE: requires can_read AND can_update
      // - DELETE: requires can_read AND can_delete
      switch (action) {
        case 'read':
          hasPermission = perm.can_read;
          break;
        case 'create':
          hasPermission = perm.can_read && perm.can_create;
          break;
        case 'update':
          hasPermission = perm.can_read && perm.can_update;
          break;
        case 'delete':
          hasPermission = perm.can_read && perm.can_delete;
          break;
        default:
          hasPermission = perm.can_read; // Default to read
      }

      if (!hasPermission) {
        return res.status(403).json({ 
          message: `Access denied: No ${action} permission for ${module}` 
        });
      }

      next();
    } catch (err) {
      console.error("Permission check error:", err);
      return res.status(500).json({ message: "Error checking permissions" });
    }
  };
}

/**
 * Helper function to check if user has any permission for a module (at least read)
 */
export async function hasModuleAccess(userId, module) {
  try {
    const result = await pool.query(
      `SELECT can_read FROM user_permissions 
       WHERE user_id = $1 AND module = $2 AND can_read = TRUE`,
      [userId, module]
    );
    return result.rows.length > 0;
  } catch (err) {
    console.error("hasModuleAccess error:", err);
    return false;
  }
}

