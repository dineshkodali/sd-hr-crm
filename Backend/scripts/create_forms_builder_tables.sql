-- Create Forms table to store form definitions
CREATE TABLE IF NOT EXISTS forms (
  form_id SERIAL PRIMARY KEY,
  form_name VARCHAR(255) NOT NULL,
  form_description TEXT,
  section VARCHAR(100) NOT NULL,
  table_name VARCHAR(255) NOT NULL UNIQUE,
  fields JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  
  CONSTRAINT valid_section CHECK (section IN (
    'operations_hub',
    'hse',
    'safeguarding',
    'complaints',
    'incidents',
    'inspections',
    'training',
    'compliance'
  ))
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_forms_section ON forms(section);
CREATE INDEX IF NOT EXISTS idx_forms_table_name ON forms(table_name);
CREATE INDEX IF NOT EXISTS idx_forms_created_at ON forms(created_at DESC);

-- Create Form Migrations table to track all schema changes
CREATE TABLE IF NOT EXISTS form_migrations (
  migration_id SERIAL PRIMARY KEY,
  form_id INTEGER REFERENCES forms(form_id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- CREATE, ALTER_TABLE, DROP_TABLE, RENAME_TABLE
  migration_sql TEXT NOT NULL,
  performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  performed_by INTEGER REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'completed' -- completed, failed, rolled_back
);

-- Create index for migration history
CREATE INDEX IF NOT EXISTS idx_migrations_form_id ON form_migrations(form_id);
CREATE INDEX IF NOT EXISTS idx_migrations_performed_at ON form_migrations(performed_at DESC);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_forms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_forms_updated_at
BEFORE UPDATE ON forms
FOR EACH ROW
EXECUTE FUNCTION update_forms_updated_at();

-- Insert sample forms for testing (optional)
-- Uncomment to create example forms

/*
-- Example 1: Incident Report Form
INSERT INTO forms (form_name, form_description, section, table_name, fields, created_by)
VALUES (
  'Incident Report',
  'Report workplace incidents and accidents',
  'incidents',
  'incident_reports',
  '[
    {
      "field_name": "incident_date",
      "field_label": "Incident Date",
      "field_type": "datetime",
      "required": true,
      "placeholder": "When did the incident occur?",
      "default_value": ""
    },
    {
      "field_name": "incident_type",
      "field_label": "Incident Type",
      "field_type": "select",
      "required": true,
      "options": ["Injury", "Near Miss", "Property Damage", "Environmental", "Security"],
      "placeholder": "Select type",
      "default_value": ""
    },
    {
      "field_name": "severity",
      "field_label": "Severity Level",
      "field_type": "radio",
      "required": true,
      "options": ["Minor", "Moderate", "Major", "Critical"],
      "default_value": "Minor"
    },
    {
      "field_name": "location",
      "field_label": "Location",
      "field_type": "text",
      "required": true,
      "placeholder": "Where did it happen?",
      "default_value": ""
    },
    {
      "field_name": "description",
      "field_label": "Description",
      "field_type": "textarea",
      "required": true,
      "placeholder": "Describe what happened in detail...",
      "default_value": ""
    },
    {
      "field_name": "witnesses",
      "field_label": "Witnesses",
      "field_type": "textarea",
      "required": false,
      "placeholder": "List any witnesses",
      "default_value": ""
    },
    {
      "field_name": "immediate_action",
      "field_label": "Immediate Action Taken",
      "field_type": "textarea",
      "required": false,
      "placeholder": "What actions were taken immediately?",
      "default_value": ""
    },
    {
      "field_name": "medical_attention",
      "field_label": "Medical Attention Required",
      "field_type": "radio",
      "required": true,
      "options": ["Yes", "No"],
      "default_value": "No"
    }
  ]'::jsonb,
  1
);

-- Example 2: HSE Inspection Form
INSERT INTO forms (form_name, form_description, section, table_name, fields, created_by)
VALUES (
  'HSE Inspection Checklist',
  'Regular health, safety and environment inspection',
  'hse',
  'hse_inspections',
  '[
    {
      "field_name": "inspection_date",
      "field_label": "Inspection Date",
      "field_type": "date",
      "required": true,
      "placeholder": "",
      "default_value": ""
    },
    {
      "field_name": "inspector_name",
      "field_label": "Inspector Name",
      "field_type": "text",
      "required": true,
      "placeholder": "Full name",
      "default_value": ""
    },
    {
      "field_name": "area_inspected",
      "field_label": "Area Inspected",
      "field_type": "text",
      "required": true,
      "placeholder": "Location/Area",
      "default_value": ""
    },
    {
      "field_name": "fire_safety",
      "field_label": "Fire Safety",
      "field_type": "select",
      "required": true,
      "options": ["Satisfactory", "Minor Issues", "Major Issues", "Critical"],
      "default_value": "Satisfactory"
    },
    {
      "field_name": "emergency_exits",
      "field_label": "Emergency Exits Clear",
      "field_type": "radio",
      "required": true,
      "options": ["Yes", "No", "Partially"],
      "default_value": "Yes"
    },
    {
      "field_name": "ppe_available",
      "field_label": "PPE Available",
      "field_type": "checkbox",
      "required": false,
      "options": ["Hard Hats", "Safety Glasses", "Gloves", "Hi-Vis", "Safety Boots"],
      "default_value": ""
    },
    {
      "field_name": "findings",
      "field_label": "Inspection Findings",
      "field_type": "textarea",
      "required": true,
      "placeholder": "Detailed findings from inspection",
      "default_value": ""
    },
    {
      "field_name": "corrective_actions",
      "field_label": "Corrective Actions Required",
      "field_type": "textarea",
      "required": false,
      "placeholder": "List required actions",
      "default_value": ""
    },
    {
      "field_name": "follow_up_date",
      "field_label": "Follow-up Date",
      "field_type": "date",
      "required": false,
      "placeholder": "",
      "default_value": ""
    }
  ]'::jsonb,
  1
);

-- Example 3: Training Record Form
INSERT INTO forms (form_name, form_description, section, table_name, fields, created_by)
VALUES (
  'Training Record',
  'Track employee training and certifications',
  'training',
  'training_records',
  '[
    {
      "field_name": "employee_name",
      "field_label": "Employee Name",
      "field_type": "text",
      "required": true,
      "placeholder": "Full name",
      "default_value": ""
    },
    {
      "field_name": "employee_email",
      "field_label": "Employee Email",
      "field_type": "email",
      "required": true,
      "placeholder": "email@example.com",
      "default_value": ""
    },
    {
      "field_name": "training_title",
      "field_label": "Training Title",
      "field_type": "text",
      "required": true,
      "placeholder": "Name of training course",
      "default_value": ""
    },
    {
      "field_name": "training_type",
      "field_label": "Training Type",
      "field_type": "select",
      "required": true,
      "options": ["Mandatory", "Optional", "Refresher", "Certification", "On-the-Job"],
      "default_value": "Mandatory"
    },
    {
      "field_name": "training_date",
      "field_label": "Training Date",
      "field_type": "date",
      "required": true,
      "placeholder": "",
      "default_value": ""
    },
    {
      "field_name": "duration_hours",
      "field_label": "Duration (hours)",
      "field_type": "number",
      "required": true,
      "placeholder": "0",
      "default_value": ""
    },
    {
      "field_name": "trainer_name",
      "field_label": "Trainer Name",
      "field_type": "text",
      "required": false,
      "placeholder": "Name of trainer/instructor",
      "default_value": ""
    },
    {
      "field_name": "completion_status",
      "field_label": "Completion Status",
      "field_type": "radio",
      "required": true,
      "options": ["Completed", "In Progress", "Failed", "Cancelled"],
      "default_value": "Completed"
    },
    {
      "field_name": "score",
      "field_label": "Test Score (%)",
      "field_type": "number",
      "required": false,
      "placeholder": "0-100",
      "default_value": ""
    },
    {
      "field_name": "certificate_issued",
      "field_label": "Certificate Issued",
      "field_type": "radio",
      "required": false,
      "options": ["Yes", "No"],
      "default_value": "No"
    },
    {
      "field_name": "expiry_date",
      "field_label": "Certificate Expiry Date",
      "field_type": "date",
      "required": false,
      "placeholder": "",
      "default_value": ""
    },
    {
      "field_name": "notes",
      "field_label": "Additional Notes",
      "field_type": "textarea",
      "required": false,
      "placeholder": "Any additional information",
      "default_value": ""
    }
  ]'::jsonb,
  1
);
*/

-- View to see all forms with migration counts
CREATE OR REPLACE VIEW forms_with_stats AS
SELECT 
  f.*,
  COUNT(m.migration_id) as total_migrations,
  MAX(m.performed_at) as last_migration
FROM forms f
LEFT JOIN form_migrations m ON f.form_id = m.form_id
GROUP BY f.form_id;

-- Grant permissions (adjust as needed for your roles)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON forms TO admin_role;
-- GRANT SELECT ON forms TO user_role;
-- GRANT SELECT, INSERT ON form_migrations TO admin_role;
