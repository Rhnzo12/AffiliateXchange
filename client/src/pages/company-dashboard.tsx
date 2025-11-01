import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, FileText, TrendingUp, DollarSign, Plus, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";

export default function CompanyDashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: stats } = useQuery<any>({
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
      toast({
        title: "Error",
        description: error.message || "Failed to mark work as complete",
        variant: "destructive",
      });
    },
  });

  const handleMarkComplete = (applicationId: string, creatorName: string) => {
    if (confirm(`Mark work as complete for ${creatorName}? This action cannot be undone.`)) {
      completeApplicationMutation.mutate(applicationId);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-lg">Loading...</div>
    </div>;
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Company Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Manage your offers and track creator performance</p>
        </div>
        <Link href="/company/offers/create" className="w-full sm:w-auto">
          <Button className="gap-2 w-full h-11 sm:w-auto sm:h-10" data-testid="button-create-offer">
            <Plus className="h-5 w-5 sm:h-4 sm:w-4" />
            <span className="text-base sm:text-sm">Create New Offer</span>
          </Button>
        </Link>
      </div>

      {/* Stats Grid - Improved mobile spacing */}
      <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4">
        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2 p-4 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Active Creators</CardTitle>
            <Users className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{stats?.activeCreators || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.pendingApplications || 0} pending
            </p>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2 p-4 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Live Offers</CardTitle>
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{stats?.liveOffers || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.draftOffers || 0} drafts
            </p>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2 p-4 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Applications</CardTitle>
            <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{stats?.totalApplications || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2 p-4 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Clicks</CardTitle>
            <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{stats?.totalClicks || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.conversions || 0} conversions
            </p>
          </CardContent>
        </Card>
      </div>

      {stats?.companyProfile?.status === 'pending' && (
        <Card className="border-card-border bg-muted/50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Company Approval Pending</h3>
                <p className="text-sm text-muted-foreground">
                  Your company registration is under review. You'll be able to create offers once approved.
                </p>
              </div>
              <Badge variant="secondary">Pending</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle>Recent Applications</CardTitle>
            <Badge variant="secondary" data-testid="badge-applications-count">{applications.length}</Badge>
          </CardHeader>
          <CardContent>
            {loadingApplications ? (
              <div className="text-center py-8">
                <div className="animate-pulse text-sm text-muted-foreground">Loading applications...</div>
              </div>
            ) : applications.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No applications yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {applications.slice(0, 5).map((app: any) => (
                  <div key={app.id} className="flex items-start justify-between gap-4 p-3 rounded-md border border-border hover-elevate" data-testid={`application-${app.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="font-medium text-sm truncate" data-testid={`text-creator-${app.id}`}>{app.creatorName}</h4>
                        <Badge 
                          variant={
                            app.status === 'completed' ? 'default' : 
                            app.status === 'approved' || app.status === 'active' ? 'secondary' : 
                            'outline'
                          }
                          data-testid={`badge-status-${app.id}`}
                        >
                          {app.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate" data-testid={`text-offer-${app.id}`}>{app.offerTitle}</p>
                      <p className="text-xs text-tertiary-foreground mt-1">
                        {formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    {(app.status === 'approved' || app.status === 'active') && (
                      <Button 
                        size="sm" 
                        onClick={() => handleMarkComplete(app.id, app.creatorName)}
                        disabled={completeApplicationMutation.isPending}
                        className="gap-1"
                        data-testid={`button-complete-${app.id}`}
                      >
                        <CheckCircle className="h-3 w-3" />
                        Complete
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader>
            <CardTitle>Top Performing Creators</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Users className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No creators yet</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
