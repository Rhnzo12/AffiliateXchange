// Migration runner
import { pool } from '../db';

async function runMigrations() {
  console.log('[Migrations] Starting migrations...');

  try {
    // Import and run the notification enum migration
    const { up } = await import('./add-notification-enum-values');
    await up();

    console.log('[Migrations] All migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('[Migrations] Error running migrations:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
