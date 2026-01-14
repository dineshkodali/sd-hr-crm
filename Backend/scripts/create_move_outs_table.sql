-- Create move_outs table in maintenance schema
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS maintenance;

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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS move_outs_service_user_idx ON maintenance.move_outs (service_user_id);
