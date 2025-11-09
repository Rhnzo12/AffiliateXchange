#!/usr/bin/env tsx
/**
 * Script to run migration 009: Add enhanced company registration fields
 * Usage: tsx --env-file=.env scripts/run-migration-009.ts
 */

import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function runMigration() {
  try {
    console.log("[Migration] Running migration 009: Add enhanced company registration fields");

    // Add new status to company_status enum
    console.log("[Migration] Adding 'pending_more_info' to company_status enum...");
    await db.execute(sql.raw(`ALTER TYPE company_status ADD VALUE IF NOT EXISTS 'pending_more_info'`));
    console.log("[Migration] ✅ Added 'pending_more_info' to company_status");

    // Add new columns to company_profiles table
    console.log("[Migration] Adding new columns to company_profiles table...");

    const alterTableSQL = sql.raw(`
      ALTER TABLE company_profiles
      ADD COLUMN IF NOT EXISTS ein_tax_id VARCHAR,
      ADD COLUMN IF NOT EXISTS website_verification_method VARCHAR,
      ADD COLUMN IF NOT EXISTS website_verification_token VARCHAR,
      ADD COLUMN IF NOT EXISTS website_verified BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS social_media_profiles JSONB,
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR,
      ADD COLUMN IF NOT EXISTS additional_info_requested TEXT,
      ADD COLUMN IF NOT EXISTS reapply_after_date TIMESTAMP
    `);

    await db.execute(alterTableSQL);
    console.log("[Migration] ✅ Added new columns to company_profiles");

    console.log("[Migration] ✅ Migration completed successfully!");
    console.log("[Migration] Company registration enhancement fields have been added to the database.");

    process.exit(0);
  } catch (error: any) {
    console.error("[Migration] ❌ Migration failed:", error);

    // Check if the value already exists
    if (error.message?.includes("already exists")) {
      console.log("[Migration] ℹ️  Some fields already exist in the table.");
      process.exit(0);
    }

    process.exit(1);
  }
}

runMigration();
