-- ========================================
-- Migration: Add payment_failed_insufficient_funds to notification_type enum
-- Description: Adds new notification type for PayPal insufficient funds errors
-- ========================================

-- Add new notification type value to existing enum
-- Note: This cannot be rolled back easily in PostgreSQL
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_failed_insufficient_funds';

-- ========================================
-- Migration complete
-- ========================================
