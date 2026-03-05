// routes/manager.js
// Manager-related routes that use the admin_helpers module.

import express from "express";
import pool from "../config/db.js";
import { protect, requireRole } from "../middleware/auth.js";
import {
  detectUsersHotelColumn,
  isUsersHotelColumnNumeric,
  buildHotelArrayWhere,
  buildSelectFields,
} from "./admin_helpers.js";

const router = express.Router();

function buildSelectFieldsLocal(hotelCol) {
  const base = ["id", "name", "email", "role", "status", "branch"];
  if (hotelCol) {
    base.push(`"${hotelCol}" as hotel_id`);
  }
  return base.join(", ");
}

async function findHotelByName(name) {
  if (!name) return null;
  const q = `SELECT id, manager_id, name FROM hotels WHERE name ILIKE $1 LIMIT 1`;
  const r = await pool.query(q, [`%${name}%`]);
  return r.rows && r.rows[0] ? r.rows[0] : null;
}

async function findStaffByName(name) {
  if (!name) return null;
  const q = `SELECT id, role, name FROM users WHERE name ILIKE $1 AND role = 'staff' LIMIT 1`;
  const r = await pool.query(q, [`%${name}%`]);
  return r.rows && r.rows[0] ? r.rows[0] : null;
}

/**
 * GET /api/manager/staff
 * Return hotels managed by this manager and staff assigned to those hotels (or to manager's branch).
 */
router.get("/staff", protect, requireRole("manager"), async (req, res) => {
  try {
    const managerId = req.user && req.user.id;
    const managerBranch = req.user && req.user.branch;

    if (!managerId) return res.status(400).json({ message: "Invalid manager" });

    const hotelsRes = await pool.query("SELECT id, name FROM hotels WHERE manager_id = $1 ORDER BY name", [managerId]);
    const hotels = hotelsRes.rows || [];

    const hotelCol = await detectUsersHotelColumn();
    const hotelIds = hotels.map((h) => (h.id === null || h.id === undefined ? null : h.id)).filter(Boolean);

    let staff = [];

    if (hotelCol && hotelIds.length > 0) {
      const { clause, params: whereParams } = await buildHotelArrayWhere(hotelCol, hotelIds);
      if (clause !== "FALSE") {
        const fields = buildSelectFieldsLocal(hotelCol);
        const qAssigned = `
          SELECT ${fields}
          FROM users
          WHERE role = 'staff' AND (${clause})
          ORDER BY name
          LIMIT 1000
        `;
        const assignedRes = await pool.query(qAssigned, whereParams);
        staff = assignedRes.rows || [];
      }
    }

    if (managerBranch) {
      const fields = buildSelectFieldsLocal(hotelCol);
      const qBranch = `
        SELECT ${fields}
        FROM users
        WHERE role = 'staff' AND branch = $1
        ORDER BY name
        LIMIT 1000
      `;
      const branchRes = await pool.query(qBranch, [managerBranch]);
      const branchRows = branchRes.rows || [];

      // merge unique by id
      const seen = new Set((staff || []).map((s) => String(s.id)));
      for (const s of branchRows) {
        if (!seen.has(String(s.id))) {
          staff.push(s);
          seen.add(String(s.id));
        }
      }
    }

    return res.json({ hotels, staff });
  } catch (err) {
    console.error("GET /api/manager/staff error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * PUT /api/manager/assign-staff
 * Assign staff to a hotel:
 * - If users hotel column is numeric -> write numeric id
 * - If users hotel column is text-like -> write hotel name (to avoid text = integer mismatch)
 */
router.put("/assign-staff", protect, requireRole("manager"), async (req, res) => {
  try {
    const managerId = req.user && req.user.id;
    if (!managerId) return res.status(400).json({ message: "Invalid manager" });

    let { staff_id, hotel_id, staff_name, hotel_name } = req.body;

    // Resolve staff_id by name if sent
    if (!staff_id && staff_name) {
      const found = await findStaffByName(staff_name);
      if (!found) return res.status(404).json({ message: "Staff not found by name" });
      staff_id = found.id;
    }

    // Resolve hotel_id by name if sent
    let hotelRow = null;
    if (!hotel_id && hotel_name) {
      hotelRow = await findHotelByName(hotel_name);
      if (!hotelRow) return res.status(404).json({ message: "Hotel not found by name" });
      hotel_id = hotelRow.id;
    }

    if (!staff_id) return res.status(400).json({ message: "staff_id or staff_name is required" });

    // Get hotels the manager controls
    const hotelsRes = await pool.query("SELECT id, name FROM hotels WHERE manager_id = $1 ORDER BY id", [managerId]);
    const hotels = hotelsRes.rows || [];

    if (!hotels.length) {
      return res.status(400).json({ message: "You do not manage any hotels. Cannot assign staff." });
    }

    // Determine chosen hotel id (must belong to manager)
    let chosenHotelId = hotel_id || null;

    if (!chosenHotelId) {
      if (hotels.length === 1) {
        chosenHotelId = hotels[0].id;
      } else {
        // Manager has multiple hotels — ask frontend to provide hotel_id or hotel_name
        return res.status(400).json({ message: "manager_has_multiple_hotels", hotels });
      }
    } else {
      const belongs = hotels.some((h) => String(h.id) === String(chosenHotelId));
      if (!belongs) {
        return res.status(403).json({ message: "You may only assign staff to your own hotels" });
      }
    }

    // Verify staff exists and is role staff
    const staffRes = await pool.query("SELECT id, role, name FROM users WHERE id = $1 LIMIT 1", [staff_id]);
    if (!staffRes.rows.length) return res.status(404).json({ message: "Staff not found" });
    if (staffRes.rows[0].role !== "staff") return res.status(400).json({ message: "User is not staff" });

    // Detect users hotel assignment column
    const hotelCol = await detectUsersHotelColumn();
    if (!hotelCol) {
      return res.status(400).json({
        message:
          "No hotel assignment column exists in 'users' table. Add a column (e.g. users.hotel_id TEXT or UUID or INTEGER) and try again.",
      });
    }

    const hotelColIsNumeric = await isUsersHotelColumnNumeric(hotelCol);

    // Resolve chosen hotel name (if not already provided)
    let chosenHotelName = hotel_name || (hotelRow && hotelRow.name) || null;
    if (!chosenHotelName && chosenHotelId) {
      try {
        const r = await pool.query("SELECT name FROM hotels WHERE id = $1 LIMIT 1", [chosenHotelId]);
        if (r.rows && r.rows[0]) chosenHotelName = r.rows[0].name || null;
      } catch (err) {
        // ignore
      }
    }

    // Build update
    let updateQuery;
    let updateParams;
    if (hotelColIsNumeric) {
      const numericValue = Number(chosenHotelId);
      if (Number.isNaN(numericValue)) {
        return res.status(400).json({ message: "Provided hotel_id is not numeric but users hotel column expects numeric." });
      }
      updateQuery = `UPDATE users SET "${hotelCol}" = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, email, role, branch, "${hotelCol}" as hotel_id`;
      updateParams = [numericValue, staff_id];
    } else {
      const valToWrite = chosenHotelName !== null ? String(chosenHotelName) : String(chosenHotelId);
      updateQuery = `UPDATE users SET "${hotelCol}" = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, email, role, branch, "${hotelCol}" as hotel_id`;
      updateParams = [valToWrite, staff_id];
    }

    const updateRes = await pool.query(updateQuery, updateParams);
    if (!updateRes.rows.length) return res.status(500).json({ message: "Failed to assign staff" });
    const userRow = updateRes.rows[0];

    const hotelNameRes = await pool.query("SELECT name FROM hotels WHERE id = $1 LIMIT 1", [chosenHotelId]);
    const hotel_name_return = hotelNameRes.rows?.[0]?.name || chosenHotelName || null;

    return res.json({
      message: "Staff assigned",
      user: { ...userRow, hotel_name: hotel_name_return },
    });
  } catch (err) {
    console.error("PUT /api/manager/assign-staff error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
