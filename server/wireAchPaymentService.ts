// Wire/ACH Payment Service
// Handles bank wire and ACH transfers for creator payouts using Stripe
import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Stripe credentials not configured. Please set STRIPE_SECRET_KEY in your .env file');
  }
  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

/**
 * Check if payment sandbox mode is enabled
 * In sandbox mode, payment operations are simulated without calling real APIs
 */
function isSandboxMode(): boolean {
  return process.env.PAYMENT_SANDBOX_MODE === 'true';
}

export interface WireAchPaymentResult {
  success: boolean;
  transactionId?: string;
  payoutId?: string;
  bankAccountId?: string;
  providerResponse?: any;
  error?: string;
}

export interface BankAccountInfo {
  routingNumber: string;
  accountNumber: string;
  accountHolderName: string;
  accountHolderType: 'individual' | 'company';
  accountType?: 'checking' | 'savings';
  bankName?: string;
  currency?: string;
  country?: string;
}

export interface WireTransferDetails {
  bankAccountId: string;
  amount: number;
  currency: string;
  description: string;
  metadata?: Record<string, string>;
}

export class WireAchPaymentService {
  /**
   * Validate bank account details
   * Checks routing number format and basic validation
   */
  validateBankAccount(bankInfo: BankAccountInfo): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate routing number (US: 9 digits, Canada: 8-9 digits)
    const routingNumber = bankInfo.routingNumber.replace(/\D/g, '');
    if (bankInfo.country === 'CA') {
      // Canadian transit number format: 5 digits branch + 3 digits institution
      if (routingNumber.length < 8 || routingNumber.length > 9) {
        errors.push('Canadian routing/transit number must be 8-9 digits');
      }
    } else {
      // US ABA routing number: 9 digits with checksum
      if (routingNumber.length !== 9) {
        errors.push('US routing number must be exactly 9 digits');
      } else if (!this.validateAbaRoutingNumber(routingNumber)) {
        errors.push('Invalid US routing number checksum');
      }
    }

    // Validate account number (typically 4-17 digits)
    const accountNumber = bankInfo.accountNumber.replace(/\D/g, '');
    if (accountNumber.length < 4 || accountNumber.length > 17) {
      errors.push('Account number must be between 4 and 17 digits');
    }

    // Validate account holder name
    if (!bankInfo.accountHolderName || bankInfo.accountHolderName.trim().length < 2) {
      errors.push('Account holder name is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate US ABA routing number using checksum algorithm
   */
  private validateAbaRoutingNumber(routingNumber: string): boolean {
    if (routingNumber.length !== 9) return false;

    const digits = routingNumber.split('').map(Number);

    // ABA checksum: 3(d1 + d4 + d7) + 7(d2 + d5 + d8) + (d3 + d6 + d9) mod 10 = 0
    const checksum = (
      3 * (digits[0] + digits[3] + digits[6]) +
      7 * (digits[1] + digits[4] + digits[7]) +
      (digits[2] + digits[5] + digits[8])
    ) % 10;

    return checksum === 0;
  }

  /**
   * Create or retrieve a Stripe bank account token for payouts
   * This tokenizes bank account details for secure processing
   */
  async createBankAccountToken(bankInfo: BankAccountInfo): Promise<WireAchPaymentResult> {
    try {
      console.log(`[Wire/ACH] Creating bank account token for account ending in ${bankInfo.accountNumber.slice(-4)}`);

      // Validate bank account first
      const validation = this.validateBankAccount(bankInfo);
      if (!validation.valid) {
        return {
          success: false,
          error: `Bank account validation failed: ${validation.errors.join(', ')}`
        };
      }

      // Sandbox mode: return mock token
      if (isSandboxMode()) {
        const mockTokenId = `ba_sandbox_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log(`[Wire/ACH] 🏖️ SANDBOX MODE: Created mock bank account token ${mockTokenId}`);
        return {
          success: true,
          bankAccountId: mockTokenId,
          providerResponse: {
            sandbox: true,
            accountLast4: bankInfo.accountNumber.slice(-4),
            routingNumber: bankInfo.routingNumber.slice(-4),
            timestamp: new Date().toISOString()
          }
        };
      }

      const stripe = getStripeClient();

      // Create bank account token
      const token = await stripe.tokens.create({
        bank_account: {
          country: bankInfo.country || 'US',
          currency: bankInfo.currency || 'usd',
          account_holder_name: bankInfo.accountHolderName,
          account_holder_type: bankInfo.accountHolderType,
          routing_number: bankInfo.routingNumber,
          account_number: bankInfo.accountNumber,
        },
      });

      console.log(`[Wire/ACH] Created bank account token ${token.id}`);

      return {
        success: true,
        bankAccountId: token.id,
        providerResponse: {
          tokenId: token.id,
          bankAccountId: token.bank_account?.id,
          last4: token.bank_account?.last4,
          bankName: token.bank_account?.bank_name,
          routingNumber: token.bank_account?.routing_number,
          accountHolderType: token.bank_account?.account_holder_type,
        }
      };
    } catch (error: any) {
      console.error('[Wire/ACH] Error creating bank account token:', error.message);
      return {
        success: false,
        error: this.formatStripeError(error)
      };
    }
  }

  /**
   * Add a bank account to a Stripe Connect account for payouts
   */
  async addBankAccountToConnectAccount(
    stripeAccountId: string,
    bankInfo: BankAccountInfo
  ): Promise<WireAchPaymentResult> {
    try {
      console.log(`[Wire/ACH] Adding bank account to Connect account ${stripeAccountId}`);

      // Validate bank account first
      const validation = this.validateBankAccount(bankInfo);
      if (!validation.valid) {
        return {
          success: false,
          error: `Bank account validation failed: ${validation.errors.join(', ')}`
        };
      }

      // Sandbox mode: return mock result
      if (isSandboxMode()) {
        const mockBankAccountId = `ba_sandbox_${Date.now()}`;
        console.log(`[Wire/ACH] 🏖️ SANDBOX MODE: Added mock bank account ${mockBankAccountId} to Connect account`);
        return {
          success: true,
          bankAccountId: mockBankAccountId,
          providerResponse: {
            sandbox: true,
            stripeAccountId,
            accountLast4: bankInfo.accountNumber.slice(-4),
            timestamp: new Date().toISOString()
          }
        };
      }

      const stripe = getStripeClient();

      // Create external account for the connected account
      const externalAccount = await stripe.accounts.createExternalAccount(
        stripeAccountId,
        {
          external_account: {
            object: 'bank_account',
            country: bankInfo.country || 'US',
            currency: bankInfo.currency || 'usd',
            account_holder_name: bankInfo.accountHolderName,
            account_holder_type: bankInfo.accountHolderType,
            routing_number: bankInfo.routingNumber,
            account_number: bankInfo.accountNumber,
          },
        }
      );

      console.log(`[Wire/ACH] Added bank account ${externalAccount.id} to Connect account ${stripeAccountId}`);

      return {
        success: true,
        bankAccountId: externalAccount.id,
        providerResponse: {
          externalAccountId: externalAccount.id,
          stripeAccountId,
          last4: (externalAccount as Stripe.BankAccount).last4,
          bankName: (externalAccount as Stripe.BankAccount).bank_name,
          status: (externalAccount as Stripe.BankAccount).status,
        }
      };
    } catch (error: any) {
      console.error('[Wire/ACH] Error adding bank account to Connect account:', error.message);
      return {
        success: false,
        error: this.formatStripeError(error)
      };
    }
  }

  /**
   * Process a wire/ACH transfer to a bank account
   * Uses Stripe Payouts API to send money directly to bank accounts
   */
  async processWireTransfer(
    routingNumber: string,
    accountNumber: string,
    amount: number,
    paymentId: string,
    description: string,
    accountHolderName: string = 'Creator',
    options?: {
      accountHolderType?: 'individual' | 'company';
      country?: string;
      currency?: string;
      metadata?: Record<string, string>;
    }
  ): Promise<WireAchPaymentResult> {
    try {
      const country = options?.country || 'US';
      const currency = options?.currency || (country === 'CA' ? 'cad' : 'usd');

      console.log(`[Wire/ACH] Processing wire transfer of $${amount} ${currency.toUpperCase()} to account ending in ${accountNumber.slice(-4)}`);

      // Validate minimum amount
      const minimumAmounts: Record<string, number> = {
        'usd': 1.00,
        'cad': 1.00,
      };
      const minAmount = minimumAmounts[currency] || 1.00;

      if (amount < minAmount) {
        return {
          success: false,
          error: `Transfer amount $${amount.toFixed(2)} ${currency.toUpperCase()} is below minimum $${minAmount.toFixed(2)}`
        };
      }

      // Validate bank account
      const validation = this.validateBankAccount({
        routingNumber,
        accountNumber,
        accountHolderName,
        accountHolderType: options?.accountHolderType || 'individual',
        country
      });

      if (!validation.valid) {
        return {
          success: false,
          error: `Bank account validation failed: ${validation.errors.join(', ')}`
        };
      }

      // Sandbox mode: simulate successful transfer
      if (isSandboxMode()) {
        const mockTransactionId = `wire_sandbox_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log(`[Wire/ACH] 🏖️ SANDBOX MODE: Simulating successful wire transfer ${mockTransactionId}`);
        console.log(`[Wire/ACH] 🏖️ SANDBOX MODE: No actual money transferred. This is a test transaction.`);

        return {
          success: true,
          transactionId: mockTransactionId,
          providerResponse: {
            sandbox: true,
            method: 'wire',
            amount,
            currency: currency.toUpperCase(),
            routingNumber: `****${routingNumber.slice(-4)}`,
            accountNumber: `****${accountNumber.slice(-4)}`,
            accountHolderName,
            description,
            status: 'completed',
            estimatedArrival: this.getEstimatedArrivalDate(),
            timestamp: new Date().toISOString(),
            note: 'SANDBOX MODE - No real transfer made'
          }
        };
      }

      const stripe = getStripeClient();

      // For ACH/Wire transfers, we need to:
      // 1. Create a bank account token
      // 2. Create a payout to that bank account

      // First, create the bank account token
      const tokenResult = await this.createBankAccountToken({
        routingNumber,
        accountNumber,
        accountHolderName,
        accountHolderType: options?.accountHolderType || 'individual',
        country,
        currency
      });

      if (!tokenResult.success) {
        return tokenResult;
      }

      // Create payout using Stripe Payouts API
      // Note: This requires the platform to have sufficient balance
      const payout = await stripe.payouts.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency,
        method: 'standard', // 'standard' for ACH (1-2 business days), 'instant' for instant (if available)
        description: description,
        statement_descriptor: 'AFFILIATEXCHANGE',
        metadata: {
          payment_id: paymentId,
          account_holder_name: accountHolderName,
          routing_number_last4: routingNumber.slice(-4),
          account_number_last4: accountNumber.slice(-4),
          ...options?.metadata
        },
      });

      console.log(`[Wire/ACH] Created payout ${payout.id} for $${amount} ${currency.toUpperCase()}`);
      console.log(`[Wire/ACH] Status: ${payout.status}, Arrival: ${payout.arrival_date ? new Date(payout.arrival_date * 1000).toISOString() : 'pending'}`);

      return {
        success: true,
        transactionId: payout.id,
        payoutId: payout.id,
        providerResponse: {
          method: 'wire',
          payoutId: payout.id,
          amount: payout.amount / 100,
          currency: payout.currency.toUpperCase(),
          status: payout.status,
          type: payout.type,
          arrivalDate: payout.arrival_date ? new Date(payout.arrival_date * 1000).toISOString() : null,
          bankAccountLast4: accountNumber.slice(-4),
          description: payout.description,
          statementDescriptor: payout.statement_descriptor,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error: any) {
      console.error('[Wire/ACH] Error processing wire transfer:', error);
      return {
        success: false,
        error: this.formatStripeError(error)
      };
    }
  }

  /**
   * Process ACH Direct Debit transfer using Stripe Connect
   * This is for connected accounts with verified bank details
   */
  async processConnectAccountTransfer(
    stripeAccountId: string,
    amount: number,
    currency: string,
    description: string,
    metadata?: Record<string, string>
  ): Promise<WireAchPaymentResult> {
    try {
      console.log(`[Wire/ACH] Processing Connect transfer of $${amount} ${currency.toUpperCase()} to account ${stripeAccountId}`);

      // Sandbox mode: simulate successful transfer
      if (isSandboxMode()) {
        const mockTransferId = `tr_sandbox_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log(`[Wire/ACH] 🏖️ SANDBOX MODE: Simulating successful Connect transfer ${mockTransferId}`);

        return {
          success: true,
          transactionId: mockTransferId,
          providerResponse: {
            sandbox: true,
            method: 'wire_connect',
            transferId: mockTransferId,
            stripeAccountId,
            amount,
            currency: currency.toUpperCase(),
            status: 'completed',
            timestamp: new Date().toISOString()
          }
        };
      }

      const stripe = getStripeClient();

      // Create transfer to connected account
      const transfer = await stripe.transfers.create({
        amount: Math.round(amount * 100),
        currency: currency.toLowerCase(),
        destination: stripeAccountId,
        description: description,
        metadata: {
          payout_method: 'wire',
          ...metadata
        },
      });

      console.log(`[Wire/ACH] Created Connect transfer ${transfer.id}`);

      return {
        success: true,
        transactionId: transfer.id,
        providerResponse: {
          method: 'wire_connect',
          transferId: transfer.id,
          stripeAccountId,
          amount: transfer.amount / 100,
          currency: transfer.currency.toUpperCase(),
          status: 'completed',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error: any) {
      console.error('[Wire/ACH] Error processing Connect transfer:', error);
      return {
        success: false,
        error: this.formatStripeError(error)
      };
    }
  }

  /**
   * Get payout status from Stripe
   */
  async getPayoutStatus(payoutId: string): Promise<{
    success: boolean;
    status?: string;
    arrivalDate?: string;
    failureMessage?: string;
    error?: string;
  }> {
    try {
      if (isSandboxMode()) {
        return {
          success: true,
          status: 'paid',
          arrivalDate: new Date().toISOString()
        };
      }

      const stripe = getStripeClient();
      const payout = await stripe.payouts.retrieve(payoutId);

      return {
        success: true,
        status: payout.status,
        arrivalDate: payout.arrival_date ? new Date(payout.arrival_date * 1000).toISOString() : undefined,
        failureMessage: payout.failure_message || undefined
      };
    } catch (error: any) {
      console.error('[Wire/ACH] Error getting payout status:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Cancel a pending payout
   */
  async cancelPayout(payoutId: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (isSandboxMode()) {
        console.log(`[Wire/ACH] 🏖️ SANDBOX MODE: Simulating payout cancellation for ${payoutId}`);
        return { success: true };
      }

      const stripe = getStripeClient();
      await stripe.payouts.cancel(payoutId);

      console.log(`[Wire/ACH] Cancelled payout ${payoutId}`);
      return { success: true };
    } catch (error: any) {
      console.error('[Wire/ACH] Error cancelling payout:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get estimated arrival date for ACH transfers
   * ACH typically takes 1-2 business days
   */
  private getEstimatedArrivalDate(): string {
    const now = new Date();
    let businessDays = 2; // Standard ACH timing

    while (businessDays > 0) {
      now.setDate(now.getDate() + 1);
      const dayOfWeek = now.getDay();
      // Skip weekends
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        businessDays--;
      }
    }

    return now.toISOString().split('T')[0]; // Return date only
  }

  /**
   * Format Stripe errors into user-friendly messages
   */
  private formatStripeError(error: any): string {
    if (error.type === 'StripeCardError') {
      return error.message;
    }

    if (error.code === 'insufficient_funds') {
      return 'Insufficient balance in platform account. Please add funds to process payouts.';
    }

    if (error.code === 'invalid_bank_account') {
      return 'Invalid bank account details. Please verify the routing and account numbers.';
    }

    if (error.code === 'bank_account_declined') {
      return 'Bank account was declined. Please use a different bank account.';
    }

    if (error.code === 'bank_account_unusable') {
      return 'This bank account cannot be used for payouts. Please add a different bank account.';
    }

    if (error.message?.includes('routing_number')) {
      return 'Invalid routing number. Please verify the bank routing number.';
    }

    if (error.message?.includes('account_number')) {
      return 'Invalid account number. Please verify the bank account number.';
    }

    return error.message || 'An error occurred processing the wire transfer';
  }
}

// Export singleton instance
export const wireAchPaymentService = new WireAchPaymentService();
