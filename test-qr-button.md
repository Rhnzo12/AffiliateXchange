# Testing QR Code Button

## Prerequisites:
1. Have a creator account
2. Have an approved application with a tracking link

## Quick Test:
1. Login as creator
2. Go to: /applications
3. Click any application with status "approved" or "active"
4. Look for blue card titled "Your Tracking Link"
5. The QR button should be at the bottom in a 2-column grid

## If you don't see it:
- The application might be "pending" (not approved yet)
- Ask admin to approve the application first
- Check if the tracking link shows - if not, the whole section is hidden

## Button location in code:
client/src/pages/application-detail.tsx:492-500
