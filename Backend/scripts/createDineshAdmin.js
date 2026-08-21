// scripts/createDineshAdmin.js
import "../load-env.js";
import bcrypt from "bcryptjs";
import pool from "../config/db.js";

const run = async () => {
  try {
    const email = "dinesh@gmail.com";
    const password = "dinesh123";
    const name = "Dinesh Admin";

    const hashed = await bcrypt.hash(password, 10);

    // Delete existing user if they exist to prevent unique constraint error
    await pool.query("DELETE FROM users WHERE email = $1", [email]);

    const res = await pool.query(
      `INSERT INTO users (name, email, password, role, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, email`,
      [name, email, hashed, "admin", "active"]
    );

    console.log("Admin user created successfully:", res.rows[0]);
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("Error creating admin:", err);
    await pool.end();
    process.exit(1);
  }
};

run();
