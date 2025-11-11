-- Run this SQL directly in your database console
-- Or save as a .sql file and execute it

-- Add priority listing fields to offers table
ALTER TABLE offers ADD COLUMN IF NOT EXISTS priority_expires_at TIMESTAMP;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS priority_purchased_at TIMESTAMP;

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_offers_priority_expires_at
ON offers(priority_expires_at)
WHERE priority_expires_at IS NOT NULL;

-- Insert platform settings for priority listing (if platform_settings table exists)
INSERT INTO platform_settings (id, key, value, description, category, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'priority_listing_fee', '199', 'Fee for priority listing in dollars', 'pricing', NOW(), NOW()),
  (gen_random_uuid(), 'priority_listing_duration_days', '30', 'Duration of priority listing in days', 'features', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

-- Verify the columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'offers'
AND column_name IN ('priority_expires_at', 'priority_purchased_at');
