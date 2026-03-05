-- Create move_ins table in maintenance schema
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS maintenance;

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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS move_ins_service_user_idx ON maintenance.move_ins (service_user_id);
CREATE INDEX IF NOT EXISTS move_ins_property_idx ON maintenance.move_ins (property_id);
