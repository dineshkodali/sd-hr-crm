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
    
    // Simple trend data - can be enhanced with actual time-series data
    const trends = {
      hotelGrowth: 0,
      roomOccupancy: 0,
      userActivity: 0,
      timeRange
    };
    
    res.json(trends);
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
    
    res.json({
      totalBeds,
      occupiedBeds,
      occupancyRate: Math.round(occupancyRate * 100) / 100,
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
    try {
      const incidentsQuery = await pool.query("SELECT COUNT(*)::bigint as total FROM maintenance.incidents");
      incidentsCount = Number(incidentsQuery.rows[0]?.total || 0);
    } catch (e) {
      // Table might not exist
      console.warn("Incidents table not found:", e.message);
    }
    
    res.json({
      totalIncidents: incidentsCount,
      openIncidents: incidentsCount, // Simplified
      resolvedIncidents: 0,
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
    
    const complianceQuery = await pool.query("SELECT COUNT(*)::bigint as total FROM compliance");
    const certificatesQuery = await pool.query("SELECT COUNT(*)::bigint as total FROM certificates");
    
    res.json({
      totalCompliance: Number(complianceQuery.rows[0]?.total || 0),
      totalCertificates: Number(certificatesQuery.rows[0]?.total || 0),
      pendingTasks: 0,
      timeRange
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
    const incidentsQuery = await pool.query("SELECT COUNT(*)::bigint as total FROM maintenance.incidents WHERE status = 'open'");
    
    res.json({
      maintenanceTasks: Number(maintenanceQuery.rows[0]?.total || 0),
      openIncidents: Number(incidentsQuery.rows[0]?.total || 0),
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

export default router;