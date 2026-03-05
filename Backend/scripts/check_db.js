import "../load-env.js";
import pool from "../config/db.js";

async function run() {
    try {
        const dbInfo = await pool.query("SELECT current_database(), current_user, current_schema()");
        console.log("DB Context:", JSON.stringify(dbInfo.rows[0]));

        const res = await pool.query("SELECT schemaname, tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema')");
        res.rows.forEach(r => console.log(`TABLE: ${r.schemaname}.${r.tablename}`));

        const searchPath = await pool.query("SHOW search_path");
        console.log("Current search_path:", searchPath.rows[0].search_path);
    } catch (err) {
        console.error("DB check error:", err);
    } finally {
        process.exit(0);
    }
}

run();
