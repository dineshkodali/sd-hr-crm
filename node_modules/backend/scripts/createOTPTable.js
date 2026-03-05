// Backend/scripts/createOTPTable.js
import pool from '../config/db.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createOTPTable() {
  try {
    console.log('Creating OTP table...');
    
    const sql = fs.readFileSync(join(__dirname, 'create_otp_table.sql'), 'utf8');
    await pool.query(sql);
    
    console.log('✅ OTP table created successfully!');
    console.log('   - user_otps table');
    console.log('   - Indexes for email, code, expires_at');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating OTP table:', error.message);
    process.exit(1);
  }
}

createOTPTable();
