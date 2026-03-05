// scripts/createAdmin.js
import bcrypt from "bcryptjs";
import pool from "../config/db.js"; // adjust path if needed
import dotenv from "dotenv";
dotenv.config();

const run = async () => {
  try {
    const email = process.env.ADMIN_EMAIL ?? "jupallisaipraneeth540@gmail.com";
    const password = process.env.ADMIN_PASSWORD ?? "praneeth123";
    const name = "Site Admin";

    const hashed = await bcrypt.hash(password, 10);

    // You may want to check if admin already exists
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length) {
      console.log("Admin already exists:", existing.rows[0].id);
      process.exit(0);
    }

    const res = await pool.query(
      `INSERT INTO users (name, email, password, role, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, email`,
      [name, email, hashed, "admin", "active"]
    );

    console.log("Admin created:", res.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error("Error creating admin:", err);
    process.exit(1);
  }
};

run();
