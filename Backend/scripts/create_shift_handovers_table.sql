-- Create shift_handovers table
CREATE TABLE IF NOT EXISTS shift_handovers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    employee_name VARCHAR(255) NOT NULL,
    shift_date DATE NOT NULL,
    shift_type VARCHAR(50) NOT NULL, -- e.g. Morning, Afternoon, Night
    tasks_completed TEXT NOT NULL,
    issues_reported TEXT,
    handover_notes TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
