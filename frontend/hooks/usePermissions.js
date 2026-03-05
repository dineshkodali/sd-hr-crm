// hooks/usePermissions.js
import { useState, useEffect } from "react";
import axios from "axios";

/**
 * Hook to get and check user permissions
 * Returns permission checking functions and loading state
 */
export function usePermissions(user) {
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role === "admin") {
      // Admins have full access
      setPermissions({});
      setLoading(false);
      return;
    }

    let mounted = true;
    const controller = new AbortController();

    async function loadPermissions() {
      try {
        const res = await axios.get("/api/access/me", {
          signal: controller.signal,
          withCredentials: true
        });
        if (mounted && res?.data?.permissions) {
          setPermissions(res.data.permissions);
        }
      } catch (err) {
        if (mounted && !controller.signal.aborted) {
          console.error("Error loading permissions:", err);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadPermissions();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [user?.id, user?.role]);

  /**
   * Check if user can read a module
   */
  const canRead = (module) => {
    if (!user || user.role === "admin") return true;
    return permissions[module]?.read === true;
  };

  /**
   * Check if user can create in a module
   * Requires: read AND create permissions
   */
  const canCreate = (module) => {
    if (!user || user.role === "admin") return true;
    const perm = permissions[module];
    return perm?.read === true && perm?.create === true;
  };

  /**
   * Check if user can update in a module
   * Requires: read AND update permissions
   */
  const canUpdate = (module) => {
    if (!user || user.role === "admin") return true;
    const perm = permissions[module];
    return perm?.read === true && perm?.update === true;
  };

  /**
   * Check if user can delete in a module
   * Requires: read AND delete permissions
   */
  const canDelete = (module) => {
    if (!user || user.role === "admin") return true;
    const perm = permissions[module];
    return perm?.read === true && perm?.delete === true;
  };

  return {
    permissions,
    loading,
    canRead,
    canCreate,
    canUpdate,
    canDelete
  };
}





