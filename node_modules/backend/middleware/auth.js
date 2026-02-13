// middleware/auth.js
import jwt from "jsonwebtoken";
import { logActivity } from "../utils/activityLogger.js";

/**
 * Robust DB pool loader.
 * Tries common locations and surfaces a clear error if none found.
 *
 * Note: this file uses dynamic import with top-level await which requires
 * node to run in ESM mode ("type": "module" in package.json) or running with `node --input-type=module`.
 */
let pool;
let poolSource = null;

function isDbUnavailableError(err) {
  const msg = String(err?.message || "");
  const code = String(err?.code || "");
  return (
    code === "ECONNABORTED" ||
    code === "ENETUNREACH" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    msg.toLowerCase().includes("connection terminated") ||
    msg.toLowerCase().includes("connect enetunreach") ||
    msg.toLowerCase().includes("connect econnaborted") ||
    msg.toLowerCase().includes("timeout")
  );
}

async function loadPool() {
  // Try config/db.js first (common pattern), then try ../db.js
  const candidates = ["../config/db.js", "../db.js", "./db.js", "../src/backend/db.js"];
  for (const p of candidates) {
    try {
      // dynamic import returns a module namespace object
      // use default export or named export `pool`
      // Resolve relative to this file
      const mod = await import(p);
      // prefer default export, then named 'default' or 'pool'
      const candidatePool = mod?.default || mod?.pool || mod;
      if (candidatePool) {
        poolSource = p;
        return candidatePool;
      }
    } catch (err) {
      // ignore resolution errors — we'll try next
      // but log at debug level for visibility
      // (Don't spam in production logs)
      // console.debug(`Pool import failed for ${p}:`, err && err.message);
    }
  }
  return null;
}

// initialize pool (top-level await allowed in ESM)
pool = await loadPool();
if (!pool) {
  console.error("CRITICAL: Could not locate database pool. Tried '../config/db.js', '../db.js', './db.js', and './src/backend/db.js'.");
  console.error("Make sure your db.js exports a Pool (default) or named 'pool', and that import path matches.");
}

/**
 * detectUsersHotelColumn
 * Checks common column names used to store staff -> hotel assignment
 * in the users table. Returns the found column name or null.
 */
const detectUsersHotelColumnCache = {
  ts: 0,
  value: null,
  inFlight: null,
  failTs: 0,
};

export async function detectUsersHotelColumn() {
  if (!pool) return null; // cannot query without pool

  const now = Date.now();
  // cache success for 1 hour
  if (detectUsersHotelColumnCache.value !== null && now - detectUsersHotelColumnCache.ts < 60 * 60_000) {
    return detectUsersHotelColumnCache.value;
  }
  // backoff after failure for 30 seconds to avoid hammering DB
  if (detectUsersHotelColumnCache.failTs && now - detectUsersHotelColumnCache.failTs < 30_000) {
    return detectUsersHotelColumnCache.value;
  }
  if (detectUsersHotelColumnCache.inFlight) {
    try {
      return await detectUsersHotelColumnCache.inFlight;
    } catch {
      return detectUsersHotelColumnCache.value;
    }
  }

  const candidates = ["hotel_id", "hotelId", "hotel", "hotelid"];

  detectUsersHotelColumnCache.inFlight = (async () => {
    for (const col of candidates) {
      try {
        const r = await pool.query(
          `SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = $1 LIMIT 1`,
          [col]
        );
        if (r && r.rows && r.rows.length) {
          detectUsersHotelColumnCache.value = col;
          detectUsersHotelColumnCache.ts = Date.now();
          detectUsersHotelColumnCache.failTs = 0;
          return col;
        }
      } catch (err) {
        detectUsersHotelColumnCache.failTs = Date.now();
        console.warn("detectUsersHotelColumn check failed for", col, err && err.message);
        if (isDbUnavailableError(err)) {
          break;
        }
      }
    }
    // Cache negative result for 1 hour as well
    detectUsersHotelColumnCache.value = null;
    detectUsersHotelColumnCache.ts = Date.now();
    return null;
  })();

  try {
    return await detectUsersHotelColumnCache.inFlight;
  } finally {
    detectUsersHotelColumnCache.inFlight = null;
  }
}

/**
 * protect middleware
 */
export const protect = async (req, res, next) => {
  try {
    if (!pool) {
      console.error("Auth: DB pool not available. Aborting auth check.");
      return res.status(500).json({ message: "Server misconfiguration: DB pool missing" });
    }

    // Accept token from cookie, Authorization header, query param, or request body.
    let tokenSource = null;
    let token =
      (req.cookies && req.cookies.token) ||
      null;

    if (token) tokenSource = "cookie";

    if (!token) {
      const header = req.header("Authorization") || req.header("authorization") || null;
      if (header) {
        tokenSource = "header";
        token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : header;
      }
    }

    if (!token && req.query && req.query.token) {
      tokenSource = "query";
      token = req.query.token;
    }

    if (!token && req.body && req.body.token) {
      tokenSource = "body";
      token = req.body.token;
    }

    if (!token) {
      console.warn("Auth: no token found in cookie/header/query/body");
      return res.status(401).json({ message: "Not authorized — no token" });
    }

    // preview token (not full) for logs - avoid printing secret content but show structure
    const preview = String(token).slice(0, 40) + (String(token).length > 40 ? "..." : "");
    console.info(`Auth: token found (source=${tokenSource}) preview=${preview}`);

    // Attempt to decode payload part (not verification) to show id/exp if present
    try {
      const parts = String(token).split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
        console.info("Auth: token payload (decoded):", { id: payload.id, exp: payload.exp, iat: payload.iat });
      } else {
        console.info("Auth: token does not appear to be a JWT (parts != 3)");
      }
    } catch (decErr) {
      console.warn("Auth: failed to base64-decode token payload (might be malformed):", decErr && decErr.message);
    }

    // verify the token
    let decoded;
    try {
      // Fallback JWT_SECRET for production if not set
      const jwtSecret = process.env.JWT_SECRET || 
        process.env.JWT_SECRET_KEY || 
        "default-jwt-secret-for-production-change-this-in-env-32-chars-minimum";
      
      if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
        console.warn("Auth: JWT_SECRET not set in production, using fallback. Please set JWT_SECRET in environment variables.");
        console.warn("Auth: Set JWT_SECRET in your .env file or environment variables for security.");
      }
      
      decoded = jwt.verify(token, jwtSecret);
    } catch (verifyErr) {
      console.error("Auth: JWT verification failed:", verifyErr && verifyErr.message);
      return res.status(401).json({ message: "Not authorized — token failed" });
    }

    // synthetic admin fallback (useful for dev)
    if (decoded?.id === "admin-synthetic") {
      req.user = {
        id: decoded.id,
        name: process.env.ADMIN_NAME || "Site Admin",
        email: process.env.ADMIN_EMAIL || "admin@example.com",
        role: "admin",
        status: "active",
      };
      return next();
    }

    // Detect hotel assignment column and include it as hotel_id if present
    let hotelCol = null;
    try {
      hotelCol = await detectUsersHotelColumn();
    } catch (err) {
      console.error("Auth protect unexpected error (detectUsersHotelColumn):", err && err.message);
      if (isDbUnavailableError(err)) {
        return res.status(503).json({ message: "Database unavailable. Please try again." });
      }
      throw err;
    }
    const baseCols = ["id", "name", "email", "role", "status", "branch"];
    if (hotelCol) {
      baseCols.push(`"${hotelCol}" as hotel_id`);
    }

    const q = `SELECT ${baseCols.join(", ")} FROM users WHERE id = $1 LIMIT 1`;
    let userRes;
    try {
      userRes = await pool.query(q, [decoded.id]);
    } catch (err) {
      console.error("Auth protect unexpected error (user lookup):", err && err.message);
      if (isDbUnavailableError(err)) {
        return res.status(503).json({ message: "Database unavailable. Please try again." });
      }
      throw err;
    }

    if (!userRes.rows || !userRes.rows.length) {
      console.warn("Auth: token verified but user not found:", decoded.id);
      return res.status(401).json({ message: "Not authorized — user not found" });
    }

    const user = userRes.rows[0];
    if (user.status && user.status !== "active") {
      return res.status(403).json({ message: "Account not active. Await approval." });
    }

    req.user = user;

    // Centralized activity logging for the whole website.
    // Can be disabled with: ACTIVITY_LOGS_ENABLED=false
    if (process.env.ACTIVITY_LOGS_ENABLED !== "false") {
      if (!req._activityHooked) {
        req._activityHooked = true;
        const startedAt = Date.now();

        const sanitize = (obj) => {
          try {
            if (!obj || typeof obj !== "object") return obj;
            const out = Array.isArray(obj) ? [] : {};
            for (const [k, v] of Object.entries(obj)) {
              if (/password|token|authorization/i.test(k)) continue;
              out[k] = v;
            }
            return out;
          } catch {
            return null;
          }
        };

        res.on("finish", async () => {
          try {
            const url = String(req.originalUrl || "");
            // prevent recursion/noise
            if (url.startsWith("/api/auth/activity-logs") || url.startsWith("/api/auth/activity-stats")) {
              return;
            }

            const method = String(req.method || "GET").toUpperCase();
            const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
            const actionType = isWrite ? "crud" : "view";
            const action = `${actionType}_${method.toLowerCase()}`;

            const resource = (() => {
              const base = String(req.baseUrl || "");
              const p = base || url;
              return p.replace(/^\/api\//, "").split("?")[0].split("/")[0] || "api";
            })();

            const ipAddress = req.ip || req.connection?.remoteAddress || req.headers["x-forwarded-for"]?.split(",")[0];
            const userAgent = req.headers["user-agent"];
            const status = res.statusCode >= 400 ? "failed" : "success";

            const meta = {
              method,
              url,
              statusCode: res.statusCode,
              durationMs: Date.now() - startedAt,
              params: sanitize(req.params),
              query: sanitize(req.query),
              body: isWrite ? sanitize(req.body) : undefined,
            };

            // Skip activity logging for synthetic admin users
            if (req.user?.id !== "admin-synthetic") {
              await logActivity({
                userId: req.user?.id,
                action,
                actionType,
                resource,
                resourceId: req.params?.id || req.params?.roomId || req.params?.hotelId || null,
                description: `${method} ${url}`,
                metadata: meta,
                ipAddress,
                userAgent,
                status,
              });
            }
          } catch (e) {
            console.error("Auto activity log error:", e && e.message ? e.message : e);
          }
        });
      }
    }
    next();
  } catch (err) {
    console.error("Auth protect unexpected error:", err && err.stack ? err.stack : err);
    return res.status(401).json({ message: "Not authorized — token failed" });
  }
};

/* requireRole helper */
export const requireRole = (role) => (req, res, next) => {
  if (!req.user || req.user.role !== role) {
    return res.status(403).json({ message: "Forbidden — insufficient rights" });
  }
  next();
};
