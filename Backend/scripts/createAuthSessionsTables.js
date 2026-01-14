// Create auth_sessions and login_logs tables
import dotenv from 'dotenv';
import pool from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from Backend directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function createTables() {
  try {
    console.log('Creating auth_sessions and login_logs tables...\n');
    
    const sql = fs.readFileSync(
      path.join(__dirname, 'create_auth_sessions_tables.sql'),
      'utf-8'
    );
    
    await pool.query(sql);
    
    console.log('✅ Tables created successfully\n');
    
    // Check auth_sessions table
    const sessionsResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'auth_sessions'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 auth_sessions table columns:');
    sessionsResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
    // Check login_logs table
    const logsResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'login_logs'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 login_logs table columns:');
    logsResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating tables:', error.message);
    process.exit(1);
  }
}

createTables();
