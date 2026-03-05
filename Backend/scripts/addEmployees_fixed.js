// Bulk Add Employees Script
// Creates employees with default password (all profile data stored in users table)

import pool from '../config/db.js';
import bcrypt from 'bcryptjs';

const employees = [
  // Add your employee list here with the following structure:
  // { name, email, phone, branch, role }
  
  // Example employees - update with actual data
  { 
    name: 'John Manager', 
    email: 'john.manager@example.com', 
    phone: '1234567890',
    branch: 'London Branch',
    role: 'manager'
  },
  { 
    name: 'Jane Staff', 
    email: 'jane.staff@example.com', 
    phone: '1234567891',
    branch: 'Manchester Branch',
    role: 'staff'
  },
  // Add more employees here...
];

const DEFAULT_PASSWORD = '123456';

async function addEmployees() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🔐 Hashing default password...');
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    
    console.log(`\n📝 Processing ${employees.length} employees...\n`);
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    for (const emp of employees) {
      try {
        console.log(`Processing: ${emp.name} (${emp.email})...`);
        
        // Check if user already exists
        const existingUser = await client.query(
          'SELECT id, email FROM users WHERE email = $1',
          [emp.email]
        );
        
        if (existingUser.rows.length > 0) {
          console.log(`  ⏭️  User already exists with email ${emp.email}`);
          skipCount++;
          continue;
        }
        
        // Insert employee into users table (users table contains all profile fields)
        const result = await client.query(
          `INSERT INTO users 
           (name, email, password, role, branch, phone, status, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW(), NOW()) 
           RETURNING id`,
          [emp.name, emp.email, hashedPassword, emp.role, emp.branch, emp.phone]
        );
        
        const userId = result.rows[0].id;
        
        console.log(`  ✅ Created employee ID: ${userId}`);
        successCount++;
        
      } catch (err) {
        console.error(`  ❌ Error processing ${emp.name}:`, err.message);
        errorCount++;
      }
    }
    
    await client.query('COMMIT');
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log(`  ✅ Successfully added: ${successCount}`);
    console.log(`  ⏭️  Skipped (existing): ${skipCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log(`  📝 Total processed: ${employees.length}`);
    console.log('='.repeat(60));
    
    if (successCount > 0) {
      console.log(`\n🔑 Default password for all new employees: ${DEFAULT_PASSWORD}`);
      console.log('⚠️  Employees should change their password on first login\n');
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Transaction rolled back due to error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// List available properties for reference
async function listProperties() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id, name, code, address FROM properties ORDER BY name'
    );
    
    if (result.rows.length === 0) {
      console.log('\n⚠️  No properties found in database\n');
      return;
    }
    
    console.log('\n🏢 Available Properties:');
    console.log('─'.repeat(60));
    result.rows.forEach(prop => {
      console.log(`  [${prop.id}] ${prop.name}${prop.code ? ' (' + prop.code + ')' : ''}`);
      if (prop.address) console.log(`      📍 ${prop.address}`);
    });
    console.log('─'.repeat(60) + '\n');
    
  } catch (error) {
    console.error('❌ Error listing properties:', error.message);
  } finally {
    client.release();
  }
}

// Main execution
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 Employee Bulk Creation Script');
  console.log('='.repeat(60));
  
  // Show available properties for reference
  await listProperties();
  
  console.log('⏳ Starting employee creation in 3 seconds...');
  console.log('   Press Ctrl+C to cancel\n');
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  await addEmployees();
  
  console.log('\n✨ Script completed!\n');
}

main().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
