-- Backend/scripts/add_authenticator_columns.sql
-- Add Google Authenticator / TOTP columns to users table

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS authenticator_secret VARCHAR(255),
ADD COLUMN IF NOT EXISTS authenticator_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS backup_codes TEXT[];

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_authenticator_enabled ON users(authenticator_enabled);

COMMENT ON COLUMN users.authenticator_secret IS 'Base32 encoded secret for TOTP';
COMMENT ON COLUMN users.authenticator_enabled IS 'Whether user has enabled authenticator app';
COMMENT ON COLUMN users.backup_codes IS 'Array of backup codes for account recovery';
