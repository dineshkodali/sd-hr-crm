-- Migration: Update user_permissions table to support granular permissions
-- Run this to upgrade from simple can_access to granular permissions

-- Add new granular permission columns if they don't exist
ALTER TABLE user_permissions 
  ADD COLUMN IF NOT EXISTS can_read BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_create BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_update BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_delete BOOLEAN NOT NULL DEFAULT FALSE;

-- Migrate existing data if can_access column exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_permissions' AND column_name = 'can_access') THEN
    UPDATE user_permissions 
    SET can_read = can_access, 
        can_create = can_access, 
        can_update = can_access, 
        can_delete = can_access 
    WHERE can_access = TRUE;
    
    -- Drop the old column after migration
    ALTER TABLE user_permissions DROP COLUMN can_access;
  END IF;
END $$;

