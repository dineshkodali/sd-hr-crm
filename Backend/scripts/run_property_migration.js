import pool from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    console.log('🔄 Starting migration for Property Features...\n');

    try {
        const sqlPath = path.join(__dirname, 'add_property_features.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('🔌 Connecting to database...\n');
        await pool.query(sql);
        console.log('✅ Migration completed successfully!\n');

        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Migration failed!', error.message);
        await pool.end();
        process.exit(1);
    }
}

runMigration();
