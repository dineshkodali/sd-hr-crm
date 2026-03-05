import "../load-env.js";
import pool from "../config/db.js";

async function run() {
    try {
        const res = await pool.query("SELECT * FROM shift_handovers LIMIT 1");
        console.log("✅ SUCCESS: shift_handovers table is accessible.");
    } catch (err) {
        console.error("❌ FAILURE:", err.message);
    } finally {
        process.exit(0);
    }
}

run();
