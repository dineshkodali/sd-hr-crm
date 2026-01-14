// scripts/addServiceUserProfileFields.js
import dotenv from "dotenv";
import pool from "../config/db.js";

dotenv.config();

const columns = [
  { name: "gender", definition: "TEXT" },
  { name: "immigration_status", definition: "TEXT" },
  { name: "number_of_dependents", definition: "INTEGER DEFAULT 0" },
  { name: "emergency_contact_name", definition: "TEXT" },
  { name: "emergency_contact_phone", definition: "TEXT" },
];

const ensureColumns = async () => {
  try {
    for (const col of columns) {
      const sql = `ALTER TABLE service_users ADD COLUMN IF NOT EXISTS ${col.name} ${col.definition};`;
      await pool.query(sql);
      console.log(`Ensured column: ${col.name}`);
    }
    console.log("All service user profile columns are up to date.");
    process.exit(0);
  } catch (err) {
    console.error("Failed to ensure service user columns:", err);
    process.exit(1);
  }
};

ensureColumns();


