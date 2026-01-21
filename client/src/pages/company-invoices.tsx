import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  CreditCard,
  Loader2,
  ExternalLink,
  DollarSign,
  Calendar,
  User,
} from "lucide-react";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";
import { format } from "date-fns";

interface CompanyInvoice {
  id: string;
  invoiceNumber: string;
  companyId: string;
  creatorId: string;
  paymentId?: string;
  retainerPaymentId?: string;
  grossAmount: string;
  platformFeeAmount: string;
  stripeFeeAmount: string;
  netAmount: string;
  status: "draft" | "sent" | "paid" | "cancelled" | "expired" | "refunded";
  stripeCheckoutSessionId?: string;
  description?: string;
  dueDate?: string;
  sentAt?: string;
  paidAt?: string;
  createdAt: string;
}

export default function CompanyInvoices() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedInvoice, setSelectedInvoice] = useState<CompanyInvoice | null>(null);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");

  // Fetch invoices
  const { data: invoices = [], isLoading } = useQuery<CompanyInvoice[]>({
    queryKey: ["/api/company/invoices"],
  });

  // Pay invoice mutation (for sandbox mode)
  const payInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await apiRequest("POST", `/api/company/invoices/${invoiceId}/simulate-payment`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/invoices"] });
      setShowPayDialog(false);
      setSelectedInvoice(null);
      toast({
        title: "Payment Successful",
        description: "The invoice has been paid and the creator has been notified.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to process payment.",
        variant: "destructive",
      });
    },
  });

  // Get checkout URL mutation
  const getCheckoutUrlMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await apiRequest("POST", `/api/company/invoices/${invoiceId}/checkout`, {});
      return res.json();
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to get payment link.",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200"><FileText className="w-3 h-3 mr-1" /> Draft</Badge>;
      case "sent":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" /> Awaiting Payment</Badge>;
      case "paid":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" /> Paid</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200"><XCircle className="w-3 h-3 mr-1" /> Cancelled</Badge>;
      case "expired":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><AlertCircle className="w-3 h-3 mr-1" /> Expired</Badge>;
      case "refunded":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><XCircle className="w-3 h-3 mr-1" /> Refunded</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    if (activeTab === "pending") return invoice.status === "sent";
    if (activeTab === "paid") return invoice.status === "paid";
    if (activeTab === "all") return true;
    return invoice.status === activeTab;
  });

  const pendingTotal = invoices
    .filter(i => i.status === "sent")
    .reduce((sum, i) => sum + parseFloat(i.grossAmount), 0);

  const paidTotal = invoices
    .filter(i => i.status === "paid")
    .reduce((sum, i) => sum + parseFloat(i.grossAmount), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
        <p className="text-gray-600 mt-1">Manage creator commission payments</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pending Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">CA${pendingTotal.toFixed(2)}</div>
            <p className="text-sm text-gray-500 mt-1">
              {invoices.filter(i => i.status === "sent").length} invoice(s) awaiting payment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Paid This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">CA${paidTotal.toFixed(2)}</div>
            <p className="text-sm text-gray-500 mt-1">
              {invoices.filter(i => i.status === "paid").length} invoice(s) paid
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{invoices.length}</div>
            <p className="text-sm text-gray-500 mt-1">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">All Invoices</CardTitle>
              <CardDescription>Click on an invoice to view details or make payment</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="pending">
                Pending ({invoices.filter(i => i.status === "sent").length})
              </TabsTrigger>
              <TabsTrigger value="paid">
                Paid ({invoices.filter(i => i.status === "paid").length})
              </TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              {filteredInvoices.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No invoices found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                        <TableCell className="max-w-xs truncate">{invoice.description || "-"}</TableCell>
                        <TableCell className="font-semibold">CA${parseFloat(invoice.grossAmount).toFixed(2)}</TableCell>
                        <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                        <TableCell>{format(new Date(invoice.createdAt), "MMM d, yyyy")}</TableCell>
                        <TableCell className="text-right">
                          {invoice.status === "sent" && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedInvoice(invoice);
                                setShowPayDialog(true);
                              }}
                            >
                              <CreditCard className="w-4 h-4 mr-1" />
                              Pay Now
                            </Button>
                          )}
                          {invoice.status === "paid" && (
                            <Button variant="outline" size="sm" onClick={() => setSelectedInvoice(invoice)}>
                              View
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Pay Invoice Dialog */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pay Invoice</DialogTitle>
            <DialogDescription>
              Review the invoice details and proceed to payment.
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-4 py-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Invoice Number</span>
                  <span className="font-medium">{selectedInvoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Gross Amount</span>
                  <span className="font-medium">CA${parseFloat(selectedInvoice.grossAmount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Platform Fee</span>
                  <span className="text-gray-500">-CA${parseFloat(selectedInvoice.platformFeeAmount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Processing Fee</span>
                  <span className="text-gray-500">-CA${parseFloat(selectedInvoice.stripeFeeAmount).toFixed(2)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="text-gray-600">Creator Receives</span>
                  <span className="font-semibold text-green-600">CA${parseFloat(selectedInvoice.netAmount).toFixed(2)}</span>
                </div>
              </div>

              {selectedInvoice.description && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Description</p>
                  <p className="text-sm">{selectedInvoice.description}</p>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-700">
                  <CreditCard className="w-4 h-4 inline mr-1" />
                  You will be redirected to a secure Stripe checkout page to complete the payment.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowPayDialog(false)}>
              Cancel
            </Button>
            {/* In production, use getCheckoutUrlMutation. For sandbox, use payInvoiceMutation */}
            <Button
              onClick={() => {
                if (selectedInvoice) {
                  // Check if sandbox mode (you'd typically get this from an API or env)
                  payInvoiceMutation.mutate(selectedInvoice.id);
                }
              }}
              disabled={payInvoiceMutation.isPending}
            >
              {payInvoiceMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Pay CA${selectedInvoice ? parseFloat(selectedInvoice.grossAmount).toFixed(2) : "0.00"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
