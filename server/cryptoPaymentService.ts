/**
 * Crypto Payment Service
 * Integrates with CoinPayments API for processing cryptocurrency payouts
 * Supports multiple networks: Ethereum, Bitcoin, Polygon, BSC, Tron
 *
 * CoinPayments API Docs: https://www.coinpayments.net/apidoc
 */

import crypto from 'crypto';

// CoinPayments API response types
interface CoinPaymentsResponse {
  error: string;
  result: any;
}

interface CoinPaymentsWithdrawalResult {
  id: string;
  status: number;
  amount: string;
}

interface CoinPaymentsRatesResult {
  [currency: string]: {
    rate_btc: string;
    last_update: string;
    tx_fee: string;
    status: string;
    name: string;
    confirms: string;
    can_convert: number;
    capabilities: string[];
  };
}

// Exchange rate cache
interface ExchangeRateCache {
  rates: Record<string, number>;
  timestamp: number;
}

let exchangeRateCache: ExchangeRateCache | null = null;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Network configuration with CoinPayments currency codes
export const SUPPORTED_NETWORKS = {
  ethereum: {
    name: 'Ethereum',
    symbol: 'ETH',
    coinPaymentsCurrency: 'ETH',
    addressRegex: /^0x[a-fA-F0-9]{40}$/,
    stablecoin: 'USDC.ERC20',
    stablecoinSymbol: 'USDC',
  },
  bsc: {
    name: 'Binance Smart Chain',
    symbol: 'BNB',
    coinPaymentsCurrency: 'BNB.BSC',
    addressRegex: /^0x[a-fA-F0-9]{40}$/,
    stablecoin: 'BUSD.BEP20',
    stablecoinSymbol: 'BUSD',
  },
  polygon: {
    name: 'Polygon',
    symbol: 'MATIC',
    coinPaymentsCurrency: 'MATIC.POLY',
    addressRegex: /^0x[a-fA-F0-9]{40}$/,
    stablecoin: 'USDC.POLY',
    stablecoinSymbol: 'USDC',
  },
  bitcoin: {
    name: 'Bitcoin',
    symbol: 'BTC',
    coinPaymentsCurrency: 'BTC',
    // Legacy, SegWit, and Native SegWit address formats
    addressRegex: /^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{39,59})$/,
    stablecoin: null,
    stablecoinSymbol: null,
  },
  tron: {
    name: 'Tron',
    symbol: 'TRX',
    coinPaymentsCurrency: 'TRX',
    addressRegex: /^T[a-zA-HJ-NP-Z0-9]{33}$/,
    stablecoin: 'USDT.TRC20',
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
 * Get CoinPayments API configuration
 */
function getCoinPaymentsConfig() {
  const publicKey = process.env.COINPAYMENTS_PUBLIC_KEY;
  const privateKey = process.env.COINPAYMENTS_PRIVATE_KEY;
  const merchantId = process.env.COINPAYMENTS_MERCHANT_ID;

  if ((!publicKey || !privateKey) && !isSandboxMode()) {
    throw new Error('CoinPayments API keys not configured. Set COINPAYMENTS_PUBLIC_KEY and COINPAYMENTS_PRIVATE_KEY in your .env file or enable CRYPTO_SANDBOX_MODE=true');
  }

  return {
    publicKey: publicKey || 'sandbox-public-key',
    privateKey: privateKey || 'sandbox-private-key',
    merchantId: merchantId || '',
    apiUrl: 'https://www.coinpayments.net/api.php',
  };
}

/**
 * Make an authenticated request to CoinPayments API
 */
async function coinPaymentsRequest(command: string, params: Record<string, string> = {}): Promise<CoinPaymentsResponse> {
  const config = getCoinPaymentsConfig();

  // Build the request body
  const body: Record<string, string> = {
    version: '1',
    key: config.publicKey,
    cmd: command,
    format: 'json',
    ...params,
  };

  // Create URL-encoded body
  const encodedBody = new URLSearchParams(body).toString();

  // Create HMAC signature
  const hmac = crypto.createHmac('sha512', config.privateKey);
  hmac.update(encodedBody);
  const signature = hmac.digest('hex');

  // Make the request
  const response = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'HMAC': signature,
    },
    body: encodedBody,
  });

  if (!response.ok) {
    throw new Error(`CoinPayments API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  if (result.error !== 'ok') {
    throw new Error(result.error || 'Unknown CoinPayments API error');
  }

  return result;
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
 * Fetch current exchange rates from CoinPayments
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
      LTCT: 0.01, // Test currency
    };
    exchangeRateCache = { rates: mockRates, timestamp: Date.now() };
    return { success: true, rates: mockRates };
  }

  try {
    // Use CoinPayments rates API
    const response = await coinPaymentsRequest('rates', { short: '1', accepted: '1' });
    const ratesData = response.result as CoinPaymentsRatesResult;

    const rates: Record<string, number> = {};

    // CoinPayments returns rates in BTC, we need to convert to USD
    // First get BTC/USD rate
    const btcData = ratesData['BTC'];
    const btcUsdRate = btcData ? 1 / parseFloat(btcData.rate_btc) : 43500; // Fallback

    for (const [currency, data] of Object.entries(ratesData)) {
      if (data.rate_btc && data.status === 'online') {
        const btcRate = parseFloat(data.rate_btc);
        if (btcRate > 0) {
          // Convert BTC rate to USD rate
          rates[currency] = btcUsdRate * btcRate;
        }
      }
    }

    // Ensure stablecoins are ~$1
    rates['USDC'] = 1.00;
    rates['USDT'] = 1.00;
    rates['BUSD'] = 1.00;

    exchangeRateCache = { rates, timestamp: Date.now() };
    return { success: true, rates };
  } catch (error: any) {
    console.error('[Crypto] Failed to fetch exchange rates:', error.message);

    // Fallback to public API if CoinPayments fails
    try {
      const fallbackResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,matic-network,binancecoin,tron&vs_currencies=usd');
      if (fallbackResponse.ok) {
        const data = await fallbackResponse.json();
        const rates: Record<string, number> = {
          BTC: data.bitcoin?.usd || 43500,
          ETH: data.ethereum?.usd || 2350,
          MATIC: data['matic-network']?.usd || 0.85,
          BNB: data.binancecoin?.usd || 310,
          TRX: data.tron?.usd || 0.11,
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

  // Handle CoinPayments currency codes (e.g., USDC.ERC20 -> USDC)
  const baseCurrency = cryptoCurrency.split('.')[0].toUpperCase();
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
   * 3. Initiates the withdrawal via CoinPayments API
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
      let coinPaymentsCurrency = networkConfig.coinPaymentsCurrency;
      let displayCurrency = networkConfig.symbol;

      if (preferStablecoin && networkConfig.stablecoin) {
        coinPaymentsCurrency = networkConfig.stablecoin;
        displayCurrency = networkConfig.stablecoinSymbol || networkConfig.symbol;
      }

      // Convert USD to crypto
      const conversionResult = await convertUsdToCrypto(usdAmount, coinPaymentsCurrency);
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

      // Process real withdrawal via CoinPayments
      return await this.sendCryptoViaCoinPayments(
        walletAddress,
        network,
        usdAmount,
        conversionResult.cryptoAmount!,
        coinPaymentsCurrency,
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
    const mockWithdrawalId = `CPWI${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    console.log(`[Crypto Payout] SANDBOX MODE - Simulated transaction`);
    console.log(`[Crypto Payout] Withdrawal ID: ${mockWithdrawalId}`);
    console.log(`[Crypto Payout] TX Hash: ${mockTxHash}`);

    return {
      success: true,
      transactionId: mockWithdrawalId,
      txHash: mockTxHash,
      network: network,
      amount: usdAmount,
      cryptoAmount: cryptoAmount,
      cryptoCurrency: cryptoCurrency,
      walletAddress: walletAddress,
      providerResponse: {
        method: 'crypto',
        provider: 'coinpayments',
        withdrawalId: mockWithdrawalId,
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
      return Array.from({ length: 64 }, randomHex).join('');
    }

    if (network === 'tron') {
      // Tron tx hashes are 64 hex characters without 0x prefix
      return Array.from({ length: 64 }, randomHex).join('');
    }

    // EVM-compatible chains use 0x prefix
    return '0x' + Array.from({ length: 64 }, randomHex).join('');
  }

  /**
   * Send crypto via CoinPayments API
   */
  private async sendCryptoViaCoinPayments(
    walletAddress: string,
    network: SupportedNetwork,
    usdAmount: number,
    cryptoAmount: string,
    coinPaymentsCurrency: string,
    displayCurrency: string,
    paymentId: string,
    memo?: string
  ): Promise<CryptoPaymentResult> {
    try {
      console.log(`[Crypto Payout] Initiating CoinPayments withdrawal...`);
      console.log(`[Crypto Payout] Currency: ${coinPaymentsCurrency}, Amount: ${cryptoAmount}`);

      // Use CoinPayments create_withdrawal API
      const withdrawalParams: Record<string, string> = {
        amount: cryptoAmount,
        currency: coinPaymentsCurrency,
        address: walletAddress,
        auto_confirm: '1', // Auto-confirm the withdrawal
        note: memo || `AffiliateXchange payout - ${paymentId}`,
      };

      const response = await coinPaymentsRequest('create_withdrawal', withdrawalParams);
      const result = response.result as CoinPaymentsWithdrawalResult;

      console.log(`[Crypto Payout] CoinPayments withdrawal created: ${result.id}`);
      console.log(`[Crypto Payout] Status: ${result.status}`);

      return {
        success: true,
        transactionId: result.id,
        txHash: result.id, // TX hash will be available after confirmation
        network: network,
        amount: usdAmount,
        cryptoAmount: cryptoAmount,
        cryptoCurrency: displayCurrency,
        walletAddress: walletAddress,
        providerResponse: {
          method: 'crypto',
          provider: 'coinpayments',
          withdrawalId: result.id,
          status: result.status,
          statusText: this.getWithdrawalStatusText(result.status),
          network: network,
          walletAddress: walletAddress,
          usdAmount: usdAmount,
          cryptoAmount: cryptoAmount,
          cryptoCurrency: displayCurrency,
          coinPaymentsCurrency: coinPaymentsCurrency,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      console.error('[Crypto Payout] CoinPayments API error:', error.message);

      // Provide helpful error messages
      let errorMessage = error.message;
      if (error.message.includes('API keys')) {
        errorMessage = 'CoinPayments API keys not configured. Please check your COINPAYMENTS_PUBLIC_KEY and COINPAYMENTS_PRIVATE_KEY.';
      } else if (error.message.includes('Insufficient') || error.message.includes('balance')) {
        errorMessage = 'Insufficient balance in CoinPayments wallet. Please add funds to process this withdrawal.';
      } else if (error.message.includes('Invalid currency')) {
        errorMessage = `Currency ${error.message} is not supported or not enabled in your CoinPayments account.`;
      } else if (error.message.includes('Invalid address')) {
        errorMessage = 'Invalid wallet address for the selected cryptocurrency.';
      }

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get human-readable status text for CoinPayments withdrawal status codes
   */
  private getWithdrawalStatusText(status: number): string {
    const statusMap: Record<number, string> = {
      0: 'Waiting for email confirmation',
      1: 'Pending',
      2: 'Complete',
      [-1]: 'Cancelled/Timed out',
    };
    return statusMap[status] || `Unknown (${status})`;
  }

  /**
   * Check the status of a crypto withdrawal
   */
  async checkTransactionStatus(withdrawalId: string): Promise<{
    success: boolean;
    status?: string;
    statusCode?: number;
    txHash?: string;
    error?: string;
  }> {
    if (isSandboxMode()) {
      return {
        success: true,
        status: 'complete',
        statusCode: 2,
        txHash: this.generateMockTxHash('ethereum'),
      };
    }

    try {
      const response = await coinPaymentsRequest('get_withdrawal_info', { id: withdrawalId });
      const result = response.result;

      return {
        success: true,
        status: this.getWithdrawalStatusText(result.status),
        statusCode: result.status,
        txHash: result.send_txid || undefined,
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
    // CoinPayments handles fees internally, but we can provide estimates
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
   * Get CoinPayments wallet balances (for admin use)
   */
  async getWalletBalances(): Promise<{
    success: boolean;
    balances?: Record<string, { balance: string; balanceUsd: number }>;
    error?: string;
  }> {
    if (isSandboxMode()) {
      return {
        success: true,
        balances: {
          BTC: { balance: '0.5', balanceUsd: 21750 },
          ETH: { balance: '5.0', balanceUsd: 11750 },
          USDC: { balance: '10000', balanceUsd: 10000 },
        },
      };
    }

    try {
      const response = await coinPaymentsRequest('balances', { all: '1' });
      const balancesData = response.result;

      const rates = (await getExchangeRates()).rates || {};
      const balances: Record<string, { balance: string; balanceUsd: number }> = {};

      for (const [currency, data] of Object.entries(balancesData)) {
        const balanceData = data as { balance: string; balancef: string };
        const balance = parseFloat(balanceData.balancef || balanceData.balance || '0');
        if (balance > 0) {
          const rate = rates[currency] || 0;
          balances[currency] = {
            balance: balance.toString(),
            balanceUsd: balance * rate,
          };
        }
      }

      return { success: true, balances };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export const cryptoPaymentService = new CryptoPaymentService();
