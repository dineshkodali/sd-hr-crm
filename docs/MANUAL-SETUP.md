# Manual Database Setup Guide

## Problem: Database data not showing

The issue is that the database tables aren't being created properly in the Docker container. Here's how to fix it manually:

## Step 1: Stop All Containers
```bash
docker-compose down
```

## Step 2: Remove Old Database Volume
```bash
docker volume rm sd-hr-crm-master_postgres_data
```

## Step 3: Start Database Container Only
```bash
docker-compose up -d db
```

## Step 4: Wait for Database to Start (30 seconds)
Wait for the database to be fully ready.

## Step 5: Manually Initialize Database
```bash
# Connect to the database container
docker exec -it crm-db psql -U postgres -d hr_crm

# Once inside psql, run these commands:
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

-- Insert default admin user
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

-- Exit psql
\q
```

## Step 6: Start Backend and Frontend
```bash
docker-compose up -d backend frontend
```

## Step 7: Check Everything is Working
```bash
# Check containers
docker-compose ps

# Check backend logs
docker-compose logs backend --tail=10

# Test API
curl http://localhost:4000/api/health
```

## Step 8: Test in Browser
1. Go to http://localhost:3002
2. Login with: admin@sdcrm.com / admin123
3. You should see data in the dashboard

## Alternative: Use SQL File
If the manual commands don't work, try this:

```bash
# Copy SQL file to container
docker cp docker-init-db.sql crm-db:/tmp/init.sql

# Run the SQL file
docker exec crm-db psql -U postgres -d hr_crm -f /tmp/init.sql
```

## Verification:
- Hotels should show: "SD Commercial Plaza"
- Users should show: "System Administrator"
- Rooms should show: "Room 101"
- Branches should show: "Main Branch"

If you still don't see data, check the browser console for any remaining errors.
