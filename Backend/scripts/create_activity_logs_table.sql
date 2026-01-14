-- Activity Logs Table for tracking user actions
-- This table stores all user activities for audit trail

CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL, -- e.g., 'login', 'logout', 'create_task', 'update_profile', 'delete_record'
  action_type VARCHAR(50) NOT NULL, -- 'auth', 'crud', 'view', 'export', 'settings'
  resource VARCHAR(100), -- e.g., 'tasks', 'users', 'properties', 'hotels'
  resource_id INTEGER, -- ID of the affected resource
  description TEXT, -- Human-readable description of the action
  metadata JSONB, -- Additional data like old/new values, query params
  ip_address INET,
  user_agent TEXT,
  browser VARCHAR(100),
  os VARCHAR(100),
  device_type VARCHAR(50),
  status VARCHAR(20) DEFAULT 'success', -- 'success', 'failed', 'error'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_type ON activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_resource ON activity_logs(resource);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created ON activity_logs(user_id, created_at DESC);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_action_date ON activity_logs(user_id, action, created_at DESC);

COMMENT ON TABLE activity_logs IS 'Stores all user activities for audit trail and activity monitoring';
COMMENT ON COLUMN activity_logs.action IS 'Specific action performed (login, create_task, update_profile, etc.)';
COMMENT ON COLUMN activity_logs.action_type IS 'Category of action (auth, crud, view, export, settings)';
COMMENT ON COLUMN activity_logs.resource IS 'Type of resource affected (tasks, users, properties, etc.)';
COMMENT ON COLUMN activity_logs.resource_id IS 'ID of the specific resource affected';
COMMENT ON COLUMN activity_logs.metadata IS 'JSON data with additional context (old/new values, params, etc.)';
