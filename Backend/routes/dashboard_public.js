import express from "express";
import pool from "../config/db.js";

const router = express.Router();

/**
 * Public lightweight summary used by landing/login pages.
 * Returns counts calculated directly from DB tables and is intentionally
 * public so unauthenticated clients can display KPI snapshots.
 */
router.get("/public-summary", async (req, res) => {
  try {
    const propsQ = await pool.query("SELECT COUNT(*)::bigint AS cnt FROM hotels");
    const properties = propsQ.rows && propsQ.rows[0] ? Number(propsQ.rows[0].cnt || 0) : null;

    // service users (best-effort)
    let serviceUsers = null;
    try {
      const suQ = await pool.query("SELECT COUNT(*)::bigint AS cnt FROM service_users");
      serviceUsers = suQ.rows && suQ.rows[0] ? Number(suQ.rows[0].cnt || 0) : null;
    } catch (e) {
      serviceUsers = null;
    }

    // compliance fallback (best-effort)
    let compliance = null;
    try {
      const compQ = await pool.query("SELECT COUNT(*)::bigint AS cnt FROM compliance");
      compliance = compQ.rows && compQ.rows[0] ? Number(compQ.rows[0].cnt || 0) : null;
    } catch (e) {
      compliance = null;
    }

    // safeguarding referrals (best-effort)
    let safeguarding = null;
    try {
      const sfgQ = await pool.query("SELECT COUNT(*)::bigint AS cnt FROM safeguarding_referrals");
      safeguarding = sfgQ.rows && sfgQ.rows[0] ? Number(sfgQ.rows[0].cnt || 0) : null;
    } catch (e) {
      // some deployments use other table names; ignore failure
      safeguarding = null;
    }

    return res.json({ properties, serviceUsers, compliance, safeguarding });
  } catch (err) {
    console.error("public-summary error:", err?.message || err);
    return res.status(500).json({ properties: null, serviceUsers: null, compliance: null, safeguarding: null });
  }
});

export default router;