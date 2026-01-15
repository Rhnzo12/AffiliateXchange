import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Users, FileText, TrendingUp, DollarSign, Plus, CheckCircle, MousePointer, AlertTriangle, Clock, ChevronRight, ArrowUpRight } from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "../lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { TopNavBar } from "../components/TopNavBar";
import { StatsGridSkeleton, ListItemSkeleton } from "../components/skeletons";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import { FirstTimeTutorial } from "../components/FirstTimeTutorial";
import { useTutorial } from "../hooks/useTutorial";
import { TUTORIAL_IDS, companyDashboardTutorialConfig } from "../lib/tutorialConfig";
import { useCompanyPageTour } from "../components/CompanyTour";
import { COMPANY_TOUR_IDS, dashboardTourSteps } from "../lib/companyTourConfig";

export default function CompanyDashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);
  const { showTutorial, completeTutorial } = useTutorial(TUTORIAL_IDS.COMPANY_DASHBOARD);

  // Quick tour for new company accounts - only start after tutorial is dismissed
  useCompanyPageTour(COMPANY_TOUR_IDS.DASHBOARD, dashboardTourSteps, !showTutorial);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setErrorDialog({
        title: "Unauthorized",
        message: "You are logged out. Logging in again...",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading]);

  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/company/stats"],
    enabled: isAuthenticated,
  });

  const { data: applications = [], isLoading: loadingApplications } = useQuery<any[]>({
    queryKey: ["/api/company/applications"],
    enabled: isAuthenticated,
  });

  const completeApplicationMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      return await apiRequest('POST', `/api/applications/${applicationId}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company/stats"] });
      toast({
        title: "Work Approved",
        description: "Creator work has been marked as complete.",
      });
    },
    onError: (error: any) => {
      setErrorDialog({
        title: "Error",
        message: error.message || "Failed to mark work as complete",
      });
    },
  });

  const handleMarkComplete = (applicationId: string, creatorName: string) => {
    if (confirm(`Mark work as complete for ${creatorName}? This action cannot be undone.`)) {
      completeApplicationMutation.mutate(applicationId);
    }
  };

  // Calculate top performing creators (by total clicks)
  const topCreators = applications
    .filter((app: any) => app.status === 'approved' || app.status === 'active')
    .reduce((acc: any[], app: any) => {
      // Group by creator
      const existing = acc.find((c: any) => c.creatorId === app.creatorId);
      if (existing) {
        existing.totalClicks += Number(app.clickCount || 0);
        existing.totalConversions += Number(app.conversionCount || 0);
        existing.totalEarnings += Number(app.totalEarnings || 0);
        existing.applicationsCount += 1;
      } else {
        acc.push({
          creatorId: app.creatorId,
          creatorName: app.creatorName || `${app.creator?.firstName} ${app.creator?.lastName}`.trim() || 'Unknown',
          creatorEmail: app.creatorEmail || app.creator?.email,
          creatorProfileImageUrl: app.creator?.profileImageUrl,
          totalClicks: Number(app.clickCount || 0),
          totalConversions: Number(app.conversionCount || 0),
          totalEarnings: Number(app.totalEarnings || 0),
          applicationsCount: 1,
        });
      }
      return acc;
    }, [])
    .sort((a: any, b: any) => b.totalClicks - a.totalClicks)
    .slice(0, 5); // Top 5 creators

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-lg">Loading...</div>
    </div>;
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <TopNavBar />

      {/* Company Approval Pending - Slim notification banner */}
      {stats?.companyProfile?.status === 'pending' && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0" />
          <p className="flex-1 text-sm text-amber-800 dark:text-amber-200">
            <span className="font-medium">Company Approval Pending:</span> Your company registration is under review. You'll be able to create offers once approved.
          </p>
          <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Company Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Manage your offers and track creator performance</p>
        </div>
        {stats?.companyProfile?.status === 'pending' ? (
          <Button
            className="gap-2 w-full h-11 sm:w-auto sm:h-10"
            data-testid="button-create-offer"
            disabled
            title="Your company must be approved before creating offers"
          >
            <Plus className="h-5 w-5 sm:h-4 sm:w-4" />
            <span className="text-base sm:text-sm">Create New Offer</span>
          </Button>
        ) : (
          <Link href="/company/offers/create" className="w-full sm:w-auto">
            <Button className="gap-2 w-full h-11 sm:w-auto sm:h-10" data-testid="button-create-offer">
              <Plus className="h-5 w-5 sm:h-4 sm:w-4" />
              <span className="text-base sm:text-sm">Create New Offer</span>
            </Button>
          </Link>
        )}
      </div>

      {/* Stats Grid - Modern clean design */}
      {statsLoading ? (
        <StatsGridSkeleton />
      ) : (
        <div className="grid gap-4 sm:gap-5 grid-cols-2 lg:grid-cols-4">
          {/* 1. Live Offers */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-600">Live Offers</span>
              <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
                <ArrowUpRight className="h-4 w-4 text-teal-600" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900">{stats?.liveOffers || 0}</div>
            <p className="text-xs text-gray-500 mt-1">
              {stats?.draftOffers || 0} drafts
            </p>
          </div>

          {/* 2. Pending Applications */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-600">Pending Applications</span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                <FileText className="h-4 w-4 text-amber-600" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900">{stats?.pendingApplications || 0}</div>
            <p className="text-xs text-gray-500 mt-1">
              All time
            </p>
          </div>

          {/* 3. Active Creators */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-600">Active Creators</span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900">{stats?.activeCreators || 0}</div>
            <p className="text-xs text-gray-500 mt-1">
              Working on offers
            </p>
          </div>

          {/* 4. Total Earnings */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-600">Total Earnings</span>
              <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900">${((stats?.totalEarnings || 0) / 100).toFixed(0)}</div>
            <p className="text-xs text-gray-500 mt-1">
              {stats?.conversions || 0} conversions
            </p>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        {/* Recent Applications - Clean modern design */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-gray-50">
            <h3 className="font-semibold text-gray-900">Recent Applications</h3>
            <Link href="/company/applications">
              <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary transition-colors">
                View All <ChevronRight className="h-4 w-4" />
              </button>
            </Link>
          </div>
          <div className="p-5">
            {loadingApplications ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-gray-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 bg-gray-200 rounded" />
                      <div className="h-3 w-48 bg-gray-200 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : applications.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                  <FileText className="h-7 w-7 text-gray-300" />
                </div>
                <p className="text-sm text-gray-500">No applications yet</p>
                <p className="text-xs text-gray-400 mt-1">Applications will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {applications.slice(0, 4).map((app: any) => (
                  <div key={app.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors group" data-testid={`application-${app.id}`}>
                    <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                      <AvatarImage src={app.creator?.profileImageUrl} alt={app.creatorName} />
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">
                        {app.creatorName?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h4 className="font-medium text-sm text-gray-900 truncate" data-testid={`text-creator-${app.id}`}>{app.creatorName}</h4>
                        <Badge
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            app.status === 'completed' ? 'bg-green-100 text-green-700 border-0' :
                            app.status === 'approved' || app.status === 'active' ? 'bg-blue-100 text-blue-700 border-0' :
                            app.status === 'pending' ? 'bg-amber-100 text-amber-700 border-0' :
                            'bg-gray-100 text-gray-600 border-0'
                          }`}
                          data-testid={`badge-status-${app.id}`}
                        >
                          {app.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 truncate" data-testid={`text-offer-${app.id}`}>{app.offerTitle}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    {(app.status === 'approved' || app.status === 'active') && (
                      <Button
                        size="sm"
                        onClick={() => handleMarkComplete(app.id, app.creatorName)}
                        disabled={completeApplicationMutation.isPending}
                        className="gap-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`button-complete-${app.id}`}
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        Complete
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Leaderboard - Clean modern design */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-gray-50">
            <div>
              <h3 className="font-semibold text-gray-900">Leaderboard</h3>
              <p className="text-xs text-gray-500 mt-0.5">Top performing creators</p>
            </div>
            <Link href="/company/analytics">
              <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary transition-colors">
                View Full Leaderboard <ChevronRight className="h-4 w-4" />
              </button>
            </Link>
          </div>
          <div className="p-5">
            {topCreators.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                  <Users className="h-7 w-7 text-gray-300" />
                </div>
                <p className="text-sm text-gray-500">No active creators yet</p>
                <p className="text-xs text-gray-400 mt-1">Creator rankings will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topCreators.slice(0, 4).map((creator: any, index: number) => (
                  <div key={creator.creatorId} className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm ${
                      index === 0 ? 'bg-amber-100 text-amber-700' :
                      index === 1 ? 'bg-gray-100 text-gray-600' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-50 text-gray-500'
                    }`}>
                      {index + 1}
                    </div>
                    <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                      <AvatarImage src={creator.creatorProfileImageUrl} alt={creator.creatorName} />
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">
                        {creator.creatorName?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{creator.creatorName}</p>
                      <p className="text-xs text-gray-500 truncate">{creator.creatorEmail}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <span className="font-semibold text-sm text-gray-900">${Number(creator.totalEarnings).toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-gray-400">earned</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <GenericErrorDialog
        open={!!errorDialog}
        onOpenChange={(open) => !open && setErrorDialog(null)}
        title={errorDialog?.title || "Error"}
        description={errorDialog?.message || "An error occurred"}
      />

      <FirstTimeTutorial
        open={showTutorial}
        onComplete={completeTutorial}
        config={companyDashboardTutorialConfig}
      />
    </div>
  );
}
