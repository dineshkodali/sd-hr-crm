-- Complete database initialization for Docker deployment
-- This script creates all required tables and schemas

-- Create maintenance schema
CREATE SCHEMA IF NOT EXISTS maintenance;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'staff',
    status VARCHAR(20) DEFAULT 'active',
    branch VARCHAR(100),
    hotel_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create hotels table
CREATE TABLE IF NOT EXISTS hotels (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    manager_id INTEGER REFERENCES users(id),
    total_beds INTEGER DEFAULT 0,
    occupied_beds INTEGER DEFAULT 0,
    total_floors INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    hotel_id INTEGER REFERENCES hotels(id) ON DELETE CASCADE,
    room_number VARCHAR(50) NOT NULL,
    type VARCHAR(100),
    rate DECIMAL(10,2),
    floor INTEGER,
    status VARCHAR(20) DEFAULT 'active',
    inventory TEXT,
    bedspaces INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create service_users table
CREATE TABLE IF NOT EXISTS service_users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    room_number VARCHAR(50),
    hotel_id INTEGER REFERENCES hotels(id),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create compliance table
CREATE TABLE IF NOT EXISTS compliance (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    assigned_to INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create certificates table
CREATE TABLE IF NOT EXISTS certificates (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    certificate_type VARCHAR(100),
    expiry_date DATE,
    status VARCHAR(20) DEFAULT 'active',
    assigned_to INTEGER REFERENCES users(id),
    hotel_id INTEGER REFERENCES hotels(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create maintenance_tasks table
CREATE TABLE IF NOT EXISTS maintenance_tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'pending',
    assigned_to INTEGER REFERENCES users(id),
    hotel_id INTEGER REFERENCES hotels(id),
    room_id INTEGER REFERENCES rooms(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create incidents table in maintenance schema
CREATE TABLE IF NOT EXISTS maintenance.incidents (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity VARCHAR(20) DEFAULT 'low',
    status VARCHAR(20) DEFAULT 'open',
    reported_by INTEGER REFERENCES users(id),
    hotel_id INTEGER REFERENCES hotels(id),
    room_id INTEGER REFERENCES rooms(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create branches table
CREATE TABLE IF NOT EXISTS branches (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    manager_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default admin user (password: admin123)
INSERT INTO users (name, email, password, role, status) 
VALUES (
    'System Administrator', 
    'admin@sdcrm.com', 
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LFvOe', -- admin123
    'admin', 
    'active'
) ON CONFLICT (email) DO NOTHING;

-- Insert sample hotel
INSERT INTO hotels (name, total_beds, total_floors) 
VALUES ('SD Commercial Plaza', 100, 5) 
ON CONFLICT DO NOTHING;

-- Insert sample branch
INSERT INTO branches (name, address, phone) 
VALUES ('Main Branch', '123 Main Street, City', '+1234567890') 
ON CONFLICT DO NOTHING;

-- Insert sample rooms
INSERT INTO rooms (hotel_id, room_number, type, rate, floor, status) 
SELECT 
    h.id, 
    '101', 
    'Single', 
    1500.00, 
    1, 
    'active'
FROM hotels h 
WHERE h.name = 'SD Commercial Plaza'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_rooms_hotel_id ON rooms(hotel_id);
CREATE INDEX IF NOT EXISTS idx_rooms_number ON rooms(room_number);
CREATE INDEX IF NOT EXISTS idx_service_users_hotel_id ON service_users(hotel_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_hotel_id ON maintenance_tasks(hotel_id);
CREATE INDEX IF NOT EXISTS idx_certificates_hotel_id ON certificates(hotel_id);
CREATE INDEX IF NOT EXISTS idx_incidents_hotel_id ON maintenance.incidents(hotel_id);

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA maintenance TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA maintenance TO postgres;

COMMIT;
