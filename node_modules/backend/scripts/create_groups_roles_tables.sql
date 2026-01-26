-- Table for permission groups
CREATE TABLE IF NOT EXISTS permission_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for group permissions (what permissions does each group have)
CREATE TABLE IF NOT EXISTS group_permissions (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES permission_groups(id) ON DELETE CASCADE,
    module VARCHAR(50) NOT NULL,
    can_read BOOLEAN NOT NULL DEFAULT FALSE,
    can_create BOOLEAN NOT NULL DEFAULT FALSE,
    can_update BOOLEAN NOT NULL DEFAULT FALSE,
    can_delete BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(group_id, module)
);

-- Table for user-group membership
CREATE TABLE IF NOT EXISTS user_groups (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id INTEGER NOT NULL REFERENCES permission_groups(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, group_id)
);

-- Table for permission roles/levels
CREATE TABLE IF NOT EXISTS permission_roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    level VARCHAR(20) NOT NULL, -- 'none', 'view', 'create', 'edit', 'full', 'custom'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for role permissions (what permissions does each role have)
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role_id INTEGER NOT NULL REFERENCES permission_roles(id) ON DELETE CASCADE,
    module VARCHAR(50) NOT NULL,
    can_read BOOLEAN NOT NULL DEFAULT FALSE,
    can_create BOOLEAN NOT NULL DEFAULT FALSE,
    can_update BOOLEAN NOT NULL DEFAULT FALSE,
    can_delete BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(role_id, module)
);

-- Table for user-role assignment
CREATE TABLE IF NOT EXISTS user_roles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES permission_roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role_id)
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_group_permissions_group_module ON group_permissions(group_id, module);
CREATE INDEX IF NOT EXISTS idx_user_groups_user ON user_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_group ON user_groups(group_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_module ON role_permissions(role_id, module);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);

-- Insert default roles
INSERT INTO permission_roles (name, description, level) VALUES
('Viewer', 'Read-only access to all modules', 'view'),
('Editor', 'Can view and edit most modules', 'edit'),
('Manager', 'Full access to operational modules', 'full'),
('Administrator', 'Complete system access', 'full')
ON CONFLICT (name) DO NOTHING;

-- Insert default groups
INSERT INTO permission_groups (name, description) VALUES
('Operations Team', 'Access to operational modules like inspections, incidents, maintenance'),
('HSE Team', 'Access to Health, Safety & Environment modules'),
('Safeguarding Team', 'Access to safeguarding and case management modules'),
('HR Team', 'Access to HR, payroll, and employee management')
ON CONFLICT (name) DO NOTHING;
