-- Fix Admin User for Production
-- Run this SQL to ensure admin user exists and is active

-- First, check if admin user exists
SELECT * FROM users WHERE email = 'admin@sdcrm.com';

-- If admin user doesn't exist, create it
INSERT INTO users (id, name, email, password, role, status, created_at, updated_at)
VALUES (
  'admin-001',
  'System Administrator',
  'admin@sdcrm.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LFvOe', -- password: admin123
  'admin',
  'active',
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- If admin user exists but is not active, activate it
UPDATE users 
SET status = 'active', 
    updated_at = NOW()
WHERE email = 'admin@sdcrm.com';

-- Verify the admin user
SELECT id, name, email, role, status FROM users WHERE email = 'admin@sdcrm.com';

-- Check if there are any other inactive users
SELECT id, name, email, role, status FROM users WHERE status != 'active';

-- Activate all admin users
UPDATE users 
SET status = 'active', 
    updated_at = NOW()
WHERE role = 'admin' AND status != 'active';
