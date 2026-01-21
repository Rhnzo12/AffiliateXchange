import { neon } from '@neondatabase/serverless';

async function applyMigration() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    console.log('Applying Affiliate Sales Tracking migration...\n');

    // Create affiliate order status enum
    console.log('1. Creating affiliate_order_status enum...');
    await sql`
      DO $$ BEGIN
        CREATE TYPE affiliate_order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'returned', 'refunded');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `;
    console.log('   affiliate_order_status enum created\n');

    // Create affiliate_sales table
    console.log('2. Creating affiliate_sales table...');
    await sql`
      CREATE TABLE IF NOT EXISTS affiliate_sales (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
        application_id VARCHAR NOT NULL,
        offer_id VARCHAR NOT NULL,
        creator_id VARCHAR NOT NULL,
        company_id VARCHAR NOT NULL,

        -- External order info
        external_order_id VARCHAR NOT NULL,
        external_platform VARCHAR,

        -- Order details
        order_amount DECIMAL(10, 2) NOT NULL,
        order_currency VARCHAR(3) DEFAULT 'CAD',
        item_name VARCHAR,
        item_quantity INTEGER DEFAULT 1,

        -- Commission calculation
        commission_type VARCHAR NOT NULL,
        commission_rate DECIMAL(10, 2),
        commission_amount DECIMAL(10, 2) NOT NULL,

        -- Order status tracking
        order_status affiliate_order_status NOT NULL DEFAULT 'pending',
        status_history JSONB DEFAULT '[]'::jsonb,

        -- Hold period
        hold_period_days INTEGER DEFAULT 14,
        hold_expires_at TIMESTAMP,

        -- Payment tracking
        payment_id VARCHAR,
        commission_released BOOLEAN DEFAULT FALSE,
        commission_released_at TIMESTAMP,

        -- Metadata
        customer_email VARCHAR,
        tracking_code VARCHAR,
        click_event_id VARCHAR,
        metadata JSONB,

        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('   affiliate_sales table created\n');

    // Add foreign key constraints
    console.log('3. Adding foreign key constraints...');

    try {
      await sql`ALTER TABLE affiliate_sales ADD CONSTRAINT affiliate_sales_application_id_fkey FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE`;
      console.log('   Added affiliate_sales -> applications FK');
    } catch (e: any) {
      console.log('   Skipping applications FK:', e.message);
    }

    try {
      await sql`ALTER TABLE affiliate_sales ADD CONSTRAINT affiliate_sales_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE`;
      console.log('   Added affiliate_sales -> offers FK');
    } catch (e: any) {
      console.log('   Skipping offers FK:', e.message);
    }

    try {
      await sql`ALTER TABLE affiliate_sales ADD CONSTRAINT affiliate_sales_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE`;
      console.log('   Added affiliate_sales -> users FK');
    } catch (e: any) {
      console.log('   Skipping users FK:', e.message);
    }

    try {
      await sql`ALTER TABLE affiliate_sales ADD CONSTRAINT affiliate_sales_company_id_fkey FOREIGN KEY (company_id) REFERENCES company_profiles(id) ON DELETE CASCADE`;
      console.log('   Added affiliate_sales -> company_profiles FK');
    } catch (e: any) {
      console.log('   Skipping company_profiles FK:', e.message);
    }

    try {
      await sql`ALTER TABLE affiliate_sales ADD CONSTRAINT affiliate_sales_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL`;
      console.log('   Added affiliate_sales -> payments FK');
    } catch (e: any) {
      console.log('   Skipping payments FK:', e.message);
    }

    console.log('   Foreign key constraints added\n');

    // Create indexes
    console.log('4. Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_affiliate_sales_application_id ON affiliate_sales(application_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_affiliate_sales_offer_id ON affiliate_sales(offer_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_affiliate_sales_creator_id ON affiliate_sales(creator_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_affiliate_sales_company_id ON affiliate_sales(company_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_affiliate_sales_external_order_id ON affiliate_sales(external_order_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_affiliate_sales_tracking_code ON affiliate_sales(tracking_code)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_affiliate_sales_order_status ON affiliate_sales(order_status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_affiliate_sales_commission_released ON affiliate_sales(commission_released)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_affiliate_sales_hold_expires_at ON affiliate_sales(hold_expires_at)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_affiliate_sales_created_at ON affiliate_sales(created_at)`;
    console.log('   Indexes created\n');

    console.log('Migration completed successfully!');
    console.log('\nSummary:');
    console.log('  - Created affiliate_order_status enum');
    console.log('  - Created affiliate_sales table');
    console.log('  - Added foreign key constraints');
    console.log('  - Created indexes');
    console.log('\nAutomatic Commission System is now ready to use!');
    console.log('\nWebhook endpoints:');
    console.log('  - POST /api/webhooks/affiliate-sale - Record new sales');
    console.log('  - POST /api/webhooks/affiliate-order-status - Update order status');
    console.log('  - GET /api/affiliate-sales - View affiliate sales');
    console.log('  - POST /api/admin/process-commission-holds - Process expired holds');

  } catch (error: any) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

applyMigration();
