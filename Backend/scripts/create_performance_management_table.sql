-- Create Performance Management Table
-- Schema: public
-- This table stores performance management tasks and work orders

CREATE TABLE IF NOT EXISTS public.performance_management (
    id SERIAL PRIMARY KEY,
    
    -- Task identification and reference
    reference VARCHAR(255) NOT NULL UNIQUE,  -- e.g., PMT-2025-e5198a6e
    type VARCHAR(100) DEFAULT 'Performance Management',  -- Task type/category
    
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
    
    CONSTRAINT fk_perf_assigned_to FOREIGN KEY (assigned_to_id) REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT fk_perf_property FOREIGN KEY (property_id) REFERENCES public.hotels(id) ON DELETE SET NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_performance_management_status ON public.performance_management(status);
CREATE INDEX IF NOT EXISTS idx_performance_management_priority ON public.performance_management(priority);
CREATE INDEX IF NOT EXISTS idx_performance_management_property_id ON public.performance_management(property_id);
CREATE INDEX IF NOT EXISTS idx_performance_management_assigned_to_id ON public.performance_management(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_performance_management_due_date ON public.performance_management(due_date);
CREATE INDEX IF NOT EXISTS idx_performance_management_deleted ON public.performance_management(deleted);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_performance_management_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_performance_management_updated_at
    BEFORE UPDATE ON public.performance_management
    FOR EACH ROW
    EXECUTE FUNCTION update_performance_management_updated_at();
