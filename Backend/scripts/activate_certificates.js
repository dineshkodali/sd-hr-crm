// Script to set all certificates as active in the database
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

async function activateCertificates() {
  try {
    const res = await pool.query(
      "UPDATE certificates SET is_active = TRUE WHERE is_active IS NULL RETURNING id;"
    );
    console.log(`Updated ${res.rowCount} certificates to is_active = TRUE.`);
  } catch (err) {
    console.error("Error updating certificates:", err);
  } finally {
    await pool.end();
  }
}

activateCertificates();
