-- Add payment processing features
-- This adds platform_funding_accounts table and payment provider tracking

-- Create platform_funding_accounts table
CREATE TABLE IF NOT EXISTS platform_funding_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  type varchar NOT NULL, -- 'bank', 'wallet', 'card'
  last4 varchar NOT NULL,
  status varchar NOT NULL DEFAULT 'pending', -- 'active', 'pending', 'disabled'
  is_primary boolean DEFAULT false,
  bank_name varchar,
  account_holder_name varchar,
  routing_number varchar,
  account_number varchar,
  swift_code varchar,
  wallet_address text,
  wallet_network varchar,
  card_brand varchar,
  card_expiry varchar,
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_platform_funding_accounts_status
  ON platform_funding_accounts(status);
CREATE INDEX IF NOT EXISTS idx_platform_funding_accounts_primary
  ON platform_funding_accounts(is_primary) WHERE is_primary = true;

-- Add payment provider tracking columns to payments table
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS provider_transaction_id varchar;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS provider_response jsonb;

-- Add index for provider transaction lookups
CREATE INDEX IF NOT EXISTS idx_payments_provider_transaction_id
  ON payments(provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

-- Migration complete
