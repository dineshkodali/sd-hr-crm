import pool from '../config/db.js';

async function quickCheck() {
  const client = await pool.connect();
  try {
    // Count employees per branch
    const result = await client.query(`
      SELECT 
        h.name as branch_name,
        h.code,
        h.branch,
        COUNT(u.id) as employee_count
      FROM hotels h
      LEFT JOIN users u ON (
        u.branch = h.branch 
        OR u.branch = h.code 
        OR u.hotel_id = h.id
      )
      WHERE h.property_type = 'Branch'
        AND u.role IN ('admin', 'manager', 'staff')
        AND u.status = 'active'
      GROUP BY h.id, h.name, h.code, h.branch
      ORDER BY employee_count DESC
      LIMIT 15
    `);
    
    console.log('\n📊 Employees per Branch:\n');
    result.rows.forEach(row => {
      console.log(`${row.branch_name.padEnd(35)} ${row.employee_count} employees`);
    });
    
    console.log(`\nTotal branches with employees: ${result.rows.filter(r => r.employee_count > 0).length}`);
    console.log(`Total employees matched: ${result.rows.reduce((sum, r) => sum + parseInt(r.employee_count), 0)}`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

quickCheck();
