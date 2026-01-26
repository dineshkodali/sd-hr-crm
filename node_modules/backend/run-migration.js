// run-migration.js
// Script to add city and country columns to users table

import pool from './config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    console.log('🔄 Starting migration: Add city and country to users table...\n');

    try {
        // Read the SQL file
        const sqlPath = path.join(__dirname, 'scripts', 'add_city_country_to_users.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('📄 SQL script loaded from:', sqlPath);
        console.log('🔌 Connecting to database...\n');

        // Execute the migration
        const result = await pool.query(sql);

        console.log('✅ Migration completed successfully!\n');
        console.log('📊 Verifying columns...');

        // Verify the columns were added
        const verifyQuery = `
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'users' 
      AND column_name IN ('city', 'country')
      ORDER BY column_name;
    `;

        const verification = await pool.query(verifyQuery);

        if (verification.rows.length === 2) {
            console.log('\n✅ Columns verified:');
            verification.rows.forEach(row => {
                console.log(`   - ${row.column_name}: ${row.data_type}(${row.character_maximum_length})`);
            });
            console.log('\n🎉 Migration successful! City and country fields are now available.');
        } else {
            console.log('\n⚠️  Warning: Expected 2 columns but found', verification.rows.length);
        }

        await pool.end();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Migration failed!');
        console.error('Error:', error.message);

        if (error.code === 'ENOENT') {
            console.error('\n💡 Make sure the SQL file exists at: Backend/scripts/add_city_country_to_users.sql');
        } else if (error.code === '42P01') {
            console.error('\n💡 The users table does not exist. Please create it first.');
        } else if (error.code === '42701') {
            console.error('\n💡 Columns may already exist. This is safe to ignore.');
        }

        await pool.end();
        process.exit(1);
    }
}

// Run the migration
runMigration();
