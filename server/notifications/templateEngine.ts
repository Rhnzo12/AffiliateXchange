/**
 * Template Engine for Email Templates
 * Handles variable substitution with {{variableName}} syntax
 */

import { storage } from "../storage";

interface TemplateData {
  userName?: string;
  companyName?: string;
  offerTitle?: string;
  applicationId?: string;
  trackingLink?: string;
  trackingCode?: string;
  amount?: string;
  grossAmount?: string;
  platformFee?: string;
  processingFee?: string;
  transactionId?: string;
  reviewRating?: number;
  reviewText?: string;
  messagePreview?: string;
  daysUntilExpiration?: number;
  linkUrl?: string;
  verificationUrl?: string;
  resetUrl?: string;
  otpCode?: string;
  contentType?: string;
  matchedKeywords?: string[];
  reviewStatus?: string;
  actionTaken?: string;
  [key: string]: any;
}

/**
 * Process a template string by replacing all {{variable}} patterns with data
 */
export function processTemplate(template: string, data: TemplateData): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
    const value = data[variable];
    if (value === undefined || value === null) {
      return ''; // Return empty string for undefined variables
    }
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return String(value);
  });
}

/**
 * Process both subject and HTML content with data
 */
export function processEmailTemplate(
  subject: string,
  htmlContent: string,
  data: TemplateData
): { subject: string; html: string } {
  return {
    subject: processTemplate(subject, data),
    html: processTemplate(htmlContent, data),
  };
}

/**
 * Get and process a template by its slug
 * Returns null if template doesn't exist or is inactive
 */
export async function getProcessedTemplate(
  slug: string,
  data: TemplateData
): Promise<{ subject: string; html: string } | null> {
  try {
    const template = await storage.getEmailTemplateBySlug(slug);

    if (!template || !template.isActive) {
      return null;
    }

    return processEmailTemplate(template.subject, template.htmlContent, data);
  } catch (error) {
    console.error(`[TemplateEngine] Error fetching template '${slug}':`, error);
    return null;
  }
}

/**
 * Map notification type to template slug
 * This allows the system to look up templates by notification type
 */
export function getTemplateSlugForNotificationType(type: string): string | null {
  const typeToSlugMap: Record<string, string> = {
    // Application templates
    'application_status_change': 'application-status-change',
    'new_application': 'new-application',

    // Payment templates
    'payment_received': 'payment-received',
    'payment_pending': 'payment-pending',
    'payment_approved': 'payment-approved',
    'payment_failed_insufficient_funds': 'payment-failed-insufficient-funds',

    // Offer templates
    'offer_approved': 'offer-approved',
    'offer_rejected': 'offer-rejected',

    // Company templates
    'registration_approved': 'registration-approved',
    'registration_rejected': 'registration-rejected',

    // System templates
    'system_announcement': 'system-announcement',
    'new_message': 'new-message',
    'review_received': 'review-received',
    'work_completion_approval': 'work-completion-approval',
    'priority_listing_expiring': 'priority-listing-expiring',

    // Moderation templates
    'content_flagged': 'content-flagged',

    // Authentication templates
    'email_verification': 'email-verification',
    'password_reset': 'password-reset',
    'account_deletion_otp': 'account-deletion-otp',
    'password_change_otp': 'password-change-otp',
  };

  return typeToSlugMap[type] || null;
}

/**
 * Try to get a custom template, falling back to hardcoded if not found
 */
export async function getTemplateForType(
  type: string,
  data: TemplateData
): Promise<{ subject: string; html: string } | null> {
  const slug = getTemplateSlugForNotificationType(type);

  if (!slug) {
    return null;
  }

  return await getProcessedTemplate(slug, data);
}

/**
 * Base email styles used by default templates
 */
export const baseEmailStyles = `
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

/**
 * Create a default HTML wrapper for simple email content
 */
export function wrapInDefaultTemplate(
  title: string,
  bodyContent: string,
  buttonText?: string,
  buttonUrl?: string,
  headerColor: string = '#4F46E5'
): string {
  const buttonHtml = buttonText && buttonUrl
    ? `<a href="${buttonUrl}" class="button" style="background-color: ${headerColor};">${buttonText}</a>`
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${baseEmailStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header" style="background-color: ${headerColor};">
          <h1>${title}</h1>
        </div>
        <div class="content">
          ${bodyContent}
          ${buttonHtml}
        </div>
        <div class="footer">
          <p>This is an automated notification from Affiliate Marketplace.</p>
          <p>Update your <a href="/settings">notification preferences</a> anytime.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
