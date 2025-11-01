import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DollarSign, TrendingUp, MousePointerClick, Target, Download } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const DATE_RANGES = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "all", label: "All Time" },
];

export default function Analytics() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [dateRange, setDateRange] = useState("30d");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = "/login";
    }
  }, [isAuthenticated, isLoading]);

  const { data: analytics, isLoading: analyticsLoading, error } = useQuery<any>({
    queryKey: ["/api/analytics", { range: dateRange }],
    queryFn: async () => {
      const url = `/api/analytics?range=${dateRange}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/login";
          throw new Error('Unauthorized');
        }
        throw new Error('Failed to fetch analytics');
      }
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const chartData = analytics?.chartData || [];

  const exportData = () => {
    if (!analytics) {
      toast({
        title: "No data to export",
        description: "There is no analytics data available",
        variant: "destructive",
      });
      return;
    }

    // Create CSV content
    const csvContent = [
      ['Date', 'Clicks', 'Conversions', 'Earnings'],
      ...chartData.map((item: any) => [
        item.date,
        item.clicks || 0,
        item.conversions || 0,
        item.earnings || 0
      ])
    ].map(row => row.join(',')).join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Data exported",
      description: "Your analytics data has been downloaded as CSV",
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-lg">Loading...</div>
    </div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1">Track your performance across all offers</p>
        </div>
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40" data-testid="select-date-range">
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
            data-testid="button-export" 
            className="gap-2"
            onClick={exportData}
            disabled={!analytics || chartData.length === 0}
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              ${Number(analytics?.totalEarnings || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-green-600">+{analytics?.earningsGrowth || 0}%</span> from last period
            </p>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Offers</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.activeOffers || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently promoting
            </p>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.totalClicks || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics?.uniqueClicks || 0} unique visitors
            </p>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(analytics?.conversionRate || 0).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics?.conversions || 0} conversions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="border-card-border">
        <CardHeader>
          <CardTitle>Clicks Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {analyticsLoading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="animate-pulse text-muted-foreground">Loading chart data...</div>
            </div>
          ) : chartData.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="clicks"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-12">
              <MousePointerClick className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No tracking data yet</p>
              <p className="text-sm text-muted-foreground mt-1">Your click data will appear here once you start promoting offers</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-Offer Breakdown */}
      <Card className="border-card-border">
        <CardHeader>
          <CardTitle>Performance by Offer</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics?.offerBreakdown && analytics.offerBreakdown.length > 0 ? (
            <div className="space-y-4">
              {analytics.offerBreakdown.map((offer: any) => (
                <div key={offer.offerId} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-semibold">{offer.offerTitle}</h4>
                    <p className="text-sm text-muted-foreground">{offer.companyName}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-6 text-center">
                    <div>
                      <div className="text-xs text-muted-foreground">Clicks</div>
                      <div className="font-semibold">{offer.clicks || 0}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Conv.</div>
                      <div className="font-semibold">{offer.conversions || 0}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Earned</div>
                      <div className="font-semibold font-mono">${Number(offer.earnings || 0).toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <TrendingUp className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No active offers yet</p>
              <p className="text-sm text-muted-foreground mt-1">Apply to offers to start tracking performance</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}