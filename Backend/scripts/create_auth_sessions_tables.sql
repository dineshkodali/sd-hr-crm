-- Create auth_sessions table for tracking login sessions
CREATE TABLE IF NOT EXISTS auth_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(500),
  login_method VARCHAR(50), -- 'password', 'authenticator', 'otp', 'backup_code'
  device_id INTEGER REFERENCES authenticator_devices(id) ON DELETE SET NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  browser VARCHAR(100),
  os VARCHAR(100),
  device_type VARCHAR(50),
  login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  logout_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_is_active ON auth_sessions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_login_at ON auth_sessions(login_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_device_id ON auth_sessions(device_id);

-- Create login_logs table for detailed authentication attempts
CREATE TABLE IF NOT EXISTS login_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  success BOOLEAN NOT NULL,
  login_method VARCHAR(50), -- 'password', 'authenticator', 'otp', 'backup_code'
  device_id INTEGER REFERENCES authenticator_devices(id) ON DELETE SET NULL,
  failure_reason VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  browser VARCHAR(100),
  os VARCHAR(100),
  device_type VARCHAR(50),
  attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_login_logs_user_id ON login_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_email ON login_logs(email);
CREATE INDEX IF NOT EXISTS idx_login_logs_success ON login_logs(success);
CREATE INDEX IF NOT EXISTS idx_login_logs_attempted_at ON login_logs(attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_logs_device_id ON login_logs(device_id);

-- Add comments
COMMENT ON TABLE auth_sessions IS 'Tracks active user sessions with device and login method information';
COMMENT ON TABLE login_logs IS 'Logs all authentication attempts (successful and failed) for security auditing';
