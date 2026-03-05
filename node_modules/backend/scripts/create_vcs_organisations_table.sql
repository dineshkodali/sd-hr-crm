-- Create VCS Organisations Table
CREATE TABLE IF NOT EXISTS vcs_organisations (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  priority VARCHAR(50) DEFAULT 'medium',
  property_id INTEGER,
  property_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'new',
  assigned_to VARCHAR(255),
  reported_by VARCHAR(255),
  reported_date DATE,
  scheduled_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_vcs_status ON vcs_organisations(status);
CREATE INDEX idx_vcs_priority ON vcs_organisations(priority);
CREATE INDEX idx_vcs_created ON vcs_organisations(created_at);
CREATE INDEX idx_vcs_property ON vcs_organisations(property_id);

-- Optional: Add comment to table
COMMENT ON TABLE vcs_organisations IS 'VCS Organisations - Volunteer and Community Sector partner organisations';
