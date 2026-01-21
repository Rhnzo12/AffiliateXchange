import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  DollarSign,
  TrendingUp,
  CreditCard,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";
import { format } from "date-fns";

interface CreatorWallet {
  id: string;
  creatorId: string;
  availableBalance: string;
  pendingBalance: string;
  totalEarned: string;
  totalWithdrawn: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

interface WalletTransaction {
  id: string;
  walletId: string;
  creatorId: string;
  type: "credit" | "debit" | "withdrawal" | "refund" | "adjustment";
  amount: string;
  balanceAfter: string;
  description: string;
  referenceType: string;
  referenceId: string;
  createdAt: string;
}

interface Withdrawal {
  id: string;
  walletId: string;
  creatorId: string;
  amount: string;
  feeAmount: string;
  netAmount: string;
  payoutMethod: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  providerTransactionId?: string;
  failureReason?: string;
  requestedAt: string;
  completedAt?: string;
  failedAt?: string;
}

interface PaymentSetting {
  id: string;
  payoutMethod: string;
  paypalEmail?: string;
  payoutEmail?: string;
  bankName?: string;
  cryptoNetwork?: string;
  isDefault: boolean;
}

export default function CreatorWallet() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");

  // Fetch wallet data
  const { data: wallet, isLoading: walletLoading } = useQuery<CreatorWallet>({
    queryKey: ["/api/wallet"],
  });

  // Fetch transactions
  const { data: transactions = [], isLoading: transactionsLoading } = useQuery<WalletTransaction[]>({
    queryKey: ["/api/wallet/transactions"],
  });

  // Fetch withdrawals
  const { data: withdrawals = [], isLoading: withdrawalsLoading } = useQuery<Withdrawal[]>({
    queryKey: ["/api/withdrawals"],
  });

  // Fetch payment settings
  const { data: paymentSettings = [] } = useQuery<PaymentSetting[]>({
    queryKey: ["/api/payment-settings"],
  });

  // Withdraw mutation
  const withdrawMutation = useMutation({
    mutationFn: async (data: { amount: number; paymentSettingId?: string }) => {
      const res = await apiRequest("POST", "/api/withdrawals", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawals"] });
      setShowWithdrawDialog(false);
      setWithdrawAmount("");
      toast({
        title: "Withdrawal Requested",
        description: "Your withdrawal request has been submitted for processing.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Withdrawal Failed",
        description: error.message || "Failed to process withdrawal request.",
        variant: "destructive",
      });
    },
  });

  // Cancel withdrawal mutation
  const cancelWithdrawalMutation = useMutation({
    mutationFn: async (withdrawalId: string) => {
      const res = await apiRequest("POST", `/api/withdrawals/${withdrawalId}/cancel`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawals"] });
      toast({
        title: "Withdrawal Cancelled",
        description: "Your withdrawal has been cancelled and refunded to your wallet.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel withdrawal.",
        variant: "destructive",
      });
    },
  });

  const handleWithdraw = () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount.",
        variant: "destructive",
      });
      return;
    }

    withdrawMutation.mutate({
      amount,
      paymentSettingId: selectedPaymentMethod || undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case "processing":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processing</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" /> Completed</Badge>;
      case "failed":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200"><XCircle className="w-3 h-3 mr-1" /> Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "credit":
        return <ArrowDownRight className="w-4 h-4 text-green-500" />;
      case "withdrawal":
      case "debit":
        return <ArrowUpRight className="w-4 h-4 text-red-500" />;
      case "refund":
        return <RefreshCw className="w-4 h-4 text-blue-500" />;
      default:
        return <DollarSign className="w-4 h-4 text-gray-500" />;
    }
  };

  const getPaymentMethodLabel = (method: PaymentSetting) => {
    switch (method.payoutMethod) {
      case "paypal":
        return `PayPal (${method.paypalEmail})`;
      case "etransfer":
        return `E-Transfer (${method.payoutEmail})`;
      case "wire":
        return `Bank Transfer (${method.bankName || "Bank"})`;
      case "crypto":
        return `Crypto (${method.cryptoNetwork})`;
      default:
        return method.payoutMethod;
    }
  };

  const availableBalance = parseFloat(wallet?.availableBalance || "0");
  const minWithdrawal = 10;
  const canWithdraw = availableBalance >= minWithdrawal && paymentSettings.length > 0;

  if (walletLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Wallet</h1>
        <p className="text-gray-600 mt-1">Manage your earnings and withdrawals</p>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-90">Available Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">CA${availableBalance.toFixed(2)}</div>
            <p className="text-sm opacity-75 mt-1">Ready to withdraw</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              CA${parseFloat(wallet?.pendingBalance || "0").toFixed(2)}
            </div>
            <p className="text-sm text-gray-500 mt-1">Awaiting company payment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Earned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              CA${parseFloat(wallet?.totalEarned || "0").toFixed(2)}
            </div>
            <p className="text-sm text-gray-500 mt-1">All time earnings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Withdrawn</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              CA${parseFloat(wallet?.totalWithdrawn || "0").toFixed(2)}
            </div>
            <p className="text-sm text-gray-500 mt-1">Successfully withdrawn</p>
          </CardContent>
        </Card>
      </div>

      {/* Withdraw Button */}
      <div className="mb-8">
        <Card>
          <CardContent className="py-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-lg">Withdraw Funds</h3>
                <p className="text-gray-600 text-sm">
                  Minimum withdrawal: CA${minWithdrawal.toFixed(2)} | No withdrawal fees
                </p>
              </div>
              <div className="flex gap-3">
                {paymentSettings.length === 0 ? (
                  <Link href="/creator/payment-settings">
                    <Button>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Add Payment Method
                    </Button>
                  </Link>
                ) : (
                  <Button
                    onClick={() => setShowWithdrawDialog(true)}
                    disabled={!canWithdraw}
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    Withdraw
                  </Button>
                )}
              </div>
            </div>
            {!canWithdraw && paymentSettings.length > 0 && (
              <p className="text-sm text-amber-600 mt-3">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                Minimum balance of CA${minWithdrawal.toFixed(2)} required to withdraw.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Withdrawals */}
      {withdrawals.filter(w => w.status === "pending" || w.status === "processing").length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Pending Withdrawals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {withdrawals
                .filter(w => w.status === "pending" || w.status === "processing")
                .map((withdrawal) => (
                  <div
                    key={withdrawal.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">CA${parseFloat(withdrawal.amount).toFixed(2)}</p>
                      <p className="text-sm text-gray-600">
                        {withdrawal.payoutMethod} | Requested {format(new Date(withdrawal.requestedAt), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(withdrawal.status)}
                      {withdrawal.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => cancelWithdrawalMutation.mutate(withdrawal.id)}
                          disabled={cancelWithdrawalMutation.isPending}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Transaction History</CardTitle>
          <CardDescription>All wallet activity</CardDescription>
        </CardHeader>
        <CardContent>
          {transactionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No transactions yet</p>
              <p className="text-sm">Your transaction history will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-3 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-gray-100">
                      {getTransactionIcon(tx.type)}
                    </div>
                    <div>
                      <p className="font-medium">{tx.description || tx.type}</p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(tx.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${tx.type === "credit" || tx.type === "refund" ? "text-green-600" : "text-red-600"}`}>
                      {tx.type === "credit" || tx.type === "refund" ? "+" : "-"}CA${parseFloat(tx.amount).toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-500">
                      Balance: CA${parseFloat(tx.balanceAfter).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Withdrawal Dialog */}
      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw Funds</DialogTitle>
            <DialogDescription>
              Enter the amount you want to withdraw. No fees will be charged.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Amount (CAD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="pl-8"
                  min={minWithdrawal}
                  max={availableBalance}
                  step="0.01"
                />
              </div>
              <p className="text-sm text-gray-500">
                Available: CA${availableBalance.toFixed(2)} | Min: CA${minWithdrawal.toFixed(2)}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  {paymentSettings.map((method) => (
                    <SelectItem key={method.id} value={method.id}>
                      {getPaymentMethodLabel(method)}
                      {method.isDefault && " (Default)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-700 font-medium">No Withdrawal Fees</p>
              <p className="text-sm text-green-600">
                You will receive the full amount: CA${parseFloat(withdrawAmount || "0").toFixed(2)}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWithdrawDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleWithdraw}
              disabled={withdrawMutation.isPending || !withdrawAmount || parseFloat(withdrawAmount) < minWithdrawal}
            >
              {withdrawMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Wallet className="w-4 h-4 mr-2" />
                  Withdraw CA${parseFloat(withdrawAmount || "0").toFixed(2)}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
