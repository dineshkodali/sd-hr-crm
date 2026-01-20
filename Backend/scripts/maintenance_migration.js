import pool from '../config/db.js';

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('--- RUNNING MAINTENANCE MIGRATION ---');

        // Add assigned_to if missing
        await client.query(`
      ALTER TABLE maintenance_tasks 
      ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(255)
    `);
        console.log('✅ assigned_to check complete');

        // Add priority if missing
        await client.query(`
      ALTER TABLE maintenance_tasks 
      ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'Medium'
    `);
        console.log('✅ priority check complete');

        // Add closed_date alias if missing (to support both closed and closed_date)
        await client.query(`
      ALTER TABLE maintenance_tasks 
      ADD COLUMN IF NOT EXISTS closed_date TIMESTAMP
    `);
        console.log('✅ closed_date check complete');

        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    } finally {
        client.release();
    }
}

migrate();
