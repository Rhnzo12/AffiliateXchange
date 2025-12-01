import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  TrendingUp,
  Heart,
  Play,
  Settings,
  Search,
  ClipboardList,
  DollarSign,
  CreditCard,
  ArrowUpRight,
} from "lucide-react";
import { Link } from "wouter";
import { proxiedSrc } from "../lib/image";
import { TopNavBar } from "../components/TopNavBar";
import { OfferCardSkeleton } from "../components/skeletons";

// Helper function to format commission display
const formatCommission = (offer: any) => {
  if (offer.commissionAmount) {
    return `$${offer.commissionAmount}`;
  } else if (offer.commissionPercentage) {
    return `${offer.commissionPercentage}%`;
  } else if (offer.commissionRate) {
    return `$${offer.commissionRate}`;
  }
  return "$0";
};

// Mini sparkline component for the analytics banner
const MiniSparkline = () => (
  <svg width="100" height="40" viewBox="0 0 100 40" className="text-primary">
    <path
      d="M0 35 L15 30 L30 32 L45 25 L60 28 L75 15 L90 18 L100 8"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M0 35 L15 30 L30 32 L45 25 L60 28 L75 15 L90 18 L100 8 L100 40 L0 40 Z"
      fill="currentColor"
      fillOpacity="0.1"
    />
  </svg>
);

export default function CreatorDashboard() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);

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

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/creator/stats"],
    enabled: isAuthenticated,
  });

  const { data: recommendedOffersData, isLoading: offersLoading } = useQuery<any>({
    queryKey: ["/api/offers/recommended"],
    enabled: isAuthenticated,
  });

  // Handle the recommended offers response
  const recommendedOffers = Array.isArray(recommendedOffersData) ? recommendedOffersData : [];
  const hasNoNiches = recommendedOffersData?.error === 'no_niches';
  const profileNotFound = recommendedOffersData?.error === 'profile_not_found';

  const quickActions = [
    {
      title: "Browse Offers",
      description: "Find new campaigns that fit your audience and start applying in seconds.",
      href: "/browse",
      icon: Search,
      cta: "Find offers",
    },
    {
      title: "View Applications",
      description: "Track statuses, respond to brands, and keep your pitches up to date.",
      href: "/applications",
      icon: ClipboardList,
      cta: "Manage applications",
    },
    {
      title: "Open Analytics",
      description: "Monitor clicks, conversions, and earnings with the full analytics suite.",
      href: "/analytics",
      icon: TrendingUp,
      cta: "View analytics",
    },
    {
      title: "Update Profile & Niches",
      description: "Tune your creator profile so recommendations stay aligned with your audience.",
      href: "/settings",
      icon: Settings,
      cta: "Edit profile",
    },
    {
      title: "Payment Settings",
      description: "Confirm payout details to make sure you get paid without delays.",
      href: "/creator/payment-settings",
      icon: CreditCard,
      cta: "Manage payouts",
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TopNavBar />
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {user?.firstName || 'Creator'}!</h1>
        <p className="text-muted-foreground mt-1">Here's an overview of your creator journey</p>
      </div>

      {/* Analytics Snapshot Banner */}
      <Card className="border-card-border bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Your Analytics Snapshot</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">${stats?.totalEarnings || '0.00'}</span>
                    <span className="text-xs text-muted-foreground">Last 7 Days</span>
                  </div>
                </div>
              </div>
              <div className="hidden sm:block">
                <MiniSparkline />
              </div>
            </div>
            <Link href="/analytics">
              <Button className="gap-2 bg-primary hover:bg-primary/90">
                <TrendingUp className="h-4 w-4" />
                Go to Full Analytics
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Performance section replaced with quick actions */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xl font-semibold">Quick Actions</h2>
          <span className="text-sm text-muted-foreground">Pick where to go next</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Card key={action.title} className="border-card-border h-full">
                <CardContent className="p-6 flex flex-col gap-4 h-full">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold leading-tight">{action.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-auto">
                    <Badge variant="secondary" className="px-2 py-1 text-xs">Creator shortcut</Badge>
                    <Link href={action.href}>
                      <Button size="sm" className="gap-2">
                        {action.cta}
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recommended For You */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Recommended For You</h2>
          <p className="text-sm text-muted-foreground">Offers matching niche nierd audience</p>
        </div>

        {offersLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="border-card-border animate-pulse">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-14 w-14 rounded-lg bg-muted" />
                  <div className="flex-1">
                    <div className="h-5 bg-muted rounded w-32 mb-2" />
                    <div className="h-4 bg-muted rounded w-48" />
                  </div>
                  <div className="h-9 bg-muted rounded w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : hasNoNiches ? (
          <Card className="border-card-border">
            <CardContent className="p-12 text-center">
              <Settings className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">Set Your Content Niches</p>
              <p className="text-sm text-muted-foreground mt-2 mb-4">
                Please add your content niches in your profile to get personalized offer recommendations
              </p>
              <Link href="/settings">
                <Button>
                  <Settings className="h-4 w-4 mr-2" />
                  Update Profile
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : profileNotFound ? (
          <Card className="border-card-border">
            <CardContent className="p-12 text-center">
              <Heart className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">Complete your profile first</p>
              <p className="text-sm text-muted-foreground mt-2 mb-4">
                Create your creator profile to get personalized recommendations
              </p>
              <Link href="/settings">
                <Button>Complete Profile</Button>
              </Link>
            </CardContent>
          </Card>
        ) : !recommendedOffers || recommendedOffers.length === 0 ? (
          <Card className="border-card-border">
            <CardContent className="p-12 text-center">
              <Heart className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No recommended offers yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Check back soon for new offers matching your niches
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendedOffers.slice(0, 4).map((offer: any) => (
              <Card 
                key={offer.id} 
                className="border-card-border hover:shadow-md hover:border-primary/30 transition-all duration-200"
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Offer Icon/Image */}
                    <div className="h-14 w-14 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 overflow-hidden">
                      {offer.featuredImageUrl ? (
                        <img 
                          src={proxiedSrc(offer.featuredImageUrl)} 
                          alt={offer.title} 
                          className="w-full h-full object-cover rounded-lg" 
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-md bg-primary/20 flex items-center justify-center">
                          <Play className="h-4 w-4 text-primary" />
                        </div>
                      )}
                    </div>

                    {/* Offer Details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base truncate">{offer.title}</h3>
                      <p className="text-sm text-muted-foreground truncate">
                        Track earnings at your in iche audens of {formatCommission(offer)} per sale
                      </p>
                    </div>

                    {/* View Offer Button */}
                    <Link href={`/offers/${offer.id}`}>
                      <Button size="sm" className="shrink-0">
                        View Offer
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <GenericErrorDialog
        open={!!errorDialog}
        onOpenChange={(open) => !open && setErrorDialog(null)}
        title={errorDialog?.title}
        description={errorDialog?.message}
      />
    </div>
  );
}