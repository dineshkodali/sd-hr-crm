// C:\PostgreAuth\Backend\routes\moveouts.js
import express from "express";
import pool from "../config/db.js";
import { protect } from "../middleware/auth.js";

import { applyCrudLogging } from "../middleware/activityMiddleware.js"; // Enhanced logging
const router = express.Router();


// Apply CRUD logging to all operations
applyCrudLogging(router, 'move_outs', 'move_outs');
function coalesceCamelSnake(body, camel, snake) {
  if (body == null) return undefined;
  if (body[camel] !== undefined) return body[camel];
  return body[snake];
}

// Create move-out
router.post("/", async (req, res) => {
  try {
    const b = req.body || {};
    const service_user_id = coalesceCamelSnake(b, "service_user_id", "serviceUserId") || coalesceCamelSnake(b, "serviceUserId", "service_user_id");
    const service_user_name = coalesceCamelSnake(b, "service_user_name", "serviceUserName") || coalesceCamelSnake(b, "serviceUserName", "service_user_name");

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
    const currentUser = req.user;
    let restrictedHotelIds = null;

    // Role-Based Restriction
    if (currentUser.role === "manager") {
      const managedRes = await pool.query("SELECT id FROM hotels WHERE manager_id = $1", [currentUser.id]);
      const managedIds = managedRes.rows.map(r => r.id);

      let branchIds = [];
      if (currentUser.branch) {
        const branchRes = await pool.query("SELECT id FROM hotels WHERE branch = $1", [currentUser.branch]);
        branchIds = branchRes.rows.map(r => r.id);
      }
      restrictedHotelIds = [...new Set([...managedIds, ...branchIds])];
    } else if (currentUser.role === "staff") {
      if (currentUser.branch) {
        const branchRes = await pool.query("SELECT id FROM hotels WHERE branch = $1", [currentUser.branch]);
        restrictedHotelIds = branchRes.rows.map(r => r.id);
      } else {
        restrictedHotelIds = [];
      }
    }

    let query = `
      SELECT mo.* 
      FROM maintenance.move_outs mo
      LEFT JOIN service_users su ON mo.service_user_id = su.id
    `;
    let whereClauses = [];
    let params = [];
    let paramIdx = 1;

    if (restrictedHotelIds !== null) {
      if (restrictedHotelIds.length === 0) {
        return res.json({ success: true, rows: [] });
      }
      whereClauses.push(`su.property_id = ANY($${paramIdx++})`);
      params.push(restrictedHotelIds);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
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
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, error: 'Missing id' });
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
router.patch('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, error: 'Missing id' });

    const b = req.body || {};
    const move_out_date = coalesceCamelSnake(b, "move_out_date", "moveOutDate") || null;
    const checklist = b.checklist || b.check_list || null;
    const notes = b.notes || null;
    const signature = b.signature || null;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (move_out_date !== null) {
      updates.push(`move_out_date = $${paramCount++}`);
      values.push(move_out_date);
    }
    if (checklist !== null) {
      updates.push(`checklist = $${paramCount++}::jsonb`);
      values.push(JSON.stringify(checklist));
    }
    if (notes !== null) {
      updates.push(`notes = $${paramCount++}`);
      values.push(notes);
    }
    if (signature !== null) {
      updates.push(`signature = $${paramCount++}`);
      values.push(signature);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    values.push(id);
    const q = `UPDATE maintenance.move_outs SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
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
