const pool = require('../config/db');

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Checking for assigned_to column in maintenance_tasks...');

        // Check if column exists
        const checkRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'maintenance_tasks' AND column_name = 'assigned_to'
    `);

        if (checkRes.rows.length === 0) {
            console.log('Adding assigned_to column...');
            await client.query(`
        ALTER TABLE maintenance_tasks 
        ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(255);
      `);
            console.log('Successfully added assigned_to column.');
        } else {
            console.log('assigned_to column already exists.');
        }

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        client.release();
        process.exit(0);
    }
}

migrate();
