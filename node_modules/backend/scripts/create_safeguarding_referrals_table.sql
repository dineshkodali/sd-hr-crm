-- Create safeguarding_referrals table
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
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_safeguarding_referrals_property_id ON public.safeguarding_referrals(property_id);
CREATE INDEX IF NOT EXISTS idx_safeguarding_referrals_status ON public.safeguarding_referrals(status);
CREATE INDEX IF NOT EXISTS idx_safeguarding_referrals_priority ON public.safeguarding_referrals(priority);
CREATE INDEX IF NOT EXISTS idx_safeguarding_referrals_created_at ON public.safeguarding_referrals(created_at DESC);
