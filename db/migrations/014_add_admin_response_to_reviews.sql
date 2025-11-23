-- Add missing columns to reviews table to match schema
-- These columns are defined in shared/schema.ts but missing in the database

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS admin_response text,
  ADD COLUMN IF NOT EXISTS responded_at timestamp,
  ADD COLUMN IF NOT EXISTS responded_by varchar REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_edited boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_note text,
  ADD COLUMN IF NOT EXISTS is_approved boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS approved_by varchar,
  ADD COLUMN IF NOT EXISTS approved_at timestamp,
  ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false;
