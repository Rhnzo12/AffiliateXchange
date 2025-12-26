/**
 * Crypto Payment Service
 * Integrates with NOWPayments API for processing cryptocurrency payouts
 * Supports multiple networks: Ethereum, Bitcoin, Polygon, BSC, Tron
 *
 * NOWPayments API Docs: https://documenter.getpostman.com/view/7907941/S1a32n38
 */

// NOWPayments API response types
interface NOWPaymentsPayoutResponse {
  id: string;
  status: string;
  address: string;
  currency: string;
  amount: string;
  hash?: string;
  created_at: string;
}

interface NOWPaymentsEstimateResponse {
  currency_from: string;
  amount_from: number;
  currency_to: string;
  estimated_amount: number;
}

// Exchange rate cache
interface ExchangeRateCache {
  rates: Record<string, number>;
  timestamp: number;
}

let exchangeRateCache: ExchangeRateCache | null = null;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Network configuration with NOWPayments currency codes
export const SUPPORTED_NETWORKS = {
  ethereum: {
    name: 'Ethereum',
    symbol: 'ETH',
    nowPaymentsCurrency: 'eth',
    addressRegex: /^0x[a-fA-F0-9]{40}$/,
    stablecoin: 'usdterc20',
    stablecoinSymbol: 'USDT',
  },
  bsc: {
    name: 'Binance Smart Chain',
    symbol: 'BNB',
    nowPaymentsCurrency: 'bnbbsc',
    addressRegex: /^0x[a-fA-F0-9]{40}$/,
    stablecoin: 'usdtbsc',
    stablecoinSymbol: 'USDT',
  },
  polygon: {
    name: 'Polygon',
    symbol: 'MATIC',
    nowPaymentsCurrency: 'maticmainnet',
    addressRegex: /^0x[a-fA-F0-9]{40}$/,
    stablecoin: 'usdtmatic',
    stablecoinSymbol: 'USDT',
  },
  bitcoin: {
    name: 'Bitcoin',
    symbol: 'BTC',
    nowPaymentsCurrency: 'btc',
    // Legacy, SegWit, and Native SegWit address formats
    addressRegex: /^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{39,59})$/,
    stablecoin: null,
    stablecoinSymbol: null,
  },
  tron: {
    name: 'Tron',
    symbol: 'TRX',
    nowPaymentsCurrency: 'trx',
    addressRegex: /^T[a-zA-HJ-NP-Z0-9]{33}$/,
    stablecoin: 'usdttrc20',
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
 * Get NOWPayments API configuration
 */
function getNOWPaymentsConfig() {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;

  if (!apiKey && !isSandboxMode()) {
    throw new Error('NOWPayments API key not configured. Set NOWPAYMENTS_API_KEY in your .env file or enable CRYPTO_SANDBOX_MODE=true');
  }

  return {
    apiKey: apiKey || 'sandbox-key',
    ipnSecret: ipnSecret || '',
    baseUrl: 'https://api.nowpayments.io/v1',
  };
}

/**
 * Make an authenticated request to NOWPayments API
 */
async function nowPaymentsRequest(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: Record<string, any>
): Promise<any> {
  const config = getNOWPaymentsConfig();

  const url = `${config.baseUrl}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': config.apiKey,
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message || data.error ||
      `NOWPayments API error: ${response.status} ${response.statusText}`
    );
  }

  return data;
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
    // Use NOWPayments currencies API to get available currencies and their status
    const currencies = await nowPaymentsRequest('/currencies');

    // Get estimates for major currencies vs USD
    const rates: Record<string, number> = {};

    // Fetch rates from CoinGecko as primary source (more reliable for display)
    const coingeckoResponse = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,matic-network,binancecoin,tron,litecoin,dogecoin&vs_currencies=usd'
    );

    if (coingeckoResponse.ok) {
      const data = await coingeckoResponse.json();
      rates['BTC'] = data.bitcoin?.usd || 43500;
      rates['ETH'] = data.ethereum?.usd || 2350;
      rates['MATIC'] = data['matic-network']?.usd || 0.85;
      rates['BNB'] = data.binancecoin?.usd || 310;
      rates['TRX'] = data.tron?.usd || 0.11;
      rates['LTC'] = data.litecoin?.usd || 75;
      rates['DOGE'] = data.dogecoin?.usd || 0.08;
    }

    // Stablecoins are always ~$1
    rates['USDC'] = 1.00;
    rates['USDT'] = 1.00;
    rates['BUSD'] = 1.00;

    exchangeRateCache = { rates, timestamp: Date.now() };
    return { success: true, rates };
  } catch (error: any) {
    console.error('[Crypto] Failed to fetch exchange rates:', error.message);

    // Fallback rates
    const fallbackRates: Record<string, number> = {
      BTC: 43500.00,
      ETH: 2350.00,
      MATIC: 0.85,
      BNB: 310.00,
      TRX: 0.11,
      USDC: 1.00,
      USDT: 1.00,
      BUSD: 1.00,
    };
    exchangeRateCache = { rates: fallbackRates, timestamp: Date.now() };
    return { success: true, rates: fallbackRates };
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

  // Map NOWPayments currency codes to standard symbols
  const currencyMap: Record<string, string> = {
    'eth': 'ETH',
    'btc': 'BTC',
    'trx': 'TRX',
    'bnbbsc': 'BNB',
    'maticmainnet': 'MATIC',
    'usdterc20': 'USDT',
    'usdtbsc': 'USDT',
    'usdtmatic': 'USDT',
    'usdttrc20': 'USDT',
  };

  const baseCurrency = currencyMap[cryptoCurrency.toLowerCase()] || cryptoCurrency.toUpperCase();
  const rate = ratesResult.rates[baseCurrency];

  if (!rate) {
    return { success: false, error: `Exchange rate not available for ${cryptoCurrency}` };
  }

  // Calculate crypto amount
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
   * 3. Initiates the payout via NOWPayments API
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
      let nowPaymentsCurrency = networkConfig.nowPaymentsCurrency;
      let displayCurrency = networkConfig.symbol;

      if (preferStablecoin && networkConfig.stablecoin) {
        nowPaymentsCurrency = networkConfig.stablecoin;
        displayCurrency = networkConfig.stablecoinSymbol || networkConfig.symbol;
      }

      // Convert USD to crypto
      const conversionResult = await convertUsdToCrypto(usdAmount, nowPaymentsCurrency);
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

      // Process real payout via NOWPayments
      return await this.sendCryptoViaNOWPayments(
        walletAddress,
        network,
        usdAmount,
        conversionResult.cryptoAmount!,
        nowPaymentsCurrency,
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
    const mockPayoutId = `NP${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

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
        provider: 'nowpayments',
        payoutId: mockPayoutId,
        network: network,
        walletAddress: walletAddress,
        usdAmount: usdAmount,
        cryptoAmount: cryptoAmount,
        cryptoCurrency: cryptoCurrency,
        txHash: mockTxHash,
        timestamp: new Date().toISOString(),
        status: 'finished',
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
   * Send crypto via NOWPayments Payouts API
   */
  private async sendCryptoViaNOWPayments(
    walletAddress: string,
    network: SupportedNetwork,
    usdAmount: number,
    cryptoAmount: string,
    nowPaymentsCurrency: string,
    displayCurrency: string,
    paymentId: string,
    memo?: string
  ): Promise<CryptoPaymentResult> {
    try {
      console.log(`[Crypto Payout] Initiating NOWPayments payout...`);
      console.log(`[Crypto Payout] Currency: ${nowPaymentsCurrency}, Amount: ${cryptoAmount}`);

      // NOWPayments Payout API
      const payoutData = {
        address: walletAddress,
        currency: nowPaymentsCurrency,
        amount: parseFloat(cryptoAmount),
        ipn_callback_url: process.env.NOWPAYMENTS_IPN_URL || '',
        extraId: paymentId,
      };

      const response = await nowPaymentsRequest('/payout', 'POST', payoutData);

      console.log(`[Crypto Payout] NOWPayments payout created:`, response.id || response);

      const payoutId = response.id || `NP-${Date.now()}`;

      return {
        success: true,
        transactionId: payoutId,
        txHash: response.hash || payoutId,
        network: network,
        amount: usdAmount,
        cryptoAmount: cryptoAmount,
        cryptoCurrency: displayCurrency,
        walletAddress: walletAddress,
        providerResponse: {
          method: 'crypto',
          provider: 'nowpayments',
          payoutId: payoutId,
          status: response.status || 'pending',
          batch_withdrawal_id: response.batch_withdrawal_id,
          network: network,
          walletAddress: walletAddress,
          usdAmount: usdAmount,
          cryptoAmount: cryptoAmount,
          cryptoCurrency: displayCurrency,
          nowPaymentsCurrency: nowPaymentsCurrency,
          hash: response.hash,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      console.error('[Crypto Payout] NOWPayments API error:', error.message);

      // Provide helpful error messages
      let errorMessage = error.message;
      if (error.message.includes('API key') || error.message.includes('401') || error.message.includes('Unauthorized')) {
        errorMessage = 'NOWPayments API key not configured or invalid. Please check your NOWPAYMENTS_API_KEY.';
      } else if (error.message.includes('Insufficient') || error.message.includes('balance')) {
        errorMessage = 'Insufficient balance in NOWPayments account. Please add funds to process this payout.';
      } else if (error.message.includes('Invalid') && error.message.includes('address')) {
        errorMessage = 'Invalid wallet address for the selected cryptocurrency.';
      } else if (error.message.includes('currency')) {
        errorMessage = `Currency ${nowPaymentsCurrency} is not available. Please try a different cryptocurrency.`;
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
        status: 'finished',
        txHash: this.generateMockTxHash('ethereum'),
      };
    }

    try {
      const response = await nowPaymentsRequest(`/payout/${payoutId}`);

      return {
        success: true,
        status: response.status || 'unknown',
        txHash: response.hash,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get minimum payout amount for a currency
   */
  async getMinimumPayoutAmount(currency: string): Promise<{
    success: boolean;
    minAmount?: number;
    error?: string;
  }> {
    if (isSandboxMode()) {
      return { success: true, minAmount: 0.001 };
    }

    try {
      const response = await nowPaymentsRequest(`/min-amount?currency_from=usd&currency_to=${currency}`);
      return {
        success: true,
        minAmount: response.min_amount,
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
    // NOWPayments handles fees internally
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
   * Get NOWPayments account balance (for admin use)
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
          USDT: { balance: 10000, balanceUsd: 10000 },
        },
      };
    }

    try {
      const response = await nowPaymentsRequest('/balance');
      const rates = (await getExchangeRates()).rates || {};
      const balances: Record<string, { balance: number; balanceUsd: number }> = {};

      if (response && typeof response === 'object') {
        for (const [currency, balance] of Object.entries(response)) {
          if (typeof balance === 'number' && balance > 0) {
            const symbol = currency.toUpperCase();
            const rate = rates[symbol] || 1;
            balances[symbol] = {
              balance: balance,
              balanceUsd: balance * rate,
            };
          }
        }
      }

      return { success: true, balances };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get available currencies from NOWPayments
   */
  async getAvailableCurrencies(): Promise<{
    success: boolean;
    currencies?: string[];
    error?: string;
  }> {
    if (isSandboxMode()) {
      return {
        success: true,
        currencies: ['btc', 'eth', 'trx', 'bnbbsc', 'maticmainnet', 'usdterc20', 'usdtbsc', 'usdttrc20'],
      };
    }

    try {
      const response = await nowPaymentsRequest('/currencies');
      return {
        success: true,
        currencies: response.currencies || [],
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export const cryptoPaymentService = new CryptoPaymentService();
