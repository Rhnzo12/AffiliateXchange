/**
 * Company Invoice Service
 *
 * Handles the invoice and payment flow:
 * 1. Creates invoices for creator commissions
 * 2. Generates Stripe Checkout sessions for company payments
 * 3. Handles successful payments and credits creator wallets
 */

import Stripe from 'stripe';
import { storage } from './storage';
import { NotificationService } from './notifications/notificationService';
import type { CompanyInvoice, Payment, RetainerPayment } from '../shared/schema';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia',
});

// Check if sandbox mode is enabled
function isSandboxMode(): boolean {
  return process.env.PAYMENT_SANDBOX_MODE === 'true';
}

export interface CreateInvoiceParams {
  paymentId?: string;
  retainerPaymentId?: string;
  companyId: string;
  creatorId: string;
  grossAmount: number;
  platformFeeAmount: number;
  stripeFeeAmount: number;
  netAmount: number;
  description: string;
  dueDate?: Date;
}

export interface InvoiceResult {
  success: boolean;
  invoice?: CompanyInvoice;
  checkoutUrl?: string;
  error?: string;
}

export class CompanyInvoiceService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * Create an invoice for a payment and generate Stripe Checkout session
   */
  async createInvoiceWithCheckout(params: CreateInvoiceParams): Promise<InvoiceResult> {
    try {
      console.log('[Invoice] Creating invoice for payment:', params);

      // Generate invoice number
      const invoiceNumber = await storage.generateInvoiceNumber();

      // Calculate due date (default: 7 days from now)
      const dueDate = params.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Create invoice record
      const invoice = await storage.createCompanyInvoice({
        invoiceNumber,
        companyId: params.companyId,
        creatorId: params.creatorId,
        paymentId: params.paymentId || null,
        retainerPaymentId: params.retainerPaymentId || null,
        grossAmount: params.grossAmount.toFixed(2),
        platformFeeAmount: params.platformFeeAmount.toFixed(2),
        stripeFeeAmount: params.stripeFeeAmount.toFixed(2),
        netAmount: params.netAmount.toFixed(2),
        status: 'draft',
        description: params.description,
        dueDate,
      });

      console.log('[Invoice] Created invoice:', invoice.id);

      // If sandbox mode, skip Stripe checkout
      if (isSandboxMode()) {
        console.log('[Invoice] SANDBOX MODE - Skipping Stripe Checkout');

        // Update invoice to sent status
        await storage.updateCompanyInvoice(invoice.id, {
          status: 'sent',
          sentAt: new Date(),
        });

        return {
          success: true,
          invoice: { ...invoice, status: 'sent' as const },
          checkoutUrl: `/company/invoices/${invoice.id}?sandbox=true`,
        };
      }

      // Create Stripe Checkout session
      const checkoutSession = await this.createCheckoutSession(invoice);

      if (!checkoutSession.success) {
        return {
          success: false,
          error: checkoutSession.error,
        };
      }

      // Update invoice with Stripe session ID and mark as sent
      const updatedInvoice = await storage.updateCompanyInvoice(invoice.id, {
        stripeCheckoutSessionId: checkoutSession.sessionId,
        status: 'sent',
        sentAt: new Date(),
      });

      return {
        success: true,
        invoice: updatedInvoice!,
        checkoutUrl: checkoutSession.url,
      };
    } catch (error: any) {
      console.error('[Invoice] Error creating invoice:', error);
      return {
        success: false,
        error: error.message || 'Failed to create invoice',
      };
    }
  }

  /**
   * Create Stripe Checkout session for invoice payment
   */
  async createCheckoutSession(invoice: CompanyInvoice): Promise<{
    success: boolean;
    sessionId?: string;
    url?: string;
    error?: string;
  }> {
    try {
      // Get company and creator details
      const company = await storage.getCompanyProfileById(invoice.companyId);
      const creator = await storage.getUserById(invoice.creatorId);

      if (!company || !creator) {
        return {
          success: false,
          error: 'Company or creator not found',
        };
      }

      const baseUrl = process.env.BASE_URL || 'http://localhost:5000';

      // Create Stripe Checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'cad',
              product_data: {
                name: `Commission Payment - ${invoice.invoiceNumber}`,
                description: invoice.description || `Payment to ${creator.username}`,
              },
              unit_amount: Math.round(parseFloat(invoice.grossAmount) * 100), // Convert to cents
            },
            quantity: 1,
          },
        ],
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          companyId: invoice.companyId,
          creatorId: invoice.creatorId,
          paymentId: invoice.paymentId || '',
          retainerPaymentId: invoice.retainerPaymentId || '',
        },
        success_url: `${baseUrl}/company/invoices/${invoice.id}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/company/invoices/${invoice.id}?payment=cancelled`,
        expires_at: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // Expires in 24 hours
      });

      console.log('[Invoice] Created Stripe Checkout session:', session.id);

      return {
        success: true,
        sessionId: session.id,
        url: session.url!,
      };
    } catch (error: any) {
      console.error('[Invoice] Error creating Checkout session:', error);
      return {
        success: false,
        error: error.message || 'Failed to create payment session',
      };
    }
  }

  /**
   * Handle successful payment from Stripe webhook
   */
  async handleSuccessfulPayment(sessionId: string): Promise<{
    success: boolean;
    invoice?: CompanyInvoice;
    error?: string;
  }> {
    try {
      console.log('[Invoice] Handling successful payment for session:', sessionId);

      // Get invoice by Stripe session ID
      const invoice = await storage.getCompanyInvoiceByStripeSession(sessionId);
      if (!invoice) {
        return {
          success: false,
          error: 'Invoice not found for session',
        };
      }

      // Check if already processed
      if (invoice.status === 'paid') {
        console.log('[Invoice] Invoice already marked as paid:', invoice.id);
        return { success: true, invoice };
      }

      // Get Stripe session to verify payment
      let paymentIntentId: string | undefined;
      if (!isSandboxMode()) {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status !== 'paid') {
          return {
            success: false,
            error: 'Payment not completed',
          };
        }
        paymentIntentId = session.payment_intent as string;
      } else {
        paymentIntentId = `sandbox_pi_${Date.now()}`;
      }

      // Update invoice status to paid
      const updatedInvoice = await storage.updateCompanyInvoice(invoice.id, {
        status: 'paid',
        stripePaymentIntentId: paymentIntentId,
        paidAt: new Date(),
      });

      // Credit creator's wallet with net amount
      const netAmount = parseFloat(invoice.netAmount);
      const creator = await storage.getUserById(invoice.creatorId);

      const { wallet, transaction } = await storage.creditCreatorWallet(
        invoice.creatorId,
        netAmount,
        `Payment received for invoice ${invoice.invoiceNumber}`,
        invoice.paymentId ? 'payment' : 'retainer_payment',
        invoice.paymentId || invoice.retainerPaymentId || invoice.id
      );

      console.log('[Invoice] Credited wallet:', wallet.id, 'Amount:', netAmount);

      // Update the original payment status if applicable
      if (invoice.paymentId) {
        await storage.updatePaymentStatus(invoice.paymentId, 'completed', {
          completedAt: new Date(),
          stripePaymentIntentId: paymentIntentId,
        });
      }

      // Send notifications
      if (creator) {
        await this.notificationService.sendNotification(
          invoice.creatorId,
          'wallet_credited',
          'Payment Received',
          `CA$${netAmount.toFixed(2)} has been added to your wallet balance from invoice ${invoice.invoiceNumber}.`,
          { invoiceId: invoice.id, amount: netAmount, walletBalance: wallet.availableBalance },
          '/creator/wallet'
        );
      }

      // Notify company of successful payment
      const company = await storage.getCompanyProfileById(invoice.companyId);
      if (company) {
        await this.notificationService.sendNotification(
          company.userId,
          'invoice_paid',
          'Invoice Payment Confirmed',
          `Your payment for invoice ${invoice.invoiceNumber} has been processed successfully.`,
          { invoiceId: invoice.id, amount: invoice.grossAmount },
          `/company/invoices/${invoice.id}`
        );
      }

      return {
        success: true,
        invoice: updatedInvoice!,
      };
    } catch (error: any) {
      console.error('[Invoice] Error handling payment:', error);
      return {
        success: false,
        error: error.message || 'Failed to process payment',
      };
    }
  }

  /**
   * Handle payment for invoice in sandbox mode (simulate payment)
   */
  async simulatePayment(invoiceId: string): Promise<{
    success: boolean;
    invoice?: CompanyInvoice;
    error?: string;
  }> {
    if (!isSandboxMode()) {
      return {
        success: false,
        error: 'Sandbox mode is not enabled',
      };
    }

    try {
      const invoice = await storage.getCompanyInvoice(invoiceId);
      if (!invoice) {
        return {
          success: false,
          error: 'Invoice not found',
        };
      }

      if (invoice.status !== 'sent') {
        return {
          success: false,
          error: 'Invoice is not in sent status',
        };
      }

      // Simulate successful payment
      const sandboxSessionId = `sandbox_session_${Date.now()}`;
      await storage.updateCompanyInvoice(invoiceId, {
        stripeCheckoutSessionId: sandboxSessionId,
      });

      return this.handleSuccessfulPayment(sandboxSessionId);
    } catch (error: any) {
      console.error('[Invoice] Error simulating payment:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get checkout URL for an existing invoice
   */
  async getCheckoutUrl(invoiceId: string): Promise<{
    success: boolean;
    url?: string;
    error?: string;
  }> {
    try {
      const invoice = await storage.getCompanyInvoice(invoiceId);
      if (!invoice) {
        return {
          success: false,
          error: 'Invoice not found',
        };
      }

      if (invoice.status !== 'sent') {
        return {
          success: false,
          error: 'Invoice is not available for payment',
        };
      }

      // If we have an existing session, check if it's still valid
      if (invoice.stripeCheckoutSessionId && !isSandboxMode()) {
        try {
          const session = await stripe.checkout.sessions.retrieve(invoice.stripeCheckoutSessionId);
          if (session.status === 'open' && session.url) {
            return {
              success: true,
              url: session.url,
            };
          }
        } catch (e) {
          // Session expired or invalid, create new one
        }
      }

      // Create new checkout session
      const result = await this.createCheckoutSession(invoice);
      if (result.success && result.sessionId) {
        await storage.updateCompanyInvoice(invoiceId, {
          stripeCheckoutSessionId: result.sessionId,
        });
      }

      return result;
    } catch (error: any) {
      console.error('[Invoice] Error getting checkout URL:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Cancel an invoice
   */
  async cancelInvoice(invoiceId: string, reason?: string): Promise<{
    success: boolean;
    invoice?: CompanyInvoice;
    error?: string;
  }> {
    try {
      const invoice = await storage.getCompanyInvoice(invoiceId);
      if (!invoice) {
        return {
          success: false,
          error: 'Invoice not found',
        };
      }

      if (invoice.status === 'paid') {
        return {
          success: false,
          error: 'Cannot cancel a paid invoice',
        };
      }

      const updatedInvoice = await storage.updateCompanyInvoice(invoiceId, {
        status: 'cancelled',
        cancelledAt: new Date(),
        metadata: { ...(invoice.metadata as any || {}), cancelReason: reason },
      });

      return {
        success: true,
        invoice: updatedInvoice!,
      };
    } catch (error: any) {
      console.error('[Invoice] Error cancelling invoice:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create invoice for a payment when work is completed
   */
  async createInvoiceForPayment(payment: Payment): Promise<InvoiceResult> {
    // Get offer details for description
    const offer = await storage.getOffer(payment.offerId);
    const creator = await storage.getUserById(payment.creatorId);

    return this.createInvoiceWithCheckout({
      paymentId: payment.id,
      companyId: payment.companyId,
      creatorId: payment.creatorId,
      grossAmount: parseFloat(payment.grossAmount),
      platformFeeAmount: parseFloat(payment.platformFeeAmount),
      stripeFeeAmount: parseFloat(payment.stripeFeeAmount),
      netAmount: parseFloat(payment.netAmount),
      description: `Commission payment for "${offer?.title || 'Offer'}" - Creator: ${creator?.username || 'Unknown'}`,
    });
  }

  /**
   * Create invoice for a retainer payment
   */
  async createInvoiceForRetainerPayment(retainerPayment: RetainerPayment): Promise<InvoiceResult> {
    // Get contract details
    const contract = await storage.getRetainerContract(retainerPayment.contractId);
    const creator = await storage.getUserById(retainerPayment.creatorId);

    return this.createInvoiceWithCheckout({
      retainerPaymentId: retainerPayment.id,
      companyId: retainerPayment.companyId,
      creatorId: retainerPayment.creatorId,
      grossAmount: parseFloat(retainerPayment.grossAmount),
      platformFeeAmount: parseFloat(retainerPayment.platformFeeAmount),
      stripeFeeAmount: parseFloat(retainerPayment.processingFeeAmount || '0'),
      netAmount: parseFloat(retainerPayment.netAmount),
      description: `Retainer payment for "${contract?.title || 'Contract'}" - Month ${retainerPayment.monthNumber || 'N/A'} - Creator: ${creator?.username || 'Unknown'}`,
    });
  }
}

// Export singleton instance
export const companyInvoiceService = new CompanyInvoiceService();
