-- Create AIRE Tasks Table
-- Schema: public
-- This table stores AIRE (Accommodation for Immune-Compromised Residents from Elsewhere) related tasks and work orders

CREATE TABLE IF NOT EXISTS public.aire_tasks (
    id SERIAL PRIMARY KEY,
    
    -- Task identification and reference
    reference VARCHAR(255) NOT NULL UNIQUE,  -- e.g., AIRE-2025-abc123
    task_type VARCHAR(100),                  -- e.g., 'Passport & VISA Verification', 'Resident Data Update'
    
    -- Task details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Priority and Status
    priority VARCHAR(50) DEFAULT 'Medium',   -- 'Low', 'Medium', 'High', 'Urgent'
    status VARCHAR(50) DEFAULT 'Pending',    -- 'Pending', 'In Progress', 'Completed', 'Overdue'
    
    -- Assignment
    assigned_to_id INTEGER,                  -- FK to users table (employee/staff member)
    assigned_to_name VARCHAR(255),           -- Denormalized name for quick display
    
    -- Relationships
    service_user_id INTEGER,                 -- FK to service_users (optional, if task is related to a service user)
    property_id INTEGER,                     -- FK to hotels/properties
    property_name VARCHAR(255),
    
    -- Dates
    due_date DATE,
    scheduled_date DATE,
    completed_date TIMESTAMP,
    
    -- Metadata
    notes TEXT,
    attachments TEXT,  -- JSON array or comma-separated URLs
    category VARCHAR(100),  -- e.g., 'AIRE', 'Compliance', 'Inspection'
    tags TEXT,  -- Comma-separated tags for filtering
    
    -- Audit fields
    created_by_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_assigned_to FOREIGN KEY (assigned_to_id) REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT fk_service_user FOREIGN KEY (service_user_id) REFERENCES public.service_users(id) ON DELETE CASCADE,
    CONSTRAINT fk_property FOREIGN KEY (property_id) REFERENCES public.hotels(id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX idx_aire_tasks_status ON public.aire_tasks(status);
CREATE INDEX idx_aire_tasks_priority ON public.aire_tasks(priority);
CREATE INDEX idx_aire_tasks_assigned_to ON public.aire_tasks(assigned_to_id);
CREATE INDEX idx_aire_tasks_property ON public.aire_tasks(property_id);
CREATE INDEX idx_aire_tasks_service_user ON public.aire_tasks(service_user_id);
CREATE INDEX idx_aire_tasks_due_date ON public.aire_tasks(due_date);
CREATE INDEX idx_aire_tasks_category ON public.aire_tasks(category);
CREATE INDEX idx_aire_tasks_created_at ON public.aire_tasks(created_at DESC);

-- Grant permissions (if using role-based access)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aire_tasks TO postgres;

-- Display confirmation
\echo 'AIRE Tasks table created successfully!'
