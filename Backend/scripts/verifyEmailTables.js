import pool from '../config/db.js';

async function verify() {
  const client = await pool.connect();
  try {
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema='public' AND table_name LIKE 'email%'
      ORDER BY table_name
    `);
    
    console.log('✅ Email Tables:', tables.rows.map(r => r.table_name).join(', '));
    
    const templates = await client.query('SELECT COUNT(*) as count FROM email_templates');
    const logs = await client.query('SELECT COUNT(*) as count FROM email_notifications_log');
    const settings = await client.query('SELECT COUNT(*) as count FROM email_module_settings');
    
    console.log(`✅ Templates: ${templates.rows[0].count}`);
    console.log(`✅ Logs: ${logs.rows[0].count}`);
    console.log(`✅ Settings: ${settings.rows[0].count}`);
  } finally {
    client.release();
    await pool.end();
  }
}

verify();
