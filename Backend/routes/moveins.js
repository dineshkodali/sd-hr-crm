// C:\PostgreAuth\Backend\routes\moveins.js
import express from "express";
import pool from "../config/db.js";

const router = express.Router();

function coalesceCamelSnake(body, camel, snake) {
  if (body == null) return undefined;
  if (body[camel] !== undefined) return body[camel];
  return body[snake];
}

// Create move-in
router.post("/", async (req, res) => {
  try {
    const b = req.body || {};

    const service_user_id = coalesceCamelSnake(b, "service_user_id", "serviceUserId") || coalesceCamelSnake(b, "serviceUserId", "service_user_id");
    const service_user_name = coalesceCamelSnake(b, "service_user_name", "serviceUserName") || coalesceCamelSnake(b, "serviceUserName", "service_user_name");

    const property_id = coalesceCamelSnake(b, "property_id", "propertyId");
    const property_name = coalesceCamelSnake(b, "property_name", "propertyName");

    const room_id = coalesceCamelSnake(b, "room_id", "roomId");
    const room_name = coalesceCamelSnake(b, "room_name", "roomName");

    const bedspace_id = coalesceCamelSnake(b, "bedspace_id", "bedspaceId");
    const bedspace_name = coalesceCamelSnake(b, "bedspace_name", "bedspaceName");

    const move_in_date = coalesceCamelSnake(b, "move_in_date", "moveInDate") || b.moveInDate || null;

    const checklist = b.checklist || b.check_list || {};
    const notes = b.notes || b.extraNotes || null;
    const signature = b.signature || null;
    const metadata = b.metadata || {};

    const created_by = (req.user && req.user.id) || b.created_by || b.createdBy || "system";

    const q = `INSERT INTO maintenance.move_ins
      (service_user_id, service_user_name, property_id, property_name, room_id, room_name, bedspace_id, bedspace_name, move_in_date, checklist, notes, signature, metadata, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13::jsonb,$14)
      RETURNING *`;

    const values = [
      service_user_id,
      service_user_name,
      property_id,
      property_name,
      room_id,
      room_name,
      bedspace_id,
      bedspace_name,
      move_in_date,
      JSON.stringify(checklist || {}),
      notes,
      signature,
      JSON.stringify(metadata || {}),
      created_by,
    ];

    const result = await pool.query(q, values);
    res.status(201).json({ success: true, row: result.rows[0] });
  } catch (err) {
    console.error("[move-ins] insert error", err && err.stack ? err.stack : err);
    res.status(500).json({ success: false, error: err && err.message ? err.message : String(err) });
  }
});

// List move-ins (simple)
router.get("/", async (req, res) => {
  try {
    const q = await pool.query("SELECT * FROM maintenance.move_ins ORDER BY created_at DESC LIMIT 500");
    res.json({ success: true, rows: q.rows });
  } catch (err) {
    console.error("[move-ins] list error", err && err.stack ? err.stack : err);
    res.status(500).json({ success: false, error: err && err.message ? err.message : String(err) });
  }
});

// Update move-in by id
router.put("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, error: 'Missing id' });

    const b = req.body || {};
    const fields = {};
    const add = (k, v) => { if (v !== undefined) fields[k] = v; };

    add('service_user_id', coalesceCamelSnake(b, 'service_user_id', 'serviceUserId'));
    add('service_user_name', coalesceCamelSnake(b, 'service_user_name', 'serviceUserName'));
    add('property_id', coalesceCamelSnake(b, 'property_id', 'propertyId'));
    add('property_name', coalesceCamelSnake(b, 'property_name', 'propertyName'));
    add('room_id', coalesceCamelSnake(b, 'room_id', 'roomId'));
    add('room_name', coalesceCamelSnake(b, 'room_name', 'roomName'));
    add('bedspace_id', coalesceCamelSnake(b, 'bedspace_id', 'bedspaceId'));
    add('bedspace_name', coalesceCamelSnake(b, 'bedspace_name', 'bedspaceName'));
    add('move_in_date', coalesceCamelSnake(b, 'move_in_date', 'moveInDate'));
    if (b.checklist !== undefined) add('checklist', b.checklist);
    if (b.notes !== undefined) add('notes', b.notes);
    if (b.signature !== undefined) add('signature', b.signature);
    if (b.metadata !== undefined) add('metadata', b.metadata);

    const keys = Object.keys(fields);
    if (keys.length === 0) return res.status(400).json({ success: false, error: 'No updatable fields provided' });

    const sets = keys.map((k, i) => {
      if (k === 'checklist' || k === 'metadata') return `${k} = $${i + 1}::jsonb`;
      return `${k} = $${i + 1}`;
    });
    const values = keys.map(k => (k === 'checklist' || k === 'metadata') ? JSON.stringify(fields[k]) : fields[k]);

    const q = `UPDATE maintenance.move_ins SET ${sets.join(', ')} WHERE id = $${keys.length + 1} RETURNING *`;
    values.push(id);

    const result = await pool.query(q, values);
    if (!result.rows || result.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, row: result.rows[0] });
  } catch (err) {
    console.error('[move-ins] update error', err && err.stack ? err.stack : err);
    res.status(500).json({ success: false, error: err && err.message ? err.message : String(err) });
  }
});

// Delete move-in by id
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, error: 'Missing id' });
    const q = 'DELETE FROM maintenance.move_ins WHERE id = $1 RETURNING *';
    const result = await pool.query(q, [id]);
    if (!result.rows || result.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, row: result.rows[0] });
  } catch (err) {
    console.error('[move-ins] delete error', err && err.stack ? err.stack : err);
    res.status(500).json({ success: false, error: err && err.message ? err.message : String(err) });
  }
});

export default router;
