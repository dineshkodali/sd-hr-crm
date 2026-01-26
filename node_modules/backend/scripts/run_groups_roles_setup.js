import pool from "../config/db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupGroupsRoles() {
  try {
    const sqlPath = path.join(__dirname, 'create_groups_roles_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (const statement of statements) {
      if (statement.trim()) {
        await pool.query(statement);
      }
    }
    
    console.log('✅ Groups and roles tables created successfully!');
    console.log('✅ Default groups and roles inserted!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error setting up groups and roles:', err);
    process.exit(1);
  }
}

setupGroupsRoles();
