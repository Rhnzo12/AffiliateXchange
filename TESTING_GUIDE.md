# Testing Guide - 8 Major Features

This guide provides step-by-step testing instructions for all 8 implemented features.

## Prerequisites

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Test accounts needed:**
   - Admin account
   - Company account (with verified email)
   - Creator account (with verified email)
   - Unverified user account

3. **Required setup:**
   - SendGrid API key configured in `.env`
   - Stripe API keys configured for payment testing
   - Database running and migrated

---

## Feature 1: Video Upload Enforcement (6-12 Videos)

### Test Case 1.1: Create Draft Offer
**User:** Company (verified)

1. Navigate to "Create Offer" page
2. Fill in offer details:
   - Title: "Test Affiliate Campaign"
   - Description: "Test description"
   - Commission: $100
   - Category: Select any
3. Upload **5 videos** (below minimum)
4. Click "Create Offer"
5. **Expected:** Offer created as "draft" status

### Test Case 1.2: Submit with Insufficient Videos
**User:** Same company

1. Go to "My Offers" → find the draft offer
2. Click "Submit for Review"
3. **Expected:** Error message: "Please upload between 6 and 12 videos"
4. Status remains "draft"

### Test Case 1.3: Submit with Valid Video Count
1. Edit the offer
2. Upload **1 more video** (total 6)
3. Click "Submit for Review"
4. **Expected:**
   - Success message
   - Status changes to "pending_review"
   - Offer appears in admin review queue

### Test Case 1.4: Submit with Maximum Videos
1. Create new offer
2. Upload **12 videos**
3. Submit for review
4. **Expected:** Success

### Test Case 1.5: Submit with Too Many Videos
1. Create new offer
2. Upload **13 videos**
3. Submit for review
4. **Expected:** Error: "Maximum 12 videos allowed"

**API Endpoint:** `POST /api/offers/:id/submit-for-review`

---

## Feature 2: Email Verification System

### Test Case 2.1: Register New User
1. Go to registration page
2. Fill in details:
   - Username: "testuser123"
   - Email: "your-test-email@example.com"
   - Password: "SecurePass123!"
   - Role: Creator
3. Click "Register"
4. **Expected:**
   - Success message: "Please check your email to verify your account"
   - Verification email sent to inbox
   - User created but `emailVerified` = false

### Test Case 2.2: Verify Email
1. Check email inbox for verification email
2. Click verification link
3. **Expected:**
   - Redirect to login page
   - Success message: "Email verified successfully"
   - User's `emailVerified` = true

### Test Case 2.3: Expired Verification Token
1. Register new user
2. Wait 25+ hours (or manually update token expiry in DB)
3. Click verification link
4. **Expected:** Error: "Verification token has expired"

### Test Case 2.4: Request Password Reset
1. Go to login page
2. Click "Forgot Password?"
3. Enter email address
4. **Expected:**
   - Email sent with reset link
   - Token expires in 1 hour

### Test Case 2.5: Reset Password
1. Click reset link from email
2. Enter new password
3. **Expected:**
   - Success message
   - Can login with new password
   - Token invalidated after use

### Test Case 2.6: Expired Reset Token
1. Request password reset
2. Wait 61+ minutes
3. Try to use reset link
4. **Expected:** Error: "Reset token has expired"

**API Endpoints:**
- `POST /api/auth/verify-email?token=<token>`
- `POST /api/auth/request-password-reset`
- `POST /api/auth/reset-password`
- `POST /api/auth/resend-verification`

---

## Feature 3: Priority Listing Feature ($199/month)

### Test Case 3.1: Purchase Priority Listing
**User:** Company with approved offer

1. Go to "My Offers"
2. Find an approved offer
3. Click "Upgrade to Priority"
4. **Expected:**
   - Stripe checkout modal appears
   - Amount: $199.00
   - Description: "Priority Listing - 30 days"

### Test Case 3.2: Complete Payment
1. Use Stripe test card: `4242 4242 4242 4242`
2. Expiry: Any future date
3. CVC: Any 3 digits
4. Complete payment
5. **Expected:**
   - Success message
   - `isPriorityListing` = true
   - `priorityExpiresAt` = 30 days from now
   - Payment record created

### Test Case 3.3: Verify Priority Badge
1. Logout
2. Go to "Browse Offers"
3. **Expected:**
   - Priority offer shows gold "PRIORITY" badge
   - Appears at top of search results
   - Badge visible in grid and list views

### Test Case 3.4: Check Expiration Warning
**User:** Company with priority listing expiring in 5 days

1. Login as company
2. Go to "My Offers"
3. **Expected:**
   - Yellow warning badge: "Expires in 5 days"
   - "Renew Priority" button visible

### Test Case 3.5: Renew Priority Listing
1. Click "Renew Priority"
2. Complete payment
3. **Expected:**
   - New expiry date = old expiry + 30 days
   - No gap in priority status

### Test Case 3.6: Automated Expiration (Scheduler)
**Note:** Scheduler runs daily at 2 AM

1. Manually run scheduler:
   ```bash
   # In server console or create test script
   await schedulerService.checkPriorityListingExpirations();
   ```
2. **Expected:**
   - Expired listings: `isPriorityListing` = false
   - Email sent 7 days before expiration
   - Email sent on expiration day

**API Endpoints:**
- `POST /api/offers/:id/purchase-priority`
- `POST /api/stripe/create-priority-checkout`
- `POST /api/stripe/webhook` (handles payment confirmation)

---

## Feature 4: GDPR/CCPA Compliance

### Test Case 4.1: Cookie Consent Banner
1. Open site in incognito/private mode
2. **Expected:**
   - Cookie consent banner appears at bottom
   - "Accept All" and "Reject All" buttons
   - Link to privacy policy

### Test Case 4.2: Accept Cookies
1. Click "Accept All"
2. **Expected:**
   - Banner disappears
   - Consent stored in localStorage
   - Analytics/tracking cookies enabled

### Test Case 4.3: Privacy Settings Page
**User:** Any logged-in user

1. Go to Profile → Privacy Settings
2. **Expected:**
   - Toggle switches for:
     - Email notifications
     - Marketing emails
     - Data collection
   - "Export My Data" button
   - "Delete Account" button (red, dangerous)

### Test Case 4.4: Export User Data
1. Click "Export My Data"
2. **Expected:**
   - JSON file downloads
   - Filename: `user-data-{userId}-{timestamp}.json`
   - Contains:
     - Profile info
     - Offers created
     - Applications
     - Messages
     - Notifications
     - Payment settings (sanitized)
     - Reviews written

### Test Case 4.5: Verify Export Data Structure
1. Open downloaded JSON
2. **Expected structure:**
   ```json
   {
     "profile": { ... },
     "offers": [ ... ],
     "applications": [ ... ],
     "conversations": [ ... ],
     "messages": [ ... ],
     "notifications": [ ... ],
     "paymentSettings": [ ... ],
     "notificationPreferences": { ... }
   }
   ```

### Test Case 4.6: Delete Account - Validation
**User:** Creator with active application

1. Click "Delete Account"
2. Enter password
3. **Expected:** Error: "Cannot delete account with active applications"

### Test Case 4.7: Delete Account - Success
**User:** User with no active campaigns

1. Click "Delete Account"
2. Enter password
3. Confirm deletion
4. **Expected:**
   - Confirmation email sent
   - Personal data anonymized:
     - Email → `deleted-{userId}@deleted.user`
     - Name → null
     - Profile image → null
     - Password → null
   - Account status → "banned"
   - Payment settings deleted
   - Notifications deleted
   - Reviews anonymized (content kept)
   - Logged out automatically

### Test Case 4.8: Verify Account Deletion
1. Try to login with old credentials
2. **Expected:** Error: "Account not found" or "Account disabled"

**API Endpoints:**
- `GET /api/user/export-data`
- `POST /api/user/delete-account`
- `GET /api/user/privacy-settings`
- `PUT /api/user/privacy-settings`

---

## Feature 5: Payment Method Validation

### Test Case 5.1: Company Without Payment Method
**User:** Admin

1. Login as admin
2. Go to "Admin Panel" → "Review Offers"
3. Find offer from company without payment settings
4. **Expected:**
   - Red warning badge: "⚠️ No Payment Method"
   - "Approve" button disabled or shows warning
   - Tooltip: "Company must add payment method before approval"

### Test Case 5.2: Attempt to Approve Without Payment
1. Try to click "Approve"
2. **Expected:**
   - Error message: "Cannot approve. Company must set up payment method first."
   - Status remains "pending_review"

### Test Case 5.3: Company Adds Payment Method
**User:** Company

1. Login as company
2. Go to "Payment Settings"
3. Add PayPal or Stripe account
4. Save settings

### Test Case 5.4: Admin Can Now Approve
**User:** Admin

1. Refresh admin panel
2. Find same offer
3. **Expected:**
   - Warning badge removed
   - ✓ Green checkmark: "Payment Method Verified"
   - "Approve" button enabled

### Test Case 5.5: Approve Offer
1. Click "Approve"
2. **Expected:**
   - Success message
   - Offer status → "approved"
   - Offer visible in public browse

**Code Location:** `server/routes.ts` (Admin approve endpoint)

---

## Feature 6: Review Auto-Prompt

### Test Case 6.1: Complete First Campaign
**User:** Creator with active application

1. Login as creator
2. Navigate to "My Applications"
3. Mark application as "completed"
4. **Expected:**
   - Modal appears automatically
   - Title: "How was your experience?"
   - Message: "We'd love to hear about your campaign with [Company Name]"
   - "Leave Review" button
   - "Maybe Later" button

### Test Case 6.2: Click "Leave Review"
1. Click "Leave Review" in modal
2. **Expected:**
   - Redirect to review form
   - Pre-filled:
     - Company name
     - Campaign name
   - Rating field (1-5 stars)
   - Comment textarea

### Test Case 6.3: Submit Review
1. Select 5 stars
2. Write comment: "Great experience working with this company!"
3. Submit
4. **Expected:**
   - Review saved
   - Appears on company profile
   - Creator's profile shows "Reviews Given"

### Test Case 6.4: Dismiss Modal
1. Complete another campaign
2. Click "Maybe Later"
3. **Expected:**
   - Modal closes
   - Can still leave review manually later

### Test Case 6.5: No Modal for Subsequent Completions
1. Complete 2nd, 3rd campaigns
2. **Expected:**
   - Modal only appears after FIRST completion
   - Flag stored: `hasSeenReviewPrompt = true`

**Code Location:** `client/src/components/ReviewPromptModal.tsx`

---

## Feature 7: Canned Response Templates

### Test Case 7.1: Access Templates
**User:** Company

1. Login as company
2. Go to "Messages"
3. Open conversation with a creator
4. **Expected:**
   - "Templates" dropdown button visible
   - Click to see 5 templates

### Test Case 7.2: Use "Application Approved" Template
1. Select "Application Approved" template
2. **Expected:** Message box fills with:
   ```
   Hi [Creator Name],

   Great news! We've approved your application for our [Campaign Name] campaign.

   Looking forward to working with you!

   Best regards,
   [Company Name]
   ```

### Test Case 7.3: Auto-Personalization
1. **Expected variables replaced:**
   - `[Creator Name]` → Actual creator's first name
   - `[Campaign Name]` → Actual offer title
   - `[Company Name]` → Company's business name

### Test Case 7.4: All 5 Templates
**Verify all templates work:**

1. ✅ Application Approved
2. ✅ Application Rejected
3. ✅ Request for More Info
4. ✅ Campaign Update
5. ✅ Payment Processed

### Test Case 7.5: Edit Before Sending
1. Select any template
2. Edit the auto-filled message
3. Send
4. **Expected:**
   - Can modify template before sending
   - Sends edited version

**Code Location:** `client/src/components/CannedResponses.tsx`

---

## Feature 8: Priority Listing Scheduler

### Test Case 8.1: Verify Scheduler is Running
1. Check server logs on startup
2. **Expected:**
   ```
   [Scheduler] Priority listing expiration check scheduled for 2:00 AM daily
   [Scheduler] Initialized successfully
   ```

### Test Case 8.2: Manual Scheduler Run
**Run scheduler manually for testing:**

```bash
# In server console or create test endpoint
curl http://localhost:5000/api/admin/run-scheduler
```

**Expected:**
- Checks all priority listings
- Expires listings where `priorityExpiresAt` < now
- Sends reminder emails (7 days before)

### Test Case 8.3: Expiration Reminder Email (7 Days)
**Setup:** Create priority listing with `priorityExpiresAt` = 7 days from now

1. Run scheduler
2. Check email inbox
3. **Expected email:**
   - Subject: "Your Priority Listing Expires Soon"
   - Body: "Your priority listing for [Offer Title] expires in 7 days"
   - "Renew Now" button (links to renewal page)

### Test Case 8.4: Expiration Email (Day Of)
**Setup:** Priority listing expires today

1. Run scheduler
2. **Expected email:**
   - Subject: "Your Priority Listing Has Expired"
   - Body: "Your priority listing for [Offer Title] has expired"
   - Offer no longer shows PRIORITY badge

### Test Case 8.5: Database Updates
1. Run scheduler
2. Query database:
   ```sql
   SELECT id, title, isPriorityListing, priorityExpiresAt
   FROM offers
   WHERE priorityExpiresAt < NOW()
   ```
3. **Expected:**
   - All expired listings have `isPriorityListing = false`
   - `priorityExpiresAt` remains (for history)

### Test Case 8.6: Verify Daily Schedule
1. Check cron job or scheduler config
2. **Expected:**
   - Runs daily at 2:00 AM server time
   - Uses node-cron or similar

**Code Location:**
- `server/services/SchedulerService.ts`
- `server/index.ts` (initialization)

---

## Integration Testing Scenarios

### Scenario 1: End-to-End Creator Journey
1. Register as creator (Feature 2)
2. Verify email (Feature 2)
3. Apply to priority offer (Feature 3)
4. Complete campaign (Feature 6)
5. Leave review via auto-prompt (Feature 6)
6. Export data (Feature 4)

### Scenario 2: End-to-End Company Journey
1. Register as company (Feature 2)
2. Verify email (Feature 2)
3. Add payment method (Feature 5)
4. Create offer with 8 videos (Feature 1)
5. Submit for review (Feature 1)
6. Get approved by admin (Feature 5)
7. Purchase priority listing (Feature 3)
8. Use canned responses (Feature 7)
9. Renew priority before expiration (Feature 8)

### Scenario 3: Admin Workflow
1. Review offers with payment validation (Feature 5)
2. Approve offers (Feature 1, 5)
3. Monitor priority listings
4. Run manual scheduler checks (Feature 8)

---

## Automated Testing Commands

### Run Type Checks
```bash
npm run check
```

### Run Database Migrations
```bash
npm run db:push
```

### Test Payment System
```bash
npm run payment:test
```

### Seed Payment Data
```bash
npm run payment:seed
```

---

## Known Issues to Verify Fixed

1. ✅ `storage.getNotificationsByUser` → Fixed to `getNotifications`
2. ✅ `storage.getPaymentSettingsByUser` → Fixed to `getPaymentSettings`

---

## Test Data Needed

Create these test accounts:

```
Admin:
  - Email: admin@test.com
  - Password: Admin123!

Company 1:
  - Email: company1@test.com
  - Password: Company123!
  - Has payment method: Yes

Company 2:
  - Email: company2@test.com
  - Password: Company123!
  - Has payment method: No

Creator 1:
  - Email: creator1@test.com
  - Password: Creator123!
  - Email verified: Yes

Creator 2:
  - Email: creator2@test.com
  - Password: Creator123!
  - Email verified: No
```

---

## Success Criteria

All features pass when:

- ✅ All test cases pass without errors
- ✅ Email notifications send successfully
- ✅ Payment flows complete in Stripe
- ✅ Data export contains all user data
- ✅ Account deletion properly anonymizes PII
- ✅ Priority badges display correctly
- ✅ Scheduler runs without crashes
- ✅ No console errors during normal operation

---

## Reporting Issues

If any test fails:

1. Note the test case number
2. Copy exact error message
3. Include browser/environment details
4. Check server logs for backend errors
5. Verify .env configuration is complete
