import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";
import { isUnauthorizedError } from "../lib/authUtils";
import { Link } from "wouter";
import { useCreatorPageTour } from "../components/CreatorTour";
import { CREATOR_TOUR_IDS, paymentSettingsTourSteps as creatorPaymentTourSteps } from "../lib/creatorTourConfig";
import { useCompanyPageTour } from "../components/CompanyTour";
import { COMPANY_TOUR_IDS, paymentSettingsTourSteps as companyPaymentTourSteps } from "../lib/companyTourConfig";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  Edit3,
  Eye,
  Filter,
  Info,
  Landmark,
  Search,
  Send,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
  Users,
  X,
  XCircle,
} from "lucide-react";

import type { User } from "../../../shared/schema";
import { TopNavBar } from "../components/TopNavBar";
import { GenericErrorDialog } from "../components/GenericErrorDialog";

type PaymentStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "refunded";

type CreatorPayment = {
  id: string;
  offerId: string;
  companyId: string;
  grossAmount: string;
  platformFeeAmount: string;
  stripeFeeAmount: string;
  netAmount: string;
  status: PaymentStatus;
  paymentMethod?: string;
  description?: string;
  completedAt?: string;
  createdAt: string;
};

type PaymentMethod = {
  id: number;
  payoutMethod: string;
  payoutEmail?: string;
  bankRoutingNumber?: string;
  bankAccountNumber?: string;
  paypalEmail?: string;
  cryptoWalletAddress?: string;
  cryptoNetwork?: string;
  stripeAccountId?: string;
  isDefault?: boolean;
  // Wire/ACH bank verification fields
  bankAccountHolderName?: string;
  bankAccountType?: string;
  bankAccountHolderType?: string;
  bankName?: string;
  bankCountry?: string;
  bankCurrency?: string;
  stripeBankAccountId?: string;
  bankVerificationStatus?: string;
  bankVerificationMethod?: string;
  bankMicroDepositsStatus?: string;
};

type AdminFundingMethod = {
  id: number;
  name: string;
  type: "bank" | "wallet" | "card";
  last4: string;
  status: "active" | "pending" | "disabled";
  isPrimary?: boolean;
};

const statusConfig: Record<PaymentStatus, { bg: string; text: string; icon: typeof Clock; label: string }> = {
  pending: { bg: "bg-yellow-100", text: "text-yellow-800", icon: Clock, label: "Pending" },
  processing: { bg: "bg-blue-100", text: "text-blue-800", icon: Clock, label: "Processing" },
  completed: { bg: "bg-green-100", text: "text-green-800", icon: CheckCircle, label: "Completed" },
  failed: { bg: "bg-red-100", text: "text-red-800", icon: XCircle, label: "Failed" },
  refunded: { bg: "bg-gray-100", text: "text-gray-800", icon: AlertTriangle, label: "Refunded" },
};

// Helper to check if a payment is disputed (failed with "Disputed:" in description)
function isDisputedPayment(payment: CreatorPayment): boolean {
  return payment.status === "failed" &&
    (payment.description?.toLowerCase().includes("disputed:") ?? false);
}

function StatusBadge({ status, isDisputed = false }: { status: PaymentStatus; isDisputed?: boolean }) {
  // Show disputed badge if payment is disputed
  if (isDisputed) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800"
      >
        <AlertTriangle className="w-3 h-3" />
        Disputed
      </span>
    );
  }

  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

function CreatorOverview({ payments }: { payments: CreatorPayment[] }) {
  const { toast } = useToast();

  // Fetch platform fee settings for display
  const { data: feeSettings } = useQuery<{
    stripeFeeDisplay: string;
  }>({
    queryKey: ["/api/platform/fees"],
  });

  const stripeFeeDisplay = feeSettings?.stripeFeeDisplay ?? "3%";

  const { totalEarnings, pendingEarnings, completedEarnings, processingEarnings, disputedEarnings } = useMemo(() => {
    const totals = payments.reduce(
      (acc, payment) => {
        const amount = parseFloat(payment.netAmount);
        const disputed = isDisputedPayment(payment);

        // Track disputed payments separately - do NOT include in total earnings
        if (disputed) {
          acc.disputedEarnings += amount;
          return acc; // Skip adding to totalEarnings
        }

        // Only add non-disputed payments to total earnings
        acc.totalEarnings += amount;

        if (payment.status === "completed") {
          acc.completedEarnings += amount;
        }
        if (payment.status === "pending") {
          acc.pendingEarnings += amount;
        }
        if (payment.status === "processing") {
          acc.processingEarnings += amount;
        }
        return acc;
      },
      { totalEarnings: 0, pendingEarnings: 0, completedEarnings: 0, processingEarnings: 0, disputedEarnings: 0 }
    );

    return totals;
  }, [payments]);

  const exportPayments = () => {
    const csv = [
      ['ID', 'Description', 'Gross', 'Platform Fee', 'Processing Fee', 'Net Amount', 'Status', 'Date'],
      ...payments.map(p => [
        p.id.slice(0, 8),
        p.description || 'Payment',
        p.grossAmount,
        p.platformFeeAmount,
        p.stripeFeeAmount,
        p.netAmount,
        p.status,
        p.completedAt || p.createdAt
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Payment history exported successfully",
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border-2 border-gray-200 bg-white p-6 space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Payout Status Breakdown</h3>
            <p className="text-sm text-gray-600">
              See where every creator payout sits: awaiting admin approval, processing, or fully paid.
            </p>
          </div>
          <Badge variant="outline" className="self-start border-green-200 bg-green-50 text-green-700">
            Total earnings CA${totalEarnings.toFixed(2)}
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl border-2 border-yellow-200 bg-yellow-50 p-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-yellow-700">Pending Admin Approval</span>
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div className="text-3xl font-bold text-yellow-900">CA${pendingEarnings.toFixed(2)}</div>
            <div className="mt-1 text-xs text-yellow-700">Company approved, awaiting admin</div>
          </div>

          <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-blue-700">Processing Payment</span>
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div className="text-3xl font-bold text-blue-900">CA${processingEarnings.toFixed(2)}</div>
            <div className="mt-1 text-xs text-blue-700">Payment in progress</div>
          </div>

          <div className="rounded-xl border-2 border-gray-200 bg-white p-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Paid Out</span>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900">CA${completedEarnings.toFixed(2)}</div>
            <div className="mt-1 text-xs text-gray-500">Lifetime completed payouts</div>
          </div>

          <div className="rounded-xl bg-gradient-to-br from-green-500 to-green-600 p-6 text-white">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-green-100">All Earnings</span>
              <DollarSign className="h-5 w-5 text-green-100" />
            </div>
            <div className="text-3xl font-bold">CA${totalEarnings.toFixed(2)}</div>
            <div className="mt-1 text-xs text-green-100">Including pending & processing</div>
          </div>

          {disputedEarnings > 0 && (
            <div className="rounded-xl border-2 border-orange-300 bg-orange-50 p-6 md:col-span-2">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-orange-700">Disputed</span>
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <div className="text-3xl font-bold text-orange-900">CA${disputedEarnings.toFixed(2)}</div>
              <div className="mt-1 text-xs text-orange-700">Awaiting admin resolution</div>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border-2 border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">Payment History</h3>
            <Button variant="outline" size="sm" onClick={exportPayments}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {payments.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-500">No payment history yet</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Gross
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Platform Fee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Processing ({stripeFeeDisplay})
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Net Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sticky right-0 bg-gray-50 shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.1)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {payments.map((payment) => (
                  <tr key={payment.id} className="transition hover:bg-gray-50 group">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {payment.id.slice(0, 8)}...
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {payment.description || "Payment"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      CA${parseFloat(payment.grossAmount).toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-red-600">
                      -CA${parseFloat(payment.platformFeeAmount).toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-red-600">
                      -CA${parseFloat(payment.stripeFeeAmount).toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-bold text-green-600">
                      CA${parseFloat(payment.netAmount).toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <StatusBadge status={payment.status} isDisputed={isDisputedPayment(payment)} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      {payment.completedAt
                        ? new Date(payment.completedAt).toLocaleDateString()
                        : new Date(payment.createdAt).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 sticky right-0 bg-white group-hover:bg-gray-50 shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.1)]">
                      <Link href={`/payments/${payment.id}`}>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Eye className="h-4 w-4" />
                          View Details
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// Crypto payment fields with wallet validation and exchange rate display
function CryptoPaymentFields({
  cryptoWalletAddress,
  setCryptoWalletAddress,
  cryptoNetwork,
  setCryptoNetwork,
}: {
  cryptoWalletAddress: string;
  setCryptoWalletAddress: (value: string) => void;
  cryptoNetwork: string;
  setCryptoNetwork: (value: string) => void;
}) {
  const [walletValidation, setWalletValidation] = useState<{
    valid: boolean;
    error?: string;
    checking: boolean;
  }>({ valid: false, checking: false });

  const [networkFee, setNetworkFee] = useState<{
    estimatedFeeUsd?: number;
    loading: boolean;
  }>({ loading: false });

  // Fetch exchange rates
  const { data: exchangeRates } = useQuery<{
    success: boolean;
    rates: Record<string, number>;
    timestamp: string;
  }>({
    queryKey: ["/api/crypto/exchange-rates"],
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    staleTime: 60 * 1000, // Consider stale after 1 minute
  });

  // Validate wallet address when it changes
  useEffect(() => {
    if (!cryptoWalletAddress || !cryptoNetwork) {
      setWalletValidation({ valid: false, checking: false });
      return;
    }

    const validateAddress = async () => {
      setWalletValidation({ valid: false, checking: true });
      try {
        const response = await fetch("/api/crypto/validate-address", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: cryptoWalletAddress,
            network: cryptoNetwork,
          }),
        });
        const result = await response.json();
        setWalletValidation({
          valid: result.valid,
          error: result.error,
          checking: false,
        });
      } catch {
        setWalletValidation({
          valid: false,
          error: "Failed to validate address",
          checking: false,
        });
      }
    };

    // Debounce validation
    const timer = setTimeout(validateAddress, 500);
    return () => clearTimeout(timer);
  }, [cryptoWalletAddress, cryptoNetwork]);

  // Fetch network fee when network changes
  useEffect(() => {
    if (!cryptoNetwork) {
      setNetworkFee({ loading: false });
      return;
    }

    const fetchFee = async () => {
      setNetworkFee({ loading: true });
      try {
        const response = await fetch(`/api/crypto/estimate-fee/${cryptoNetwork}`);
        const result = await response.json();
        if (result.success) {
          setNetworkFee({
            estimatedFeeUsd: result.estimatedFeeUsd,
            loading: false,
          });
        } else {
          setNetworkFee({ loading: false });
        }
      } catch {
        setNetworkFee({ loading: false });
      }
    };

    fetchFee();
  }, [cryptoNetwork]);

  const networkInfo: Record<string, { name: string; symbol: string; stablecoin: string | null }> = {
    ethereum: { name: "Ethereum", symbol: "ETH", stablecoin: "USDC" },
    bsc: { name: "Binance Smart Chain", symbol: "BNB", stablecoin: "BUSD" },
    polygon: { name: "Polygon", symbol: "MATIC", stablecoin: "USDC" },
    bitcoin: { name: "Bitcoin", symbol: "BTC", stablecoin: null },
    tron: { name: "Tron", symbol: "TRX", stablecoin: "USDT" },
  };

  const selectedNetwork = cryptoNetwork ? networkInfo[cryptoNetwork] : null;
  const currentRate = selectedNetwork && exchangeRates?.rates
    ? exchangeRates.rates[selectedNetwork.symbol]
    : null;

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="network">Network</Label>
        <Select value={cryptoNetwork} onValueChange={setCryptoNetwork}>
          <SelectTrigger id="network">
            <SelectValue placeholder="Select network" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ethereum">Ethereum (ERC-20) - USDC</SelectItem>
            <SelectItem value="bsc">Binance Smart Chain (BEP-20) - BUSD</SelectItem>
            <SelectItem value="polygon">Polygon (MATIC) - USDC</SelectItem>
            <SelectItem value="bitcoin">Bitcoin (BTC)</SelectItem>
            <SelectItem value="tron">Tron (TRC-20) - USDT</SelectItem>
          </SelectContent>
        </Select>
        {selectedNetwork && (
          <div className="text-xs text-gray-500">
            Payouts sent as {selectedNetwork.stablecoin || selectedNetwork.symbol}
            {selectedNetwork.stablecoin && " (stablecoin) to reduce volatility"}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="wallet">Wallet Address</Label>
        <div className="relative">
          <Input
            id="wallet"
            placeholder={cryptoNetwork === "bitcoin" ? "bc1... or 1... or 3..." : "0x..."}
            value={cryptoWalletAddress}
            onChange={(e) => setCryptoWalletAddress(e.target.value)}
            className={
              cryptoWalletAddress && !walletValidation.checking
                ? walletValidation.valid
                  ? "border-green-500 pr-10"
                  : "border-red-500 pr-10"
                : ""
            }
          />
          {cryptoWalletAddress && !walletValidation.checking && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {walletValidation.valid ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
            </div>
          )}
          {walletValidation.checking && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Clock className="h-4 w-4 text-gray-400 animate-pulse" />
            </div>
          )}
        </div>
        {walletValidation.error && cryptoWalletAddress && (
          <p className="text-xs text-red-500">{walletValidation.error}</p>
        )}
      </div>

      {cryptoNetwork && (
        <div className="rounded-lg bg-purple-50 border border-purple-200 p-3">
          <div className="flex gap-2">
            <Info className="h-4 w-4 text-purple-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-purple-900 space-y-2">
              <p className="font-semibold">Cryptocurrency Payout Info:</p>
              <ul className="text-xs space-y-1">
                {currentRate && (
                  <li>
                    Current rate: 1 {selectedNetwork?.symbol} = CA${currentRate.toFixed(2)} CAD
                  </li>
                )}
                {networkFee.estimatedFeeUsd && (
                  <li>
                    Estimated network fee: ~CA${networkFee.estimatedFeeUsd.toFixed(2)} CAD
                  </li>
                )}
                {selectedNetwork?.stablecoin && (
                  <li>
                    Payouts are sent as <strong>{selectedNetwork.stablecoin}</strong> to minimize price volatility
                  </li>
                )}
                <li>
                  Ensure your wallet supports {selectedNetwork?.stablecoin || selectedNetwork?.symbol} on {selectedNetwork?.name}
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Wire/ACH payment fields with bank account validation
function WireAchPaymentFields({
  bankRoutingNumber,
  setBankRoutingNumber,
  bankAccountNumber,
  setBankAccountNumber,
}: {
  bankRoutingNumber: string;
  setBankRoutingNumber: (value: string) => void;
  bankAccountNumber: string;
  setBankAccountNumber: (value: string) => void;
}) {
  const [bankCountry, setBankCountry] = useState("US");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [accountHolderType, setAccountHolderType] = useState("individual");
  const [accountType, setAccountType] = useState("checking");
  const [validation, setValidation] = useState<{
    valid: boolean;
    errors: string[];
    checking: boolean;
  }>({ valid: false, errors: [], checking: false });

  // Fetch transfer info
  const { data: transferInfo } = useQuery<{
    success: boolean;
    info: {
      processingTime: string;
      fees: { ach: string; wire: string };
      minimumAmount: number;
      maximumAmount: number;
      supportedCurrencies: string[];
      notes: string[];
    };
  }>({
    queryKey: ["/api/wire-ach/transfer-info"],
    staleTime: 5 * 60 * 1000,
  });

  // Validate bank account when details change
  useEffect(() => {
    if (!bankRoutingNumber || !bankAccountNumber || !accountHolderName) {
      setValidation({ valid: false, errors: [], checking: false });
      return;
    }

    const validateAccount = async () => {
      setValidation({ valid: false, errors: [], checking: true });
      try {
        const response = await fetch("/api/wire-ach/validate-bank-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            routingNumber: bankRoutingNumber,
            accountNumber: bankAccountNumber,
            accountHolderName,
            accountHolderType,
            country: bankCountry,
          }),
        });
        const result = await response.json();
        setValidation({
          valid: result.valid,
          errors: result.errors || [],
          checking: false,
        });
      } catch {
        setValidation({
          valid: false,
          errors: ["Failed to validate bank account"],
          checking: false,
        });
      }
    };

    // Debounce validation
    const timer = setTimeout(validateAccount, 500);
    return () => clearTimeout(timer);
  }, [bankRoutingNumber, bankAccountNumber, accountHolderName, accountHolderType, bankCountry]);

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="bank-country">Country</Label>
        <Select value={bankCountry} onValueChange={setBankCountry}>
          <SelectTrigger id="bank-country">
            <SelectValue placeholder="Select country" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="US">United States (USD)</SelectItem>
            <SelectItem value="CA">Canada (CAD)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="account-holder-name">Account Holder Name</Label>
        <Input
          id="account-holder-name"
          placeholder="John Doe"
          value={accountHolderName}
          onChange={(e) => setAccountHolderName(e.target.value)}
        />
        <p className="text-xs text-gray-500">Enter the name exactly as it appears on your bank account</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="account-holder-type">Account Holder Type</Label>
          <Select value={accountHolderType} onValueChange={setAccountHolderType}>
            <SelectTrigger id="account-holder-type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="individual">Individual</SelectItem>
              <SelectItem value="company">Company</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-type">Account Type</Label>
          <Select value={accountType} onValueChange={setAccountType}>
            <SelectTrigger id="account-type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="checking">Checking</SelectItem>
              <SelectItem value="savings">Savings</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="routing">
          {bankCountry === "CA" ? "Transit & Institution Number" : "Routing Number (ABA)"}
        </Label>
        <div className="relative">
          <Input
            id="routing"
            placeholder={bankCountry === "CA" ? "12345-678" : "123456789"}
            value={bankRoutingNumber}
            onChange={(e) => setBankRoutingNumber(e.target.value)}
            className={
              bankRoutingNumber && !validation.checking
                ? validation.valid || validation.errors.length === 0
                  ? ""
                  : "border-red-500"
                : ""
            }
          />
        </div>
        <p className="text-xs text-gray-500">
          {bankCountry === "CA"
            ? "5-digit transit number + 3-digit institution number"
            : "9-digit ABA routing number from your check or bank statement"}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="account">Account Number</Label>
        <div className="relative">
          <Input
            id="account"
            placeholder="123456789012"
            value={bankAccountNumber}
            onChange={(e) => setBankAccountNumber(e.target.value)}
            className={
              bankAccountNumber && !validation.checking
                ? validation.valid || validation.errors.length === 0
                  ? ""
                  : "border-red-500"
                : ""
            }
          />
          {bankAccountNumber && accountHolderName && bankRoutingNumber && !validation.checking && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {validation.valid ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : validation.errors.length > 0 ? (
                <XCircle className="h-4 w-4 text-red-500" />
              ) : null}
            </div>
          )}
          {validation.checking && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Clock className="h-4 w-4 text-gray-400 animate-pulse" />
            </div>
          )}
        </div>
        {validation.errors.length > 0 && (
          <div className="text-xs text-red-500 space-y-1">
            {validation.errors.map((error, index) => (
              <p key={index}>{error}</p>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
        <div className="flex gap-2">
          <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 space-y-2">
            <p className="font-semibold">Wire/ACH Transfer Info:</p>
            <ul className="text-xs space-y-1">
              <li>
                <strong>Processing time:</strong> {transferInfo?.info?.processingTime || "1-2 business days (ACH) / 3-5 business days (Wire)"}
              </li>
              <li>
                <strong>Minimum amount:</strong> CA${transferInfo?.info?.minimumAmount?.toFixed(2) || "1.00"}
              </li>
              <li>
                <strong>ACH transfers:</strong> No additional fees
              </li>
              <li>
                Ensure your bank account details are accurate to avoid payment delays
              </li>
              <li>
                First-time payouts may take longer for verification
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

function PaymentMethodSettings({
  paymentMethods,
  payoutMethod,
  setPayoutMethod,
  payoutEmail,
  setPayoutEmail,
  bankRoutingNumber,
  setBankRoutingNumber,
  bankAccountNumber,
  setBankAccountNumber,
  paypalEmail,
  setPaypalEmail,
  cryptoWalletAddress,
  setCryptoWalletAddress,
  cryptoNetwork,
  setCryptoNetwork,
  onAddPaymentMethod,
  onDeletePaymentMethod,
  onSetPrimary,
  onUpgradeETransfer,
  onVerifyWireAccount,
  onVerifyMicroDeposits,
  isSubmitting,
  formResetKey = 0,
  title = "Payment Methods",
  emptyDescription = "Add a payment method to receive payouts",
  showFeeBreakdown = true,
}: {
  paymentMethods?: PaymentMethod[];
  payoutMethod: string;
  setPayoutMethod: (method: string) => void;
  payoutEmail: string;
  setPayoutEmail: (value: string) => void;
  bankRoutingNumber: string;
  setBankRoutingNumber: (value: string) => void;
  bankAccountNumber: string;
  setBankAccountNumber: (value: string) => void;
  paypalEmail: string;
  setPaypalEmail: (value: string) => void;
  cryptoWalletAddress: string;
  setCryptoWalletAddress: (value: string) => void;
  cryptoNetwork: string;
  setCryptoNetwork: (value: string) => void;
  onAddPaymentMethod: () => void;
  onDeletePaymentMethod?: (method: PaymentMethod) => void;
  onSetPrimary?: (method: PaymentMethod) => void;
  onUpgradeETransfer?: (method: PaymentMethod) => void;
  onVerifyWireAccount?: (method: PaymentMethod) => void;
  onVerifyMicroDeposits?: (method: PaymentMethod) => void;
  isSubmitting: boolean;
  formResetKey?: number;
  title?: string;
  emptyDescription?: string;
  showFeeBreakdown?: boolean;
}) {
  // Fetch platform fee settings for display
  const { data: feeSettings } = useQuery<{
    platformFeeDisplay: string;
    stripeFeeDisplay: string;
    totalFeeDisplay: string;
  }>({
    queryKey: ["/api/platform/fees"],
  });

  const platformFeeDisplay = feeSettings?.platformFeeDisplay ?? "4%";
  const stripeFeeDisplay = feeSettings?.stripeFeeDisplay ?? "3%";
  const totalFeeDisplay = feeSettings?.totalFeeDisplay ?? "7%";

  const isAddDisabled =
    isSubmitting ||
    (payoutMethod === "etransfer" && !payoutEmail) ||
    (payoutMethod === "wire" && (!bankRoutingNumber || !bankAccountNumber)) ||
    (payoutMethod === "paypal" && !paypalEmail) ||
    (payoutMethod === "crypto" && (!cryptoWalletAddress || !cryptoNetwork));

  const getDisplayValue = (method: PaymentMethod) => {
    if (method.payoutMethod === "etransfer") return method.payoutEmail;
    if (method.payoutMethod === "wire") return `****${method.bankAccountNumber?.slice(-4)}`;
    if (method.payoutMethod === "paypal") return method.paypalEmail;
    if (method.payoutMethod === "crypto") return `${method.cryptoWalletAddress?.slice(0, 6)}...`;
    return undefined;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border-2 border-gray-200 bg-white p-6">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        {!paymentMethods || paymentMethods.length === 0 ? (
          <div className="mt-6 text-center">
            <DollarSign className="mx-auto mb-4 h-12 w-12 text-gray-400" />
            <p className="text-gray-600">No payment methods yet</p>
            <p className="mt-1 text-sm text-gray-500">{emptyDescription}</p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {paymentMethods.map((method) => {
              const needsStripeSetup = method.payoutMethod === 'etransfer' && !method.stripeAccountId;
              const needsWireVerification = method.payoutMethod === 'wire' && method.bankVerificationStatus !== 'verified';
              // Only show "Verify Amounts" if stripeBankAccountId exists and status is pending
              const isWirePending = method.payoutMethod === 'wire' &&
                method.bankVerificationStatus === 'pending' &&
                !!method.stripeBankAccountId;
              const needsSetup = needsStripeSetup || needsWireVerification;

              return (
                <div
                  key={method.id}
                  className={`flex flex-col rounded-lg border-2 p-4 ${
                    needsSetup ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                      <CreditCard className={`h-5 w-5 flex-shrink-0 ${needsSetup ? 'text-yellow-600' : 'text-gray-400'}`} />
                      <div className="min-w-0">
                        <div className="font-medium capitalize text-gray-900 flex flex-wrap items-center gap-2">
                          {method.payoutMethod.replace("_", " ")}
                          {needsStripeSetup && (
                            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                              Setup Required
                            </Badge>
                          )}
                          {needsWireVerification && !isWirePending && (
                            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                              Verification Required
                            </Badge>
                          )}
                          {isWirePending && (
                            <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                              Pending Verification
                            </Badge>
                          )}
                          {method.payoutMethod === 'wire' && method.bankVerificationStatus === 'verified' && (
                            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                              Verified
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 truncate">{getDisplayValue(method)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
                      {method.isDefault ? (
                        <Badge>Default</Badge>
                      ) : (
                        onSetPrimary && !needsSetup && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onSetPrimary(method)}
                            className="text-sm whitespace-nowrap"
                          >
                            Set as Primary
                          </Button>
                        )
                      )}
                      {onDeletePaymentMethod && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeletePaymentMethod(method)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {needsStripeSetup && (
                    <div className="mt-3 pt-3 border-t border-yellow-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 text-sm text-yellow-800">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        <span>Stripe Connect setup required to process payments</span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => onUpgradeETransfer && onUpgradeETransfer(method)}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white w-full sm:w-auto"
                      >
                        Complete Setup
                      </Button>
                    </div>
                  )}
                  {needsWireVerification && !isWirePending && (
                    <div className="mt-3 pt-3 border-t border-yellow-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 text-sm text-yellow-800">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        <span>Bank account verification required to receive payments</span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => onVerifyWireAccount && onVerifyWireAccount(method)}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white w-full sm:w-auto"
                      >
                        Start Verification
                      </Button>
                    </div>
                  )}
                  {isWirePending && (
                    <div className="mt-3 pt-3 border-t border-blue-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 text-sm text-blue-800">
                        <Clock className="h-4 w-4 flex-shrink-0" />
                        <span>Two small deposits have been sent to your account. Enter the amounts to verify.</span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => onVerifyMicroDeposits && onVerifyMicroDeposits(method)}
                        className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
                      >
                        Verify Amounts
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border-2 border-gray-200 bg-white p-6">
        <h3 className="text-lg font-bold text-gray-900">Add Payment Method</h3>
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="method">Payout Method</Label>
            <Select value={payoutMethod} onValueChange={setPayoutMethod}>
              <SelectTrigger id="method">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="etransfer">E-Transfer</SelectItem>
                <SelectItem value="wire">Wire/ACH</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
                <SelectItem value="crypto">Cryptocurrency</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {payoutMethod === "etransfer" && (
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={payoutEmail}
                onChange={(e) => setPayoutEmail(e.target.value)}
              />
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 mt-2">
                <div className="flex gap-2">
                  <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-1">Payment Requirements:</p>
                    <p className="text-xs">E-Transfer payments via Stripe require a minimum transaction amount of <strong>$1.00 CAD</strong>. Payments below this amount cannot be processed.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {payoutMethod === "wire" && (
            <WireAchPaymentFields
              key={`wire-ach-${formResetKey}`}
              bankRoutingNumber={bankRoutingNumber}
              setBankRoutingNumber={setBankRoutingNumber}
              bankAccountNumber={bankAccountNumber}
              setBankAccountNumber={setBankAccountNumber}
            />
          )}

          {payoutMethod === "paypal" && (
            <div className="space-y-2">
              <Label htmlFor="paypal-email">PayPal Email</Label>
              <Input
                id="paypal-email"
                type="email"
                placeholder="your@paypal.com"
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
              />
            </div>
          )}

          {payoutMethod === "crypto" && (
            <CryptoPaymentFields
              key={`crypto-${formResetKey}`}
              cryptoWalletAddress={cryptoWalletAddress}
              setCryptoWalletAddress={setCryptoWalletAddress}
              cryptoNetwork={cryptoNetwork}
              setCryptoNetwork={setCryptoNetwork}
            />
          )}

          <Button
            onClick={onAddPaymentMethod}
            disabled={isAddDisabled}
            className="w-full"
          >
            {isSubmitting ? "Adding..." : "Add Payment Method"}
          </Button>
        </div>
      </div>

      {showFeeBreakdown && (
        <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-6">
          <h4 className="mb-2 font-bold text-blue-900">Payment Fee Breakdown</h4>
          <div className="space-y-2 text-sm text-blue-800">
            <div className="flex justify-between">
              <span>Platform Fee:</span>
              <span className="font-medium">Varies by company (default {platformFeeDisplay})</span>
            </div>
            <div className="flex justify-between">
              <span>Processing Fee:</span>
              <span className="font-medium">{stripeFeeDisplay} of gross earnings</span>
            </div>
            <div className="mt-2 flex justify-between border-t-2 border-blue-300 pt-2 font-bold">
              <span>Total Deduction:</span>
              <span>{totalFeeDisplay}</span>
            </div>
            <p className="mt-2 text-xs text-blue-600">
              Note: Platform fees may vary by company partnership agreements.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function CompanyPayoutApproval({ payouts }: { payouts: CreatorPayment[] }) {
  const { toast } = useToast();
  const [disputePayoutId, setDisputePayoutId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; description: string }>({
    open: false,
    title: "",
    description: "",
  });

  const pendingPayouts = useMemo(
    () => payouts.filter((payout) => payout.status === "pending" || payout.status === "processing"),
    [payouts]
  );

  const totalPendingAmount = pendingPayouts.reduce(
    (sum, payout) => sum + parseFloat(payout.grossAmount),
    0
  );

  const filteredPendingPayouts = useMemo(() => {
    return pendingPayouts.filter((payout) => {
      const matchesSearch = searchTerm
        ? [
            payout.description,
            payout.id,
            payout.status,
          ]
            .filter(Boolean)
            .some(
              (value) =>
                typeof value === "string" &&
                value.toLowerCase().includes(searchTerm.toLowerCase()),
            )
        : true;
      const matchesStatus = statusFilter === "all" || payout.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [pendingPayouts, searchTerm, statusFilter]);

  const hasActiveFilters = searchTerm.trim().length > 0 || statusFilter !== "all";

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
  };

  const approvePaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await apiRequest("POST", `/api/company/payments/${paymentId}/approve`, {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments/company"] });
      toast({
        title: "Success",
        description: "Payment approved successfully",
      });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to approve payment",
      });
    },
  });

  const disputePaymentMutation = useMutation({
    mutationFn: async ({ paymentId, reason }: { paymentId: string; reason: string }) => {
      const res = await apiRequest("POST", `/api/company/payments/${paymentId}/dispute`, { reason });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments/company"] });
      setDisputePayoutId(null);
      setDisputeReason("");
      toast({
        title: "Success",
        description: "Payment disputed successfully",
      });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to dispute payment",
      });
    },
  });

  return (
    <div className="space-y-6">
      {pendingPayouts.length > 0 && (
        <div className="rounded-xl border-2 border-yellow-200 bg-yellow-50 p-6">
          <div className="mb-3 flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-yellow-600" />
            <h3 className="text-lg font-bold text-yellow-900">Pending Approvals</h3>
          </div>
          <p className="text-yellow-800">
            You have {pendingPayouts.length} payout{pendingPayouts.length !== 1 ? "s" : ""} pending approval
            totaling CA${totalPendingAmount.toFixed(2)}
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border-2 border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-bold text-gray-900">Payout Requests</h3>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
                <X className="h-3 w-3 mr-1" />
                Clear Filters
              </Button>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-gray-500">Search</label>
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by description or ID"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Showing {filteredPendingPayouts.length} of {pendingPayouts.length} pending payout request
            {pendingPayouts.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="divide-y divide-gray-200">
          {filteredPendingPayouts.length === 0 ? (
            <div className="py-12 text-center">
              {pendingPayouts.length === 0 ? (
                <p className="text-gray-500">No pending approvals</p>
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-500">
                  <Search className="h-8 w-8" />
                  <p>No payout requests match your filters</p>
                </div>
              )}
            </div>
          ) : (
            filteredPendingPayouts.map((payout) => (
              <div key={payout.id} className="p-4 sm:p-6 transition hover:bg-gray-50">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2 sm:gap-3">
                      <h4 className="font-bold text-gray-900 break-words">
                        {payout.description || `Payment ${payout.id.slice(0, 8)}`}
                      </h4>
                      <StatusBadge status={payout.status} isDisputed={isDisputedPayment(payout as CreatorPayment)} />
                    </div>
                    <p className="text-sm text-gray-600">
                      Created: {new Date(payout.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-left sm:text-right flex-shrink-0">
                    <div className="text-xl sm:text-2xl font-bold text-gray-900">
                      CA${parseFloat(payout.grossAmount).toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">Creator payment</div>
                  </div>
                </div>

                <div className="mb-4 rounded-lg bg-gray-50 p-3 sm:p-4">
                  <div className="grid grid-cols-1 gap-3 sm:gap-4 text-sm sm:grid-cols-3">
                    <div>
                      <div className="mb-1 text-gray-600">Creator Payment</div>
                      <div className="font-medium text-gray-900">
                        CA${parseFloat(payout.grossAmount).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-gray-600">
                        Platform Fee ({parseFloat(payout.grossAmount) > 0 ? ((parseFloat(payout.platformFeeAmount) / parseFloat(payout.grossAmount)) * 100).toFixed(0) : '4'}%)
                      </div>
                      <div className="font-medium text-gray-900">
                        CA${parseFloat(payout.platformFeeAmount).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-gray-600">
                        Processing ({parseFloat(payout.grossAmount) > 0 ? ((parseFloat(payout.stripeFeeAmount) / parseFloat(payout.grossAmount)) * 100).toFixed(0) : '3'}%)
                      </div>
                      <div className="font-medium text-gray-900">
                        CA${parseFloat(payout.stripeFeeAmount).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                  <Button
                    className="flex-1 gap-2 bg-green-600 text-white hover:bg-green-700"
                    onClick={() => approvePaymentMutation.mutate(payout.id)}
                    disabled={approvePaymentMutation.isPending || payout.status === "processing"}
                  >
                    <CheckCircle className="h-4 w-4" />
                    {payout.status === "processing" 
                      ? "Processing..." 
                      : approvePaymentMutation.isPending 
                      ? "Approving..." 
                      : "Approve Payment"}
                  </Button>
                  <Button
                    className="flex-1 gap-2 bg-red-600 text-white hover:bg-red-700"
                    onClick={() => {
                      const reason = prompt("Enter reason for dispute:");
                      if (reason) {
                        disputePaymentMutation.mutate({ paymentId: payout.id, reason });
                      }
                    }}
                    disabled={disputePaymentMutation.isPending || payout.status === "processing"}
                  >
                    <XCircle className="h-4 w-4" />
                    {disputePaymentMutation.isPending ? "Disputing..." : "Dispute"}
                  </Button>
                </div>

              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function CompanyOverview({ payouts }: { payouts: CreatorPayment[] }) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; description: string }>({
    open: false,
    title: "",
    description: "",
  });
  const totalPaid = payouts
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + parseFloat(p.grossAmount), 0);

  const pendingAmount = payouts
    .filter((p) => p.status === "pending" || p.status === "processing")
    .reduce((sum, p) => sum + parseFloat(p.grossAmount), 0);

  const filteredPayouts = useMemo(() => {
    return payouts.filter((payout) => {
      const matchesSearch = searchTerm
        ? [
            payout.description,
            payout.id,
            payout.status,
          ]
            .filter(Boolean)
            .some(
              (value) =>
                typeof value === "string" &&
                value.toLowerCase().includes(searchTerm.toLowerCase()),
            )
        : true;
      const matchesStatus = statusFilter === "all" || payout.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [payouts, searchTerm, statusFilter]);

  const hasActiveFilters = searchTerm.trim().length > 0 || statusFilter !== "all";

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
  };

  const exportPayments = () => {
    const csv = [
      ['ID', 'Description', 'Creator Earnings', 'Fees', 'Status', 'Date'],
      ...payouts.map(p => [
        p.id.slice(0, 8),
        p.description || 'Payment',
        p.grossAmount,
        (parseFloat(p.platformFeeAmount) + parseFloat(p.stripeFeeAmount)).toFixed(2),
        p.status,
        p.completedAt || p.createdAt
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `company-payments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Payment history exported successfully",
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border-2 border-gray-200 bg-white p-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-gray-600">Total Paid Out</span>
            <Send className="h-5 w-5 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">CA${totalPaid.toFixed(2)}</div>
          <div className="mt-1 text-xs text-gray-500">All-time</div>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 p-6 text-white">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-yellow-100">Pending</span>
            <Clock className="h-5 w-5 text-yellow-100" />
          </div>
          <div className="text-3xl font-bold">CA${pendingAmount.toFixed(2)}</div>
          <div className="mt-1 text-xs text-yellow-100">Requires action</div>
        </div>

        <div className="rounded-xl border-2 border-gray-200 bg-white p-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-gray-600">Total Payments</span>
            <Users className="h-5 w-5 text-purple-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{payouts.length}</div>
          <div className="mt-1 text-xs text-gray-500">All transactions</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border-2 border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-6 space-y-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-900">Payment History</h3>
              <Badge variant="secondary" className="hidden lg:inline-flex">
                {filteredPayouts.length} of {payouts.length}
              </Badge>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex-1 min-w-[200px]">
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search transactions"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
                  <X className="h-3 w-3 mr-1" />
                  Reset
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={exportPayments}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Showing {filteredPayouts.length} of {payouts.length} records
          </p>
        </div>
        <div className="overflow-x-auto">
          {filteredPayouts.length === 0 ? (
            <div className="py-12 text-center">
              {payouts.length === 0 ? (
                <p className="text-gray-500">No payment history yet</p>
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-500">
                  <Search className="h-8 w-8" />
                  <p>No payments match your filters</p>
                </div>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Creator Earnings
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Fees
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sticky right-0 bg-gray-50 shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.1)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredPayouts.map((payout) => (
                  <tr key={payout.id} className="transition hover:bg-gray-50 group">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {payout.id.slice(0, 8)}...
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {payout.description || "Payment"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      CA${parseFloat(payout.grossAmount).toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      CA${(parseFloat(payout.platformFeeAmount) + parseFloat(payout.stripeFeeAmount)).toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <StatusBadge status={payout.status} isDisputed={isDisputedPayment(payout as CreatorPayment)} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      {payout.completedAt
                        ? new Date(payout.completedAt).toLocaleDateString()
                        : new Date(payout.createdAt).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 sticky right-0 bg-white group-hover:bg-gray-50 shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.1)]">
                      <Link href={`/payments/${payout.id}`}>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Eye className="h-4 w-4" />
                          View Details
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <GenericErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
        title={errorDialog.title}
        description={errorDialog.description}
        variant="error"
      />
    </div>
  );
}

function AdminPaymentDashboard({
  payments,
}: {
  payments: CreatorPayment[];
}) {
  const { toast } = useToast();

  // Fetch platform fee settings for display
  const { data: feeSettings } = useQuery<{
    totalFeeDisplay: string;
  }>({
    queryKey: ["/api/platform/fees"],
  });

  const totalFeeDisplay = feeSettings?.totalFeeDisplay ?? "7%";

  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; description: string }>({
    open: false,
    title: "",
    description: "",
  });
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [paymentToProcess, setPaymentToProcess] = useState<CreatorPayment | null>(null);
  const [insufficientFundsDialogOpen, setInsufficientFundsDialogOpen] = useState(false);
  const [failedPayment, setFailedPayment] = useState<CreatorPayment | null>(null);
  const [minimumPaymentDialogOpen, setMinimumPaymentDialogOpen] = useState(false);
  const [minimumPaymentError, setMinimumPaymentError] = useState<string>("");
  const [paymentFailedDialogOpen, setPaymentFailedDialogOpen] = useState(false);
  const [paymentFailedError, setPaymentFailedError] = useState<string>("");

  const allPayments = payments;

  const filteredPayments = useMemo(() => {
    return allPayments.filter((payment) => {
      const matchesStatus = statusFilter === "all" || payment.status === statusFilter;
      const matchesSearch = searchTerm
        ? [payment.description, payment.id, payment.status]
            .filter(Boolean)
            .some(
              (value) =>
                typeof value === "string" &&
                value.toLowerCase().includes(searchTerm.toLowerCase()),
            )
        : true;
      return matchesStatus && matchesSearch;
    });
  }, [allPayments, searchTerm, statusFilter]);

  const hasActiveFilters = searchTerm.trim().length > 0 || statusFilter !== "all";

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
  };

  const totalPlatformRevenue = allPayments.reduce((sum, payment) => {
    return sum + parseFloat(payment.platformFeeAmount) + parseFloat(payment.stripeFeeAmount);
  }, 0);

  const totalGMV = allPayments.reduce((sum, payment) => {
    return sum + parseFloat(payment.grossAmount);
  }, 0);

  const pendingCount = allPayments.filter(
    (p) => p.status === "pending" || p.status === "processing"
  ).length;

  const exportPayments = () => {
    const csv = [
      ['Transaction ID', 'Description', 'Gross', 'Platform Fee', 'Net', 'Status', 'Date'],
      ...filteredPayments.map(p => [
        p.id.slice(0, 8),
        p.description || 'Payment',
        p.grossAmount,
        (parseFloat(p.platformFeeAmount) + parseFloat(p.stripeFeeAmount)).toFixed(2),
        p.netAmount,
        p.status,
        p.completedAt || p.createdAt
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `platform-payments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Payment data exported successfully",
    });
  };

  const bulkProcessMutation = useMutation({
    mutationFn: async () => {
      const processingPayments = filteredPayments.filter(p => p.status === "processing");

      if (processingPayments.length === 0) {
        throw new Error("No processing payments to complete");
      }

      const results = await Promise.all(
        processingPayments.map(async payment => {
          const res = await apiRequest("PATCH", `/api/payments/${payment.id}/status`, { status: "completed" });
          return await res.json();
        })
      );

      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments/all"] });
      toast({
        title: "Success",
        description: `${results.length} payment(s) marked as completed`,
      });
    },
    onError: (error: Error) => {
      const errorMsg = error.message || "Failed to process payments";

      // Check if it's a minimum payment error
      const isMinimumPaymentError = errorMsg.toLowerCase().includes('minimum') ||
                                     errorMsg.toLowerCase().includes('below the minimum required amount');

      if (isMinimumPaymentError) {
        setMinimumPaymentError(errorMsg);
        setMinimumPaymentDialogOpen(true);
      } else {
        setErrorDialog({
          open: true,
          title: "Error",
          description: errorMsg,
        });
      }
    },
  });

  // Handler to open confirmation dialog
  const handleApprovePayment = (payment: CreatorPayment) => {
    setPaymentToProcess(payment);
    setConfirmDialogOpen(true);
  };

  // Handler to confirm and process payment
  const confirmProcessPayment = () => {
    if (paymentToProcess) {
      processPaymentMutation.mutate(paymentToProcess.id);
    }
    setConfirmDialogOpen(false);
    setPaymentToProcess(null);
  };

  // Mutation to approve/process individual payment
  const processPaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await apiRequest("PATCH", `/api/payments/${paymentId}/status`, { status: "completed" });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments/all"] });
      toast({
        title: "Success",
        description: "Payment processed and sent to creator",
      });
    },
    onError: (error: Error, paymentId: string) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments/all"] });

      // Extract clean error message
      let errorMsg = error.message || "Failed to process payment";

      // Check if it's an insufficient funds error
      const isInsufficientFunds = errorMsg.toLowerCase().includes('insufficient funds');

      // Check if it's a minimum payment error
      const isMinimumPaymentError = errorMsg.toLowerCase().includes('minimum') ||
                                     errorMsg.toLowerCase().includes('below the minimum required amount');

      if (isInsufficientFunds) {
        // Find the payment that failed
        const payment = allPayments.find(p => p.id === paymentId);
        if (payment) {
          setFailedPayment(payment);
        }
        setInsufficientFundsDialogOpen(true);
      } else if (isMinimumPaymentError) {
        // Show minimum payment dialog instead of toast
        const payment = allPayments.find(p => p.id === paymentId);
        if (payment) {
          setFailedPayment(payment);
        }
        setMinimumPaymentError(errorMsg);
        setMinimumPaymentDialogOpen(true);
      } else {
        // Show payment failed dialog for other types of errors
        const payment = allPayments.find(p => p.id === paymentId);
        if (payment) {
          setFailedPayment(payment);
        }
        setPaymentFailedError(errorMsg);
        setPaymentFailedDialogOpen(true);
      }
    },
  });

  // Mutation to mark as processing
  const markProcessingMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await apiRequest("PATCH", `/api/payments/${paymentId}/status`, { status: "processing" });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments/all"] });
      toast({
        title: "Success",
        description: "Payment marked as processing",
      });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to update payment status",
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 p-6 text-white">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-purple-100">Platform Revenue</span>
            <TrendingUp className="h-5 w-5 text-purple-100" />
          </div>
          <div className="text-3xl font-bold">CA${totalPlatformRevenue.toFixed(2)}</div>
          <div className="mt-1 text-xs text-purple-100">{totalFeeDisplay} of GMV</div>
        </div>

        <div className="rounded-xl border-2 border-gray-200 bg-white p-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-gray-600">Total GMV</span>
            <DollarSign className="h-5 w-5 text-green-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">CA${totalGMV.toFixed(2)}</div>
          <div className="mt-1 text-xs text-gray-500">Gross merchandise value</div>
        </div>

        <div className="rounded-xl border-2 border-gray-200 bg-white p-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-gray-600">Total Transactions</span>
            <Send className="h-5 w-5 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{allPayments.length}</div>
          <div className="mt-1 text-xs text-gray-500">All-time</div>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 p-6 text-white">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-yellow-100">Pending</span>
            <Clock className="h-5 w-5 text-yellow-100" />
          </div>
          <div className="text-3xl font-bold">{pendingCount}</div>
          <div className="mt-1 text-xs text-yellow-100">Awaiting processing</div>
        </div>
      </div>

      {filteredPayments.filter(p => p.status === "processing").length > 0 && (
        <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-blue-900">Process Payments</h3>
              <p className="mt-1 text-sm text-blue-700">
                {filteredPayments.filter(p => p.status === "processing").length} payment(s) ready to be marked as completed
              </p>
            </div>
            <Button
              onClick={() => bulkProcessMutation.mutate()}
              disabled={bulkProcessMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {bulkProcessMutation.isPending ? "Processing..." : "Complete All Processing"}
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border-2 border-gray-200 bg-white">
        <div className="flex flex-col gap-4 border-b border-gray-200 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">All Transactions</h3>
            <p className="mt-1 text-sm text-gray-600">Complete platform payment history</p>
            <p className="mt-1 text-xs text-gray-500">
              Showing {filteredPayments.length} of {allPayments.length} transactions
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex-1 min-w-[200px]">
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search payments"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
                <X className="h-3 w-3 mr-1" />
                Reset
              </Button>
            )}
            <Button variant="outline" className="gap-2" onClick={exportPayments}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {filteredPayments.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              {allPayments.length === 0 ? (
                <p>No payments found</p>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Search className="h-8 w-8" />
                  <p>No payments match your filters</p>
                </div>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Transaction ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Gross
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Platform Fee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Net
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sticky right-0 bg-gray-50 shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.1)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredPayments.map((payment) => (
                  <tr key={payment.id} className="transition hover:bg-gray-50 cursor-pointer group">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      <Link href={`/payments/${payment.id}`} className="block hover:text-primary">
                        {payment.id.slice(0, 8)}...
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      <Link href={`/payments/${payment.id}`} className="block">
                        {payment.description || "Payment"}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      <Link href={`/payments/${payment.id}`} className="block">
                        CA${parseFloat(payment.grossAmount).toFixed(2)}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-purple-600">
                      <Link href={`/payments/${payment.id}`} className="block">
                        CA${(parseFloat(payment.platformFeeAmount) + parseFloat(payment.stripeFeeAmount)).toFixed(2)}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-green-600">
                      <Link href={`/payments/${payment.id}`} className="block">
                        CA${parseFloat(payment.netAmount).toFixed(2)}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <Link href={`/payments/${payment.id}`} className="block">
                        <StatusBadge status={payment.status} isDisputed={isDisputedPayment(payment as CreatorPayment)} />
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      <Link href={`/payments/${payment.id}`} className="block">
                        {payment.completedAt
                          ? new Date(payment.completedAt).toLocaleDateString()
                          : new Date(payment.createdAt).toLocaleDateString()}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm sticky right-0 bg-white group-hover:bg-gray-50 shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.1)]" onClick={(e) => e.stopPropagation()}>
                      {payment.status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={(e) => { e.preventDefault(); handleApprovePayment(payment); }}
                          disabled={processPaymentMutation.isPending}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle className="mr-1 h-4 w-4" />
                          Approve & Pay
                        </Button>
                      )}
                      {payment.status === 'processing' && (
                        <Button
                          size="sm"
                          onClick={(e) => { e.preventDefault(); handleApprovePayment(payment); }}
                          disabled={processPaymentMutation.isPending}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Send className="mr-1 h-4 w-4" />
                          Send Payment
                        </Button>
                      )}
                      {payment.status === 'completed' && (
                        <span className="text-xs text-gray-500 italic">Completed</span>
                      )}
                      {payment.status === 'failed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => { e.preventDefault(); markProcessingMutation.mutate(payment.id); }}
                          disabled={markProcessingMutation.isPending}
                        >
                          Retry
                        </Button>
                      )}
                      {payment.status === 'refunded' && (
                        <span className="text-xs text-gray-500 italic">Refunded</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Payment Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Confirm Payment Processing
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <p>You are about to process a payment of <strong>CA${paymentToProcess?.netAmount}</strong> to the creator.</p>

              <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-sm">
                <div className="flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-yellow-900">
                    <p className="font-semibold mb-1">Important:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Ensure your PayPal business account has sufficient funds</li>
                      <li>This will send real money to the creator's account</li>
                      <li>If payment fails, you can retry from the dashboard</li>
                    </ul>
                  </div>
                </div>
              </div>

              <p className="text-sm">Payment details:</p>
              <div className="text-sm bg-gray-50 rounded p-2 space-y-1">
                <div><strong>Amount:</strong> CA${paymentToProcess?.netAmount}</div>
                <div><strong>Description:</strong> {paymentToProcess?.description || 'Payment'}</div>
                <div><strong>Status:</strong> {paymentToProcess?.status}</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmProcessPayment}
              className="bg-green-600 hover:bg-green-700"
            >
              Confirm & Process Payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Insufficient Funds Dialog */}
      <AlertDialog open={insufficientFundsDialogOpen} onOpenChange={setInsufficientFundsDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-blue-900">
              <DollarSign className="h-6 w-6 text-blue-600" />
              Payment Request On Hold
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-3">
              <div className="rounded-lg bg-blue-50 border-2 border-blue-200 p-4">
                <p className="text-gray-800 leading-relaxed">
                  The company's PayPal account has insufficient funds to process this payment request. The payment cannot be completed at this time.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700">Payment Request Details:</p>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Amount:</span>
                    <span className="font-semibold text-gray-900">CA${failedPayment?.netAmount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Description:</span>
                    <span className="font-medium text-gray-900">{failedPayment?.description || 'Payment'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment ID:</span>
                    <span className="font-mono text-xs text-gray-700">{failedPayment?.id.slice(0, 12)}...</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3">
                <p className="text-sm font-semibold text-yellow-900 mb-2">What Happened:</p>
                <ul className="space-y-1.5 text-sm text-yellow-800">
                  <li className="flex gap-2">
                    <span>•</span>
                    <span>The payment could not be processed due to insufficient funds in the company's PayPal account</span>
                  </li>
                  <li className="flex gap-2">
                    <span>•</span>
                    <span>The payment status has been updated to "failed"</span>
                  </li>
                  <li className="flex gap-2">
                    <span>•</span>
                    <span>Click "Send Notification" below to inform the company about this issue</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                <p className="text-sm font-semibold text-green-900 mb-2">Next Steps:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-sm text-green-800">
                  <li>Wait for the company to add funds to their PayPal account</li>
                  <li>Once notified that funds are available, retry the payment</li>
                  <li>Use the "Retry" button on the failed payment in the dashboard</li>
                </ol>
              </div>

              <p className="text-xs text-gray-500 italic">
                This payment request will remain in "failed" status until the company resolves the funding issue and you retry the transaction.
              </p>

              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 mt-4">
                <p className="text-sm font-semibold text-blue-900 mb-1">✅ Notification Sent Automatically</p>
                <p className="text-xs text-blue-800">
                  The company has been automatically notified via email and in-app notification about this insufficient funds issue.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              Close
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Minimum Payment Amount Dialog */}
      <AlertDialog open={minimumPaymentDialogOpen} onOpenChange={setMinimumPaymentDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-900">
              <Info className="h-6 w-6 text-orange-600" />
              Minimum Payment Amount Required
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-3">
              <div className="rounded-lg bg-orange-50 border-2 border-orange-200 p-4">
                <p className="text-gray-800 leading-relaxed">
                  The payment amount is below the minimum required for E-Transfer transactions. Stripe requires a minimum transfer of at least <strong>$1.00 CAD</strong>.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700">Payment Details:</p>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Amount:</span>
                    <span className="font-semibold text-gray-900">CA${failedPayment?.netAmount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Description:</span>
                    <span className="font-medium text-gray-900">{failedPayment?.description || 'Payment'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment ID:</span>
                    <span className="font-mono text-xs text-gray-700">{failedPayment?.id.slice(0, 12)}...</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                <p className="text-sm font-semibold text-blue-900 mb-2">Important Information:</p>
                <ul className="space-y-1.5 text-sm text-blue-800">
                  <li className="flex gap-2">
                    <span>•</span>
                    <span>E-Transfer payments via Stripe require a minimum of <strong>$1.00 CAD</strong></span>
                  </li>
                  <li className="flex gap-2">
                    <span>•</span>
                    <span>This payment has been marked as "failed" due to not meeting the minimum requirement</span>
                  </li>
                  <li className="flex gap-2">
                    <span>•</span>
                    <span>Please ensure future payments meet or exceed the minimum amount</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                <p className="text-sm font-semibold text-green-900 mb-2">Next Steps:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-sm text-green-800">
                  <li>Review payment amounts before processing</li>
                  <li>Consider combining small payments to meet the minimum threshold</li>
                  <li>Contact the creator if payment amounts need to be adjusted</li>
                </ol>
              </div>

              {minimumPaymentError && (
                <div className="rounded-lg bg-gray-100 border border-gray-300 p-3">
                  <p className="text-xs font-mono text-gray-700">
                    {minimumPaymentError}
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              Close
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Failed Reminder Dialog */}
      <AlertDialog open={paymentFailedDialogOpen} onOpenChange={setPaymentFailedDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-gray-900">
              <Info className="h-6 w-6 text-gray-600" />
              Payment Processing Reminder
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-3">
              <div className="rounded-lg bg-gray-50 border-2 border-gray-200 p-4">
                <p className="text-gray-800 leading-relaxed">
                  The payment could not be processed at this time. Please review the details below and take appropriate action.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700">Payment Details:</p>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Amount:</span>
                    <span className="font-semibold text-gray-900">CA${failedPayment?.netAmount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Description:</span>
                    <span className="font-medium text-gray-900">{failedPayment?.description || 'Payment'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment ID:</span>
                    <span className="font-mono text-xs text-gray-700">{failedPayment?.id.slice(0, 12)}...</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                <p className="text-sm font-semibold text-blue-900 mb-2">What Happened:</p>
                <ul className="space-y-1.5 text-sm text-blue-800">
                  <li className="flex gap-2">
                    <span>•</span>
                    <span>The payment processing encountered an issue</span>
                  </li>
                  <li className="flex gap-2">
                    <span>•</span>
                    <span>The payment status has been updated to "failed"</span>
                  </li>
                  <li className="flex gap-2">
                    <span>•</span>
                    <span>Please review the error details below</span>
                  </li>
                </ul>
              </div>

              {paymentFailedError && (
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3">
                  <p className="text-sm font-semibold text-yellow-900 mb-2">Error Details:</p>
                  <p className="text-sm text-yellow-800">
                    {paymentFailedError}
                  </p>
                </div>
              )}

              <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                <p className="text-sm font-semibold text-green-900 mb-2">Next Steps:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-sm text-green-800">
                  <li>Review the error details and payment information</li>
                  <li>Verify the payment settings are configured correctly</li>
                  <li>Contact the creator if additional information is needed</li>
                  <li>Use the "Retry" button to process the payment again once the issue is resolved</li>
                </ol>
              </div>

              <p className="text-xs text-gray-500 italic">
                This payment will remain in "failed" status until you successfully retry the transaction or take corrective action.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              Close
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GenericErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
        title={errorDialog.title}
        description={errorDialog.description}
        variant="error"
      />
    </div>
  );
}

function AdminPaymentSettings() {
  const { toast } = useToast();
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; description: string }>({
    open: false,
    title: "",
    description: "",
  });

  // Fee configuration state (using correct database keys)
  const [platformFeePercentage, setPlatformFeePercentage] = useState("4");
  const [stripeFeePercentage, setStripeFeePercentage] = useState("3");
  const [minimumPayoutThreshold, setMinimumPayoutThreshold] = useState("50");
  const [payoutReservePercentage, setPayoutReservePercentage] = useState("10");

  // Fetch platform settings
  const { data: platformSettings } = useQuery<Array<{key: string; value: string}>>({
    queryKey: ["/api/admin/settings"],
  });

  // Load fee settings from backend
  useEffect(() => {
    if (platformSettings) {
      const settingsMap = new Map(platformSettings.map(s => [s.key, s.value]));
      if (settingsMap.has("platform_fee_percentage")) setPlatformFeePercentage(settingsMap.get("platform_fee_percentage")!);
      if (settingsMap.has("stripe_processing_fee_percentage")) setStripeFeePercentage(settingsMap.get("stripe_processing_fee_percentage")!);
      if (settingsMap.has("minimum_payout_threshold")) setMinimumPayoutThreshold(settingsMap.get("minimum_payout_threshold")!);
      if (settingsMap.has("payout_reserve_percentage")) setPayoutReservePercentage(settingsMap.get("payout_reserve_percentage")!);
    }
  }, [platformSettings]);

  // Mutation to update platform settings
  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const res = await apiRequest("PUT", `/api/admin/settings/${key}`, { value });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/fees"] });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to update setting",
      });
    },
  });

  const saveFeeSettings = async () => {
    try {
      await Promise.all([
        updateSettingMutation.mutateAsync({ key: "platform_fee_percentage", value: platformFeePercentage }),
        updateSettingMutation.mutateAsync({ key: "stripe_processing_fee_percentage", value: stripeFeePercentage }),
        updateSettingMutation.mutateAsync({ key: "minimum_payout_threshold", value: minimumPayoutThreshold }),
        updateSettingMutation.mutateAsync({ key: "payout_reserve_percentage", value: payoutReservePercentage }),
      ]);
      toast({
        title: "Success",
        description: "Fee settings updated successfully",
      });
    } catch (error) {
      // Error already handled by mutation
    }
  };

  // Fetch funding accounts
  const { data: fundingAccounts = [] } = useQuery<Array<{
    id: string;
    name: string;
    type: "bank" | "wallet" | "card";
    last4: string;
    status: "active" | "pending" | "disabled";
    isPrimary: boolean;
  }>>({
    queryKey: ["/api/admin/funding-accounts"],
  });

  // Add funding account state
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState<"bank" | "wallet" | "card">("bank");
  const [accountLast4, setAccountLast4] = useState("");

  const addAccountMutation = useMutation({
    mutationFn: async (account: { name: string; type: string; last4: string; status: string }) => {
      const res = await apiRequest("POST", "/api/admin/funding-accounts", account);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/funding-accounts"] });
      setShowAddAccount(false);
      setAccountName("");
      setAccountLast4("");
      toast({
        title: "Success",
        description: "Funding account added successfully",
      });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to add funding account",
      });
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/funding-accounts/${id}`, updates);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/funding-accounts"] });
      toast({
        title: "Success",
        description: "Account updated successfully",
      });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to update account",
      });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/funding-accounts/${id}`, undefined);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/funding-accounts"] });
      toast({
        title: "Success",
        description: "Account deleted successfully",
      });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to delete account",
      });
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/funding-accounts/${id}/set-primary`, {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/funding-accounts"] });
      toast({
        title: "Success",
        description: "Primary account updated",
      });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to set primary account",
      });
    },
  });

  const typeLabels: Record<"bank" | "wallet" | "card", string> = {
    bank: "Bank Account",
    wallet: "Custody Wallet",
    card: "Corporate Card",
  };

  const statusStyles: Record<"active" | "pending" | "disabled", string> = {
    active: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    disabled: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border-2 border-gray-200 bg-white p-6">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-900">Fee Configuration</h3>
          <p className="mt-1 text-sm text-gray-600">
            Configure platform fees and payout thresholds. These settings are synced across the entire platform.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="platform-fee">Platform Fee (%)</Label>
            <Input
              id="platform-fee"
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={platformFeePercentage}
              onChange={(e) => setPlatformFeePercentage(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              Percentage fee charged on each transaction (e.g., 4 for 4%).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stripe-fee">Processing Fee (%)</Label>
            <Input
              id="stripe-fee"
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={stripeFeePercentage}
              onChange={(e) => setStripeFeePercentage(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              Stripe/payment processor fee percentage (e.g., 3 for 3%).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="min-payout">Minimum Payout ($)</Label>
            <Input
              id="min-payout"
              type="number"
              min={0}
              step="1"
              value={minimumPayoutThreshold}
              onChange={(e) => setMinimumPayoutThreshold(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              Minimum balance required before a payout can be processed.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reserve-percentage">Reserve Percentage (%)</Label>
            <Input
              id="reserve-percentage"
              type="number"
              min={0}
              max={100}
              step="1"
              value={payoutReservePercentage}
              onChange={(e) => setPayoutReservePercentage(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              Percentage held in reserve for chargebacks and disputes.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            className="bg-blue-600 text-white hover:bg-blue-700"
            onClick={saveFeeSettings}
            disabled={updateSettingMutation.isPending}
          >
            {updateSettingMutation.isPending ? "Saving..." : "Save Fee Settings"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border-2 border-gray-200 bg-white p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Platform Funding Accounts</h3>
            <p className="mt-1 text-sm text-gray-600">
              Manage the accounts used to fund creator payouts and collect platform fees.
            </p>
          </div>
          <Button variant="outline" onClick={() => setShowAddAccount(true)}>Add Funding Source</Button>
        </div>

        {showAddAccount && (
          <div className="mb-6 rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
            <h4 className="mb-4 font-bold text-blue-900">Add New Funding Account</h4>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="account-name">Account Name</Label>
                <Input
                  id="account-name"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Primary Operating Account"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-type">Account Type</Label>
                <Select value={accountType} onValueChange={(v) => setAccountType(v as any)}>
                  <SelectTrigger id="account-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank Account</SelectItem>
                    <SelectItem value="wallet">Custody Wallet</SelectItem>
                    <SelectItem value="card">Corporate Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-last4">Last 4 Digits</Label>
                <Input
                  id="account-last4"
                  value={accountLast4}
                  onChange={(e) => setAccountLast4(e.target.value)}
                  placeholder="1234"
                  maxLength={4}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    if (accountName && accountLast4) {
                      addAccountMutation.mutate({
                        name: accountName,
                        type: accountType,
                        last4: accountLast4,
                        status: "pending",
                      });
                    }
                  }}
                  disabled={!accountName || !accountLast4 || addAccountMutation.isPending}
                >
                  {addAccountMutation.isPending ? "Adding..." : "Add Account"}
                </Button>
                <Button variant="outline" onClick={() => setShowAddAccount(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {fundingAccounts.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              No funding accounts yet. Add one to get started.
            </div>
          ) : (
            fundingAccounts.map((account) => (
              <div key={account.id} className="flex flex-col gap-4 rounded-lg border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">{account.name}</div>
                  <div className="text-xs uppercase tracking-wide text-gray-500">
                    {typeLabels[account.type]} · Ending in {account.last4}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {account.isPrimary && <Badge>Primary</Badge>}
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[account.status]}`}>
                    {account.status === "active"
                      ? "Active"
                      : account.status === "pending"
                      ? "Pending Verification"
                      : "Disabled"}
                  </span>
                  {!account.isPrimary && account.status === "active" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPrimaryMutation.mutate(account.id)}
                      disabled={setPrimaryMutation.isPending}
                    >
                      Set Primary
                    </Button>
                  )}
                  {account.status === "pending" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateAccountMutation.mutate({ id: account.id, updates: { status: "active" } })}
                      disabled={updateAccountMutation.isPending}
                    >
                      Activate
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this account?")) {
                        deleteAccountMutation.mutate(account.id);
                      }
                    }}
                    disabled={deleteAccountMutation.isPending}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <GenericErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
        title={errorDialog.title}
        description={errorDialog.description}
        variant="error"
      />
    </div>
  );
}

export default function PaymentSettings() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "settings" | "approvals" | "dashboard">("overview");

  // Quick Guide Tour - for both creator and company users
  const isCreator = user?.role === 'creator';
  const isCompany = user?.role === 'company';
  useCreatorPageTour(CREATOR_TOUR_IDS.PAYMENT_SETTINGS, creatorPaymentTourSteps, isCreator);
  useCompanyPageTour(COMPANY_TOUR_IDS.PAYMENT_SETTINGS, companyPaymentTourSteps, isCompany);

  const [payoutMethod, setPayoutMethod] = useState("etransfer");
  const [payoutEmail, setPayoutEmail] = useState("");
  const [bankRoutingNumber, setBankRoutingNumber] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [cryptoWalletAddress, setCryptoWalletAddress] = useState("");
  const [cryptoNetwork, setCryptoNetwork] = useState("");
  const [formResetKey, setFormResetKey] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentMethodToDelete, setPaymentMethodToDelete] = useState<PaymentMethod | null>(null);
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; description: string }>({
    open: false,
    title: "",
    description: "",
  });
  // Wire/ACH verification states
  const [microDepositsModalOpen, setMicroDepositsModalOpen] = useState(false);
  const [verifyingPaymentMethod, setVerifyingPaymentMethod] = useState<PaymentMethod | null>(null);
  const [microDepositAmount1, setMicroDepositAmount1] = useState("");
  const [microDepositAmount2, setMicroDepositAmount2] = useState("");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setErrorDialog({
        open: true,
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    if (user?.role === "company" || user?.role === "creator") {
      setActiveTab("overview");
      return;
    }
    if (user?.role === "admin") {
      setActiveTab("dashboard");
    }
  }, [user?.role]);

  // Handle Stripe Connect onboarding return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const onboardingStatus = params.get('stripe_onboarding');

    if (onboardingStatus === 'success') {
      toast({
        title: "Success",
        description: "Stripe Connect onboarding completed! Your e-transfer payment method is now active.",
      });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      // Redirect to Payment Methods tab
      setActiveTab("settings");
    } else if (onboardingStatus === 'refresh') {
      setErrorDialog({
        open: true,
        title: "Setup Incomplete",
        description: "Stripe Connect onboarding was not completed. Please try again.",
      });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Fetch payment methods
  const { data: paymentMethods } = useQuery<PaymentMethod[]>({
    queryKey: ["/api/payment-settings"],
    enabled: isAuthenticated,
  });

  // Fetch platform fee settings
  const { data: feeSettings } = useQuery<{
    platformFeePercentage: number;
    platformFeeDisplay: string;
    stripeFeePercentage: number;
    stripeFeeDisplay: string;
    totalFeePercentage: number;
    totalFeeDisplay: string;
  }>({
    queryKey: ["/api/platform/fees"],
  });

  const platformFeeDisplay = feeSettings?.platformFeeDisplay ?? "4%";
  const stripeFeeDisplay = feeSettings?.stripeFeeDisplay ?? "3%";

  // Fetch payments based on user role
  const { data: creatorPayments = [] } = useQuery<CreatorPayment[]>({
    queryKey: ["/api/payments/creator"],
    enabled: isAuthenticated && user?.role === "creator",
  });

  const { data: companyPayments = [] } = useQuery<CreatorPayment[]>({
    queryKey: ["/api/payments/company"],
    enabled: isAuthenticated && user?.role === "company",
  });

  const { data: allPayments = [] } = useQuery<CreatorPayment[]>({
    queryKey: ["/api/payments/all"],
    enabled: isAuthenticated && user?.role === "admin",
  });

  const addPaymentMethodMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string> = { payoutMethod };

      // For e-transfer, we need to set up Stripe Connect first
      if (payoutMethod === "etransfer") {
        payload.payoutEmail = payoutEmail;

        // Step 1: Create Stripe Connect account
        const accountRes = await apiRequest("POST", "/api/stripe-connect/create-account");
        const accountData = await accountRes.json();

        if (!accountData.success || !accountData.accountId) {
          throw new Error(accountData.error || "Failed to create Stripe Connect account");
        }

        // Step 2: Save the stripeAccountId with payment settings
        payload.stripeAccountId = accountData.accountId;

        // Save payment settings first
        const res = await apiRequest("POST", "/api/payment-settings", payload);
        const result = await res.json();

        // Step 3: Redirect to Stripe onboarding
        // Use the correct route based on user role
        const paymentSettingsPath = user?.role === 'creator'
          ? '/creator/payment-settings'
          : user?.role === 'company'
            ? '/company/payment-settings'
            : '/payment-settings';
        const onboardingRes = await apiRequest("POST", "/api/stripe-connect/onboarding-link", {
          accountId: accountData.accountId,
          returnUrl: `${window.location.origin}${paymentSettingsPath}?stripe_onboarding=success`,
          refreshUrl: `${window.location.origin}${paymentSettingsPath}?stripe_onboarding=refresh`,
        });
        const onboardingData = await onboardingRes.json();

        if (!onboardingData.success || !onboardingData.url) {
          throw new Error(onboardingData.error || "Failed to create onboarding link");
        }

        // Redirect user to Stripe onboarding
        window.location.href = onboardingData.url;
        return result;
      } else if (payoutMethod === "wire") {
        payload.bankRoutingNumber = bankRoutingNumber;
        payload.bankAccountNumber = bankAccountNumber;
      } else if (payoutMethod === "paypal") {
        payload.paypalEmail = paypalEmail;
      } else if (payoutMethod === "crypto") {
        payload.cryptoWalletAddress = cryptoWalletAddress;
        payload.cryptoNetwork = cryptoNetwork;
      }

      const res = await apiRequest("POST", "/api/payment-settings", payload);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-settings"] });
      toast({
        title: "Success",
        description: "Payment method added successfully",
      });
      // Reset all form fields
      setPayoutMethod("etransfer");
      setPayoutEmail("");
      setBankRoutingNumber("");
      setBankAccountNumber("");
      setPaypalEmail("");
      setCryptoWalletAddress("");
      setCryptoNetwork("");
      // Increment form reset key to force remount of child components with internal state
      setFormResetKey(prev => prev + 1);
      // Redirect to Payment Methods tab
      setActiveTab("settings");
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        setErrorDialog({
          open: true,
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to add payment method",
      });
    },
  });

  const deletePaymentMethodMutation = useMutation({
    mutationFn: async (paymentMethodId: number) => {
      const res = await apiRequest("DELETE", `/api/payment-settings/${paymentMethodId}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-settings"] });
      toast({
        title: "Success",
        description: "Payment method deleted successfully",
      });
      setDeleteDialogOpen(false);
      setPaymentMethodToDelete(null);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        setErrorDialog({
          open: true,
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to delete payment method",
      });
    },
  });

  const handleDeleteClick = (method: PaymentMethod) => {
    setPaymentMethodToDelete(method);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (paymentMethodToDelete) {
      deletePaymentMethodMutation.mutate(paymentMethodToDelete.id);
    }
  };

  const setPrimaryPaymentMethodMutation = useMutation({
    mutationFn: async (paymentMethodId: number) => {
      const res = await apiRequest("PUT", `/api/payment-settings/${paymentMethodId}/set-primary`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-settings"] });
      toast({
        title: "Success",
        description: "Primary payment method updated successfully",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        setErrorDialog({
          open: true,
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to set primary payment method",
      });
    },
  });

  const handleSetPrimary = (method: PaymentMethod) => {
    setPrimaryPaymentMethodMutation.mutate(method.id);
  };

  // Upgrade existing e-transfer payment method with Stripe Connect
  const upgradeETransferMutation = useMutation({
    mutationFn: async (paymentMethod: PaymentMethod) => {
      // Step 1: Create Stripe Connect account
      const accountRes = await apiRequest("POST", "/api/stripe-connect/create-account");
      const accountData = await accountRes.json();

      if (!accountData.success || !accountData.accountId) {
        throw new Error(accountData.error || "Failed to create Stripe Connect account");
      }

      // Step 2: Update the existing payment setting with stripeAccountId
      const updateRes = await apiRequest("PUT", `/api/payment-settings/${paymentMethod.id}`, {
        stripeAccountId: accountData.accountId,
      });
      await updateRes.json();

      // Step 3: Get onboarding link and redirect
      const onboardingRes = await apiRequest("POST", "/api/stripe-connect/onboarding-link", {
        accountId: accountData.accountId,
        returnUrl: `${window.location.origin}/settings/payment?stripe_onboarding=success`,
        refreshUrl: `${window.location.origin}/settings/payment?stripe_onboarding=refresh`,
      });
      const onboardingData = await onboardingRes.json();

      if (!onboardingData.success || !onboardingData.url) {
        throw new Error(onboardingData.error || "Failed to create onboarding link");
      }

      // Redirect to Stripe onboarding
      window.location.href = onboardingData.url;
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        setErrorDialog({
          open: true,
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to upgrade e-transfer payment method",
      });
    },
  });

  const handleUpgradeETransfer = (method: PaymentMethod) => {
    upgradeETransferMutation.mutate(method);
  };

  // Wire/ACH verification mutations
  const createWireBankAccountMutation = useMutation({
    mutationFn: async (paymentMethod: PaymentMethod) => {
      const res = await apiRequest("POST", "/api/wire-ach/create-bank-account", {
        paymentSettingId: paymentMethod.id,
        routingNumber: paymentMethod.bankRoutingNumber,
        accountNumber: paymentMethod.bankAccountNumber,
        accountHolderName: paymentMethod.bankAccountHolderName || user?.firstName + " " + user?.lastName,
        accountHolderType: paymentMethod.bankAccountHolderType || "individual",
        accountType: paymentMethod.bankAccountType || "checking",
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/payment-settings"] });
        if (data.verificationMethod === "micro_deposits") {
          toast({
            title: "Verification Started",
            description: "Two small deposits will be sent to your account within 1-2 business days. You'll need to verify these amounts.",
          });
        } else if (data.verified) {
          toast({
            title: "Bank Account Verified",
            description: "Your bank account has been instantly verified and is ready to receive payouts.",
          });
        }
      } else {
        setErrorDialog({
          open: true,
          title: "Verification Failed",
          description: data.error || "Failed to start bank account verification",
        });
      }
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to create bank account",
      });
    },
  });

  const verifyMicroDepositsMutation = useMutation({
    mutationFn: async ({ paymentSettingId, bankAccountId, amount1, amount2 }: { paymentSettingId: number; bankAccountId: string; amount1: number; amount2: number }) => {
      const res = await apiRequest("POST", "/api/wire-ach/verify-micro-deposits", {
        paymentSettingId,
        bankAccountId,
        amount1,
        amount2,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setMicroDepositsModalOpen(false);
      setMicroDepositAmount1("");
      setMicroDepositAmount2("");
      setVerifyingPaymentMethod(null);
      if (data.success && data.verified) {
        queryClient.invalidateQueries({ queryKey: ["/api/payment-settings"] });
        toast({
          title: "Bank Account Verified",
          description: "Your bank account has been verified and is now ready to receive payouts.",
        });
      } else {
        setErrorDialog({
          open: true,
          title: "Verification Failed",
          description: data.error || "The amounts you entered do not match. Please check and try again.",
        });
      }
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to verify micro-deposits",
      });
    },
  });

  const handleVerifyWireAccount = (method: PaymentMethod) => {
    createWireBankAccountMutation.mutate(method);
  };

  const handleVerifyMicroDeposits = (method: PaymentMethod) => {
    setVerifyingPaymentMethod(method);
    setMicroDepositsModalOpen(true);
  };

  const submitMicroDeposits = () => {
    if (!verifyingPaymentMethod) return;

    // Check if stripeBankAccountId exists
    if (!verifyingPaymentMethod.stripeBankAccountId) {
      setErrorDialog({
        open: true,
        title: "Bank Account Not Set Up",
        description: "Please click 'Verify Account' first to set up your bank account with Stripe before verifying micro-deposits.",
      });
      return;
    }

    const amount1 = parseFloat(microDepositAmount1);
    const amount2 = parseFloat(microDepositAmount2);
    if (isNaN(amount1) || isNaN(amount2) || amount1 <= 0 || amount2 <= 0) {
      setErrorDialog({
        open: true,
        title: "Invalid Amounts",
        description: "Please enter valid deposit amounts (in cents, e.g., 32 for $0.32)",
      });
      return;
    }
    verifyMicroDepositsMutation.mutate({
      paymentSettingId: verifyingPaymentMethod.id,
      bankAccountId: verifyingPaymentMethod.stripeBankAccountId,
      amount1,
      amount2,
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const role: User["role"] = user.role;

  // Calculate payment statistics for mobile view
  const creatorPaymentStats = useMemo(() => {
    return creatorPayments.reduce(
      (acc, payment) => {
        const amount = parseFloat(payment.netAmount);
        const disputed = isDisputedPayment(payment);

        if (disputed) {
          acc.disputedEarnings += amount;
          return acc;
        }

        acc.totalEarnings += amount;

        if (payment.status === "completed") {
          acc.completedEarnings += amount;
        }
        if (payment.status === "pending") {
          acc.pendingEarnings += amount;
        }
        if (payment.status === "processing") {
          acc.processingEarnings += amount;
        }
        return acc;
      },
      { totalEarnings: 0, pendingEarnings: 0, completedEarnings: 0, processingEarnings: 0, disputedEarnings: 0 }
    );
  }, [creatorPayments]);

  // Helper to get payment method display info for mobile
  const getPaymentMethodInfo = (method: PaymentMethod) => {
    const isConnected = method.payoutMethod === 'etransfer'
      ? !!method.stripeAccountId
      : method.payoutMethod === 'wire'
        ? method.bankVerificationStatus === 'verified'
        : true;

    let icon = CreditCard;
    let title = method.payoutMethod.replace("_", " ");
    let description = "";
    let displayValue = "";

    if (method.payoutMethod === "etransfer") {
      icon = Landmark;
      title = "Direct Deposit";
      description = "Receive payments directly to your bank account. Fast and secure.";
      displayValue = method.bankAccountNumber ? `****${method.bankAccountNumber.slice(-4)}` : method.payoutEmail || "";
    } else if (method.payoutMethod === "wire") {
      icon = Landmark;
      title = "Wire/ACH Transfer";
      description = "Bank wire transfer for larger payments.";
      displayValue = method.bankAccountNumber ? `****${method.bankAccountNumber.slice(-4)}` : "";
    } else if (method.payoutMethod === "paypal") {
      icon = CreditCard;
      title = "PayPal";
      description = "Get paid securely through your PayPal account.";
      displayValue = method.paypalEmail || "";
    } else if (method.payoutMethod === "crypto") {
      icon = DollarSign;
      title = "Cryptocurrency";
      description = "Receive payments in crypto.";
      displayValue = method.cryptoWalletAddress ? `${method.cryptoWalletAddress.slice(0, 8)}...` : "";
    }

    return { icon, title, description, displayValue, isConnected, isDefault: method.isDefault };
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <TopNavBar />

      {/* ========== MOBILE LAYOUT FOR CREATORS ========== */}
      {role === "creator" && (
        <div className="md:hidden space-y-4 pb-4">
          {/* Mobile Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/creator/dashboard">
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              </Link>
              <h1 className="text-xl font-bold text-gray-900">Payment Management</h1>
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <SlidersHorizontal className="h-5 w-5" />
            </Button>
          </div>

          {/* Mobile Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${
                activeTab === "overview"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-500"
              }`}
            >
              Payout History
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${
                activeTab === "settings"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-500"
              }`}
            >
              Payment Methods
            </button>
          </div>

          {/* Mobile Payout History Tab */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* Payout Status Breakdown */}
              <div className="space-y-3">
                <div>
                  <h3 className="font-bold text-gray-900">Payout Status Breakdown</h3>
                  <p className="text-xs text-gray-500">
                    See where every creator payout sits: awaiting admin approval, processing, or fully paid.
                  </p>
                </div>

                {/* Total Earnings Badge */}
                <button className="w-full flex items-center justify-between py-3 px-4 bg-white rounded-lg border border-gray-200">
                  <span className="text-sm text-gray-600">Total:</span>
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-gray-900">CA${creatorPaymentStats.totalEarnings.toFixed(2)}</span>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </button>

                {/* Status Cards - 2x2 Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Pending Admin Approval */}
                  <div className="rounded-xl border-2 border-yellow-200 bg-yellow-50 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-yellow-700">Pending Admin Approval</span>
                    </div>
                    <div className="text-xl font-bold text-yellow-900">CA${creatorPaymentStats.pendingEarnings.toFixed(2)}</div>
                    <div className="text-[10px] text-yellow-700 mt-1">Company approved, awaiting admin</div>
                  </div>

                  {/* Processing Payment */}
                  <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-blue-700">Processing Payment</span>
                    </div>
                    <div className="text-xl font-bold text-blue-900">CA${creatorPaymentStats.processingEarnings.toFixed(2)}</div>
                    <div className="text-[10px] text-blue-700 mt-1">Payment in progress</div>
                  </div>

                  {/* Total Paid Out */}
                  <div className="rounded-xl border-2 border-gray-200 bg-white p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-600">Total Paid Out</span>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </div>
                    <div className="text-xl font-bold text-gray-900">CA${creatorPaymentStats.completedEarnings.toFixed(2)}</div>
                    <div className="text-[10px] text-gray-500 mt-1">Lifetime completed payouts</div>
                  </div>

                  {/* All Earnings */}
                  <div className="rounded-xl bg-gradient-to-br from-green-500 to-green-600 p-4 text-white">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-green-100">All Earnings</span>
                      <DollarSign className="h-4 w-4 text-green-100" />
                    </div>
                    <div className="text-xl font-bold">CA${creatorPaymentStats.totalEarnings.toFixed(2)}</div>
                    <div className="text-[10px] text-green-100 mt-1">Including pending & processing</div>
                  </div>
                </div>

                {/* Disputed Earnings (if any) */}
                {creatorPaymentStats.disputedEarnings > 0 && (
                  <div className="rounded-xl border-2 border-orange-300 bg-orange-50 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-orange-700">Disputed</span>
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                    </div>
                    <div className="text-xl font-bold text-orange-900">CA${creatorPaymentStats.disputedEarnings.toFixed(2)}</div>
                    <div className="text-[10px] text-orange-700 mt-1">Awaiting admin resolution</div>
                  </div>
                )}
              </div>

              {/* Payment History Section */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                  <h3 className="font-bold text-gray-900">Payment History</h3>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                    <Download className="h-3.5 w-3.5" />
                    Export CSV
                  </Button>
                </div>

                {creatorPayments.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="mx-auto w-16 h-16 mb-4 flex items-center justify-center">
                      <div className="relative">
                        <div className="w-12 h-10 bg-yellow-100 rounded-lg" />
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                          <DollarSign className="h-3 w-3 text-green-600" />
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500">No payment history yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {creatorPayments.slice(0, 5).map((payment) => (
                      <Link key={payment.id} href={`/payments/${payment.id}`}>
                        <div className="p-4 hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {payment.description || "Payment"}
                              </p>
                              <p className="text-xs text-gray-500">
                                {payment.completedAt
                                  ? new Date(payment.completedAt).toLocaleDateString()
                                  : new Date(payment.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-green-600">
                                CA${parseFloat(payment.netAmount).toFixed(2)}
                              </p>
                              <StatusBadge status={payment.status} isDisputed={isDisputedPayment(payment)} />
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Export CSV Button at bottom */}
              <Button variant="outline" className="w-full h-11 gap-2">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          )}

          {/* Mobile Payment Methods Tab */}
          {activeTab === "settings" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Manage your payout methods to receive payments easily.
              </p>

              {/* Payment Method Cards */}
              {paymentMethods && paymentMethods.length > 0 ? (
                <div className="space-y-4">
                  {paymentMethods.map((method) => {
                    const info = getPaymentMethodInfo(method);
                    const IconComponent = info.icon;
                    const needsSetup = method.payoutMethod === 'etransfer' && !method.stripeAccountId;
                    const needsWireVerification = method.payoutMethod === 'wire' && method.bankVerificationStatus !== 'verified';
                    const isWirePending = method.payoutMethod === 'wire' &&
                      method.bankVerificationStatus === 'pending' &&
                      !!method.stripeBankAccountId;

                    return (
                      <div key={method.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                        {/* Header Row */}
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            method.payoutMethod === 'paypal' ? 'bg-blue-100' : 'bg-green-100'
                          }`}>
                            {method.payoutMethod === 'paypal' ? (
                              <span className="text-blue-600 font-bold text-sm">P</span>
                            ) : (
                              <IconComponent className={`h-5 w-5 ${method.payoutMethod === 'paypal' ? 'text-blue-600' : 'text-green-600'}`} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-gray-900">{info.title}</h4>
                              {info.isDefault && (
                                <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">Primary</Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{info.description}</p>
                          </div>
                        </div>

                        {/* Display Value */}
                        {info.displayValue && (
                          <p className="text-sm text-gray-700 font-mono">{info.displayValue}</p>
                        )}

                        {/* Status and Actions */}
                        {needsSetup ? (
                          <Button
                            onClick={() => handleUpgradeETransfer(method)}
                            className="w-full bg-yellow-600 hover:bg-yellow-700"
                          >
                            Complete Setup
                          </Button>
                        ) : needsWireVerification && !isWirePending ? (
                          <Button
                            onClick={() => handleVerifyWireAccount(method)}
                            className="w-full bg-yellow-600 hover:bg-yellow-700"
                          >
                            Start Verification
                          </Button>
                        ) : isWirePending ? (
                          <Button
                            onClick={() => handleVerifyMicroDeposits(method)}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                          >
                            Verify Amounts
                          </Button>
                        ) : info.isConnected ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 flex items-center gap-2 bg-green-100 text-green-700 rounded-lg px-3 py-2 text-sm font-medium">
                              <CheckCircle className="h-4 w-4" />
                              Connected
                            </div>
                            <Button variant="outline" size="sm" className="gap-1">
                              Edit <ChevronRight className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button className="w-full">
                            Connect
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                  <DollarSign className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                  <p className="text-gray-600">No payment methods yet</p>
                  <p className="mt-1 text-sm text-gray-500">Add a payment method to receive payouts</p>
                </div>
              )}

              {/* Add Payment Method Section */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
                <h3 className="font-bold text-gray-900">Add Payment Method</h3>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">Payout Method</Label>
                    <Select value={payoutMethod} onValueChange={setPayoutMethod}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="etransfer">E-Transfer</SelectItem>
                        <SelectItem value="wire">Wire/ACH</SelectItem>
                        <SelectItem value="paypal">PayPal</SelectItem>
                        <SelectItem value="crypto">Cryptocurrency</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {payoutMethod === "etransfer" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-500">Email</Label>
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        value={payoutEmail}
                        onChange={(e) => setPayoutEmail(e.target.value)}
                        className="h-11"
                      />
                    </div>
                  )}

                  {payoutMethod === "paypal" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-500">PayPal Email</Label>
                      <Input
                        type="email"
                        placeholder="your@paypal.com"
                        value={paypalEmail}
                        onChange={(e) => setPaypalEmail(e.target.value)}
                        className="h-11"
                      />
                    </div>
                  )}

                  <Button
                    onClick={() => addPaymentMethodMutation.mutate()}
                    disabled={addPaymentMethodMutation.isPending ||
                      (payoutMethod === "etransfer" && !payoutEmail) ||
                      (payoutMethod === "paypal" && !paypalEmail)}
                    className="w-full h-11"
                  >
                    {addPaymentMethodMutation.isPending ? "Adding..." : "Add Payment Method"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========== DESKTOP LAYOUT ========== */}
      <div className="mx-auto max-w-7xl space-y-6 hidden md:block">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Payment Management</h1>
          <p className="mt-1 text-gray-600">Manage your payments and payouts</p>
        </div>

        {role === "creator" && (
          <>
            <div className="overflow-hidden rounded-xl border-2 border-gray-200 bg-white">
              <div className="flex overflow-x-auto border-b border-gray-200">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`whitespace-nowrap px-3 sm:px-6 py-3 sm:py-4 text-sm font-medium transition-colors ${
                    activeTab === "overview"
                      ? "border-b-2 border-blue-600 text-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Payment History
                </button>
                <button
                  onClick={() => setActiveTab("settings")}
                  className={`whitespace-nowrap px-3 sm:px-6 py-3 sm:py-4 text-sm font-medium transition-colors ${
                    activeTab === "settings"
                      ? "border-b-2 border-blue-600 text-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Payment Methods
                </button>
            </div>
          </div>
          {activeTab === "overview" && <CreatorOverview payments={creatorPayments} />}
          {activeTab === "settings" && (
            <PaymentMethodSettings
              paymentMethods={paymentMethods}
              payoutMethod={payoutMethod}
              setPayoutMethod={setPayoutMethod}
              payoutEmail={payoutEmail}
              setPayoutEmail={setPayoutEmail}
                bankRoutingNumber={bankRoutingNumber}
                setBankRoutingNumber={setBankRoutingNumber}
                bankAccountNumber={bankAccountNumber}
                setBankAccountNumber={setBankAccountNumber}
                paypalEmail={paypalEmail}
                setPaypalEmail={setPaypalEmail}
              cryptoWalletAddress={cryptoWalletAddress}
              setCryptoWalletAddress={setCryptoWalletAddress}
              cryptoNetwork={cryptoNetwork}
              setCryptoNetwork={setCryptoNetwork}
              onAddPaymentMethod={() => addPaymentMethodMutation.mutate()}
              onDeletePaymentMethod={handleDeleteClick}
              onSetPrimary={handleSetPrimary}
              onUpgradeETransfer={handleUpgradeETransfer}
              onVerifyWireAccount={handleVerifyWireAccount}
              onVerifyMicroDeposits={handleVerifyMicroDeposits}
              isSubmitting={addPaymentMethodMutation.isPending}
              formResetKey={formResetKey}
            />
          )}
        </>
      )}

        {role === "company" && (
          <>
            <div className="overflow-hidden rounded-xl border-2 border-gray-200 bg-white">
              <div className="flex overflow-x-auto border-b border-gray-200">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`whitespace-nowrap px-3 sm:px-6 py-3 sm:py-4 text-sm font-medium transition-colors ${
                    activeTab === "overview"
                      ? "border-b-2 border-blue-600 text-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab("settings")}
                  className={`whitespace-nowrap px-3 sm:px-6 py-3 sm:py-4 text-sm font-medium transition-colors ${
                    activeTab === "settings"
                      ? "border-b-2 border-blue-600 text-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Payment Methods
                </button>
                <button
                  onClick={() => setActiveTab("approvals")}
                  className={`relative whitespace-nowrap px-3 sm:px-6 py-3 sm:py-4 text-sm font-medium transition-colors ${
                    activeTab === "approvals"
                      ? "border-b-2 border-blue-600 text-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Pending Approvals
                  {companyPayments.filter((p) => p.status === "pending" || p.status === "processing").length > 0 && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-800">
                      {companyPayments.filter((p) => p.status === "pending" || p.status === "processing").length}
                    </span>
                  )}
                </button>
              </div>
            </div>
            {activeTab === "overview" && <CompanyOverview payouts={companyPayments} />}
            {activeTab === "settings" && (
              <PaymentMethodSettings
                paymentMethods={paymentMethods}
                payoutMethod={payoutMethod}
                setPayoutMethod={setPayoutMethod}
                payoutEmail={payoutEmail}
                setPayoutEmail={setPayoutEmail}
                bankRoutingNumber={bankRoutingNumber}
                setBankRoutingNumber={setBankRoutingNumber}
                bankAccountNumber={bankAccountNumber}
                setBankAccountNumber={setBankAccountNumber}
                paypalEmail={paypalEmail}
                setPaypalEmail={setPaypalEmail}
                cryptoWalletAddress={cryptoWalletAddress}
                setCryptoWalletAddress={setCryptoWalletAddress}
                cryptoNetwork={cryptoNetwork}
                setCryptoNetwork={setCryptoNetwork}
                onAddPaymentMethod={() => addPaymentMethodMutation.mutate()}
                onDeletePaymentMethod={handleDeleteClick}
                onSetPrimary={handleSetPrimary}
                onVerifyWireAccount={handleVerifyWireAccount}
                onVerifyMicroDeposits={handleVerifyMicroDeposits}
                isSubmitting={addPaymentMethodMutation.isPending}
                formResetKey={formResetKey}
                emptyDescription="Add a payment method to fund creator payouts"
                showFeeBreakdown={false}
              />
            )}
            {activeTab === "approvals" && <CompanyPayoutApproval payouts={companyPayments} />}
          </>
        )}

        {role === "admin" && (
          <>
            <div className="overflow-hidden rounded-xl border-2 border-gray-200 bg-white">
              <div className="flex overflow-x-auto border-b border-gray-200">
                <button
                  onClick={() => setActiveTab("dashboard")}
                  className={`whitespace-nowrap px-3 sm:px-6 py-3 sm:py-4 text-sm font-medium transition-colors ${
                    activeTab === "dashboard"
                      ? "border-b-2 border-blue-600 text-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Platform Dashboard
                </button>
                <button
                  onClick={() => setActiveTab("settings")}
                  className={`whitespace-nowrap px-3 sm:px-6 py-3 sm:py-4 text-sm font-medium transition-colors ${
                    activeTab === "settings"
                      ? "border-b-2 border-blue-600 text-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Payment Settings
                </button>
              </div>
            </div>
            {activeTab === "dashboard" && (
              <AdminPaymentDashboard payments={allPayments} />
            )}
            {activeTab === "settings" && <AdminPaymentSettings />}
          </>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment Method</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payment method?
              {paymentMethodToDelete?.isDefault && (
                <span className="mt-2 block text-yellow-600 font-medium">
                  This is your primary payment method. Another payment method will be automatically set as primary.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletePaymentMethodMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Micro-deposits verification modal */}
      <AlertDialog open={microDepositsModalOpen} onOpenChange={setMicroDepositsModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Verify Bank Account</AlertDialogTitle>
            <AlertDialogDescription>
              Enter the two small deposit amounts that were sent to your bank account.
              The amounts are in cents (e.g., enter 32 for $0.32).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="deposit1">First Deposit Amount (cents)</Label>
              <Input
                id="deposit1"
                type="number"
                placeholder="e.g., 32"
                value={microDepositAmount1}
                onChange={(e) => setMicroDepositAmount1(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deposit2">Second Deposit Amount (cents)</Label>
              <Input
                id="deposit2"
                type="number"
                placeholder="e.g., 45"
                value={microDepositAmount2}
                onChange={(e) => setMicroDepositAmount2(e.target.value)}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setMicroDepositsModalOpen(false);
              setMicroDepositAmount1("");
              setMicroDepositAmount2("");
              setVerifyingPaymentMethod(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={submitMicroDeposits}
              disabled={verifyMicroDepositsMutation.isPending}
            >
              {verifyMicroDepositsMutation.isPending ? "Verifying..." : "Verify"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GenericErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
        title={errorDialog.title}
        description={errorDialog.description}
        variant="error"
      />
    </div>
  );
}
