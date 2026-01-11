import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import { FirstTimeTutorial } from "../components/FirstTimeTutorial";
import { useTutorial } from "../hooks/useTutorial";
import { TUTORIAL_IDS, creatorDashboardTutorialConfig } from "../lib/tutorialConfig";
import { useCreatorPageTour } from "../components/CreatorTour";
import { CREATOR_TOUR_IDS, dashboardTourSteps } from "../lib/creatorTourConfig";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Heart,
  Play,
  Settings,
  ChevronRight,
  DollarSign,
  Target,
  MousePointerClick,
  Wallet,
  CreditCard,
  ExternalLink,
  BookOpen,
  Lightbulb,
  ArrowRight,
  Eye,
  Percent,
  Clock,
  Megaphone,
} from "lucide-react";
import { Link } from "wouter";
import { proxiedSrc } from "../lib/image";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";

// Helper function to format commission display
const formatCommission = (offer: any) => {
  if (offer.commissionAmount) {
    return `CA$${offer.commissionAmount}`;
  } else if (offer.commissionPercentage) {
    return `${offer.commissionPercentage}%`;
  } else if (offer.commissionRate) {
    return `CA$${offer.commissionRate}`;
  }
  return "CA$0";
};

// Helper to get commission percentage value for display
const getCommissionPercent = (offer: any) => {
  if (offer.commissionPercentage) {
    return `${offer.commissionPercentage}%`;
  } else if (offer.commissionAmount) {
    return `CA$${offer.commissionAmount}`;
  }
  return "10%";
};

// Helper to format niche label
const formatNicheLabel = (niche: string) => {
  return niche
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default function CreatorDashboard() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);
  const { showTutorial, completeTutorial } = useTutorial(TUTORIAL_IDS.CREATOR_DASHBOARD);

  // Quick Guide Tour - only starts after initial tutorial is dismissed
  useCreatorPageTour(CREATOR_TOUR_IDS.DASHBOARD, dashboardTourSteps, !showTutorial);

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

  const { data: recommendedOffersData, isLoading: offersLoading } = useQuery<any>({
    queryKey: ["/api/offers/recommended"],
    enabled: isAuthenticated,
  });

  // Fetch all offers for top converting
  const { data: allOffers = [] } = useQuery<any[]>({
    queryKey: ["/api/offers"],
    enabled: isAuthenticated,
  });

  // Fetch applications to count pending
  const { data: applications = [] } = useQuery<any[]>({
    queryKey: ["/api/applications"],
    enabled: isAuthenticated,
  });

  // Fetch payment/wallet data
  const { data: walletData } = useQuery<any>({
    queryKey: ["/api/wallet"],
    enabled: isAuthenticated,
  });

  const {
    data: analytics,
    isLoading: activityLoading,
  } = useQuery<any>({
    queryKey: ["/api/analytics", { range: "7d" }],
    queryFn: async () => {
      const res = await fetch(`/api/analytics?range=7d`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/api/login";
          throw new Error("Unauthorized");
        }
        throw new Error("Failed to fetch activity");
      }
      return res.json();
    },
    enabled: isAuthenticated,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const activityChartData = useMemo(
    () =>
      (analytics?.chartData || []).map((item: any) => ({
        date: item.date,
        clicks: Number(item.clicks || 0),
        conversions: Number(item.conversions || 0),
        earnings: Number(item.earnings || 0),
      })),
    [analytics?.chartData]
  );

  // Handle the recommended offers response
  const recommendedOffers = Array.isArray(recommendedOffersData) ? recommendedOffersData : [];
  const hasNoNiches = recommendedOffersData?.error === 'no_niches';
  const profileNotFound = recommendedOffersData?.error === 'profile_not_found';

  // Calculate stats
  const totalEarnings = analytics?.summary?.totalEarnings || 0;
  const totalClicks = analytics?.summary?.totalClicks || 0;
  const totalConversions = analytics?.summary?.totalConversions || 0;
  const conversionRate = totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(1) : "0.0";

  // Top converting offers - sort by conversion metrics or commission
  const topConvertingOffers = useMemo(() => {
    if (!Array.isArray(allOffers)) return [];
    return [...allOffers]
      .sort((a, b) => (b.commissionPercentage || b.commissionAmount || 0) - (a.commissionPercentage || a.commissionAmount || 0))
      .slice(0, 3);
  }, [allOffers]);

  // Payment balance
  const paymentBalance = walletData?.balance || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6 space-y-4 sm:space-y-5 md:space-y-6">
        {/* Welcome Header */}
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-foreground">
            Welcome back, {user?.firstName || 'Creator'}!
          </h1>
          <p className="text-[11px] sm:text-xs md:text-sm text-muted-foreground mt-0.5">
            Here's what's happening with your affiliate account.
          </p>
        </div>

        {/* Your Earnings Overview - Compact on Mobile */}
        <Card>
          <CardContent className="p-3 sm:p-4 md:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h2 className="text-sm sm:text-base md:text-lg font-semibold">Your Earnings Overview</h2>
              <Link href="/creator/payment-settings">
                <Button size="sm" className="bg-primary hover:bg-primary/90 text-[10px] sm:text-xs h-7 sm:h-8 px-2.5 sm:px-3">
                  <Wallet className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
                  Get Paid
                </Button>
              </Link>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4">
              <div>
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">
                  CA${totalEarnings.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 mt-1">
                  <span className="text-[10px] sm:text-xs text-muted-foreground">Total earnings</span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground">Last 7 days</span>
                </div>
              </div>

              {/* Mini Chart - Hidden on smallest screens */}
              <div className="hidden sm:block h-16 w-32 md:w-40">
                {activityLoading ? (
                  <div className="h-full w-full rounded bg-muted animate-pulse" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={activityChartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="earnings"
                        stroke="#10b981"
                        fill="url(#earningsGradient)"
                        strokeWidth={2}
                      />
                      <Tooltip
                        formatter={(value: number) => [`CA$${value.toFixed(2)}`, 'Earnings']}
                        contentStyle={{ fontSize: '10px' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-3 sm:mt-4">
              <Link href="/analytics" className="flex-1">
                <Button variant="ghost" size="sm" className="w-full justify-start text-[10px] sm:text-xs h-7 sm:h-8 px-2">
                  View full analytics
                  <ChevronRight className="h-3 w-3 ml-auto" />
                </Button>
              </Link>
              <Link href="/browse" className="flex-1 sm:flex-none">
                <Button size="sm" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-[10px] sm:text-xs h-7 sm:h-8 px-3">
                  View New Offers
                  <ArrowRight className="h-3 w-3 ml-1.5" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Recommended Offers - List on Mobile */}
        <div>
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h2 className="text-sm sm:text-base md:text-lg font-semibold">Recommended Offers</h2>
            <Link href="/browse" className="text-[10px] sm:text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
              View all tasks
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          {offersLoading ? (
            <div className="space-y-2 sm:space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-2.5 sm:p-3 flex items-center gap-2.5 sm:gap-3">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-muted flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="h-3.5 bg-muted rounded w-32 mb-1.5" />
                      <div className="h-3 bg-muted rounded w-20" />
                    </div>
                    <div className="h-7 w-16 bg-muted rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : hasNoNiches || profileNotFound ? (
            <Card>
              <CardContent className="p-6 sm:p-8 text-center">
                <Settings className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/50 mx-auto mb-2 sm:mb-3" />
                <p className="font-medium text-xs sm:text-sm">Set Your Content Niches</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 mb-2 sm:mb-3">
                  Add your content niches to get personalized recommendations
                </p>
                <Link href="/settings">
                  <Button size="sm" className="text-[10px] sm:text-xs h-7 sm:h-8">
                    <Settings className="h-3 w-3 mr-1" />
                    Update Profile
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : !recommendedOffers || recommendedOffers.length === 0 ? (
            <Card>
              <CardContent className="p-6 sm:p-8 text-center">
                <Heart className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/50 mx-auto mb-2 sm:mb-3" />
                <p className="text-muted-foreground text-xs sm:text-sm">No recommended offers yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {recommendedOffers.slice(0, 3).map((offer: any) => (
                <Card key={offer.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-2.5 sm:p-3">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      {/* Offer Image */}
                      <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {offer.featuredImageUrl ? (
                          <img
                            src={proxiedSrc(offer.featuredImageUrl)}
                            alt={offer.title}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <Play className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground/50" />
                        )}
                      </div>

                      {/* Offer Details */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-[11px] sm:text-xs md:text-sm truncate">{offer.title}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {offer.primaryNiche && (
                            <Badge variant="secondary" className="text-[8px] sm:text-[9px] px-1 py-0 h-4">
                              {formatNicheLabel(offer.primaryNiche)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">
                          {getCommissionPercent(offer)} per sale
                        </p>
                      </div>

                      {/* View Offer Button */}
                      <Link href={`/offers/${offer.id}`}>
                        <Button size="sm" className="bg-primary hover:bg-primary/90 text-[9px] sm:text-[10px] h-6 sm:h-7 px-2 sm:px-2.5 flex-shrink-0">
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

        {/* Two Column Section: Recommended Offers (more) + Tips & Resources */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {/* More Recommended Offers */}
          <div>
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <h2 className="text-sm sm:text-base font-semibold">Recommended Offers</h2>
              <Link href="/browse" className="text-[10px] sm:text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-2 sm:space-y-3">
              {recommendedOffers.slice(3, 5).map((offer: any) => (
                <Card key={offer.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-2.5 sm:p-3">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {offer.featuredImageUrl ? (
                          <img
                            src={proxiedSrc(offer.featuredImageUrl)}
                            alt={offer.title}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <Play className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground/50" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-[11px] sm:text-xs truncate">{offer.title}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {offer.primaryNiche && (
                            <Badge variant="secondary" className="text-[8px] sm:text-[9px] px-1 py-0 h-4">
                              {formatNicheLabel(offer.primaryNiche)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">
                          {getCommissionPercent(offer)} per sale
                        </p>
                      </div>
                      <Link href={`/offers/${offer.id}`}>
                        <Button size="sm" className="bg-primary hover:bg-primary/90 text-[9px] sm:text-[10px] h-6 sm:h-7 px-2 sm:px-2.5 flex-shrink-0">
                          View Offer
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Tips & Resources */}
          <div>
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <h2 className="text-sm sm:text-base font-semibold">Tips & Resources</h2>
              <Link href="/help" className="text-[10px] sm:text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-2 sm:space-y-3">
              <Link href="/help/affiliate-tips" className="block group">
                <Card className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-2.5 sm:p-3">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Lightbulb className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-[11px] sm:text-xs group-hover:text-primary transition-colors">10 Affiliate Marketing Tips for Success</h4>
                        <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">Learn more about affiliate marketing</p>
                      </div>
                      <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/help/getting-started" className="block group">
                <Card className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-2.5 sm:p-3">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-[11px] sm:text-xs group-hover:text-primary transition-colors">Getting Started with Affiliate Links</h4>
                        <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">Kickstart guide for beginners</p>
                      </div>
                      <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/creator/payment-settings">
                <Button variant="outline" size="sm" className="w-full justify-between text-[10px] sm:text-xs h-8 sm:h-9 mt-1">
                  <span className="flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5" />
                    Withdraw Funds
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Top Converting Offers - Horizontal Scroll on Mobile */}
        <div>
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h2 className="text-sm sm:text-base md:text-lg font-semibold">Top Converting Offers</h2>
            <Link href="/browse" className="text-[10px] sm:text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          {topConvertingOffers.length > 0 ? (
            <div className="flex gap-2.5 sm:gap-3 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 sm:overflow-visible scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {topConvertingOffers.map((offer: any) => (
                <Card key={offer.id} className="flex-shrink-0 w-[140px] sm:w-auto hover:shadow-sm transition-shadow">
                  <CardContent className="p-2.5 sm:p-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                      <div className="h-16 w-full sm:h-10 sm:w-10 md:h-12 md:w-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {offer.featuredImageUrl ? (
                          <img
                            src={proxiedSrc(offer.featuredImageUrl)}
                            alt={offer.title}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <Target className="h-5 w-5 text-muted-foreground/50" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-[10px] sm:text-xs truncate">{offer.title}</h3>
                        <p className="text-[9px] sm:text-[10px] text-muted-foreground">
                          {getCommissionPercent(offer)} per sale
                        </p>
                      </div>
                    </div>
                    <Link href={`/offers/${offer.id}`} className="mt-2 block">
                      <Button size="sm" className="w-full bg-primary hover:bg-primary/90 text-[9px] sm:text-[10px] h-6 sm:h-7">
                        <Megaphone className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                        Promote
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-4 sm:p-6 text-center">
                <Target className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  Start promoting offers to see your top performers
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Payment Balance */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm sm:text-base font-semibold mb-1">Payment Balance</h2>
                <div className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
                  CA${paymentBalance.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge variant="secondary" className="text-[8px] sm:text-[9px] px-1.5 py-0 h-4">
                    <DollarSign className="h-2.5 w-2.5 mr-0.5" />
                    AffiliateXchange
                  </Badge>
                  <span className="text-[9px] sm:text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    7 Days
                  </span>
                </div>
              </div>
              <Link href="/creator/payment-settings">
                <Button variant="outline" size="sm" className="text-[10px] sm:text-xs h-7 sm:h-8 px-2.5 sm:px-3">
                  <CreditCard className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
                  Payment Methods
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats - Compact on Mobile */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <Card>
            <CardContent className="p-2.5 sm:p-3 text-center">
              <div className="text-base sm:text-lg md:text-xl font-bold text-foreground">
                {totalClicks.toLocaleString()}
              </div>
              <div className="text-[9px] sm:text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
                <MousePointerClick className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                Clicks
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2.5 sm:p-3 text-center">
              <div className="text-base sm:text-lg md:text-xl font-bold text-foreground">
                CA${totalEarnings.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[9px] sm:text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
                <DollarSign className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                Earnings
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2.5 sm:p-3 text-center">
              <div className="text-base sm:text-lg md:text-xl font-bold text-foreground">
                {conversionRate}%
              </div>
              <div className="text-[9px] sm:text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
                <Percent className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                Conversion
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <GenericErrorDialog
        open={!!errorDialog}
        onOpenChange={(open) => !open && setErrorDialog(null)}
        title={errorDialog?.title}
        description={errorDialog?.message}
      />

      <FirstTimeTutorial
        open={showTutorial}
        onComplete={completeTutorial}
        config={creatorDashboardTutorialConfig}
      />
    </div>
  );
}
