import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Building2, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";

export default function AdminDashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

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
    queryKey: ["/api/admin/stats"],
    enabled: isAuthenticated,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-lg">Loading...</div>
    </div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Platform oversight and moderation</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.newUsersThisWeek || 0} this week
            </p>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Companies</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats?.pendingCompanies || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Require review</p>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Offers</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats?.pendingOffers || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Offers</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeOffers || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Live on platform</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Access Section */}
      <Card className="border-card-border">
        <CardHeader>
          <CardTitle>Quick Access</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <Link to="/admin/reviews">
              <Button variant="outline" className="w-full h-auto py-6 flex flex-col gap-2" data-testid="button-manage-reviews">
                <AlertCircle className="h-6 w-6" />
                <span>Manage Reviews</span>
                <span className="text-xs text-muted-foreground">View, edit, approve reviews</span>
              </Button>
            </Link>
            <Link to="/admin/companies">
              <Button variant="outline" className="w-full h-auto py-6 flex flex-col gap-2" data-testid="button-manage-companies">
                <Building2 className="h-6 w-6" />
                <span>Manage Companies</span>
                <span className="text-xs text-muted-foreground">Approve or reject companies</span>
              </Button>
            </Link>
            <Link to="/admin/offers">
              <Button variant="outline" className="w-full h-auto py-6 flex flex-col gap-2" data-testid="button-manage-offers">
                <TrendingUp className="h-6 w-6" />
                <span>Manage Offers</span>
                <span className="text-xs text-muted-foreground">Review and approve offers</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Pending Company Approvals</CardTitle>
            <Badge variant="secondary">{stats?.pendingCompanies || 0}</Badge>
          </CardHeader>
          <CardContent>
            {stats?.pendingCompanies > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground mb-4">
                  Companies waiting for verification
                </p>
                <Link to="/admin/companies">
                  <Button variant="outline" className="w-full" data-testid="button-review-companies">
                    Review Companies
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">All caught up!</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Pending Offer Approvals</CardTitle>
            <Badge variant="secondary">{stats?.pendingOffers || 0}</Badge>
          </CardHeader>
          <CardContent>
            {stats?.pendingOffers > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground mb-4">
                  Offers waiting for review
                </p>
                <Link to="/admin/offers">
                  <Button variant="outline" className="w-full" data-testid="button-review-offers">
                    Review Offers
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">All caught up!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
