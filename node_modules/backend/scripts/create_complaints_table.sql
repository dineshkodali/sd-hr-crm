-- Create Complaints Table
-- Execute this SQL in your PostgreSQL database to create the complaints table

CREATE TABLE IF NOT EXISTS public.complaints (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  priority VARCHAR(50) DEFAULT 'medium',
  property_id INTEGER,
  property_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'open',
  reported_by VARCHAR(255),
  reported_date DATE,
  assigned_to VARCHAR(255),
  scheduled_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_priority ON public.complaints(priority);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON public.complaints(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_property_id ON public.complaints(property_id);

-- Optional: Add a constraint to link property_id to hotels table (if it exists)
-- ALTER TABLE public.complaints
-- ADD CONSTRAINT fk_complaints_property FOREIGN KEY (property_id) REFERENCES public.hotels(id) ON DELETE SET NULL;

-- Sample data (optional - for testing)
-- INSERT INTO public.complaints (reference, title, description, category, priority, property_id, property_name, status, reported_by, reported_date, assigned_to, scheduled_date)
-- VALUES 
--   ('COMP-2025-1234', 'Staff Behaviour Issue', 'Incident complaint work required as per inspection report.', 'staff', 'medium', 1, 'Property A', 'open', 'John Doe', '2025-02-08', 'ABC Maintenance', '2025-02-10'),
--   ('COMP-2025-5678', 'Food Quality Complaint', 'Incident complaint work required as per inspection report.', 'food', 'low', 2, 'Property B', 'completed', 'Jane Smith', '2025-02-06', 'In-house Team', '2025-02-08');
