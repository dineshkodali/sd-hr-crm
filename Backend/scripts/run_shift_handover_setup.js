import "../load-env.js";
import pool from "../config/db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
    try {
        const sqlPath = path.join(__dirname, "create_shift_handovers_table.sql");
        const sql = fs.readFileSync(sqlPath, "utf8");
        await pool.query(sql);
        console.log("✅ shift_handovers table created or already exists.");
    } catch (err) {
        console.error("❌ Error creating shift_handovers table:", err);
    } finally {
        process.exit(0);
    }
}

run();
