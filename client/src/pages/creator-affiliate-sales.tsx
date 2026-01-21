import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from "date-fns";
import {
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  RotateCcw,
} from "lucide-react";

interface AffiliateSale {
  id: string;
  applicationId: string;
  offerId: string;
  creatorId: string;
  companyId: string;
  externalOrderId: string;
  externalPlatform: string | null;
  orderAmount: string;
  orderCurrency: string;
  itemName: string | null;
  itemQuantity: number;
  commissionType: string;
  commissionRate: string | null;
  commissionAmount: string;
  orderStatus: string;
  statusHistory: Array<{ status: string; timestamp: string; note?: string }>;
  holdPeriodDays: number;
  holdExpiresAt: string | null;
  paymentId: string | null;
  commissionReleased: boolean;
  commissionReleasedAt: string | null;
  customerEmail: string | null;
  trackingCode: string | null;
  createdAt: string;
  updatedAt: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode; description: string }> = {
  pending: {
    label: "Pending",
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
    icon: <Clock className="h-4 w-4" />,
    description: "Order placed, awaiting processing",
  },
  processing: {
    label: "Processing",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: <Package className="h-4 w-4" />,
    description: "Order is being prepared",
  },
  shipped: {
    label: "Shipped",
    color: "bg-indigo-100 text-indigo-800 border-indigo-200",
    icon: <Truck className="h-4 w-4" />,
    description: "Order has been shipped",
  },
  delivered: {
    label: "Delivered",
    color: "bg-teal-100 text-teal-800 border-teal-200",
    icon: <CheckCircle className="h-4 w-4" />,
    description: "Order delivered, in hold period",
  },
  completed: {
    label: "Completed",
    color: "bg-green-100 text-green-800 border-green-200",
    icon: <CheckCircle className="h-4 w-4" />,
    description: "Order complete, commission released!",
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-red-100 text-red-800 border-red-200",
    icon: <XCircle className="h-4 w-4" />,
    description: "Order was cancelled by customer or seller",
  },
  returned: {
    label: "Returned",
    color: "bg-orange-100 text-orange-800 border-orange-200",
    icon: <RotateCcw className="h-4 w-4" />,
    description: "Customer returned the item",
  },
  refunded: {
    label: "Refunded",
    color: "bg-gray-100 text-gray-800 border-gray-200",
    icon: <AlertTriangle className="h-4 w-4" />,
    description: "Order was refunded",
  },
};

const commissionStatusConfig: Record<string, { label: string; color: string }> = {
  pending: {
    label: "Processing Payment",
    color: "bg-yellow-100 text-yellow-800",
  },
  released: {
    label: "Commission Released",
    color: "bg-green-100 text-green-800",
  },
  cancelled: {
    label: "Commission Cancelled",
    color: "bg-red-100 text-red-800",
  },
};

function getCommissionStatus(sale: AffiliateSale): { label: string; color: string } {
  if (sale.commissionReleased) {
    return commissionStatusConfig.released;
  }
  if (['cancelled', 'returned', 'refunded'].includes(sale.orderStatus)) {
    return commissionStatusConfig.cancelled;
  }
  return commissionStatusConfig.pending;
}

function getFailureReason(sale: AffiliateSale): string | null {
  if (sale.orderStatus === 'cancelled') {
    return "Order was cancelled";
  }
  if (sale.orderStatus === 'returned') {
    return "Customer returned the item";
  }
  if (sale.orderStatus === 'refunded') {
    return "Order was refunded";
  }
  return null;
}

export default function CreatorAffiliateSales() {
  const { data: sales, isLoading } = useQuery<AffiliateSale[]>({
    queryKey: ["/api/affiliate-sales"],
  });

  // Calculate summary stats
  const totalSales = sales?.length || 0;
  const totalItems = sales?.reduce((sum, sale) => sum + (sale.itemQuantity || 1), 0) || 0;
  const totalCommission = sales?.reduce((sum, sale) => sum + parseFloat(sale.commissionAmount), 0) || 0;
  const releasedCommission = sales?.filter(s => s.commissionReleased).reduce((sum, sale) => sum + parseFloat(sale.commissionAmount), 0) || 0;
  const pendingCommission = sales?.filter(s => !s.commissionReleased && !['cancelled', 'returned', 'refunded'].includes(s.orderStatus)).reduce((sum, sale) => sum + parseFloat(sale.commissionAmount), 0) || 0;
  const completedOrders = sales?.filter(s => s.orderStatus === 'completed').length || 0;
  const failedOrders = sales?.filter(s => ['cancelled', 'returned', 'refunded'].includes(s.orderStatus)).length || 0;

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Affiliate Sales</h1>
        <p className="text-muted-foreground">Track your sales and commission status</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSales}</div>
            <p className="text-xs text-muted-foreground">
              {totalItems} items sold
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Commission</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">CA${totalCommission.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Lifetime earnings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Released</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">CA${releasedCommission.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {completedOrders} completed orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <TrendingUp className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">CA${pendingCommission.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting order completion
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sales Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sales History</CardTitle>
          <CardDescription>
            View all your affiliate sales and their current status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!sales || sales.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No sales yet</h3>
              <p className="text-muted-foreground">
                When customers buy through your affiliate links, sales will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead>Order Amount</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Order Status</TableHead>
                    <TableHead>Payment Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => {
                    const status = statusConfig[sale.orderStatus] || statusConfig.pending;
                    const commissionStatus = getCommissionStatus(sale);
                    const failureReason = getFailureReason(sale);

                    return (
                      <TableRow key={sale.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(sale.createdAt), "MMM d, yyyy")}
                          <br />
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(sale.createdAt), "h:mm a")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[200px]">
                            <p className="font-medium truncate">
                              {sale.itemName || "Product"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              Order: {sale.externalOrderId}
                            </p>
                            {sale.externalPlatform && (
                              <p className="text-xs text-muted-foreground">
                                via {sale.externalPlatform}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{sale.itemQuantity || 1}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">
                            {sale.orderCurrency || 'CA'}${parseFloat(sale.orderAmount).toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="font-medium text-green-600">
                              CA${parseFloat(sale.commissionAmount).toFixed(2)}
                            </span>
                            <br />
                            <span className="text-xs text-muted-foreground">
                              {sale.commissionType === 'percentage'
                                ? `${sale.commissionRate}%`
                                : `CA$${sale.commissionRate} flat`}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge className={`${status.color} border flex items-center gap-1 cursor-help`}>
                                  {status.icon}
                                  {status.label}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{status.description}</p>
                                {failureReason && (
                                  <p className="text-red-400 mt-1">
                                    Reason: {failureReason}
                                  </p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {/* Show failure reason below badge */}
                          {failureReason && (
                            <p className="text-xs text-red-500 mt-1">
                              {failureReason}
                            </p>
                          )}

                          {/* Show hold period info for delivered orders */}
                          {sale.orderStatus === 'delivered' && sale.holdExpiresAt && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Hold until: {format(new Date(sale.holdExpiresAt), "MMM d")}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={commissionStatus.color}>
                            {commissionStatus.label}
                          </Badge>

                          {/* Show release date if released */}
                          {sale.commissionReleased && sale.commissionReleasedAt && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Released: {format(new Date(sale.commissionReleasedAt), "MMM d")}
                            </p>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Order Status Guide</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(statusConfig).map(([key, config]) => (
              <div key={key} className="flex items-start gap-2">
                <Badge className={`${config.color} border flex items-center gap-1`}>
                  {config.icon}
                  {config.label}
                </Badge>
              </div>
            ))}
          </div>
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <h4 className="font-medium mb-2">How Commission Works:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>1. When a customer buys via your link, the sale is recorded as <strong>Pending</strong></li>
              <li>2. As the order progresses (Shipped → Delivered), commission remains in <strong>Processing Payment</strong></li>
              <li>3. After a 14-day hold period (for returns), the order becomes <strong>Completed</strong></li>
              <li>4. Commission is then <strong>Released</strong> to your wallet</li>
              <li>5. If the order is cancelled, returned, or refunded, commission is <strong>Cancelled</strong></li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
