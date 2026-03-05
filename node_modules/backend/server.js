// File: C:\PostgreAuth\Backend\server.js
// ES module style. If your project uses CommonJS, convert imports -> require accordingly.

import "./load-env.js"; // MUST be first to ensure env vars are loaded before db.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import pool from "./config/db.js";

import hseRoutes from "./routes/hse/index.js";
import safeguardingRoutes from "./routes/safeguarding/index.js";
import accessRoutes from "./routes/access/index.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import managerRoutes from "./routes/manager.js";
import staffRoutes from "./routes/staff.js";
import hotelsRoutes from "./routes/hotels.js";
import roomsRoutes from "./routes/rooms.js";
import profileRoutes from "./routes/profile.js";
import suRoutes from "./routes/su.js";
import complianceRoutes from "./routes/compliance.js";
import maintenanceRoutes from "./routes/maintenance.js";
import inspectionsRoutes from "./routes/inspections.js";
import incidentsRoutes from "./routes/incidents.js";
import moveinsRoutes from "./routes/moveins.js";
import moveoutsRoutes from "./routes/moveouts.js";
import mealsRoutes from "./routes/meals.js";
import aireTasksRoutes from "./routes/aire-tasks.js";
import litigationRoutes from "./routes/litigation.js";

import dashboardPublicRoutes from "./routes/dashboard_public.js";
import complaintsRoutes from "./routes/complaints.js";
import vcsOrganisationsRoutes from "./routes/vcs-organisations.js";
import caseManagementRoutes from "./routes/case-management.js";
import emergencyProtocolsRoutes from "./routes/emergency-protocols.js";
import employeeTrainingRoutes from "./routes/employeeTrainingRoutes.js";
import formsRoutes from "./routes/forms.js";
import formsBuilderRoutes from "./routes/forms-builder.js";
import userManagementRoutes from "./routes/admin/user-management.js";
import emailNotificationRoutes from "./routes/email-notifications.js";
import emailConfigRoutes from "./routes/email-config.js";
import orgChartRoutes from "./routes/org-chart.js";
import dashboardRoutes from "./routes/dashboard.js";
import branchesRoutes from "./routes/branches.js";
import roomsListRoutes from "./routes/rooms-list.js";
import propertiesRoutes from "./routes/properties.js";
import reportTemplatesRoutes from "./routes/report-templates.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Healthcheck endpoint for Docker
app.get('/api/health', (req, res) => res.send('OK'));

// Authentication health check
app.get('/api/auth-health', (req, res) => {
  const jwtSecret = process.env.JWT_SECRET || process.env.JWT_SECRET_KEY;
  const corsOrigins = process.env.CORS_ORIGINS;

  res.json({
    status: 'ok',
    auth: {
      jwtSecret: !!jwtSecret,
      jwtSecretLength: jwtSecret ? jwtSecret.length : 0,
      corsOrigins: corsOrigins ? corsOrigins.split(',') : [],
      nodeEnv: process.env.NODE_ENV
    }
  });
});

console.log("Starting server (server.js) - NODE_ENV:", process.env.NODE_ENV || "development");

// Check authentication configuration
if (!process.env.JWT_SECRET && !process.env.JWT_SECRET_KEY) {
  console.warn("⚠️  JWT_SECRET not set! Using fallback for development.");
  console.warn("⚠️  Please set JWT_SECRET in your .env file for production security.");
}

if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGINS) {
  console.warn("⚠️  CORS_ORIGINS not set in production! Please configure your domain.");
}

/* ----------------------------
   Basic middleware
   ---------------------------- */

app.set("trust proxy", 1);

// File: C:\PostgreAuth\Backend\server.js

// ... (imports remain the same)

app.use(cors({
  origin: (origin, callback) => {
    // 1. UPDATED: Added IP-based origins to the allowed list
    const normalizeOrigin = (value) => {
      if (!value) return value;
      const trimmed = String(value).trim().replace(/\/+$/, "");
      // strip default ports so http://x:80 and https://x:443 match http://x and https://x
      return trimmed
        .replace(/^http:\/\/(.+):80$/i, "http://$1")
        .replace(/^https:\/\/(.+):443$/i, "https://$1");
    };

    const defaultAllowedOrigins = [
      'http://localhost:3002',
      'http://localhost:3000',
      'http://127.0.0.1:3002',
      'http://127.0.0.1:3000',
      'http://192.168.0.4:3002', // Added your local IP
      'http://192.168.0.4:3000',  // Added your local IP
      'http://172.22.48.1:3002', // Added your current access IP
      'http://172.22.48.1:3000', // Added your current access IP
      'http://crm.sdgsolutions.in',
      'https://crm.sdgsolutions.in',
      'http://crm.sdgsolutions.in:3002',
      'https://crm.sdgsolutions.in:3002',
      'http://crm.sdcsolutions.in',
      'https://crm.sdcsolutions.in',
      'http://crm.sdcsolutions.in:3002',
      'https://crm.sdcsolutions.in:3002',
    ];

    const envAllowedOrigins = process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",").map((s) => normalizeOrigin(s)).filter(Boolean)
      : [];

    const allowedOrigins = Array.from(
      new Set([...defaultAllowedOrigins.map(normalizeOrigin), ...envAllowedOrigins])
    ).filter(Boolean);

    if (process.env.CORS_ORIGINS === '*') {
      return callback(null, true);
    }

    if (!origin) return callback(null, true);

    const normalizedOrigin = normalizeOrigin(origin);
    const isPrivateLanOrigin = (() => {
      // Allow local network IPs where frontend may be accessed directly by IP.
      // Only allow expected ports for frontend.
      if (!/:(3000|3002)$/.test(normalizedOrigin)) return false;

      // 10.0.0.0/8
      if (/^http:\/\/10\.(\d{1,3}\.){2}\d{1,3}:(3000|3002)$/i.test(normalizedOrigin)) return true;

      // 192.168.0.0/16
      if (/^http:\/\/192\.168\.(\d{1,3})\.\d{1,3}:(3000|3002)$/i.test(normalizedOrigin)) return true;

      // 172.16.0.0 - 172.31.0.0
      const m = normalizedOrigin.match(/^http:\/\/172\.(\d{1,3})\.(\d{1,3})\.(\d{1,3}):(3000|3002)$/i);
      if (!m) return false;
      const secondOctet = Number(m[1]);
      return secondOctet >= 16 && secondOctet <= 31;
    })();

    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    if (isPrivateLanOrigin) {
      return callback(null, true);
    }

    // DEBUG: Log blocked origin to file
    const logMessage = `[${new Date().toISOString()}] BLOCKED ORIGIN: "${origin}" (normalized: "${normalizedOrigin}")\nAllowed: ${JSON.stringify(allowedOrigins)}\n\n`;
    try {
      fs.appendFileSync(path.join(__dirname, 'cors_debug.log'), logMessage);
    } catch (err) {
      console.error('Failed to write to cors_debug.log', err);
    }

    console.warn('CORS blocked origin:', origin, 'normalized:', normalizedOrigin, 'allowed:', allowedOrigins);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
}));

// ... (rest of the file remains the same)

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

/* ----------------------------
   Prevent caching for API endpoints
   ---------------------------- */
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
});

// Backward-compatible alias: some stale frontend bundles may call /api/api/*
app.use("/api/api", (req, res) => {
  const target = req.originalUrl.replace(/^\/api\/api/, "/api");
  return res.redirect(308, target);
});

/* ----------------------------
   Static uploads directory
   ---------------------------- */
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
try {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  app.use("/uploads", express.static(UPLOAD_DIR));
  console.log("✅ Upload dir available at /uploads ->", UPLOAD_DIR);
} catch (err) {
  console.error("Failed to ensure upload directory:", err);
}

/* ----------------------------
   Defensive route mounting helper
   ---------------------------- */
function mountRoute(mountPath, router, name = mountPath) {
  if (!router) {
    console.warn(`⚠️  Route for ${name} is undefined or null — skipping mount at ${mountPath}`);
    return;
  }

  const isRouter =
    typeof router === "function" ||
    (router && (typeof router.handle === "function" || Array.isArray(router.stack)));

  if (!isRouter) {
    console.warn(`⚠️  Provided route for ${name} at ${mountPath} doesn't look like an Express router — skipping.`);
    return;
  }

  app.use(mountPath, router);
  console.log(`✅ Mounted ${name} at ${mountPath}`);
}

/* ----------------------------
   Route mounting (safe)
   ---------------------------- */
mountRoute("/api/auth", authRoutes, "authRoutes");
mountRoute("/api/admin", adminRoutes, "adminRoutes");
mountRoute("/api/manager", managerRoutes, "managerRoutes");
mountRoute("/api/staff", staffRoutes, "staffRoutes");

// hotels and rooms: keep separate mount points
mountRoute("/api/hotels", hotelsRoutes, "hotelsRoutes");

// NOTE: If your rooms router needs access to hotelId param, ensure the router creation uses:
//    const router = express.Router({ mergeParams: true });
// in routes/rooms.js so req.params.hotelId is available inside roomsRoutes.
mountRoute("/api/hotels/:hotelId/rooms", roomsRoutes, "roomsRoutes");



// Service Users
mountRoute("/api/su", suRoutes, "suRoutes");

// Compliance
mountRoute("/api/compliance", complianceRoutes, "complianceRoutes");

// Maintenance
mountRoute("/api/maintenance", maintenanceRoutes, "maintenanceRoutes");

// Inspections
mountRoute("/api/inspections", inspectionsRoutes, "inspectionsRoutes");

// Incidents
mountRoute("/api/incidents", incidentsRoutes, "incidentsRoutes");

// Complaints
mountRoute("/api/complaints", complaintsRoutes, "complaintsRoutes");

// Case Management
mountRoute("/api/case-management", caseManagementRoutes, "caseManagementRoutes");

// Emergency Protocols
mountRoute("/api/emergency-protocols", emergencyProtocolsRoutes, "emergencyProtocolsRoutes");



// Employee Training
mountRoute("/api/employee-training", employeeTrainingRoutes, "employeeTrainingRoutes");

// VCS Organisations
mountRoute("/api/vcs-organisations", vcsOrganisationsRoutes, "vcsOrganisationsRoutes");

// Move-ins (new)
mountRoute("/api/move-ins", moveinsRoutes, "moveinsRoutes");

// Move-outs
mountRoute("/api/move-outs", moveoutsRoutes, "moveoutsRoutes");

// Meals (meal schedules)
mountRoute("/api/meals", mealsRoutes, "mealsRoutes");

// AIRE Tasks
mountRoute("/api/aire-tasks", aireTasksRoutes, "aireTasksRoutes");

// Litigation
mountRoute("/api/litigation", litigationRoutes, "litigationRoutes");



// Safeguarding group
mountRoute("/api/safeguarding", safeguardingRoutes, "safeguardingRoutes");

// HSE group
mountRoute("/api/hse", hseRoutes, "hseRoutes");

// Access group
mountRoute("/api/access", accessRoutes, "accessRoutes");

// Public dashboard summaries for landing/login (lightweight)
mountRoute("/api/dashboard", dashboardPublicRoutes, "dashboardPublicRoutes");

// Dashboard analytics routes
mountRoute("/api/dashboard", dashboardRoutes, "dashboardRoutes");

// Branches management
mountRoute("/api/branches", branchesRoutes, "branchesRoutes");

// Rooms list (all rooms across hotels)
mountRoute("/api/rooms", roomsListRoutes, "roomsListRoutes");

// Alias for older frontend endpoints that reference /api/meal-schedules
mountRoute("/api/meal-schedules", mealsRoutes, "mealsRoutesAlias");

// Forms
mountRoute("/api/forms", formsRoutes, "formsRoutes");

// Forms Builder (Dynamic Form Management)
mountRoute("/api/forms-builder", formsBuilderRoutes, "formsBuilderRoutes");

// Report templates
mountRoute("/api/report-templates", reportTemplatesRoutes, "reportTemplatesRoutes");

// User Management (Admin Settings)
mountRoute("/api/admin", userManagementRoutes, "userManagementRoutes");

// Email Notifications
mountRoute("/api/email-notifications", emailNotificationRoutes, "emailNotificationRoutes");

// Email Configuration (Admin Only)
mountRoute("/api/email-config", emailConfigRoutes, "emailConfigRoutes");

// Organization Chart
mountRoute("/api/org-chart", orgChartRoutes, "orgChartRoutes");

// Properties
mountRoute("/api/properties", propertiesRoutes, "propertiesRoutes");

// profile (keep last)
mountRoute("/api/profile", profileRoutes, "profileRoutes");

/* ----------------------------
   Serve frontend build (production)
   ---------------------------- */
if (process.env.NODE_ENV === "production") {
  const frontendDist = path.resolve(__dirname, "..", "frontend", "dist");
  const indexHtml = path.join(frontendDist, "index.html");

  if (fs.existsSync(frontendDist) && fs.existsSync(indexHtml)) {
    app.use(express.static(frontendDist));

    // SPA fallback: serve index.html for non-API routes
    app.get(/^\/(?!api\/).*/, (req, res) => {
      res.sendFile(indexHtml);
    });

    console.log("✅ Serving frontend from:", frontendDist);
  } else {
    console.warn("⚠️  Frontend build not found at", frontendDist, "(did you run frontend build?)");
  }
}

/* ----------------------------
   Health check & 404
   ---------------------------- */

// root-level health alias
app.get("/health", (req, res) => res.redirect("/api/health"));

app.get("/api/health", async (req, res) => {
  const health = {
    status: "UP",
    uptime: process.uptime(),
    timestamp: Date.now(),
    node_version: process.version,
    memory_usage: process.memoryUsage(),
    database: "DOWN"
  };

  try {
    // Simple query to verify DB connection
    const result = await pool.query("SELECT 1 as connected");
    if (result.rows[0].connected === 1) {
      health.database = "UP";
    }
  } catch (err) {
    console.error("Health check DB error:", err.message);
    health.status = "DEGRADED"; // Still up but DB is down
  }

  res.status(200).json(health);
});

app.get("/api/ready", async (req, res) => {
  try {
    const result = await pool.query("SELECT 1 as connected");
    const ok = result.rows && result.rows[0] && result.rows[0].connected === 1;
    if (!ok) return res.status(503).json({ status: "NOT_READY", database: "DOWN" });
    return res.status(200).json({ status: "READY", database: "UP" });
  } catch (err) {
    return res.status(503).json({ status: "NOT_READY", database: "DOWN" });
  }
});

// explicit API 404 (logged)
app.use("/api", (req, res) => {
  console.warn(`🔍 API route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ message: "API route not found" });
});

/* ----------------------------
   Global error handler
   ---------------------------- */
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err && err.stack ? err.stack : err);
  if (res.headersSent) return next(err);

  // If this is a CORS rejection, send 403 and a helpful message
  if (err && err.message && err.message.includes("CORS")) {
    return res.status(403).json({ message: "CORS error: origin not allowed" });
  }

  res.status(500).json({ message: "Server error" });
});

/* ----------------------------
   Start server with robust logging
   ---------------------------- */
const basePort = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
let activeServer = null;

function startServer(port) {
  const srv = app.listen(port, () => {
    console.log(`🚀 Server is running on port ${port}`);
  });

  srv.on("error", (err) => {
    if (err && err.code === "EADDRINUSE") {
      const nextPort = port + 1;
      console.warn(`Port ${port} in use, trying ${nextPort}...`);
      startServer(nextPort);
    } else {
      console.error("Server error during listen:", err && err.stack ? err.stack : err);
    }
  });

  activeServer = srv;
}

startServer(basePort);

/* ----------------------------
   Process-level handlers
   ---------------------------- */

process.on("unhandledRejection", (reason, p) => {
  console.error("❌ Unhandled Rejection at:", p, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err && err.stack ? err.stack : err);
});

/* ----------------------------
   Graceful shutdown signal handlers
   ---------------------------- */
function shutdown(signal) {
  console.log(`Received ${signal}. Closing HTTP server and exiting...`);

  if (activeServer) {
    activeServer.close(() => {
      console.log("HTTP server closed. Exiting process.");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }

  // force exit after 10s if server doesn't close
  setTimeout(() => {
    console.warn("Forcing shutdown.");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export default app;