-- Migration: Add timezone field to users table
-- Date: 2025-12-22
-- Description: Adds timezone column to users table with default value 'America/New_York'
--              This allows users to set their preferred timezone for interviews and calendar events

-- Add timezone column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/New_York';

-- Add comment to the column
COMMENT ON COLUMN users.timezone IS 'User''s timezone for interviews and calendar events (IANA timezone format)';

-- Create index for faster timezone lookups (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_users_timezone ON users(timezone);
