// C:\PostgreAuth\Backend\config\db.js
import { Pool } from "pg";
import dotenv from "dotenv";
import util from "util";

dotenv.config();

/**
 * Helper: treat empty / "null" / "undefined" strings as not-provided
 */
function present(value) {
  return (
    value !== undefined &&
    value !== null &&
    String(value).trim() !== "" &&
    String(value).toLowerCase() !== "null" &&
    String(value).toLowerCase() !== "undefined"
  );
}

/* --------------------------
   Connection resolution
   -------------------------- */

// Prefer a single DATABASE_URL if provided (common in cloud environments)
const connectionString = present(process.env.DATABASE_URL)
  ? process.env.DATABASE_URL
  : present(process.env.CONNECTION_STRING)
  ? process.env.CONNECTION_STRING
  : null;

// Discrete connection details (used when no connection string)
const host = present(process.env.DB_HOST) ? process.env.DB_HOST : undefined;
const port = present(process.env.DB_PORT) ? parseInt(process.env.DB_PORT, 10) : undefined;
const database = present(process.env.DB_NAME) ? process.env.DB_NAME : undefined;
const user = present(process.env.DB_USER) ? process.env.DB_USER : undefined;
const password = present(process.env.DB_PASSWORD) ? process.env.DB_PASSWORD : undefined;

const hasDiscreteConfig = host && database && user && password;

// If neither a connection string nor the required discrete parts exist,
// we will not throw at import-time; instead create a stub pool that surfaces
// a helpful error when queries are attempted. This avoids crashing ESM imports.
const missingConfig = !connectionString && !hasDiscreteConfig;

/* --------------------------
   Pool configuration
   -------------------------- */

const poolTuning = {
  max: present(process.env.PGPOOL_MAX) ? parseInt(process.env.PGPOOL_MAX, 10) : 10,
  idleTimeoutMillis: present(process.env.PG_IDLE_TIMEOUT) ? parseInt(process.env.PG_IDLE_TIMEOUT, 10) : 30000,
  connectionTimeoutMillis: present(process.env.PG_CONN_TIMEOUT) ? parseInt(process.env.PG_CONN_TIMEOUT, 10) : 20000,
  keepAlive: true,
};

const poolConfig = connectionString
  ? {
      connectionString,
      // Add options like ssl here if you need them, e.g. ssl: { rejectUnauthorized: false }
      ...poolTuning,
    }
  : {
      host,
      port,
      database,
      user,
      password,
      ...poolTuning,
    };

/* --------------------------
   Helper: stub pool (when config missing)
   -------------------------- */

function makeStubPool() {
  const err = new Error(
    "Postgres connection is not configured. Provide DATABASE_URL or DB_HOST/DB_NAME/DB_USER/DB_PASSWORD in your environment."
  );
  // Attach a helpful code so callers can detect this case if they want
  err.code = "DB_NOT_CONFIGURED";

  // minimal stub that matches pg Pool API used by app
  return {
    // emulate async query method
    query: async () => {
      throw err;
    },
    connect: async () => {
      throw err;
    },
    end: async () => {},
    on: () => {},
    // also convenience inspect output
    [util.inspect.custom]: () => "<StubPGPool (not configured)>",
  };
}

/* --------------------------
   Create pool or stub
   -------------------------- */

let pool;

if (missingConfig) {
  console.warn(
    "⚠️  Database configuration not found. Exporting a stub pool. Provide a valid DATABASE_URL (preferred) or DB_HOST/DB_NAME/DB_USER/DB_PASSWORD in environment to enable real DB access."
  );
  pool = makeStubPool();
} else {
  // create a real pool
  try {
    pool = new Pool(poolConfig);
  } catch (err) {
    console.error("❌ Failed to create Postgres Pool:", err && err.stack ? err.stack : err);
    // fall back to stub so application can still start (but DB ops will fail with clear message)
    pool = makeStubPool();
  }
}

/* --------------------------
   Pool event handlers & startup checks (only for real pool)
   -------------------------- */

const isRealPool = !!pool && typeof pool.query === "function" && pool[util.inspect.custom] !== "<StubPGPool (not configured)>";

if (isRealPool) {
  // Safe connect handler
  pool.on("connect", async (client) => {
    try {
      // Attempt to set a safe search_path; if it fails, fallback to public
      try {
        await client.query(`SET search_path TO maintenance, public, "$user";`);
        console.log('🔧 DB client connected and search_path set to: maintenance, public, "$user"');
      } catch (e) {
        console.warn("⚠️ Failed to set search_path to maintenance; attempting to set to public. Error:", e && e.message);
        try {
          await client.query(`SET search_path TO public, "$user";`);
          console.log('🔧 DB search_path set to: public, "$user"');
        } catch (err2) {
          console.error("❌ Failed to set any safe search_path on connect:", err2 && err2.stack ? err2.stack : err2);
        }
      }
    } catch (err) {
      console.error("❌ Error in pool.connect handler:", err && err.stack ? err.stack : err);
    }
  });

  pool.on("error", (err) => {
    console.error("❌ Unexpected error on idle DB client:", err && err.stack ? err.stack : err);
  });
}

/* --------------------------
   Optional debug checks in non-production
   -------------------------- */

async function debugDb() {
  if (!isRealPool) return;
  try {
    const info = await pool.query(`SELECT current_database() AS db, current_user AS user, current_schema() AS schema;`);
    console.log("🔍 DB Info:", info.rows[0]);

    const sp = await pool.query("SHOW search_path");
    console.log("🔍 search_path (server-side):", sp.rows[0].search_path);

    const t = await pool.query(
      `SELECT schemaname, tablename FROM pg_tables WHERE tablename IN ('tasks','task_comments','task_history','sites','certificates','properties') ORDER BY schemaname, tablename;`
    );
    if (t.rows.length) {
      console.log("🔍 Found tables:", JSON.stringify(t.rows));
    } else {
      console.log("🔍 Maintenance-related or compliance tables not found (will be created by migrations).");
    }
  } catch (err) {
    console.error("⚠️ DB debug error (non-fatal):", err && err.message ? err.message : err);
  }
}

if (process.env.NODE_ENV !== "production") {
  // run debug checks but don't let failures crash the process
  debugDb().catch((e) => {
    console.error("DB debug check failed (caught):", e && e.message ? e.message : e);
  });
}

/* --------------------------
   Export
   -------------------------- */

function maskedConfig(cfg) {
  if (!cfg) return {};
  const c = { ...cfg };
  try {
    if (c.password) c.password = "****";
    if (c.connectionString && typeof c.connectionString === "string") {
      // mask password in connection string if present (user:pass@host)
      c.connectionString = c.connectionString.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:****@");
    }
  } catch (e) {
    // ignore masking errors
  }
  return c;
}

console.log("✅ Postgres pool created. poolConfig:", maskedConfig(poolConfig));

export default pool;
