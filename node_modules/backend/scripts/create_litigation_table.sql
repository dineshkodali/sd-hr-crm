-- SQL: create table for litigation tasks
-- Run as a user with appropriate privileges, e.g. psql -d yourdb -f create_litigation_table.sql

CREATE TABLE IF NOT EXISTS public.litigation_tasks (
  id bigserial PRIMARY KEY,
  reference text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  priority text DEFAULT 'medium',
  status text DEFAULT 'open',
  assigned_to_id bigint,
  assigned_to_name text,
  service_user_id bigint,
  property_id bigint,
  property_name text,
  scheduled_date date,
  reported_by text,
  category text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_litigation_property_id ON public.litigation_tasks(property_id);
CREATE INDEX IF NOT EXISTS idx_litigation_service_user_id ON public.litigation_tasks(service_user_id);
CREATE INDEX IF NOT EXISTS idx_litigation_status ON public.litigation_tasks(status);

-- Optionally: grant privileges (adjust role as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.litigation_tasks TO your_db_role;
