import pool from '../config/db.js';

async function checkTables() {
  try {
    // Check for property_staff and branches tables
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('property_staff', 'branches')
      ORDER BY table_name
    `);
    
    console.log('\n📋 Tables Found:', tablesResult.rows.length > 0 ? tablesResult.rows.map(r => r.table_name).join(', ') : 'None');
    
    // Check property_staff if exists
    if (tablesResult.rows.find(r => r.table_name === 'property_staff')) {
      const cols = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'property_staff' 
        ORDER BY ordinal_position
      `);
      console.log('\n🏢 property_staff columns:');
      console.log('─'.repeat(60));
      cols.rows.forEach(c => console.log(`  ${c.column_name.padEnd(25)} ${c.data_type.padEnd(20)} ${c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`));
    }
    
    // Check branches if exists
    if (tablesResult.rows.find(r => r.table_name === 'branches')) {
      const cols = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'branches' 
        ORDER BY ordinal_position
      `);
      console.log('\n🏢 branches columns:');
      console.log('─'.repeat(60));
      cols.rows.forEach(c => console.log(`  ${c.column_name.padEnd(25)} ${c.data_type.padEnd(20)} ${c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`));
    }
    
    // If tables don't exist, show what we need to create
    if (tablesResult.rows.length === 0) {
      console.log('\n⚠️  Neither property_staff nor branches tables exist.');
      console.log('\n💡 We can create them with the following structure:\n');
      console.log('CREATE TABLE branches (');
      console.log('  id SERIAL PRIMARY KEY,');
      console.log('  name TEXT NOT NULL,');
      console.log('  code TEXT,');
      console.log('  address TEXT,');
      console.log('  created_at TIMESTAMPTZ DEFAULT NOW()');
      console.log(');\n');
      console.log('CREATE TABLE property_staff (');
      console.log('  id SERIAL PRIMARY KEY,');
      console.log('  property_id INTEGER REFERENCES properties(id),');
      console.log('  user_id INTEGER REFERENCES users(id),');
      console.log('  role TEXT,');
      console.log('  assigned_at TIMESTAMPTZ DEFAULT NOW(),');
      console.log('  UNIQUE(property_id, user_id)');
      console.log(');\n');
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkTables();
