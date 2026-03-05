import pool from './config/db.js';

async function checkCols() {
    try {
        const res = await pool.query(`
      SELECT table_schema, table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'maintenance_tasks' 
      OR table_name = 'tasks'
      ORDER BY table_name, ordinal_position
    `);
        console.log('MAINTENANCE_TASKS_COLUMNS:' + JSON.stringify(res.rows));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkCols();
