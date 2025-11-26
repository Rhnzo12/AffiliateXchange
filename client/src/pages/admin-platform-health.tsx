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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  HardDrive,
  Server,
  TrendingDown,
  TrendingUp,
  Video,
  Wifi,
  XCircle,
  RefreshCw,
  DollarSign,
  Zap,
  AlertCircle,
  FileText,
  BarChart3,
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
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { TopNavBar } from "../components/TopNavBar";
import { StatsGridSkeleton, ChartSkeleton } from "../components/skeletons";

// Types for platform health data
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

const CHART_COLORS = {
  primary: "#2563eb",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  purple: "#8b5cf6",
  pink: "#ec4899",
};

const PIE_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#8b5cf6"];

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

function HealthScoreCard({ title, score, icon: Icon }: { title: string; score: number; icon: any }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${getHealthColor(score)}`} />
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <div className={`text-3xl font-bold ${getHealthColor(score)}`}>
            {score}
          </div>
          <Badge variant={getHealthBadgeVariant(score)}>
            {score >= 90 ? "Healthy" : score >= 70 ? "Fair" : score >= 50 ? "Degraded" : "Critical"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminPlatformHealth() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [timeRange, setTimeRange] = useState("7d");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = "/login";
    }
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    if (!authLoading && user && user.role !== "admin") {
      window.location.href = "/";
    }
  }, [user, authLoading]);

  // Fetch platform health report
  const { data: healthReport, isLoading, refetch } = useQuery<PlatformHealthReport>({
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
    refetchInterval: 60000, // Refresh every minute
  });

  // Mutation to create snapshot
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

  // Mutation to record daily metrics
  const recordDailyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/platform-health/record-daily", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to record daily metrics");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Daily metrics recorded" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/platform-health"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to record daily metrics", variant: "destructive" });
    },
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNavBar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <StatsGridSkeleton count={4} />
          <div className="mt-8">
            <ChartSkeleton />
          </div>
        </div>
      </div>
    );
  }

  const snapshot = healthReport?.snapshot;
  const apiMetrics = healthReport?.apiMetrics;
  const storage = healthReport?.storage;
  const videoCosts = healthReport?.videoCosts;
  const apiTimeSeries = healthReport?.apiTimeSeries || [];
  const storageTimeSeries = healthReport?.storageTimeSeries || [];
  const costTimeSeries = healthReport?.costTimeSeries || [];
  const recentErrors = healthReport?.recentErrors || [];

  // Prepare storage pie chart data
  const storagePieData = [
    { name: "Videos", value: storage?.videoStorageBytes || 0, color: CHART_COLORS.primary },
    { name: "Images", value: storage?.imageStorageBytes || 0, color: CHART_COLORS.success },
    { name: "Documents", value: storage?.documentStorageBytes || 0, color: CHART_COLORS.warning },
  ].filter(d => d.value > 0);

  // Prepare cost pie chart data
  const costPieData = [
    { name: "Storage", value: videoCosts?.storageCostUsd || 0, color: CHART_COLORS.primary },
    { name: "Bandwidth", value: videoCosts?.bandwidthCostUsd || 0, color: CHART_COLORS.success },
    { name: "Transcoding", value: videoCosts?.transcodingCostUsd || 0, color: CHART_COLORS.warning },
  ].filter(d => d.value > 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavBar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Platform Health</h1>
            <p className="text-gray-600 mt-1">
              Monitor API performance, storage usage, and video hosting costs
            </p>
          </div>
          <div className="flex items-center gap-3 mt-4 md:mt-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => createSnapshotMutation.mutate()}
              disabled={createSnapshotMutation.isPending}
            >
              <Activity className="h-4 w-4 mr-2" />
              Snapshot
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => recordDailyMutation.mutate()}
              disabled={recordDailyMutation.isPending}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Record Daily
            </Button>
          </div>
        </div>

        {/* Alerts */}
        {snapshot?.alerts && snapshot.alerts.length > 0 && (
          <div className="mb-6 space-y-2">
            {snapshot.alerts.map((alert, i) => (
              <div
                key={i}
                className={`p-4 rounded-lg flex items-center gap-3 ${
                  alert.severity === "critical"
                    ? "bg-red-50 border border-red-200"
                    : "bg-yellow-50 border border-yellow-200"
                }`}
              >
                <AlertTriangle
                  className={`h-5 w-5 ${
                    alert.severity === "critical" ? "text-red-600" : "text-yellow-600"
                  }`}
                />
                <span
                  className={
                    alert.severity === "critical" ? "text-red-800" : "text-yellow-800"
                  }
                >
                  {alert.message}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Health Scores */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <HealthScoreCard
            title="Overall Health"
            score={snapshot?.overallHealthScore || 100}
            icon={Activity}
          />
          <HealthScoreCard
            title="API Health"
            score={snapshot?.apiHealthScore || 100}
            icon={Server}
          />
          <HealthScoreCard
            title="Storage Health"
            score={snapshot?.storageHealthScore || 100}
            icon={HardDrive}
          />
          <HealthScoreCard
            title="Database Health"
            score={snapshot?.databaseHealthScore || 100}
            icon={Database}
          />
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
              <Clock className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(apiMetrics?.avgResponseTime || 0).toFixed(0)}ms
              </div>
              <p className="text-xs text-muted-foreground">
                {(apiMetrics?.requestsPerMinute || 0)} requests/min
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(apiMetrics?.errorRate || 0).toFixed(2)}%
              </div>
              <p className="text-xs text-muted-foreground">
                {apiMetrics?.errorRequests || 0} errors / {apiMetrics?.totalRequests || 0} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Storage</CardTitle>
              <HardDrive className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatBytes(storage?.totalStorageBytes || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {storage?.totalFiles || 0} files
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Video Hosting Cost</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${(videoCosts?.totalCostUsd || 0).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                {videoCosts?.totalVideos || 0} videos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* System Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">System Resources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Memory Usage</span>
                <Badge variant={Number(snapshot?.memoryUsagePercent || 0) > 80 ? "destructive" : "secondary"}>
                  {Number(snapshot?.memoryUsagePercent || 0).toFixed(1)}%
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">CPU Load</span>
                <Badge variant={Number(snapshot?.cpuUsagePercent || 0) > 80 ? "destructive" : "secondary"}>
                  {Number(snapshot?.cpuUsagePercent || 0).toFixed(1)}%
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Uptime</span>
                <Badge variant="outline">
                  {formatUptime(Number(snapshot?.uptimeSeconds || 0))}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Storage Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 flex items-center gap-2">
                  <Video className="h-4 w-4" /> Videos
                </span>
                <span className="text-sm font-medium">
                  {formatBytes(storage?.videoStorageBytes || 0)} ({storage?.videoFiles || 0})
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Images
                </span>
                <span className="text-sm font-medium">
                  {formatBytes(storage?.imageStorageBytes || 0)} ({storage?.imageFiles || 0})
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Documents
                </span>
                <span className="text-sm font-medium">
                  {formatBytes(storage?.documentStorageBytes || 0)} ({storage?.documentFiles || 0})
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Video Hosting Costs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Storage</span>
                <span className="text-sm font-medium">
                  ${(videoCosts?.storageCostUsd || 0).toFixed(4)}/mo
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Bandwidth</span>
                <span className="text-sm font-medium">
                  ${(videoCosts?.bandwidthCostUsd || 0).toFixed(4)}/mo
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Transcoding</span>
                <span className="text-sm font-medium">
                  ${(videoCosts?.transcodingCostUsd || 0).toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm text-gray-600 font-medium">Cost per Video</span>
                <span className="text-sm font-bold text-green-600">
                  ${(videoCosts?.costPerVideoUsd || 0).toFixed(4)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for detailed views */}
        <Tabs defaultValue="api" className="space-y-6">
          <TabsList>
            <TabsTrigger value="api">API Performance</TabsTrigger>
            <TabsTrigger value="storage">Storage</TabsTrigger>
            <TabsTrigger value="costs">Video Costs</TabsTrigger>
            <TabsTrigger value="errors">Error Logs</TabsTrigger>
          </TabsList>

          {/* API Performance Tab */}
          <TabsContent value="api" className="space-y-6">
            {/* API Metrics Time Series Chart */}
            <Card>
              <CardHeader>
                <CardTitle>API Response Time & Error Rate</CardTitle>
                <CardDescription>Performance over the last 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                {apiTimeSeries.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={apiTimeSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="avgResponseTime"
                        name="Avg Response Time (ms)"
                        stroke={CHART_COLORS.primary}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="errorRate"
                        name="Error Rate (%)"
                        stroke={CHART_COLORS.danger}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-gray-500">
                    No API metrics data available. Metrics will appear after some API activity.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Endpoints Table */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Top Endpoints</CardTitle>
                  <CardDescription>Most frequently accessed endpoints</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Endpoint</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Requests</TableHead>
                        <TableHead className="text-right">Avg Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(apiMetrics?.topEndpoints || []).slice(0, 10).map((ep, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{ep.endpoint}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{ep.method}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{ep.count}</TableCell>
                          <TableCell className="text-right">{ep.avgTime.toFixed(0)}ms</TableCell>
                        </TableRow>
                      ))}
                      {(!apiMetrics?.topEndpoints || apiMetrics.topEndpoints.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-gray-500">
                            No endpoint data available
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Endpoints with Errors</CardTitle>
                  <CardDescription>Endpoints experiencing errors</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Endpoint</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Errors</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(apiMetrics?.errorsByEndpoint || []).slice(0, 10).map((ep, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{ep.endpoint}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{ep.method}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="destructive">{ep.errorCount}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!apiMetrics?.errorsByEndpoint || apiMetrics.errorsByEndpoint.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-gray-500">
                            No error data available
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Storage Tab */}
          <TabsContent value="storage" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Storage Distribution</CardTitle>
                  <CardDescription>Breakdown by file type</CardDescription>
                </CardHeader>
                <CardContent>
                  {storagePieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={storagePieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name} (${(percent * 100).toFixed(1)}%)`
                          }
                        >
                          {storagePieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => formatBytes(value)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-gray-500">
                      No storage data available
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Storage Over Time</CardTitle>
                  <CardDescription>Storage growth trends</CardDescription>
                </CardHeader>
                <CardContent>
                  {storageTimeSeries.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={storageTimeSeries}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="videoStorageGb"
                          name="Video (GB)"
                          stackId="1"
                          stroke={CHART_COLORS.primary}
                          fill={CHART_COLORS.primary}
                          fillOpacity={0.6}
                        />
                        <Area
                          type="monotone"
                          dataKey="imageStorageGb"
                          name="Images (GB)"
                          stackId="1"
                          stroke={CHART_COLORS.success}
                          fill={CHART_COLORS.success}
                          fillOpacity={0.6}
                        />
                        <Area
                          type="monotone"
                          dataKey="documentStorageGb"
                          name="Documents (GB)"
                          stackId="1"
                          stroke={CHART_COLORS.warning}
                          fill={CHART_COLORS.warning}
                          fillOpacity={0.6}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-gray-500">
                      No storage history available. Click "Record Daily" to start tracking.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Video Costs Tab */}
          <TabsContent value="costs" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Cost Distribution</CardTitle>
                  <CardDescription>Breakdown by cost type</CardDescription>
                </CardHeader>
                <CardContent>
                  {costPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={costPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name} (${(percent * 100).toFixed(1)}%)`
                          }
                        >
                          {costPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => `$${value.toFixed(4)}`}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-gray-500">
                      No cost data available
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Costs Over Time</CardTitle>
                  <CardDescription>Monthly cost trends</CardDescription>
                </CardHeader>
                <CardContent>
                  {costTimeSeries.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={costTimeSeries}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(value: number) => `$${value.toFixed(4)}`} />
                        <Legend />
                        <Bar
                          dataKey="storageCostUsd"
                          name="Storage"
                          stackId="a"
                          fill={CHART_COLORS.primary}
                        />
                        <Bar
                          dataKey="bandwidthCostUsd"
                          name="Bandwidth"
                          stackId="a"
                          fill={CHART_COLORS.success}
                        />
                        <Bar
                          dataKey="transcodingCostUsd"
                          name="Transcoding"
                          stackId="a"
                          fill={CHART_COLORS.warning}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-gray-500">
                      No cost history available. Click "Record Daily" to start tracking.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Video Hosting Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {videoCosts?.totalVideos || 0}
                    </div>
                    <div className="text-sm text-gray-600">Total Videos</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {(videoCosts?.totalVideoStorageGb || 0).toFixed(2)} GB
                    </div>
                    <div className="text-sm text-gray-600">Storage Used</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {(videoCosts?.totalBandwidthGb || 0).toFixed(2)} GB
                    </div>
                    <div className="text-sm text-gray-600">Bandwidth</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {videoCosts?.viewsCount || 0}
                    </div>
                    <div className="text-sm text-gray-600">Total Views</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Error Logs Tab */}
          <TabsContent value="errors" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Error Logs</CardTitle>
                <CardDescription>Last 20 API errors</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentErrors.map((error) => (
                      <TableRow key={error.id}>
                        <TableCell className="text-xs text-gray-500">
                          {error.timestamp
                            ? new Date(error.timestamp).toLocaleString()
                            : "N/A"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {error.endpoint}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{error.method}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              error.statusCode >= 500 ? "destructive" : "secondary"
                            }
                          >
                            {error.statusCode}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {error.errorMessage || "Unknown error"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {recentErrors.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-500">
                          No recent errors - everything is running smoothly!
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
