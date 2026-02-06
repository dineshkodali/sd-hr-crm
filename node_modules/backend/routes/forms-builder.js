import express from 'express';
import pool from '../config/db.js';
import { protect } from '../middleware/auth.js';
import { checkPermission } from '../middleware/checkPermission.js';

const router = express.Router();

// Use 'protect' consistently instead of 'authenticateToken'
const authenticateToken = protect;

async function ensureColumnsMetaTableExists(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.forms_builder_column_meta (
      id SERIAL PRIMARY KEY,
      table_name VARCHAR(255) NOT NULL,
      column_name VARCHAR(255) NOT NULL,
      input_type VARCHAR(50) NOT NULL DEFAULT 'text',
      options JSONB NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (table_name, column_name)
    );
  `);
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_forms_builder_column_meta_table_col
     ON public.forms_builder_column_meta (table_name, column_name)`
  );
}

function normalizeOptionsToJson(options) {
  if (options === null || typeof options === 'undefined') return null;
  if (typeof options === 'string') {
    const trimmed = options.trim();
    if (!trimmed) return null;
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch (e) {
      return JSON.stringify(trimmed);
    }
  }
  return JSON.stringify(options);
}

// Field type to SQL type mapping
const getFieldSQLType = (fieldType) => {
  const typeMap = {
    text: 'VARCHAR(255)',
    textarea: 'TEXT',
    number: 'NUMERIC',
    email: 'VARCHAR(255)',
    date: 'DATE',
    datetime: 'TIMESTAMP',
    select: 'VARCHAR(255)',
    radio: 'VARCHAR(100)',
    checkbox: 'TEXT', // Store as JSON array
    file: 'VARCHAR(500)' // Store file path
  };
  return typeMap[fieldType] || 'TEXT';
};

// Generate CREATE TABLE SQL from form fields
const generateCreateTableSQL = (tableName, fields) => {
  // Sanitize table name - only allow alphanumeric and underscores
  const sanitizedTableName = tableName.replace(/[^a-z0-9_]/gi, '_').toLowerCase();

  // Filter out invalid fields (empty field_name or missing field_type)
  const validFields = fields.filter(field => {
    return field &&
      field.field_name &&
      String(field.field_name).trim() !== '' &&
      field.field_type;
  });

  if (validFields.length === 0) {
    throw new Error('At least one valid field with field_name and field_type is required');
  }

  const columns = validFields.map(field => {
    // Sanitize field name - only allow alphanumeric and underscores
    const sanitizedFieldName = String(field.field_name).replace(/[^a-z0-9_]/gi, '_').toLowerCase();

    // Ensure field name is not empty after sanitization
    if (!sanitizedFieldName || sanitizedFieldName.trim() === '') {
      throw new Error(`Invalid field name: "${field.field_name}"`);
    }

    const sqlType = getFieldSQLType(field.field_type);
    const notNull = field.required ? 'NOT NULL' : '';

    // Escape single quotes in default values
    let defaultValue = '';
    if (field.default_value !== undefined && field.default_value !== null && field.default_value !== '') {
      const escapedValue = String(field.default_value).replace(/'/g, "''");
      defaultValue = `DEFAULT '${escapedValue}'`;
    }

    return `${sanitizedFieldName} ${sqlType} ${notNull} ${defaultValue}`.trim();
  });

  return `
    CREATE TABLE IF NOT EXISTS public.${sanitizedTableName} (
      id SERIAL PRIMARY KEY,
      ${columns.join(',\n      ')},
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER REFERENCES users(id)
    );
  `;
};

// Generate ALTER TABLE SQL for field changes
const generateAlterTableSQL = (tableName, oldFields, newFields) => {
  const statements = [];

  // Sanitize table name
  const sanitizedTableName = tableName.replace(/[^a-z0-9_]/gi, '_').toLowerCase();

  // Ensure arrays
  if (!Array.isArray(oldFields)) oldFields = [];
  if (!Array.isArray(newFields)) newFields = [];

  // Sanitize field names for comparison
  const sanitizeFieldName = (name) => (name || '').replace(/[^a-z0-9_]/gi, '_').toLowerCase();

  const oldFieldNames = oldFields.map(f => sanitizeFieldName(f?.field_name));
  const newFieldNames = newFields.map(f => sanitizeFieldName(f?.field_name));

  const addedFields = newFields.filter(f => {
    if (!f || !f.field_name) return false;
    return !oldFieldNames.includes(sanitizeFieldName(f.field_name));
  });

  addedFields.forEach(field => {
    if (!field.field_name || !field.field_type) return;
    const sanitizedFieldName = sanitizeFieldName(field.field_name);
    const sqlType = getFieldSQLType(field.field_type);
    const notNull = field.required ? 'NOT NULL' : '';

    let defaultValue = '';
    if (field.default_value !== undefined && field.default_value !== null && field.default_value !== '') {
      const escapedValue = String(field.default_value).replace(/'/g, "''");
      defaultValue = `DEFAULT '${escapedValue}'`;
    }

    statements.push(`ALTER TABLE public.${sanitizedTableName} ADD COLUMN IF NOT EXISTS ${sanitizedFieldName} ${sqlType} ${notNull} ${defaultValue};`);
  });

  const removedFields = oldFields.filter(f => {
    if (!f || !f.field_name) return false;
    return !newFieldNames.includes(sanitizeFieldName(f.field_name));
  });

  removedFields.forEach(field => {
    const sanitizedFieldName = sanitizeFieldName(field.field_name);
    statements.push(`ALTER TABLE public.${sanitizedTableName} DROP COLUMN IF EXISTS ${sanitizedFieldName};`);
  });

  newFields.forEach(newField => {
    if (!newField || !newField.field_name) return;
    const sanitizedNewName = sanitizeFieldName(newField.field_name);
    const oldField = oldFields.find(f => sanitizeFieldName(f?.field_name) === sanitizedNewName);

    if (oldField && oldField.field_type !== newField.field_type) {
      const sqlType = getFieldSQLType(newField.field_type);
      statements.push(`ALTER TABLE public.${sanitizedTableName} ALTER COLUMN ${sanitizedNewName} TYPE ${sqlType} USING ${sanitizedNewName}::${sqlType};`);
    }
  });

  return statements;
};

// Helper function to ensure forms table exists
async function ensureFormsTableExists(client) {
  try {
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'forms'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      // Create forms table
      await client.query(`
        CREATE TABLE IF NOT EXISTS forms (
          form_id SERIAL PRIMARY KEY,
          form_name VARCHAR(255) NOT NULL,
          form_description TEXT,
          section VARCHAR(100) NOT NULL,
          table_name VARCHAR(255) NOT NULL UNIQUE,
          fields JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_by INTEGER REFERENCES users(id)
        );
      `);

      // Create form_migrations table
      await client.query(`
        CREATE TABLE IF NOT EXISTS form_migrations (
          migration_id SERIAL PRIMARY KEY,
          form_id INTEGER REFERENCES forms(form_id) ON DELETE CASCADE,
          action VARCHAR(50) NOT NULL,
          migration_sql TEXT NOT NULL,
          performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          performed_by INTEGER REFERENCES users(id),
          status VARCHAR(20) DEFAULT 'completed'
        );
      `);

      // Create indexes
      await client.query(`CREATE INDEX IF NOT EXISTS idx_forms_section ON forms(section);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_forms_table_name ON forms(table_name);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_forms_created_at ON forms(created_at DESC);`);
    }
  } catch (err) {
    console.error('Error ensuring forms table exists:', err);
    throw err;
  }
}

// ------------------- Routes -------------------

// Get all available database tables
router.get('/available-tables', authenticateToken, async (req, res) => {
  try {
    // Fetch all tables from public and maintenance schemas
    const tablesResult = await pool.query(`
      SELECT 
        table_schema,
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = t.table_schema AND table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema IN ('public', 'maintenance')
        AND table_type = 'BASE TABLE'
        AND table_name NOT IN ('forms', 'forms_master', 'form_migrations', 'users', 'sessions')
      ORDER BY table_schema ASC, table_name ASC
    `);
    const tables = tablesResult.rows.map(row => ({
      table_schema: row.table_schema,
      table_name: row.table_name,
      column_count: parseInt(row.column_count),
      display_name: row.table_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) + (row.table_schema !== 'public' ? ` (${row.table_schema})` : '')
    }));
    res.json({ tables });
  } catch (err) {
    console.error('Error fetching tables:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get table structure (columns) for a specific table
router.get('/table-structure/:tableName', authenticateToken, async (req, res) => {
  try {
    const { tableName } = req.params;

    // Fetch columns for the specified table from both public and maintenance schemas
    const columnsResult = await pool.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        table_schema
      FROM information_schema.columns
      WHERE table_name = $1 AND table_schema IN ('public', 'maintenance')
      ORDER BY table_schema ASC, ordinal_position ASC
    `, [tableName]);
    if (columnsResult.rows.length === 0) {
      return res.status(404).json({ error: 'Table not found' });
    }
    res.json({
      table_name: tableName,
      columns: columnsResult.rows
    });
  } catch (err) {
    console.error('Error fetching table structure:', err);
    res.status(500).json({ error: err.message });
  }
});

// Diagnostic route to check database tables
router.get('/debug/tables', authenticateToken, async (req, res) => {
  try {
    const tablesInfo = {};

    // Check forms table
    const formsCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'forms'
      );
    `);
    tablesInfo.formsTableExists = formsCheck.rows[0].exists;

    if (formsCheck.rows[0].exists) {
      const formsCount = await pool.query('SELECT COUNT(*) FROM forms');
      tablesInfo.formsCount = parseInt(formsCount.rows[0].count);
      const formsSample = await pool.query('SELECT form_id, form_name, section, table_name FROM forms LIMIT 3');
      tablesInfo.formsSample = formsSample.rows;
    }

    // Check forms_master table
    const masterCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'forms_master'
      );
    `);
    tablesInfo.formsMasterTableExists = masterCheck.rows[0].exists;

    if (masterCheck.rows[0].exists) {
      const masterCount = await pool.query('SELECT COUNT(*) FROM forms_master WHERE deleted = FALSE');
      tablesInfo.formsMasterCount = parseInt(masterCount.rows[0].count);
      const masterSample = await pool.query('SELECT id, form_id, form_name FROM forms_master WHERE deleted = FALSE LIMIT 3');
      tablesInfo.formsMasterSample = masterSample.rows;
    }

    res.json(tablesInfo);
  } catch (err) {
    console.error('Debug error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all forms (optional filter by section)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let allForms = [];

    // Check if forms table exists (form builder forms)
    const formsTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'forms'
      );
    `);

    // Fetch from forms table (form builder)
    if (formsTableCheck.rows[0].exists) {
      const { section } = req.query;
      let query = 'SELECT * FROM forms ORDER BY created_at DESC';
      let params = [];
      if (section) {
        query = 'SELECT * FROM forms WHERE section = $1 ORDER BY created_at DESC';
        params = [section];
      }
      const result = await pool.query(query, params);
      console.log(`Fetched ${result.rows.length} forms from 'forms' table`);
      allForms = allForms.concat(result.rows);
    }

    // Check if forms_master table exists (legacy forms)
    const formsMasterCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'forms_master'
      );
    `);

    // Fetch from forms_master table and convert to forms format
    if (formsMasterCheck.rows[0].exists) {
      const masterResult = await pool.query(
        'SELECT * FROM forms_master WHERE deleted = FALSE ORDER BY created_at DESC'
      );
      console.log(`Fetched ${masterResult.rows.length} forms from 'forms_master' table`);

      // Convert forms_master format to forms format
      const convertedForms = masterResult.rows.map(masterForm => {
        const schema = typeof masterForm.schema === 'string'
          ? JSON.parse(masterForm.schema)
          : masterForm.schema;

        // Convert schema fields to form builder fields format
        const fields = schema.fields ? schema.fields.map(f => ({
          field_name: f.name || f.field_name,
          field_label: f.label || f.field_label || f.name,
          field_type: f.type || f.field_type || 'text',
          required: f.required || false,
          options: f.options || [],
          placeholder: f.placeholder || '',
          default_value: f.defaultValue || f.default_value || ''
        })) : [];

        // Get description from schema or generate a helpful one
        const description = schema.description
          || schema.formDescription
          || `Form with ${fields.length} field${fields.length !== 1 ? 's' : ''} • Created: ${new Date(masterForm.created_at).toLocaleDateString()}`;

        return {
          form_id: masterForm.id,
          form_name: masterForm.form_name || schema.formName,
          form_description: description,
          section: 'operations_hub', // Default section for legacy forms
          table_name: `form_${masterForm.form_id}`,
          fields: fields,
          created_at: masterForm.created_at,
          updated_at: masterForm.updated_at,
          created_by: masterForm.created_by,
          is_legacy: true // Flag to identify legacy forms
        };
      });

      allForms = allForms.concat(convertedForms);
    }

    console.log(`Total forms returned: ${allForms.length}`);
    if (allForms.length > 0) {
      console.log('Sample form:', JSON.stringify(allForms[0], null, 2));
    }

    res.json({ forms: allForms });
  } catch (err) {
    console.error('Error fetching forms:', err);
    // Return empty array on error to prevent frontend crashes
    res.json({ forms: [] });
  }
});

// ========================
// TABLE MANAGEMENT ROUTES (must be before /:id route to avoid conflicts)
// ========================

// Get all tables in the database
router.get('/tables', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        table_schema,
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns 
         WHERE table_schema = t.table_schema AND table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema IN ('public', 'maintenance')
        AND table_type = 'BASE TABLE'
        AND table_name NOT LIKE 'pg_%'
        AND table_name NOT LIKE 'sql_%'
      ORDER BY table_schema ASC, table_name ASC
    `);
    res.json({ tables: result.rows });
  } catch (err) {
    console.error('Error fetching tables:', err);
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

// Get columns for a specific table
router.get('/tables/:tableName/columns', authenticateToken, async (req, res) => {
  try {
    const { tableName } = req.params;

    // Validate table name (alphanumeric and underscores only)
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }

    // Load metadata (input_type) if meta table exists
    let metaMap = new Map();
    try {
      const metaCheck = await pool.query(
        `SELECT EXISTS (
           SELECT FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = 'forms_builder_column_meta'
         ) AS exists`
      );
      if (metaCheck.rows?.[0]?.exists) {
        const metaRes = await pool.query(
          `SELECT column_name, input_type, options
           FROM public.forms_builder_column_meta
           WHERE table_name = $1`,
          [tableName]
        );
        metaMap = new Map((metaRes.rows || []).map(r => [String(r.column_name), r]));
      }
    } catch (e) {
      metaMap = new Map();
    }

    // Check if table exists in maintenance schema
    const { rows: maintenanceRows } = await pool.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable, column_default, ordinal_position, table_schema
      FROM information_schema.columns
      WHERE table_name = $1 AND table_schema = 'maintenance'
      ORDER BY ordinal_position
    `, [tableName]);
    if (maintenanceRows.length > 0) {
      const merged = maintenanceRows.map(c => {
        const m = metaMap.get(String(c.column_name));
        return { ...c, input_type: m?.input_type ?? 'text', input_options: m?.options ?? null };
      });
      return res.json({ columns: merged });
    }
    // Fallback to public schema
    const { rows: publicRows } = await pool.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable, column_default, ordinal_position, table_schema
      FROM information_schema.columns
      WHERE table_name = $1 AND table_schema = 'public'
      ORDER BY ordinal_position
    `, [tableName]);
    const merged = publicRows.map(c => {
      const m = metaMap.get(String(c.column_name));
      return { ...c, input_type: m?.input_type ?? 'text', input_options: m?.options ?? null };
    });
    return res.json({ columns: merged });
  } catch (err) {
    console.error('Error fetching columns:', err);
    res.status(500).json({ error: 'Failed to fetch columns' });
  }
});

// Add a new column to a table
router.post('/tables/:tableName/columns', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { tableName } = req.params;
    const { column_name, data_type, max_length, nullable, default_value, unique, input_type, input_options } = req.body;

    // Validate inputs
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(column_name)) {
      return res.status(400).json({ error: 'Invalid column name' });
    }

    await client.query('BEGIN');

    await ensureColumnsMetaTableExists(client);

    // Build ALTER TABLE query
    let columnDef = `${column_name} ${data_type}`;

    // Add length for VARCHAR/CHAR
    if ((data_type === 'VARCHAR' || data_type === 'CHAR') && max_length) {
      columnDef += `(${max_length})`;
    }

    // Add NULL/NOT NULL
    columnDef += nullable ? ' NULL' : ' NOT NULL';

    // Add default value
    if (default_value) {
      if (data_type === 'VARCHAR' || data_type === 'TEXT' || data_type === 'CHAR') {
        columnDef += ` DEFAULT '${default_value.replace(/'/g, "''")}'`;
      } else {
        columnDef += ` DEFAULT ${default_value}`;
      }
    } else if (!nullable) {
      // If NOT NULL and no default value provided, we MUST provide one for existing rows
      if (data_type === 'VARCHAR' || data_type === 'TEXT' || data_type === 'CHAR') {
        columnDef += ` DEFAULT ''`;
      } else if (['INTEGER', 'BIGINT', 'SMALLINT', 'NUMERIC', 'DECIMAL', 'REAL', 'DOUBLE PRECISION'].includes(data_type)) {
        columnDef += ` DEFAULT 0`;
      } else if (data_type === 'BOOLEAN') {
        columnDef += ` DEFAULT FALSE`;
      } else if (data_type === 'DATE' || data_type === 'TIMESTAMP') {
        columnDef += ` DEFAULT CURRENT_TIMESTAMP`;
      }
    }

    // Execute ALTER TABLE
    await client.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnDef}`);

    // Upsert metadata
    const inputType = (input_type && String(input_type).trim()) ? String(input_type).trim() : 'text';
    const options = normalizeOptionsToJson(input_options);
    await client.query(
      `INSERT INTO public.forms_builder_column_meta (table_name, column_name, input_type, options, updated_at)
       VALUES ($1,$2,$3,$4::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT (table_name, column_name)
       DO UPDATE SET input_type = EXCLUDED.input_type, options = EXCLUDED.options, updated_at = CURRENT_TIMESTAMP`,
      [tableName, column_name, inputType, options]
    );

    // Add unique constraint if requested
    if (unique) {
      await client.query(`ALTER TABLE ${tableName} ADD CONSTRAINT ${tableName}_${column_name}_unique UNIQUE (${column_name})`);
    }

    await client.query('COMMIT');
    res.json({ message: 'Column added successfully', column_name });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error adding column:', err);
    res.status(500).json({ error: err.message || 'Failed to add column' });
  } finally {
    client.release();
  }
});

// Update/Rename a column
router.put('/tables/:tableName/columns/:columnName', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { tableName, columnName } = req.params;
    const { new_column_name, data_type, max_length, nullable, default_value, input_type, input_options } = req.body;

    // Validate inputs
    if (!/^[a-zA-Z0-9_]+$/.test(tableName) || !/^[a-zA-Z0-9_]+$/.test(columnName)) {
      return res.status(400).json({ error: 'Invalid table or column name' });
    }

    // Validate new column name if provided
    if (new_column_name && !/^[a-zA-Z0-9_]+$/.test(new_column_name)) {
      return res.status(400).json({ error: 'Invalid new column name' });
    }

    await client.query('BEGIN');

    // Rename column if new name provided
    let currentColumnName = columnName;
    if (new_column_name && new_column_name !== columnName) {
      await client.query(`ALTER TABLE ${tableName} RENAME COLUMN ${columnName} TO ${new_column_name}`);
      currentColumnName = new_column_name;
    }

    // Change data type
    if (data_type) {
      let typeClause = data_type;
      if ((data_type === 'VARCHAR' || data_type === 'CHAR') && max_length) {
        typeClause += `(${max_length})`;
      }
      await client.query(`ALTER TABLE ${tableName} ALTER COLUMN ${currentColumnName} TYPE ${typeClause}`);
    }

    // Change nullable
    if (nullable !== undefined) {
      const nullClause = nullable ? 'DROP NOT NULL' : 'SET NOT NULL';
      await client.query(`ALTER TABLE ${tableName} ALTER COLUMN ${currentColumnName} ${nullClause}`);
    }

    // Change default value
    if (default_value !== undefined) {
      if (default_value === '' || default_value === null) {
        await client.query(`ALTER TABLE ${tableName} ALTER COLUMN ${currentColumnName} DROP DEFAULT`);
      } else {
        const defaultClause = (data_type === 'VARCHAR' || data_type === 'TEXT' || data_type === 'CHAR')
          ? `'${default_value.replace(/'/g, "''")}'`
          : default_value;
        await client.query(`ALTER TABLE ${tableName} ALTER COLUMN ${currentColumnName} SET DEFAULT ${defaultClause}`);
      }
    }

    await client.query('COMMIT');

    // Update metadata (best-effort)
    try {
      const inputType = (input_type && String(input_type).trim()) ? String(input_type).trim() : null;
      const options = normalizeOptionsToJson(input_options);
      if (inputType !== null || typeof input_options !== 'undefined') {
        await pool.query(
          `INSERT INTO public.forms_builder_column_meta (table_name, column_name, input_type, options, updated_at)
           VALUES ($1,$2,$3,$4::jsonb, CURRENT_TIMESTAMP)
           ON CONFLICT (table_name, column_name)
           DO UPDATE SET input_type = EXCLUDED.input_type, options = EXCLUDED.options, updated_at = CURRENT_TIMESTAMP`,
          [tableName, currentColumnName, inputType ?? 'text', options]
        );
      }
      if (currentColumnName !== columnName) {
        await pool.query(
          `UPDATE public.forms_builder_column_meta
           SET column_name = $1, updated_at = CURRENT_TIMESTAMP
           WHERE table_name = $2 AND column_name = $3`,
          [currentColumnName, tableName, columnName]
        );
      }
    } catch (e) {
      // ignore
    }
    res.json({ message: 'Column updated successfully', column_name: currentColumnName });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating column:', err);
    res.status(500).json({ error: err.message || 'Failed to update column' });
  } finally {
    client.release();
  }
});

// Delete a column from a table
router.delete('/tables/:tableName/columns/:columnName', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { tableName, columnName } = req.params;

    // Validate inputs
    if (!/^[a-zA-Z0-9_]+$/.test(tableName) || !/^[a-zA-Z0-9_]+$/.test(columnName)) {
      return res.status(400).json({ error: 'Invalid table or column name' });
    }

    await client.query('BEGIN');
    try {
      await ensureColumnsMetaTableExists(client);
      await client.query(
        `DELETE FROM public.forms_builder_column_meta WHERE table_name = $1 AND column_name = $2`,
        [tableName, columnName]
      );
    } catch (e) {
      // ignore
    }
    await client.query(`ALTER TABLE ${tableName} DROP COLUMN ${columnName}`);
    await client.query('COMMIT');

    res.json({ message: 'Column deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting column:', err);
    res.status(500).json({ error: err.message || 'Failed to delete column' });
  } finally {
    client.release();
  }
});

// Get single form by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Try forms table first
    let result = await pool.query('SELECT * FROM forms WHERE form_id = $1', [id]);

    if (result.rows.length > 0) {
      return res.json(result.rows[0]);
    }

    // Try forms_master table
    const masterResult = await pool.query(
      'SELECT * FROM forms_master WHERE id = $1 AND deleted = FALSE',
      [id]
    );

    if (masterResult.rows.length > 0) {
      const masterForm = masterResult.rows[0];
      const schema = typeof masterForm.schema === 'string'
        ? JSON.parse(masterForm.schema)
        : masterForm.schema;

      // Convert to forms format
      const fields = schema.fields ? schema.fields.map(f => ({
        field_name: f.name || f.field_name,
        field_label: f.label || f.field_label || f.name,
        field_type: f.type || f.field_type || 'text',
        required: f.required || false,
        options: f.options || [],
        placeholder: f.placeholder || '',
        default_value: f.defaultValue || f.default_value || ''
      })) : [];

      const description = schema.description
        || schema.formDescription
        || `Form with ${fields.length} field${fields.length !== 1 ? 's' : ''} • Created: ${new Date(masterForm.created_at).toLocaleDateString()}`;

      return res.json({
        form_id: masterForm.id,
        form_name: masterForm.form_name || schema.formName,
        form_description: description,
        section: 'operations_hub',
        table_name: `form_${masterForm.form_id}`,
        fields: fields,
        created_at: masterForm.created_at,
        updated_at: masterForm.updated_at,
        created_by: masterForm.created_by,
        is_legacy: true
      });
    }

    return res.status(404).json({ error: 'Form not found' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch form' });
  }
});

// Create form + table
router.post('/', authenticateToken, checkPermission('manage_forms'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ensure forms table exists
    await ensureFormsTableExists(client);

    const { form_name, form_description, section, table_name, fields } = req.body;
    if (!form_name || !section || !table_name || !fields || !Array.isArray(fields)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Missing required fields: form_name, section, table_name, and fields array are required' });
    }

    // Filter out invalid fields before validation
    const validFields = fields.filter(field => {
      return field &&
        field.field_name &&
        String(field.field_name).trim() !== '' &&
        field.field_type;
    });

    if (validFields.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'At least one valid field with field_name and field_type is required' });
    }

    const validSections = ['operations_hub', 'hse', 'safeguarding', 'complaints', 'incidents', 'inspections', 'training', 'compliance'];
    if (!validSections.includes(section)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid section' });
    }

    // Check if form with this table already exists
    const formCheck = await client.query('SELECT form_id FROM forms WHERE table_name = $1', [table_name]);
    if (formCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'A form is already mapped to this table' });
    }

    // Check if table exists in database
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
      );
    `, [table_name]);

    let createSQL = null;

    // Only create table if it doesn't exist
    if (!tableExists.rows[0].exists) {
      // Generate and execute CREATE TABLE SQL (use filtered validFields)
      try {
        createSQL = generateCreateTableSQL(table_name, validFields);
      } catch (sqlErr) {
        await client.query('ROLLBACK');
        console.error('Error generating CREATE TABLE SQL:', sqlErr);
        return res.status(400).json({ error: 'Invalid form configuration', details: sqlErr.message });
      }

      try {
        await client.query(createSQL);
        console.log(`Created new table: ${table_name}`);
      } catch (createErr) {
        await client.query('ROLLBACK');
        console.error('Error creating table:', createErr);
        console.error('SQL that failed:', createSQL);
        return res.status(500).json({ error: 'Failed to create table', details: createErr.message });
      }
    } else {
      console.log(`Mapping to existing table: ${table_name}`);
      createSQL = `-- Using existing table: ${table_name}`;
    }

    // Store only valid fields in the database
    // Handle synthetic admin or non-numeric user IDs
    const createdBy = (typeof req.user.id === 'number' || !isNaN(parseInt(req.user.id))) ? req.user.id : null;
    const formResult = await client.query(
      `INSERT INTO forms (form_name, form_description, section, table_name, fields, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [form_name, form_description, section, table_name, JSON.stringify(validFields), createdBy]
    );

    // Try to log migration, but don't fail if migration table doesn't exist
    try {
      await client.query(
        `INSERT INTO form_migrations (form_id, action, migration_sql, performed_by)
         VALUES ($1, 'CREATE', $2, $3)`,
        [formResult.rows[0].form_id, createSQL, createdBy]
      );
    } catch (migrationErr) {
      // Log but don't fail - migration table might not exist yet
      console.warn('Could not log migration:', migrationErr.message);
    }

    await client.query('COMMIT');
    res.status(201).json({ ...formResult.rows[0], table_created: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to create form', details: err.message });
  } finally {
    client.release();
  }
});

// Update form + table
router.put('/:id', authenticateToken, checkPermission('manage_forms'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ensure forms table exists
    await ensureFormsTableExists(client);

    const { id } = req.params;
    const { form_name, form_description, section, table_name, fields } = req.body;

    const existing = await client.query('SELECT * FROM forms WHERE form_id=$1', [id]);
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Form not found' });
    }

    const oldForm = existing.rows[0];
    // Parse fields if stored as JSON string
    let oldFields = oldForm.fields;
    if (typeof oldFields === 'string') {
      try {
        oldFields = JSON.parse(oldFields);
      } catch (e) {
        oldFields = [];
      }
    }
    if (!Array.isArray(oldFields)) oldFields = [];

    const alterSQLs = generateAlterTableSQL(table_name, oldFields, fields);
    for (const sql of alterSQLs) {
      if (sql && sql.trim()) {
        await client.query(sql);
      }
    }

    const updateRes = await client.query(
      `UPDATE forms SET form_name=$1, form_description=$2, section=$3, table_name=$4, fields=$5, updated_at=NOW() WHERE form_id=$6 RETURNING *`,
      [form_name, form_description, section, table_name, JSON.stringify(fields), id]
    );

    await client.query('COMMIT');
    res.json({ ...updateRes.rows[0], table_updated: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to update form', details: err.message });
  } finally {
    client.release();
  }
});

// Delete form + optional table drop
router.delete('/:id', authenticateToken, checkPermission('manage_forms'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ensure forms table exists
    await ensureFormsTableExists(client);

    const { id } = req.params;
    const { dropTable } = req.query;

    // Try to find in forms table first
    const formRes = await client.query('SELECT * FROM forms WHERE form_id=$1', [id]);

    if (formRes.rows.length > 0) {
      // Form found in forms table
      const form = formRes.rows[0];
      if (dropTable === 'true') {
        const sanitizedTableName = form.table_name.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
        await client.query(`DROP TABLE IF EXISTS public.${sanitizedTableName} CASCADE`);
      }
      await client.query('DELETE FROM forms WHERE form_id=$1', [id]);
      await client.query('COMMIT');
      return res.json({ message: 'Form deleted', table_dropped: dropTable === 'true' });
    }

    // Try forms_master table (legacy forms)
    const masterRes = await client.query('SELECT * FROM forms_master WHERE id=$1 AND deleted=FALSE', [id]);

    if (masterRes.rows.length > 0) {
      // Legacy form found
      const masterForm = masterRes.rows[0];
      if (dropTable === 'true') {
        const tableName = `form_${masterForm.form_id}`;
        await client.query(`DROP TABLE IF EXISTS public.${tableName} CASCADE`);
      }
      // Soft delete for legacy forms
      await client.query('UPDATE forms_master SET deleted=TRUE, updated_at=NOW() WHERE id=$1', [id]);
      await client.query('COMMIT');
      return res.json({ message: 'Legacy form deleted', table_dropped: dropTable === 'true' });
    }

    // Form not found in either table
    await client.query('ROLLBACK');
    return res.status(404).json({ error: 'Form not found' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to delete form' });
  } finally {
    client.release();
  }
});

export default router;
