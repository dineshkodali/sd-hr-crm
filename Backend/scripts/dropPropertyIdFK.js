// Script to drop the foreign key constraint on service_users.property_id
import poolImport from "../config/db.js";

const pool = poolImport && poolImport.default ? poolImport.default : poolImport;

async function dropPropertyIdFK() {
  try {
    if (!pool || typeof pool.query !== "function") {
      console.error("DB pool not found. Ensure ../config/db.js exports a pg Pool.");
      process.exit(1);
    }

    // First, check if the constraint exists
    const checkQuery = `
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'service_users'
        AND constraint_name = 'service_users_property_id_fkey'
        AND constraint_type = 'FOREIGN KEY'
    `;

    const checkResult = await pool.query(checkQuery);
    
    if (checkResult.rows.length === 0) {
      console.log("Foreign key constraint 'service_users_property_id_fkey' does not exist.");
      console.log("Checking for other property_id foreign key constraints...");
      
      // Check for any FK constraint on property_id
      const allFKsQuery = `
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'service_users'
          AND constraint_type = 'FOREIGN KEY'
          AND constraint_name LIKE '%property_id%'
      `;
      
      const allFKs = await pool.query(allFKsQuery);
      if (allFKs.rows.length > 0) {
        console.log("Found foreign key constraints on property_id:");
        allFKs.rows.forEach(row => console.log(`  - ${row.constraint_name}`));
        console.log("\nAttempting to drop all property_id foreign key constraints...");
        
        for (const row of allFKs.rows) {
          const dropQuery = `ALTER TABLE service_users DROP CONSTRAINT IF EXISTS ${row.constraint_name}`;
          await pool.query(dropQuery);
          console.log(`✓ Dropped constraint: ${row.constraint_name}`);
        }
      } else {
        console.log("No foreign key constraints found on property_id column.");
      }
    } else {
      // Drop the specific constraint
      const dropQuery = `ALTER TABLE service_users DROP CONSTRAINT IF EXISTS service_users_property_id_fkey`;
      await pool.query(dropQuery);
      console.log("✓ Successfully dropped foreign key constraint: service_users_property_id_fkey");
    }

    console.log("\nDone! The foreign key constraint has been removed.");
    process.exit(0);
  } catch (error) {
    console.error("Error dropping foreign key constraint:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

dropPropertyIdFK();

