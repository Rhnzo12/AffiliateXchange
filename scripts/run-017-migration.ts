import { db } from '../server/storage';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  try {
    console.log('Running migration 017_add_password_change_otp.sql...');

    const migrationPath = path.join(process.cwd(), 'db/migrations/017_add_password_change_otp.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.includes('ALTER TABLE') || statement.includes('CREATE INDEX')) {
        console.log(`Executing: ${statement.substring(0, 60)}...`);
        await db.execute(sql.raw(statement));
      }
    }

    console.log('✅ Migration completed successfully!');
    console.log('You can now restart your server.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
