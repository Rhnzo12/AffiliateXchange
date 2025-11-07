# Database Setup Guide

## Current Status

The payment processing system requires database migrations to add:
- `platform_funding_accounts` table (for storing platform bank accounts/wallets)
- `provider_transaction_id` column in payments table (stores PayPal batch ID, crypto hash, etc.)
- `provider_response` column in payments table (stores full API response for audit trail)

## Step 1: Get Your DATABASE_URL

Your application uses **Neon Database** (serverless PostgreSQL). To get your database connection string:

### Option A: From Neon Console
1. Go to https://console.neon.tech/
2. Log in to your account
3. Select your project (likely named "AffiliateXchange" or similar)
4. Click on "Connection Details"
5. Copy the connection string - it looks like:
   ```
   postgresql://username:password@ep-xxxx-xxxx.us-east-2.aws.neon.tech/dbname?sslmode=require
   ```

### Option B: From Replit (if using Replit)
1. Open your Replit project
2. Go to "Secrets" (lock icon in sidebar)
3. Look for `DATABASE_URL` secret
4. Copy the value

### Option C: From GitHub Secrets (if deploying via GitHub)
1. Go to your repository: https://github.com/Rhnzo12/AffiliateXchange
2. Settings → Secrets and variables → Actions
3. Find `DATABASE_URL` secret
4. You may need to create a new connection or retrieve from your deployment platform

## Step 2: Add DATABASE_URL to .env

1. Open the `.env` file in the root directory
2. Replace the empty `DATABASE_URL=` line with your actual connection string:
   ```env
   DATABASE_URL=postgresql://your-user:your-password@your-host.neon.tech/your-db?sslmode=require
   ```

3. Save the file

**Important:** Never commit the .env file to Git - it's already in .gitignore to protect your credentials.

## Step 3: Run the Migration

Once DATABASE_URL is configured, run the migration to create the missing tables:

```bash
npx tsx scripts/apply-migration-007.ts
```

Or alternatively, use psql directly:

```bash
psql $DATABASE_URL -f db/migrations/007_add_payment_processing.sql
```

You should see:
```
✅ Migration 007 applied successfully!

Created:
  - platform_funding_accounts table
  - payments.provider_transaction_id column
  - payments.provider_response column
  - Indexes for performance
```

## Step 4: Start the Application

After the migration succeeds, start your application:

```bash
npm run dev
```

The server should start without errors and you'll be able to:
- ✅ Manage platform funding accounts (Admin → Payment Settings → Platform Funding Accounts)
- ✅ Process actual payments via PayPal (sends real money in production, test money in sandbox)
- ✅ Track payment provider responses in the database
- ✅ View transaction IDs from PayPal/Stripe/crypto providers

## Troubleshooting

### Error: "DATABASE_URL must be set"
- Make sure you added the DATABASE_URL to .env file
- Check that there are no spaces around the `=` sign
- Verify the connection string is valid and complete

### Error: "relation 'platform_funding_accounts' does not exist"
- You need to run the migration (Step 3 above)
- Make sure the migration completed successfully

### Error: "connection refused" or "connection timeout"
- Check that your Neon database is active (not paused)
- Verify the connection string is correct
- Ensure your IP is allowed (Neon allows all IPs by default)

### Migration Already Applied
If you get an error that tables already exist, that's fine! The migration uses `IF NOT EXISTS` so it's safe to run multiple times.

## What's Next

Once the database is set up:

1. **Configure PayPal** (already done):
   - ✅ PAYPAL_CLIENT_ID configured
   - ✅ PAYPAL_CLIENT_SECRET configured
   - ✅ PAYPAL_MODE set to 'sandbox'

2. **Test Payment Flow**:
   - Create a test creator account
   - Add PayPal email to creator's payment settings
   - Create a payment as admin
   - Approve and complete the payment
   - Check that money is sent via PayPal Sandbox

3. **Go Live** (when ready):
   - Get production PayPal credentials
   - Change PAYPAL_MODE to 'live'
   - Update DATABASE_URL to production database
   - Test thoroughly before processing real money!

## Need Help?

If you encounter issues:
1. Check the error messages carefully
2. Verify all environment variables are set correctly
3. Check that your Neon database is active and accessible
4. Review the migration SQL file: `db/migrations/007_add_payment_processing.sql`
