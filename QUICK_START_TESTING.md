# Quick Start - Testing 8 Features

## Step 1: Verify Environment

```bash
npm run test:env
```

This checks if all required environment variables are configured:
- ✅ SendGrid (email verification)
- ✅ Stripe (priority listings)
- ✅ Database connection
- ✅ Session secrets
- ✅ Cloud storage (videos)

**Fix any failures** before proceeding.

---

## Step 2: Start the Application

```bash
npm run dev
```

Server should start on `http://localhost:5000`

---

## Step 3: Create Test Accounts

Open browser and create these accounts:

### Admin Account
- Go to `/register`
- Email: `admin@test.com`
- Role: Admin (you may need to manually update DB)
- Verify email

### Company Account (With Payment)
- Email: `company1@test.com`
- Role: Company
- Verify email
- Add payment method in settings

### Creator Account
- Email: `creator1@test.com`
- Role: Creator
- Verify email

---

## Step 4: Follow Testing Flow

### Quick Test Flow (15 minutes)

1. **Feature 2 - Email Verification**
   - Register new user
   - Check email
   - Click verification link
   - ✅ Email verified

2. **Feature 1 - Video Upload**
   - Login as company1
   - Create new offer
   - Upload 5 videos
   - Try to submit → ❌ Error
   - Add 1 more video (total 6)
   - Submit → ✅ Success

3. **Feature 5 - Payment Validation**
   - Login as admin
   - Go to review queue
   - See offer with payment method ✓
   - Approve offer

4. **Feature 3 - Priority Listing**
   - Login as company1
   - Click "Upgrade to Priority"
   - Use test card: `4242 4242 4242 4242`
   - ✅ Payment success
   - Check browse page → PRIORITY badge visible

5. **Feature 7 - Canned Responses**
   - Creator applies to offer
   - Company opens messages
   - Click "Templates"
   - Select "Application Approved"
   - ✅ Auto-filled with names

6. **Feature 6 - Review Auto-Prompt**
   - Creator completes campaign
   - ✅ Modal appears
   - Click "Leave Review"
   - Submit review

7. **Feature 4 - GDPR Compliance**
   - Go to Privacy Settings
   - Click "Export My Data"
   - ✅ JSON downloads
   - (Optional) Delete test account

8. **Feature 8 - Scheduler**
   - Run: `npm run test:scheduler`
   - ✅ Shows all priority listings
   - ✅ Shows expiration status

---

## Step 5: Comprehensive Testing

For full testing, follow:

📖 **TESTING_GUIDE.md** - Detailed instructions for every test case

☑️ **TESTING_CHECKLIST.md** - Checkbox list to track progress

---

## Common Issues

### "SendGrid email not received"
- Check spam folder
- Verify SENDGRID_API_KEY is correct
- Check SendGrid dashboard for errors

### "Stripe payment fails"
- Use test card: `4242 4242 4242 4242`
- Verify STRIPE_SECRET_KEY is set
- Check Stripe dashboard in test mode

### "Video upload fails"
- Check GCS_BUCKET_NAME and GCS_CREDENTIALS
- Verify cloud storage permissions
- Check browser console for errors

### "Database errors"
- Run: `npm run db:push`
- Check DATABASE_URL is correct
- Verify database is running

---

## Testing Tools

```bash
# Check environment configuration
npm run test:env

# Test priority scheduler manually
npm run test:scheduler

# Open database studio
npm run db:studio

# Run type checks
npm run check
```

---

## Next Steps After Testing

1. ✅ All features working? → Create pull request
2. ❌ Found issues? → Check TESTING_GUIDE.md for troubleshooting
3. 📝 Document any bugs found
4. 🎉 Ready for production deployment!

---

## Need Help?

- **Detailed guide:** TESTING_GUIDE.md
- **Checklist:** TESTING_CHECKLIST.md
- **Code locations:** Check each feature section in TESTING_GUIDE.md

---

**Time estimate:**
- Quick test: 15-20 minutes
- Full test suite: 1-2 hours
- All integration scenarios: 2-3 hours
