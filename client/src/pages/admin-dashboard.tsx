import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Users, Building2, TrendingUp, AlertCircle, CheckCircle2, Bell, AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { TopNavBar } from "../components/TopNavBar";
import { StatsGridSkeleton } from "../components/skeletons";
import { apiRequest } from "../lib/queryClient";
import { GenericErrorDialog } from "../components/GenericErrorDialog";

export default function AdminDashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
  }>({
    open: false,
    title: "",
    description: "",
  });

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

  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const response = await fetch("/api/admin/stats", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch admin stats");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  // Fetch companies with risk assessments
  const { data: riskData, isLoading: riskLoading } = useQuery<{
    companies: Array<{
      id: string;
      legalName: string;
      tradeName?: string;
      riskScore: number;
      riskLevel: 'high' | 'medium' | 'low';
      riskIndicators: string[];
    }>;
    summary: {
      total: number;
      highRisk: number;
      mediumRisk: number;
      lowRisk: number;
    };
  }>({
    queryKey: ["/api/admin/companies/risk-assessments"],
    queryFn: async () => {
      const response = await fetch("/api/admin/companies/risk-assessments", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch risk assessments");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const notifyPendingItemsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/notify-pending-items");
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Sent ${data.notificationsSent} notifications for ${data.pendingOffers} pending offers and ${data.pendingPayments} pending payments.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread/count"] });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to send notifications",
      });
    },
  });

  const checkHighRiskMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/check-high-risk-companies");
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Risk Check Complete",
        description: `Found ${data.highRiskCount} high-risk companies. ${data.notificationsSent} new notifications sent.`,
        variant: data.highRiskCount > 0 ? "destructive" : "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread/count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies/risk-assessments"] });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to check high-risk companies",
      });
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-lg">Loading...</div>
    </div>;
  }

  return (
    <div className="space-y-4 sm:space-y-8">
      <TopNavBar />
      <div>
        <h1 className="text-xl sm:text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-0.5 sm:mt-1">Platform oversight and moderation</p>
      </div>

      {statsLoading ? (
        <StatsGridSkeleton />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-6">
          <Card className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between gap-1 sm:gap-2 space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Creators</CardTitle>
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold">{stats?.totalCreators || 0}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                {stats?.newCreatorsThisWeek || 0} this week
              </p>
            </CardContent>
          </Card>

          <Card className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between gap-1 sm:gap-2 space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Companies</CardTitle>
              <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold">{stats?.totalCompanies || 0}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                {stats?.newCompaniesThisWeek || 0} needs review
              </p>
            </CardContent>
          </Card>

          <Card className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between gap-1 sm:gap-2 space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Pending Offers</CardTitle>
              <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold text-primary">{stats?.pendingOffers || 0}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">Live on platform</p>
            </CardContent>
          </Card>

          <Card className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between gap-1 sm:gap-2 space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Pending</CardTitle>
              <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold text-primary">{stats?.pendingCompanies || 0}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">Awaiting approval</p>
            </CardContent>
          </Card>

          <Card className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between gap-1 sm:gap-2 space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Active Offers</CardTitle>
              <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold">{stats?.activeOffers || 0}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">Live on platform</p>
            </CardContent>
          </Card>

          <Card className="border-card-border col-span-2 sm:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between gap-1 sm:gap-2 space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Company Risk</CardTitle>
              <ShieldAlert className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-0.5 sm:gap-1" title="High Risk">
                  <ShieldAlert className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-500" />
                  <span className="text-base sm:text-lg font-bold text-red-600">{riskData?.summary?.highRisk || 0}</span>
                </div>
                <div className="flex items-center gap-0.5 sm:gap-1" title="Medium Risk">
                  <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-500" />
                  <span className="text-base sm:text-lg font-bold text-yellow-600">{riskData?.summary?.mediumRisk || 0}</span>
                </div>
                <div className="flex items-center gap-0.5 sm:gap-1" title="Low Risk">
                  <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500" />
                  <span className="text-base sm:text-lg font-bold text-green-600">{riskData?.summary?.lowRisk || 0}</span>
                </div>
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">High / Medium / Low</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Access Section */}
      <Card className="border-card-border">
        <CardHeader className="p-3 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Quick Access</CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4 mb-3 sm:mb-4">
            <Link to="/admin/reviews">
              <Button variant="outline" className="w-full h-auto py-3 sm:py-6 flex flex-col gap-1 sm:gap-2" data-testid="button-manage-reviews">
                <AlertCircle className="h-4 w-4 sm:h-6 sm:w-6" />
                <span className="text-xs sm:text-sm">Manage Reviews</span>
                <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">View, edit, approve reviews</span>
              </Button>
            </Link>
            <Link to="/admin/companies">
              <Button variant="outline" className="w-full h-auto py-3 sm:py-6 flex flex-col gap-1 sm:gap-2" data-testid="button-manage-companies">
                <Building2 className="h-4 w-4 sm:h-6 sm:w-6" />
                <span className="text-xs sm:text-sm">Manage Companies</span>
                <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Approve new companies</span>
              </Button>
            </Link>
            <Link to="/admin/offers" className="col-span-2 sm:col-span-1">
              <Button variant="outline" className="w-full h-auto py-3 sm:py-6 flex flex-col gap-1 sm:gap-2" data-testid="button-manage-offers">
                <TrendingUp className="h-4 w-4 sm:h-6 sm:w-6" />
                <span className="text-xs sm:text-sm">Manage Offers</span>
                <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Review and approve offers</span>
              </Button>
            </Link>
          </div>
          <div className="border-t pt-3 sm:pt-4">
            <Button
              variant="outline"
              className="w-full text-xs sm:text-sm h-9 sm:h-10"
              onClick={() => notifyPendingItemsMutation.mutate()}
              disabled={notifyPendingItemsMutation.isPending}
            >
              <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
              {notifyPendingItemsMutation.isPending ? "Sending..." : "Refresh Pending Notifications"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-6">
            <CardTitle className="text-sm sm:text-base">Pending Company Approvals</CardTitle>
            <Badge variant="secondary" className="text-xs">{stats?.pendingCompanies || 0}</Badge>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
            {stats?.pendingCompanies > 0 ? (
              <div className="space-y-2 sm:space-y-3">
                <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-4">
                  Companies waiting for verification
                </p>
                <Link to="/admin/companies">
                  <Button variant="outline" className="w-full text-xs sm:text-sm h-8 sm:h-10" data-testid="button-review-companies">
                    Review Companies
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-4 sm:py-8">
                <CheckCircle2 className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground/50 mx-auto mb-1 sm:mb-2" />
                <p className="text-xs sm:text-sm text-muted-foreground">All caught up!</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-6">
            <CardTitle className="text-sm sm:text-base">Pending Offers</CardTitle>
            <Badge variant="secondary" className="text-xs">{stats?.pendingOffers || 0}</Badge>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
            {stats?.pendingOffers > 0 ? (
              <div className="space-y-2 sm:space-y-3">
                <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-4">
                  Offers waiting for review
                </p>
                <Link to="/admin/offers">
                  <Button variant="outline" className="w-full text-xs sm:text-sm h-8 sm:h-10" data-testid="button-review-offers">
                    Review Offers
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-4 sm:py-8">
                <CheckCircle2 className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground/50 mx-auto mb-1 sm:mb-2" />
                <p className="text-xs sm:text-sm text-muted-foreground">All caught up!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Company Risk Overview Section */}
      <Card className="border-card-border">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 sm:p-6">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <ShieldAlert className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            <CardTitle className="text-sm sm:text-base">Company Risk Overview</CardTitle>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Badge variant="destructive" className="text-[10px] sm:text-xs px-1.5 sm:px-2">{riskData?.summary?.highRisk || 0}</Badge>
            <Badge className="bg-yellow-500 hover:bg-yellow-600 text-[10px] sm:text-xs px-1.5 sm:px-2">{riskData?.summary?.mediumRisk || 0}</Badge>
            <Badge className="bg-green-500 hover:bg-green-600 text-[10px] sm:text-xs px-1.5 sm:px-2">{riskData?.summary?.lowRisk || 0}</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
          {riskLoading ? (
            <div className="flex items-center justify-center py-4 sm:py-8">
              <div className="animate-pulse text-xs sm:text-sm text-muted-foreground">Loading risk assessments...</div>
            </div>
          ) : (riskData?.companies?.length || 0) > 0 ? (
            <div className="space-y-3 sm:space-y-4">
              <div className="space-y-2 sm:space-y-3">
                {riskData?.companies?.slice(0, 8).map((company) => {
                  const isHigh = company.riskLevel === 'high';
                  const isMedium = company.riskLevel === 'medium';
                  const borderClass = isHigh
                    ? 'border-red-100 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20'
                    : isMedium
                    ? 'border-yellow-100 dark:border-yellow-900 bg-yellow-50/50 dark:bg-yellow-950/20'
                    : 'border-green-100 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20';
                  const iconBgClass = isHigh
                    ? 'bg-red-100 dark:bg-red-900/50'
                    : isMedium
                    ? 'bg-yellow-100 dark:bg-yellow-900/50'
                    : 'bg-green-100 dark:bg-green-900/50';
                  const textColorClass = isHigh
                    ? 'text-red-600 dark:text-red-400'
                    : isMedium
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-green-600 dark:text-green-400';

                  return (
                    <Link key={company.id} to={`/admin/companies/${company.id}`}>
                      <div
                        className={`flex items-center justify-between p-2 sm:p-3 rounded-lg border ${borderClass} cursor-pointer hover:opacity-80 transition-opacity`}
                      >
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                          <div className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg ${iconBgClass} shrink-0`}>
                            {isHigh ? (
                              <ShieldAlert className={`h-4 w-4 sm:h-5 sm:w-5 ${textColorClass}`} />
                            ) : isMedium ? (
                              <AlertTriangle className={`h-4 w-4 sm:h-5 sm:w-5 ${textColorClass}`} />
                            ) : (
                              <ShieldCheck className={`h-4 w-4 sm:h-5 sm:w-5 ${textColorClass}`} />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-xs sm:text-sm truncate">{company.legalName}</div>
                            <div className={`text-[10px] sm:text-xs ${textColorClass} mt-0.5`}>
                              {isHigh ? 'Risk Score' : isMedium ? 'Risk Score' : 'Risk Score'}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <div className={`text-base sm:text-lg font-bold ${textColorClass}`}>{company.riskScore}</div>
                          <div className={`text-[10px] sm:text-xs ${textColorClass} capitalize`}>{company.riskLevel}</div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
              {(riskData?.companies?.length || 0) > 8 && (
                <Link to="/admin/companies">
                  <Button variant="outline" className="w-full mt-2 sm:mt-4 text-xs sm:text-sm h-8 sm:h-10">
                    View All {riskData?.companies?.length} Companies
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="text-center py-4 sm:py-8">
              <CheckCircle2 className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground/50 mx-auto mb-1 sm:mb-2" />
              <p className="text-xs sm:text-sm text-muted-foreground">No companies to assess</p>
            </div>
          )}
          <div className="border-t pt-3 sm:pt-4 mt-3 sm:mt-4">
            <Button
              variant="outline"
              className="w-full text-xs sm:text-sm h-8 sm:h-10"
              onClick={() => checkHighRiskMutation.mutate()}
              disabled={checkHighRiskMutation.isPending}
            >
              <ShieldAlert className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
              {checkHighRiskMutation.isPending ? "Checking..." : "Check & Identify High Risk Companies"}
            </Button>
          </div>
        </CardContent>
      </Card>

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
