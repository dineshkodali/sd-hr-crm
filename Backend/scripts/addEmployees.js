// Bulk Add Employees Script
// Creates employees with default password and assigns them to properties/branches

import pool from '../config/db.js';
import bcrypt from 'bcryptjs';

const employees = [
  // Add your employee list here with the following structure:
  // { name, email, phone, branch, role, property }
  
  // Example employees - update with actual data
  { 
    name: 'John Manager', 
    email: 'john.manager@example.com', 
    phone: '1234567890',
    branch: 'London Branch',
    role: 'manager',
    property: 'London Property 1'
  },
  { 
    name: 'Jane Staff', 
    email: 'jane.staff@example.com', 
    phone: '1234567891',
    branch: 'London Branch',
    role: 'staff',
    property: 'London Property 1'
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
    
    console.log('\n👥 Adding employees...\n');
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    for (const emp of employees) {
      try {
        // Check if user already exists
        const existingUser = await client.query(
          'SELECT id, email FROM users WHERE email = $1',
          [emp.email]
        );
        
        if (existingUser.rows.length > 0) {
          console.log(`⏭️  Skipped: ${emp.name} (${emp.email}) - already exists`);
          skipCount++;
          continue;
        }
        
        // Insert user
        const userResult = await client.query(
          `INSERT INTO users 
           (name, email, password, role, branch, phone, status, created_at) 
           VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW())
           RETURNING id`,
          [emp.name, emp.email, hashedPassword, emp.role, emp.branch, emp.phone]
        );
        
        const userId = userResult.rows[0].id;
        
        // Get property ID if property name is provided
        let propertyId = null;
        if (emp.property) {
          const propertyResult = await client.query(
            'SELECT id FROM properties WHERE name = $1 LIMIT 1',
            [emp.property]
          );
          
          if (propertyResult.rows.length > 0) {
            propertyId = propertyResult.rows[0].id;
          }
        }
        
        // Create basic profile
        await client.query(
          `INSERT INTO profiles 
           (user_id, name, email, phone, created_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (user_id) DO NOTHING`,
          [userId, emp.name, emp.email, emp.phone]
        );
        
        // Assign to property if property exists
        if (propertyId) {
          await client.query(
            `INSERT INTO property_staff 
             (property_id, user_id, role, assigned_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT DO NOTHING`,
            [propertyId, userId, emp.role]
          );
        }
        
        console.log(`✅ Added: ${emp.name} (${emp.email}) - Role: ${emp.role}, Branch: ${emp.branch}${propertyId ? `, Property ID: ${propertyId}` : ''}`);
        successCount++;
        
      } catch (err) {
        console.error(`❌ Error adding ${emp.name}:`, err.message);
        errorCount++;
      }
    }
    
    await client.query('COMMIT');
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log(`   ✅ Successfully added: ${successCount}`);
    console.log(`   ⏭️  Skipped (existing): ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📝 Total processed: ${employees.length}`);
    console.log('='.repeat(60));
    console.log('\n🔑 Default password for all new users: 123456');
    console.log('⚠️  Users should change their password after first login\n');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Transaction failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Get all properties to help with configuration
async function listProperties() {
  try {
    const result = await pool.query(
      'SELECT id, name, branch FROM properties ORDER BY branch, name LIMIT 50'
    );
    
    console.log('\n📍 Available Properties:');
    console.log('='.repeat(60));
    
    if (result.rows.length === 0) {
      console.log('No properties found in database');
    } else {
      result.rows.forEach(prop => {
        console.log(`  ID: ${prop.id} | ${prop.name} | Branch: ${prop.branch || 'N/A'}`);
      });
    }
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('Error listing properties:', error.message);
  }
}

// Main execution
async function main() {
  console.log('\n🚀 Bulk Employee Add Script\n');
  
  // First, show available properties
  await listProperties();
  
  if (employees.length === 0) {
    console.log('⚠️  No employees defined in the script.');
    console.log('📝 Please edit this file and add employees to the array.\n');
    console.log('Example format:');
    console.log(`{
  name: 'Employee Name',
  email: 'email@example.com',
  phone: '1234567890',
  branch: 'Branch Name',
  role: 'manager' | 'staff' | 'admin',
  property: 'Property Name' (optional)
}\n`);
    process.exit(0);
  }
  
  console.log(`📋 Found ${employees.length} employee(s) to add\n`);
  
  // Confirm before proceeding
  console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  await addEmployees();
  
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
