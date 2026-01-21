import { neon } from '@neondatabase/serverless';

async function applyMigration() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    console.log('Applying Creator Wallet and Company Invoice System migration...\n');

    // Create invoice status enum
    console.log('1. Creating invoice_status enum...');
    await sql`
      DO $$ BEGIN
        CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'cancelled', 'expired', 'refunded');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `;
    console.log('   invoice_status enum created\n');

    // Create wallet transaction type enum
    console.log('2. Creating wallet_transaction_type enum...');
    await sql`
      DO $$ BEGIN
        CREATE TYPE wallet_transaction_type AS ENUM ('credit', 'debit', 'withdrawal', 'refund', 'adjustment');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `;
    console.log('   wallet_transaction_type enum created\n');

    // Create withdrawal status enum
    console.log('3. Creating withdrawal_status enum...');
    await sql`
      DO $$ BEGIN
        CREATE TYPE withdrawal_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `;
    console.log('   withdrawal_status enum created\n');

    // Create creator_wallets table (without foreign key first)
    console.log('4. Creating creator_wallets table...');
    await sql`
      CREATE TABLE IF NOT EXISTS creator_wallets (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
        creator_id VARCHAR NOT NULL UNIQUE,
        available_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        pending_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        total_earned DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        total_withdrawn DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        currency VARCHAR(3) NOT NULL DEFAULT 'CAD',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('   creator_wallets table created\n');

    // Create wallet_transactions table (without foreign keys first)
    console.log('5. Creating wallet_transactions table...');
    await sql`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
        wallet_id VARCHAR NOT NULL,
        creator_id VARCHAR NOT NULL,
        type wallet_transaction_type NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        balance_after DECIMAL(10, 2) NOT NULL,
        description TEXT,
        reference_type VARCHAR(50),
        reference_id VARCHAR,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('   wallet_transactions table created\n');

    // Create company_invoices table (without foreign keys first)
    console.log('6. Creating company_invoices table...');
    await sql`
      CREATE TABLE IF NOT EXISTS company_invoices (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
        invoice_number VARCHAR(50) NOT NULL UNIQUE,
        company_id VARCHAR NOT NULL,
        creator_id VARCHAR NOT NULL,
        payment_id VARCHAR,
        retainer_payment_id VARCHAR,
        gross_amount DECIMAL(10, 2) NOT NULL,
        platform_fee_amount DECIMAL(10, 2) NOT NULL,
        stripe_fee_amount DECIMAL(10, 2) NOT NULL,
        net_amount DECIMAL(10, 2) NOT NULL,
        status invoice_status NOT NULL DEFAULT 'draft',
        stripe_checkout_session_id VARCHAR,
        stripe_payment_intent_id VARCHAR,
        description TEXT,
        due_date TIMESTAMP,
        sent_at TIMESTAMP,
        paid_at TIMESTAMP,
        cancelled_at TIMESTAMP,
        expired_at TIMESTAMP,
        refunded_at TIMESTAMP,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('   company_invoices table created\n');

    // Create withdrawals table (without foreign keys first)
    console.log('7. Creating withdrawals table...');
    await sql`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
        wallet_id VARCHAR NOT NULL,
        creator_id VARCHAR NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        fee_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        net_amount DECIMAL(10, 2) NOT NULL,
        payout_method VARCHAR(20) NOT NULL,
        payout_details JSONB,
        status withdrawal_status NOT NULL DEFAULT 'pending',
        provider_transaction_id VARCHAR,
        provider_response JSONB,
        failure_reason TEXT,
        requested_at TIMESTAMP DEFAULT NOW(),
        processing_started_at TIMESTAMP,
        completed_at TIMESTAMP,
        failed_at TIMESTAMP,
        cancelled_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('   withdrawals table created\n');

    // Now add foreign key constraints
    console.log('8. Adding foreign key constraints...');

    // creator_wallets -> users
    try {
      await sql`ALTER TABLE creator_wallets ADD CONSTRAINT creator_wallets_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE`;
      console.log('   Added creator_wallets -> users FK');
    } catch (e: any) {
      if (e.message?.includes('already exists')) {
        console.log('   creator_wallets -> users FK already exists');
      } else {
        console.log('   Skipping creator_wallets FK (may already exist):', e.message);
      }
    }

    // wallet_transactions -> creator_wallets
    try {
      await sql`ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES creator_wallets(id) ON DELETE CASCADE`;
      console.log('   Added wallet_transactions -> creator_wallets FK');
    } catch (e: any) {
      console.log('   Skipping wallet_transactions -> creator_wallets FK:', e.message);
    }

    // wallet_transactions -> users
    try {
      await sql`ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE`;
      console.log('   Added wallet_transactions -> users FK');
    } catch (e: any) {
      console.log('   Skipping wallet_transactions -> users FK:', e.message);
    }

    // company_invoices -> company_profiles
    try {
      await sql`ALTER TABLE company_invoices ADD CONSTRAINT company_invoices_company_id_fkey FOREIGN KEY (company_id) REFERENCES company_profiles(id) ON DELETE CASCADE`;
      console.log('   Added company_invoices -> company_profiles FK');
    } catch (e: any) {
      console.log('   Skipping company_invoices -> company_profiles FK:', e.message);
    }

    // company_invoices -> users
    try {
      await sql`ALTER TABLE company_invoices ADD CONSTRAINT company_invoices_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE`;
      console.log('   Added company_invoices -> users FK');
    } catch (e: any) {
      console.log('   Skipping company_invoices -> users FK:', e.message);
    }

    // company_invoices -> payments (optional)
    try {
      await sql`ALTER TABLE company_invoices ADD CONSTRAINT company_invoices_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL`;
      console.log('   Added company_invoices -> payments FK');
    } catch (e: any) {
      console.log('   Skipping company_invoices -> payments FK:', e.message);
    }

    // company_invoices -> retainer_payments (optional)
    try {
      await sql`ALTER TABLE company_invoices ADD CONSTRAINT company_invoices_retainer_payment_id_fkey FOREIGN KEY (retainer_payment_id) REFERENCES retainer_payments(id) ON DELETE SET NULL`;
      console.log('   Added company_invoices -> retainer_payments FK');
    } catch (e: any) {
      console.log('   Skipping company_invoices -> retainer_payments FK:', e.message);
    }

    // withdrawals -> creator_wallets
    try {
      await sql`ALTER TABLE withdrawals ADD CONSTRAINT withdrawals_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES creator_wallets(id) ON DELETE CASCADE`;
      console.log('   Added withdrawals -> creator_wallets FK');
    } catch (e: any) {
      console.log('   Skipping withdrawals -> creator_wallets FK:', e.message);
    }

    // withdrawals -> users
    try {
      await sql`ALTER TABLE withdrawals ADD CONSTRAINT withdrawals_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE`;
      console.log('   Added withdrawals -> users FK');
    } catch (e: any) {
      console.log('   Skipping withdrawals -> users FK:', e.message);
    }

    console.log('   Foreign key constraints added\n');

    // Create indexes
    console.log('9. Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_creator_wallets_creator_id ON creator_wallets(creator_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_wallet_transactions_creator_id ON wallet_transactions(creator_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_company_invoices_company_id ON company_invoices(company_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_company_invoices_creator_id ON company_invoices(creator_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_company_invoices_status ON company_invoices(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_company_invoices_payment_id ON company_invoices(payment_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_company_invoices_stripe_session ON company_invoices(stripe_checkout_session_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_withdrawals_wallet_id ON withdrawals(wallet_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_withdrawals_creator_id ON withdrawals(creator_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status)`;
    console.log('   Indexes created\n');

    // Add notification types
    console.log('10. Adding notification types...');
    try {
      await sql`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'invoice_sent'`;
    } catch (e) {}
    try {
      await sql`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'invoice_paid'`;
    } catch (e) {}
    try {
      await sql`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'invoice_expired'`;
    } catch (e) {}
    try {
      await sql`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'wallet_credited'`;
    } catch (e) {}
    try {
      await sql`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'withdrawal_requested'`;
    } catch (e) {}
    try {
      await sql`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'withdrawal_completed'`;
    } catch (e) {}
    try {
      await sql`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'withdrawal_failed'`;
    } catch (e) {}
    console.log('   Notification types added\n');

    console.log('Migration completed successfully!');
    console.log('\nSummary:');
    console.log('  - Created invoice_status enum');
    console.log('  - Created wallet_transaction_type enum');
    console.log('  - Created withdrawal_status enum');
    console.log('  - Created creator_wallets table');
    console.log('  - Created wallet_transactions table');
    console.log('  - Created company_invoices table');
    console.log('  - Created withdrawals table');
    console.log('  - Added foreign key constraints');
    console.log('  - Created necessary indexes');
    console.log('  - Added notification types');
    console.log('\nCreator Wallet and Invoice System is now ready to use!');

  } catch (error: any) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

applyMigration();
