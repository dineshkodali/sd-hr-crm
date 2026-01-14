-- Create Employee Training Table
-- Schema: public
-- This table stores employee training tasks and records

CREATE TABLE IF NOT EXISTS public.employee_training (
    id SERIAL PRIMARY KEY,
    
    -- Task identification and reference
    reference VARCHAR(255) NOT NULL UNIQUE,  -- e.g., EMPT-2025-e5198a6e
    type VARCHAR(100) DEFAULT 'Employee Training',  -- Task type/category
    
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
    
    CONSTRAINT fk_emp_train_assigned_to FOREIGN KEY (assigned_to_id) REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT fk_emp_train_property FOREIGN KEY (property_id) REFERENCES public.hotels(id) ON DELETE SET NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_employee_training_status ON public.employee_training(status);
CREATE INDEX IF NOT EXISTS idx_employee_training_priority ON public.employee_training(priority);
CREATE INDEX IF NOT EXISTS idx_employee_training_property_id ON public.employee_training(property_id);
CREATE INDEX IF NOT EXISTS idx_employee_training_assigned_to_id ON public.employee_training(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_employee_training_due_date ON public.employee_training(due_date);
CREATE INDEX IF NOT EXISTS idx_employee_training_deleted ON public.employee_training(deleted);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_employee_training_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_employee_training_updated_at
    BEFORE UPDATE ON public.employee_training
    FOR EACH ROW
    EXECUTE FUNCTION update_employee_training_updated_at();

