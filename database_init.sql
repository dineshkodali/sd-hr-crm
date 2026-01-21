-- database_init.sql
-- Bootstrap schema for sd-hr-crm (PostgreSQL)
-- Run: psql -U <user> -d <db> -f database_init.sql

BEGIN;

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Schemas
CREATE SCHEMA IF NOT EXISTS maintenance;

-- NOTE: This file is intentionally generated in chunks.

/* -----------------------------
   Core tables
   ----------------------------- */

-- Users (required by many modules)
CREATE TABLE IF NOT EXISTS public.users (
  id SERIAL PRIMARY KEY,

  name VARCHAR(255),
  username VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),

  email VARCHAR(255) UNIQUE,
  password TEXT,

  role VARCHAR(50) DEFAULT 'staff',
  status VARCHAR(50) DEFAULT 'active',
  is_active BOOLEAN DEFAULT TRUE,

  branch VARCHAR(255),

  phone VARCHAR(50),
  phone_number VARCHAR(50),

  hotel_id INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,

  city VARCHAR(100),
  country VARCHAR(100),

  authenticator_secret VARCHAR(255),
  authenticator_enabled BOOLEAN DEFAULT FALSE,
  backup_codes TEXT[]
);

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_authenticator_enabled ON public.users(authenticator_enabled);
CREATE INDEX IF NOT EXISTS idx_users_city ON public.users(city);
CREATE INDEX IF NOT EXISTS idx_users_country ON public.users(country);

-- Hotels
CREATE TABLE IF NOT EXISTS public.hotels (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  phone VARCHAR(50),
  rating NUMERIC,
  manager_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  branch VARCHAR(255),

  property_type VARCHAR(100),
  status VARCHAR(100),
  postcode VARCHAR(50),
  total_beds INTEGER DEFAULT 0,
  occupied_beds INTEGER DEFAULT 0,
  total_floors INTEGER,
  is_self_contained BOOLEAN,
  description TEXT,
  logo_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hotels_name ON public.hotels(name);
CREATE INDEX IF NOT EXISTS idx_hotels_manager_id ON public.hotels(manager_id);

-- Optional compatibility table: properties
CREATE TABLE IF NOT EXISTS public.properties (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100),
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  branch_id INTEGER
);

CREATE INDEX IF NOT EXISTS idx_properties_name ON public.properties(name);

-- Rooms
CREATE TABLE IF NOT EXISTS public.rooms (
  id SERIAL PRIMARY KEY,
  hotel_id INTEGER REFERENCES public.properties(id) ON DELETE CASCADE,
  room_number VARCHAR(50),
  type VARCHAR(100),
  rate NUMERIC,
  status VARCHAR(50) DEFAULT 'available',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rooms_hotel_id ON public.rooms(hotel_id);
CREATE INDEX IF NOT EXISTS idx_rooms_room_number ON public.rooms(room_number);

-- Hotel access mapping
CREATE TABLE IF NOT EXISTS public.hotel_access (
  hotel_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (hotel_id, user_id)
);

/* -----------------------------
   Service Users
   ----------------------------- */

CREATE TABLE IF NOT EXISTS public.service_users (
  id SERIAL PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  dob DATE,
  date_of_birth DATE,
  nationality TEXT,
  home_office_reference TEXT,
  gender TEXT,
  immigration_status TEXT,
  family_type TEXT,
  number_of_dependents INTEGER,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  vulnerabilities TEXT,
  medical_conditions TEXT,
  dietary_requirements TEXT,
  status TEXT DEFAULT 'Active',
  property_id INTEGER,
  hotel_id INTEGER,
  accommodation_id INTEGER,
  room_id INTEGER,
  room_number TEXT,
  room TEXT,
  admission_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_users_property_id ON public.service_users(property_id);
CREATE INDEX IF NOT EXISTS idx_service_users_hotel_id ON public.service_users(hotel_id);

/* -----------------------------
   Auth / Security
   ----------------------------- */

CREATE TABLE IF NOT EXISTS public.authenticator_devices (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  device_name VARCHAR(255) NOT NULL,
  device_type VARCHAR(50),
  device_fingerprint VARCHAR(500),
  secret VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_authenticator_devices_user_id ON public.authenticator_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_authenticator_devices_active ON public.authenticator_devices(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_authenticator_devices_last_used ON public.authenticator_devices(last_used_at);

CREATE TABLE IF NOT EXISTS public.user_otps (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES public.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  otp_code VARCHAR(6) NOT NULL,
  otp_type VARCHAR(50) NOT NULL DEFAULT 'login',
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_otps_email ON public.user_otps(email);
CREATE INDEX IF NOT EXISTS idx_user_otps_code ON public.user_otps(otp_code);
CREATE INDEX IF NOT EXISTS idx_user_otps_expires ON public.user_otps(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_otps_used ON public.user_otps(used);

CREATE TABLE IF NOT EXISTS public.auth_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_token VARCHAR(500),
  login_method VARCHAR(50),
  device_id INTEGER REFERENCES public.authenticator_devices(id) ON DELETE SET NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  browser VARCHAR(100),
  os VARCHAR(100),
  device_type VARCHAR(50),
  login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  logout_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON public.auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_is_active ON public.auth_sessions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_login_at ON public.auth_sessions(login_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_device_id ON public.auth_sessions(device_id);

CREATE TABLE IF NOT EXISTS public.login_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES public.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  success BOOLEAN NOT NULL,
  login_method VARCHAR(50),
  device_id INTEGER REFERENCES public.authenticator_devices(id) ON DELETE SET NULL,
  failure_reason VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  browser VARCHAR(100),
  os VARCHAR(100),
  device_type VARCHAR(50),
  attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_login_logs_user_id ON public.login_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_email ON public.login_logs(email);
CREATE INDEX IF NOT EXISTS idx_login_logs_success ON public.login_logs(success);
CREATE INDEX IF NOT EXISTS idx_login_logs_attempted_at ON public.login_logs(attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_logs_device_id ON public.login_logs(device_id);

/* -----------------------------
   Activity logs
   ----------------------------- */

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  resource VARCHAR(100),
  resource_id INTEGER,
  description TEXT,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  browser VARCHAR(100),
  os VARCHAR(100),
  device_type VARCHAR(50),
  status VARCHAR(20) DEFAULT 'success',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON public.activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_type ON public.activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_resource ON public.activity_logs(resource);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created ON public.activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_action_date ON public.activity_logs(user_id, action, created_at DESC);

/* -----------------------------
   Permissions / Roles / Groups
   ----------------------------- */

CREATE TABLE IF NOT EXISTS public.permission_groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.group_permissions (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES public.permission_groups(id) ON DELETE CASCADE,
  module VARCHAR(50) NOT NULL,
  can_read BOOLEAN NOT NULL DEFAULT FALSE,
  can_create BOOLEAN NOT NULL DEFAULT FALSE,
  can_update BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(group_id, module)
);

CREATE TABLE IF NOT EXISTS public.user_groups (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES public.permission_groups(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, group_id)
);

CREATE TABLE IF NOT EXISTS public.permission_roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  level VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id SERIAL PRIMARY KEY,
  role_id INTEGER NOT NULL REFERENCES public.permission_roles(id) ON DELETE CASCADE,
  module VARCHAR(50) NOT NULL,
  can_read BOOLEAN NOT NULL DEFAULT FALSE,
  can_create BOOLEAN NOT NULL DEFAULT FALSE,
  can_update BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(role_id, module)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES public.permission_roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_group_permissions_group_module ON public.group_permissions(group_id, module);
CREATE INDEX IF NOT EXISTS idx_user_groups_user ON public.user_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_group ON public.user_groups(group_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_module ON public.role_permissions(role_id, module);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role_id);

CREATE TABLE IF NOT EXISTS public.user_permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  module VARCHAR(50) NOT NULL,
  can_read BOOLEAN NOT NULL DEFAULT FALSE,
  can_create BOOLEAN NOT NULL DEFAULT FALSE,
  can_update BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(user_id, module)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_module ON public.user_permissions(user_id, module);

INSERT INTO public.permission_roles (name, description, level) VALUES
('Viewer', 'Read-only access to all modules', 'view'),
('Editor', 'Can view and edit most modules', 'edit'),
('Manager', 'Full access to operational modules', 'full'),
('Administrator', 'Complete system access', 'full')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.permission_groups (name, description) VALUES
('Operations Team', 'Access to operational modules like inspections, incidents, maintenance'),
('HSE Team', 'Access to Health, Safety & Environment modules'),
('Safeguarding Team', 'Access to safeguarding and case management modules'),
('HR Team', 'Access to HR, payroll, and employee management')
ON CONFLICT (name) DO NOTHING;

/* -----------------------------
   Forms Builder
   ----------------------------- */

CREATE TABLE IF NOT EXISTS public.forms (
  form_id SERIAL PRIMARY KEY,
  form_name VARCHAR(255) NOT NULL,
  form_description TEXT,
  section VARCHAR(100) NOT NULL,
  table_name VARCHAR(255) NOT NULL UNIQUE,
  fields JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES public.users(id),
  CONSTRAINT valid_section CHECK (section IN (
    'operations_hub','hse','safeguarding','complaints','incidents','inspections','training','compliance'
  ))
);

CREATE INDEX IF NOT EXISTS idx_forms_section ON public.forms(section);
CREATE INDEX IF NOT EXISTS idx_forms_table_name ON public.forms(table_name);
CREATE INDEX IF NOT EXISTS idx_forms_created_at ON public.forms(created_at DESC);

CREATE TABLE IF NOT EXISTS public.form_migrations (
  migration_id SERIAL PRIMARY KEY,
  form_id INTEGER REFERENCES public.forms(form_id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  migration_sql TEXT NOT NULL,
  performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  performed_by INTEGER REFERENCES public.users(id),
  status VARCHAR(20) DEFAULT 'completed'
);

CREATE INDEX IF NOT EXISTS idx_migrations_form_id ON public.form_migrations(form_id);
CREATE INDEX IF NOT EXISTS idx_migrations_performed_at ON public.form_migrations(performed_at DESC);

CREATE OR REPLACE FUNCTION public.update_forms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_forms_updated_at ON public.forms;
CREATE TRIGGER trigger_update_forms_updated_at
BEFORE UPDATE ON public.forms
FOR EACH ROW
EXECUTE FUNCTION public.update_forms_updated_at();

CREATE OR REPLACE VIEW public.forms_with_stats AS
SELECT 
  f.*,
  COUNT(m.migration_id) as total_migrations,
  MAX(m.performed_at) as last_migration
FROM public.forms f
LEFT JOIN public.form_migrations m ON f.form_id = m.form_id
GROUP BY f.form_id;

CREATE TABLE IF NOT EXISTS public.forms_master (
  id SERIAL PRIMARY KEY,
  form_id VARCHAR(255) UNIQUE NOT NULL,
  form_name VARCHAR(255) NOT NULL,
  schema JSONB NOT NULL,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_forms_master_form_id ON public.forms_master(form_id);
CREATE INDEX IF NOT EXISTS idx_forms_master_deleted ON public.forms_master(deleted);

/* -----------------------------
   Operations: Incidents / Inspections / Complaints / etc
   ----------------------------- */

-- Incidents (maintenance schema; created at runtime in routes)
CREATE TABLE IF NOT EXISTS maintenance.incidents (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(255) UNIQUE NOT NULL,
  type VARCHAR(255) NOT NULL,
  severity VARCHAR(50) DEFAULT 'Medium',
  property_id INTEGER,
  property_name VARCHAR(255),
  service_user_id INTEGER,
  description TEXT,
  reported_by VARCHAR(255),
  reported_date DATE,
  assigned_to VARCHAR(255),
  status VARCHAR(50) DEFAULT 'Open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON maintenance.incidents(status);

-- Inspections
CREATE TABLE IF NOT EXISTS public.inspections (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(255) UNIQUE NOT NULL,
  inspection_type VARCHAR(255) NOT NULL,
  property INTEGER,
  service_user INTEGER,
  inspector_name VARCHAR(255) NOT NULL,
  inspection_date DATE NOT NULL,
  findings TEXT,
  issues_found INTEGER DEFAULT 0,
  action_required BOOLEAN DEFAULT FALSE,
  status VARCHAR(50) DEFAULT 'pending',
  priority VARCHAR(50) DEFAULT 'Medium',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inspections_status ON public.inspections(status);
CREATE INDEX IF NOT EXISTS idx_inspections_inspection_date ON public.inspections(inspection_date);

-- Complaints
CREATE TABLE IF NOT EXISTS public.complaints (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  priority VARCHAR(50) DEFAULT 'medium',
  property_id INTEGER,
  property_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'open',
  reported_by VARCHAR(255),
  reported_date DATE,
  assigned_to VARCHAR(255),
  scheduled_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_priority ON public.complaints(priority);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON public.complaints(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_property_id ON public.complaints(property_id);

-- Case management
CREATE TABLE IF NOT EXISTS public.case_management (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  priority VARCHAR(50) DEFAULT 'medium',
  property_id INTEGER,
  property_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'open',
  assigned_to VARCHAR(255),
  reported_by VARCHAR(255),
  reported_date DATE,
  scheduled_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_case_status ON public.case_management(status);
CREATE INDEX IF NOT EXISTS idx_case_priority ON public.case_management(priority);
CREATE INDEX IF NOT EXISTS idx_case_created_at ON public.case_management(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_property ON public.case_management(property_id);

-- Multi-agency
CREATE TABLE IF NOT EXISTS public.multi_agency (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  property_id INTEGER,
  property_name VARCHAR(255),
  category VARCHAR(100),
  priority VARCHAR(20) DEFAULT 'Medium',
  assigned_to VARCHAR(255),
  reported_by VARCHAR(255),
  scheduled_date DATE,
  status VARCHAR(50) DEFAULT 'New',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_multi_agency_property_id ON public.multi_agency(property_id);
CREATE INDEX IF NOT EXISTS idx_multi_agency_status ON public.multi_agency(status);
CREATE INDEX IF NOT EXISTS idx_multi_agency_priority ON public.multi_agency(priority);
CREATE INDEX IF NOT EXISTS idx_multi_agency_created_at ON public.multi_agency(created_at DESC);

/* -----------------------------
   HSE modules
   ----------------------------- */

CREATE TABLE IF NOT EXISTS public.hse_incidents (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(60) UNIQUE NOT NULL,
  incident_type VARCHAR(150) NOT NULL,
  severity VARCHAR(20) DEFAULT 'Medium',
  property_id INTEGER,
  property_name VARCHAR(255),
  affected_person VARCHAR(255),
  reported_by VARCHAR(255),
  details TEXT,
  assigned_investigator VARCHAR(255),
  status VARCHAR(50) DEFAULT 'Open',
  incident_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hse_incidents_property_id ON public.hse_incidents(property_id);
CREATE INDEX IF NOT EXISTS idx_hse_incidents_status ON public.hse_incidents(status);
CREATE INDEX IF NOT EXISTS idx_hse_incidents_severity ON public.hse_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_hse_incidents_created_at ON public.hse_incidents(created_at DESC);

CREATE TABLE IF NOT EXISTS public.hse_audits (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(80) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  property_id INTEGER,
  property_name VARCHAR(255),
  category VARCHAR(120),
  priority VARCHAR(40) DEFAULT 'Medium',
  reported_by VARCHAR(255),
  assigned_to VARCHAR(255),
  scheduled_date DATE,
  status VARCHAR(60) DEFAULT 'Open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hse_audits_property_id ON public.hse_audits(property_id);
CREATE INDEX IF NOT EXISTS idx_hse_audits_status ON public.hse_audits(status);
CREATE INDEX IF NOT EXISTS idx_hse_audits_priority ON public.hse_audits(priority);
CREATE INDEX IF NOT EXISTS idx_hse_audits_created_at ON public.hse_audits(created_at DESC);

CREATE TABLE IF NOT EXISTS public.hse_risk_management (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(80) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  property_id INTEGER,
  property_name VARCHAR(255),
  category VARCHAR(120),
  priority VARCHAR(40) DEFAULT 'Medium',
  reported_by VARCHAR(255),
  assigned_to VARCHAR(255),
  scheduled_date DATE,
  status VARCHAR(60) DEFAULT 'Open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hse_risk_property_id ON public.hse_risk_management(property_id);
CREATE INDEX IF NOT EXISTS idx_hse_risk_status ON public.hse_risk_management(status);
CREATE INDEX IF NOT EXISTS idx_hse_risk_priority ON public.hse_risk_management(priority);
CREATE INDEX IF NOT EXISTS idx_hse_risk_created_at ON public.hse_risk_management(created_at DESC);

CREATE TABLE IF NOT EXISTS public.hse_training (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(80) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  property_id INTEGER,
  property_name VARCHAR(255),
  category VARCHAR(120),
  priority VARCHAR(40) DEFAULT 'Medium',
  reported_by VARCHAR(255),
  assigned_to VARCHAR(255),
  scheduled_date DATE,
  status VARCHAR(60) DEFAULT 'Open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hse_training_property_id ON public.hse_training(property_id);
CREATE INDEX IF NOT EXISTS idx_hse_training_status ON public.hse_training(status);
CREATE INDEX IF NOT EXISTS idx_hse_training_priority ON public.hse_training(priority);
CREATE INDEX IF NOT EXISTS idx_hse_training_created_at ON public.hse_training(created_at DESC);

-- Risk assessments
CREATE TABLE IF NOT EXISTS public.risk_assessments (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  property_id INTEGER,
  property_name VARCHAR(255),
  category VARCHAR(100),
  risk_level VARCHAR(20) DEFAULT 'Medium',
  assigned_to VARCHAR(255),
  reported_by VARCHAR(255),
  assessment_date DATE,
  status VARCHAR(50) DEFAULT 'New',
  findings TEXT,
  recommendations TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_assessments_property_id ON public.risk_assessments(property_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_status ON public.risk_assessments(status);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_risk_level ON public.risk_assessments(risk_level);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_created_at ON public.risk_assessments(created_at DESC);

-- Safeguarding referrals
CREATE TABLE IF NOT EXISTS public.safeguarding_referrals (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  property_id INTEGER,
  property_name VARCHAR(255),
  category VARCHAR(100),
  priority VARCHAR(20) DEFAULT 'Medium',
  assigned_to VARCHAR(255),
  reported_by VARCHAR(255),
  scheduled_date DATE,
  status VARCHAR(50) DEFAULT 'New',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_safeguarding_referrals_property_id ON public.safeguarding_referrals(property_id);
CREATE INDEX IF NOT EXISTS idx_safeguarding_referrals_status ON public.safeguarding_referrals(status);
CREATE INDEX IF NOT EXISTS idx_safeguarding_referrals_priority ON public.safeguarding_referrals(priority);
CREATE INDEX IF NOT EXISTS idx_safeguarding_referrals_created_at ON public.safeguarding_referrals(created_at DESC);

-- Vulnerable users
CREATE TABLE IF NOT EXISTS public.vulnerable_users (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  property_id INTEGER,
  property_name VARCHAR(255),
  category VARCHAR(100),
  priority VARCHAR(20) DEFAULT 'Medium',
  assigned_to VARCHAR(255),
  reported_by VARCHAR(255),
  scheduled_date DATE,
  status VARCHAR(50) DEFAULT 'New',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vulnerable_users_property_id ON public.vulnerable_users(property_id);
CREATE INDEX IF NOT EXISTS idx_vulnerable_users_status ON public.vulnerable_users(status);
CREATE INDEX IF NOT EXISTS idx_vulnerable_users_priority ON public.vulnerable_users(priority);
CREATE INDEX IF NOT EXISTS idx_vulnerable_users_created_at ON public.vulnerable_users(created_at DESC);

-- VCS organisations
CREATE TABLE IF NOT EXISTS public.vcs_organisations (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  priority VARCHAR(50) DEFAULT 'medium',
  property_id INTEGER,
  property_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'new',
  assigned_to VARCHAR(255),
  reported_by VARCHAR(255),
  reported_date DATE,
  scheduled_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vcs_status ON public.vcs_organisations(status);
CREATE INDEX IF NOT EXISTS idx_vcs_priority ON public.vcs_organisations(priority);
CREATE INDEX IF NOT EXISTS idx_vcs_created ON public.vcs_organisations(created_at);
CREATE INDEX IF NOT EXISTS idx_vcs_property ON public.vcs_organisations(property_id);

-- Litigation
CREATE TABLE IF NOT EXISTS public.litigation_tasks (
  id BIGSERIAL PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'open',
  assigned_to_id BIGINT,
  assigned_to_name TEXT,
  service_user_id BIGINT,
  property_id BIGINT,
  property_name TEXT,
  scheduled_date DATE,
  reported_by TEXT,
  category TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_litigation_property_id ON public.litigation_tasks(property_id);
CREATE INDEX IF NOT EXISTS idx_litigation_service_user_id ON public.litigation_tasks(service_user_id);
CREATE INDEX IF NOT EXISTS idx_litigation_status ON public.litigation_tasks(status);

/* -----------------------------
   Compliance (certificates)
   ----------------------------- */

CREATE TABLE IF NOT EXISTS public.certificates (
  id SERIAL PRIMARY KEY,
  certificate_type VARCHAR(255) NOT NULL,
  property_id TEXT,
  hotel_name TEXT,
  certificate_number VARCHAR(255),
  issue_date DATE,
  expiry_date DATE,
  issued_by TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  document_name TEXT,
  document_mime TEXT,
  document_data BYTEA,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certificates_expiry_date ON public.certificates(expiry_date);
CREATE INDEX IF NOT EXISTS idx_certificates_is_active ON public.certificates(is_active);
CREATE INDEX IF NOT EXISTS idx_certificates_property_id ON public.certificates(property_id);
CREATE INDEX IF NOT EXISTS idx_certificates_certificate_type ON public.certificates(certificate_type);

/* -----------------------------
   Maintenance tasks
   ----------------------------- */

CREATE TABLE IF NOT EXISTS maintenance.maintenance_tasks (
  id SERIAL PRIMARY KEY,
  title TEXT,
  description TEXT,
  start_date TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'Pending',
  category TEXT,
  site TEXT,
  room TEXT,
  raised_by TEXT,
  assigned_to TEXT,
  action TEXT,
  closed TIMESTAMPTZ,
  closed_date TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  priority VARCHAR(50) DEFAULT 'Medium'
);

CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_status ON maintenance.maintenance_tasks(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_created_at ON maintenance.maintenance_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_deleted ON maintenance.maintenance_tasks(deleted);

/* -----------------------------
   Org / Branch / Staff assignments
   ----------------------------- */

CREATE TABLE IF NOT EXISTS public.branches (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  address TEXT,
  manager_id INTEGER REFERENCES public.users(id),
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_branches_name ON public.branches(name);

CREATE TABLE IF NOT EXISTS public.property_staff (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_property_staff_property ON public.property_staff(property_id);
CREATE INDEX IF NOT EXISTS idx_property_staff_user ON public.property_staff(user_id);
CREATE INDEX IF NOT EXISTS idx_property_staff_role ON public.property_staff(role);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'branch_id'
  ) THEN
    ALTER TABLE public.properties ADD COLUMN branch_id INTEGER REFERENCES public.branches(id);
    CREATE INDEX IF NOT EXISTS idx_properties_branch ON public.properties(branch_id);
  END IF;
END $$;

INSERT INTO public.branches (name, code, address) VALUES
  ('London Branch', 'LON', 'London, UK'),
  ('Manchester Branch', 'MAN', 'Manchester, UK'),
  ('Birmingham Branch', 'BIR', 'Birmingham, UK')
ON CONFLICT (name) DO NOTHING;

/* -----------------------------
   Move-ins / Move-outs
   ----------------------------- */

CREATE TABLE IF NOT EXISTS maintenance.move_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_user_id TEXT,
  service_user_name TEXT,
  property_id TEXT,
  property_name TEXT,
  room_id TEXT,
  room_name TEXT,
  bedspace_id TEXT,
  bedspace_name TEXT,
  move_in_date DATE,
  checklist JSONB,
  notes TEXT,
  signature TEXT,
  metadata JSONB,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS move_ins_service_user_idx ON maintenance.move_ins(service_user_id);
CREATE INDEX IF NOT EXISTS move_ins_property_idx ON maintenance.move_ins(property_id);

CREATE TABLE IF NOT EXISTS maintenance.move_outs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_user_id TEXT,
  service_user_name TEXT,
  move_out_date DATE,
  checklist JSONB,
  notes TEXT,
  signature TEXT,
  metadata JSONB,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS move_outs_service_user_idx ON maintenance.move_outs(service_user_id);

/* -----------------------------
   Email notifications
   ----------------------------- */

CREATE TABLE IF NOT EXISTS public.email_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  module VARCHAR(100) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  description TEXT,
  variables JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  is_system BOOLEAN DEFAULT FALSE,
  created_by INTEGER REFERENCES public.users(id),
  updated_by INTEGER REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.email_notifications_log (
  id SERIAL PRIMARY KEY,
  template_id INTEGER REFERENCES public.email_templates(id) ON DELETE SET NULL,
  module VARCHAR(100),
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.email_module_settings (
  id SERIAL PRIMARY KEY,
  module VARCHAR(100) NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT TRUE,
  notify_on_create BOOLEAN DEFAULT FALSE,
  notify_on_update BOOLEAN DEFAULT FALSE,
  notify_on_delete BOOLEAN DEFAULT FALSE,
  notify_on_status_change BOOLEAN DEFAULT TRUE,
  notify_roles JSONB,
  notify_users JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_templates_module ON public.email_templates(module);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON public.email_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_email_notifications_status ON public.email_notifications_log(status);
CREATE INDEX IF NOT EXISTS idx_email_notifications_recipient ON public.email_notifications_log(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_notifications_created ON public.email_notifications_log(created_at);

INSERT INTO public.email_templates (name, module, subject, body, description, variables, is_system, is_active) VALUES
('New Litigation Case', 'litigation', 'New Litigation Case Created: {case_reference}',
'<html><body><h2>New Litigation Case</h2><p>Dear {recipient_name},</p><p>A new litigation case has been created:</p><ul><li><strong>Reference:</strong> {case_reference}</li><li><strong>Title:</strong> {case_title}</li><li><strong>Priority:</strong> {priority}</li><li><strong>Status:</strong> {status}</li><li><strong>Created By:</strong> {created_by}</li></ul><p>Please review the case details in the system.</p><p>Best regards,<br/>System Administrator</p></body></html>',
'Notification sent when a new litigation case is created',
'{"case_reference": "Case reference number", "case_title": "Case title", "priority": "Case priority", "status": "Case status", "created_by": "User who created the case", "recipient_name": "Recipient name"}'::jsonb,
TRUE, TRUE),

('Maintenance Request Created', 'maintenance', 'New Maintenance Request: {request_id}',
'<html><body><h2>Maintenance Request</h2><p>Dear {recipient_name},</p><p>A new maintenance request has been submitted:</p><ul><li><strong>Request ID:</strong> {request_id}</li><li><strong>Property:</strong> {property_name}</li><li><strong>Priority:</strong> {priority}</li><li><strong>Description:</strong> {description}</li></ul><p>Best regards,<br/>System Administrator</p></body></html>',
'Notification for new maintenance requests',
'{"request_id": "Request ID", "property_name": "Property name", "priority": "Priority level", "description": "Request description", "recipient_name": "Recipient name"}'::jsonb,
TRUE, TRUE),

('Incident Report Filed', 'incidents', 'New Incident Report: {incident_id}',
'<html><body><h2>Incident Report</h2><p>Dear {recipient_name},</p><p>An incident has been reported:</p><ul><li><strong>Incident ID:</strong> {incident_id}</li><li><strong>Type:</strong> {incident_type}</li><li><strong>Severity:</strong> {severity}</li><li><strong>Location:</strong> {location}</li><li><strong>Reported By:</strong> {reported_by}</li></ul><p>Immediate attention may be required.</p><p>Best regards,<br/>System Administrator</p></body></html>',
'Notification for incident reports',
'{"incident_id": "Incident ID", "incident_type": "Type of incident", "severity": "Severity level", "location": "Incident location", "reported_by": "Reporter name", "recipient_name": "Recipient name"}'::jsonb,
TRUE, TRUE),

('HR Document Uploaded', 'hr', 'New HR Document: {document_name}',
'<html><body><h2>HR Document Notification</h2><p>Dear {recipient_name},</p><p>A new HR document has been uploaded:</p><ul><li><strong>Document:</strong> {document_name}</li><li><strong>Employee:</strong> {employee_name}</li><li><strong>Type:</strong> {document_type}</li></ul><p>Best regards,<br/>HR Department</p></body></html>',
'Notification for HR document uploads',
'{"document_name": "Document name", "employee_name": "Employee name", "document_type": "Document type", "recipient_name": "Recipient name"}'::jsonb,
TRUE, TRUE),

('Task Assigned', 'tasks', 'Task Assigned: {task_title}',
'<html><body><h2>Task Assignment</h2><p>Dear {recipient_name},</p><p>You have been assigned a new task:</p><ul><li><strong>Title:</strong> {task_title}</li><li><strong>Priority:</strong> {priority}</li><li><strong>Due Date:</strong> {due_date}</li><li><strong>Assigned By:</strong> {assigned_by}</li></ul><p>Please complete this task by the due date.</p><p>Best regards,<br/>System Administrator</p></body></html>',
'Notification for task assignments',
'{"task_title": "Task title", "priority": "Priority level", "due_date": "Due date", "assigned_by": "Assigner name", "recipient_name": "Recipient name"}'::jsonb,
TRUE, TRUE)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.email_module_settings (module, enabled, notify_on_create, notify_on_update, notify_on_status_change, notify_roles) VALUES
('litigation', TRUE, TRUE, FALSE, TRUE, '["admin", "manager"]'::jsonb),
('maintenance', TRUE, TRUE, FALSE, TRUE, '["admin", "manager"]'::jsonb),
('incidents', TRUE, TRUE, FALSE, TRUE, '["admin", "manager"]'::jsonb),
('hr', TRUE, TRUE, FALSE, FALSE, '["admin"]'::jsonb),
('tasks', TRUE, TRUE, FALSE, TRUE, '["admin", "manager"]'::jsonb),
('complaints', TRUE, TRUE, FALSE, TRUE, '["admin", "manager"]'::jsonb),
('safeguarding', TRUE, TRUE, TRUE, TRUE, '["admin", "manager"]'::jsonb)
ON CONFLICT (module) DO NOTHING;

/* -----------------------------
   HR / Payroll / Performance
   ----------------------------- */

-- Emergency protocols
CREATE TABLE IF NOT EXISTS public.emergency_protocols (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(255) NOT NULL UNIQUE,
  type VARCHAR(100) DEFAULT 'Emergency Protocols',
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority VARCHAR(50) DEFAULT 'Medium',
  status VARCHAR(50) DEFAULT 'Pending',
  assigned_to_id INTEGER,
  assigned_to_name VARCHAR(255),
  property_id INTEGER,
  property_name VARCHAR(255),
  reported_by VARCHAR(255),
  due_date DATE,
  scheduled_date DATE,
  completed_date TIMESTAMP,
  notes TEXT,
  category VARCHAR(100),
  created_by_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT fk_emergency_assigned_to FOREIGN KEY (assigned_to_id) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT fk_emergency_property FOREIGN KEY (property_id) REFERENCES public.hotels(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_emergency_protocols_status ON public.emergency_protocols(status);
CREATE INDEX IF NOT EXISTS idx_emergency_protocols_priority ON public.emergency_protocols(priority);
CREATE INDEX IF NOT EXISTS idx_emergency_protocols_property_id ON public.emergency_protocols(property_id);
CREATE INDEX IF NOT EXISTS idx_emergency_protocols_assigned_to_id ON public.emergency_protocols(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_emergency_protocols_due_date ON public.emergency_protocols(due_date);
CREATE INDEX IF NOT EXISTS idx_emergency_protocols_deleted ON public.emergency_protocols(deleted);

CREATE OR REPLACE FUNCTION public.update_emergency_protocols_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_emergency_protocols_updated_at ON public.emergency_protocols;
CREATE TRIGGER trigger_update_emergency_protocols_updated_at
BEFORE UPDATE ON public.emergency_protocols
FOR EACH ROW
EXECUTE FUNCTION public.update_emergency_protocols_updated_at();

-- Employee training
CREATE TABLE IF NOT EXISTS public.employee_training (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(255) NOT NULL UNIQUE,
  type VARCHAR(100) DEFAULT 'Employee Training',
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority VARCHAR(50) DEFAULT 'Medium',
  status VARCHAR(50) DEFAULT 'Pending',
  assigned_to_id INTEGER,
  assigned_to_name VARCHAR(255),
  property_id INTEGER,
  property_name VARCHAR(255),
  reported_by VARCHAR(255),
  due_date DATE,
  scheduled_date DATE,
  completed_date TIMESTAMP,
  notes TEXT,
  category VARCHAR(100),
  created_by_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT fk_emp_train_assigned_to FOREIGN KEY (assigned_to_id) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT fk_emp_train_property FOREIGN KEY (property_id) REFERENCES public.hotels(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_employee_training_status ON public.employee_training(status);
CREATE INDEX IF NOT EXISTS idx_employee_training_priority ON public.employee_training(priority);
CREATE INDEX IF NOT EXISTS idx_employee_training_property_id ON public.employee_training(property_id);
CREATE INDEX IF NOT EXISTS idx_employee_training_assigned_to_id ON public.employee_training(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_employee_training_due_date ON public.employee_training(due_date);
CREATE INDEX IF NOT EXISTS idx_employee_training_deleted ON public.employee_training(deleted);

CREATE OR REPLACE FUNCTION public.update_employee_training_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_employee_training_updated_at ON public.employee_training;
CREATE TRIGGER trigger_update_employee_training_updated_at
BEFORE UPDATE ON public.employee_training
FOR EACH ROW
EXECUTE FUNCTION public.update_employee_training_updated_at();

-- HR Management tasks
CREATE TABLE IF NOT EXISTS public.hr_management (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(255) NOT NULL UNIQUE,
  type VARCHAR(100) DEFAULT 'HR Management',
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority VARCHAR(50) DEFAULT 'Medium',
  status VARCHAR(50) DEFAULT 'Pending',
  assigned_to_id INTEGER,
  assigned_to_name VARCHAR(255),
  property_id INTEGER,
  property_name VARCHAR(255),
  reported_by VARCHAR(255),
  due_date DATE,
  scheduled_date DATE,
  completed_date TIMESTAMP,
  notes TEXT,
  category VARCHAR(100),
  created_by_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT fk_hr_assigned_to FOREIGN KEY (assigned_to_id) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT fk_hr_property FOREIGN KEY (property_id) REFERENCES public.hotels(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_hr_management_status ON public.hr_management(status);
CREATE INDEX IF NOT EXISTS idx_hr_management_priority ON public.hr_management(priority);
CREATE INDEX IF NOT EXISTS idx_hr_management_property_id ON public.hr_management(property_id);
CREATE INDEX IF NOT EXISTS idx_hr_management_assigned_to_id ON public.hr_management(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_hr_management_due_date ON public.hr_management(due_date);
CREATE INDEX IF NOT EXISTS idx_hr_management_deleted ON public.hr_management(deleted);

CREATE OR REPLACE FUNCTION public.update_hr_management_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_hr_management_updated_at ON public.hr_management;
CREATE TRIGGER trigger_update_hr_management_updated_at
BEFORE UPDATE ON public.hr_management
FOR EACH ROW
EXECUTE FUNCTION public.update_hr_management_updated_at();

-- Payroll tasks
CREATE TABLE IF NOT EXISTS public.payroll_tasks (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(255) NOT NULL UNIQUE,
  type VARCHAR(100) DEFAULT 'Payroll',
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority VARCHAR(50) DEFAULT 'Medium',
  status VARCHAR(50) DEFAULT 'Pending',
  assigned_to_id INTEGER,
  assigned_to_name VARCHAR(255),
  property_id INTEGER,
  property_name VARCHAR(255),
  reported_by VARCHAR(255),
  due_date DATE,
  scheduled_date DATE,
  completed_date TIMESTAMP,
  notes TEXT,
  category VARCHAR(100),
  created_by_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT fk_payroll_assigned_to FOREIGN KEY (assigned_to_id) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT fk_payroll_property FOREIGN KEY (property_id) REFERENCES public.hotels(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payroll_tasks_status ON public.payroll_tasks(status);
CREATE INDEX IF NOT EXISTS idx_payroll_tasks_priority ON public.payroll_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_payroll_tasks_property_id ON public.payroll_tasks(property_id);
CREATE INDEX IF NOT EXISTS idx_payroll_tasks_assigned_to_id ON public.payroll_tasks(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_payroll_tasks_due_date ON public.payroll_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_payroll_tasks_deleted ON public.payroll_tasks(deleted);

CREATE OR REPLACE FUNCTION public.update_payroll_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_payroll_tasks_updated_at ON public.payroll_tasks;
CREATE TRIGGER trigger_update_payroll_tasks_updated_at
BEFORE UPDATE ON public.payroll_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_payroll_tasks_updated_at();

-- Performance management
CREATE TABLE IF NOT EXISTS public.performance_management (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(255) NOT NULL UNIQUE,
  type VARCHAR(100) DEFAULT 'Performance Management',
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority VARCHAR(50) DEFAULT 'Medium',
  status VARCHAR(50) DEFAULT 'Pending',
  assigned_to_id INTEGER,
  assigned_to_name VARCHAR(255),
  property_id INTEGER,
  property_name VARCHAR(255),
  reported_by VARCHAR(255),
  due_date DATE,
  scheduled_date DATE,
  completed_date TIMESTAMP,
  notes TEXT,
  category VARCHAR(100),
  created_by_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT fk_perf_assigned_to FOREIGN KEY (assigned_to_id) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT fk_perf_property FOREIGN KEY (property_id) REFERENCES public.hotels(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_performance_management_status ON public.performance_management(status);
CREATE INDEX IF NOT EXISTS idx_performance_management_priority ON public.performance_management(priority);
CREATE INDEX IF NOT EXISTS idx_performance_management_property_id ON public.performance_management(property_id);
CREATE INDEX IF NOT EXISTS idx_performance_management_assigned_to_id ON public.performance_management(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_performance_management_due_date ON public.performance_management(due_date);
CREATE INDEX IF NOT EXISTS idx_performance_management_deleted ON public.performance_management(deleted);

CREATE OR REPLACE FUNCTION public.update_performance_management_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_performance_management_updated_at ON public.performance_management;
CREATE TRIGGER trigger_update_performance_management_updated_at
BEFORE UPDATE ON public.performance_management
FOR EACH ROW
EXECUTE FUNCTION public.update_performance_management_updated_at();

/* -----------------------------
   AIRE tasks
   ----------------------------- */

CREATE TABLE IF NOT EXISTS public.aire_tasks (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(255) NOT NULL UNIQUE,
  task_type VARCHAR(100),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority VARCHAR(50) DEFAULT 'Medium',
  status VARCHAR(50) DEFAULT 'Pending',
  assigned_to_id INTEGER,
  assigned_to_name VARCHAR(255),
  service_user_id INTEGER,
  property_id INTEGER,
  property_name VARCHAR(255),
  due_date DATE,
  scheduled_date DATE,
  completed_date TIMESTAMP,
  notes TEXT,
  attachments TEXT,
  category VARCHAR(100),
  tags TEXT,
  created_by_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_aire_assigned_to FOREIGN KEY (assigned_to_id) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT fk_aire_service_user FOREIGN KEY (service_user_id) REFERENCES public.service_users(id) ON DELETE CASCADE,
  CONSTRAINT fk_aire_property FOREIGN KEY (property_id) REFERENCES public.hotels(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_aire_tasks_status ON public.aire_tasks(status);
CREATE INDEX IF NOT EXISTS idx_aire_tasks_priority ON public.aire_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_aire_tasks_assigned_to ON public.aire_tasks(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_aire_tasks_property ON public.aire_tasks(property_id);
CREATE INDEX IF NOT EXISTS idx_aire_tasks_service_user ON public.aire_tasks(service_user_id);
CREATE INDEX IF NOT EXISTS idx_aire_tasks_due_date ON public.aire_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_aire_tasks_category ON public.aire_tasks(category);
CREATE INDEX IF NOT EXISTS idx_aire_tasks_created_at ON public.aire_tasks(created_at DESC);

COMMIT;
