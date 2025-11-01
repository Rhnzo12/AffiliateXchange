import sgMail from '@sendgrid/mail';
import webpush from 'web-push';
import type { DatabaseStorage } from '../storage';
import type { InsertNotification, UserNotificationPreferences } from '@shared/schema';
import * as emailTemplates from './emailTemplates';

let sendGridConfigured = false;
let webPushConfigured = false;

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  sendGridConfigured = true;
  console.log('[Notifications] SendGrid configured successfully');
} else {
  console.warn('[Notifications] SendGrid API key not found - email notifications disabled');
}

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:notifications@affiliatemarketplace.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  webPushConfigured = true;
  console.log('[Notifications] Web Push configured successfully');
} else {
  console.warn('[Notifications] VAPID keys not found - push notifications disabled');
}

export type NotificationType = 
  | 'application_status_change'
  | 'new_message'
  | 'payment_received'
  | 'offer_approved'
  | 'offer_rejected'
  | 'new_application'
  | 'review_received'
  | 'system_announcement'
  | 'registration_approved'
  | 'registration_rejected'
  | 'work_completion_approval'
  | 'priority_listing_expiring';

interface NotificationData {
  userName?: string;
  userEmail?: string;
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
  applicationStatus?: string;
  announcementTitle?: string;
  announcementMessage?: string;
}

export class NotificationService {
  constructor(private storage: DatabaseStorage) {}

  async sendNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data: NotificationData = {}
  ): Promise<void> {
    try {
      const preferences = await this.storage.getUserNotificationPreferences(userId);
      const user = await this.storage.getUserById(userId);
      
      if (!user) {
        console.error(`[Notifications] User ${userId} not found`);
        return;
      }

      data.userName = data.userName || user.firstName || user.username;
      data.userEmail = data.userEmail || user.email;

      if (preferences?.inAppNotifications !== false) {
        await this.sendInAppNotification(userId, type, title, message, data);
      }

      if (preferences?.emailNotifications !== false && this.shouldSendEmail(type, preferences)) {
        await this.sendEmailNotification(user.email, type, data);
      }

      if (preferences?.pushNotifications !== false && this.shouldSendPush(type, preferences)) {
        await this.sendPushNotification(preferences, title, message, data);
      }
    } catch (error) {
      console.error('[Notifications] Error sending notification:', error);
    }
  }

  private async sendInAppNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data: NotificationData
  ): Promise<void> {
    try {
      const notification: InsertNotification = {
        userId,
        type,
        title,
        message,
        linkUrl: data.linkUrl,
        metadata: data,
        isRead: false,
      };

      await this.storage.createNotification(notification);
      console.log(`[Notifications] In-app notification created for user ${userId}: ${type}`);
    } catch (error) {
      console.error('[Notifications] Error creating in-app notification:', error);
    }
  }

  private async sendEmailNotification(
    email: string,
    type: NotificationType,
    data: NotificationData
  ): Promise<void> {
    if (!sendGridConfigured) {
      console.warn('[Notifications] SendGrid not configured, skipping email');
      return;
    }

    try {
      let emailContent: { subject: string; html: string };

      switch (type) {
        case 'application_status_change':
          emailContent = emailTemplates.applicationStatusChangeEmail(
            data.applicationStatus || 'updated',
            data
          );
          break;
        case 'new_message':
          emailContent = emailTemplates.newMessageEmail(data);
          break;
        case 'payment_received':
          emailContent = emailTemplates.paymentReceivedEmail(data);
          break;
        case 'offer_approved':
          emailContent = emailTemplates.offerApprovedEmail(data);
          break;
        case 'offer_rejected':
          emailContent = emailTemplates.offerRejectedEmail(data);
          break;
        case 'new_application':
          emailContent = emailTemplates.newApplicationEmail(data);
          break;
        case 'review_received':
          emailContent = emailTemplates.reviewReceivedEmail(data);
          break;
        case 'system_announcement':
          emailContent = emailTemplates.systemAnnouncementEmail(
            data.announcementTitle || 'System Announcement',
            data.announcementMessage || '',
            data
          );
          break;
        case 'registration_approved':
          emailContent = emailTemplates.registrationApprovedEmail(data);
          break;
        case 'registration_rejected':
          emailContent = emailTemplates.registrationRejectedEmail(data);
          break;
        case 'work_completion_approval':
          emailContent = emailTemplates.workCompletionApprovalEmail(data);
          break;
        case 'priority_listing_expiring':
          emailContent = emailTemplates.priorityListingExpiringEmail(data);
          break;
        default:
          console.warn(`[Notifications] Unknown email type: ${type}`);
          return;
      }

      const msg = {
        to: email,
        from: process.env.SENDGRID_FROM_EMAIL || 'notifications@affiliatemarketplace.com',
        subject: emailContent.subject,
        html: emailContent.html,
      };

      await sgMail.send(msg);
      console.log(`[Notifications] Email sent to ${email}: ${type}`);
    } catch (error) {
      console.error('[Notifications] Error sending email:', error);
    }
  }

  private async sendPushNotification(
    preferences: UserNotificationPreferences | null,
    title: string,
    message: string,
    data: NotificationData
  ): Promise<void> {
    if (!webPushConfigured) {
      console.warn('[Notifications] Web Push not configured, skipping push notification');
      return;
    }

    if (!preferences?.pushSubscription) {
      console.log('[Notifications] No push subscription found for user');
      return;
    }

    try {
      const payload = JSON.stringify({
        title,
        body: message,
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        data: {
          url: data.linkUrl || '/',
        },
      });

      await webpush.sendNotification(
        preferences.pushSubscription as webpush.PushSubscription,
        payload
      );
      console.log(`[Notifications] Push notification sent: ${title}`);
    } catch (error) {
      console.error('[Notifications] Error sending push notification:', error);
      if ((error as any)?.statusCode === 410 || (error as any)?.statusCode === 404) {
        await this.storage.updateUserNotificationPreferences(preferences.userId, {
          pushSubscription: null,
        });
        console.log('[Notifications] Removed invalid push subscription');
      }
    }
  }

  private shouldSendEmail(type: NotificationType, preferences: UserNotificationPreferences | null): boolean {
    if (!preferences) return true;

    switch (type) {
      case 'application_status_change':
        return preferences.emailApplicationStatus;
      case 'new_message':
        return preferences.emailNewMessage;
      case 'payment_received':
      case 'work_completion_approval':
        return preferences.emailPayment;
      case 'offer_approved':
      case 'offer_rejected':
      case 'new_application':
        return preferences.emailOffer;
      case 'review_received':
        return preferences.emailReview;
      case 'system_announcement':
      case 'registration_approved':
      case 'registration_rejected':
      case 'priority_listing_expiring':
        return preferences.emailSystem;
      default:
        return true;
    }
  }

  private shouldSendPush(type: NotificationType, preferences: UserNotificationPreferences | null): boolean {
    if (!preferences) return true;

    switch (type) {
      case 'application_status_change':
        return preferences.pushApplicationStatus;
      case 'new_message':
        return preferences.pushNewMessage;
      case 'payment_received':
      case 'work_completion_approval':
        return preferences.pushPayment;
      default:
        return true;
    }
  }

  async broadcastSystemAnnouncement(
    title: string,
    message: string,
    linkUrl?: string,
    targetRole?: 'creator' | 'company' | 'admin'
  ): Promise<void> {
    try {
      const users = await this.storage.getAllUsers();
      const filteredUsers = targetRole
        ? users.filter((user) => user.role === targetRole)
        : users;

      for (const user of filteredUsers) {
        await this.sendNotification(
          user.id,
          'system_announcement',
          title,
          message,
          {
            linkUrl,
            announcementTitle: title,
            announcementMessage: message,
          }
        );
      }

      console.log(`[Notifications] System announcement sent to ${filteredUsers.length} users`);
    } catch (error) {
      console.error('[Notifications] Error broadcasting system announcement:', error);
    }
  }
}
