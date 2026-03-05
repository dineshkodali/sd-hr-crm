import express from "express";
import pool from "../config/db.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

let templatesTableReady = false;

async function ensureReportTemplatesTable() {
  if (templatesTableReady) return true;
  try {
    const check = await pool.query(`SELECT to_regclass('public.report_templates') AS exists`);
    if (check.rows?.[0]?.exists) {
      templatesTableReady = true;
      return true;
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.report_templates (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        template_name VARCHAR(255) NOT NULL,
        report_id VARCHAR(128) NOT NULL,
        config JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_report_templates_user_id ON public.report_templates(user_id)`);
    templatesTableReady = true;
    return true;
  } catch (err) {
    console.error("Failed to ensure report_templates table:", err?.message || err);
    return false;
  }
}

router.get("/", protect, async (req, res) => {
  try {
    const ok = await ensureReportTemplatesTable();
    if (!ok) return res.status(500).json({ error: "Failed to initialize templates table" });

    const userId = String(req.user?.id ?? "");
    const r = await pool.query(
      `SELECT id, template_name, report_id, config, created_at, updated_at
       FROM public.report_templates
       WHERE user_id = $1
       ORDER BY updated_at DESC, created_at DESC`,
      [userId]
    );

    const savedByName = String(req.user?.name || req.user?.email || '').trim() || null;
    const rows = (r.rows || []).map((row) => ({
      ...row,
      saved_by_name: savedByName,
    }));
    return res.json({ templates: rows });
  } catch (err) {
    console.error("GET /api/report-templates error:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.post("/", protect, async (req, res) => {
  try {
    const ok = await ensureReportTemplatesTable();
    if (!ok) return res.status(500).json({ error: "Failed to initialize templates table" });

    const userId = String(req.user?.id ?? "");
    const { template_name, report_id, config } = req.body || {};

    const missing = [];
    if (!template_name || String(template_name).trim() === "") missing.push("template_name");
    if (!report_id || String(report_id).trim() === "") missing.push("report_id");
    if (!config || typeof config !== "object") missing.push("config");

    if (missing.length) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(", ")}` });
    }

    const r = await pool.query(
      `INSERT INTO public.report_templates (user_id, template_name, report_id, config, created_at, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW(), NOW())
       RETURNING id, template_name, report_id, config, created_at, updated_at`,
      [userId, String(template_name).trim(), String(report_id).trim(), JSON.stringify(config)]
    );

    const savedByName = String(req.user?.name || req.user?.email || '').trim() || null;
    const tpl = r.rows?.[0] ? { ...r.rows[0], saved_by_name: savedByName } : null;
    return res.status(201).json({ template: tpl });
  } catch (err) {
    console.error("POST /api/report-templates error:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", protect, async (req, res) => {
  try {
    const ok = await ensureReportTemplatesTable();
    if (!ok) return res.status(500).json({ error: "Failed to initialize templates table" });

    const userId = String(req.user?.id ?? "");
    const id = req.params.id;

    const r = await pool.query(
      `DELETE FROM public.report_templates WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );

    if (!r.rows?.length) return res.status(404).json({ error: "Template not found" });
    return res.json({ success: true, id: r.rows[0].id });
  } catch (err) {
    console.error("DELETE /api/report-templates/:id error:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
