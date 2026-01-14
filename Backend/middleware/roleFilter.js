/**
 * buildRoleWhere - Generate SQL WHERE clause and params based on user role
 * 
 * For admins: no filter (all records)
 * For managers/staff: filter by assigned_to column if provided
 * 
 * @param {Object} req - Express request object (contains req.user)
 * @param {number} paramIndex - Starting parameter index for SQL placeholders (e.g., 1 for $1, $2, etc.)
 * @param {Object} options - Configuration object
 *   - assignedColumn: Column name to filter by user id (e.g., 'assigned_to_id', 'assigned_to'). Omit to skip user filter.
 * 
 * @returns {Object} { clause, params }
 *   - clause: SQL WHERE clause fragment (empty string if no filters apply)
 *   - params: Array of parameter values for the clause
 */
export function buildRoleWhere(req, paramIndex = 1, options = {}) {
  const { assignedColumn } = options;
  const clause = [];
  const params = [];
  let currentParam = paramIndex;

  // Safety check: user must exist
  if (!req.user) {
    return { clause: "", params: [] };
  }

  const { role, id } = req.user;

  // Admin: no role-based restrictions
  if (role === "admin") {
    return { clause: "", params: [] };
  }

  // Non-admin users: filter by assigned_to column if specified
  if (assignedColumn && id) {
    clause.push(`${assignedColumn} = $${currentParam}`);
    params.push(id);
    currentParam++;
  }

  // Join all clauses with AND
  const sqlClause = clause.length > 0 ? clause.join(" AND ") : "";

  return {
    clause: sqlClause,
    params,
  };
}
