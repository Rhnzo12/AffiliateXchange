import { db } from "./server/db.js";
import { sql } from "drizzle-orm";

async function verifyColumn() {
  try {
    const result = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'messages' AND column_name = 'attachments'
    `);
    
    if (result.rows.length > 0) {
      console.log("✅ Attachments column exists!");
      console.log(result.rows[0]);
    } else {
      console.log("❌ Attachments column does NOT exist");
      console.log("Running migration now...");
      
      await db.execute(sql`
        ALTER TABLE messages
        ADD COLUMN IF NOT EXISTS attachments text[] DEFAULT ARRAY[]::text[]
      `);
      
      console.log("✅ Migration completed!");
    }
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

verifyColumn();
