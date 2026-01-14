import pool from '../config/db.js';

async function checkAllUserTables() {
  try {
    // Find all tables with user/staff/employee
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%staff%' OR table_name LIKE '%employee%' OR table_name LIKE '%user%')
      ORDER BY table_name
    `);
    
    console.log('\n📋 Tables related to users/staff/employees:');
    console.log('='.repeat(60));
    tables.rows.forEach(t => console.log(`  - ${t.table_name}`));
    
    // Check users table - all users
    console.log('\n\n👥 ALL USERS in "users" table:');
    console.log('='.repeat(80));
    const allUsers = await pool.query(`
      SELECT id, name, email, role, branch, status 
      FROM users 
      ORDER BY id
    `);
    
    allUsers.rows.forEach(u => {
      console.log(`  [${u.id}] ${u.name.padEnd(25)} | ${(u.email || 'no-email').padEnd(35)} | ${(u.role || 'no-role').padEnd(10)} | ${u.branch || 'no-branch'}`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log(`Total users: ${allUsers.rows.length}\n`);
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkAllUserTables();
