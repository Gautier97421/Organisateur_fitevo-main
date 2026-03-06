-- Migration: Add sub_period to tasks table
-- This migration adds a sub_period column to differentiate task timing within matin/aprem periods

-- Add sub_period column to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sub_period TEXT;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS tasks_sub_period_idx ON tasks(sub_period);
