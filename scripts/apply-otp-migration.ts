import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function applyMigration() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    console.log('📝 Reading migration file...');
    const migrationPath = join(__dirname, '../db/migrations/016_add_account_deletion_otp.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('🚀 Applying OTP migration...');

    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        await sql(statement);
        console.log('✓', statement.split('\n')[0].substring(0, 60) + '...');
      }
    }

    console.log('✅ Migration completed successfully!');
    console.log('\n📋 Summary:');
    console.log('  • Added account_deletion_otp column');
    console.log('  • Added account_deletion_otp_expiry column');
    console.log('  • Created index for faster OTP lookups');
    console.log('\n🎉 Account deletion with OTP is now ready to use!');

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

applyMigration();
