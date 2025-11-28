# Offer Workflow Implementation Status

## Overview

This document compares the documented offer workflow specification against the actual implementation in the AffiliateXchange codebase.

**Legend:**
- ✅ **IMPLEMENTED** - Feature is fully implemented
- ⚠️ **PARTIAL** - Feature is partially implemented or has gaps
- ❌ **MISSING** - Feature is not implemented

---

## STEP 1 — Company Registration → Admin Approval

### Specification
- Company fills out registration + uploads business documents
- Status = Pending
- Super Admin manually reviews documents
- If approved → company can publish offers
- If rejected → company must re-apply later

### Implementation Status: ✅ IMPLEMENTED

| Feature | Status | Location |
|---------|--------|----------|
| Company registration | ✅ | `server/routes.ts:351` - `/api/company/onboarding` |
| Company status tracking (pending/approved/rejected/suspended) | ✅ | `shared/schema.ts:22` - `companyStatusEnum` |
| Admin approval endpoint | ✅ | `server/routes.ts:4491` - `POST /api/admin/companies/:id/approve` |
| Admin rejection endpoint | ✅ | `server/routes.ts:4501` - `POST /api/admin/companies/:id/reject` |
| Admin suspension endpoint | ✅ | `server/routes.ts:4512` - `POST /api/admin/companies/:id/suspend` |
| Rejection reason storage | ✅ | `shared/schema.ts:192` - `companyProfiles.rejectionReason` |
| Approval timestamp | ✅ | `shared/schema.ts:191` - `companyProfiles.approvedAt` |
| Website verification | ✅ | `server/routes.ts:4532-4585` - Verification token system |

### Missing/Gaps
| Feature | Status | Notes |
|---------|--------|-------|
| Document upload storage | ⚠️ | Basic file upload exists but no dedicated business document verification flow |
| 90-day retry restriction for rejected companies | ❌ | Not enforced in code |

---

## STEP 2 — Company Creates an Offer

### Specification
- Company fills out: Title, niche, description, commission type, payment terms, example videos (6-12 required), requirements for creators
- Offer = Under Review
- Admin approves → Offer goes live

### Implementation Status: ✅ IMPLEMENTED

| Feature | Status | Location |
|---------|--------|----------|
| Offer creation endpoint | ✅ | `server/routes.ts:993` - `POST /api/offers` |
| Title, niche, description fields | ✅ | `shared/schema.ts:225-279` - `offers` table |
| Commission types (Per Sale, Per Lead, Per Click, Retainer) | ✅ | `shared/schema.ts:24` - `commissionTypeEnum` includes `per_sale`, `per_lead`, `per_click`, `monthly_retainer`, `hybrid` |
| Example videos | ✅ | `shared/schema.ts:282-294` - `offerVideos` table |
| Submit for review | ✅ | `server/routes.ts:1118` - `POST /api/offers/:id/submit-for-review` |
| Admin approval endpoint | ✅ | `server/routes.ts:5233` - `POST /api/admin/offers/:id/approve` |
| Admin rejection endpoint | ✅ | `server/routes.ts:5274` - `POST /api/admin/offers/:id/reject` |
| Edit request system | ✅ | `server/routes.ts:5304` - `POST /api/admin/offers/:id/request-edits` |
| Offer status tracking (draft/pending_review/approved/paused/archived) | ✅ | `shared/schema.ts:23` - `offerStatusEnum` |

### Missing/Gaps
| Feature | Status | Notes |
|---------|--------|-------|
| Enforce 6-12 video requirement | ❌ | No validation requiring minimum 6 videos before submission |
| Payment terms field | ⚠️ | Commission amount/percentage exists but no detailed payment terms structure |

---

## STEP 3 — Creator Browses & Applies

### Specification
- Creator sees offers based on niche, commission, trending, popularity
- Clicks "Apply Now"
- Enters message + selects desired commission model
- Application status = PENDING

### Implementation Status: ✅ IMPLEMENTED

| Feature | Status | Location |
|---------|--------|----------|
| Browse offers | ✅ | `server/routes.ts` - `GET /api/offers` with filtering |
| Filter by niche | ✅ | Offer filtering by niche implemented |
| Filter by commission | ✅ | Offer filtering by commission type |
| Apply to offer | ✅ | `server/routes.ts:1462` - `POST /api/applications` |
| Application message | ✅ | `shared/schema.ts:308` - `applications.message` |
| Application status (pending) | ✅ | `shared/schema.ts:309` - `applications.status` |
| Notification to company | ✅ | Notification sent on application creation |

### Missing/Gaps
| Feature | Status | Notes |
|---------|--------|-------|
| Creator selects desired commission model | ⚠️ | Application doesn't allow creator to propose different commission - uses offer's fixed commission |
| Trending/popularity sorting | ⚠️ | Basic sorting exists but no trending algorithm |

---

## STEP 4 — Auto-Approval (7 Minutes)

### Specification
- After 7 minutes: Application changes → APPROVED (unless admin/company manually reviewed)
- System generates the creator's unique tracking link
- Link format: `https://track.yourapp.com/go/AB12CD34`
- Link tied to: Creator ID, Offer ID, Company ID, Application ID

### Implementation Status: ⚠️ PARTIAL

| Feature | Status | Location |
|---------|--------|----------|
| Auto-approval scheduler | ✅ | `server/routes.ts:8621-8691` - Runs every 60 seconds |
| Auto-approval field | ✅ | `shared/schema.ts:314` - `applications.autoApprovalScheduledAt` |
| Tracking code generation | ✅ | `server/routes.ts:1538-1541` - Format: `CR-{creatorId:8}-{offerId:8}-{applicationId:8}` |
| Tracking link generation | ✅ | Format: `{baseURL}/go/{trackingCode}` |
| Link tied to IDs | ✅ | `applications` table stores `creatorId`, `offerId`, links to `companyId` via offer |

### Missing/Gaps
| Feature | Status | Notes |
|---------|--------|-------|
| 7-minute auto-approval triggering | ⚠️ | Scheduler exists and checks `autoApprovalScheduledAt`, but **setting this field on application creation is marked as TODO** at `routes.ts:1521` |
| Short alphanumeric codes (AB12CD34 format) | ❌ | Current format uses longer IDs: `CR-xxxxxxxx-xxxxxxxx-xxxxxxxx` instead of short 8-char codes |

---

## STEP 5 — Creator Promotes the Offer

### Specification
- Creator posts the tracking link on various platforms (TikTok, YouTube, Instagram, etc.)
- Works everywhere, even off-platform

### Implementation Status: ✅ IMPLEMENTED

| Feature | Status | Location |
|---------|--------|----------|
| Tracking link provided to creator | ✅ | Stored in `applications.trackingLink` |
| QR code generation | ✅ | `server/routes.ts:1409` - `GET /api/applications/:id/qrcode` |
| Universal redirect link | ✅ | Works across all platforms |
| Link copying UI | ✅ | `client/src/pages/application-detail.tsx` |

### Missing/Gaps
| Feature | Status | Notes |
|---------|--------|-------|
| N/A | - | Fully implemented for basic use case |

---

## STEP 6 — User Clicks Tracking Link

### Specification
- User goes to tracking URL
- Backend logs: IP address, User device, Timestamp, Geo location, Referrer
- Tracks unique clicks
- Redirects user to: Product website, App Store, Checkout page, Landing page

### Implementation Status: ✅ IMPLEMENTED

| Feature | Status | Location |
|---------|--------|----------|
| Click redirect handler | ✅ | `server/routes.ts:1887` - `GET /go/:code` |
| IP address logging | ✅ | `shared/schema.ts:480` - `clickEvents.ipAddress` |
| User agent logging | ✅ | `shared/schema.ts:481` - `clickEvents.userAgent` |
| Timestamp logging | ✅ | `shared/schema.ts:479` - `clickEvents.timestamp` |
| Geo location (country/city) | ✅ | `shared/schema.ts:483-484` - Uses `geoip-lite` library |
| Referrer logging | ✅ | `shared/schema.ts:482` - `clickEvents.referer` |
| UTM parameter tracking | ✅ | `shared/schema.ts:489-493` - `utmSource`, `utmMedium`, `utmCampaign`, `utmTerm`, `utmContent` |
| Unique click tracking | ✅ | `storage.ts:3331-3341` - Tracks unique IPs per day |
| Redirect to product URL | ✅ | `server/routes.ts:1969` - 302 redirect |
| Fraud detection | ✅ | `server/fraudDetection.ts` - Scores clicks 0-100 |

### Missing/Gaps
| Feature | Status | Notes |
|---------|--------|-------|
| N/A | - | Fully implemented with additional fraud detection |

---

## STEP 7 — Conversion / Sale / Lead Tracking

### Specification
Three tracking methods:
- **METHOD A** — Postback URL (Server-to-server)
- **METHOD B** — Tracking Pixel
- **METHOD C** — Manual Confirmation

### Implementation Status: ⚠️ PARTIAL

| Feature | Status | Location |
|---------|--------|----------|
| **METHOD A - Postback URL** | | |
| Conversion endpoint | ✅ | `server/routes.ts:1977` - `POST /api/conversions/:applicationId` |
| Accept sale amount | ✅ | Request body: `saleAmount` |
| Event type handling | ⚠️ | Only handles "conversion" - no "lead" vs "sale" distinction in API |
| **METHOD B - Tracking Pixel** | | |
| Pixel-based tracking | ❌ | No dedicated pixel endpoint (`/conversion?code=xxx`) |
| **METHOD C - Manual Confirmation** | | |
| Company marks work completed | ✅ | Via conversion endpoint with `saleAmount` |
| Application completion | ✅ | `server/routes.ts:1634` - `POST /api/applications/:id/complete` |
| Deliverable approval (retainer) | ✅ | `server/routes.ts:8264` - `PATCH /api/company/retainer-deliverables/:id/approve` |

### Missing/Gaps
| Feature | Status | Notes |
|---------|--------|-------|
| Pixel tracking endpoint | ❌ | No `GET /conversion?code=xxx` or `<img>` pixel endpoint |
| Postback signature validation | ❌ | No cryptographic signature verification for webhook security |
| Event types (sale/lead distinction) | ⚠️ | API accepts conversion but doesn't distinguish event type |
| Currency support in postback | ⚠️ | No currency field - assumes single currency |

---

## Commission Calculation

### Specification
- **TYPE 1: Per Sale** - Fixed $ or % of purchase amount
- **TYPE 2: Per Lead** - Fixed payout per lead
- **TYPE 3: Per Click** - Fixed payout per click
- **TYPE 4: Monthly Retainer** - Monthly amount with deliverables

### Implementation Status: ✅ IMPLEMENTED

| Feature | Status | Location |
|---------|--------|----------|
| Per Sale (fixed amount) | ✅ | `shared/schema.ts:238` - `offers.commissionAmount` |
| Per Sale (percentage) | ✅ | `shared/schema.ts:239` - `offers.commissionPercentage` |
| Per Sale calculation | ✅ | `storage.ts:3409-3415` - `earnings = saleAmount * commissionPercentage / 100` |
| Per Lead (fixed payout) | ✅ | `storage.ts:3417-3424` - Uses `commissionAmount` |
| Per Click (fixed payout) | ✅ | `storage.ts:3417-3424` - Uses `commissionAmount` |
| Monthly Retainer | ✅ | `shared/schema.ts:572-610` - `retainerContracts` table |
| Retainer deliverables tracking | ✅ | `shared/schema.ts:637-665` - `retainerDeliverables` table |
| Retainer payment on approval | ✅ | `server/routes.ts:8264` - Creates payment when deliverable approved |
| Hybrid commission type | ✅ | `storage.ts:3430-3436` - Supports both fixed + percentage |
| Cookie duration | ⚠️ | Field not implemented in schema |

### Missing/Gaps
| Feature | Status | Notes |
|---------|--------|-------|
| Cookie/attribution duration | ❌ | No `cookieDuration` field (e.g., 30 days) to track delayed conversions |
| Recurring commission | ❌ | No support for recurring commissions on subscriptions |

---

## Platform Fee & Creator Earnings

### Specification
- **7% total fee**: 4% platform profit + 3% Stripe processing
- Example: $100 gross → $4 platform → $3 Stripe → $93 net to creator

### Implementation Status: ✅ IMPLEMENTED

| Feature | Status | Location |
|---------|--------|----------|
| Fee calculator service | ✅ | `server/feeCalculator.ts` |
| Platform fee (4% default) | ✅ | `feeCalculator.ts:17` - `DEFAULT_PLATFORM_FEE_PERCENTAGE = 0.04` |
| Stripe fee (3%) | ✅ | `feeCalculator.ts:18` - `DEFAULT_STRIPE_FEE_PERCENTAGE = 0.03` |
| Per-company custom fees | ✅ | `shared/schema.ts:189` - `companyProfiles.customPlatformFeePercentage` |
| Admin fee management | ✅ | `server/routes.ts:4609-4750` - GET/PUT/DELETE fee endpoints |
| Fee breakdown in payments | ✅ | `shared/schema.ts:545-548` - `grossAmount`, `platformFeeAmount`, `stripeFeeAmount`, `netAmount` |

### Missing/Gaps
| Feature | Status | Notes |
|---------|--------|-------|
| N/A | - | Fully implemented with per-company override capability |

---

## Payment/Payout System

### Specification
- Company → charged using Stripe Connect
- Platform collects 7% fee
- Creator receives net payout
- Invoice/receipt generated
- Analytics update in real-time

### Implementation Status: ✅ IMPLEMENTED

| Feature | Status | Location |
|---------|--------|----------|
| **Stripe Connect Integration** | | |
| Create connected account | ✅ | `stripeConnectService.ts:39-102` |
| Account onboarding link | ✅ | `stripeConnectService.ts:108-136` |
| Account status check | ✅ | `stripeConnectService.ts:141-179` |
| Transfer to connected account | ✅ | `stripeConnectService.ts:185-278` |
| **Alternative Payment Methods** | | |
| E-Transfer | ✅ | `paymentProcessor.ts:93-99` |
| Wire Transfer | ✅ | `shared/schema.ts:510-512` - Bank routing/account fields |
| PayPal | ✅ | `paymentProcessor.ts:85-91` |
| Crypto | ✅ | `shared/schema.ts:517-518` - Wallet address/network fields |
| **Payment Management** | | |
| Payment creation | ✅ | `storage.ts:3475-3486` - Created on conversion |
| Payment status tracking | ✅ | `shared/schema.ts:556` - pending/processing/completed/failed/refunded |
| Payment approval by company | ✅ | `server/routes.ts:3270` - `POST /api/company/payments/:id/approve` |
| Payment dispute | ✅ | `server/routes.ts:3340` - `POST /api/company/payments/:id/dispute` |
| **Analytics** | | |
| Real-time analytics update | ✅ | `storage.ts:3442-3470` - Updated on conversion |
| Daily aggregation | ✅ | `shared/schema.ts:451-464` - `analytics` table |
| Sandbox mode | ✅ | `stripeConnectService.ts:228-236` - `PAYMENT_SANDBOX_MODE` env var |

### Missing/Gaps
| Feature | Status | Notes |
|---------|--------|-------|
| Invoice/receipt generation | ⚠️ | Payment records exist but no PDF invoice generation |
| Company charging (collection) | ⚠️ | Focus is on creator payouts - company charging flow less defined |
| Stripe payment intent for company charge | ⚠️ | Field exists but full company-side charging flow unclear |

---

## Additional Features Found (Not in Spec)

These features are implemented but not mentioned in the specification:

| Feature | Location | Description |
|---------|----------|-------------|
| Fraud Detection | `server/fraudDetection.ts` | Click fraud scoring (0-100) with multiple checks |
| QR Code Generation | `server/routes.ts:1409` | QR codes for tracking links |
| Retainer Contracts | `shared/schema.ts:572-610` | Full contract management system |
| Retainer Deliverables | `shared/schema.ts:637-665` | Video deliverable tracking with approval workflow |
| Priority Listing | `shared/schema.ts:263` | `offers.priorityExpiresAt` for featured offers |
| Content Approval | `shared/schema.ts:266` | `offers.contentApprovalRequired` flag |
| Exclusivity | `shared/schema.ts:265` | `offers.exclusivityRequired` flag |
| Website Verification | `server/routes.ts:4532-4585` | DNS/meta tag verification for companies |
| Niche Management | Admin niche CRUD system | Category management for offers |

---

## Summary

### Fully Implemented (✅)
1. Company Registration & Admin Approval
2. Offer Creation & Review Process
3. Creator Application System
4. Click Tracking (IP, User Agent, Geo, UTM, Fraud Detection)
5. Commission Calculation (All 4 types + Hybrid)
6. Platform Fee System (7% with per-company override)
7. Multi-method Payment Processing (Stripe Connect, PayPal, Wire, Crypto)
8. Real-time Analytics

### Partially Implemented (⚠️)
1. **Auto-Approval (7 Minutes)** - Scheduler exists but triggering not wired to application creation
2. **Postback URL Tracking** - Endpoint exists but lacks signature validation and event type distinction
3. **Invoice Generation** - Payment records exist but no PDF generation
4. **Company Charging** - Focus on creator payouts, company-side charging flow incomplete

### Not Implemented (❌)
1. **Tracking Pixel Endpoint** - No `<img>` pixel-based conversion tracking
2. **Short Tracking Codes** - Uses long format instead of 8-char alphanumeric
3. **Cookie/Attribution Duration** - No time-windowed attribution tracking
4. **90-Day Retry Restriction** - Rejected companies can re-apply immediately
5. **6-12 Video Requirement** - No validation enforcing minimum videos
6. **Recurring Commissions** - No subscription-based recurring payouts

---

## Recommended Priority Fixes

### High Priority
1. **Wire auto-approval to application creation** - Set `autoApprovalScheduledAt` when application is created
2. **Add tracking pixel endpoint** - Simple `GET /pixel/:code` that returns 1x1 transparent GIF
3. **Add postback signature validation** - HMAC signature for webhook security

### Medium Priority
4. **Implement cookie duration** - Add attribution window field to offers
5. **Add invoice PDF generation** - Generate downloadable payment receipts
6. **Shorten tracking codes** - Optional shorter alphanumeric codes for cleaner URLs

### Low Priority
7. **Enforce video requirements** - Add validation for minimum 6 videos
8. **Add retry restriction** - 90-day cooldown for rejected companies
9. **Add recurring commission support** - For subscription-based products

---

*Document generated: 2025-11-28*
*Based on codebase analysis of AffiliateXchange platform*
