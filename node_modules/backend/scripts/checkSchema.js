import pool from '../config/db.js';

async function checkSchema() {
  try {
    // Check properties table
    const propsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'properties' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Properties Table Columns:');
    console.log('─'.repeat(60));
    propsResult.rows.forEach(col => {
      console.log(`  ${col.column_name.padEnd(30)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Check users table
    const usersResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    console.log('\n👤 Users Table Columns:');
    console.log('─'.repeat(60));
    usersResult.rows.forEach(col => {
      console.log(`  ${col.column_name.padEnd(30)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Check if profiles table exists
    const profilesCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles'
      )
    `);
    
    console.log(`\n📊 Profiles Table Exists: ${profilesCheck.rows[0].exists ? 'YES' : 'NO'}`);

    // Check property_staff table
    const propertyStaffCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'property_staff'
      )
    `);
    
    console.log(`📊 Property_Staff Table Exists: ${propertyStaffCheck.rows[0].exists ? 'YES' : 'NO'}`);

    if (propertyStaffCheck.rows[0].exists) {
      const staffResult = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'property_staff' AND table_schema = 'public'
        ORDER BY ordinal_position
      `);
      
      console.log('\n🏢 Property_Staff Table Columns:');
      console.log('─'.repeat(60));
      staffResult.rows.forEach(col => {
        console.log(`  ${col.column_name.padEnd(30)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });
    }

    console.log('\n');
    await pool.end();
  } catch (error) {
    console.error('❌ Error checking schema:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkSchema();
