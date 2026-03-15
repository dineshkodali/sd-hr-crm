import './load-env.js';
import pool from './config/db.js';

async function check() {
    try {
        console.log("Checking Inspections Attachments...");
        const inspAtts = await pool.query("SELECT COUNT(*) FROM public.inspections_attachments");
        console.log("Total inspections_attachments:", inspAtts.rows[0].count);

        const latestInsp = await pool.query("SELECT id, attachments FROM public.inspections ORDER BY created_at DESC LIMIT 5");
        console.log("Latest 5 Inspections:");
        latestInsp.rows.forEach(r => console.log(`ID: ${r.id}, Attachments: ${JSON.stringify(r.attachments)}`));

        console.log("\nChecking Incidents Attachments...");
        const incAtts = await pool.query("SELECT COUNT(*) FROM maintenance.incidents_attachments");
        console.log("Total incidents_attachments:", incAtts.rows[0].count);

        const latestInc = await pool.query("SELECT id, attachments FROM maintenance.incidents ORDER BY created_at DESC LIMIT 5");
        console.log("Latest 5 Incidents:");
        latestInc.rows.forEach(r => console.log(`ID: ${r.id}, Attachments: ${JSON.stringify(r.attachments)}`));

        console.log("\nChecking Schema for Inspections...");
        const inspCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'inspections'");
        console.log("Inspections columns:", inspCols.rows.map(c => `${c.column_name} (${c.data_type})`).join(", "));

        console.log("\nChecking Schema for Incidents...");
        const incCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'incidents'");
        console.log("Incidents columns:", incCols.rows.map(c => `${c.column_name} (${c.data_type})`).join(", "));

        process.exit(0);
    } catch (err) {
        console.error("DB Error:", err);
        process.exit(1);
    }
}

check();
