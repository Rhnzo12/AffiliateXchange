import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Migration: Add missing columns to reviews table
 * Adds all review management columns that are in schema but missing from database
 */
export async function addMissingReviewColumns() {
  try {
    console.log("Adding missing columns to reviews table...");

    await db.execute(sql`
      ALTER TABLE reviews
      ADD COLUMN IF NOT EXISTS admin_response text,
      ADD COLUMN IF NOT EXISTS responded_at timestamp,
      ADD COLUMN IF NOT EXISTS responded_by varchar REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS is_edited boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS admin_note text,
      ADD COLUMN IF NOT EXISTS is_approved boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS approved_by varchar,
      ADD COLUMN IF NOT EXISTS approved_at timestamp,
      ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false
    `);

    console.log("✅ Successfully added all missing columns to reviews table");
  } catch (error) {
    console.error("❌ Error adding columns:", error);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  addMissingReviewColumns()
    .then(() => {
      console.log("Migration completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
