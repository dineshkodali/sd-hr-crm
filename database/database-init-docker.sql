-- Database initialization script for Docker
-- This will be automatically run when the database container starts

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tables (basic schema)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create admin user
INSERT INTO users (id, name, email, password, role, status)
VALUES (
    'admin-001',
    'System Administrator',
    'admin@sdcrm.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LFvOe',
    'admin',
    'active'
) ON CONFLICT (email) DO NOTHING;

-- Create hotels table
CREATE TABLE IF NOT EXISTS hotels (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample hotel
INSERT INTO hotels (id, name, address, phone, email, status)
VALUES (
    'hotel-001',
    'Riverside Hotel',
    '123 Main Street, City',
    '+1-555-0123',
    'info@riversidehotel.com',
    'active'
) ON CONFLICT (id) DO NOTHING;

-- Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
    id VARCHAR(50) PRIMARY KEY,
    hotel_id VARCHAR(50) REFERENCES hotels(id),
    room_number VARCHAR(20) NOT NULL,
    room_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'available',
    service_user_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample rooms
INSERT INTO rooms (id, hotel_id, room_number, room_type, status)
VALUES 
    ('room-001', 'hotel-001', '101', 'Single', 'available'),
    ('room-002', 'hotel-001', '102', 'Double', 'available'),
    ('room-003', 'hotel-001', '103', 'Suite', 'available')
ON CONFLICT (id) DO NOTHING;

-- Create maintenance_tasks table
CREATE TABLE IF NOT EXISTS maintenance_tasks (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'open',
    priority VARCHAR(20) DEFAULT 'medium',
    hotel_id VARCHAR(50) REFERENCES hotels(id),
    room_id VARCHAR(50) REFERENCES rooms(id),
    assigned_to VARCHAR(255),
    created_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample maintenance tasks
INSERT INTO maintenance_tasks (id, title, description, status, priority, hotel_id)
VALUES 
    ('maint-001', 'Fix leaking faucet', 'Bathroom faucet is leaking in room 101', 'open', 'medium', 'hotel-001'),
    ('maint-002', 'Replace air filter', 'HVAC air filter needs replacement', 'in_progress', 'low', 'hotel-001'),
    ('maint-003', 'Repair broken window', 'Window in room 103 is cracked', 'open', 'high', 'hotel-001')
ON CONFLICT (id) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_rooms_hotel_id ON rooms(hotel_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_status ON maintenance_tasks(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_hotel_id ON maintenance_tasks(hotel_id);

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Output success message
DO $$
BEGIN
    RAISE NOTICE 'Database initialized successfully!';
    RAISE NOTICE 'Admin user created: admin@sdcrm.com / admin123';
    RAISE NOTICE 'Sample data inserted for testing';
END $$;
