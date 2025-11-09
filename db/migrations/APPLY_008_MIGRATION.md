# Apply Migration 008: Add payment_failed_insufficient_funds Notification Type

## Problem
The database error:
```
invalid input value for enum notification_type: "payment_failed_insufficient_funds"
```

This occurs because the `notification_type` enum in the database doesn't include the `payment_failed_insufficient_funds` value.

## Solution
Run the migration to add this value to the enum.

## How to Run the Migration

### Option 1: Using the migration script (Recommended)
```bash
npx tsx scripts/run-migration-008.ts
```

### Option 2: Using psql command line
```bash
psql $DATABASE_URL -f db/migrations/008_add_insufficient_funds_notification.sql
```

### Option 3: Direct SQL (if you have database access)
Connect to your PostgreSQL database and run:
```sql
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_failed_insufficient_funds';
```

### Option 4: Using your database client (Neon, Supabase, etc.)
1. Open your database client (e.g., Neon Console, pgAdmin, DBeaver)
2. Connect to your database
3. Execute this SQL:
   ```sql
   ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_failed_insufficient_funds';
   ```

## Verification
After running the migration:
1. Restart your server
2. Trigger an insufficient funds notification
3. Check the logs - you should see:
   ```
   [Storage] Notification created successfully: ...
   [Notifications] In-app notification created for user...
   ```
4. Check the company's notification bell - it should show the notification!

## What This Fixes
- ✅ In-app notifications for insufficient funds will be created and saved to database
- ✅ Company users will see notifications in the notification bell
- ✅ Clicking notifications will navigate to payment details
- ✅ Email notifications already work (this fixes the in-app part)
