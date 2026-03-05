import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSetup() {
  let client;
  try {
    // Read SQL file
    const sqlPath = path.join(__dirname, 'create_email_notifications_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📧 Creating email notification tables...');
    
    // Get a client from pool
    client = await pool.connect();
    
    // Execute SQL
    await client.query(sql);
    
    console.log('✅ Email notification tables created successfully!');
    console.log('✅ Default templates inserted');
    console.log('✅ Default module settings configured');
    
    // Verify tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema='public' 
        AND table_name LIKE 'email%'
      ORDER BY table_name
    `);
    
    console.log('\n📋 Created tables:');
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Count default data
    const templateCount = await client.query('SELECT COUNT(*) FROM email_templates');
    const settingsCount = await client.query('SELECT COUNT(*) FROM email_module_settings');
    
    console.log(`\n📊 Default data:`);
    console.log(`  - ${templateCount.rows[0].count} templates`);
    console.log(`  - ${settingsCount.rows[0].count} module settings`);
    
  } catch (error) {
    console.error('❌ Error setting up email notifications:', error.message);
    throw error;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

runSetup();
