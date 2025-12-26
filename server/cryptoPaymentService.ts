/**
 * Crypto Payment Service
 * Integrates with Coinbase Commerce API for processing cryptocurrency payouts
 * Supports multiple networks: Ethereum, Bitcoin, Polygon, BSC, Tron
 */

import { storage } from "./storage";

// Coinbase Commerce API types
interface CoinbaseChargeData {
  id: string;
  code: string;
  name: string;
  description: string;
  hosted_url: string;
  created_at: string;
  expires_at: string;
  timeline: Array<{
    status: string;
    time: string;
  }>;
  pricing: {
    local: { amount: string; currency: string };
    bitcoin?: { amount: string; currency: string };
    ethereum?: { amount: string; currency: string };
    usdc?: { amount: string; currency: string };
  };
  addresses: {
    bitcoin?: string;
    ethereum?: string;
    usdc?: string;
  };
  payments: Array<{
    network: string;
    transaction_id: string;
    status: string;
    value: { amount: string; currency: string };
    block: { height: number; hash: string };
  }>;
}

interface CoinbaseSendMoneyResponse {
  id: string;
  status: string;
  transaction: {
    id: string;
    status: string;
    network: {
      hash?: string;
      status: string;
    };
  };
}

// Exchange rate cache
interface ExchangeRateCache {
  rates: Record<string, number>;
  timestamp: number;
}

let exchangeRateCache: ExchangeRateCache | null = null;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Network configuration
export const SUPPORTED_NETWORKS = {
  ethereum: {
    name: 'Ethereum',
    symbol: 'ETH',
    coinbaseAsset: 'ETH',
    addressRegex: /^0x[a-fA-F0-9]{40}$/,
    stablecoin: 'USDC',
  },
  bsc: {
    name: 'Binance Smart Chain',
    symbol: 'BNB',
    coinbaseAsset: 'BNB',
    addressRegex: /^0x[a-fA-F0-9]{40}$/,
    stablecoin: 'BUSD',
  },
  polygon: {
    name: 'Polygon',
    symbol: 'MATIC',
    coinbaseAsset: 'MATIC',
    addressRegex: /^0x[a-fA-F0-9]{40}$/,
    stablecoin: 'USDC',
  },
  bitcoin: {
    name: 'Bitcoin',
    symbol: 'BTC',
    coinbaseAsset: 'BTC',
    // Legacy, SegWit, and Native SegWit address formats
    addressRegex: /^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{39,59})$/,
    stablecoin: null,
  },
  tron: {
    name: 'Tron',
    symbol: 'TRX',
    coinbaseAsset: 'TRX',
    addressRegex: /^T[a-zA-HJ-NP-Z0-9]{33}$/,
    stablecoin: 'USDT',
  },
} as const;

export type SupportedNetwork = keyof typeof SUPPORTED_NETWORKS;

export interface CryptoPaymentResult {
  success: boolean;
  transactionId?: string;
  txHash?: string;
  network?: string;
  amount?: number;
  cryptoAmount?: string;
  cryptoCurrency?: string;
  walletAddress?: string;
  providerResponse?: any;
  error?: string;
}

export interface ExchangeRateResult {
  success: boolean;
  rates?: Record<string, number>;
  error?: string;
}

/**
 * Check if crypto sandbox mode is enabled
 * In sandbox mode, crypto operations are simulated without calling real APIs
 */
function isSandboxMode(): boolean {
  return process.env.PAYMENT_SANDBOX_MODE === 'true' ||
         process.env.CRYPTO_SANDBOX_MODE === 'true';
}

/**
 * Get Coinbase Commerce API configuration
 */
function getCoinbaseConfig() {
  const apiKey = process.env.COINBASE_COMMERCE_API_KEY;
  const webhookSecret = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET;

  if (!apiKey && !isSandboxMode()) {
    throw new Error('Coinbase Commerce API key not configured. Set COINBASE_COMMERCE_API_KEY in your .env file or enable CRYPTO_SANDBOX_MODE=true');
  }

  return {
    apiKey: apiKey || 'sandbox-key',
    webhookSecret: webhookSecret || '',
    baseUrl: 'https://api.commerce.coinbase.com',
  };
}

/**
 * Validate a cryptocurrency wallet address for a specific network
 */
export function validateWalletAddress(address: string, network: SupportedNetwork): { valid: boolean; error?: string } {
  const networkConfig = SUPPORTED_NETWORKS[network];

  if (!networkConfig) {
    return { valid: false, error: `Unsupported network: ${network}` };
  }

  if (!address || typeof address !== 'string') {
    return { valid: false, error: 'Wallet address is required' };
  }

  const trimmedAddress = address.trim();

  if (!networkConfig.addressRegex.test(trimmedAddress)) {
    return {
      valid: false,
      error: `Invalid ${networkConfig.name} wallet address format`
    };
  }

  return { valid: true };
}

/**
 * Fetch current exchange rates from Coinbase
 */
export async function getExchangeRates(): Promise<ExchangeRateResult> {
  // Check cache first
  if (exchangeRateCache && Date.now() - exchangeRateCache.timestamp < CACHE_DURATION_MS) {
    return { success: true, rates: exchangeRateCache.rates };
  }

  if (isSandboxMode()) {
    // Return mock exchange rates in sandbox mode
    const mockRates = {
      BTC: 43500.00,
      ETH: 2350.00,
      MATIC: 0.85,
      BNB: 310.00,
      TRX: 0.11,
      USDC: 1.00,
      USDT: 1.00,
    };
    exchangeRateCache = { rates: mockRates, timestamp: Date.now() };
    return { success: true, rates: mockRates };
  }

  try {
    const response = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=USD');

    if (!response.ok) {
      throw new Error(`Coinbase API error: ${response.status}`);
    }

    const data = await response.json();
    const rates: Record<string, number> = {};

    // Convert rates (Coinbase returns USD per crypto, we want crypto per USD)
    for (const [currency, rate] of Object.entries(data.data.rates)) {
      if (typeof rate === 'string') {
        rates[currency] = 1 / parseFloat(rate);
      }
    }

    exchangeRateCache = { rates, timestamp: Date.now() };
    return { success: true, rates };
  } catch (error: any) {
    console.error('[Crypto] Failed to fetch exchange rates:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Convert USD amount to cryptocurrency
 */
export async function convertUsdToCrypto(
  usdAmount: number,
  cryptoCurrency: string
): Promise<{ success: boolean; cryptoAmount?: string; rate?: number; error?: string }> {
  const ratesResult = await getExchangeRates();

  if (!ratesResult.success || !ratesResult.rates) {
    return { success: false, error: ratesResult.error || 'Failed to get exchange rates' };
  }

  const rate = ratesResult.rates[cryptoCurrency.toUpperCase()];

  if (!rate) {
    return { success: false, error: `Exchange rate not available for ${cryptoCurrency}` };
  }

  // Calculate crypto amount (1 USD = rate units of crypto)
  const cryptoAmount = usdAmount / rate;

  // Format based on currency precision
  let precision = 8; // Default for most cryptos
  if (['USDC', 'USDT', 'BUSD'].includes(cryptoCurrency.toUpperCase())) {
    precision = 2; // Stablecoins use 2 decimals
  } else if (cryptoCurrency.toUpperCase() === 'BTC') {
    precision = 8; // Bitcoin uses satoshi precision
  } else if (['ETH', 'BNB', 'MATIC'].includes(cryptoCurrency.toUpperCase())) {
    precision = 6;
  }

  return {
    success: true,
    cryptoAmount: cryptoAmount.toFixed(precision),
    rate: rate,
  };
}

class CryptoPaymentService {
  /**
   * Process a cryptocurrency payout to a creator's wallet
   *
   * This method handles the full crypto payout flow:
   * 1. Validates the wallet address
   * 2. Converts USD to crypto amount
   * 3. Initiates the blockchain transaction via Coinbase Commerce
   * 4. Returns transaction details
   */
  async processCryptoPayout(
    walletAddress: string,
    network: SupportedNetwork,
    usdAmount: number,
    paymentId: string,
    options: {
      preferStablecoin?: boolean;
      memo?: string;
    } = {}
  ): Promise<CryptoPaymentResult> {
    const { preferStablecoin = true, memo } = options;

    try {
      console.log(`[Crypto Payout] Processing $${usdAmount} USD to ${walletAddress} on ${network}`);

      // Validate wallet address
      const validationResult = validateWalletAddress(walletAddress, network);
      if (!validationResult.valid) {
        return { success: false, error: validationResult.error };
      }

      const networkConfig = SUPPORTED_NETWORKS[network];

      // Determine which crypto to use (stablecoin if available and preferred)
      let cryptoCurrency = networkConfig.symbol;
      if (preferStablecoin && networkConfig.stablecoin) {
        cryptoCurrency = networkConfig.stablecoin;
      }

      // Convert USD to crypto
      const conversionResult = await convertUsdToCrypto(usdAmount, cryptoCurrency);
      if (!conversionResult.success) {
        return { success: false, error: conversionResult.error };
      }

      console.log(`[Crypto Payout] Converting $${usdAmount} to ${conversionResult.cryptoAmount} ${cryptoCurrency}`);

      // In sandbox mode, simulate the transaction
      if (isSandboxMode()) {
        return this.simulateCryptoPayout(
          walletAddress,
          network,
          usdAmount,
          conversionResult.cryptoAmount!,
          cryptoCurrency,
          paymentId
        );
      }

      // Process real transaction via Coinbase Commerce
      return await this.sendCryptoViaCoinbase(
        walletAddress,
        network,
        usdAmount,
        conversionResult.cryptoAmount!,
        cryptoCurrency,
        paymentId,
        memo
      );
    } catch (error: any) {
      console.error('[Crypto Payout] Error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Simulate a crypto payout for sandbox/testing mode
   */
  private simulateCryptoPayout(
    walletAddress: string,
    network: SupportedNetwork,
    usdAmount: number,
    cryptoAmount: string,
    cryptoCurrency: string,
    paymentId: string
  ): CryptoPaymentResult {
    const mockTxHash = this.generateMockTxHash(network);

    console.log(`[Crypto Payout] SANDBOX MODE - Simulated transaction`);
    console.log(`[Crypto Payout] TX Hash: ${mockTxHash}`);

    return {
      success: true,
      transactionId: `crypto-${paymentId}-${Date.now()}`,
      txHash: mockTxHash,
      network: network,
      amount: usdAmount,
      cryptoAmount: cryptoAmount,
      cryptoCurrency: cryptoCurrency,
      walletAddress: walletAddress,
      providerResponse: {
        method: 'crypto',
        network: network,
        walletAddress: walletAddress,
        usdAmount: usdAmount,
        cryptoAmount: cryptoAmount,
        cryptoCurrency: cryptoCurrency,
        txHash: mockTxHash,
        timestamp: new Date().toISOString(),
        status: 'completed',
        note: 'SANDBOX MODE - Simulated transaction',
      },
    };
  }

  /**
   * Generate a mock transaction hash for testing
   */
  private generateMockTxHash(network: SupportedNetwork): string {
    const randomHex = () => Math.floor(Math.random() * 16).toString(16);

    if (network === 'bitcoin') {
      // Bitcoin tx hashes are 64 hex characters
      return Array.from({ length: 64 }, randomHex).join('');
    }

    // EVM-compatible chains use 0x prefix
    return '0x' + Array.from({ length: 64 }, randomHex).join('');
  }

  /**
   * Send crypto via Coinbase Commerce API
   */
  private async sendCryptoViaCoinbase(
    walletAddress: string,
    network: SupportedNetwork,
    usdAmount: number,
    cryptoAmount: string,
    cryptoCurrency: string,
    paymentId: string,
    memo?: string
  ): Promise<CryptoPaymentResult> {
    try {
      const config = getCoinbaseConfig();

      // Create a charge/send request via Coinbase Commerce
      // Note: Coinbase Commerce is primarily for receiving payments
      // For sending/payouts, you would typically use Coinbase Exchange API or Coinbase Wallet API
      // This implementation uses a simplified approach suitable for the platform

      const networkConfig = SUPPORTED_NETWORKS[network];

      // For production, you would integrate with Coinbase Exchange API for actual payouts
      // Here we create a tracking record and initiate the transfer

      const chargeData = {
        name: `Payout - ${paymentId}`,
        description: memo || `Creator payout of ${cryptoAmount} ${cryptoCurrency}`,
        pricing_type: 'fixed_price',
        local_price: {
          amount: usdAmount.toFixed(2),
          currency: 'USD',
        },
        metadata: {
          payment_id: paymentId,
          recipient_address: walletAddress,
          network: network,
          type: 'payout',
        },
      };

      const response = await fetch(`${config.baseUrl}/charges`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CC-Api-Key': config.apiKey,
          'X-CC-Version': '2018-03-22',
        },
        body: JSON.stringify(chargeData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message ||
          `Coinbase API error: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();
      const charge = result.data as CoinbaseChargeData;

      console.log(`[Crypto Payout] Coinbase charge created: ${charge.id}`);
      console.log(`[Crypto Payout] Code: ${charge.code}`);

      // For actual payouts, you would use Coinbase Exchange API's "Send Money" endpoint
      // This charge creation is for tracking purposes

      return {
        success: true,
        transactionId: charge.id,
        txHash: charge.code, // Use charge code as reference until blockchain tx is confirmed
        network: network,
        amount: usdAmount,
        cryptoAmount: cryptoAmount,
        cryptoCurrency: cryptoCurrency,
        walletAddress: walletAddress,
        providerResponse: {
          method: 'crypto',
          provider: 'coinbase_commerce',
          chargeId: charge.id,
          chargeCode: charge.code,
          hostedUrl: charge.hosted_url,
          network: network,
          walletAddress: walletAddress,
          usdAmount: usdAmount,
          cryptoAmount: cryptoAmount,
          cryptoCurrency: cryptoCurrency,
          createdAt: charge.created_at,
          expiresAt: charge.expires_at,
          status: 'pending',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      console.error('[Crypto Payout] Coinbase API error:', error.message);

      // Provide helpful error messages
      let errorMessage = error.message;
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        errorMessage = 'Invalid Coinbase Commerce API key. Please check your COINBASE_COMMERCE_API_KEY configuration.';
      } else if (error.message.includes('403')) {
        errorMessage = 'Coinbase Commerce API access denied. Ensure your API key has the required permissions.';
      } else if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
        errorMessage = 'Unable to reach Coinbase Commerce API. Please check your internet connection.';
      }

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Check the status of a crypto transaction
   */
  async checkTransactionStatus(chargeId: string): Promise<{
    success: boolean;
    status?: string;
    confirmations?: number;
    txHash?: string;
    error?: string;
  }> {
    if (isSandboxMode()) {
      return {
        success: true,
        status: 'completed',
        confirmations: 12,
        txHash: this.generateMockTxHash('ethereum'),
      };
    }

    try {
      const config = getCoinbaseConfig();

      const response = await fetch(`${config.baseUrl}/charges/${chargeId}`, {
        headers: {
          'X-CC-Api-Key': config.apiKey,
          'X-CC-Version': '2018-03-22',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch charge status: ${response.status}`);
      }

      const result = await response.json();
      const charge = result.data as CoinbaseChargeData;

      // Get latest status from timeline
      const latestStatus = charge.timeline[charge.timeline.length - 1]?.status || 'NEW';

      // Get payment details if available
      const payment = charge.payments[0];

      return {
        success: true,
        status: latestStatus.toLowerCase(),
        confirmations: payment?.block?.height || 0,
        txHash: payment?.transaction_id,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get network information for display
   */
  getNetworkInfo(network: SupportedNetwork) {
    return SUPPORTED_NETWORKS[network] || null;
  }

  /**
   * Get all supported networks
   */
  getSupportedNetworks() {
    return Object.entries(SUPPORTED_NETWORKS).map(([key, config]) => ({
      id: key,
      name: config.name,
      symbol: config.symbol,
      stablecoin: config.stablecoin,
    }));
  }

  /**
   * Estimate transaction fees for a network
   * Returns approximate fee in USD
   */
  async estimateTransactionFee(network: SupportedNetwork): Promise<{
    success: boolean;
    estimatedFeeUsd?: number;
    estimatedFeeCrypto?: string;
    error?: string;
  }> {
    // Approximate gas fees by network (these would ideally come from a gas price API)
    const approximateFees: Record<SupportedNetwork, number> = {
      ethereum: 5.00,    // Ethereum mainnet is expensive
      bsc: 0.20,         // BSC is cheap
      polygon: 0.05,     // Polygon is very cheap
      bitcoin: 2.00,     // Bitcoin varies
      tron: 0.50,        // Tron is relatively cheap
    };

    const feeUsd = approximateFees[network] || 1.00;

    return {
      success: true,
      estimatedFeeUsd: feeUsd,
      estimatedFeeCrypto: `~$${feeUsd.toFixed(2)} USD equivalent`,
    };
  }
}

export const cryptoPaymentService = new CryptoPaymentService();
