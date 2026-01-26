// Create Activity Logs Table
import pool from '../config/db.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createActivityLogsTable() {
  try {
    console.log('📊 Creating activity_logs table...');
    
    const sql = readFileSync(
      join(__dirname, 'create_activity_logs_table.sql'),
      'utf-8'
    );
    
    await pool.query(sql);
    
    console.log('✅ activity_logs table created successfully');
    
    // Verify table
    const verifyResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'activity_logs'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Table columns:');
    verifyResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating activity_logs table:', error);
    process.exit(1);
  }
}

createActivityLogsTable();
