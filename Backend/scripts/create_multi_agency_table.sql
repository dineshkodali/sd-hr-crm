-- Create multi_agency table
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_multi_agency_property_id ON public.multi_agency(property_id);
CREATE INDEX IF NOT EXISTS idx_multi_agency_status ON public.multi_agency(status);
CREATE INDEX IF NOT EXISTS idx_multi_agency_priority ON public.multi_agency(priority);
CREATE INDEX IF NOT EXISTS idx_multi_agency_created_at ON public.multi_agency(created_at DESC);
