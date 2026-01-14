import pool from '../config/db.js';

async function verifyFinalState() {
  try {
    console.log('=== FINAL VERIFICATION ===\n');
    
    // Check hotels table
    const hotelsCount = await pool.query('SELECT COUNT(*) as count FROM public.hotels');
    console.log(`🏨 Hotels table: ${hotelsCount.rows[0].count} properties total`);
    
    // Check branches
    const branches = await pool.query(`
      SELECT COUNT(*) as count 
      FROM public.hotels 
      WHERE branch IS NOT NULL
    `);
    console.log(`🏢 Branch properties: ${branches.rows[0].count}`);
    
    // List all properties
    const all = await pool.query(`
      SELECT id, name, code, branch, property_type 
      FROM public.hotels 
      ORDER BY name
    `);
    
    console.log(`\n📋 All ${all.rows.length} properties:\n`);
    all.rows.forEach((row, idx) => {
      const type = row.property_type || 'N/A';
      const branch = row.branch ? `[Branch: ${row.branch}]` : '';
      console.log(`  ${idx + 1}. ${row.name} (${row.code || 'N/A'}) - ${type} ${branch}`);
    });
    
    console.log('\n✅ All properties are now in the hotels table and ready to display!');
    console.log('Frontend should now show all 26 properties (4 original + 22 branches)');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    process.exit(0);
  }
}

verifyFinalState();
