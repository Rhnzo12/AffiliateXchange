/**
 * Automatic Commission Release Service
 *
 * Handles the automatic processing of affiliate commissions:
 * 1. Receives sale notifications from external platforms (Shopify, WooCommerce, etc.)
 * 2. Tracks order status (pending, shipped, delivered, completed, cancelled, returned)
 * 3. Automatically releases commission to creator wallet when order is confirmed complete
 * 4. Creates invoices for companies automatically
 * 5. Supports unlimited commissions for unlimited promotion offers
 */

import { storage } from './storage';
import { companyInvoiceService } from './companyInvoiceService';
import { notificationService } from './notificationService';

// Platform fee percentage (4%)
const PLATFORM_FEE_PERCENTAGE = 0.04;
// Stripe processing fee percentage (approximately 3%)
const STRIPE_FEE_PERCENTAGE = 0.03;

export interface SaleNotification {
  // Required fields
  externalOrderId: string;
  trackingCode: string; // The affiliate tracking code from the URL
  orderAmount: number;

  // Optional fields
  externalPlatform?: string; // shopify, woocommerce, etc.
  orderCurrency?: string;
  itemName?: string;
  itemQuantity?: number;
  customerEmail?: string;
  orderStatus?: 'pending' | 'processing' | 'shipped' | 'delivered' | 'completed' | 'cancelled' | 'returned' | 'refunded';
  metadata?: Record<string, any>;
}

export interface OrderStatusUpdate {
  externalOrderId: string;
  externalPlatform?: string;
  newStatus: 'pending' | 'processing' | 'shipped' | 'delivered' | 'completed' | 'cancelled' | 'returned' | 'refunded';
  note?: string;
  metadata?: Record<string, any>;
}

class AutomaticCommissionService {

  /**
   * Record a new sale from an external platform
   * This is called when a customer completes a purchase via an affiliate link
   */
  async recordSale(notification: SaleNotification): Promise<{
    success: boolean;
    saleId?: string;
    commissionAmount?: number;
    error?: string;
  }> {
    try {
      console.log('[AutoCommission] Recording new sale:', {
        orderId: notification.externalOrderId,
        trackingCode: notification.trackingCode,
        amount: notification.orderAmount,
      });

      // Find the application by tracking code
      const application = await storage.getApplicationByTrackingCode(notification.trackingCode);
      if (!application) {
        console.error('[AutoCommission] No application found for tracking code:', notification.trackingCode);
        return {
          success: false,
          error: `No affiliate found for tracking code: ${notification.trackingCode}`,
        };
      }

      // Get the offer to calculate commission
      const offer = await storage.getOffer(application.offerId);
      if (!offer) {
        return {
          success: false,
          error: 'Offer not found',
        };
      }

      // Calculate commission based on offer type
      let commissionAmount: number;
      if (offer.commissionType === 'percentage' && offer.commissionPercentage) {
        commissionAmount = notification.orderAmount * (parseFloat(offer.commissionPercentage) / 100);
      } else if (offer.commissionAmount) {
        commissionAmount = parseFloat(offer.commissionAmount);
      } else {
        return {
          success: false,
          error: 'Unable to calculate commission - no commission rate set',
        };
      }

      // Round to 2 decimal places
      commissionAmount = Math.round(commissionAmount * 100) / 100;

      // Calculate hold period expiration (default 14 days)
      const holdPeriodDays = 14;
      const holdExpiresAt = new Date();
      holdExpiresAt.setDate(holdExpiresAt.getDate() + holdPeriodDays);

      // Create the affiliate sale record
      const sale = await storage.createAffiliateSale({
        applicationId: application.id,
        offerId: application.offerId,
        creatorId: application.creatorId,
        companyId: offer.companyId,
        externalOrderId: notification.externalOrderId,
        externalPlatform: notification.externalPlatform,
        orderAmount: notification.orderAmount.toString(),
        orderCurrency: notification.orderCurrency || 'CAD',
        itemName: notification.itemName,
        itemQuantity: notification.itemQuantity || 1,
        commissionType: offer.commissionType,
        commissionRate: offer.commissionType === 'percentage'
          ? offer.commissionPercentage
          : offer.commissionAmount,
        commissionAmount: commissionAmount.toString(),
        orderStatus: notification.orderStatus || 'pending',
        holdPeriodDays,
        holdExpiresAt,
        customerEmail: notification.customerEmail,
        trackingCode: notification.trackingCode,
        metadata: notification.metadata,
        statusHistory: [{
          status: notification.orderStatus || 'pending',
          timestamp: new Date().toISOString(),
          note: 'Sale recorded',
        }],
      });

      console.log('[AutoCommission] Sale recorded:', sale.id, 'Commission:', commissionAmount);

      // Update analytics
      await storage.incrementAnalyticsConversions(application.id, commissionAmount);

      // Notify creator about the pending commission
      await notificationService.sendNotification(
        application.creatorId,
        'payment_pending',
        'New Commission Pending! 🎉',
        `You earned CA$${commissionAmount.toFixed(2)} commission from a sale. It will be released after the order is confirmed complete.`,
        {
          saleId: sale.id,
          orderAmount: `CA$${notification.orderAmount.toFixed(2)}`,
          commissionAmount: `CA$${commissionAmount.toFixed(2)}`,
          itemName: notification.itemName || 'Product',
          holdPeriodDays: holdPeriodDays.toString(),
        }
      );

      return {
        success: true,
        saleId: sale.id,
        commissionAmount,
      };

    } catch (error: any) {
      console.error('[AutoCommission] Error recording sale:', error);
      return {
        success: false,
        error: error.message || 'Failed to record sale',
      };
    }
  }

  /**
   * Update the status of an existing order
   * Called when the external platform updates the order status
   */
  async updateOrderStatus(update: OrderStatusUpdate): Promise<{
    success: boolean;
    commissionReleased?: boolean;
    error?: string;
  }> {
    try {
      console.log('[AutoCommission] Updating order status:', {
        orderId: update.externalOrderId,
        newStatus: update.newStatus,
      });

      // Find the sale by external order ID
      const sale = await storage.getAffiliateSaleByExternalOrderId(
        update.externalOrderId,
        update.externalPlatform
      );

      if (!sale) {
        return {
          success: false,
          error: `Sale not found for order ID: ${update.externalOrderId}`,
        };
      }

      // Update the sale status
      const statusHistory = (sale.statusHistory as any[] || []);
      statusHistory.push({
        status: update.newStatus,
        timestamp: new Date().toISOString(),
        note: update.note || `Status updated to ${update.newStatus}`,
      });

      await storage.updateAffiliateSale(sale.id, {
        orderStatus: update.newStatus,
        statusHistory,
        metadata: update.metadata ? { ...(sale.metadata as object || {}), ...update.metadata } : sale.metadata,
      });

      // Check if we should release the commission
      let commissionReleased = false;
      if (update.newStatus === 'completed' && !sale.commissionReleased) {
        const releaseResult = await this.releaseCommission(sale.id);
        commissionReleased = releaseResult.success;
      }

      // If order is cancelled, returned, or refunded - cancel pending commission
      if (['cancelled', 'returned', 'refunded'].includes(update.newStatus) && !sale.commissionReleased) {
        await this.cancelCommission(sale.id, update.newStatus);
      }

      return {
        success: true,
        commissionReleased,
      };

    } catch (error: any) {
      console.error('[AutoCommission] Error updating order status:', error);
      return {
        success: false,
        error: error.message || 'Failed to update order status',
      };
    }
  }

  /**
   * Release commission for a completed order
   * Creates payment record and invoice automatically
   */
  async releaseCommission(saleId: string): Promise<{
    success: boolean;
    paymentId?: string;
    invoiceId?: string;
    error?: string;
  }> {
    try {
      console.log('[AutoCommission] Releasing commission for sale:', saleId);

      const sale = await storage.getAffiliateSale(saleId);
      if (!sale) {
        return { success: false, error: 'Sale not found' };
      }

      if (sale.commissionReleased) {
        return { success: false, error: 'Commission already released' };
      }

      if (sale.orderStatus !== 'completed') {
        return { success: false, error: 'Order not yet completed' };
      }

      const grossAmount = parseFloat(sale.commissionAmount);
      const platformFeeAmount = Math.round(grossAmount * PLATFORM_FEE_PERCENTAGE * 100) / 100;
      const stripeFeeAmount = Math.round(grossAmount * STRIPE_FEE_PERCENTAGE * 100) / 100;
      const netAmount = Math.round((grossAmount - platformFeeAmount - stripeFeeAmount) * 100) / 100;

      // Get offer for description
      const offer = await storage.getOffer(sale.offerId);
      const offerTitle = offer?.title || 'Affiliate Offer';

      // Create a payment record
      const payment = await storage.createPayment({
        offerId: sale.offerId,
        creatorId: sale.creatorId,
        companyId: sale.companyId,
        grossAmount: grossAmount.toString(),
        platformFeeAmount: platformFeeAmount.toString(),
        platformFeePercentage: (PLATFORM_FEE_PERCENTAGE * 100).toString(),
        stripeFeeAmount: stripeFeeAmount.toString(),
        stripeFeePercentage: (STRIPE_FEE_PERCENTAGE * 100).toString(),
        netAmount: netAmount.toString(),
        paymentType: 'affiliate',
        status: 'pending',
        description: `Auto commission for "${offerTitle}" - Order: ${sale.externalOrderId}`,
      });

      // Update sale with payment ID
      await storage.updateAffiliateSale(saleId, {
        paymentId: payment.id,
        commissionReleased: true,
        commissionReleasedAt: new Date(),
      });

      // Create invoice for company automatically
      const creator = await storage.getUserById(sale.creatorId);
      const invoiceResult = await companyInvoiceService.createInvoiceWithCheckout({
        paymentId: payment.id,
        companyId: sale.companyId,
        creatorId: sale.creatorId,
        grossAmount,
        platformFeeAmount,
        stripeFeeAmount,
        netAmount,
        description: `Auto commission for "${offerTitle}" - Creator: ${creator?.username || 'Unknown'} - Order: ${sale.externalOrderId}`,
      });

      if (!invoiceResult.success) {
        console.error('[AutoCommission] Failed to create invoice:', invoiceResult.error);
        // Payment created but invoice failed - still mark as released
      }

      // Update payment status to processing (invoice created)
      await storage.updatePaymentOrRetainerPaymentStatus(payment.id, 'processing', {
        description: invoiceResult.invoice
          ? `Invoice ${invoiceResult.invoice.invoiceNumber} sent to company`
          : 'Commission released - awaiting company payment',
      });

      // Notify creator
      await notificationService.sendNotification(
        sale.creatorId,
        'payment_pending',
        'Commission Released! 💰',
        `Your CA$${netAmount.toFixed(2)} commission for order ${sale.externalOrderId} has been released. Invoice sent to company for payment.`,
        {
          paymentId: payment.id,
          grossAmount: `CA$${grossAmount.toFixed(2)}`,
          netAmount: `CA$${netAmount.toFixed(2)}`,
          invoiceNumber: invoiceResult.invoice?.invoiceNumber,
        }
      );

      // Notify company about the invoice
      const companyProfile = await storage.getCompanyProfileById(sale.companyId);
      if (companyProfile) {
        const companyUser = await storage.getUserById(companyProfile.userId);
        if (companyUser) {
          await notificationService.sendNotification(
            companyUser.id,
            'invoice_sent',
            'New Commission Invoice',
            `Invoice for CA$${grossAmount.toFixed(2)} has been generated for creator commission. Please pay to release funds to the creator.`,
            {
              invoiceNumber: invoiceResult.invoice?.invoiceNumber,
              amount: `CA$${grossAmount.toFixed(2)}`,
              creatorName: creator?.username || 'Creator',
              linkUrl: '/company/invoices',
            }
          );
        }
      }

      console.log('[AutoCommission] Commission released successfully:', {
        saleId,
        paymentId: payment.id,
        invoiceId: invoiceResult.invoice?.id,
      });

      return {
        success: true,
        paymentId: payment.id,
        invoiceId: invoiceResult.invoice?.id,
      };

    } catch (error: any) {
      console.error('[AutoCommission] Error releasing commission:', error);
      return {
        success: false,
        error: error.message || 'Failed to release commission',
      };
    }
  }

  /**
   * Cancel a pending commission when order is cancelled/returned/refunded
   */
  async cancelCommission(saleId: string, reason: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      console.log('[AutoCommission] Cancelling commission for sale:', saleId, 'Reason:', reason);

      const sale = await storage.getAffiliateSale(saleId);
      if (!sale) {
        return { success: false, error: 'Sale not found' };
      }

      if (sale.commissionReleased) {
        // If commission was already released, this is more complex
        // Would need to handle refund/chargeback - for now just log
        console.warn('[AutoCommission] Commission already released, cannot auto-cancel:', saleId);
        return { success: false, error: 'Commission already released - manual refund required' };
      }

      // Update analytics to remove the pending conversion
      await storage.decrementAnalyticsConversions(sale.applicationId, parseFloat(sale.commissionAmount));

      // Notify creator
      await notificationService.sendNotification(
        sale.creatorId,
        'payment_refunded',
        'Commission Cancelled',
        `Your pending commission of CA$${sale.commissionAmount} was cancelled because the order was ${reason}.`,
        {
          saleId,
          reason,
          orderAmount: sale.orderAmount,
        }
      );

      return { success: true };

    } catch (error: any) {
      console.error('[AutoCommission] Error cancelling commission:', error);
      return {
        success: false,
        error: error.message || 'Failed to cancel commission',
      };
    }
  }

  /**
   * Process pending sales that have passed their hold period
   * Should be run periodically (e.g., daily cron job)
   */
  async processExpiredHoldPeriods(): Promise<{
    processed: number;
    released: number;
    errors: string[];
  }> {
    console.log('[AutoCommission] Processing expired hold periods...');

    const now = new Date();
    const pendingSales = await storage.getAffiliateSalesWithExpiredHold(now);

    let processed = 0;
    let released = 0;
    const errors: string[] = [];

    for (const sale of pendingSales) {
      processed++;

      // Only release if order hasn't been cancelled/returned/refunded
      if (!['cancelled', 'returned', 'refunded'].includes(sale.orderStatus)) {
        // Mark as completed if still in delivered status
        if (sale.orderStatus === 'delivered') {
          await storage.updateAffiliateSale(sale.id, {
            orderStatus: 'completed',
          });
        }

        const result = await this.releaseCommission(sale.id);
        if (result.success) {
          released++;
        } else {
          errors.push(`Sale ${sale.id}: ${result.error}`);
        }
      }
    }

    console.log('[AutoCommission] Hold period processing complete:', {
      processed,
      released,
      errors: errors.length,
    });

    return { processed, released, errors };
  }
}

export const automaticCommissionService = new AutomaticCommissionService();
