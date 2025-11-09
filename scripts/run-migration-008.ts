#!/usr/bin/env tsx
/**
 * Script to run migration 008: Add payment_failed_insufficient_funds to notification_type enum
 * Usage: tsx --env-file=.env scripts/run-migration-008.ts
 */

import { db } from "../server/db";
import { sql } from "drizzle-orm";
import { readFileSync } from "fs";
import { join } from "path";

async function runMigration() {
  try {
    console.log("[Migration] Running migration 008: Add payment_failed_insufficient_funds to notification_type enum");

    // Read the migration file
    const migrationPath = join(process.cwd(), "db", "migrations", "008_add_insufficient_funds_notification.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("[Migration] Executing SQL...");

    // Execute the migration
    // Note: ADD VALUE requires a non-transactional context in PostgreSQL
    await db.execute(sql.raw(`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_failed_insufficient_funds'`));

    console.log("[Migration] ✅ Migration completed successfully!");
    console.log("[Migration] The 'payment_failed_insufficient_funds' notification type has been added to the database.");

    process.exit(0);
  } catch (error: any) {
    console.error("[Migration] ❌ Migration failed:", error);

    // Check if the value already exists
    if (error.message?.includes("already exists")) {
      console.log("[Migration] ℹ️  The value 'payment_failed_insufficient_funds' already exists in the enum.");
      process.exit(0);
    }

    process.exit(1);
  }
}

runMigration();
