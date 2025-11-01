-- Fix applications table to auto-generate UUID for id column
ALTER TABLE applications ALTER COLUMN id SET DEFAULT gen_random_uuid();
