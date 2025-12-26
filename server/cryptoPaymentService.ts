/**
 * Crypto Payment Service
 * Integrates with BitPay API for processing cryptocurrency payouts
 * Supports multiple networks: Ethereum, Bitcoin, Polygon, BSC, Tron
 *
 * BitPay API Docs: https://bitpay.com/api/
 */

import crypto from 'crypto';

// BitPay API response types
interface BitPayPayoutResponse {
  id: string;
  recipientId: string;
  status: string;
  amount: number;
  currency: string;
  effectiveDate: string;
  requestDate: string;
  notificationEmail: string;
  notificationURL: string;
  transactions: Array<{
    txid: string;
    amount: number;
    date: string;
  }>;
}

interface BitPayRatesResponse {
  [currency: string]: {
    code: string;
    name: string;
    rate: number;
  };
}

// Exchange rate cache
interface ExchangeRateCache {
  rates: Record<string, number>;
  timestamp: number;
}

let exchangeRateCache: ExchangeRateCache | null = null;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Network configuration with BitPay currency codes
export const SUPPORTED_NETWORKS = {
  ethereum: {
    name: 'Ethereum',
    symbol: 'ETH',
    bitPayCurrency: 'ETH',
    addressRegex: /^0x[a-fA-F0-9]{40}$/,
    stablecoin: 'USDC',
    stablecoinSymbol: 'USDC',
  },
  bsc: {
    name: 'Binance Smart Chain',
    symbol: 'BNB',
    bitPayCurrency: 'BNB',
    addressRegex: /^0x[a-fA-F0-9]{40}$/,
    stablecoin: 'BUSD',
    stablecoinSymbol: 'BUSD',
  },
  polygon: {
    name: 'Polygon',
    symbol: 'MATIC',
    bitPayCurrency: 'MATIC',
    addressRegex: /^0x[a-fA-F0-9]{40}$/,
    stablecoin: 'USDC',
    stablecoinSymbol: 'USDC',
  },
  bitcoin: {
    name: 'Bitcoin',
    symbol: 'BTC',
    bitPayCurrency: 'BTC',
    // Legacy, SegWit, and Native SegWit address formats
    addressRegex: /^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{39,59})$/,
    stablecoin: null,
    stablecoinSymbol: null,
  },
  tron: {
    name: 'Tron',
    symbol: 'TRX',
    bitPayCurrency: 'TRX',
    addressRegex: /^T[a-zA-HJ-NP-Z0-9]{33}$/,
    stablecoin: 'USDT',
    stablecoinSymbol: 'USDT',
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
 * Get BitPay API configuration
 */
function getBitPayConfig() {
  const apiToken = process.env.BITPAY_API_TOKEN;
  const isTestnet = process.env.BITPAY_TESTNET === 'true';

  if (!apiToken && !isSandboxMode()) {
    throw new Error('BitPay API token not configured. Set BITPAY_API_TOKEN in your .env file or enable CRYPTO_SANDBOX_MODE=true');
  }

  return {
    apiToken: apiToken || 'sandbox-token',
    baseUrl: isTestnet
      ? 'https://test.bitpay.com'
      : 'https://bitpay.com',
    isTestnet,
  };
}

/**
 * Make an authenticated request to BitPay API
 */
async function bitPayRequest(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: Record<string, any>
): Promise<any> {
  const config = getBitPayConfig();

  const url = `${config.baseUrl}/api/v2${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Accept-Version': '2.0.0',
    'Authorization': `Bearer ${config.apiToken}`,
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || errorData.message ||
      `BitPay API error: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
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
 * Fetch current exchange rates
 */
export async function getExchangeRates(): Promise<ExchangeRateResult> {
  // Check cache first
  if (exchangeRateCache && Date.now() - exchangeRateCache.timestamp < CACHE_DURATION_MS) {
    return { success: true, rates: exchangeRateCache.rates };
  }

  if (isSandboxMode()) {
    // Return mock exchange rates in sandbox mode
    const mockRates: Record<string, number> = {
      BTC: 43500.00,
      ETH: 2350.00,
      MATIC: 0.85,
      BNB: 310.00,
      TRX: 0.11,
      USDC: 1.00,
      USDT: 1.00,
      BUSD: 1.00,
      LTC: 75.00,
      DOGE: 0.08,
    };
    exchangeRateCache = { rates: mockRates, timestamp: Date.now() };
    return { success: true, rates: mockRates };
  }

  try {
    // Use BitPay rates API (public, no auth required)
    const response = await fetch('https://bitpay.com/api/rates');

    if (!response.ok) {
      throw new Error(`BitPay rates API error: ${response.status}`);
    }

    const ratesData = await response.json();
    const rates: Record<string, number> = {};

    // BitPay returns array of {code, name, rate} where rate is USD per crypto
    for (const item of ratesData) {
      if (item.code && item.rate) {
        rates[item.code] = item.rate;
      }
    }

    // Ensure stablecoins are ~$1
    rates['USDC'] = 1.00;
    rates['USDT'] = 1.00;
    rates['BUSD'] = 1.00;

    exchangeRateCache = { rates, timestamp: Date.now() };
    return { success: true, rates };
  } catch (error: any) {
    console.error('[Crypto] Failed to fetch exchange rates from BitPay:', error.message);

    // Fallback to CoinGecko API
    try {
      const fallbackResponse = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,matic-network,binancecoin,tron,litecoin,dogecoin&vs_currencies=usd'
      );
      if (fallbackResponse.ok) {
        const data = await fallbackResponse.json();
        const rates: Record<string, number> = {
          BTC: data.bitcoin?.usd || 43500,
          ETH: data.ethereum?.usd || 2350,
          MATIC: data['matic-network']?.usd || 0.85,
          BNB: data.binancecoin?.usd || 310,
          TRX: data.tron?.usd || 0.11,
          LTC: data.litecoin?.usd || 75,
          DOGE: data.dogecoin?.usd || 0.08,
          USDC: 1.00,
          USDT: 1.00,
          BUSD: 1.00,
        };
        exchangeRateCache = { rates, timestamp: Date.now() };
        return { success: true, rates };
      }
    } catch {
      // Ignore fallback errors
    }

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

  const baseCurrency = cryptoCurrency.toUpperCase();
  const rate = ratesResult.rates[baseCurrency];

  if (!rate) {
    return { success: false, error: `Exchange rate not available for ${cryptoCurrency}` };
  }

  // Calculate crypto amount (rate is USD per 1 crypto)
  const cryptoAmount = usdAmount / rate;

  // Format based on currency precision
  let precision = 8;
  if (['USDC', 'USDT', 'BUSD'].includes(baseCurrency)) {
    precision = 2;
  } else if (baseCurrency === 'BTC') {
    precision = 8;
  } else if (['ETH', 'BNB', 'MATIC'].includes(baseCurrency)) {
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
   * 3. Initiates the payout via BitPay API
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
      let cryptoCurrency = networkConfig.bitPayCurrency;
      let displayCurrency = networkConfig.symbol;

      if (preferStablecoin && networkConfig.stablecoin) {
        cryptoCurrency = networkConfig.stablecoin;
        displayCurrency = networkConfig.stablecoinSymbol || networkConfig.symbol;
      }

      // Convert USD to crypto
      const conversionResult = await convertUsdToCrypto(usdAmount, cryptoCurrency);
      if (!conversionResult.success) {
        return { success: false, error: conversionResult.error };
      }

      console.log(`[Crypto Payout] Converting $${usdAmount} to ${conversionResult.cryptoAmount} ${displayCurrency}`);

      // In sandbox mode, simulate the transaction
      if (isSandboxMode()) {
        return this.simulateCryptoPayout(
          walletAddress,
          network,
          usdAmount,
          conversionResult.cryptoAmount!,
          displayCurrency,
          paymentId
        );
      }

      // Process real payout via BitPay
      return await this.sendCryptoViaBitPay(
        walletAddress,
        network,
        usdAmount,
        conversionResult.cryptoAmount!,
        cryptoCurrency,
        displayCurrency,
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
    const mockPayoutId = `BP${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    console.log(`[Crypto Payout] SANDBOX MODE - Simulated transaction`);
    console.log(`[Crypto Payout] Payout ID: ${mockPayoutId}`);
    console.log(`[Crypto Payout] TX Hash: ${mockTxHash}`);

    return {
      success: true,
      transactionId: mockPayoutId,
      txHash: mockTxHash,
      network: network,
      amount: usdAmount,
      cryptoAmount: cryptoAmount,
      cryptoCurrency: cryptoCurrency,
      walletAddress: walletAddress,
      providerResponse: {
        method: 'crypto',
        provider: 'bitpay',
        payoutId: mockPayoutId,
        network: network,
        walletAddress: walletAddress,
        usdAmount: usdAmount,
        cryptoAmount: cryptoAmount,
        cryptoCurrency: cryptoCurrency,
        txHash: mockTxHash,
        timestamp: new Date().toISOString(),
        status: 'complete',
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
      return Array.from({ length: 64 }, randomHex).join('');
    }

    if (network === 'tron') {
      return Array.from({ length: 64 }, randomHex).join('');
    }

    // EVM-compatible chains use 0x prefix
    return '0x' + Array.from({ length: 64 }, randomHex).join('');
  }

  /**
   * Send crypto via BitPay Payouts API
   */
  private async sendCryptoViaBitPay(
    walletAddress: string,
    network: SupportedNetwork,
    usdAmount: number,
    cryptoAmount: string,
    cryptoCurrency: string,
    displayCurrency: string,
    paymentId: string,
    memo?: string
  ): Promise<CryptoPaymentResult> {
    try {
      console.log(`[Crypto Payout] Initiating BitPay payout...`);
      console.log(`[Crypto Payout] Currency: ${cryptoCurrency}, Amount: ${cryptoAmount}`);

      // BitPay Payouts API
      // First, create or get recipient
      const recipientData = {
        email: `payout-${paymentId}@affiliatexchange.com`,
        label: `Payout ${paymentId}`,
        notificationURL: process.env.BITPAY_WEBHOOK_URL || '',
      };

      // Create payout request
      const payoutData = {
        amount: parseFloat(cryptoAmount),
        currency: cryptoCurrency,
        ledgerCurrency: 'USD',
        reference: paymentId,
        notificationEmail: recipientData.email,
        notificationURL: recipientData.notificationURL,
        email: recipientData.email,
        recipientId: '', // Will be set after creating recipient
        label: memo || `AffiliateXchange payout - ${paymentId}`,
        effectiveDate: new Date().toISOString(),
        token: getBitPayConfig().apiToken,
      };

      // For BitPay, we need to use their payout batch system
      const payoutBatchData = {
        instructions: [{
          amount: usdAmount,
          method: 1, // Crypto wallet
          currency: cryptoCurrency,
          address: walletAddress,
          label: memo || `Payout ${paymentId}`,
        }],
        notificationEmail: recipientData.email,
        notificationURL: recipientData.notificationURL,
        reference: paymentId,
        token: getBitPayConfig().apiToken,
      };

      const response = await bitPayRequest('/payouts', 'POST', payoutBatchData);

      console.log(`[Crypto Payout] BitPay payout created:`, response.id || response);

      const payoutId = response.id || response.data?.id || `BP-${Date.now()}`;

      return {
        success: true,
        transactionId: payoutId,
        txHash: payoutId, // TX hash will be available after processing
        network: network,
        amount: usdAmount,
        cryptoAmount: cryptoAmount,
        cryptoCurrency: displayCurrency,
        walletAddress: walletAddress,
        providerResponse: {
          method: 'crypto',
          provider: 'bitpay',
          payoutId: payoutId,
          status: response.status || 'new',
          network: network,
          walletAddress: walletAddress,
          usdAmount: usdAmount,
          cryptoAmount: cryptoAmount,
          cryptoCurrency: displayCurrency,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      console.error('[Crypto Payout] BitPay API error:', error.message);

      // Provide helpful error messages
      let errorMessage = error.message;
      if (error.message.includes('API token') || error.message.includes('401')) {
        errorMessage = 'BitPay API token not configured or invalid. Please check your BITPAY_API_TOKEN.';
      } else if (error.message.includes('Insufficient') || error.message.includes('balance')) {
        errorMessage = 'Insufficient balance in BitPay account. Please add funds to process this payout.';
      } else if (error.message.includes('Invalid') && error.message.includes('address')) {
        errorMessage = 'Invalid wallet address for the selected cryptocurrency.';
      }

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Check the status of a crypto payout
   */
  async checkTransactionStatus(payoutId: string): Promise<{
    success: boolean;
    status?: string;
    txHash?: string;
    error?: string;
  }> {
    if (isSandboxMode()) {
      return {
        success: true,
        status: 'complete',
        txHash: this.generateMockTxHash('ethereum'),
      };
    }

    try {
      const response = await bitPayRequest(`/payouts/${payoutId}`);

      return {
        success: true,
        status: response.status || 'unknown',
        txHash: response.transactions?.[0]?.txid,
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
      stablecoin: config.stablecoinSymbol,
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
    // BitPay handles fees internally, but we can provide estimates
    const approximateFees: Record<SupportedNetwork, number> = {
      ethereum: 5.00,
      bsc: 0.30,
      polygon: 0.10,
      bitcoin: 2.00,
      tron: 1.00,
    };

    const feeUsd = approximateFees[network] || 1.00;

    return {
      success: true,
      estimatedFeeUsd: feeUsd,
      estimatedFeeCrypto: `~$${feeUsd.toFixed(2)} USD equivalent`,
    };
  }

  /**
   * Get BitPay account balance (for admin use)
   */
  async getAccountBalance(): Promise<{
    success: boolean;
    balances?: Record<string, { balance: number; balanceUsd: number }>;
    error?: string;
  }> {
    if (isSandboxMode()) {
      return {
        success: true,
        balances: {
          BTC: { balance: 0.5, balanceUsd: 21750 },
          ETH: { balance: 5.0, balanceUsd: 11750 },
          USD: { balance: 10000, balanceUsd: 10000 },
        },
      };
    }

    try {
      const response = await bitPayRequest('/ledgers');
      const rates = (await getExchangeRates()).rates || {};
      const balances: Record<string, { balance: number; balanceUsd: number }> = {};

      if (Array.isArray(response)) {
        for (const ledger of response) {
          if (ledger.currency && ledger.balance !== undefined) {
            const rate = rates[ledger.currency] || (ledger.currency === 'USD' ? 1 : 0);
            balances[ledger.currency] = {
              balance: ledger.balance,
              balanceUsd: ledger.currency === 'USD' ? ledger.balance : ledger.balance * rate,
            };
          }
        }
      }

      return { success: true, balances };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export const cryptoPaymentService = new CryptoPaymentService();
