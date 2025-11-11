# Testing Previously Partial/Incomplete Features

This guide focuses on testing the **8 features** that were marked as PARTIAL or NOT IMPLEMENTED in the original specification review but have since been completed.

---

## Overview of Fixed Features

| Feature | Previous Status | Current Status | Priority |
|---------|----------------|----------------|----------|
| 1. Video Upload Enforcement (6-12) | ⚠️ PARTIAL | ✅ COMPLETE | 🔴 CRITICAL |
| 2. Email Verification System | ❌ NOT IMPLEMENTED | ✅ COMPLETE | 🔴 CRITICAL |
| 3. Priority Listing Purchase | ⚠️ PARTIAL | ✅ COMPLETE | 🔴 CRITICAL |
| 4. GDPR/CCPA Compliance | ⚠️ PARTIAL | ✅ COMPLETE | 🔴 CRITICAL |
| 5. Payment Method Validation | ❌ NOT IMPLEMENTED | ✅ COMPLETE | 🟠 HIGH |
| 6. Review Auto-Prompt | ⚠️ PARTIAL | ✅ COMPLETE | 🟠 HIGH |
| 7. Canned Response Templates | ❌ NOT IMPLEMENTED | ✅ COMPLETE | 🟡 MEDIUM |
| 8. Priority Listing Scheduler | ⚠️ PARTIAL | ✅ COMPLETE | 🟡 MEDIUM |

---

## 🔴 CRITICAL FIXES - Test First

### Feature 1: Video Upload Enforcement (6-12 Videos)

#### What Was Broken
- Companies could create offers with < 6 videos
- No minimum enforcement
- Quality control mechanism missing

#### What Was Fixed
- Server-side validation enforces 6-12 videos
- New endpoint: `POST /api/offers/:id/submit-for-review`
- Offers stay as "draft" until validation passes
- Clear error messages

#### Test Cases

**Test 1.1: Create Offer with Insufficient Videos**
```
1. Login as company
2. Create new offer
3. Upload 3 videos (below minimum)
4. Click "Submit for Review"
Expected: Error "Please upload between 6 and 12 videos"
Status: Should remain "draft"
```

**Test 1.2: Create Offer with Exactly 6 Videos**
```
1. Create new offer
2. Upload exactly 6 videos
3. Click "Submit for Review"
Expected: Success message
Status: Changes to "pending_review"
Admin can see offer in review queue
```

**Test 1.3: Create Offer with Maximum Videos**
```
1. Create new offer
2. Upload 12 videos (maximum)
3. Click "Submit for Review"
Expected: Success
Status: "pending_review"
```

**Test 1.4: Try to Upload More Than 12 Videos**
```
1. Create new offer
2. Try to upload 13th video
Expected: Error "Maximum 12 videos allowed"
Upload should be blocked
```

**Test 1.5: Edit Draft to Add Missing Videos**
```
1. Create draft with 4 videos
2. Save as draft
3. Edit draft
4. Add 2 more videos (total 6)
5. Submit for review
Expected: Now allows submission
Status: "pending_review"
```

#### API Endpoint
```
POST /api/offers/:id/submit-for-review
Body: { offerId: string }
Response: { success: boolean, message: string }
```

#### Code Locations
- `server/routes.ts:540-700`
- `client/src/pages/CompanyOfferForm.tsx`

---

### Feature 2: Email Verification System

#### What Was Broken
- No email verification on registration
- Security vulnerability
- Spam accounts possible

#### What Was Fixed
- Secure token generation (24-hour expiry)
- Password reset flow (1-hour expiry)
- SendGrid email integration
- 4 new endpoints

#### Test Cases

**Test 2.1: Register New User**
```
1. Go to /register
2. Fill form:
   - Email: test-verification@example.com
   - Username: testuser123
   - Password: SecurePass123!
3. Submit
Expected:
- Success message: "Please check your email to verify"
- Email sent to inbox
- User can't login yet
- Database: emailVerified = false
```

**Test 2.2: Verify Email with Valid Token**
```
1. Open verification email
2. Click verification link
Expected:
- Redirect to login page
- Success message: "Email verified successfully"
- Database: emailVerified = true
- User can now login
```

**Test 2.3: Try to Use Expired Token**
```
1. Register user
2. Manually set token expiry to past date in DB:
   UPDATE users SET "emailVerificationTokenExpiry" = '2024-01-01' WHERE email = 'test@example.com';
3. Click verification link
Expected:
- Error: "Verification token has expired"
- Prompt to resend verification email
```

**Test 2.4: Resend Verification Email**
```
1. Register user
2. Don't verify email
3. Go to login page
4. Click "Resend Verification Email"
5. Enter email
Expected:
- New email sent with new token
- Old token invalidated
- New token expires in 24 hours
```

**Test 2.5: Request Password Reset**
```
1. Go to login page
2. Click "Forgot Password?"
3. Enter email address
4. Submit
Expected:
- Email sent with reset link
- Token expires in 1 hour
- Link format: /reset-password?token=xyz
```

**Test 2.6: Reset Password with Valid Token**
```
1. Click reset link from email
2. Enter new password twice
3. Submit
Expected:
- Success message
- Token invalidated (can't use again)
- Can login with new password
- Old password no longer works
```

**Test 2.7: Try to Reset with Expired Token**
```
1. Request password reset
2. Wait 61+ minutes (or manually expire in DB)
3. Try to use reset link
Expected:
- Error: "Reset token has expired"
- Prompt to request new reset link
```

**Test 2.8: Try to Login Without Verification**
```
1. Register new user
2. Don't verify email
3. Try to login
Expected:
- Error: "Please verify your email address"
- Link to resend verification
```

#### API Endpoints
```
POST /api/auth/verify-email?token=<token>
POST /api/auth/request-password-reset
Body: { email: string }

POST /api/auth/reset-password
Body: { token: string, newPassword: string }

POST /api/auth/resend-verification
Body: { email: string }
```

#### Code Locations
- `server/localAuth.ts:100-250`

#### Environment Required
```bash
SENDGRID_API_KEY=your_sendgrid_key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
SENDGRID_FROM_NAME=AffiliateXchange
```

---

### Feature 3: Priority Listing Purchase ($199/month)

#### What Was Broken
- Database field existed (`isPriorityListing`)
- No UI to purchase
- Missing revenue stream

#### What Was Fixed
- Stripe checkout integration
- $199 for 30 days
- Gold "PRIORITY" badge in browse
- Automated expiration
- Renewal option

#### Test Cases

**Test 3.1: Purchase Priority Listing**
```
1. Login as company with approved offer
2. Go to "My Offers"
3. Find approved offer
4. Click "Upgrade to Priority"
Expected:
- Stripe checkout modal appears
- Amount: $199.00
- Description: "Priority Listing - 30 days"
```

**Test 3.2: Complete Payment**
```
1. In Stripe checkout, use test card:
   Card: 4242 4242 4242 4242
   Expiry: 12/34
   CVC: 123
2. Complete payment
Expected:
- Success message
- Database:
  - isPriorityListing = true
  - priorityExpiresAt = now + 30 days
- Payment record created
- Confirmation email sent
```

**Test 3.3: Verify PRIORITY Badge in Browse**
```
1. Logout
2. Go to "Browse Offers"
3. Find the priority offer
Expected:
- Gold "PRIORITY" badge visible
- Offer appears at top of results
- Badge shows on hover: "Priority listing"
```

**Test 3.4: Check Expiration Date**
```
1. Login as company
2. Go to "My Offers"
3. Find priority offer
Expected:
- Shows expiry date
- If < 7 days: Yellow warning badge
- "Renew Priority" button visible
```

**Test 3.5: Renew Priority Listing**
```
1. Priority listing expires in 5 days
2. Click "Renew Priority"
3. Complete payment
Expected:
- New expiry = old expiry + 30 days
- No gap in priority status
- New payment record created
```

**Test 3.6: Test Declined Payment**
```
1. Try to purchase with declined card:
   Card: 4000 0000 0000 0002
2. Submit payment
Expected:
- Error message from Stripe
- isPriorityListing remains false
- No charge created
```

**Test 3.7: Verify Priority Sorting**
```
1. Create 3 offers:
   - Offer A: Priority
   - Offer B: Regular
   - Offer C: Regular
2. Go to browse page
Expected:
- Offer A appears first
- Offers B & C appear after
- Sorting: Priority first, then by date/relevance
```

#### API Endpoints
```
POST /api/offers/:id/purchase-priority
Response: { checkoutUrl: string }

POST /api/stripe/webhook
Handles payment completion

GET /api/offers
Returns offers with priority first
```

#### Code Locations
- `server/routes.ts:1200-1350`
- `client/src/pages/BrowseOffers.tsx`

---

### Feature 4: GDPR/CCPA Compliance

#### What Was Broken
- No data export
- No account deletion with PII removal
- No cookie consent
- Legal compliance gap

#### What Was Fixed
- Data export API (JSON download)
- Account deletion with PII anonymization
- Cookie consent banner
- Privacy settings page

#### Test Cases

**Test 4.1: Cookie Consent Banner**
```
1. Open site in incognito mode
2. Load homepage
Expected:
- Cookie banner appears at bottom
- Options: "Accept All" / "Reject All"
- Link to privacy policy
- Banner stays until choice made
```

**Test 4.2: Accept Cookies**
```
1. Click "Accept All"
Expected:
- Banner disappears
- Choice stored in localStorage
- Tracking cookies enabled
- Banner doesn't reappear on refresh
```

**Test 4.3: Reject Cookies**
```
1. Open in new incognito window
2. Click "Reject All"
Expected:
- Banner disappears
- Essential cookies only
- No tracking cookies
- Choice stored
```

**Test 4.4: Export User Data**
```
1. Login as any user
2. Go to Profile → Privacy Settings
3. Click "Export My Data"
Expected:
- JSON file downloads
- Filename: user-data-{userId}-{timestamp}.json
- Contains all user data (see structure below)
```

**Test 4.5: Verify Export Data Structure**
```json
{
  "profile": {
    "id": "...",
    "username": "...",
    "email": "...",
    "firstName": "...",
    "role": "creator"
  },
  "offers": [...],
  "applications": [...],
  "conversations": [...],
  "messages": [...],
  "notifications": [...],
  "paymentSettings": [
    {
      "payoutMethod": "paypal",
      "payoutEmail": "user@example.com",
      // Sensitive data like account numbers are sanitized
    }
  ],
  "notificationPreferences": {...}
}
```

**Test 4.6: Try to Delete Account with Active Applications**
```
1. Login as creator with active application
2. Go to Privacy Settings
3. Click "Delete Account"
4. Enter password
Expected:
- Error: "Cannot delete account with active applications"
- Details: "You have X active application(s)"
- Account NOT deleted
```

**Test 4.7: Delete Account Successfully**
```
1. Login as user with no active campaigns
2. Go to Privacy Settings
3. Click "Delete Account"
4. Enter password
5. Confirm deletion
Expected:
- Confirmation email sent
- Personal data anonymized in DB:
  - email → "deleted-{userId}@deleted.user"
  - firstName → null
  - lastName → null
  - profileImageUrl → null
  - password → null
  - googleId → null
- accountStatus → "banned"
- Payment settings deleted
- Notifications deleted
- Reviews kept but anonymized
- Logged out automatically
```

**Test 4.8: Verify Deletion in Database**
```sql
-- Check anonymized user
SELECT email, "firstName", "lastName", "accountStatus"
FROM users
WHERE id = 'deleted-user-id';

Expected:
email: deleted-{userId}@deleted.user
firstName: null
lastName: null
accountStatus: banned
```

**Test 4.9: Try to Login After Deletion**
```
1. Try to login with deleted account
Expected:
- Error: "Account not found" or "Account disabled"
- Cannot login
```

**Test 4.10: Privacy Settings Page**
```
1. Go to Privacy Settings
Expected UI elements:
- [ ] Email notifications toggle
- [ ] Marketing emails toggle
- [ ] Data collection toggle
- [Export My Data] button
- [Delete Account] button (red, dangerous)
```

#### API Endpoints
```
GET /api/user/export-data
Response: JSON file download

POST /api/user/delete-account
Body: { password: string }
Response: { success: boolean, message: string }

GET /api/user/privacy-settings
PUT /api/user/privacy-settings
Body: { emailNotifications: boolean, ... }
```

#### Code Locations
- `server/localAuth.ts:680-896`
- `client/src/components/CookieConsent.tsx`
- `client/src/pages/PrivacySettings.tsx`

---

## 🟠 HIGH PRIORITY FIXES

### Feature 5: Payment Method Validation

#### What Was Broken
- Offers could be approved without company payment method
- Led to payment failures

#### What Was Fixed
- Admin validation before approval
- Warning badges in admin panel
- Cannot approve without payment method

#### Test Cases

**Test 5.1: Company Without Payment Method**
```
1. Create company account
2. DON'T add payment method
3. Create and submit offer
4. Login as admin
5. Go to "Review Offers"
Expected:
- Red warning badge: "⚠️ No Payment Method"
- "Approve" button shows warning
- Tooltip: "Company must add payment method"
```

**Test 5.2: Try to Approve Without Payment Method**
```
1. As admin, try to approve offer
Expected:
- Error: "Cannot approve. Company must set up payment method first."
- Status remains "pending_review"
- Offer NOT approved
```

**Test 5.3: Company Adds Payment Method**
```
1. Login as company
2. Go to "Payment Settings"
3. Add PayPal or Stripe account
4. Save
Expected:
- Payment method saved
- Verification badge appears
```

**Test 5.4: Admin Can Now Approve**
```
1. Login as admin
2. Go to "Review Offers"
3. Find same offer
Expected:
- Warning badge removed
- ✓ Green checkmark: "Payment Method Verified"
- "Approve" button enabled
- Can approve successfully
```

#### Code Locations
- `server/routes.ts:3800-3900`
- `client/src/pages/AdminOffers.tsx`

---

### Feature 6: Review Auto-Prompt

#### What Was Broken
- No automatic prompt after completing campaign
- Fewer reviews collected

#### What Was Fixed
- Modal appears after first completed campaign
- Direct link to review form
- Auto-personalization

#### Test Cases

**Test 6.1: Complete First Campaign**
```
1. Login as creator
2. Have active application
3. Mark application as "completed"
Expected:
- Modal appears immediately
- Title: "How was your experience?"
- Message: "We'd love to hear about your campaign with {Company Name}"
- "Leave Review" button
- "Maybe Later" button
```

**Test 6.2: Click "Leave Review"**
```
1. In modal, click "Leave Review"
Expected:
- Redirect to review form
- Pre-filled:
  - Company name
  - Campaign name
- Empty fields:
  - Star rating (1-5)
  - Comment textarea
```

**Test 6.3: Submit Review**
```
1. Select 5 stars
2. Write: "Great company to work with!"
3. Submit
Expected:
- Review saved
- Appears on company profile
- Creator's profile shows review count
```

**Test 6.4: Dismiss Modal**
```
1. Complete campaign
2. Modal appears
3. Click "Maybe Later"
Expected:
- Modal closes
- Can leave review manually later
- Flag set: hasSeenReviewPrompt = true
```

**Test 6.5: No Modal on Subsequent Completions**
```
1. Complete 2nd campaign
2. Complete 3rd campaign
Expected:
- Modal ONLY appears on first completion
- No modal on 2nd, 3rd, etc.
```

#### Code Locations
- `client/src/components/ReviewPromptModal.tsx`
- `client/src/pages/Applications.tsx`

---

## 🟡 MEDIUM PRIORITY FIXES

### Feature 7: Canned Response Templates

#### What Was Broken
- No message templates
- Slower response times

#### What Was Fixed
- 5 professional templates
- Auto-personalization
- Easy dropdown access

#### Test Cases

**Test 7.1: Access Templates**
```
1. Login as company
2. Go to Messages
3. Open conversation with creator
Expected:
- "Templates" dropdown button visible
- Click to see dropdown with 5 templates
```

**Test 7.2: Use "Application Approved" Template**
```
1. Select "Application Approved"
Expected message:
Hi {Creator Name},

Great news! We've approved your application for our {Campaign Name} campaign.

Looking forward to working with you!

Best regards,
{Company Name}
```

**Test 7.3: Verify Auto-Personalization**
```
Verify these variables are replaced:
- {Creator Name} → Actual creator's first name
- {Campaign Name} → Actual offer title
- {Company Name} → Company's business name
```

**Test 7.4: All Template Types**
```
Test all 5 templates:
1. ✅ Application Approved
2. ✅ Application Rejected
3. ✅ Request for More Info
4. ✅ Campaign Update
5. ✅ Payment Processed
```

**Test 7.5: Edit Template Before Sending**
```
1. Select any template
2. Message box fills with template
3. Edit the text
4. Send
Expected:
- Can modify before sending
- Sends edited version
- Original template unchanged
```

#### Code Locations
- `client/src/components/CannedResponses.tsx`
- `client/src/pages/Messages.tsx`

---

### Feature 8: Priority Listing Scheduler

#### What Was Broken
- No automated expiration
- Manual management required

#### What Was Fixed
- Daily scheduler at 2 AM
- Automated expiration after 30 days
- Email reminders (7 days before)

#### Test Cases

**Test 8.1: Verify Scheduler Initialization**
```
1. Start server: npm run dev
2. Check console logs
Expected:
[Scheduler] Priority listing expiration check scheduled for 2:00 AM daily
[Scheduler] Initialized successfully
```

**Test 8.2: Manual Scheduler Test**
```
1. Run: npm run test:scheduler
Expected output:
- Lists all priority listings
- Shows expiry dates
- Identifies expired listings
- Shows reminder candidates (7 days)
```

**Test 8.3: Test Expiration (Manual)**
```
1. Create priority listing
2. Manually set expiry to past:
   UPDATE offers SET "priorityExpiresAt" = NOW() - INTERVAL '1 day' WHERE id = 'offer-id';
3. Run scheduler: npm run test:scheduler
Expected:
- Identifies as expired
- Sets isPriorityListing = false
- PRIORITY badge removed
```

**Test 8.4: Test Reminder Email (7 Days)**
```
1. Create priority listing
2. Set expiry to 7 days from now:
   UPDATE offers SET "priorityExpiresAt" = NOW() + INTERVAL '7 days' WHERE id = 'offer-id';
3. Run scheduler
Expected email:
- Subject: "Your Priority Listing Expires Soon"
- Body: "Your priority listing for {Offer Title} expires in 7 days"
- "Renew Now" button/link
```

**Test 8.5: Test Expiration Email**
```
1. Let priority listing expire (or set to today)
2. Run scheduler
Expected email:
- Subject: "Your Priority Listing Has Expired"
- Body: "Your priority listing for {Offer Title} has expired"
- Option to renew
```

**Test 8.6: Verify Database Changes**
```
After scheduler runs:
1. Check expired listings:
   SELECT id, title, "isPriorityListing", "priorityExpiresAt"
   FROM offers
   WHERE "priorityExpiresAt" < NOW();

Expected:
- isPriorityListing = false
- priorityExpiresAt still stored (for history)
```

**Test 8.7: Verify Daily Schedule**
```
1. Check scheduler is configured for daily 2 AM
2. Verify server doesn't restart scheduler multiple times
Expected:
- Runs once daily at 2:00 AM
- Uses correct timezone
- Doesn't duplicate jobs
```

#### Code Locations
- `server/services/SchedulerService.ts`
- `server/index.ts:150-200`

#### Test Command
```bash
npm run test:scheduler
```

---

## ✅ TESTING CHECKLIST

Use this checklist to track your progress:

### Critical Features
- [ ] Feature 1: Video Upload Enforcement
  - [ ] Test 1.1: Insufficient videos
  - [ ] Test 1.2: Exactly 6 videos
  - [ ] Test 1.3: Maximum 12 videos
  - [ ] Test 1.4: More than 12 videos
  - [ ] Test 1.5: Edit to add videos

- [ ] Feature 2: Email Verification
  - [ ] Test 2.1: Register new user
  - [ ] Test 2.2: Verify with valid token
  - [ ] Test 2.3: Expired token
  - [ ] Test 2.4: Resend verification
  - [ ] Test 2.5: Request password reset
  - [ ] Test 2.6: Reset with valid token
  - [ ] Test 2.7: Expired reset token
  - [ ] Test 2.8: Login without verification

- [ ] Feature 3: Priority Listing
  - [ ] Test 3.1: Purchase priority
  - [ ] Test 3.2: Complete payment
  - [ ] Test 3.3: Verify badge
  - [ ] Test 3.4: Check expiration
  - [ ] Test 3.5: Renew listing
  - [ ] Test 3.6: Declined payment
  - [ ] Test 3.7: Priority sorting

- [ ] Feature 4: GDPR Compliance
  - [ ] Test 4.1: Cookie banner
  - [ ] Test 4.2: Accept cookies
  - [ ] Test 4.3: Reject cookies
  - [ ] Test 4.4: Export data
  - [ ] Test 4.5: Verify export structure
  - [ ] Test 4.6: Delete with active apps
  - [ ] Test 4.7: Delete successfully
  - [ ] Test 4.8: Verify deletion in DB
  - [ ] Test 4.9: Login after deletion
  - [ ] Test 4.10: Privacy settings page

### High Priority Features
- [ ] Feature 5: Payment Method Validation
  - [ ] Test 5.1: Company without payment
  - [ ] Test 5.2: Try to approve
  - [ ] Test 5.3: Add payment method
  - [ ] Test 5.4: Approve after payment

- [ ] Feature 6: Review Auto-Prompt
  - [ ] Test 6.1: Complete first campaign
  - [ ] Test 6.2: Leave review
  - [ ] Test 6.3: Submit review
  - [ ] Test 6.4: Dismiss modal
  - [ ] Test 6.5: No modal on 2nd completion

### Medium Priority Features
- [ ] Feature 7: Canned Responses
  - [ ] Test 7.1: Access templates
  - [ ] Test 7.2: Use template
  - [ ] Test 7.3: Verify personalization
  - [ ] Test 7.4: All 5 templates
  - [ ] Test 7.5: Edit before sending

- [ ] Feature 8: Priority Scheduler
  - [ ] Test 8.1: Verify initialization
  - [ ] Test 8.2: Manual test
  - [ ] Test 8.3: Test expiration
  - [ ] Test 8.4: Reminder email
  - [ ] Test 8.5: Expiration email
  - [ ] Test 8.6: Database changes
  - [ ] Test 8.7: Daily schedule

---

## 🚀 QUICK START

To test all previously partial features quickly:

```bash
# 1. Check environment
npm run test:env

# 2. Start server
npm run dev

# 3. Follow test cases above

# 4. Test scheduler manually
npm run test:scheduler
```

---

## 📊 EXPECTED RESULTS

After completing all tests:

✅ All 8 features fully functional
✅ No errors in browser console
✅ No errors in server logs
✅ All emails delivered successfully
✅ All payments process correctly
✅ Data export/deletion works
✅ Scheduler runs without errors

---

## 🐛 KNOWN ISSUES (Fixed)

These bugs were fixed as part of the implementation:

1. ✅ `storage.getNotificationsByUser` → Fixed to `getNotifications`
2. ✅ `storage.getPaymentSettingsByUser` → Fixed to `getPaymentSettings`
3. ✅ Export data endpoint errors → Fixed
4. ✅ Delete account endpoint errors → Fixed

---

## 📞 Support

If you encounter issues during testing:

1. Check server logs for errors
2. Verify `.env` configuration
3. Ensure database is running
4. Check browser console for client errors
5. Review API responses in Network tab

---

**Ready to test?** Start with Feature 1 (Video Upload Enforcement) and work through the list!
