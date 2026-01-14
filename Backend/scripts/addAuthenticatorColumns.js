// Backend/scripts/addAuthenticatorColumns.js
import pool from '../config/db.js';

async function addAuthenticatorColumns() {
  try {
    console.log('Adding authenticator columns to users table...');
    
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS authenticator_secret VARCHAR(255),
      ADD COLUMN IF NOT EXISTS authenticator_enabled BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS backup_codes TEXT[];
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_authenticator_enabled ON users(authenticator_enabled);
    `);
    
    console.log('✅ Authenticator columns added successfully!');
    console.log('   - authenticator_secret (VARCHAR(255))');
    console.log('   - authenticator_enabled (BOOLEAN)');
    console.log('   - backup_codes (TEXT[])');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding authenticator columns:', error.message);
    process.exit(1);
  }
}

addAuthenticatorColumns();
