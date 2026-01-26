// Backend/scripts/checkAuthenticatorColumns.js
import pool from '../config/db.js';

async function checkColumns() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('authenticator_secret', 'authenticator_enabled', 'backup_codes')
      ORDER BY column_name
    `);
    
    console.log('\n✅ Authenticator columns in users table:');
    if (result.rows.length === 0) {
      console.log('❌ No authenticator columns found!');
      console.log('Run: node scripts/addAuthenticatorColumns.js');
    } else {
      result.rows.forEach(row => {
        console.log(`  - ${row.column_name} (${row.data_type})`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkColumns();
