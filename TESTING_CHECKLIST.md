# 8 Features Testing Checklist

Quick reference checklist for testing all 8 implemented features.

## Pre-Testing Setup

- [ ] Run environment check: `npm run test:env`
- [ ] Start dev server: `npm run dev`
- [ ] Verify database is running
- [ ] Clear browser cache/cookies
- [ ] Prepare test email addresses

---

## 1. Video Upload Enforcement (6-12 Videos)

- [ ] Create offer with < 6 videos → Should stay "draft"
- [ ] Try to submit with < 6 videos → Should show error
- [ ] Add videos to reach 6 → Should allow submission
- [ ] Submit with 6 videos → Status changes to "pending_review"
- [ ] Try uploading > 12 videos → Should show error
- [ ] Verify admin sees offer in review queue

**Endpoint:** `POST /api/offers/:id/submit-for-review`

---

## 2. Email Verification System

- [ ] Register new user → Verification email sent
- [ ] Click verification link → Email verified
- [ ] Try expired token (24h+) → Shows error
- [ ] Request password reset → Email sent
- [ ] Reset password with valid token → Success
- [ ] Try expired reset token (1h+) → Shows error
- [ ] Resend verification email → Works

**Endpoints:**
- `POST /api/auth/verify-email`
- `POST /api/auth/request-password-reset`
- `POST /api/auth/reset-password`

---

## 3. Priority Listing Feature ($199/month)

- [ ] Click "Upgrade to Priority" → Stripe checkout opens
- [ ] Complete test payment (card: 4242...) → Success
- [ ] Verify `isPriorityListing` = true in DB
- [ ] Check browse page → PRIORITY badge visible
- [ ] Offer appears at top of results
- [ ] Check expiry warning (< 7 days) → Shows warning
- [ ] Test renewal → New expiry date set
- [ ] Run scheduler: `npm run test:scheduler`

**Price:** $199 for 30 days

---

## 4. GDPR/CCPA Compliance

- [ ] Open in incognito → Cookie banner appears
- [ ] Accept cookies → Banner dismissed
- [ ] Go to Privacy Settings → All toggles visible
- [ ] Export data → JSON file downloads
- [ ] Verify JSON structure → All data included
- [ ] Try delete with active apps → Shows error
- [ ] Delete account (no active apps) → Success
- [ ] Verify data anonymized in DB
- [ ] Try to login with old account → Fails

**Endpoints:**
- `GET /api/user/export-data`
- `POST /api/user/delete-account`

---

## 5. Payment Method Validation

- [ ] Company without payment method → Creates offer
- [ ] Admin reviews offer → Warning badge visible
- [ ] Try to approve → Error: "No payment method"
- [ ] Company adds payment method
- [ ] Refresh admin panel → Warning removed
- [ ] Approve offer → Success
- [ ] Offer goes live

**Admin Panel:** Check payment method warnings

---

## 6. Review Auto-Prompt

- [ ] Creator completes first campaign
- [ ] Modal appears automatically
- [ ] Click "Leave Review" → Redirects to form
- [ ] Form is pre-filled with company/campaign info
- [ ] Submit review → Saves successfully
- [ ] Complete 2nd campaign → No modal (only shows once)
- [ ] Check `hasSeenReviewPrompt` flag

**Component:** `ReviewPromptModal.tsx`

---

## 7. Canned Response Templates

- [ ] Company opens messages
- [ ] Click "Templates" dropdown
- [ ] Select "Application Approved"
- [ ] Verify auto-personalization works
  - [ ] [Creator Name] replaced
  - [ ] [Campaign Name] replaced
  - [ ] [Company Name] replaced
- [ ] Test all 5 templates:
  - [ ] Application Approved
  - [ ] Application Rejected
  - [ ] Request for More Info
  - [ ] Campaign Update
  - [ ] Payment Processed
- [ ] Edit template before sending
- [ ] Send message → Receives successfully

**Component:** `CannedResponses.tsx`

---

## 8. Priority Listing Scheduler

- [ ] Check server logs → Scheduler initialized
- [ ] Run manual test: `npm run test:scheduler`
- [ ] Verify listings with `priorityExpiresAt` < now
- [ ] Create test listing expiring in 7 days
- [ ] Run scheduler → Reminder email sent
- [ ] Create listing expiring today
- [ ] Run scheduler → Expiration email sent
- [ ] Verify `isPriorityListing` set to false
- [ ] Check badge removed from browse page
- [ ] Verify runs daily at 2:00 AM

**Service:** `SchedulerService.ts`

---

## Integration Tests

### Creator Journey
- [ ] Register → Verify email
- [ ] Apply to priority offer
- [ ] Complete campaign
- [ ] Auto-prompt appears → Leave review
- [ ] Export data
- [ ] Delete account

### Company Journey
- [ ] Register → Verify email
- [ ] Add payment method
- [ ] Create offer (8 videos)
- [ ] Submit for review
- [ ] Offer approved
- [ ] Purchase priority listing
- [ ] Use canned responses
- [ ] Renew priority listing

### Admin Journey
- [ ] Review offers
- [ ] Check payment method validation
- [ ] Approve/reject offers
- [ ] Monitor priority listings

---

## Bug Fixes to Verify

- [ ] `storage.getNotifications()` works (was `getNotificationsByUser`)
- [ ] `storage.getPaymentSettings()` works (was `getPaymentSettingsByUser`)
- [ ] Export data works without errors
- [ ] Delete account works without errors

---

## Final Checks

- [ ] No console errors in browser
- [ ] No server errors in terminal
- [ ] All emails received successfully
- [ ] Stripe test payments complete
- [ ] Database queries are efficient
- [ ] UI is responsive on mobile
- [ ] All navigation links work

---

## Quick Commands

```bash
# Check environment
npm run test:env

# Start development server
npm run dev

# Test scheduler
npm run test:scheduler

# Type check
npm run check

# Database studio
npm run db:studio

# Seed payment data
npm run payment:seed
```

---

## Test Accounts Needed

Create these before starting:

1. **Admin** (admin@test.com)
2. **Company with payment** (company1@test.com)
3. **Company without payment** (company2@test.com)
4. **Verified creator** (creator1@test.com)
5. **Unverified creator** (creator2@test.com)

---

## Stripe Test Cards

**Success:** 4242 4242 4242 4242
**Decline:** 4000 0000 0000 0002
**Insufficient funds:** 4000 0000 0000 9995

Expiry: Any future date
CVC: Any 3 digits

---

## Success Criteria

✅ All checkboxes checked
✅ No errors in console/logs
✅ All emails delivered
✅ Payments process successfully
✅ Data export complete
✅ Scheduler runs correctly

---

**Ready to test?** Start with: `npm run test:env`

For detailed instructions, see: `TESTING_GUIDE.md`
