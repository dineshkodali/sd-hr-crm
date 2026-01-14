import pool from '../config/db.js';

const branches = [
  { name: 'Head Office', code: 'HQ', address: 'Main Office Location' },
  { name: 'Brit Hotel', code: 'BRIT', address: 'Brit Hotel Address' },
  { name: 'Burrows Court', code: 'BC', address: 'Burrows Court Address' },
  { name: 'BW Atlantic', code: 'BWA', address: 'BW Atlantic Address' },
  { name: 'Clacton Pier Avenue', code: 'CPA', address: 'Clacton Pier Avenue Address' },
  { name: 'Dudley Hotel', code: 'DH', address: 'Dudley Hotel Address' },
  { name: 'Engagement Team', code: 'ET', address: 'Engagement Team Office' },
  { name: 'Field Operations', code: 'FO', address: 'Field Operations Office' },
  { name: 'Finance', code: 'FIN', address: 'Finance Department' },
  { name: 'Hilton Hampton Ealing', code: 'HHE', address: 'Hilton Hampton Ealing Address' },
  { name: 'Holiday Inn Express Lambeth', code: 'HIEL', address: 'Holiday Inn Express Lambeth Address' },
  { name: 'Holiday Inn Old Street', code: 'HIOS', address: 'Holiday Inn Old Street Address' },
  { name: 'Holiday Inn Swiss Cottage', code: 'HISC', address: 'Holiday Inn Swiss Cottage Address' },
  { name: 'IBIS Budget Bishops Stortford', code: 'IBBS', address: 'IBIS Budget Bishops Stortford Address' },
  { name: 'IBIS Cardiff', code: 'IBC', address: 'IBIS Cardiff Address' },
  { name: 'Ibis Styles Seven Kings', code: 'ISSK', address: 'Ibis Styles Seven Kings Address' },
  { name: 'Incidents & Safeguarding', code: 'IS', address: 'Incidents & Safeguarding Office' },
  { name: 'Lea Halls', code: 'LH', address: 'Lea Halls Address' },
  { name: 'Leigham Court Hotel', code: 'LCH', address: 'Leigham Court Hotel Address' },
  { name: 'Maida Vale Apart Hotel', code: 'MVAH', address: 'Maida Vale Apart Hotel Address' },
  { name: 'Mercure Heathrow', code: 'MH', address: 'Mercure Heathrow Address' },
  { name: 'Parmiter', code: 'PAR', address: 'Parmiter Address' }
];

async function insertBranchesToHotels() {
  try {
    console.log('🚀 Starting branch insertion into hotels table...\n');
    
    // Check existing hotels
    const existing = await pool.query('SELECT name FROM public.hotels');
    const existingNames = existing.rows.map(r => r.name);
    console.log(`Found ${existingNames.length} existing properties in hotels table`);
    
    let inserted = 0;
    let skipped = 0;
    
    for (const branch of branches) {
      if (existingNames.includes(branch.name)) {
        console.log(`⏭️  Skipping "${branch.name}" - already exists`);
        skipped++;
        continue;
      }
      
      try {
        await pool.query(`
          INSERT INTO public.hotels 
            (name, code, address, branch, property_type, status, created_at, updated_at)
          VALUES 
            ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        `, [branch.name, branch.code, branch.address, branch.name, 'Branch', 'Active']);
        
        console.log(`✅ Inserted "${branch.name}" (${branch.code})`);
        inserted++;
      } catch (err) {
        console.error(`❌ Failed to insert "${branch.name}":`, err.message);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Inserted: ${inserted}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   📝 Total branches: ${branches.length}`);
    
    // Verify final count
    const final = await pool.query('SELECT COUNT(*) as count FROM public.hotels');
    console.log(`\n🏨 Total properties in hotels table: ${final.rows[0].count}`);
    
    // Show sample
    const sample = await pool.query(`
      SELECT id, name, code, branch 
      FROM public.hotels 
      WHERE branch IS NOT NULL
      ORDER BY name 
      LIMIT 5
    `);
    
    console.log(`\n📋 Sample inserted branches:`);
    sample.rows.forEach(row => {
      console.log(`   [${row.id}] ${row.name} (${row.code}) - Branch: ${row.branch}`);
    });
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    process.exit(0);
  }
}

insertBranchesToHotels();
