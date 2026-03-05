-- Create Emergency Protocols Table
-- Schema: public
-- This table stores emergency protocol tasks and work orders

CREATE TABLE IF NOT EXISTS public.emergency_protocols (
    id SERIAL PRIMARY KEY,
    
    -- Task identification and reference
    reference VARCHAR(255) NOT NULL UNIQUE,  -- e.g., EMP-2025-e5198a6e
    type VARCHAR(100) DEFAULT 'Emergency Protocols',  -- Task type/category
    
    -- Task details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Priority and Status
    priority VARCHAR(50) DEFAULT 'Medium',   -- 'Low', 'Medium', 'Urgent'
    status VARCHAR(50) DEFAULT 'Pending',    -- 'Pending', 'Completed', 'Overdue'
    
    -- Assignment
    assigned_to_id INTEGER,                  -- FK to users table (employee/staff member)
    assigned_to_name VARCHAR(255),           -- Denormalized name for quick display
    
    -- Relationships
    property_id INTEGER,                     -- FK to hotels/properties
    property_name VARCHAR(255),
    
    -- Reporting
    reported_by VARCHAR(255),               -- Name of person reporting
    
    -- Dates
    due_date DATE,
    scheduled_date DATE,
    completed_date TIMESTAMP,
    
    -- Metadata
    notes TEXT,
    category VARCHAR(100),  -- Task category
    
    -- Audit fields
    created_by_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT fk_assigned_to FOREIGN KEY (assigned_to_id) REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT fk_property FOREIGN KEY (property_id) REFERENCES public.hotels(id) ON DELETE SET NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_emergency_protocols_status ON public.emergency_protocols(status);
CREATE INDEX IF NOT EXISTS idx_emergency_protocols_priority ON public.emergency_protocols(priority);
CREATE INDEX IF NOT EXISTS idx_emergency_protocols_property_id ON public.emergency_protocols(property_id);
CREATE INDEX IF NOT EXISTS idx_emergency_protocols_assigned_to_id ON public.emergency_protocols(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_emergency_protocols_due_date ON public.emergency_protocols(due_date);
CREATE INDEX IF NOT EXISTS idx_emergency_protocols_deleted ON public.emergency_protocols(deleted);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_emergency_protocols_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_emergency_protocols_updated_at
    BEFORE UPDATE ON public.emergency_protocols
    FOR EACH ROW
    EXECUTE FUNCTION update_emergency_protocols_updated_at();

