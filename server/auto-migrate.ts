/**
 * Auto-migration utility that runs on server startup
 * Adds missing columns to the offers table if they don't exist
 */

import { pool } from "./db";

export async function runAutoMigrations() {
  console.log('🔄 Checking for required database migrations...');

  const client = await pool.connect();

  try {
    // Check if new columns exist
    const result = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'offers'
      AND column_name IN (
        'rejected_at',
        'rejection_reason',
        'featured_on_homepage',
        'listing_fee',
        'edit_requests'
      );
    `);

    const existingColumns = result.rows.map(row => row.column_name);
    const requiredColumns = [
      'rejected_at',
      'rejection_reason',
      'featured_on_homepage',
      'listing_fee',
      'edit_requests'
    ];

    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

    if (missingColumns.length === 0) {
      console.log('✓ All offer management columns exist');
      return;
    }

    console.log(`⚠️  Missing columns: ${missingColumns.join(', ')}`);
    console.log('🔧 Adding missing columns...');

    // Add missing columns
    if (!existingColumns.includes('rejected_at')) {
      await client.query('ALTER TABLE offers ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP;');
      console.log('  ✓ Added rejected_at');
    }

    if (!existingColumns.includes('rejection_reason')) {
      await client.query('ALTER TABLE offers ADD COLUMN IF NOT EXISTS rejection_reason TEXT;');
      console.log('  ✓ Added rejection_reason');
    }

    if (!existingColumns.includes('featured_on_homepage')) {
      await client.query('ALTER TABLE offers ADD COLUMN IF NOT EXISTS featured_on_homepage BOOLEAN DEFAULT false;');
      console.log('  ✓ Added featured_on_homepage');
    }

    if (!existingColumns.includes('listing_fee')) {
      await client.query('ALTER TABLE offers ADD COLUMN IF NOT EXISTS listing_fee NUMERIC(10, 2) DEFAULT 0;');
      console.log('  ✓ Added listing_fee');
    }

    if (!existingColumns.includes('edit_requests')) {
      await client.query(`ALTER TABLE offers ADD COLUMN IF NOT EXISTS edit_requests JSONB DEFAULT '[]'::jsonb;`);
      console.log('  ✓ Added edit_requests');
    }

    // Check if notification types need updating
    console.log('🔄 Checking notification types...');
    const notifResult = await client.query(`
      SELECT unnest(enum_range(NULL::notification_type))::text as enum_value;
    `);

    const existingNotifTypes = notifResult.rows.map(row => row.enum_value);
    const requiredNotifTypes = ['offer_edit_requested', 'offer_removed'];
    const missingNotifTypes = requiredNotifTypes.filter(t => !existingNotifTypes.includes(t));

    if (missingNotifTypes.length > 0) {
      console.log(`⚠️  Missing notification types: ${missingNotifTypes.join(', ')}`);
      console.log('🔧 Adding notification types...');

      for (const notifType of missingNotifTypes) {
        try {
          await client.query(`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS '${notifType}';`);
          console.log(`  ✓ Added ${notifType}`);
        } catch (error) {
          // Value might already exist, ignore error
          console.log(`  ℹ️  ${notifType} may already exist`);
        }
      }
    } else {
      console.log('✓ All notification types exist');
    }

    console.log('✅ Database migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}
