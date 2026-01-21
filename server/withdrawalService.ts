/**
 * Withdrawal Service
 *
 * Handles creator withdrawals from their platform wallet to their chosen payment method.
 * Withdrawals are FREE - no fees are deducted (fees were already deducted when crediting the wallet).
 */

import { storage } from './storage';
import { NotificationService } from './notifications/notificationService';
import type { Withdrawal, PaymentSetting } from '../shared/schema';

// Check if sandbox mode is enabled
function isSandboxMode(): boolean {
  return process.env.PAYMENT_SANDBOX_MODE === 'true';
}

export interface WithdrawalRequest {
  creatorId: string;
  amount: number;
  paymentSettingId?: string; // If not provided, uses default payment method
}

export interface WithdrawalResult {
  success: boolean;
  withdrawal?: Withdrawal;
  error?: string;
}

export class WithdrawalService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * Request a withdrawal from creator's wallet
   */
  async requestWithdrawal(request: WithdrawalRequest): Promise<WithdrawalResult> {
    try {
      console.log('[Withdrawal] Processing request:', request);

      // Get creator's wallet
      const wallet = await storage.getCreatorWallet(request.creatorId);
      if (!wallet) {
        return {
          success: false,
          error: 'Wallet not found. Please contact support.',
        };
      }

      // Check available balance
      const availableBalance = parseFloat(wallet.availableBalance);
      if (availableBalance < request.amount) {
        return {
          success: false,
          error: `Insufficient balance. Available: CA$${availableBalance.toFixed(2)}`,
        };
      }

      // Minimum withdrawal amount
      const minimumWithdrawal = 10.00; // CA$10 minimum
      if (request.amount < minimumWithdrawal) {
        return {
          success: false,
          error: `Minimum withdrawal amount is CA$${minimumWithdrawal.toFixed(2)}`,
        };
      }

      // Get payment method
      const paymentSettings = await storage.getPaymentSettings(request.creatorId);
      if (!paymentSettings || paymentSettings.length === 0) {
        return {
          success: false,
          error: 'No payment method configured. Please add a payment method in settings.',
        };
      }

      let paymentMethod: PaymentSetting;
      if (request.paymentSettingId) {
        const found = paymentSettings.find(ps => ps.id === request.paymentSettingId);
        if (!found) {
          return {
            success: false,
            error: 'Selected payment method not found.',
          };
        }
        paymentMethod = found;
      } else {
        // Use default payment method
        paymentMethod = paymentSettings.find(ps => ps.isDefault) || paymentSettings[0];
      }

      // Build payout details based on payment method
      const payoutDetails = this.buildPayoutDetails(paymentMethod);

      // Create withdrawal record
      const withdrawal = await storage.createWithdrawal({
        walletId: wallet.id,
        creatorId: request.creatorId,
        amount: request.amount.toFixed(2),
        feeAmount: '0.00', // No fees for withdrawals
        netAmount: request.amount.toFixed(2), // Full amount goes to creator
        payoutMethod: paymentMethod.payoutMethod,
        payoutDetails,
        status: 'pending',
        requestedAt: new Date(),
      });

      console.log('[Withdrawal] Created withdrawal request:', withdrawal.id);

      // Debit the wallet
      await storage.debitCreatorWallet(
        request.creatorId,
        request.amount,
        `Withdrawal to ${paymentMethod.payoutMethod}`,
        'withdrawal',
        withdrawal.id
      );

      // Send notification to creator
      await this.notificationService.sendNotification(
        request.creatorId,
        'withdrawal_requested',
        'Withdrawal Requested',
        `Your withdrawal of CA$${request.amount.toFixed(2)} to ${paymentMethod.payoutMethod} has been submitted for processing.`,
        { withdrawalId: withdrawal.id, amount: request.amount },
        '/creator/wallet'
      );

      // Notify admins of pending withdrawal
      const admins = await storage.getAdminUsers();
      for (const admin of admins) {
        await this.notificationService.sendNotification(
          admin.id,
          'withdrawal_requested',
          'New Withdrawal Request',
          `A creator has requested a withdrawal of CA$${request.amount.toFixed(2)}.`,
          { withdrawalId: withdrawal.id, creatorId: request.creatorId },
          '/admin/withdrawals'
        );
      }

      return {
        success: true,
        withdrawal,
      };
    } catch (error: any) {
      console.error('[Withdrawal] Error processing request:', error);

      // If wallet was debited, we need to refund
      // This would require transaction support in production

      return {
        success: false,
        error: error.message || 'Failed to process withdrawal request',
      };
    }
  }

  /**
   * Process a pending withdrawal (admin action or automated)
   */
  async processWithdrawal(withdrawalId: string): Promise<WithdrawalResult> {
    try {
      console.log('[Withdrawal] Processing withdrawal:', withdrawalId);

      const withdrawal = await storage.getWithdrawal(withdrawalId);
      if (!withdrawal) {
        return {
          success: false,
          error: 'Withdrawal not found',
        };
      }

      if (withdrawal.status !== 'pending') {
        return {
          success: false,
          error: `Withdrawal is not pending (status: ${withdrawal.status})`,
        };
      }

      // Update status to processing
      await storage.updateWithdrawal(withdrawalId, {
        status: 'processing',
        processingStartedAt: new Date(),
      });

      // Process based on payout method
      const result = await this.executeWithdrawal(withdrawal);

      if (result.success) {
        // Update withdrawal as completed
        const updatedWithdrawal = await storage.updateWithdrawal(withdrawalId, {
          status: 'completed',
          providerTransactionId: result.transactionId,
          providerResponse: result.providerResponse,
          completedAt: new Date(),
        });

        // Send success notification
        await this.notificationService.sendNotification(
          withdrawal.creatorId,
          'withdrawal_completed',
          'Withdrawal Completed',
          `Your withdrawal of CA$${withdrawal.amount} has been sent to your ${withdrawal.payoutMethod}.`,
          { withdrawalId, transactionId: result.transactionId },
          '/creator/wallet'
        );

        return {
          success: true,
          withdrawal: updatedWithdrawal!,
        };
      } else {
        // Update withdrawal as failed and refund wallet
        await storage.updateWithdrawal(withdrawalId, {
          status: 'failed',
          failureReason: result.error,
          failedAt: new Date(),
        });

        // Refund the wallet
        await storage.creditCreatorWallet(
          withdrawal.creatorId,
          parseFloat(withdrawal.amount),
          `Refund for failed withdrawal ${withdrawalId}`,
          'refund',
          withdrawalId
        );

        // Send failure notification
        await this.notificationService.sendNotification(
          withdrawal.creatorId,
          'withdrawal_failed',
          'Withdrawal Failed',
          `Your withdrawal of CA$${withdrawal.amount} could not be processed. The amount has been refunded to your wallet. Reason: ${result.error}`,
          { withdrawalId, error: result.error },
          '/creator/wallet'
        );

        return {
          success: false,
          error: result.error,
        };
      }
    } catch (error: any) {
      console.error('[Withdrawal] Error processing:', error);
      return {
        success: false,
        error: error.message || 'Failed to process withdrawal',
      };
    }
  }

  /**
   * Execute the actual withdrawal via payment provider
   */
  private async executeWithdrawal(withdrawal: Withdrawal): Promise<{
    success: boolean;
    transactionId?: string;
    providerResponse?: any;
    error?: string;
  }> {
    if (isSandboxMode()) {
      console.log('[Withdrawal] SANDBOX MODE - Simulating withdrawal');
      return {
        success: true,
        transactionId: `sandbox_txn_${Date.now()}`,
        providerResponse: { mode: 'sandbox', timestamp: new Date().toISOString() },
      };
    }

    const payoutDetails = withdrawal.payoutDetails as any;
    const amount = parseFloat(withdrawal.netAmount);

    try {
      // Import payment processor dynamically
      const { PaymentProcessor } = await import('./paymentProcessor');
      const processor = new PaymentProcessor();

      switch (withdrawal.payoutMethod) {
        case 'paypal':
          return await processor.processPayPalPayout(
            payoutDetails.paypalEmail,
            amount,
            withdrawal.id,
            `Wallet withdrawal - ${withdrawal.id}`
          );

        case 'etransfer':
          // For e-transfer, we use Stripe Connect
          if (!payoutDetails.stripeAccountId) {
            return {
              success: false,
              error: 'Stripe Connect account not configured',
            };
          }
          const { stripeConnectService } = await import('./stripeConnectService');
          const transferResult = await stripeConnectService.createTransfer(
            payoutDetails.stripeAccountId,
            amount,
            'cad',
            `Wallet withdrawal - ${withdrawal.id}`,
            { withdrawal_id: withdrawal.id }
          );
          return {
            success: transferResult.success,
            transactionId: transferResult.transferId,
            providerResponse: { method: 'stripe_connect' },
            error: transferResult.error,
          };

        case 'wire':
          // For wire/ACH, use the wire payment service
          const { wireAchPaymentService } = await import('./wireAchPaymentService');
          const wireResult = await wireAchPaymentService.processWireTransfer({
            amount,
            routingNumber: payoutDetails.bankRoutingNumber,
            accountNumber: payoutDetails.bankAccountNumber,
            accountHolderName: payoutDetails.bankAccountHolderName,
            accountType: payoutDetails.bankAccountType || 'checking',
            country: payoutDetails.bankCountry || 'US',
            currency: payoutDetails.bankCurrency || 'USD',
            description: `Wallet withdrawal - ${withdrawal.id}`,
          });
          return {
            success: wireResult.success,
            transactionId: wireResult.payoutId,
            providerResponse: wireResult,
            error: wireResult.error,
          };

        case 'crypto':
          // For crypto, use the crypto payment service
          const { cryptoPaymentService } = await import('./cryptoPaymentService');
          const cryptoResult = await cryptoPaymentService.processCryptoPayout(
            payoutDetails.cryptoWalletAddress,
            payoutDetails.cryptoNetwork,
            amount,
            withdrawal.id
          );
          return {
            success: cryptoResult.success,
            transactionId: cryptoResult.transactionHash,
            providerResponse: cryptoResult,
            error: cryptoResult.error,
          };

        default:
          return {
            success: false,
            error: `Unsupported payout method: ${withdrawal.payoutMethod}`,
          };
      }
    } catch (error: any) {
      console.error('[Withdrawal] Execute error:', error);
      return {
        success: false,
        error: error.message || 'Failed to execute withdrawal',
      };
    }
  }

  /**
   * Build payout details from payment setting
   */
  private buildPayoutDetails(paymentMethod: PaymentSetting): Record<string, any> {
    switch (paymentMethod.payoutMethod) {
      case 'paypal':
        return {
          paypalEmail: paymentMethod.paypalEmail,
        };
      case 'etransfer':
        return {
          payoutEmail: paymentMethod.payoutEmail,
          stripeAccountId: paymentMethod.stripeAccountId,
        };
      case 'wire':
        return {
          bankRoutingNumber: paymentMethod.bankRoutingNumber,
          bankAccountNumber: paymentMethod.bankAccountNumber,
          bankAccountHolderName: paymentMethod.bankAccountHolderName,
          bankAccountType: paymentMethod.bankAccountType,
          bankName: paymentMethod.bankName,
          bankCountry: paymentMethod.bankCountry,
          bankCurrency: paymentMethod.bankCurrency,
        };
      case 'crypto':
        return {
          cryptoWalletAddress: paymentMethod.cryptoWalletAddress,
          cryptoNetwork: paymentMethod.cryptoNetwork,
        };
      default:
        return {};
    }
  }

  /**
   * Cancel a pending withdrawal
   */
  async cancelWithdrawal(withdrawalId: string, reason?: string): Promise<WithdrawalResult> {
    try {
      const withdrawal = await storage.getWithdrawal(withdrawalId);
      if (!withdrawal) {
        return {
          success: false,
          error: 'Withdrawal not found',
        };
      }

      if (withdrawal.status !== 'pending') {
        return {
          success: false,
          error: `Cannot cancel withdrawal with status: ${withdrawal.status}`,
        };
      }

      // Update withdrawal status
      const updatedWithdrawal = await storage.updateWithdrawal(withdrawalId, {
        status: 'cancelled',
        cancelledAt: new Date(),
        failureReason: reason || 'Cancelled by user',
      });

      // Refund the wallet
      await storage.creditCreatorWallet(
        withdrawal.creatorId,
        parseFloat(withdrawal.amount),
        `Cancelled withdrawal refund`,
        'refund',
        withdrawalId
      );

      // Send notification
      await this.notificationService.sendNotification(
        withdrawal.creatorId,
        'withdrawal_failed',
        'Withdrawal Cancelled',
        `Your withdrawal of CA$${withdrawal.amount} has been cancelled. The amount has been refunded to your wallet.`,
        { withdrawalId },
        '/creator/wallet'
      );

      return {
        success: true,
        withdrawal: updatedWithdrawal!,
      };
    } catch (error: any) {
      console.error('[Withdrawal] Error cancelling:', error);
      return {
        success: false,
        error: error.message || 'Failed to cancel withdrawal',
      };
    }
  }

  /**
   * Get withdrawal history for a creator
   */
  async getWithdrawalHistory(creatorId: string): Promise<Withdrawal[]> {
    return storage.getWithdrawalsByCreator(creatorId);
  }

  /**
   * Get all pending withdrawals (for admin)
   */
  async getPendingWithdrawals(): Promise<Withdrawal[]> {
    return storage.getPendingWithdrawals();
  }
}

// Export singleton instance
export const withdrawalService = new WithdrawalService();
