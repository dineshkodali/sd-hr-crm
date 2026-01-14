-- Create table for tracking authenticator devices
CREATE TABLE IF NOT EXISTS authenticator_devices (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_name VARCHAR(255) NOT NULL,
  device_type VARCHAR(50), -- 'mobile', 'desktop', 'tablet', etc.
  device_fingerprint VARCHAR(500), -- Browser/device identifier
  secret VARCHAR(255) NOT NULL, -- Individual TOTP secret for this device
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_authenticator_devices_user_id ON authenticator_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_authenticator_devices_active ON authenticator_devices(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_authenticator_devices_last_used ON authenticator_devices(last_used_at);

-- Add comment
COMMENT ON TABLE authenticator_devices IS 'Stores multiple authenticator devices per user with individual secrets';
