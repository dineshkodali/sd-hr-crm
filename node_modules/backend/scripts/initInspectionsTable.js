// scripts/initInspectionsTable.js
// Initialize the inspections table if it doesn't exist

import dotenv from "dotenv";
import pool from "../config/db.js";

dotenv.config();

const run = async () => {
  try {
    console.log("Checking if inspections table exists...");

    // Check if table exists
    const check = await pool.query(
      `SELECT to_regclass('public.inspections') AS exists`
    );

    if (check.rows?.[0]?.exists) {
      console.log("✅ inspections table already exists.");
      process.exit(0);
    }

    console.log("Creating inspections table...");

    // Create the inspections table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inspections (
        id SERIAL PRIMARY KEY,
        reference VARCHAR(255) UNIQUE NOT NULL,
        inspection_type VARCHAR(255) NOT NULL,
        property INTEGER,
        service_user INTEGER,
        inspector_name VARCHAR(255) NOT NULL,
        inspection_date DATE NOT NULL,
        findings TEXT,
        issues_found INTEGER DEFAULT 0,
        action_required BOOLEAN DEFAULT FALSE,
        status VARCHAR(50) DEFAULT 'pending',
        priority VARCHAR(50) DEFAULT 'Medium',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create index on status and inspection_date for better query performance
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_inspections_status ON inspections(status)`
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_inspections_inspection_date ON inspections(inspection_date)`
    );

    console.log("✅ inspections table created successfully with indexes.");
    process.exit(0);
  } catch (err) {
    console.error("Error creating inspections table:", err);
    process.exit(1);
  }
};

run();
