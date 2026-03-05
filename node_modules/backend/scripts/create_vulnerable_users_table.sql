-- Create vulnerable_users table
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vulnerable_users_property_id ON public.vulnerable_users(property_id);
CREATE INDEX IF NOT EXISTS idx_vulnerable_users_status ON public.vulnerable_users(status);
CREATE INDEX IF NOT EXISTS idx_vulnerable_users_priority ON public.vulnerable_users(priority);
CREATE INDEX IF NOT EXISTS idx_vulnerable_users_created_at ON public.vulnerable_users(created_at DESC);
