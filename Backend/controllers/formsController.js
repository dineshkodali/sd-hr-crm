// controllers/formsController.js
import pool from "../config/db.js";

/**
 * Helper: convert field name to safe SQL column name
 * Replace special chars, ensure no reserved keywords
 */
function sanitizeColumnName(name) {
  // Replace non-alphanumeric with underscore, lowercase
  let col = String(name || "").toLowerCase().replace(/[^a-z0-9_]/g, "_");
  // Remove leading digits
  col = col.replace(/^(\d+)/, "_$1");
  // Limit length
  col = col.substring(0, 63);
  return col || "field";
}

/**
 * Helper: map field type to SQL data type
 */
function getColumnType(fieldType) {
  const typeMap = {
    text: "TEXT",
    email: "VARCHAR(255)",
    date: "DATE",
    select: "VARCHAR(255)",
    number: "NUMERIC",
    checkbox: "BOOLEAN",
    textarea: "TEXT",
  };
  return typeMap[fieldType] || "TEXT";
}

/**
 * POST /api/forms
 * Create a new form schema + auto-create the data table
 * Body: { formId, formName, fields: [{name, type, required}, ...] }
 */
export async function createForm(req, res) {
  const { formId, formName, fields } = req.body ?? {};
  const createdBy = req.user?.id ? String(req.user.id) : null;

  // Validation
  if (!formId || typeof formId !== "string" || !formId.trim()) {
    return res.status(400).json({ success: false, error: "formId is required" });
  }
  if (!formName || typeof formName !== "string" || !formName.trim()) {
    return res.status(400).json({ success: false, error: "formName is required" });
  }
  if (!Array.isArray(fields) || fields.length === 0) {
    return res.status(400).json({ success: false, error: "fields must be a non-empty array" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Check if form already exists
    const existingRes = await client.query(
      "SELECT id FROM forms_master WHERE form_id = $1 AND deleted = FALSE",
      [formId]
    );
    if (existingRes.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ success: false, error: "Form already exists" });
    }

    // 2. Store the schema in forms_master
    const schema = { formId, formName, fields };
    const insertRes = await client.query(
      `INSERT INTO forms_master (form_id, form_name, schema, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, form_id, form_name, created_at`,
      [formId, formName, JSON.stringify(schema), createdBy]
    );

    const formRecord = insertRes.rows[0];

    // 3. Create the data table for this form
    const tableName = `form_${formId}`;
    
    // Build columns list first
    let columnsSQL = `id SERIAL PRIMARY KEY,\n    created_at TIMESTAMP DEFAULT NOW(),\n    updated_at TIMESTAMP DEFAULT NOW()`;
    
    // Add columns from fields
    fields.forEach((f) => {
      const colName = sanitizeColumnName(f.name);
      const colType = getColumnType(f.type);
      const nullable = f.required ? "NOT NULL" : "NULL";
      columnsSQL += `,\n    ${colName} ${colType} ${nullable}`;
    });

    const createTableSQL = `CREATE TABLE IF NOT EXISTS ${tableName} (\n    ${columnsSQL}\n  );`;

    // Execute create table
    await client.query(createTableSQL);

    // 4. Commit transaction
    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Form created successfully",
      form: formRecord,
      tableName,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating form:", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
}

/**
 * GET /api/forms
 * List all forms
 */
export async function listForms(req, res) {
  try {
    const result = await pool.query(
      "SELECT id, form_id, form_name, created_at, updated_at FROM forms_master WHERE deleted = FALSE ORDER BY created_at DESC"
    );
    res.json({ success: true, forms: result.rows });
  } catch (err) {
    console.error("Error listing forms:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/forms/:formId
 * Get form schema by formId
 */
export async function getForm(req, res) {
  const { formId } = req.params;

  try {
    const result = await pool.query(
      "SELECT id, form_id, form_name, schema, created_at, updated_at FROM forms_master WHERE form_id = $1 AND deleted = FALSE",
      [formId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Form not found" });
    }

    const form = result.rows[0];
    res.json({ success: true, form });
  } catch (err) {
    console.error("Error fetching form:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/forms/:formId/submit
 * Submit form data (insert into form_${formId} table)
 */
export async function submitFormData(req, res) {
  const { formId } = req.params;
  const data = req.body ?? {};

  try {
    // 1. Get form schema
    const schemaRes = await pool.query(
      "SELECT schema FROM forms_master WHERE form_id = $1 AND deleted = FALSE",
      [formId]
    );

    if (schemaRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Form not found" });
    }

    const schema = schemaRes.rows[0].schema;
    const tableName = `form_${formId}`;

    // 2. Build INSERT statement
    const columns = ["created_at", "updated_at"];
    const values = [new Date(), new Date()];
    let paramIndex = 3;

    schema.fields.forEach((f) => {
      const colName = sanitizeColumnName(f.name);
      const value = data[f.name] ?? null;
      columns.push(colName);
      values.push(value);
    });

    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
    const insertSQL = `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders}) RETURNING *`;

    // 3. Insert data
    const insertRes = await pool.query(insertSQL, values);

    res.status(201).json({
      success: true,
      message: "Form submitted successfully",
      data: insertRes.rows[0],
    });
  } catch (err) {
    console.error("Error submitting form:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/forms/:formId/submissions
 * Fetch all submissions for a form
 */
export async function getSubmissions(req, res) {
  const { formId } = req.params;

  try {
    // Verify form exists
    const schemaRes = await pool.query(
      "SELECT schema FROM forms_master WHERE form_id = $1 AND deleted = FALSE",
      [formId]
    );

    if (schemaRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Form not found" });
    }

    const tableName = `form_${formId}`;

    // Fetch all submissions
    const result = await pool.query(`SELECT * FROM ${tableName} ORDER BY created_at DESC`);

    res.json({ success: true, submissions: result.rows });
  } catch (err) {
    console.error("Error fetching submissions:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * DELETE /api/forms/:formId
 * Soft delete a form (mark as deleted)
 */
export async function deleteForm(req, res) {
  const { formId } = req.params;

  try {
    const result = await pool.query(
      "UPDATE forms_master SET deleted = TRUE, updated_at = NOW() WHERE form_id = $1 AND deleted = FALSE RETURNING id",
      [formId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Form not found" });
    }

    res.json({ success: true, message: "Form deleted successfully" });
  } catch (err) {
    console.error("Error deleting form:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
