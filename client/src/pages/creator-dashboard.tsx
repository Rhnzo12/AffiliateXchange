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
  TrendingUp,
  Heart,
  Play,
  Settings,
  Bell,
  ChevronRight,
  DollarSign,
  BarChart3,
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
  Calendar,
  Clock,
  Star,
  Megaphone,
} from "lucide-react";
import { Link } from "wouter";
import { proxiedSrc } from "../lib/image";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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
    isError: activityError,
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
  const pendingPayout = walletData?.pendingPayout || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
              Welcome back, {user?.firstName || 'Creator'}!
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Here's what's happening with your affiliate account.
            </p>
          </div>
        </div>

        {/* Your Earnings Overview */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
              {/* Left side - Earnings Chart */}
              <div className="lg:col-span-4 p-4 sm:p-6 border-b lg:border-b-0 lg:border-r">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base sm:text-lg font-semibold">Your Earnings Overview</h2>
                  <Link href="/creator/payment-settings">
                    <Button size="sm" className="bg-primary hover:bg-primary/90 text-xs sm:text-sm h-8 sm:h-9">
                      <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
                      Get Paid
                    </Button>
                  </Link>
                </div>

                <div className="mb-4">
                  <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">
                    CA${totalEarnings.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs sm:text-sm text-muted-foreground">Total earnings</span>
                    <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0">
                      Last 7 days
                    </Badge>
                  </div>
                </div>

                {/* Mini Chart */}
                <div className="h-20 sm:h-24 w-full">
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
                          labelFormatter={(label) => label}
                          contentStyle={{ fontSize: '12px' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <Link href="/analytics" className="mt-3 inline-flex items-center text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors">
                  View Full Analytics
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Link>
              </div>

              {/* Right side - Take Action */}
              <div className="lg:col-span-8 p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base sm:text-lg font-semibold">Take Action</h2>
                  <Link href="/applications" className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                    See all tasks
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  {/* Respond to New Offers */}
                  <Card className="border bg-card hover:shadow-md transition-shadow">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                          <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm sm:text-base leading-tight">Respond to New Offers</h3>
                          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-2">
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
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                          <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm sm:text-base leading-tight">Check Offer Performance</h3>
                          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            Analyze your clicks, conversions, & top-performing offers
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
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                          <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm sm:text-base leading-tight">Join High-Payout Programs</h3>
                          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            Browse high-payout programs with generous commissions
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

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* Left Column - Offers */}
          <div className="lg:col-span-8 space-y-4 sm:space-y-6">
            {/* Recommended Offers */}
            <div>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold">Recommended Offers</h2>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Handpicked offers that fit your audience</p>
                </div>
                <Link href="/browse" className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  View All
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {offersLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                        <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-lg bg-muted" />
                        <div className="flex-1">
                          <div className="h-4 bg-muted rounded w-24 mb-2" />
                          <div className="h-3 bg-muted rounded w-32" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : hasNoNiches || profileNotFound ? (
                <Card>
                  <CardContent className="p-8 sm:p-12 text-center">
                    <Settings className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground/50 mx-auto mb-3 sm:mb-4" />
                    <p className="font-medium text-sm sm:text-base">Set Your Content Niches</p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1 mb-3 sm:mb-4">
                      Add your content niches in your profile to get personalized recommendations
                    </p>
                    <Link href="/settings">
                      <Button size="sm">
                        <Settings className="h-3.5 w-3.5 mr-1.5" />
                        Update Profile
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : !recommendedOffers || recommendedOffers.length === 0 ? (
                <Card>
                  <CardContent className="p-8 sm:p-12 text-center">
                    <Heart className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground/50 mx-auto mb-3 sm:mb-4" />
                    <p className="text-muted-foreground text-sm sm:text-base">No recommended offers yet</p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      Check back soon for new offers matching your niches
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {recommendedOffers.slice(0, 4).map((offer: any) => (
                    <Card key={offer.id} className="hover:shadow-md hover:border-primary/30 transition-all">
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-start gap-3">
                          {/* Offer Image */}
                          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {offer.featuredImageUrl ? (
                              <img
                                src={proxiedSrc(offer.featuredImageUrl)}
                                alt={offer.title}
                                className="w-full h-full object-cover rounded-lg"
                              />
                            ) : (
                              <Play className="h-5 w-5 sm:h-6 sm:w-6 text-primary/60" />
                            )}
                          </div>

                          {/* Offer Details */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-xs sm:text-sm truncate">{offer.title}</h3>
                            <p className="text-[10px] sm:text-xs text-muted-foreground truncate mt-0.5">
                              {offer.shortDescription || `Earn ${getCommissionPercent(offer)} per sale`}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <Badge variant="secondary" className="text-[9px] sm:text-[10px] px-1.5 py-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                {getCommissionPercent(offer)} per sale
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Link href={`/offers/${offer.id}`} className="mt-3 block">
                          <Button size="sm" variant="outline" className="w-full text-xs h-7 sm:h-8">
                            <Eye className="h-3 w-3 mr-1.5" />
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
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold">Top Converting Offers</h2>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Promote these high-performing programs</p>
                </div>
                <Link href="/browse" className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  View All
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {topConvertingOffers.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  {topConvertingOffers.map((offer: any) => (
                    <Card key={offer.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-center gap-3">
                          {/* Offer Image */}
                          <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {offer.featuredImageUrl ? (
                              <img
                                src={proxiedSrc(offer.featuredImageUrl)}
                                alt={offer.title}
                                className="w-full h-full object-cover rounded-lg"
                              />
                            ) : (
                              <Target className="h-4 w-4 sm:h-5 sm:w-5 text-primary/60" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-xs sm:text-sm truncate">{offer.title}</h3>
                            <p className="text-[10px] sm:text-xs text-muted-foreground">
                              Earn {getCommissionPercent(offer)} per sale
                            </p>
                          </div>
                        </div>
                        <Link href={`/offers/${offer.id}`} className="mt-3 block">
                          <Button size="sm" className="w-full bg-primary hover:bg-primary/90 text-xs h-7 sm:h-8">
                            <Megaphone className="h-3 w-3 mr-1.5" />
                            Promote
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-6 sm:p-8 text-center">
                    <Target className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Start promoting offers to see your top performers here
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="lg:col-span-4 space-y-4 sm:space-y-6">
            {/* Tips & Resources */}
            <Card>
              <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="text-base sm:text-lg">Tips & Resources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                {/* Tip 1 */}
                <Link href="/help/affiliate-tips" className="block group">
                  <div className="flex items-start gap-3 p-2.5 sm:p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                      <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-xs sm:text-sm group-hover:text-primary transition-colors">10 Affiliate Marketing Tips for Success</h4>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Learn more about affiliate beginners/dha ducess.</p>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-0.5" />
                  </div>
                </Link>

                {/* Tip 2 */}
                <Link href="/help/getting-started" className="block group">
                  <div className="flex items-start gap-3 p-2.5 sm:p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-xs sm:text-sm group-hover:text-primary transition-colors">Getting Started with Affiliate Links</h4>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Kickstart guide to learn goinpnch nar hade.</p>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-0.5" />
                  </div>
                </Link>

                {/* Withdraw Funds Button */}
                <Link href="/creator/payment-settings" className="block mt-4">
                  <Button variant="outline" className="w-full justify-between text-xs sm:text-sm h-9 sm:h-10">
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
              <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="text-base sm:text-lg">Payment Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline justify-between mb-3">
                  <div className="text-2xl sm:text-3xl font-bold text-foreground">
                    CA${paymentBalance.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Upcoming Payout in 2 Days
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <Badge className="bg-primary/10 text-primary border-0 text-[10px] sm:text-xs">
                    <DollarSign className="h-3 w-3 mr-1" />
                    Affiliate Funds
                  </Badge>
                </div>
                <Link href="/creator/payment-settings">
                  <Button variant="outline" className="w-full text-xs sm:text-sm h-8 sm:h-9">
                    <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                    Payment Methods
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="text-base sm:text-lg">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                  <div className="text-center">
                    <div className="text-lg sm:text-xl font-bold text-foreground">
                      {totalClicks.toLocaleString()}
                    </div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <MousePointerClick className="h-3 w-3" />
                      Clicks
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg sm:text-xl font-bold text-foreground">
                      CA${totalEarnings.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Earnings
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg sm:text-xl font-bold text-foreground">
                      {conversionRate}%
                    </div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground flex items-center justify-center gap-1">
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
