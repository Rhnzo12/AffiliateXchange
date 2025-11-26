import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
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
  Download,
  FileText,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
} from "lucide-react";
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
    }>;
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

export default function AdminAnalytics() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [dateRange, setDateRange] = useState("30d");
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
    <div className="space-y-8">
      <TopNavBar />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Admin Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Platform-wide financial and user analytics
          </p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
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
            className="gap-2"
            onClick={() => refetch()}
            disabled={analyticsLoading}
          >
            <RefreshCw className={`h-4 w-4 ${analyticsLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {analyticsLoading ? (
        <>
          <StatsGridSkeleton count={4} />
          <ChartSkeleton />
        </>
      ) : (
        <Tabs defaultValue="financial" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="financial" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Financial
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="platform" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Platform
            </TabsTrigger>
          </TabsList>

          {/* Financial Tab */}
          <TabsContent value="financial" className="space-y-6">
            {/* Export Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="gap-2" onClick={exportFinancialCsv}>
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button variant="outline" className="gap-2" onClick={exportFinancialPdf}>
                <FileText className="h-4 w-4" />
                PDF Report
              </Button>
            </div>

            {/* Financial Stats Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono text-green-600">
                    ${(analytics?.financial?.totalRevenue || 0).toFixed(2)}
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground mt-1">
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
                    <span className="ml-1">vs last period</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Listing Fees</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">
                    ${(analytics?.financial?.listingFees || 0).toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">One-time offer fees</p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Platform Fees</CardTitle>
                  <PieChart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">
                    ${(analytics?.financial?.platformFees || 0).toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">4% commission on payouts</p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Processing Fees</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">
                    ${(analytics?.financial?.processingFees || 0).toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">3% payment processing</p>
                </CardContent>
              </Card>
            </div>

            {/* Payout Stats */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Payouts</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">
                    ${(analytics?.financial?.totalPayouts || 0).toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">To creators</p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
                  <Badge variant="secondary">{(analytics?.financial?.pendingPayouts || 0) > 0 ? "Action needed" : "Up to date"}</Badge>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono text-yellow-600">
                    ${(analytics?.financial?.pendingPayouts || 0).toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Awaiting approval</p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completed Payouts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono text-green-600">
                    ${(analytics?.financial?.completedPayouts || 0).toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Successfully processed</p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Disputed Payments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono text-red-600">
                    ${(analytics?.financial?.disputedPayments || 0).toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Requiring resolution</p>
                </CardContent>
              </Card>
            </div>

            {/* Revenue Over Time Chart */}
            <Card className="border-card-border">
              <CardHeader>
                <CardTitle>Revenue Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics?.financial?.revenueByPeriod && analytics.financial.revenueByPeriod.length > 0 ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.financial.revenueByPeriod}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="period" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "6px",
                          }}
                          formatter={(value: any) => [`$${Number(value).toFixed(2)}`, ""]}
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
                  <div className="text-center py-12 text-muted-foreground">
                    No revenue data available for this period.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Revenue by Source */}
            <Card className="border-card-border">
              <CardHeader>
                <CardTitle>Revenue by Source</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics?.financial?.revenueBySource && analytics.financial.revenueBySource.length > 0 ? (
                  <div className="h-80 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie
                          data={analytics.financial.revenueBySource}
                          dataKey="amount"
                          nameKey="source"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ source, percent }: any) => `${source}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {analytics.financial.revenueBySource.map((entry, index) => (
                            <Cell key={entry.source} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any) => [`$${Number(value).toFixed(2)}`, ""]} />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No revenue source data available.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            {/* Export Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="gap-2" onClick={exportUsersCsv}>
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button variant="outline" className="gap-2" onClick={exportUsersPdf}>
                <FileText className="h-4 w-4" />
                PDF Report
              </Button>
            </div>

            {/* User Stats Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics?.users?.totalUsers || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    +{analytics?.users?.newUsersThisWeek || 0} this week
                  </p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Creators</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics?.users?.totalCreators || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {analytics?.users?.activeCreators || 0} active
                  </p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Companies</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics?.users?.totalCompanies || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {analytics?.users?.pendingCompanies || 0} pending approval
                  </p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Suspended</CardTitle>
                  <Badge variant={analytics?.users?.suspendedUsers ? "destructive" : "secondary"}>
                    {analytics?.users?.suspendedUsers || 0}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {analytics?.users?.suspendedUsers || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Users suspended</p>
                </CardContent>
              </Card>
            </div>

            {/* User Growth Chart */}
            <Card className="border-card-border">
              <CardHeader>
                <CardTitle>User Growth</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics?.users?.userGrowth && analytics.users.userGrowth.length > 0 ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.users.userGrowth}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="period" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "6px",
                          }}
                        />
                        <Line type="monotone" dataKey="creators" stroke="#2563eb" strokeWidth={2} name="Creators" />
                        <Line type="monotone" dataKey="companies" stroke="#10b981" strokeWidth={2} name="Companies" />
                        <Line type="monotone" dataKey="total" stroke="#8b5cf6" strokeWidth={2} name="Total" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No user growth data available.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Performers */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-card-border">
                <CardHeader>
                  <CardTitle>Top Performing Creators</CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics?.users?.topCreators && analytics.users.topCreators.length > 0 ? (
                    <div className="space-y-4">
                      {analytics.users.topCreators.slice(0, 5).map((creator, index) => (
                        <div key={creator.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-medium">{creator.name}</div>
                              <div className="text-xs text-muted-foreground">{creator.email}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold font-mono text-green-600">
                              ${creator.earnings.toFixed(2)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {creator.clicks} clicks | {creator.conversions} conv.
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No creator data available.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader>
                  <CardTitle>Top Companies</CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics?.users?.topCompanies && analytics.users.topCompanies.length > 0 ? (
                    <div className="space-y-4">
                      {analytics.users.topCompanies.slice(0, 5).map((company, index) => (
                        <div key={company.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-medium">{company.name}</div>
                              <div className="text-xs text-muted-foreground">{company.offers} offers</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold font-mono">
                              ${company.spend.toFixed(2)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {company.creators} creators
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No company data available.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Platform Tab */}
          <TabsContent value="platform" className="space-y-6">
            {/* Export Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="gap-2" onClick={exportPlatformCsv}>
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>

            {/* Platform Stats Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Offers</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics?.platform?.totalOffers || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {analytics?.platform?.activeOffers || 0} active | {analytics?.platform?.pendingOffers || 0} pending
                  </p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics?.platform?.totalApplications || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">Creator applications</p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{(analytics?.platform?.totalClicks || 0).toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">Tracking link clicks</p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg. Conversion Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(analytics?.platform?.averageConversionRate || 0).toFixed(2)}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(analytics?.platform?.totalConversions || 0).toLocaleString()} total conversions
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-card-border">
                <CardHeader>
                  <CardTitle>Offers by Niche</CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics?.platform?.offersByNiche && analytics.platform.offersByNiche.length > 0 ? (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics.platform.offersByNiche} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                          <YAxis dataKey="niche" type="category" width={100} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--popover))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "6px",
                            }}
                          />
                          <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      No niche data available.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader>
                  <CardTitle>Applications by Status</CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics?.platform?.applicationsByStatus && analytics.platform.applicationsByStatus.length > 0 ? (
                    <div className="h-80 flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPie>
                          <Pie
                            data={analytics.platform.applicationsByStatus}
                            dataKey="count"
                            nameKey="status"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ status, percent }: any) => `${status}: ${(percent * 100).toFixed(0)}%`}
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
                    <div className="text-center py-12 text-muted-foreground">
                      No application status data available.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}

      <GenericErrorDialog
        open={!!errorDialog}
        onOpenChange={(open) => !open && setErrorDialog(null)}
        title={errorDialog?.title || "Error"}
        description={errorDialog?.message || "An error occurred"}
      />
    </div>
  );
}
