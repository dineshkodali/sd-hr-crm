import pool from '../config/db.js';

async function checkHotelsTable() {
  try {
    console.log('=== public.hotels table analysis ===\n');
    
    const schema = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'hotels'
      ORDER BY ordinal_position
    `);
    
    console.log('Columns:');
    schema.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });
    
    const count = await pool.query(`SELECT COUNT(*) as count FROM public.hotels`);
    console.log(`\nTotal rows: ${count.rows[0].count}`);
    
    const sample = await pool.query(`
      SELECT id, name, code, branch, address, manager_id, property_type, status
      FROM public.hotels 
      ORDER BY id 
      LIMIT 10
    `);
    
    console.log('\nSample data:');
    sample.rows.forEach((row, idx) => {
      console.log(`  [${idx + 1}] ID: ${row.id}, Name: ${row.name}, Code: ${row.code || 'N/A'}, Branch: ${row.branch || 'N/A'}, Manager: ${row.manager_id || 'N/A'}`);
    });
    
    // Check if our imported branches are here
    console.log('\n\nChecking for imported branch data...');
    const branches = await pool.query(`
      SELECT name, code FROM public.hotels 
      WHERE name IN ('Head Office', 'Brit Hotel', 'Burrows Court')
      ORDER BY name
    `);
    
    if (branches.rows.length > 0) {
      console.log('Found imported branches in hotels table:');
      branches.rows.forEach(b => console.log(`  - ${b.name} (${b.code})`));
    } else {
      console.log('❌ Imported branches NOT found in hotels table');
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

checkHotelsTable();
