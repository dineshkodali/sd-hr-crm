// Script to add indexes for faster compliance queries
import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config({ path: "./Backend/.env" });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function addIndexes() {
  try {
    await pool.query("CREATE INDEX IF NOT EXISTS idx_certificates_is_active ON certificates(is_active);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_certificates_expiry_date ON certificates(expiry_date);");
    console.log("Indexes created or already exist.");
  } catch (err) {
    console.error("Error creating indexes:", err);
  } finally {
    await pool.end();
  }
}

addIndexes();
