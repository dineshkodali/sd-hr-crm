// routes/admin_helpers.js
// Helper utilities for admin/manager route modules.

import pool from "../config/db.js";

/**
 * detectUsersHotelColumn
 * Try a set of common column names and return the first one that exists on users table.
 * Returns column name string or null.
 */
export async function detectUsersHotelColumn() {
  const candidates = ["hotel_id", "hotel", "hotel_name", "hotelName", "hotelid", "branch_id", "branch"];
  try {
    for (const c of candidates) {
      const q = `SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name = $1 LIMIT 1`;
      const r = await pool.query(q, [c]);
      if (r.rows && r.rows.length) return c;
    }
  } catch (err) {
    // ignore, fallback null
  }
  return null;
}

/**
 * isUsersHotelColumnNumeric
 * Return true if the users.<col> column type is an integer-like type.
 */
export async function isUsersHotelColumnNumeric(col) {
  if (!col) return false;
  try {
    const q = `
      SELECT data_type
      FROM information_schema.columns
      WHERE table_name='users' AND column_name = $1
      LIMIT 1
    `;
    const r = await pool.query(q, [col]);
    const dt = (r.rows?.[0]?.data_type || "").toLowerCase();
    return ["integer", "bigint", "smallint", "numeric"].includes(dt);
  } catch (err) {
    return false;
  }
}

/**
 * buildHotelArrayWhere(hotelCol, hotelIds)
 * Build a safe SQL clause and params for matching users.<hotelCol> to a list of hotel identifiers.
 * - If users.<hotelCol> is numeric, the helper will only include numeric hotelIds.
 * - If users.<hotelCol> is text-like, it will compare stringified values.
 *
 * Returns object: { clause: string, params: Array }
 * If nothing valid found returns { clause: "FALSE", params: [] } (safe no-match).
 */
export async function buildHotelArrayWhere(hotelCol, hotelIds) {
  if (!hotelCol || !Array.isArray(hotelIds) || hotelIds.length === 0) return { clause: "FALSE", params: [] };

  try {
    const q = `SELECT data_type FROM information_schema.columns WHERE table_name='users' AND column_name = $1 LIMIT 1`;
    const r = await pool.query(q, [hotelCol]);
    const dt = (r.rows?.[0]?.data_type || "").toLowerCase();

    // numeric types
    if (["integer", "bigint", "smallint", "numeric"].includes(dt)) {
      const nums = hotelIds.map((x) => Number(x)).filter((n) => !Number.isNaN(n));
      if (nums.length === 0) return { clause: "FALSE", params: [] };
      const placeholders = nums.map((_, i) => `$${i + 1}`).join(", ");
      return { clause: `"${hotelCol}" IN (${placeholders})`, params: nums };
    }

    // treat as text-like: compare stringified hotel ids
    const strs = hotelIds.map((x) => String(x));
    const placeholders = strs.map((_, i) => `$${i + 1}`).join(", ");
    return { clause: `"${hotelCol}" IN (${placeholders})`, params: strs };
  } catch (err) {
    return { clause: "FALSE", params: [] };
  }
}

/**
 * buildSelectFields(hotelCol)
 * Helper to build SELECT field list including users.<hotelCol> aliased as hotel_id (if present)
 */
export function buildSelectFields(hotelCol) {
  const base = ["id", "name", "email", "role", "status", "branch"];
  if (hotelCol) base.push(`"${hotelCol}" as hotel_id`);
  return base.join(", ");
}
