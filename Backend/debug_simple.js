import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function debug() {
    try {
        console.log("Connecting...");
        const res = await pool.query("SELECT COUNT(*) FROM certificates");
        console.log("Total count:", res.rows[0].count);

        const resActive = await pool.query("SELECT COUNT(*) FROM certificates WHERE is_active IS TRUE");
        console.log("Active count:", resActive.rows[0].count);

        const resList = await pool.query("SELECT * FROM certificates WHERE is_active IS TRUE LIMIT 5");
        console.log("First 5 active certificates:", resList.rows);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await pool.end();
    }
}

debug();
