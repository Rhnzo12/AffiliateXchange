# Monthly Retainer Payment System

## Overview

The retainer payment system now supports **automated monthly payments** for active retainer contracts. Payments are processed automatically via PayPal (or other configured payment methods) and include proper fee calculations, transaction tracking, and notifications.

## How It Works

### 1. Deliverable-Based Payments (Existing)

When a company approves a deliverable submitted by a creator:

1. System calculates payment per video: `monthlyAmount / videosPerMonth`
2. Applies fees:
   - **Platform Fee**: 4% of gross amount
   - **Processing Fee**: 3% of gross amount
   - **Net Amount**: Gross - Platform Fee - Processing Fee
3. Creates retainer payment record with status `pending`
4. Validates creator has payment method configured
5. Processes payment via PayPal/bank/crypto using PaymentProcessor
6. Updates payment status to `completed` with transaction ID
7. Sends notification to creator with transaction details

**Example:**
- Monthly amount: $1,000
- Videos per month: 4
- Payment per video: $250
- Platform fee (4%): $10
- Processing fee (3%): $7.50
- Net to creator: $232.50

### 2. Monthly Automated Payments (NEW)

For active retainer contracts, payments can be automatically generated each month:

**Automated Processing (Scheduled):**
- Run on the 1st of each month via cron job
- Calls: `POST /api/admin/retainer-payments/process-monthly`
- Processes all active contracts automatically

**Manual Processing (Admin):**
- Admin can trigger from dashboard
- Process all contracts: `POST /api/admin/retainer-payments/process-monthly`
- Process single contract: `POST /api/admin/retainer-payments/process-contract/:contractId`

**Payment Flow:**
1. Finds all active retainer contracts (status=active, has assigned creator, within date range)
2. Calculates current month number based on start date
3. Checks if payment already exists for this month
4. Creates monthly payment with:
   - `payment_type`: 'monthly'
   - `month_number`: Current month (1, 2, 3, etc.)
   - Full fee calculations
5. Processes payment via PaymentProcessor
6. Sends notifications

## Database Schema

### Retainer Payments Table Enhancements

```sql
-- New columns added to retainer_payments table:
month_number integer                    -- Which month of the contract (1-12, etc.)
payment_type varchar                    -- 'deliverable', 'monthly', 'bonus'
gross_amount decimal(10, 2)            -- Full amount before fees
platform_fee_amount decimal(10, 2)     -- 4% platform fee
processing_fee_amount decimal(10, 2)   -- 3% processing fee
net_amount decimal(10, 2)              -- Amount creator receives
provider_transaction_id varchar        -- PayPal batch ID, bank TX ID, etc.
provider_response jsonb                -- Full payment provider response
payment_method varchar                 -- 'paypal', 'wire', 'crypto', 'etransfer'
initiated_at timestamp                 -- When payment processing started
completed_at timestamp                 -- When payment succeeded
failed_at timestamp                    -- When payment failed
```

## API Endpoints

### Creator Endpoints

**Get my retainer payments:**
```http
GET /api/retainer-payments/creator
Authorization: Bearer <token>
```

Returns all retainer payments for the authenticated creator.

### Company/Admin Endpoints

**Get payments for a specific contract:**
```http
GET /api/retainer-payments/contract/:contractId
Authorization: Bearer <token>
```

Returns all payments for a contract. Access controlled by role:
- **Creator**: Can only view if they're assigned to the contract
- **Company**: Can only view if it's their contract
- **Admin**: Can view any contract

### Admin Endpoints

**Process monthly payments for all active contracts:**
```http
POST /api/admin/retainer-payments/process-monthly
Authorization: Bearer <admin-token>
```

Response:
```json
{
  "success": true,
  "message": "Monthly retainer payment processing completed",
  "results": {
    "processed": 15,
    "failed": 2,
    "skipped": 3,
    "errors": [
      {
        "contractId": "abc-123",
        "error": "Creator has not configured payment method"
      }
    ]
  }
}
```

**Process monthly payment for specific contract:**
```http
POST /api/admin/retainer-payments/process-contract/:contractId
Authorization: Bearer <admin-token>
```

Response:
```json
{
  "success": true,
  "message": "Monthly payment processed successfully"
}
```

**Update retainer payment status:**
```http
PATCH /api/admin/retainer-payments/:id/status
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "status": "completed"
}
```

When status is `completed`, the payment is automatically processed via PayPal.

## Payment Processing

### PaymentProcessor Integration

The `PaymentProcessorService` now includes `processRetainerPayment()` method:

```typescript
// Process a retainer payment
const result = await paymentProcessor.processRetainerPayment(paymentId);

if (result.success) {
  // Payment sent successfully
  console.log('Transaction ID:', result.transactionId);
  console.log('Provider response:', result.providerResponse);
} else {
  // Payment failed
  console.error('Error:', result.error);
}
```

**Supported Payment Methods:**
- **PayPal**: Uses Payouts API to send money to creator's PayPal email
- **Wire Transfer**: Sends to creator's bank account (routing + account number)
- **Crypto**: Sends to creator's wallet address
- **E-Transfer**: Sends to creator's email

## Automated Scheduling

### Setting Up Cron Job

To run monthly payments automatically, set up a cron job:

**Using cron (Linux/Mac):**
```bash
# Run on 1st of each month at 9:00 AM
0 9 1 * * curl -X POST https://your-domain.com/api/admin/retainer-payments/process-monthly \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Using GitHub Actions:**
```yaml
name: Monthly Retainer Payments
on:
  schedule:
    - cron: '0 9 1 * *'  # 9 AM on 1st of month
  workflow_dispatch:      # Allow manual trigger

jobs:
  process-payments:
    runs-on: ubuntu-latest
    steps:
      - name: Process Monthly Payments
        run: |
          curl -X POST ${{ secrets.APP_URL }}/api/admin/retainer-payments/process-monthly \
            -H "Authorization: Bearer ${{ secrets.ADMIN_TOKEN }}"
```

**Using Replit Scheduled Jobs:**
```typescript
// .replit file or scheduled job
import fetch from 'node-fetch';

async function processMonthlyPayments() {
  const response = await fetch(
    `${process.env.APP_URL}/api/admin/retainer-payments/process-monthly`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.ADMIN_TOKEN}`
      }
    }
  );

  const result = await response.json();
  console.log('Monthly payment processing:', result);
}

// Run on 1st of each month
processMonthlyPayments();
```

## Error Handling

### Common Scenarios

**1. Creator has no payment method configured:**
- Payment is created with status `pending`
- Description updated with: "PENDING: Creator has not configured payment method"
- Notification sent to creator asking them to configure payment method

**2. Payment provider fails:**
- Payment status set to `failed`
- `failed_at` timestamp recorded
- Description updated with error message
- Admin can retry by updating status to `completed` via API

**3. Payment already exists for month:**
- Skipped (no duplicate payments created)
- Returned in `skipped` count

**4. Contract is not active:**
- Not included in processing
- No payment created

## Monitoring & Logging

All payment operations are logged with details:

```
[Retainer Scheduler] Starting monthly payment processing...
[Retainer Scheduler] Found 20 active retainer contracts
[Retainer Scheduler] Creating monthly payment for contract abc-123, month 3
[Retainer Scheduler] Created payment xyz-789 of $930.00 (net)
[Retainer Scheduler] Successfully processed payment xyz-789 - TX: PAYPAL-BATCH-123
[Notification] Sent retainer payment notification to creator john_doe
```

## Testing

### Test in Sandbox Mode

1. **Configure PayPal Sandbox:**
   - Ensure `PAYPAL_MODE=sandbox` in .env
   - Use sandbox credentials

2. **Create Test Data:**
   ```sql
   -- Create active retainer contract
   INSERT INTO retainer_contracts (
     company_id,
     title,
     monthly_amount,
     status,
     assigned_creator_id,
     start_date,
     duration_months
   ) VALUES (
     'company-id',
     'Test Contract',
     1000.00,
     'active',
     'creator-id',
     NOW(),
     12
   );
   ```

3. **Run Manual Processing:**
   ```bash
   curl -X POST http://localhost:5000/api/admin/retainer-payments/process-monthly \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

4. **Check Results:**
   - Payment created in database
   - PayPal Sandbox dashboard shows payout
   - Creator receives email from PayPal

## Fee Structure

**Current Fee Breakdown:**
- **Platform Fee**: 4% of gross amount
- **Processing Fee**: 3% of gross amount (PayPal/Stripe fees)
- **Total Fees**: 7% of gross amount
- **Net to Creator**: 93% of gross amount

**Example Calculation:**
```
Gross Amount:        $1,000.00
Platform Fee (4%):   -   $40.00
Processing Fee (3%): -   $30.00
-------------------------
Net to Creator:      $  930.00
```

## Security Considerations

1. **Payment Method Validation**: Always validates creator has payment method before processing
2. **Duplicate Prevention**: Checks for existing payments before creating new ones
3. **Transaction Tracking**: Stores provider transaction ID for reconciliation
4. **Audit Trail**: Full provider response stored in JSONB for compliance
5. **Role-Based Access**: Only admins can trigger automated payments
6. **Idempotent Operations**: Safe to retry failed payments

## Future Enhancements

Potential improvements:
- [ ] Retry logic for failed payments (3 attempts with exponential backoff)
- [ ] Email notifications to admins for failed batches
- [ ] Payment reconciliation dashboard
- [ ] Partial payment support (split monthly amount across multiple transactions)
- [ ] Currency conversion support for international payments
- [ ] Configurable fee percentages per contract
- [ ] Payment holds/escrow for dispute resolution

## Support

For issues or questions:
1. Check application logs for detailed error messages
2. Verify DATABASE_URL is configured correctly
3. Ensure PayPal credentials are valid
4. Review payment status in database
5. Contact support with transaction ID for specific payment issues
