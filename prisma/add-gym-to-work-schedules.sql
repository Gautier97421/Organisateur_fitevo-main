-- Migration: Add gym_id to work_schedules table
-- This migration adds a gym_id column to the work_schedules table to associate schedules with specific gyms

-- Add gym_id column to work_schedules
ALTER TABLE work_schedules ADD COLUMN IF NOT EXISTS gym_id TEXT;

-- Add foreign key constraint
ALTER TABLE work_schedules ADD CONSTRAINT work_schedules_gym_id_fkey 
  FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS work_schedules_gym_id_idx ON work_schedules(gym_id);
