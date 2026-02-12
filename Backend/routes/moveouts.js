// C:\PostgreAuth\Backend\routes\moveouts.js
import express from "express";
import pool from "../config/db.js";
import { protect } from "../middleware/auth.js";

import { applyCrudLogging } from "../middleware/activityMiddleware.js"; // Enhanced logging
const router = express.Router();


// Apply CRUD logging to all operations
applyCrudLogging(router, 'move_outs', 'move_outs');

function quoteIdent(ident) {
  return `"${String(ident).replace(/"/g, '""')}"`;
}

let _serviceUsersPropertyColPromise = null;
async function getServiceUsersPropertyColumn() {
  if (_serviceUsersPropertyColPromise) return _serviceUsersPropertyColPromise;
  _serviceUsersPropertyColPromise = (async () => {
    const candidates = ["property_id", "hotel_id", "accommodation_id"];
    const { rows } = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'service_users'
         AND column_name = ANY($1::text[])
       ORDER BY array_position($1::text[], column_name)
       LIMIT 1`,
      [candidates]
    );
    return rows?.[0]?.column_name || null;
  })();
  return _serviceUsersPropertyColPromise;
}

function coalesceCamelSnake(body, camel, snake) {
  if (body == null) return undefined;
  if (body[camel] !== undefined) return body[camel];
  return body[snake];
}

async function getRestrictedHotelIds(currentUser) {
  if (!currentUser) return null;
  if (currentUser.role === "admin") return null;

  if (currentUser.role === "manager") {
    const managedRes = await pool.query("SELECT id FROM hotels WHERE manager_id = $1", [currentUser.id]);
    const managedIds = managedRes.rows.map((r) => r.id);

    let branchIds = [];
    if (currentUser.branch) {
      const branchRes = await pool.query("SELECT id FROM hotels WHERE branch = $1", [currentUser.branch]);
      branchIds = branchRes.rows.map((r) => r.id);
    }
    return [...new Set([...managedIds, ...branchIds])];
  }

  if (currentUser.role === "staff") {
    const assignedHotelId = currentUser.hotel_id || currentUser.hotelId || currentUser.hotel || null;
    return assignedHotelId ? [assignedHotelId] : [];
  }

  return [];
}

// Create move-out
router.post("/", protect, async (req, res) => {
  try {
    const b = req.body || {};
    const service_user_id = coalesceCamelSnake(b, "service_user_id", "serviceUserId") || coalesceCamelSnake(b, "serviceUserId", "service_user_id");
    const service_user_name = coalesceCamelSnake(b, "service_user_name", "serviceUserName") || coalesceCamelSnake(b, "serviceUserName", "service_user_name");

    const restrictedHotelIds = await getRestrictedHotelIds(req.user);
    if (restrictedHotelIds !== null) {
      if (restrictedHotelIds.length === 0) return res.status(403).json({ success: false, error: "Forbidden" });
      const propertyCol = await getServiceUsersPropertyColumn();
      if (!propertyCol) {
        return res.status(500).json({ success: false, error: "Server misconfiguration: service_users property column not found" });
      }
      const suRes = await pool.query(
        `SELECT ${quoteIdent(propertyCol)} AS property_id FROM service_users WHERE id::text = $1::text LIMIT 1`,
        [service_user_id]
      );
      const suPid = suRes.rows?.[0]?.property_id ?? null;
      let allowed = false;

      // 1. Check current service_user assignment
      if (suPid && restrictedHotelIds.some((x) => String(x) === String(suPid))) {
        allowed = true;
      }

      // 2. Fallback: Check latest move-in record for this user
      if (!allowed) {
        const lastMoveIn = await pool.query(
          `SELECT property_id FROM maintenance.move_ins WHERE service_user_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [service_user_id]
        );
        const lastPid = lastMoveIn.rows?.[0]?.property_id;
        if (lastPid && restrictedHotelIds.some((x) => String(x) === String(lastPid))) {
          allowed = true;
        }
      }

      if (!allowed) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }
    }

    const move_out_date = coalesceCamelSnake(b, "move_out_date", "moveOutDate") || b.moveOutDate || null;
    const checklist = b.checklist || b.check_list || {};
    const notes = b.notes || null;
    const signature = b.signature || null;
    const metadata = b.metadata || {};
    const created_by = (req.user && req.user.id) || b.created_by || b.createdBy || "system";

    const q = `INSERT INTO maintenance.move_outs
      (service_user_id, service_user_name, move_out_date, checklist, notes, signature, metadata, created_by)
      VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7::jsonb,$8)
      RETURNING *`;

    const values = [
      service_user_id,
      service_user_name,
      move_out_date,
      JSON.stringify(checklist || {}),
      notes,
      signature,
      JSON.stringify(metadata || {}),
      created_by,
    ];

    const result = await pool.query(q, values);
    res.status(201).json({ success: true, row: result.rows[0] });
  } catch (err) {
    console.error("[move-outs] insert error", err && err.stack ? err.stack : err);
    res.status(500).json({ success: false, error: err && err.message ? err.message : String(err) });
  }
});

// List move-outs
router.get("/", protect, async (req, res) => {
  try {
    const restrictedHotelIds = await getRestrictedHotelIds(req.user);
    const colName = await getServiceUsersPropertyColumn();
    const propertyCol = colName || 'property_id';

    let query = `
      SELECT mo.*
      FROM maintenance.move_outs mo
      LEFT JOIN service_users su ON mo.service_user_id:: text = su.id:: text
      LEFT JOIN LATERAL(
        SELECT property_id 
        FROM maintenance.move_ins mi 
        WHERE mi.service_user_id = mo.service_user_id 
        ORDER BY created_at DESC LIMIT 1
      ) last_mi ON true
        `;
    let whereClauses = [];
    let params = [];
    let paramIdx = 1;

    if (restrictedHotelIds !== null) {
      if (restrictedHotelIds.length === 0) {
        return res.json({ success: true, rows: [] });
      }
      // Check either service_users property OR last move_in property
      whereClauses.push(`(
          ${quoteIdent("su")}.${quoteIdent(propertyCol)}:: text = ANY($${paramIdx}:: text[])
        OR
        last_mi.property_id:: text = ANY($${paramIdx}:: text[])
        )`);
      params.push(restrictedHotelIds.map(String));
      paramIdx++;
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')} `;
    }

    query += ` ORDER BY mo.created_at DESC LIMIT 500`;

    const q = await pool.query(query, params);

    res.json({ success: true, rows: q.rows });
  } catch (err) {
    console.error("[move-outs] list error", err && err.stack ? err.stack : err);
    res.status(500).json({ success: false, error: err && err.message ? err.message : String(err) });
  }
});

// Delete move-out by id
router.delete('/:id', protect, async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, error: 'Missing id' });

    const restrictedHotelIds = await getRestrictedHotelIds(req.user);
    if (restrictedHotelIds !== null) {
      if (restrictedHotelIds.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
      const propertyCol = await getServiceUsersPropertyColumn();
      if (!propertyCol) {
        return res.status(500).json({ success: false, error: "Server misconfiguration: service_users property column not found" });
      }
      const checkRes = await pool.query(
        `SELECT su.${quoteIdent(propertyCol)} AS property_id, mo.service_user_id
         FROM maintenance.move_outs mo
         LEFT JOIN service_users su ON mo.service_user_id:: text = su.id:: text
         WHERE mo.id = $1
         LIMIT 1`,
        [id]
      );
      if (!checkRes.rows.length) return res.status(404).json({ success: false, error: 'Not found' });

      const existingPid = checkRes.rows[0]?.property_id ?? null;
      const moServiceUserId = checkRes.rows[0]?.service_user_id;

      let allowed = false;
      if (existingPid && restrictedHotelIds.some((x) => String(x) === String(existingPid))) {
        allowed = true;
      }

      if (!allowed && moServiceUserId) {
        const lastMoveIn = await pool.query(
          `SELECT property_id FROM maintenance.move_ins WHERE service_user_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [moServiceUserId]
        );
        const lastPid = lastMoveIn.rows?.[0]?.property_id;
        if (lastPid && restrictedHotelIds.some((x) => String(x) === String(lastPid))) {
          allowed = true;
        }
      }

      if (!allowed) {
        return res.status(404).json({ success: false, error: 'Not found' });
      }
    }

    const q = 'DELETE FROM maintenance.move_outs WHERE id = $1 RETURNING *';
    const result = await pool.query(q, [id]);
    if (!result.rows || result.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, row: result.rows[0] });
  } catch (err) {
    console.error('[move-outs] delete error', err && err.stack ? err.stack : err);
    res.status(500).json({ success: false, error: err && err.message ? err.message : String(err) });
  }
});

// Update move-out by id
router.patch('/:id', protect, async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, error: 'Missing id' });

    const restrictedHotelIds = await getRestrictedHotelIds(req.user);
    if (restrictedHotelIds !== null) {
      if (restrictedHotelIds.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
      const propertyCol = await getServiceUsersPropertyColumn();
      if (!propertyCol) {
        return res.status(500).json({ success: false, error: "Server misconfiguration: service_users property column not found" });
      }
      const checkRes = await pool.query(
        `SELECT su.${quoteIdent(propertyCol)} AS property_id, mo.service_user_id
         FROM maintenance.move_outs mo
         LEFT JOIN service_users su ON mo.service_user_id:: text = su.id:: text
         WHERE mo.id = $1
         LIMIT 1`,
        [id]
      );
      if (!checkRes.rows.length) return res.status(404).json({ success: false, error: 'Not found' });

      const existingPid = checkRes.rows[0]?.property_id ?? null;
      const moServiceUserId = checkRes.rows[0]?.service_user_id;

      let allowed = false;
      if (existingPid && restrictedHotelIds.some((x) => String(x) === String(existingPid))) {
        allowed = true;
      }

      if (!allowed && moServiceUserId) {
        const lastMoveIn = await pool.query(
          `SELECT property_id FROM maintenance.move_ins WHERE service_user_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [moServiceUserId]
        );
        const lastPid = lastMoveIn.rows?.[0]?.property_id;
        if (lastPid && restrictedHotelIds.some((x) => String(x) === String(lastPid))) {
          allowed = true;
        }
      }

      if (!allowed) {
        return res.status(404).json({ success: false, error: 'Not found' });
      }
    }

    const b = req.body || {};
    const move_out_date = coalesceCamelSnake(b, "move_out_date", "moveOutDate") || null;
    const checklist = b.checklist || b.check_list || null;
    const notes = b.notes || null;
    const signature = b.signature || null;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (move_out_date !== null) {
      updates.push(`move_out_date = $${paramCount++} `);
      values.push(move_out_date);
    }
    if (checklist !== null) {
      updates.push(`checklist = $${paramCount++}:: jsonb`);
      values.push(JSON.stringify(checklist));
    }
    if (notes !== null) {
      updates.push(`notes = $${paramCount++} `);
      values.push(notes);
    }
    if (signature !== null) {
      updates.push(`signature = $${paramCount++} `);
      values.push(signature);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    values.push(id);
    const q = `UPDATE maintenance.move_outs SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING * `;
    const result = await pool.query(q, values);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    res.json({ success: true, row: result.rows[0] });
  } catch (err) {
    console.error('[move-outs] update error', err && err.stack ? err.stack : err);
    res.status(500).json({ success: false, error: err && err.message ? err.message : String(err) });
  }
});

export default router;
