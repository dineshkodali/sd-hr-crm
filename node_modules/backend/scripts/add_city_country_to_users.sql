-- Add city and country columns to users table
-- This migration adds support for storing city and country information for users

-- Check if columns exist before adding them
DO $$ 
BEGIN
    -- Add city column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'city'
    ) THEN
        ALTER TABLE users ADD COLUMN city VARCHAR(100);
        RAISE NOTICE 'Added city column to users table';
    ELSE
        RAISE NOTICE 'city column already exists in users table';
    END IF;

    -- Add country column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'country'
    ) THEN
        ALTER TABLE users ADD COLUMN country VARCHAR(100);
        RAISE NOTICE 'Added country column to users table';
    ELSE
        RAISE NOTICE 'country column already exists in users table';
    END IF;
END $$;

-- Create indexes for better query performance (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_users_city ON users(city);
CREATE INDEX IF NOT EXISTS idx_users_country ON users(country);

-- Verify the columns were added
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'users' 
AND column_name IN ('city', 'country')
ORDER BY column_name;
