// Small helper script to apply the create_move_ins_table.sql file against the configured DB
import fs from 'fs';
import path from 'path';
import pool from '../config/db.js';

async function run() {
  try {
    const sqlPath = path.join(process.cwd(), 'Backend', 'scripts', 'create_move_ins_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('Applying SQL from', sqlPath);
    await pool.query(sql);
    console.log('✅ move_ins table creation attempted (check output above for errors)');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to apply move_ins SQL:', err && err.stack ? err.stack : err);
    process.exit(2);
  }
}

run();
