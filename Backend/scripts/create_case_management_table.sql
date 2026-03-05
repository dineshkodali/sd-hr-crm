-- create_case_management_table.sql
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
