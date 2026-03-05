-- Create HSE incidents table
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
