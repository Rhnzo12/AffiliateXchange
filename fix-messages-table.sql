-- ========================================
-- Recreate Messages Table with Correct Schema
-- Date: 2025-10-26
-- Purpose: Fix messages table to match schema definition
-- ========================================

-- Drop and recreate messages table with correct structure
DROP TABLE IF EXISTS messages CASCADE;

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp DEFAULT NOW()
);

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- ========================================
-- Migration Complete!
-- ========================================
