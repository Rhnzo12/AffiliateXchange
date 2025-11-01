interface EmailTemplateData {
  userName?: string;
  companyName?: string;
  offerTitle?: string;
  applicationId?: string;
  trackingLink?: string;
  trackingCode?: string;
  amount?: string;
  reviewRating?: number;
  reviewText?: string;
  messagePreview?: string;
  daysUntilExpiration?: number;
  linkUrl?: string;
}

const baseStyles = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6;
    color: #333;
    background-color: #f4f4f4;
    margin: 0;
    padding: 0;
  }
  .container {
    max-width: 600px;
    margin: 0 auto;
    background-color: #ffffff;
    padding: 20px;
  }
  .header {
    background-color: #4F46E5;
    color: #ffffff;
    padding: 30px 20px;
    text-align: center;
    border-radius: 8px 8px 0 0;
  }
  .content {
    padding: 30px 20px;
  }
  .button {
    display: inline-block;
    padding: 12px 30px;
    background-color: #4F46E5;
    color: #ffffff;
    text-decoration: none;
    border-radius: 6px;
    margin: 20px 0;
    font-weight: 600;
  }
  .footer {
    text-align: center;
    padding: 20px;
    color: #666;
    font-size: 14px;
  }
  .badge {
    display: inline-block;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 600;
  }
  .badge-success {
    background-color: #10B981;
    color: #ffffff;
  }
  .badge-warning {
    background-color: #F59E0B;
    color: #ffffff;
  }
  .badge-danger {
    background-color: #EF4444;
    color: #ffffff;
  }
`;

export function applicationStatusChangeEmail(status: string, data: EmailTemplateData): { subject: string; html: string } {
  const isApproved = status === 'approved';
  const isRejected = status === 'rejected';
  
  const subject = isApproved 
    ? `Your application has been approved!` 
    : isRejected 
    ? `Application Update` 
    : `Application Status Update`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${isApproved ? 'Congratulations!' : 'Application Update'}</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          ${isApproved ? `
            <p>Great news! Your application for <strong>${data.offerTitle}</strong> has been approved!</p>
            <p>You can now start promoting this offer and earning commissions.</p>
            ${data.trackingLink ? `
              <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Your Unique Tracking Link:</h3>
                <p style="word-break: break-all; font-family: monospace; background: white; padding: 10px; border-radius: 4px;">
                  ${data.trackingLink}
                </p>
                <p style="margin-bottom: 0; font-size: 14px; color: #666;">Use this link in your content to track your performance and earnings.</p>
              </div>
            ` : ''}
            <a href="${data.linkUrl || '/applications'}" class="button">View Application</a>
          ` : isRejected ? `
            <p>Unfortunately, your application for <strong>${data.offerTitle}</strong> was not approved at this time.</p>
            <p>Don't worry! There are many other great offers available on our platform.</p>
            <a href="/browse" class="button">Browse More Offers</a>
          ` : `
            <p>Your application for <strong>${data.offerTitle}</strong> has been updated to <span class="badge badge-warning">${status.toUpperCase()}</span>.</p>
            <a href="${data.linkUrl || '/applications'}" class="button">View Application</a>
          `}
        </div>
        <div class="footer">
          <p>This is an automated notification from Affiliate Marketplace.</p>
          <p>Update your <a href="/settings">notification preferences</a> anytime.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

export function newMessageEmail(data: EmailTemplateData): { subject: string; html: string } {
  const subject = `New message from ${data.companyName || 'a company'}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>New Message</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          <p>You have a new message from <strong>${data.companyName}</strong> regarding <strong>${data.offerTitle}</strong>.</p>
          ${data.messagePreview ? `
            <div style="background-color: #F3F4F6; padding: 15px; border-left: 4px solid #4F46E5; margin: 20px 0;">
              <p style="margin: 0; font-style: italic;">"${data.messagePreview}"</p>
            </div>
          ` : ''}
          <a href="${data.linkUrl || '/messages'}" class="button">View Message</a>
        </div>
        <div class="footer">
          <p>This is an automated notification from Affiliate Marketplace.</p>
          <p>Update your <a href="/settings">notification preferences</a> anytime.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

export function paymentReceivedEmail(data: EmailTemplateData): { subject: string; html: string } {
  const subject = `Payment received: ${data.amount}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Payment Received!</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          <p>Great news! You've received a payment of <strong>${data.amount}</strong>.</p>
          ${data.offerTitle ? `
            <p>This payment is for your work on <strong>${data.offerTitle}</strong>.</p>
          ` : ''}
          <a href="${data.linkUrl || '/payment-settings'}" class="button">View Payment Details</a>
        </div>
        <div class="footer">
          <p>This is an automated notification from Affiliate Marketplace.</p>
          <p>Update your <a href="/settings">notification preferences</a> anytime.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

export function offerApprovedEmail(data: EmailTemplateData): { subject: string; html: string } {
  const subject = `Your offer "${data.offerTitle}" has been approved!`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Offer Approved!</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          <p>Congratulations! Your offer <strong>"${data.offerTitle}"</strong> has been approved and is now live on the marketplace.</p>
          <p>Creators can now discover and apply to your offer.</p>
          <a href="${data.linkUrl || '/company-offers'}" class="button">View Your Offer</a>
        </div>
        <div class="footer">
          <p>This is an automated notification from Affiliate Marketplace.</p>
          <p>Update your <a href="/settings">notification preferences</a> anytime.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

export function offerRejectedEmail(data: EmailTemplateData): { subject: string; html: string } {
  const subject = `Offer Review Update`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Offer Review Update</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          <p>Your offer <strong>"${data.offerTitle}"</strong> requires some adjustments before it can be published.</p>
          <p>Please review the feedback and resubmit your offer.</p>
          <a href="${data.linkUrl || '/company-offers'}" class="button">View Offer</a>
        </div>
        <div class="footer">
          <p>This is an automated notification from Affiliate Marketplace.</p>
          <p>Update your <a href="/settings">notification preferences</a> anytime.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

export function newApplicationEmail(data: EmailTemplateData): { subject: string; html: string } {
  const subject = `New application for "${data.offerTitle}"`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>New Application Received</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          <p>You've received a new application for your offer <strong>"${data.offerTitle}"</strong>.</p>
          <p>Review the creator's profile and application to make your decision.</p>
          <a href="${data.linkUrl || '/company-applications'}" class="button">View Application</a>
        </div>
        <div class="footer">
          <p>This is an automated notification from Affiliate Marketplace.</p>
          <p>Update your <a href="/settings">notification preferences</a> anytime.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

export function reviewReceivedEmail(data: EmailTemplateData): { subject: string; html: string } {
  const rating = `${data.reviewRating || 5} out of 5 stars`;
  const subject = `New review received (${rating})`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>New Review Received</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          <p>You've received a new review for your company!</p>
          <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="font-size: 18px; font-weight: 600; margin: 0 0 10px 0;">${rating}</p>
            ${data.reviewText ? `<p style="font-style: italic; margin: 0;">"${data.reviewText}"</p>` : ''}
          </div>
          <a href="${data.linkUrl || '/company-reviews'}" class="button">View Review</a>
        </div>
        <div class="footer">
          <p>This is an automated notification from Affiliate Marketplace.</p>
          <p>Update your <a href="/settings">notification preferences</a> anytime.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

export function systemAnnouncementEmail(title: string, message: string, data: EmailTemplateData): { subject: string; html: string } {
  const subject = `${title}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${title}</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p>${message}</p>
          </div>
          ${data.linkUrl ? `<a href="${data.linkUrl}" class="button">Learn More</a>` : ''}
        </div>
        <div class="footer">
          <p>This is an automated notification from Affiliate Marketplace.</p>
          <p>Update your <a href="/settings">notification preferences</a> anytime.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

export function registrationApprovedEmail(data: EmailTemplateData): { subject: string; html: string } {
  const subject = `Welcome to Affiliate Marketplace! Your account has been approved`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Affiliate Marketplace!</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          <p>Great news! Your company account has been approved and you can now start creating offers and connecting with creators.</p>
          <a href="${data.linkUrl || '/company-dashboard'}" class="button">Get Started</a>
        </div>
        <div class="footer">
          <p>This is an automated notification from Affiliate Marketplace.</p>
          <p>Update your <a href="/settings">notification preferences</a> anytime.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

export function registrationRejectedEmail(data: EmailTemplateData): { subject: string; html: string } {
  const subject = `Account Registration Update`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Account Registration Update</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          <p>Thank you for your interest in Affiliate Marketplace. Unfortunately, we're unable to approve your company account at this time.</p>
          <p>If you believe this is an error or would like more information, please contact our support team.</p>
          <a href="${data.linkUrl || '/contact'}" class="button">Contact Support</a>
        </div>
        <div class="footer">
          <p>This is an automated notification from Affiliate Marketplace.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

export function workCompletionApprovalEmail(data: EmailTemplateData): { subject: string; html: string } {
  const subject = `Work approved for "${data.offerTitle}"`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Work Approved!</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          <p>Congratulations! Your work for <strong>"${data.offerTitle}"</strong> has been approved.</p>
          ${data.amount ? `<p>Your payment of <strong>${data.amount}</strong> has been initiated and will be processed shortly.</p>` : ''}
          <a href="${data.linkUrl || '/applications'}" class="button">View Details</a>
        </div>
        <div class="footer">
          <p>This is an automated notification from Affiliate Marketplace.</p>
          <p>Update your <a href="/settings">notification preferences</a> anytime.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

export function priorityListingExpiringEmail(data: EmailTemplateData): { subject: string; html: string } {
  const subject = `Priority listing expiring soon for "${data.offerTitle}"`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Priority Listing Expiring</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          <p>Your priority listing for <strong>"${data.offerTitle}"</strong> will expire in <strong>${data.daysUntilExpiration} days</strong>.</p>
          <p>Renew now to keep your offer at the top of search results and maintain maximum visibility.</p>
          <a href="${data.linkUrl || '/company-offers'}" class="button">Renew Priority Listing</a>
        </div>
        <div class="footer">
          <p>This is an automated notification from Affiliate Marketplace.</p>
          <p>Update your <a href="/settings">notification preferences</a> anytime.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}
