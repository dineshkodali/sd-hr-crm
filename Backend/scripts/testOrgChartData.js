import pool from '../config/db.js';

async function testOrgChart() {
  const client = await pool.connect();
  try {
    console.log('\n=== Testing Organization Chart Data ===\n');
    
    // Get branches
    const branches = await client.query(`
      SELECT id, name, code, branch, manager_id 
      FROM hotels 
      WHERE property_type = 'Branch' 
      ORDER BY name 
      LIMIT 5
    `);
    
    console.log('📋 Sample Branches:');
    branches.rows.forEach(b => {
      console.log(`  ${b.id}: ${b.name} (code: ${b.code || 'N/A'}, branch: ${b.branch || 'N/A'})`);
    });
    
    // Get employees
    const employees = await client.query(`
      SELECT id, name, role, branch, hotel_id, status 
      FROM users 
      WHERE role IN ('admin', 'manager', 'staff')
      ORDER BY name 
      LIMIT 10
    `);
    
    console.log('\n👥 Sample Employees:');
    employees.rows.forEach(e => {
      console.log(`  ${e.id}: ${e.name} - ${e.role} (branch: ${e.branch || 'N/A'}, hotel_id: ${e.hotel_id || 'N/A'}, status: ${e.status})`);
    });
    
    // Try to match employees to branches
    console.log('\n🔗 Matching Test:');
    const branch = branches.rows[0];
    if (branch) {
      console.log(`\nBranch: ${branch.name} (id: ${branch.id}, code: ${branch.code}, branch: ${branch.branch})`);
      
      const matchedEmps = await client.query(`
        SELECT id, name, role, branch, hotel_id 
        FROM users 
        WHERE role IN ('admin', 'manager', 'staff')
          AND (
            branch = $1 
            OR branch = $2 
            OR hotel_id = $3
            OR LOWER(branch) = LOWER($4)
          )
        LIMIT 10
      `, [branch.code, branch.branch, branch.id, branch.name]);
      
      console.log(`Matched employees: ${matchedEmps.rows.length}`);
      matchedEmps.rows.forEach(e => {
        console.log(`  ✓ ${e.name} (${e.role}) - branch: ${e.branch}, hotel_id: ${e.hotel_id}`);
      });
    }
    
    // Get all unique branch values from users
    const uniqueBranches = await client.query(`
      SELECT DISTINCT branch 
      FROM users 
      WHERE branch IS NOT NULL 
        AND branch != ''
      ORDER BY branch
    `);
    
    console.log('\n📍 Unique branch values in users table:');
    uniqueBranches.rows.forEach(b => {
      console.log(`  - ${b.branch}`);
    });
    
  } finally {
    client.release();
    await pool.end();
  }
}

testOrgChart();
