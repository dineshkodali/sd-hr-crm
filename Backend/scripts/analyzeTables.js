import pool from '../config/db.js';

async function checkBothTables() {
  try {
    // Check maintenance.hotels
    console.log('=== Checking maintenance schema ===\n');
    
    const maintenanceTables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'maintenance' 
      AND table_name IN ('hotels', 'properties')
    `);
    console.log('Tables in maintenance schema:', maintenanceTables.rows.map(r => r.table_name));
    
    if (maintenanceTables.rows.some(r => r.table_name === 'hotels')) {
      const hotelsSchema = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'maintenance' 
        AND table_name = 'hotels'
        ORDER BY ordinal_position
      `);
      
      console.log('\nmaintenance.hotels columns:');
      hotelsSchema.rows.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });
      
      const hotelsCount = await pool.query(`SELECT COUNT(*) as count FROM maintenance.hotels`);
      console.log(`\nmaintenance.hotels row count: ${hotelsCount.rows[0].count}`);
      
      const hotelsSample = await pool.query(`SELECT id, name, code, branch FROM maintenance.hotels LIMIT 3`);
      console.log('\nSample data:');
      hotelsSample.rows.forEach((row, idx) => {
        console.log(`  [${idx + 1}] ID: ${row.id}, Name: ${row.name}, Code: ${row.code}, Branch: ${row.branch}`);
      });
    }
    
    // Check public.properties
    console.log('\n\n=== Checking public schema ===\n');
    
    const publicTables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('hotels', 'properties')
    `);
    console.log('Tables in public schema:', publicTables.rows.map(r => r.table_name));
    
    if (publicTables.rows.some(r => r.table_name === 'properties')) {
      const propsSchema = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'properties'
        ORDER BY ordinal_position
      `);
      
      console.log('\npublic.properties columns:');
      propsSchema.rows.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });
      
      const propsCount = await pool.query(`SELECT COUNT(*) as count FROM public.properties`);
      console.log(`\npublic.properties row count: ${propsCount.rows[0].count}`);
      
      const propsSample = await pool.query(`SELECT id, name, code, address FROM public.properties LIMIT 3`);
      console.log('\nSample data:');
      propsSample.rows.forEach((row, idx) => {
        console.log(`  [${idx + 1}] ID: ${row.id}, Name: ${row.name}, Code: ${row.code}`);
      });
    }
    
    // Check current search_path
    console.log('\n\n=== Database Configuration ===\n');
    const searchPath = await pool.query(`SHOW search_path`);
    console.log('Current search_path:', searchPath.rows[0].search_path);
    
    // Try unqualified query
    console.log('\n\n=== Testing unqualified "properties" query ===\n');
    const unqualified = await pool.query(`SELECT COUNT(*) as count FROM properties`);
    console.log(`Unqualified "properties" resolves to table with ${unqualified.rows[0].count} rows`);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

checkBothTables();
