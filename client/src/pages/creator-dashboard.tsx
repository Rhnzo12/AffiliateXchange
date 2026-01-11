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
  Bell,
  BarChart3,
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

  // Pending offers count
  const pendingApplications = applications.filter((app: any) => app.status === 'pending').length;

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

        {/* ========== MOBILE LAYOUT ========== */}
        <div className="md:hidden space-y-4">
          {/* Mobile: Your Earnings Overview */}
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">Your Earnings Overview</h2>
                <Link href="/creator/payment-settings">
                  <Button size="sm" className="bg-primary hover:bg-primary/90 text-[10px] h-6 px-2">
                    <Wallet className="h-3 w-3 mr-1" />
                    Get Paid
                  </Button>
                </Link>
              </div>

              <div className="text-2xl font-bold text-foreground">
                CA${totalEarnings.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] text-muted-foreground">Total earnings</span>
                <span className="text-[10px] text-muted-foreground">Last 7 days</span>
              </div>

              <div className="flex flex-col gap-2 mt-3">
                <Link href="/analytics">
                  <Button variant="ghost" size="sm" className="w-full justify-start text-[10px] h-6 px-2">
                    View full analytics
                    <ChevronRight className="h-3 w-3 ml-auto" />
                  </Button>
                </Link>
                <Link href="/browse">
                  <Button size="sm" className="w-full bg-primary hover:bg-primary/90 text-[10px] h-6 px-2.5">
                    View New Offers
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Mobile: Recommended Offers - List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold">Recommended Offers</h2>
              <Link href="/browse" className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                View all tasks
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {offersLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-2.5 flex items-center gap-2.5">
                      <div className="h-10 w-10 rounded-lg bg-muted flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="h-3.5 bg-muted rounded w-32 mb-1.5" />
                        <div className="h-3 bg-muted rounded w-20" />
                      </div>
                      <div className="h-5 w-16 bg-muted rounded" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : hasNoNiches || profileNotFound ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <Settings className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="font-medium text-xs">Set Your Content Niches</p>
                  <p className="text-[10px] text-muted-foreground mt-1 mb-2">
                    Add your content niches to get personalized recommendations
                  </p>
                  <Link href="/settings">
                    <Button size="sm" className="text-[10px] h-6">
                      <Settings className="h-3 w-3 mr-1" />
                      Update Profile
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : !recommendedOffers || recommendedOffers.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <Heart className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-muted-foreground text-xs">No recommended offers yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {recommendedOffers.slice(0, 3).map((offer: any) => (
                  <Card key={offer.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {offer.featuredImageUrl ? (
                            <img
                              src={proxiedSrc(offer.featuredImageUrl)}
                              alt={offer.title}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <Play className="h-4 w-4 text-muted-foreground/50" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-[11px] truncate">{offer.title}</h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {offer.primaryNiche && (
                              <Badge variant="secondary" className="text-[8px] px-1 py-0 h-3.5">
                                {formatNicheLabel(offer.primaryNiche)}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[9px] text-muted-foreground mt-0.5">
                            {getCommissionPercent(offer)} per sale
                          </p>
                        </div>
                        <Link href={`/offers/${offer.id}`}>
                          <Button size="sm" className="bg-primary hover:bg-primary/90 text-[9px] h-5 px-2 flex-shrink-0">
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

          {/* Mobile: More Recommended Offers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold">Recommended Offers</h2>
              <Link href="/browse" className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {recommendedOffers.slice(3, 5).map((offer: any) => (
                <Card key={offer.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {offer.featuredImageUrl ? (
                          <img
                            src={proxiedSrc(offer.featuredImageUrl)}
                            alt={offer.title}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <Play className="h-4 w-4 text-muted-foreground/50" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-[11px] truncate">{offer.title}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {offer.primaryNiche && (
                            <Badge variant="secondary" className="text-[8px] px-1 py-0 h-3.5">
                              {formatNicheLabel(offer.primaryNiche)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-0.5">
                          {getCommissionPercent(offer)} per sale
                        </p>
                      </div>
                      <Link href={`/offers/${offer.id}`}>
                        <Button size="sm" className="bg-primary hover:bg-primary/90 text-[9px] h-5 px-2 flex-shrink-0">
                          View Offer
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Mobile: Tips & Resources */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold">Tips & Resources</h2>
              <Link href="/help" className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-2">
              <Link href="/help/affiliate-tips" className="block group">
                <Card className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Lightbulb className="h-3.5 w-3.5 text-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-[11px] group-hover:text-primary transition-colors">10 Affiliate Marketing Tips for Success</h4>
                        <p className="text-[9px] text-muted-foreground mt-0.5">Learn more about affiliate marketing</p>
                      </div>
                      <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/help/getting-started" className="block group">
                <Card className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <BookOpen className="h-3.5 w-3.5 text-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-[11px] group-hover:text-primary transition-colors">Getting Started with Affiliate Links</h4>
                        <p className="text-[9px] text-muted-foreground mt-0.5">Kickstart guide for beginners</p>
                      </div>
                      <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/creator/payment-settings">
                <Button variant="outline" size="sm" className="w-full justify-between text-[10px] h-7 mt-1">
                  <span className="flex items-center gap-1.5">
                    <Wallet className="h-3 w-3" />
                    Withdraw Funds
                  </span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Mobile: Top Converting Offers - Horizontal Scroll */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold">Top Converting Offers</h2>
              <Link href="/browse" className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {topConvertingOffers.length > 0 ? (
              <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-3 px-3 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {topConvertingOffers.map((offer: any) => (
                  <Card key={offer.id} className="flex-shrink-0 w-[130px] hover:shadow-sm transition-shadow">
                    <CardContent className="p-2.5">
                      <div className="h-14 w-full rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center overflow-hidden mb-2">
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
                      <h3 className="font-medium text-[10px] truncate">{offer.title}</h3>
                      <p className="text-[9px] text-muted-foreground">
                        {getCommissionPercent(offer)} per sale
                      </p>
                      <Link href={`/offers/${offer.id}`} className="mt-2 block">
                        <Button size="sm" className="w-full bg-primary hover:bg-primary/90 text-[9px] h-5">
                          <Megaphone className="h-2.5 w-2.5 mr-1" />
                          Promote
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-4 text-center">
                  <Target className="h-6 w-6 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-[10px] text-muted-foreground">
                    Start promoting offers to see your top performers
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Mobile: Payment Balance */}
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold mb-1">Payment Balance</h2>
                  <div className="text-xl font-bold text-foreground">
                    CA${paymentBalance.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge variant="secondary" className="text-[8px] px-1.5 py-0 h-3.5">
                      <DollarSign className="h-2.5 w-2.5 mr-0.5" />
                      AffiliateXchange
                    </Badge>
                    <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      7 Days
                    </span>
                  </div>
                </div>
                <Link href="/creator/payment-settings">
                  <Button variant="outline" size="sm" className="text-[10px] h-6 px-2">
                    <CreditCard className="h-3 w-3 mr-1" />
                    Payment Methods
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Mobile: Quick Stats */}
          <div className="grid grid-cols-3 gap-2">
            <Card>
              <CardContent className="p-2.5 text-center">
                <div className="text-base font-bold text-foreground">
                  {totalClicks.toLocaleString()}
                </div>
                <div className="text-[9px] text-muted-foreground flex items-center justify-center gap-0.5">
                  <MousePointerClick className="h-2.5 w-2.5" />
                  Clicks
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-2.5 text-center">
                <div className="text-base font-bold text-foreground">
                  CA${totalEarnings.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[9px] text-muted-foreground flex items-center justify-center gap-0.5">
                  <DollarSign className="h-2.5 w-2.5" />
                  Earnings
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-2.5 text-center">
                <div className="text-base font-bold text-foreground">
                  {conversionRate}%
                </div>
                <div className="text-[9px] text-muted-foreground flex items-center justify-center gap-0.5">
                  <Percent className="h-2.5 w-2.5" />
                  Conversion
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ========== DESKTOP LAYOUT ========== */}
        <div className="hidden md:block space-y-6">
          {/* Desktop: Your Earnings Overview + Take Action */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="grid grid-cols-12 gap-0">
                {/* Left side - Earnings */}
                <div className="col-span-4 p-6 border-r">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Your Earnings Overview</h2>
                    <Link href="/creator/payment-settings">
                      <Button size="sm" className="bg-primary hover:bg-primary/90 text-xs h-8 px-3">
                        <Wallet className="h-4 w-4 mr-1.5" />
                        Get Paid
                      </Button>
                    </Link>
                  </div>

                  <div className="text-4xl font-bold text-foreground">
                    CA${totalEarnings.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">Total earnings</span>
                    <span className="text-sm text-muted-foreground">Last 7 days</span>
                  </div>

                  {/* Mini Chart */}
                  <div className="h-20 w-full mt-4">
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
                            contentStyle={{ fontSize: '12px' }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  <Link href="/analytics" className="mt-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
                    View Full Analytics
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </div>

                {/* Right side - Take Action */}
                <div className="col-span-8 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Take Action</h2>
                    <Link href="/applications" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                      See all tasks
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    {/* Respond to New Offers */}
                    <Card className="border bg-card hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <Bell className="h-5 w-5 text-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm">Respond to New Offers</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {pendingApplications > 0 ? `${pendingApplications} applications awaiting review` : 'Check for new opportunities'}
                            </p>
                          </div>
                        </div>
                        <Link href="/browse" className="mt-3 block">
                          <Button size="sm" className="w-full bg-primary hover:bg-primary/90 text-xs h-8">
                            View New Offers
                            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>

                    {/* Check Offer Performance */}
                    <Card className="border bg-card hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <BarChart3 className="h-5 w-5 text-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm">Check Offer Performance</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Analyze your clicks, conversions, & top...
                            </p>
                          </div>
                        </div>
                        <Link href="/analytics" className="mt-3 block">
                          <Button size="sm" variant="outline" className="w-full text-xs h-8">
                            View Analytics
                            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>

                    {/* Join High-Payout Programs */}
                    <Card className="border bg-card hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <DollarSign className="h-5 w-5 text-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm">Join High-Payout Programs</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Browse high-payout programs with generous...
                            </p>
                          </div>
                        </div>
                        <Link href="/browse?sort=highest_commission" className="mt-3 block">
                          <Button size="sm" variant="outline" className="w-full text-xs h-8">
                            Browse Top Offers
                            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Desktop: Main Content Grid */}
          <div className="grid grid-cols-12 gap-6">
            {/* Left Column - Offers */}
            <div className="col-span-8 space-y-6">
              {/* Recommended Offers */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">Recommended Offers</h2>
                    <p className="text-xs text-muted-foreground">Handpicked offers that fit your audience</p>
                  </div>
                  <Link href="/browse" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                    View All
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>

                {offersLoading ? (
                  <div className="grid grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                      <Card key={i} className="animate-pulse">
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className="h-14 w-14 rounded-lg bg-muted" />
                          <div className="flex-1">
                            <div className="h-4 bg-muted rounded w-32 mb-2" />
                            <div className="h-3 bg-muted rounded w-24 mb-2" />
                            <div className="h-8 bg-muted rounded w-full" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : hasNoNiches || profileNotFound ? (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <Settings className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                      <p className="font-medium">Set Your Content Niches</p>
                      <p className="text-sm text-muted-foreground mt-1 mb-4">
                        Add your content niches in your profile to get personalized recommendations
                      </p>
                      <Link href="/settings">
                        <Button size="sm">
                          <Settings className="h-4 w-4 mr-1.5" />
                          Update Profile
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ) : !recommendedOffers || recommendedOffers.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <Heart className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                      <p className="text-muted-foreground">No recommended offers yet</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Check back soon for new offers matching your niches
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {recommendedOffers.slice(0, 4).map((offer: any) => (
                      <Card key={offer.id} className="hover:shadow-md hover:border-primary/30 transition-all">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="h-14 w-14 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {offer.featuredImageUrl ? (
                                <img
                                  src={proxiedSrc(offer.featuredImageUrl)}
                                  alt={offer.title}
                                  className="w-full h-full object-cover rounded-lg"
                                />
                              ) : (
                                <Play className="h-6 w-6 text-muted-foreground/50" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm truncate">{offer.title}</h3>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {offer.shortDescription || `Earn ${getCommissionPercent(offer)} per sale`}
                              </p>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 mt-1.5">
                                {getCommissionPercent(offer)} per sale
                              </Badge>
                            </div>
                          </div>
                          <Link href={`/offers/${offer.id}`} className="mt-3 block">
                            <Button size="sm" variant="outline" className="w-full text-xs h-8">
                              <Eye className="h-3.5 w-3.5 mr-1.5" />
                              View Offer
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Top Converting Offers */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">Top Converting Offers</h2>
                    <p className="text-xs text-muted-foreground">Promote these high-performing programs</p>
                  </div>
                  <Link href="/browse" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                    View All
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>

                {topConvertingOffers.length > 0 ? (
                  <div className="grid grid-cols-3 gap-4">
                    {topConvertingOffers.map((offer: any) => (
                      <Card key={offer.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
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
                              <h3 className="font-medium text-sm truncate">{offer.title}</h3>
                              <p className="text-xs text-muted-foreground">
                                Earn {getCommissionPercent(offer)} per sale
                              </p>
                            </div>
                          </div>
                          <Link href={`/offers/${offer.id}`} className="mt-3 block">
                            <Button size="sm" className="w-full bg-primary hover:bg-primary/90 text-xs h-8">
                              <Megaphone className="h-3.5 w-3.5 mr-1.5" />
                              Promote
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Target className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">
                        Start promoting offers to see your top performers here
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Right Column - Sidebar */}
            <div className="col-span-4 space-y-6">
              {/* Tips & Resources */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Tips & Resources</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Link href="/help/affiliate-tips" className="block group">
                    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Lightbulb className="h-4 w-4 text-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm group-hover:text-primary transition-colors">10 Affiliate Marketing Tips for Success</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">Learn more about affiliate beginners/dha ducess.</p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                    </div>
                  </Link>

                  <Link href="/help/getting-started" className="block group">
                    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <BookOpen className="h-4 w-4 text-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm group-hover:text-primary transition-colors">Getting Started with Affiliate Links</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">Kickstart guide to learn goinpnch nar hade.</p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                    </div>
                  </Link>

                  <Link href="/creator/payment-settings" className="block mt-4">
                    <Button variant="outline" className="w-full justify-between text-sm h-10">
                      <span className="flex items-center gap-2">
                        <Wallet className="h-4 w-4" />
                        Withdraw Funds
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Payment Balance */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Payment Balance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline justify-between mb-3">
                    <div className="text-3xl font-bold text-foreground">
                      CA${paymentBalance.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Upcoming Payout in 2 Days
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-4">
                    <Badge className="bg-primary/10 text-primary border-0 text-xs">
                      <DollarSign className="h-3 w-3 mr-1" />
                      Affiliate Funds
                    </Badge>
                  </div>
                  <Link href="/creator/payment-settings">
                    <Button variant="outline" className="w-full text-sm h-9">
                      <CreditCard className="h-4 w-4 mr-1.5" />
                      Payment Methods
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Quick Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-xl font-bold text-foreground">
                        {totalClicks.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <MousePointerClick className="h-3 w-3" />
                        Clicks
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-foreground">
                        CA${totalEarnings.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        Earnings
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-foreground">
                        {conversionRate}%
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <Percent className="h-3 w-3" />
                        Conversion rate
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
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
