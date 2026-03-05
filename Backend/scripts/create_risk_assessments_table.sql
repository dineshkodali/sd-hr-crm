-- Create risk_assessments table
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
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_risk_assessments_property_id ON public.risk_assessments(property_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_status ON public.risk_assessments(status);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_risk_level ON public.risk_assessments(risk_level);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_created_at ON public.risk_assessments(created_at DESC);
