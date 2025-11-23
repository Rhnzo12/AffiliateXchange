import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Migration: Add admin_response field to reviews table
 * Allows admins to add platform-level responses to reviews
 */
export async function addAdminResponseToReviews() {
  try {
    console.log("Adding admin_response column to reviews table...");

    await db.execute(sql`
      ALTER TABLE reviews
      ADD COLUMN IF NOT EXISTS admin_response text
    `);

    console.log("✅ Successfully added admin_response column to reviews table");
  } catch (error) {
    console.error("❌ Error adding admin_response column:", error);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  addAdminResponseToReviews()
    .then(() => {
      console.log("Migration completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
