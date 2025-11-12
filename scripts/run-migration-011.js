import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read DATABASE_URL from environment
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

console.log('🔄 Connecting to database...');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    // Read the migration file
    const migrationPath = join(__dirname, '../db/migrations/011_add_creator_requirements_fields.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    console.log('📝 Running migration 011: Add Creator Requirements Fields...\n');

    // Execute the migration
    await pool.query(migrationSQL);

    console.log('✅ Migration completed successfully!\n');

    // Verify the columns were added
    console.log('🔍 Verifying new columns...');
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'offers'
      AND column_name IN (
        'minimum_followers',
        'allowed_platforms',
        'geographic_restrictions',
        'age_restriction',
        'content_style_requirements',
        'brand_safety_requirements'
      )
      ORDER BY column_name;
    `);

    if (result.rows.length === 6) {
      console.log('✅ All 6 columns added successfully:');
      result.rows.forEach(row => {
        console.log(`   - ${row.column_name} (${row.data_type})`);
      });
    } else {
      console.log(`⚠️  Expected 6 columns, found ${result.rows.length}`);
      result.rows.forEach(row => {
        console.log(`   - ${row.column_name} (${row.data_type})`);
      });
    }

    console.log('\n✨ Migration complete! You can now:');
    console.log('   1. Restart your application');
    console.log('   2. Create a new offer with creator requirements');
    console.log('   3. View the offer to see the requirements displayed\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
