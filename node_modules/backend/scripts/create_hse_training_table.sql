-- Create HSE training table
CREATE TABLE IF NOT EXISTS public.hse_training (
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

CREATE INDEX IF NOT EXISTS idx_hse_training_property_id ON public.hse_training(property_id);
CREATE INDEX IF NOT EXISTS idx_hse_training_status ON public.hse_training(status);
CREATE INDEX IF NOT EXISTS idx_hse_training_priority ON public.hse_training(priority);
CREATE INDEX IF NOT EXISTS idx_hse_training_created_at ON public.hse_training(created_at DESC);
