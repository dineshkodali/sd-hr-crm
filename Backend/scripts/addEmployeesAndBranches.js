// Add employees and their branch properties
import pool from '../config/db.js';
import bcrypt from 'bcryptjs';

// Your employee data
const employees = [
  { name: 'John Manager', email: 'john.manager@example.com', phone: '1234567890', branch: 'London Branch', role: 'manager' },
  { name: 'Jane Staff', email: 'jane.staff@example.com', phone: '1234567891', branch: 'Manchester Branch', role: 'staff' }
  // Add more employees here with their branches
];

// Your branches data (will be added as properties)
const branches = [
  { name: 'London Branch', code: 'LON', address: 'London, UK' },
  { name: 'Manchester Branch', code: 'MAN', address: 'Manchester, UK' },
  { name: 'Birmingham Branch', code: 'BIR', address: 'Birmingham, UK' }
  // Add more branches here
];

const DEFAULT_PASSWORD = '123456';

async function addBranchesAndEmployees() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('\n🏢 Adding branches to properties table...\n');
    
    const propertyMap = {};
    
    for (const branch of branches) {
      try {
        // Check if property already exists
        const existing = await client.query(
          'SELECT id, name FROM properties WHERE name = $1',
          [branch.name]
        );
        
        if (existing.rows.length > 0) {
          console.log(`  ⏭️  Property already exists: ${branch.name} (ID: ${existing.rows[0].id})`);
          propertyMap[branch.name] = existing.rows[0].id;
        } else {
          // Insert new property
          const result = await client.query(
            `INSERT INTO properties (name, code, address, created_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW())
             RETURNING id`,
            [branch.name, branch.code, branch.address]
          );
          
          propertyMap[branch.name] = result.rows[0].id;
          console.log(`  ✅ Added property: ${branch.name} (ID: ${result.rows[0].id})`);
        }
      } catch (err) {
        console.error(`  ❌ Error adding property ${branch.name}:`, err.message);
      }
    }
    
    console.log('\n👥 Adding employees to users table...\n');
    
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    let empSuccessCount = 0;
    let empSkipCount = 0;
    
    for (const emp of employees) {
      try {
        // Check if user already exists
        const existing = await client.query(
          'SELECT id, email FROM users WHERE email = $1',
          [emp.email]
        );
        
        if (existing.rows.length > 0) {
          console.log(`  ⏭️  User already exists: ${emp.name} (${emp.email})`);
          empSkipCount++;
          continue;
        }
        
        // Insert employee
        const result = await client.query(
          `INSERT INTO users 
           (name, email, password, role, branch, phone, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW(), NOW())
           RETURNING id`,
          [emp.name, emp.email, hashedPassword, emp.role, emp.branch, emp.phone]
        );
        
        console.log(`  ✅ Added employee: ${emp.name} (ID: ${result.rows[0].id}, Branch: ${emp.branch})`);
        empSuccessCount++;
        
      } catch (err) {
        console.error(`  ❌ Error adding employee ${emp.name}:`, err.message);
      }
    }
    
    await client.query('COMMIT');
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 Summary:');
    console.log(`  🏢 Properties: ${Object.keys(propertyMap).length} available`);
    console.log(`  👥 Employees: ${empSuccessCount} added, ${empSkipCount} skipped`);
    console.log('='.repeat(70));
    
    if (empSuccessCount > 0) {
      console.log(`\n🔑 Default password for all new employees: ${DEFAULT_PASSWORD}`);
      console.log('⚠️  Employees should change their password on first login\n');
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Transaction rolled back:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

console.log('\n' + '='.repeat(70));
console.log('🚀 Adding Employees and Branches');
console.log('='.repeat(70));

addBranchesAndEmployees().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
