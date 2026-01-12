import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  DollarSign,
  Users,
  Building2,
  TrendingUp,
  TrendingDown,
  Download,
  FileText,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Activity,
  Server,
  HardDrive,
  Database,
  Clock,
  AlertCircle,
  AlertTriangle,
  Video,
  UserPlus,
  UserMinus,
  Gauge,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { TopNavBar } from "../components/TopNavBar";
import { StatsGridSkeleton, ChartSkeleton } from "../components/skeletons";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import {
  exportAdminFinancialReportPDF,
  exportAdminFinancialReportCSV,
  exportAdminUserReportPDF,
  exportAdminUserReportCSV,
  downloadCSV,
  type AdminFinancialData,
  type AdminUserStats,
} from "../lib/export-utils";

const DATE_RANGES = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "all", label: "All Time" },
];

const PIE_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

type AdminAnalytics = {
  financial: {
    totalRevenue: number;
    listingFees: number;
    platformFees: number;
    processingFees: number;
    // Affiliate breakdown
    affiliatePlatformFees: number;
    affiliateProcessingFees: number;
    affiliatePayouts: number;
    affiliatePendingPayouts: number;
    affiliateCompletedPayouts: number;
    // Retainer breakdown
    retainerPlatformFees: number;
    retainerProcessingFees: number;
    retainerPayouts: number;
    retainerPendingPayouts: number;
    retainerCompletedPayouts: number;
    // Combined totals
    totalPayouts: number;
    pendingPayouts: number;
    completedPayouts: number;
    disputedPayments: number;
    revenueGrowth: number;
    payoutGrowth: number;
    revenueByPeriod: Array<{
      period: string;
      listingFees: number;
      platformFees: number;
      processingFees: number;
      affiliateFees: number;
      retainerFees: number;
      total: number;
    }>;
    payoutsByPeriod: Array<{
      period: string;
      amount: number;
      count: number;
    }>;
    revenueBySource: Array<{
      source: string;
      amount: number;
      type: string;
    }>;
    // Transaction counts
    affiliateTransactionCount: number;
    retainerTransactionCount: number;
    totalTransactionCount: number;
  };
  users: {
    totalUsers: number;
    totalCreators: number;
    totalCompanies: number;
    totalAdmins: number;
    newUsersThisWeek: number;
    newCreatorsThisWeek: number;
    newCompaniesThisWeek: number;
    activeCreators: number;
    activeCompanies: number;
    pendingCompanies: number;
    suspendedUsers: number;
    userGrowth: Array<{
      period: string;
      creators: number;
      companies: number;
      total: number;
    }>;
    topCreators: Array<{
      id: string;
      name: string;
      email: string;
      earnings: number;
      clicks: number;
      conversions: number;
    }>;
    topCompanies: Array<{
      id: string;
      name: string;
      offers: number;
      spend: number;
      creators: number;
    }>;
  };
  platform: {
    totalOffers: number;
    activeOffers: number;
    pendingOffers: number;
    totalApplications: number;
    totalConversions: number;
    totalClicks: number;
    averageConversionRate: number;
    offersByNiche: Array<{
      niche: string;
      count: number;
    }>;
    applicationsByStatus: Array<{
      status: string;
      count: number;
    }>;
  };
};

// Platform Health Types
interface HealthSnapshot {
  overallHealthScore: number;
  apiHealthScore: number;
  storageHealthScore: number;
  databaseHealthScore: number;
  avgResponseTimeMs: number;
  errorRatePercent: number;
  memoryUsagePercent: number;
  cpuUsagePercent: number;
  uptimeSeconds: number;
  alerts: Array<{ type: string; message: string; severity: string }>;
  timestamp: string | null;
}

interface ApiMetrics {
  totalRequests: number;
  successfulRequests: number;
  errorRequests: number;
  avgResponseTime: number;
  errorRate: number;
  requestsPerMinute: number;
  topEndpoints: Array<{ endpoint: string; method: string; count: number; avgTime: number }>;
  errorsByEndpoint: Array<{ endpoint: string; method: string; errorCount: number }>;
}

interface StorageData {
  totalFiles: number;
  totalStorageBytes: number;
  videoFiles: number;
  videoStorageBytes: number;
  imageFiles: number;
  imageStorageBytes: number;
  documentFiles: number;
  documentStorageBytes: number;
}

interface VideoCosts {
  totalVideos: number;
  totalVideoStorageGb: number;
  totalBandwidthGb: number;
  storageCostUsd: number;
  bandwidthCostUsd: number;
  transcodingCostUsd: number;
  totalCostUsd: number;
  costPerVideoUsd: number;
  viewsCount: number;
}

interface ErrorLog {
  id: string;
  endpoint: string;
  method: string;
  statusCode: number;
  errorMessage: string | null;
  timestamp: string | null;
  userId: string | null;
}

interface PlatformHealthReport {
  snapshot: HealthSnapshot | null;
  apiMetrics: ApiMetrics;
  storage: StorageData;
  videoCosts: VideoCosts;
  apiTimeSeries: Array<{ date: string; totalRequests: number; errorRate: number; avgResponseTime: number }>;
  storageTimeSeries: Array<{ date: string; totalStorageGb: number; videoStorageGb: number; imageStorageGb: number; documentStorageGb: number }>;
  costTimeSeries: Array<{ date: string; totalCostUsd: number; storageCostUsd: number; bandwidthCostUsd: number; transcodingCostUsd: number }>;
  recentErrors: ErrorLog[];
}

// Churn Analytics Types
interface ChurnMetrics {
  currentCreators?: number;
  currentCompanies?: number;
  newCreatorsThisPeriod?: number;
  newCompaniesThisPeriod?: number;
  churnedCreatorsThisPeriod?: number;
  churnedCompaniesThisPeriod?: number;
  churnRate: number;
  acquisitionRate: number;
  netGrowth: number;
  timeline: Array<{
    period: string;
    newCreators?: number;
    newCompanies?: number;
    churnedCreators?: number;
    churnedCompanies?: number;
    activeCreators?: number;
    activeCompanies?: number;
    churnRate: number;
  }>;
}

interface ChurnAnalytics {
  creators: ChurnMetrics;
  companies: ChurnMetrics;
  summary: {
    totalActiveUsers: number;
    overallChurnRate: number;
    overallAcquisitionRate: number;
    healthScore: number;
  };
}

// Helper functions for Platform Health
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getHealthColor(score: number): string {
  if (score >= 90) return "text-green-600";
  if (score >= 70) return "text-yellow-600";
  if (score >= 50) return "text-orange-600";
  return "text-red-600";
}

function getHealthBadgeVariant(score: number): "default" | "secondary" | "destructive" | "outline" {
  if (score >= 90) return "default";
  if (score >= 70) return "secondary";
  return "destructive";
}

export default function AdminAnalytics() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [dateRange, setDateRange] = useState("all");
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = "/login";
    }
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    if (!isLoading && user && user.role !== "admin") {
      window.location.href = "/";
    }
  }, [user, isLoading]);

  const { data: analytics, isLoading: analyticsLoading, refetch } = useQuery<AdminAnalytics>({
    queryKey: ["/api/admin/analytics", { range: dateRange }],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics?range=${dateRange}`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          window.location.href = "/login";
          throw new Error("Unauthorized");
        }
        throw new Error("Failed to fetch admin analytics");
      }
      return res.json();
    },
    enabled: isAuthenticated && user?.role === "admin",
    staleTime: 0, // Always consider data stale to ensure fresh data on refetch
    refetchOnMount: "always", // Always refetch when component mounts
  });

  // Platform Health Query
  const { data: healthReport, isLoading: healthLoading, refetch: refetchHealth } = useQuery<PlatformHealthReport>({
    queryKey: ["/api/admin/platform-health"],
    queryFn: async () => {
      const res = await fetch("/api/admin/platform-health", {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          window.location.href = "/login";
          throw new Error("Unauthorized");
        }
        throw new Error("Failed to fetch platform health data");
      }
      return res.json();
    },
    enabled: isAuthenticated && user?.role === "admin",
    staleTime: 0, // Always consider data stale for real-time health monitoring
    refetchOnMount: "always",
    refetchInterval: 60000, // Refresh every minute
  });

  // Churn Analytics Query
  const { data: churnData, isLoading: churnLoading } = useQuery<ChurnAnalytics>({
    queryKey: ["/api/admin/churn-analytics", { range: dateRange }],
    queryFn: async () => {
      const res = await fetch(`/api/admin/churn-analytics?range=${dateRange}`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          window.location.href = "/login";
          throw new Error("Unauthorized");
        }
        throw new Error("Failed to fetch churn analytics");
      }
      return res.json();
    },
    enabled: isAuthenticated && user?.role === "admin",
    staleTime: 0, // Always consider data stale for accurate churn metrics
    refetchOnMount: "always",
  });

  // Fee Settings Query
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

  // Mutation to create health snapshot
  const createSnapshotMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/platform-health/snapshot", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create snapshot");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Health snapshot created" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/platform-health"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create snapshot", variant: "destructive" });
    },
  });

  const exportFinancialPdf = () => {
    if (!analytics?.financial) {
      toast({
        title: "No data to export",
        description: "Financial data is not available.",
        variant: "destructive",
      });
      return;
    }

    try {
      const data: AdminFinancialData = {
        totalRevenue: analytics.financial.totalRevenue,
        listingFees: analytics.financial.listingFees,
        platformFees: analytics.financial.platformFees,
        processingFees: analytics.financial.processingFees,
        totalPayouts: analytics.financial.totalPayouts,
        pendingPayouts: analytics.financial.pendingPayouts,
        completedPayouts: analytics.financial.completedPayouts,
        disputedPayments: analytics.financial.disputedPayments,
        revenueByPeriod: analytics.financial.revenueByPeriod,
        payoutsByPeriod: analytics.financial.payoutsByPeriod,
      };

      exportAdminFinancialReportPDF(data);

      toast({
        title: "PDF exported",
        description: "Financial report has been downloaded.",
      });
    } catch (error) {
      setErrorDialog({
        title: "Export failed",
        message: "Unable to generate financial PDF report.",
      });
    }
  };

  const exportFinancialCsv = () => {
    if (!analytics?.financial) {
      toast({
        title: "No data to export",
        description: "Financial data is not available.",
        variant: "destructive",
      });
      return;
    }

    try {
      const data: AdminFinancialData = {
        totalRevenue: analytics.financial.totalRevenue,
        listingFees: analytics.financial.listingFees,
        platformFees: analytics.financial.platformFees,
        processingFees: analytics.financial.processingFees,
        totalPayouts: analytics.financial.totalPayouts,
        pendingPayouts: analytics.financial.pendingPayouts,
        completedPayouts: analytics.financial.completedPayouts,
        disputedPayments: analytics.financial.disputedPayments,
      };

      exportAdminFinancialReportCSV(data);

      toast({
        title: "CSV exported",
        description: "Financial report has been downloaded.",
      });
    } catch (error) {
      setErrorDialog({
        title: "Export failed",
        message: "Unable to generate financial CSV report.",
      });
    }
  };

  const exportUsersPdf = () => {
    if (!analytics?.users) {
      toast({
        title: "No data to export",
        description: "User data is not available.",
        variant: "destructive",
      });
      return;
    }

    try {
      const data: AdminUserStats = {
        totalUsers: analytics.users.totalUsers,
        totalCreators: analytics.users.totalCreators,
        totalCompanies: analytics.users.totalCompanies,
        totalAdmins: analytics.users.totalAdmins,
        newUsersThisWeek: analytics.users.newUsersThisWeek,
        newCreatorsThisWeek: analytics.users.newCreatorsThisWeek,
        newCompaniesThisWeek: analytics.users.newCompaniesThisWeek,
        activeCreators: analytics.users.activeCreators,
        activeCompanies: analytics.users.activeCompanies,
        pendingCompanies: analytics.users.pendingCompanies,
        suspendedUsers: analytics.users.suspendedUsers,
        userGrowth: analytics.users.userGrowth,
        topCreators: analytics.users.topCreators,
        topCompanies: analytics.users.topCompanies,
      };

      exportAdminUserReportPDF(data);

      toast({
        title: "PDF exported",
        description: "User report has been downloaded.",
      });
    } catch (error) {
      setErrorDialog({
        title: "Export failed",
        message: "Unable to generate user PDF report.",
      });
    }
  };

  const exportUsersCsv = () => {
    if (!analytics?.users) {
      toast({
        title: "No data to export",
        description: "User data is not available.",
        variant: "destructive",
      });
      return;
    }

    try {
      const data: AdminUserStats = {
        totalUsers: analytics.users.totalUsers,
        totalCreators: analytics.users.totalCreators,
        totalCompanies: analytics.users.totalCompanies,
        totalAdmins: analytics.users.totalAdmins,
        newUsersThisWeek: analytics.users.newUsersThisWeek,
        newCreatorsThisWeek: analytics.users.newCreatorsThisWeek,
        newCompaniesThisWeek: analytics.users.newCompaniesThisWeek,
        activeCreators: analytics.users.activeCreators,
        activeCompanies: analytics.users.activeCompanies,
        pendingCompanies: analytics.users.pendingCompanies,
        suspendedUsers: analytics.users.suspendedUsers,
      };

      exportAdminUserReportCSV(data);

      toast({
        title: "CSV exported",
        description: "User report has been downloaded.",
      });
    } catch (error) {
      setErrorDialog({
        title: "Export failed",
        message: "Unable to generate user CSV report.",
      });
    }
  };

  const exportPlatformCsv = () => {
    if (!analytics?.platform) {
      toast({
        title: "No data to export",
        description: "Platform data is not available.",
        variant: "destructive",
      });
      return;
    }

    try {
      const headers = ["Metric", "Value"];
      const data = [
        ["Total Offers", analytics.platform.totalOffers.toString()],
        ["Active Offers", analytics.platform.activeOffers.toString()],
        ["Pending Offers", analytics.platform.pendingOffers.toString()],
        ["Total Applications", analytics.platform.totalApplications.toString()],
        ["Total Conversions", analytics.platform.totalConversions.toString()],
        ["Total Clicks", analytics.platform.totalClicks.toString()],
        ["Average Conversion Rate", `${analytics.platform.averageConversionRate.toFixed(2)}%`],
      ];

      downloadCSV(data, "admin-platform-report", headers);

      toast({
        title: "CSV exported",
        description: "Platform report has been downloaded.",
      });
    } catch (error) {
      setErrorDialog({
        title: "Export failed",
        message: "Unable to generate platform CSV report.",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNavBar />

      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-7xl mx-auto space-y-4 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold">Admin Analytics</h1>
            <p className="text-xs sm:text-base text-muted-foreground mt-1">
              Platform-wide financial and user analytics
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-32 sm:w-40 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGES.map((range) => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 sm:gap-2 h-9"
              onClick={() => {
                refetch();
                refetchHealth();
                queryClient.invalidateQueries({ queryKey: ["/api/admin/churn-analytics"] });
              }}
              disabled={analyticsLoading || healthLoading || churnLoading}
            >
              <RefreshCw className={`h-4 w-4 ${(analyticsLoading || healthLoading || churnLoading) ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        {analyticsLoading ? (
          <>
            <StatsGridSkeleton count={4} />
            <ChartSkeleton />
          </>
        ) : (
          <Tabs defaultValue="financial" className="space-y-4 sm:space-y-6">
            {/* Scrollable tabs on mobile */}
            <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-hide">
              <TabsList className="inline-flex w-auto min-w-full sm:w-full sm:max-w-lg sm:grid sm:grid-cols-4">
                <TabsTrigger value="financial" className="gap-1 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 whitespace-nowrap">
                  <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Financial
                </TabsTrigger>
                <TabsTrigger value="users" className="gap-1 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 whitespace-nowrap">
                  <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Users
                </TabsTrigger>
                <TabsTrigger value="platform" className="gap-1 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 whitespace-nowrap">
                  <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Platform
                </TabsTrigger>
                <TabsTrigger value="health" className="gap-1 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 whitespace-nowrap">
                  <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Health
                </TabsTrigger>
              </TabsList>
            </div>

          {/* Financial Tab */}
          <TabsContent value="financial" className="space-y-4 sm:space-y-6">
            {/* Export Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 h-8 sm:h-9 text-xs sm:text-sm" onClick={exportFinancialCsv}>
                <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Export CSV</span>
                <span className="sm:hidden">CSV</span>
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 sm:h-9 text-xs sm:text-sm" onClick={exportFinancialPdf}>
                <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">PDF Report</span>
                <span className="sm:hidden">PDF</span>
              </Button>
            </div>

            {/* Financial Stats Grid */}
            <div className="grid gap-2 sm:gap-6 grid-cols-2 lg:grid-cols-4">
              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className="text-lg sm:text-2xl font-bold font-mono text-green-600">
                    CA${(analytics?.financial?.totalRevenue || 0).toFixed(2)}
                  </div>
                  <div className="flex items-center text-[10px] sm:text-xs text-muted-foreground mt-1">
                    {(analytics?.financial?.revenueGrowth || 0) >= 0 ? (
                      <>
                        <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
                        <span className="text-green-500">
                          +{(analytics?.financial?.revenueGrowth || 0).toFixed(1)}%
                        </span>
                      </>
                    ) : (
                      <>
                        <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
                        <span className="text-red-500">
                          {(analytics?.financial?.revenueGrowth || 0).toFixed(1)}%
                        </span>
                      </>
                    )}
                    <span className="ml-1 hidden sm:inline">vs last period</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Listing Fees</CardTitle>
                  <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className="text-lg sm:text-2xl font-bold font-mono">
                    CA${(analytics?.financial?.listingFees || 0).toFixed(2)}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">One-time offer fees</p>
                </CardContent>
              </Card>

              <Card className="border-card-border bg-blue-50/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Affiliate Fees</CardTitle>
                  <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] sm:text-xs px-1.5 sm:px-2">Offers</Badge>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className="text-lg sm:text-2xl font-bold font-mono text-blue-600">
                    CA${((analytics?.financial?.affiliatePlatformFees || 0) + (analytics?.financial?.affiliateProcessingFees || 0)).toFixed(2)}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                    {analytics?.financial?.affiliateTransactionCount || 0} transactions
                  </p>
                </CardContent>
              </Card>

              <Card className="border-card-border bg-purple-50/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Retainer Fees</CardTitle>
                  <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 text-[10px] sm:text-xs px-1.5 sm:px-2">Contracts</Badge>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className="text-lg sm:text-2xl font-bold font-mono text-purple-600">
                    CA${((analytics?.financial?.retainerPlatformFees || 0) + (analytics?.financial?.retainerProcessingFees || 0)).toFixed(2)}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                    {analytics?.financial?.retainerTransactionCount || 0} transactions
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Payout Stats */}
            <div className="grid gap-2 sm:gap-6 grid-cols-2 lg:grid-cols-4">
              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Total Payouts</CardTitle>
                  <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className="text-lg sm:text-2xl font-bold font-mono">
                    CA${(analytics?.financial?.totalPayouts || 0).toFixed(2)}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 mt-2 text-[10px] sm:text-xs">
                    <span className="px-1.5 sm:px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                      Aff: CA${(analytics?.financial?.affiliatePayouts || 0).toFixed(2)}
                    </span>
                    <span className="px-1.5 sm:px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                      Ret: CA${(analytics?.financial?.retainerPayouts || 0).toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Pending</CardTitle>
                  <Badge variant="secondary" className="text-[9px] sm:text-xs px-1 sm:px-2 hidden sm:inline-flex">{(analytics?.financial?.pendingPayouts || 0) > 0 ? "Action needed" : "Up to date"}</Badge>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className="text-lg sm:text-2xl font-bold font-mono text-yellow-600">
                    CA${(analytics?.financial?.pendingPayouts || 0).toFixed(2)}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 mt-2 text-[10px] sm:text-xs">
                    <span className="px-1.5 sm:px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                      Aff: CA${(analytics?.financial?.affiliatePendingPayouts || 0).toFixed(2)}
                    </span>
                    <span className="px-1.5 sm:px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                      Ret: CA${(analytics?.financial?.retainerPendingPayouts || 0).toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Completed</CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className="text-lg sm:text-2xl font-bold font-mono text-green-600">
                    CA${(analytics?.financial?.completedPayouts || 0).toFixed(2)}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 mt-2 text-[10px] sm:text-xs">
                    <span className="px-1.5 sm:px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                      Aff: CA${(analytics?.financial?.affiliateCompletedPayouts || 0).toFixed(2)}
                    </span>
                    <span className="px-1.5 sm:px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                      Ret: CA${(analytics?.financial?.retainerCompletedPayouts || 0).toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Disputed</CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className="text-lg sm:text-2xl font-bold font-mono text-red-600">
                    CA${(analytics?.financial?.disputedPayments || 0).toFixed(2)}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Requiring resolution</p>
                </CardContent>
              </Card>
            </div>

            {/* Revenue Over Time Chart */}
            <Card className="border-card-border">
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="text-sm sm:text-lg">Revenue Over Time</CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                {analytics?.financial?.revenueByPeriod && analytics.financial.revenueByPeriod.length > 0 ? (
                  <div className="h-52 sm:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.financial.revenueByPeriod} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="period" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "6px",
                            fontSize: "12px",
                          }}
                          formatter={(value: any) => [`CA$${Number(value).toFixed(2)}`, ""]}
                        />
                        <Area
                          type="monotone"
                          dataKey="listingFees"
                          stackId="1"
                          stroke="#2563eb"
                          fill="#2563eb"
                          fillOpacity={0.6}
                          name="Listing Fees"
                        />
                        <Area
                          type="monotone"
                          dataKey="platformFees"
                          stackId="1"
                          stroke="#10b981"
                          fill="#10b981"
                          fillOpacity={0.6}
                          name="Platform Fees"
                        />
                        <Area
                          type="monotone"
                          dataKey="processingFees"
                          stackId="1"
                          stroke="#f59e0b"
                          fill="#f59e0b"
                          fillOpacity={0.6}
                          name="Processing Fees"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center py-8 sm:py-12 text-muted-foreground text-sm">
                    No revenue data available for this period.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Revenue by Source */}
            <Card className="border-card-border">
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="text-sm sm:text-lg">Revenue by Source</CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                {analytics?.financial?.revenueBySource && analytics.financial.revenueBySource.length > 0 ? (
                  <div className="h-52 sm:h-80 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie
                          data={analytics.financial.revenueBySource}
                          dataKey="amount"
                          nameKey="source"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          label={({ source, percent }: any) => `${source}: ${(percent * 100).toFixed(0)}%`}
                          labelLine={{ strokeWidth: 1 }}
                        >
                          {analytics.financial.revenueBySource.map((entry, index) => (
                            <Cell key={entry.source} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any) => [`CA$${Number(value).toFixed(2)}`, ""]} />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center py-8 sm:py-12 text-muted-foreground text-sm">
                    No revenue source data available.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4 sm:space-y-6">
            {/* Export Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 h-8 sm:h-9 text-xs sm:text-sm" onClick={exportUsersCsv}>
                <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Export CSV</span>
                <span className="sm:hidden">CSV</span>
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 sm:h-9 text-xs sm:text-sm" onClick={exportUsersPdf}>
                <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">PDF Report</span>
                <span className="sm:hidden">PDF</span>
              </Button>
            </div>

            {/* User Stats Grid */}
            <div className="grid gap-2 sm:gap-6 grid-cols-2 lg:grid-cols-4">
              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className="text-lg sm:text-2xl font-bold">{analytics?.users?.totalUsers || 0}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                    +{analytics?.users?.newUsersThisWeek || 0} this week
                  </p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Creators</CardTitle>
                  <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className="text-lg sm:text-2xl font-bold">{analytics?.users?.totalCreators || 0}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                    {analytics?.users?.activeCreators || 0} active
                  </p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Companies</CardTitle>
                  <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className="text-lg sm:text-2xl font-bold">{analytics?.users?.totalCompanies || 0}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                    {analytics?.users?.pendingCompanies || 0} pending
                  </p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Suspended</CardTitle>
                  <Badge variant={analytics?.users?.suspendedUsers ? "destructive" : "secondary"} className="text-[10px] sm:text-xs px-1.5 sm:px-2">
                    {analytics?.users?.suspendedUsers || 0}
                  </Badge>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className="text-lg sm:text-2xl font-bold text-red-600">
                    {analytics?.users?.suspendedUsers || 0}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Users suspended</p>
                </CardContent>
              </Card>
            </div>

            {/* Churn & Acquisition Metrics */}
            <Card className="border-card-border">
              <CardHeader className="p-3 sm:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm sm:text-lg">Acquisition & Churn Metrics</CardTitle>
                    <CardDescription className="mt-1 text-xs sm:text-sm">
                      User retention and growth analysis
                    </CardDescription>
                  </div>
                  {churnData?.summary && (
                    <Badge
                      variant={churnData.summary.healthScore >= 70 ? "default" :
                               churnData.summary.healthScore >= 50 ? "secondary" : "destructive"}
                      className="gap-1 text-[10px] sm:text-xs"
                    >
                      <Gauge className="h-3 w-3" />
                      Score: {churnData.summary.healthScore}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                {churnLoading ? (
                  <div className="text-center py-6 sm:py-8 text-muted-foreground text-sm">Loading churn data...</div>
                ) : churnData ? (
                  <div className="space-y-4 sm:space-y-6">
                    {/* Summary Stats */}
                    <div className="grid gap-2 sm:gap-4 grid-cols-2 md:grid-cols-4">
                      <div className="p-2.5 sm:p-4 rounded-lg bg-green-50 border border-green-200">
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                          <UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600" />
                          <span className="text-[10px] sm:text-sm font-medium text-green-800">New</span>
                        </div>
                        <div className="text-lg sm:text-2xl font-bold text-green-700">
                          +{(churnData.creators.newCreatorsThisPeriod || 0) + (churnData.companies.newCompaniesThisPeriod || 0)}
                        </div>
                        <p className="text-[9px] sm:text-xs text-green-600 mt-1 hidden sm:block">
                          {churnData.creators.newCreatorsThisPeriod || 0} creators, {churnData.companies.newCompaniesThisPeriod || 0} companies
                        </p>
                      </div>

                      <div className="p-2.5 sm:p-4 rounded-lg bg-red-50 border border-red-200">
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                          <UserMinus className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-600" />
                          <span className="text-[10px] sm:text-sm font-medium text-red-800">Churned</span>
                        </div>
                        <div className="text-lg sm:text-2xl font-bold text-red-700">
                          -{(churnData.creators.churnedCreatorsThisPeriod || 0) + (churnData.companies.churnedCompaniesThisPeriod || 0)}
                        </div>
                        <p className="text-[9px] sm:text-xs text-red-600 mt-1 hidden sm:block">
                          {churnData.creators.churnedCreatorsThisPeriod || 0} creators, {churnData.companies.churnedCompaniesThisPeriod || 0} companies
                        </p>
                      </div>

                      <div className="p-2.5 sm:p-4 rounded-lg bg-blue-50 border border-blue-200">
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                          <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
                          <span className="text-[10px] sm:text-sm font-medium text-blue-800">Acquisition</span>
                        </div>
                        <div className="text-lg sm:text-2xl font-bold text-blue-700">
                          {churnData.summary.overallAcquisitionRate.toFixed(1)}%
                        </div>
                        <p className="text-[9px] sm:text-xs text-blue-600 mt-1 hidden sm:block">New vs existing</p>
                      </div>

                      <div className="p-2.5 sm:p-4 rounded-lg bg-orange-50 border border-orange-200">
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                          <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-600" />
                          <span className="text-[10px] sm:text-sm font-medium text-orange-800">Churn</span>
                        </div>
                        <div className="text-lg sm:text-2xl font-bold text-orange-700">
                          {churnData.summary.overallChurnRate.toFixed(1)}%
                        </div>
                        <p className="text-[9px] sm:text-xs text-orange-600 mt-1 hidden sm:block">Lost vs total</p>
                      </div>
                    </div>

                    {/* Detailed Breakdown */}
                    <div className="grid gap-3 sm:gap-6 lg:grid-cols-2">
                      {/* Creator Churn */}
                      <div className="p-3 sm:p-4 border rounded-lg">
                        <h4 className="font-semibold mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
                          <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
                          Creator Metrics
                        </h4>
                        <div className="space-y-2 sm:space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-xs sm:text-sm text-muted-foreground">Active Creators</span>
                            <span className="font-semibold text-sm sm:text-base">{churnData.creators.currentCreators || 0}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs sm:text-sm text-muted-foreground">New This Period</span>
                            <span className="font-semibold text-sm sm:text-base text-green-600">+{churnData.creators.newCreatorsThisPeriod || 0}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs sm:text-sm text-muted-foreground">Churned</span>
                            <span className="font-semibold text-sm sm:text-base text-red-600">-{churnData.creators.churnedCreatorsThisPeriod || 0}</span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t">
                            <span className="text-xs sm:text-sm font-medium">Net Growth</span>
                            <span className={`font-bold text-sm sm:text-base ${churnData.creators.netGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {churnData.creators.netGrowth >= 0 ? '+' : ''}{churnData.creators.netGrowth}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs sm:text-sm text-muted-foreground">Churn Rate</span>
                            <Badge variant={churnData.creators.churnRate < 5 ? "default" : churnData.creators.churnRate < 10 ? "secondary" : "destructive"} className="text-[10px] sm:text-xs">
                              {churnData.creators.churnRate.toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Company Churn */}
                      <div className="p-3 sm:p-4 border rounded-lg">
                        <h4 className="font-semibold mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
                          <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600" />
                          Company Metrics
                        </h4>
                        <div className="space-y-2 sm:space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-xs sm:text-sm text-muted-foreground">Active Companies</span>
                            <span className="font-semibold text-sm sm:text-base">{churnData.companies.currentCompanies || 0}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs sm:text-sm text-muted-foreground">New This Period</span>
                            <span className="font-semibold text-sm sm:text-base text-green-600">+{churnData.companies.newCompaniesThisPeriod || 0}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs sm:text-sm text-muted-foreground">Churned</span>
                            <span className="font-semibold text-sm sm:text-base text-red-600">-{churnData.companies.churnedCompaniesThisPeriod || 0}</span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t">
                            <span className="text-xs sm:text-sm font-medium">Net Growth</span>
                            <span className={`font-bold text-sm sm:text-base ${churnData.companies.netGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {churnData.companies.netGrowth >= 0 ? '+' : ''}{churnData.companies.netGrowth}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs sm:text-sm text-muted-foreground">Churn Rate</span>
                            <Badge variant={churnData.companies.churnRate < 5 ? "default" : churnData.companies.churnRate < 10 ? "secondary" : "destructive"} className="text-[10px] sm:text-xs">
                              {churnData.companies.churnRate.toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Net Growth Visualization */}
                    <div className="pt-3 sm:pt-4 border-t">
                      <div className="flex items-center justify-center gap-4 sm:gap-8">
                        <div className="text-center">
                          <div className="text-xl sm:text-3xl font-bold">
                            {churnData.summary.totalActiveUsers}
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground">Total Active</p>
                        </div>
                        <div className="text-center">
                          <div className={`text-xl sm:text-3xl font-bold ${
                            (churnData.creators.netGrowth + churnData.companies.netGrowth) >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}>
                            {(churnData.creators.netGrowth + churnData.companies.netGrowth) >= 0 ? '+' : ''}
                            {churnData.creators.netGrowth + churnData.companies.netGrowth}
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground">Net Growth</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 sm:py-12 text-muted-foreground text-sm">
                    No churn data available for this period.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* User Growth Chart */}
            <Card className="border-card-border">
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="text-sm sm:text-lg">User Growth</CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                {analytics?.users?.userGrowth && analytics.users.userGrowth.length > 0 ? (
                  <div className="h-52 sm:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.users.userGrowth} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="period" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "6px",
                            fontSize: "12px",
                          }}
                        />
                        <Line type="monotone" dataKey="creators" stroke="#2563eb" strokeWidth={2} name="Creators" />
                        <Line type="monotone" dataKey="companies" stroke="#10b981" strokeWidth={2} name="Companies" />
                        <Line type="monotone" dataKey="total" stroke="#8b5cf6" strokeWidth={2} name="Total" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center py-8 sm:py-12 text-muted-foreground text-sm">
                    No user growth data available.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Performers */}
            <div className="grid gap-3 sm:gap-6 lg:grid-cols-2">
              <Card className="border-card-border">
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="text-sm sm:text-lg">Top Creators</CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  {analytics?.users?.topCreators && analytics.users.topCreators.length > 0 ? (
                    <div className="space-y-3 sm:space-y-4">
                      {analytics.users.topCreators.slice(0, 5).map((creator, index) => (
                        <div key={creator.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary/10 text-primary font-semibold text-xs sm:text-sm">
                              {index + 1}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-xs sm:text-sm truncate">{creator.name}</div>
                              <div className="text-[10px] sm:text-xs text-muted-foreground truncate">{creator.email}</div>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="font-semibold font-mono text-xs sm:text-sm text-green-600">
                              CA${creator.earnings.toFixed(2)}
                            </div>
                            <div className="text-[10px] sm:text-xs text-muted-foreground">
                              {creator.clicks} clicks
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 sm:py-8 text-muted-foreground text-sm">
                      No creator data available.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="text-sm sm:text-lg">Top Companies</CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  {analytics?.users?.topCompanies && analytics.users.topCompanies.length > 0 ? (
                    <div className="space-y-3 sm:space-y-4">
                      {analytics.users.topCompanies.slice(0, 5).map((company, index) => (
                        <div key={company.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary/10 text-primary font-semibold text-xs sm:text-sm">
                              {index + 1}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-xs sm:text-sm truncate">{company.name}</div>
                              <div className="text-[10px] sm:text-xs text-muted-foreground">{company.offers} offers</div>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="font-semibold font-mono text-xs sm:text-sm">
                              CA${company.spend.toFixed(2)}
                            </div>
                            <div className="text-[10px] sm:text-xs text-muted-foreground">
                              {company.creators} creators
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 sm:py-8 text-muted-foreground text-sm">
                      No company data available.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Platform Tab */}
          <TabsContent value="platform" className="space-y-4 sm:space-y-6">
            {/* Export Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 h-8 sm:h-9 text-xs sm:text-sm" onClick={exportPlatformCsv}>
                <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Export CSV</span>
                <span className="sm:hidden">CSV</span>
              </Button>
            </div>

            {/* Platform Stats Grid */}
            <div className="grid gap-2 sm:gap-6 grid-cols-2 lg:grid-cols-4">
              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Total Offers</CardTitle>
                  <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className="text-lg sm:text-2xl font-bold">{analytics?.platform?.totalOffers || 0}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                    {analytics?.platform?.activeOffers || 0} active | {analytics?.platform?.pendingOffers || 0} pending
                  </p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Applications</CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className="text-lg sm:text-2xl font-bold">{analytics?.platform?.totalApplications || 0}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Creator apps</p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Total Clicks</CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className="text-lg sm:text-2xl font-bold">{(analytics?.platform?.totalClicks || 0).toLocaleString()}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Link clicks</p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Conv. Rate</CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className="text-lg sm:text-2xl font-bold">
                    {(analytics?.platform?.averageConversionRate || 0).toFixed(2)}%
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                    {(analytics?.platform?.totalConversions || 0).toLocaleString()} conv.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-3 sm:gap-6 lg:grid-cols-2">
              <Card className="border-card-border">
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="text-sm sm:text-lg">Offers by Niche</CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  {analytics?.platform?.offersByNiche && analytics.platform.offersByNiche.length > 0 ? (
                    <div className="h-52 sm:h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics.platform.offersByNiche} layout="vertical" margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                          <YAxis
                            dataKey="niche"
                            type="category"
                            width={80}
                            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
                            tickFormatter={(value) => {
                              // Format niche names: replace underscores with spaces and capitalize
                              const formatted = value
                                .replace(/_/g, ' ')
                                .replace(/&/g, '&')
                                .split(' ')
                                .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                                .join(' ');
                              return formatted.length > 12 ? formatted.slice(0, 12) + '...' : formatted;
                            }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--popover))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "6px",
                              fontSize: "12px",
                            }}
                            formatter={(value: any, name: any) => [value, 'Count']}
                            labelFormatter={(label) => {
                              return label
                                .replace(/_/g, ' ')
                                .replace(/&/g, '&')
                                .split(' ')
                                .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                                .join(' ');
                            }}
                          />
                          <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-center py-8 sm:py-12 text-muted-foreground text-sm">
                      No niche data available.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="text-sm sm:text-lg">Applications by Status</CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  {analytics?.platform?.applicationsByStatus && analytics.platform.applicationsByStatus.length > 0 ? (
                    <div className="h-52 sm:h-80 flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPie>
                          <Pie
                            data={analytics.platform.applicationsByStatus}
                            dataKey="count"
                            nameKey="status"
                            cx="50%"
                            cy="50%"
                            outerRadius={70}
                            label={({ status, percent }: any) => `${status}: ${(percent * 100).toFixed(0)}%`}
                            labelLine={{ strokeWidth: 1 }}
                          >
                            {analytics.platform.applicationsByStatus.map((entry, index) => (
                              <Cell key={entry.status} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </RechartsPie>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-center py-8 sm:py-12 text-muted-foreground text-sm">
                      No application status data available.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Health Tab - Platform Health Monitoring */}
          <TabsContent value="health" className="space-y-4 sm:space-y-6">
            {/* Health Actions */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 sm:h-9 text-xs sm:text-sm"
                onClick={() => refetchHealth()}
                disabled={healthLoading}
              >
                <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${healthLoading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 sm:h-9 text-xs sm:text-sm"
                onClick={() => createSnapshotMutation.mutate()}
                disabled={createSnapshotMutation.isPending}
              >
                <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Create Snapshot</span>
                <span className="sm:hidden">Snapshot</span>
              </Button>
            </div>

            {/* Alerts */}
            {healthReport?.snapshot?.alerts && healthReport.snapshot.alerts.length > 0 && (
              <div className="space-y-2">
                {healthReport.snapshot.alerts.map((alert, i) => (
                  <div
                    key={i}
                    className={`p-2.5 sm:p-4 rounded-lg flex items-center gap-2 sm:gap-3 ${
                      alert.severity === "critical"
                        ? "bg-red-50 border border-red-200"
                        : "bg-yellow-50 border border-yellow-200"
                    }`}
                  >
                    <AlertTriangle
                      className={`h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 ${
                        alert.severity === "critical" ? "text-red-600" : "text-yellow-600"
                      }`}
                    />
                    <span
                      className={`text-xs sm:text-sm ${
                        alert.severity === "critical" ? "text-red-800" : "text-yellow-800"
                      }`}
                    >
                      {alert.message}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Health Scores */}
            <div className="grid gap-2 sm:gap-6 grid-cols-2 lg:grid-cols-4">
              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Overall</CardTitle>
                  <Activity className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${getHealthColor(healthReport?.snapshot?.overallHealthScore || 100)}`} />
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className={`text-xl sm:text-3xl font-bold ${getHealthColor(healthReport?.snapshot?.overallHealthScore || 100)}`}>
                      {healthReport?.snapshot?.overallHealthScore || 100}
                    </div>
                    <Badge variant={getHealthBadgeVariant(healthReport?.snapshot?.overallHealthScore || 100)} className="text-[9px] sm:text-xs px-1 sm:px-2 hidden sm:inline-flex">
                      {(healthReport?.snapshot?.overallHealthScore || 100) >= 90 ? "Healthy" :
                       (healthReport?.snapshot?.overallHealthScore || 100) >= 70 ? "Fair" :
                       (healthReport?.snapshot?.overallHealthScore || 100) >= 50 ? "Degraded" : "Critical"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">API</CardTitle>
                  <Server className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${getHealthColor(healthReport?.snapshot?.apiHealthScore || 100)}`} />
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className={`text-lg sm:text-2xl font-bold ${getHealthColor(healthReport?.snapshot?.apiHealthScore || 100)}`}>
                    {healthReport?.snapshot?.apiHealthScore || 100}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Storage</CardTitle>
                  <HardDrive className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${getHealthColor(healthReport?.snapshot?.storageHealthScore || 100)}`} />
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className={`text-lg sm:text-2xl font-bold ${getHealthColor(healthReport?.snapshot?.storageHealthScore || 100)}`}>
                    {healthReport?.snapshot?.storageHealthScore || 100}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Database</CardTitle>
                  <Database className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${getHealthColor(healthReport?.snapshot?.databaseHealthScore || 100)}`} />
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className={`text-lg sm:text-2xl font-bold ${getHealthColor(healthReport?.snapshot?.databaseHealthScore || 100)}`}>
                    {healthReport?.snapshot?.databaseHealthScore || 100}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Key Metrics */}
            <div className="grid gap-2 sm:gap-6 grid-cols-2 lg:grid-cols-4">
              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Response</CardTitle>
                  <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className="text-lg sm:text-2xl font-bold">
                    {(healthReport?.apiMetrics?.avgResponseTime || 0).toFixed(0)}ms
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {(healthReport?.apiMetrics?.requestsPerMinute || 0)} req/min
                  </p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Errors</CardTitle>
                  <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-600" />
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className="text-lg sm:text-2xl font-bold">
                    {(healthReport?.apiMetrics?.errorRate || 0).toFixed(2)}%
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {healthReport?.apiMetrics?.errorRequests || 0}/{healthReport?.apiMetrics?.totalRequests || 0}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Storage</CardTitle>
                  <HardDrive className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-600" />
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className="text-lg sm:text-2xl font-bold">
                    {formatBytes(healthReport?.storage?.totalStorageBytes || 0)}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {healthReport?.storage?.totalFiles || 0} files
                  </p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Video Cost</CardTitle>
                  <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600" />
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className="text-lg sm:text-2xl font-bold">
                    ${(healthReport?.videoCosts?.totalCostUsd || 0).toFixed(2)}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {healthReport?.videoCosts?.totalVideos || 0} videos
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* System Info */}
            <div className="grid gap-3 sm:gap-6 lg:grid-cols-3">
              <Card className="border-card-border">
                <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">System Resources</CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0 space-y-2 sm:space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs sm:text-sm text-muted-foreground">Memory</span>
                    <Badge variant={Number(healthReport?.snapshot?.memoryUsagePercent || 0) > 80 ? "destructive" : "secondary"} className="text-[10px] sm:text-xs">
                      {Number(healthReport?.snapshot?.memoryUsagePercent || 0).toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs sm:text-sm text-muted-foreground">CPU</span>
                    <Badge variant={Number(healthReport?.snapshot?.cpuUsagePercent || 0) > 80 ? "destructive" : "secondary"} className="text-[10px] sm:text-xs">
                      {Number(healthReport?.snapshot?.cpuUsagePercent || 0).toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs sm:text-sm text-muted-foreground">Uptime</span>
                    <Badge variant="outline" className="text-[10px] sm:text-xs">
                      {formatUptime(Number(healthReport?.snapshot?.uptimeSeconds || 0))}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Storage Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0 space-y-2 sm:space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 sm:gap-2">
                      <Video className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Videos
                    </span>
                    <span className="text-xs sm:text-sm font-medium">
                      {formatBytes(healthReport?.storage?.videoStorageBytes || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 sm:gap-2">
                      <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Images
                    </span>
                    <span className="text-xs sm:text-sm font-medium">
                      {formatBytes(healthReport?.storage?.imageStorageBytes || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 sm:gap-2">
                      <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Docs
                    </span>
                    <span className="text-xs sm:text-sm font-medium">
                      {formatBytes(healthReport?.storage?.documentStorageBytes || 0)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Video Costs</CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0 space-y-2 sm:space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs sm:text-sm text-muted-foreground">Storage</span>
                    <span className="text-xs sm:text-sm font-medium">${(healthReport?.videoCosts?.storageCostUsd || 0).toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs sm:text-sm text-muted-foreground">Bandwidth</span>
                    <span className="text-xs sm:text-sm font-medium">${(healthReport?.videoCosts?.bandwidthCostUsd || 0).toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs sm:text-sm text-muted-foreground">Transcode</span>
                    <span className="text-xs sm:text-sm font-medium">${(healthReport?.videoCosts?.transcodingCostUsd || 0).toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-xs sm:text-sm font-medium">Per Video</span>
                    <span className="text-xs sm:text-sm font-bold text-green-600">${(healthReport?.videoCosts?.costPerVideoUsd || 0).toFixed(4)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* API Performance Chart */}
            <Card className="border-card-border">
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="text-sm sm:text-lg">API Response Time & Error Rate</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Performance over the last 7 days</CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                {healthReport?.apiTimeSeries && healthReport.apiTimeSeries.length > 0 ? (
                  <div className="h-52 sm:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={healthReport.apiTimeSeries} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "6px",
                            fontSize: "12px",
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "10px" }} />
                        <Line yAxisId="left" type="monotone" dataKey="avgResponseTime" name="Response (ms)" stroke="#2563eb" strokeWidth={2} dot={false} />
                        <Line yAxisId="right" type="monotone" dataKey="errorRate" name="Errors (%)" stroke="#ef4444" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center py-8 sm:py-12 text-muted-foreground text-sm">
                    No API metrics data available yet.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Endpoints & Errors */}
            <div className="grid gap-3 sm:gap-6 lg:grid-cols-2">
              <Card className="border-card-border">
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="text-sm sm:text-lg">Top Endpoints</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Most frequently accessed</CardDescription>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className="overflow-x-auto -mx-3 sm:mx-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px] sm:text-xs">Endpoint</TableHead>
                          <TableHead className="text-[10px] sm:text-xs hidden sm:table-cell">Method</TableHead>
                          <TableHead className="text-right text-[10px] sm:text-xs">Reqs</TableHead>
                          <TableHead className="text-right text-[10px] sm:text-xs">Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(healthReport?.apiMetrics?.topEndpoints || []).slice(0, 5).map((ep, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-[9px] sm:text-xs max-w-[100px] sm:max-w-none truncate">{ep.endpoint}</TableCell>
                            <TableCell className="hidden sm:table-cell"><Badge variant="outline" className="text-[10px]">{ep.method}</Badge></TableCell>
                            <TableCell className="text-right text-[10px] sm:text-xs">{ep.count}</TableCell>
                            <TableCell className="text-right text-[10px] sm:text-xs">{ep.avgTime.toFixed(0)}ms</TableCell>
                          </TableRow>
                        ))}
                        {(!healthReport?.apiMetrics?.topEndpoints || healthReport.apiMetrics.topEndpoints.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground text-xs">
                              No endpoint data
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="text-sm sm:text-lg">Recent Errors</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Last 24 hours</CardDescription>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className="overflow-x-auto -mx-3 sm:mx-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px] sm:text-xs">Endpoint</TableHead>
                          <TableHead className="text-[10px] sm:text-xs">Status</TableHead>
                          <TableHead className="text-[10px] sm:text-xs hidden sm:table-cell">Message</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(healthReport?.recentErrors || []).slice(0, 5).map((error) => (
                          <TableRow key={error.id}>
                            <TableCell className="font-mono text-[9px] sm:text-xs max-w-[80px] sm:max-w-none truncate">{error.endpoint}</TableCell>
                            <TableCell>
                              <Badge variant={error.statusCode >= 500 ? "destructive" : "secondary"} className="text-[9px] sm:text-xs">
                                {error.statusCode}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-xs truncate text-[10px] sm:text-xs hidden sm:table-cell">
                              {error.errorMessage || "Unknown"}
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!healthReport?.recentErrors || healthReport.recentErrors.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground text-xs">
                              No recent errors
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}
      </div>

      <GenericErrorDialog
        open={!!errorDialog}
        onOpenChange={(open) => !open && setErrorDialog(null)}
        title={errorDialog?.title || "Error"}
        description={errorDialog?.message || "An error occurred"}
      />
    </div>
  );
}
