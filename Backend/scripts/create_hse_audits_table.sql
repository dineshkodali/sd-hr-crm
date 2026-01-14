-- Create HSE audits table
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
