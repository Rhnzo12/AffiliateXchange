-- ========================================
-- Database Schema Fix Migration
-- Date: 2025-10-26
-- Purpose: Fix UUID type mismatches and missing columns
-- ========================================

-- NOTE: This will clear all data in the analytics table
-- If you need to preserve data, export it first

-- Step 1: Fix analytics table - Clear data and convert types
TRUNCATE TABLE analytics CASCADE;

ALTER TABLE analytics ALTER COLUMN id TYPE uuid USING id::uuid;
ALTER TABLE analytics ALTER COLUMN application_id TYPE uuid USING application_id::uuid;
ALTER TABLE analytics ALTER COLUMN offer_id TYPE uuid USING offer_id::uuid;
ALTER TABLE analytics ALTER COLUMN creator_id TYPE uuid USING creator_id::uuid;

-- Add foreign key constraint
ALTER TABLE analytics DROP CONSTRAINT IF EXISTS analytics_application_id_fkey;
ALTER TABLE analytics ADD CONSTRAINT analytics_application_id_fkey FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE;

-- Step 2: Add missing created_at column to favorites
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT NOW();

-- Update existing records
UPDATE favorites SET created_at = NOW() WHERE created_at IS NULL;

-- Step 3: Fix click_events table structure
DROP TABLE IF EXISTS click_events CASCADE;

CREATE TABLE click_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  ip_address varchar(255),
  user_agent text,
  referer varchar(255),
  country varchar(255),
  city varchar(255),
  timestamp timestamp DEFAULT NOW()
);

-- Step 4: Create performance indexes
CREATE INDEX IF NOT EXISTS idx_analytics_application_id ON analytics(application_id);
CREATE INDEX IF NOT EXISTS idx_analytics_creator_id ON analytics(creator_id);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics(date);
CREATE INDEX IF NOT EXISTS idx_click_events_application_id ON click_events(application_id);

-- ========================================
-- Migration Complete!
-- ========================================
