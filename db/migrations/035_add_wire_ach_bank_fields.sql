-- Migration: Add Wire/ACH bank account fields to payment_settings
-- This migration adds additional fields needed for Wire/ACH bank transfers

-- Add new columns to payment_settings table for enhanced bank account details
ALTER TABLE payment_settings
ADD COLUMN IF NOT EXISTS bank_account_holder_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS bank_account_type VARCHAR(20),
ADD COLUMN IF NOT EXISTS bank_account_holder_type VARCHAR(20),
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS bank_country VARCHAR(10),
ADD COLUMN IF NOT EXISTS bank_currency VARCHAR(10),
ADD COLUMN IF NOT EXISTS stripe_bank_account_id VARCHAR(255);

-- Add comments for documentation
COMMENT ON COLUMN payment_settings.bank_account_holder_name IS 'Name on the bank account for wire/ACH transfers';
COMMENT ON COLUMN payment_settings.bank_account_type IS 'Type of bank account: checking or savings';
COMMENT ON COLUMN payment_settings.bank_account_holder_type IS 'Account holder type: individual or company';
COMMENT ON COLUMN payment_settings.bank_name IS 'Name of the bank institution';
COMMENT ON COLUMN payment_settings.bank_country IS 'Country code of the bank (US, CA, etc.)';
COMMENT ON COLUMN payment_settings.bank_currency IS 'Currency code for the account (USD, CAD, etc.)';
COMMENT ON COLUMN payment_settings.stripe_bank_account_id IS 'Stripe bank account ID for wire/ACH payouts';
