-- Migration: Add Creator Wallet and Company Invoice System
-- This implements the new payment flow where:
-- 1. Company receives invoice for creator commissions
-- 2. Company pays invoice via Stripe Checkout
-- 3. Net amount (after fees) is credited to creator's wallet
-- 4. Creator can withdraw from wallet to their chosen payment method (free)

-- Create invoice status enum
DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'cancelled', 'expired', 'refunded');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create wallet transaction type enum
DO $$ BEGIN
  CREATE TYPE wallet_transaction_type AS ENUM ('credit', 'debit', 'withdrawal', 'refund', 'adjustment');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create withdrawal status enum
DO $$ BEGIN
  CREATE TYPE withdrawal_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Creator Wallets - Track creator's platform balance
CREATE TABLE IF NOT EXISTS creator_wallets (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id VARCHAR NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  available_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  pending_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total_earned DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total_withdrawn DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(3) NOT NULL DEFAULT 'CAD',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Wallet Transactions - Track all wallet activity
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id VARCHAR NOT NULL REFERENCES creator_wallets(id) ON DELETE CASCADE,
  creator_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type wallet_transaction_type NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  balance_after DECIMAL(10, 2) NOT NULL,
  description TEXT,
  reference_type VARCHAR(50), -- 'payment', 'retainer_payment', 'withdrawal', 'refund'
  reference_id VARCHAR, -- ID of the related payment, withdrawal, etc.
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Company Invoices - Track invoices sent to companies
CREATE TABLE IF NOT EXISTS company_invoices (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  company_id VARCHAR NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  creator_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_id VARCHAR REFERENCES payments(id) ON DELETE SET NULL,
  retainer_payment_id VARCHAR REFERENCES retainer_payments(id) ON DELETE SET NULL,
  gross_amount DECIMAL(10, 2) NOT NULL,
  platform_fee_amount DECIMAL(10, 2) NOT NULL,
  stripe_fee_amount DECIMAL(10, 2) NOT NULL,
  net_amount DECIMAL(10, 2) NOT NULL,
  status invoice_status NOT NULL DEFAULT 'draft',
  stripe_checkout_session_id VARCHAR,
  stripe_payment_intent_id VARCHAR,
  description TEXT,
  due_date TIMESTAMP,
  sent_at TIMESTAMP,
  paid_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  expired_at TIMESTAMP,
  refunded_at TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Withdrawals - Track creator withdrawal requests
CREATE TABLE IF NOT EXISTS withdrawals (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id VARCHAR NOT NULL REFERENCES creator_wallets(id) ON DELETE CASCADE,
  creator_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  fee_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  net_amount DECIMAL(10, 2) NOT NULL,
  payout_method VARCHAR(20) NOT NULL, -- 'paypal', 'etransfer', 'wire', 'crypto'
  payout_details JSONB, -- Store payout-specific details (email, bank info, wallet address, etc.)
  status withdrawal_status NOT NULL DEFAULT 'pending',
  provider_transaction_id VARCHAR,
  provider_response JSONB,
  failure_reason TEXT,
  requested_at TIMESTAMP DEFAULT NOW(),
  processing_started_at TIMESTAMP,
  completed_at TIMESTAMP,
  failed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_creator_wallets_creator_id ON creator_wallets(creator_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_creator_id ON wallet_transactions(creator_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_company_invoices_company_id ON company_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_company_invoices_creator_id ON company_invoices(creator_id);
CREATE INDEX IF NOT EXISTS idx_company_invoices_status ON company_invoices(status);
CREATE INDEX IF NOT EXISTS idx_company_invoices_payment_id ON company_invoices(payment_id);
CREATE INDEX IF NOT EXISTS idx_company_invoices_stripe_session ON company_invoices(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_wallet_id ON withdrawals(wallet_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_creator_id ON withdrawals(creator_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);

-- Add notification types for the new payment flow
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'invoice_sent';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'invoice_paid';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'invoice_expired';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'wallet_credited';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'withdrawal_requested';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'withdrawal_completed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'withdrawal_failed';
