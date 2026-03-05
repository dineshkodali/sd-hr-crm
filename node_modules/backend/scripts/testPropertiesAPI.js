import pool from '../config/db.js';

async function testProperties() {
  try {
    console.log('Testing properties table query...\n');
    
    const result = await pool.query(`
      SELECT id, name, code, branch, address, manager_id 
      FROM properties 
      ORDER BY id 
      LIMIT 10
    `);
    
    console.log(`Found ${result.rows.length} properties:`);
    result.rows.forEach((row, idx) => {
      console.log(`[${idx + 1}] ID: ${row.id}, Name: ${row.name}, Code: ${row.code}, Branch: ${row.branch}`);
    });
    
    console.log('\nTesting fetchHotelsWithManager equivalent query...\n');
    
    const withManager = await pool.query(`
      SELECT h.*, u.name AS manager_name, u.email AS manager_email
      FROM properties h
      LEFT JOIN users u ON u.id = h.manager_id
      ORDER BY h.name
      LIMIT 10
    `);
    
    console.log(`Found ${withManager.rows.length} properties with manager info:`);
    withManager.rows.forEach((row, idx) => {
      console.log(`[${idx + 1}] ${row.name} - Manager: ${row.manager_name || 'None'}`);
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

testProperties();
