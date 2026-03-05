import pool from '../config/db.js';

async function checkPropertiesSchema() {
  try {
    console.log('Checking properties table schema...\n');
    
    const schemaQuery = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'maintenance' 
      AND table_name = 'properties'
      ORDER BY ordinal_position
    `);
    
    console.log('Properties table columns:');
    schemaQuery.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });
    
    console.log('\nChecking sample data...\n');
    
    const dataQuery = await pool.query(`
      SELECT * FROM properties LIMIT 3
    `);
    
    console.log(`Found ${dataQuery.rows.length} sample properties:`);
    dataQuery.rows.forEach((row, idx) => {
      console.log(`\n[${idx + 1}]`, JSON.stringify(row, null, 2));
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

checkPropertiesSchema();
