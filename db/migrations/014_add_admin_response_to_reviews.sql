-- Add admin_response field to reviews table for platform-level responses
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS admin_response text;
