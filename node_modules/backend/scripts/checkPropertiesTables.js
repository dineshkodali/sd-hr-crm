import pool from '../config/db.js';

async function checkTables() {
  try {
    const t = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('hotels', 'properties') 
      ORDER BY table_name
    `);
    
    console.log('\n📋 Tables found:', t.rows.map(r => r.table_name).join(', '));
    
    if (t.rows.find(r => r.table_name === 'hotels')) {
      const h = await pool.query('SELECT COUNT(*) FROM hotels');
      console.log('   Hotels table has', h.rows[0].count, 'rows');
    }
    
    if (t.rows.find(r => r.table_name === 'properties')) {
      const p = await pool.query('SELECT COUNT(*) FROM properties');
      console.log('   Properties table has', p.rows[0].count, 'rows');
      
      const sample = await pool.query('SELECT id, name, code FROM properties LIMIT 5');
      console.log('\n   Sample properties:');
      sample.rows.forEach(r => console.log(`     [${r.id}] ${r.name} (${r.code})`));
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkTables();
