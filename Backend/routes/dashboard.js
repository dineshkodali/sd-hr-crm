// Dashboard routes for KPIs, trends, and analytics
import express from "express";
import pool from "../config/db.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Get dashboard KPIs
router.get("/kpis", protect, async (req, res) => {
  try {
    const timeRange = req.query.timeRange || "30d";

    // Get basic counts
    const hotelsQuery = await pool.query("SELECT COUNT(*)::bigint as total FROM hotels");
    const roomsQuery = await pool.query("SELECT COUNT(*)::bigint as total FROM rooms");
    const usersQuery = await pool.query("SELECT COUNT(*)::bigint as total FROM users WHERE status = 'active'");

    const kpis = {
      totalHotels: Number(hotelsQuery.rows[0]?.total || 0),
      totalRooms: Number(roomsQuery.rows[0]?.total || 0),
      totalUsers: Number(usersQuery.rows[0]?.total || 0),
      timeRange
    };

    res.json(kpis);
  } catch (error) {
    console.error("Dashboard KPIs error:", error);
    res.status(500).json({ message: "Failed to fetch KPIs" });
  }
});

// Get dashboard trends
router.get("/trends", protect, async (req, res) => {
  try {
    const timeRange = req.query.timeRange || "30d";

    // Return time-series data for charts.
    // The frontend expects an array like: [{ month: 'Jan', incidents: 2, resolutions: 1 }, ...]
    // Keep it resilient if incidents table doesn't exist.
    const now = new Date();
    const range = String(timeRange).toLowerCase();

    let startDate = new Date(now);
    if (range === '7d') startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (range === '30d') startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else if (range === '90d') startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    else if (range === '1y' || range === '365d') startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const bucket = (range === '7d' || range === '30d') ? 'day' : 'month';

    const buildZeroSeries = () => {
      const points = [];
      const cursor = new Date(startDate);
      const end = new Date(now);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      if (bucket === 'day') {
        // daily buckets
        while (cursor <= end) {
          const label = cursor.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
          points.push({
            bucket: new Date(cursor),
            month: label,
            incidents: 0,
            resolutions: 0,
          });
          cursor.setDate(cursor.getDate() + 1);
        }
      } else {
        // monthly buckets
        cursor.setDate(1);
        cursor.setHours(0, 0, 0, 0);
        const endMonth = new Date(end);
        endMonth.setDate(1);
        endMonth.setHours(0, 0, 0, 0);
        while (cursor <= endMonth) {
          points.push({
            bucket: new Date(cursor),
            month: months[cursor.getMonth()],
            incidents: 0,
            resolutions: 0,
          });
          cursor.setMonth(cursor.getMonth() + 1);
        }
      }
      return points;
    };

    try {
      const q = await pool.query(
        `SELECT 
           date_trunc($1, COALESCE(created_at, updated_at, NOW())) AS bucket,
           COUNT(*)::bigint AS incidents,
           SUM(CASE WHEN LOWER(COALESCE(status,'')) IN ('resolved','closed','completed') THEN 1 ELSE 0 END)::bigint AS resolutions
         FROM maintenance.incidents
         WHERE COALESCE(created_at, updated_at, NOW()) >= $2
         GROUP BY 1
         ORDER BY 1`,
        [bucket, startDate]
      );

      const base = buildZeroSeries();
      const byKey = new Map();
      base.forEach((p) => {
        const k = new Date(p.bucket).toISOString();
        byKey.set(k, { month: p.month, incidents: 0, resolutions: 0 });
      });

      (q.rows || []).forEach((r) => {
        const d = r.bucket ? new Date(r.bucket) : null;
        if (!d) return;
        const key = d.toISOString();
        const existing = byKey.get(key) || { month: '', incidents: 0, resolutions: 0 };
        existing.incidents = Number(r.incidents || 0);
        existing.resolutions = Number(r.resolutions || 0);
        byKey.set(key, existing);
      });

      return res.json(Array.from(byKey.values()));
    } catch (e) {
      console.warn('Dashboard trends: incidents table not available or query failed:', e.message);
      // still return a valid (zero-filled) series so the graph renders
      const base = buildZeroSeries();
      return res.json(base.map((p) => ({ month: p.month, incidents: 0, resolutions: 0 })));
    }
  } catch (error) {
    console.error("Dashboard trends error:", error);
    res.status(500).json({ message: "Failed to fetch trends" });
  }
});

// Get occupancy data
router.get("/occupancy", protect, async (req, res) => {
  try {
    const timeRange = req.query.timeRange || "30d";

    // Calculate occupancy from hotels data
    const occupancyQuery = await pool.query(`
      SELECT 
        SUM(total_beds) as total_beds,
        SUM(occupied_beds) as occupied_beds
      FROM hotels
    `);

    const result = occupancyQuery.rows[0];
    const totalBeds = Number(result?.total_beds || 0);
    const occupiedBeds = Number(result?.occupied_beds || 0);
    const occupancyRate = totalBeds > 0 ? (occupiedBeds / totalBeds) * 100 : 0;

    let topProperties = [];
    try {
      const suReg = await pool.query("SELECT to_regclass('public.service_users') AS pub, to_regclass('service_users') AS plain");
      const suTable = suReg.rows?.[0]?.pub ? 'public.service_users' : (suReg.rows?.[0]?.plain ? 'service_users' : null);

      if (suTable) {
        const q = await pool.query(
          `SELECT
             h.id,
             h.name,
             COALESCE(COUNT(su.id) FILTER (WHERE LOWER(COALESCE(su.status, 'active')) = 'active'), 0)::bigint AS service_users,
             COALESCE(h.total_beds, 0)::bigint AS total_beds,
             COALESCE(h.occupied_beds, 0)::bigint AS occupied_beds
           FROM hotels h
           LEFT JOIN ${suTable} su
             ON (su.property_id IS NOT NULL AND su.property_id::int = h.id)
             OR (su.property_id IS NULL AND su.hotel_id IS NOT NULL AND su.hotel_id::int = h.id)
           GROUP BY h.id, h.name, h.total_beds, h.occupied_beds
           ORDER BY service_users DESC, h.name ASC
           LIMIT 8`
        );

        const rows = q.rows || [];
        const max = rows.reduce((m, r) => Math.max(m, Number(r.service_users || 0)), 0);
        topProperties = rows.map((r) => {
          const count = Number(r.service_users || 0);
          const pct = max > 0 ? Math.round((count / max) * 100) : 0;
          return {
            id: r.id,
            name: r.name,
            serviceUsers: count,
            percentage: pct,
            total_beds: Number(r.total_beds || 0),
            occupied_beds: Number(r.occupied_beds || 0),
          };
        });
      }
    } catch (e) {
      console.warn('Dashboard occupancy: service user aggregation failed:', e.message);
    }

    res.json({
      totalBeds,
      occupiedBeds,
      occupancyRate: Math.round(occupancyRate * 100) / 100,
      topProperties,
      timeRange
    });
  } catch (error) {
    console.error("Dashboard occupancy error:", error);
    res.status(500).json({ message: "Failed to fetch occupancy data" });
  }
});

// Get incidents summary
router.get("/incidents-summary", protect, async (req, res) => {
  try {
    const timeRange = req.query.timeRange || "30d";

    // Get incidents count from maintenance schema
    let incidentsCount = 0;
    let openIncidents = 0;
    let resolvedIncidents = 0;
    try {
      const incidentsQuery = await pool.query("SELECT COUNT(*)::bigint as total FROM maintenance.incidents");
      incidentsCount = Number(incidentsQuery.rows[0]?.total || 0);

      const openQuery = await pool.query(
        "SELECT COUNT(*)::bigint as total FROM maintenance.incidents WHERE LOWER(COALESCE(status,'')) IN ('open','pending','in progress')"
      );
      openIncidents = Number(openQuery.rows[0]?.total || 0);

      const resolvedQuery = await pool.query(
        "SELECT COUNT(*)::bigint as total FROM maintenance.incidents WHERE LOWER(COALESCE(status,'')) IN ('resolved','closed','completed')"
      );
      resolvedIncidents = Number(resolvedQuery.rows[0]?.total || 0);
    } catch (e) {
      // Table might not exist
      console.warn("Incidents table not found:", e.message);
    }

    res.json({
      totalIncidents: incidentsCount,
      openIncidents,
      resolvedIncidents,
      timeRange
    });
  } catch (error) {
    console.error("Dashboard incidents summary error:", error);
    res.status(500).json({ message: "Failed to fetch incidents summary" });
  }
});

// Get compliance summary
router.get("/compliance-summary", protect, async (req, res) => {
  try {
    const timeRange = req.query.timeRange || "30d";

    // Certificates typically live in public.certificates, but keep it resilient across schemas.
    const certReg = await pool.query(
      "SELECT to_regclass('public.certificates') AS pub, to_regclass('certificates') AS plain"
    );
    const hasPublic = !!certReg.rows?.[0]?.pub;
    const hasPlain = !!certReg.rows?.[0]?.plain;
    const certTable = hasPublic ? 'public.certificates' : (hasPlain ? 'certificates' : null);

    if (!certTable) {
      return res.json({ totalCertificates: 0, validCount: 0, expiredCount: 0, expiringSoonCount: 0, timeRange });
    }

    const totalQuery = await pool.query(`SELECT COUNT(*)::bigint as total FROM ${certTable}`);
    const totalCertificates = Number(totalQuery.rows[0]?.total || 0);

    let validCount = 0;
    let expiredCount = 0;
    let expiringSoonCount = 0;

    // Prefer expiry_date-based computation when available, because many rows may not have a status.
    // Fall back to status aggregation if needed.
    const [schemaName, tableName] = certTable.includes('.') ? certTable.split('.') : ['public', certTable];
    const colsRes = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2`,
      [schemaName, tableName]
    );
    const cols = new Set((colsRes.rows || []).map((r) => r.column_name));
    const hasExpiry = cols.has('expiry_date') || cols.has('expires_on') || cols.has('expiry') || cols.has('expiryDate');
    const expiryCol = cols.has('expiry_date')
      ? 'expiry_date'
      : (cols.has('expires_on') ? 'expires_on' : (cols.has('expiry') ? 'expiry' : (cols.has('expiryDate') ? '"expiryDate"' : null)));

    if (hasExpiry && expiryCol) {
      const exp = await pool.query(
        `SELECT
           SUM(CASE WHEN ${expiryCol}::timestamptz > NOW() + INTERVAL '30 days' THEN 1 ELSE 0 END)::bigint AS valid_count,
           SUM(CASE WHEN ${expiryCol}::timestamptz <= NOW() THEN 1 ELSE 0 END)::bigint AS expired_count,
           SUM(CASE WHEN ${expiryCol}::timestamptz > NOW() AND ${expiryCol}::timestamptz <= NOW() + INTERVAL '30 days' THEN 1 ELSE 0 END)::bigint AS expiring_count
         FROM ${certTable}`
      );
      validCount = Number(exp.rows?.[0]?.valid_count || 0);
      expiredCount = Number(exp.rows?.[0]?.expired_count || 0);
      expiringSoonCount = Number(exp.rows?.[0]?.expiring_count || 0);
    } else {
      try {
        const statusCounts = await pool.query(
          `SELECT LOWER(COALESCE(status,'')) AS status, COUNT(*)::bigint AS count FROM ${certTable} GROUP BY LOWER(COALESCE(status,''))`
        );
        const map = (statusCounts.rows || []).reduce((acc, r) => {
          acc[r.status] = Number(r.count || 0);
          return acc;
        }, {});
        validCount = map['valid'] || 0;
        expiredCount = map['expired'] || 0;
        expiringSoonCount = map['expiring-soon'] || map['expiring soon'] || 0;
      } catch (e) {
        console.warn("Compliance aggregation failed:", e.message);
      }
    }

    res.json({
      totalCertificates,
      validCount,
      expiredCount,
      expiringSoonCount,
      timeRange,
    });
  } catch (error) {
    console.error("Dashboard compliance summary error:", error);
    res.status(500).json({ message: "Failed to fetch compliance summary" });
  }
});

// Get attention items
router.get("/attention-items", protect, async (req, res) => {
  try {
    const timeRange = req.query.timeRange || "30d";

    // Get items needing attention
    const maintenanceQuery = await pool.query("SELECT COUNT(*)::bigint as total FROM maintenance_tasks WHERE status = 'pending'");
    let openIncidents = 0;
    try {
      const incidentsQuery = await pool.query(
        "SELECT COUNT(*)::bigint as total FROM maintenance.incidents WHERE LOWER(COALESCE(status,'')) IN ('open','pending','in progress')"
      );
      openIncidents = Number(incidentsQuery.rows[0]?.total || 0);
    } catch (e) {
      console.warn("Attention-items incidents query failed:", e.message);
    }

    res.json({
      maintenanceTasks: Number(maintenanceQuery.rows[0]?.total || 0),
      openIncidents,
      timeRange
    });
  } catch (error) {
    console.error("Dashboard attention items error:", error);
    res.status(500).json({ message: "Failed to fetch attention items" });
  }
});

// Get demographics
router.get("/demographics", protect, async (req, res) => {
  try {
    const timeRange = req.query.timeRange || "30d";

    // Get user demographics
    const usersQuery = await pool.query(`
      SELECT role, COUNT(*)::bigint as count 
      FROM users 
      WHERE status = 'active' 
      GROUP BY role
    `);

    const demographics = usersQuery.rows.reduce((acc, row) => {
      acc[row.role] = Number(row.count);
      return acc;
    }, {});

    res.json({
      userRoles: demographics,
      timeRange
    });
  } catch (error) {
    console.error("Dashboard demographics error:", error);
    res.status(500).json({ message: "Failed to fetch demographics" });
  }
});

// Get maintenance stats
router.get("/maintenance-stats", protect, async (req, res) => {
  try {
    const timeRange = req.query.timeRange || "30d";

    // Get maintenance statistics
    const tasksQuery = await pool.query(`
      SELECT status, COUNT(*)::bigint as count 
      FROM maintenance_tasks 
      GROUP BY status
    `);

    const stats = tasksQuery.rows.reduce((acc, row) => {
      acc[row.status] = Number(row.count);
      return acc;
    }, {});

    res.json({
      taskStats: stats,
      timeRange
    });
  } catch (error) {
    console.error("Dashboard maintenance stats error:", error);
    res.status(500).json({ message: "Failed to fetch maintenance stats" });
  }
});

// Maintenance time-series for dashboard bar chart
router.get('/maintenance-trends', protect, async (req, res) => {
  try {
    const timeRange = req.query.timeRange || '30d';
    const now = new Date();
    const range = String(timeRange).toLowerCase();

    let startDate = new Date(now);
    if (range === '7d') startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (range === '30d') startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else if (range === '90d') startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    else if (range === '1y' || range === '365d') startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const bucket = (range === '7d' || range === '30d') ? 'day' : 'month';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const buildZeroSeries = () => {
      const points = [];
      const cursor = new Date(startDate);
      const end = new Date(now);

      if (bucket === 'day') {
        while (cursor <= end) {
          const label = cursor.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
          points.push({ bucket: new Date(cursor), label, pending: 0, inProgress: 0, completed: 0 });
          cursor.setDate(cursor.getDate() + 1);
        }
      } else {
        cursor.setDate(1);
        cursor.setHours(0, 0, 0, 0);
        const endMonth = new Date(end);
        endMonth.setDate(1);
        endMonth.setHours(0, 0, 0, 0);
        while (cursor <= endMonth) {
          points.push({ bucket: new Date(cursor), label: months[cursor.getMonth()], pending: 0, inProgress: 0, completed: 0 });
          cursor.setMonth(cursor.getMonth() + 1);
        }
      }
      return points;
    };

    const base = buildZeroSeries();
    const byKey = new Map();
    base.forEach((p) => byKey.set(new Date(p.bucket).toISOString(), { label: p.label, pending: 0, inProgress: 0, completed: 0 }));

    try {
      const q = await pool.query(
        `SELECT
           date_trunc($1, COALESCE(created_at, updated_at, NOW())) AS bucket,
           LOWER(COALESCE(status,'')) AS status,
           COUNT(*)::bigint AS count
         FROM maintenance_tasks
         WHERE COALESCE(created_at, updated_at, NOW()) >= $2
         GROUP BY 1, 2
         ORDER BY 1`,
        [bucket, startDate]
      );

      (q.rows || []).forEach((r) => {
        const d = r.bucket ? new Date(r.bucket) : null;
        if (!d) return;
        const key = d.toISOString();
        const existing = byKey.get(key) || { label: '', pending: 0, inProgress: 0, completed: 0 };
        const status = String(r.status || '').trim();
        const n = Number(r.count || 0);
        if (status === 'pending' || status === 'open') existing.pending += n;
        else if (status === 'in progress' || status === 'in_progress' || status === 'inprogress' || status === 'under review') existing.inProgress += n;
        else if (status === 'completed' || status === 'closed' || status === 'resolved') existing.completed += n;
        else existing.pending += n;
        byKey.set(key, existing);
      });
    } catch (e) {
      console.warn('Dashboard maintenance-trends query failed:', e.message);
    }

    return res.json({ data: Array.from(byKey.values()), timeRange });
  } catch (error) {
    console.error('Dashboard maintenance-trends error:', error);
    return res.status(500).json({ message: 'Failed to fetch maintenance trends' });
  }
});

export default router;