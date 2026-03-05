// Create authenticator_devices table
import dotenv from 'dotenv';
import pool from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from Backend directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function createTable() {
  try {
    console.log('Creating authenticator_devices table...');
    
    const sql = fs.readFileSync(
      path.join(__dirname, 'create_authenticator_devices_table.sql'),
      'utf-8'
    );
    
    await pool.query(sql);
    
    console.log('✅ authenticator_devices table created successfully');
    
    // Check if table exists
    const checkResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'authenticator_devices'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Table columns:');
    checkResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating table:', error.message);
    process.exit(1);
  }
}

createTable();
