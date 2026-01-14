-- Backend/scripts/create_otp_table.sql
-- Create OTP codes table for email-based authentication

CREATE TABLE IF NOT EXISTS user_otps (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  otp_code VARCHAR(6) NOT NULL,
  otp_type VARCHAR(50) NOT NULL DEFAULT 'login',
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_otps_email ON user_otps(email);
CREATE INDEX IF NOT EXISTS idx_user_otps_code ON user_otps(otp_code);
CREATE INDEX IF NOT EXISTS idx_user_otps_expires ON user_otps(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_otps_used ON user_otps(used);

-- Comments
COMMENT ON TABLE user_otps IS 'Stores OTP codes for email-based authentication';
COMMENT ON COLUMN user_otps.otp_type IS 'Type of OTP: login, password_reset, etc.';
COMMENT ON COLUMN user_otps.expires_at IS 'When the OTP expires (typically 10 minutes)';
