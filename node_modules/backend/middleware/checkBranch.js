// server/middleware/checkBranch.js
// Assumes you have authentication middleware that sets req.user = { id, role, branchId, ... }
module.exports = function checkBranchAccess(req, res, next) {
  const user = req.user; // injected by your auth middleware
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  // Admin may access everything
  if (user.role === "admin") return next();

  // If user is manager, ensure they only access their branch
  if (user.role === "manager") {
    const branchId = req.params.branchId || req.query.branchId || req.body.branchId;
    // If endpoint doesn't include branchId we still allow (server should scope internally)
    if (!branchId) {
      // Optionally: set branch scope so handlers use it
      req.branchScope = user.branchId || user.branch_id;
      return next();
    }

    if (String(branchId) === String(user.branchId || user.branch_id)) {
      return next();
    }
    return res.status(403).json({ error: "Forbidden: manager not allowed for this branch" });
  }

  // Other roles: deny or allow based on your policy
  return res.status(403).json({ error: "Forbidden" });
};
