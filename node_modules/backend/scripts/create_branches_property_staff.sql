-- Create branches table to organize properties by branch
CREATE TABLE IF NOT EXISTS branches (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  address TEXT,
  manager_id INTEGER REFERENCES users(id),
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_branches_name ON branches(name);

-- Create property_staff table to assign employees to properties
CREATE TABLE IF NOT EXISTS property_staff (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_id, user_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_property_staff_property ON property_staff(property_id);
CREATE INDEX IF NOT EXISTS idx_property_staff_user ON property_staff(user_id);
CREATE INDEX IF NOT EXISTS idx_property_staff_role ON property_staff(role);

-- Add branch_id to properties table to link properties to branches
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'properties' AND column_name = 'branch_id'
  ) THEN
    ALTER TABLE properties ADD COLUMN branch_id INTEGER REFERENCES branches(id);
    CREATE INDEX idx_properties_branch ON properties(branch_id);
  END IF;
END $$;

-- Insert some sample branches
INSERT INTO branches (name, code, address) VALUES
  ('London Branch', 'LON', 'London, UK'),
  ('Manchester Branch', 'MAN', 'Manchester, UK'),
  ('Birmingham Branch', 'BIR', 'Birmingham, UK')
ON CONFLICT (name) DO NOTHING;

COMMENT ON TABLE branches IS 'Branches/offices for organizing properties and staff';
COMMENT ON TABLE property_staff IS 'Assignment of staff members to specific properties';
COMMENT ON COLUMN properties.branch_id IS 'Link to the branch this property belongs to';
