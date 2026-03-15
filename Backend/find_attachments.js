import './load-env.js';
import pool from './config/db.js';

import fs from 'fs';

async function find() {
    let output = "";
    try {
        const inspe = await pool.query("SELECT id, attachments FROM inspections WHERE attachments IS NOT NULL AND jsonb_array_length(attachments) > 0");
        output += `Inspections with attachments: ${inspe.rows.length}\n`;
        inspe.rows.forEach(r => output += `  Insp ID: ${r.id}, Atts: ${JSON.stringify(r.attachments)}\n`);

        const inci = await pool.query("SELECT id, attachments FROM maintenance.incidents WHERE attachments IS NOT NULL AND jsonb_array_length(attachments) > 0");
        output += `Incidents with attachments: ${inci.rows.length}\n`;
        inci.rows.forEach(r => output += `  Inc ID: ${r.id}, Atts: ${JSON.stringify(r.attachments)}\n`);

        fs.writeFileSync('db_results.txt', output);
        process.exit(0);
    } catch (err) {
        fs.writeFileSync('db_results.txt', "Error: " + err.message);
        process.exit(1);
    }
}

find();
