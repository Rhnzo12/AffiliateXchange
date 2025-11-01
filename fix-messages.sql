-- ========================================
-- Fix Messages and Conversations Table Schema
-- Date: 2025-10-26
-- Purpose: Ensure messages and conversations tables have proper UUID defaults
-- ========================================

-- Add UUID default to conversations table
ALTER TABLE conversations ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Add UUID default to messages table
ALTER TABLE messages ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- ========================================
-- Migration Complete!
-- ========================================
