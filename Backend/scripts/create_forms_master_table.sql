-- Creates the forms_master table to store form schemas
-- Stores JSON schema with form id, name, and field definitions

CREATE TABLE IF NOT EXISTS forms_master (
  id SERIAL PRIMARY KEY,
  form_id VARCHAR(255) UNIQUE NOT NULL,
  form_name VARCHAR(255) NOT NULL,
  schema JSONB NOT NULL,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_forms_master_form_id ON forms_master(form_id);
CREATE INDEX IF NOT EXISTS idx_forms_master_deleted ON forms_master(deleted);
