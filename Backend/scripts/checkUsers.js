import pool from '../config/db.js';

async function checkUsers() {
  try {
    const result = await pool.query(`
      SELECT id, name, email, role, branch, phone, status, created_at
      FROM users 
      WHERE role IN ('staff', 'manager')
      ORDER BY id DESC
      LIMIT 20
    `);
    
    console.log('\n👥 Current Staff/Manager Users in Database:');
    console.log('='.repeat(80));
    
    if (result.rows.length === 0) {
      console.log('  ⚠️  No staff or manager users found!');
    } else {
      result.rows.forEach(user => {
        console.log(`\nID: ${user.id}`);
        console.log(`  Name: ${user.name}`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Role: ${user.role}`);
        console.log(`  Branch: ${user.branch || 'N/A'}`);
        console.log(`  Phone: ${user.phone || 'N/A'}`);
        console.log(`  Status: ${user.status}`);
        console.log(`  Created: ${user.created_at}`);
      });
    }
    
    console.log('\n='.repeat(80));
    console.log(`Total: ${result.rows.length} staff/manager users found\n`);
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkUsers();
