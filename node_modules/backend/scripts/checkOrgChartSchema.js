import pool from '../config/db.js';

async function checkSchema() {
  const client = await pool.connect();
  try {
    // Check users table columns
    const usersColumns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name='users' AND table_schema='public'
      ORDER BY ordinal_position
    `);
    console.log('\n📋 Users table columns:');
    usersColumns.rows.forEach(col => console.log(`  - ${col.column_name} (${col.data_type})`));
    
    // Check hotels table columns
    const hotelsColumns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name='hotels' AND table_schema='public'
      ORDER BY ordinal_position
    `);
    console.log('\n📋 Hotels/Branches table columns:');
    hotelsColumns.rows.forEach(col => console.log(`  - ${col.column_name} (${col.data_type})`));
    
    // Sample data
    const branches = await client.query('SELECT id, name, branch, code FROM hotels WHERE property_type=\'Branch\' LIMIT 5');
    console.log('\n📊 Sample branches:', branches.rowCount);
    branches.rows.forEach(b => console.log(`  ${b.id}: ${b.name} (${b.code || b.branch})`));
    
    const users = await client.query('SELECT id, name, role, branch FROM users LIMIT 5');
    console.log('\n👥 Sample users:', users.rowCount);
    users.rows.forEach(u => console.log(`  ${u.id}: ${u.name} - ${u.role} @ ${u.branch || 'N/A'}`));
    
  } finally {
    client.release();
    await pool.end();
  }
}

checkSchema();
