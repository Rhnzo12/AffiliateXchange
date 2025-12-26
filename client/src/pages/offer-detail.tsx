import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { apiRequest, queryClient } from "../lib/queryClient";
import { isUnauthorizedError } from "../lib/authUtils";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Textarea } from "../components/ui/textarea";
import { Checkbox } from "../components/ui/checkbox";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Heart,
  Star,
  Play,
  CheckCircle2,
  DollarSign,
  Clock,
  MapPin,
  Users,
  Check,
  ArrowLeft,
  TrendingUp,
  MousePointer,
  Wallet,
  Video,
  Globe,
  Shield,
  Verified,
  Hash,
  ExternalLink,
  AlertTriangle,
  Info,
  Palette,
  Eye,
  ShoppingCart,
  ThumbsUp,
  BarChart3
} from "lucide-react";
import { proxiedSrc } from "../lib/image";
import { VideoPlayer } from "../components/VideoPlayer";
import { DetailPageSkeleton } from "../components/skeletons";
import { useSidebar } from "../components/ui/sidebar";

// Helper function to format duration in seconds to MM:SS
function formatDuration(seconds: number | string): string {
  if (!seconds) return "0:00";
  
  // If it's already formatted (string like "3:45"), return as is
  if (typeof seconds === 'string' && seconds.includes(':')) {
    return seconds;
  }
  
  // Convert to number if string
  const numSeconds = typeof seconds === 'string' ? parseInt(seconds, 10) : seconds;
  
  if (isNaN(numSeconds) || numSeconds === 0) return "0:00";
  
  const mins = Math.floor(numSeconds / 60);
  const secs = Math.floor(numSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Helper function to format commission display - FIXED: No $ with %
const formatCommission = (offer: any) => {
  if (!offer) return "$0";
  
  if (offer.commissionAmount !== undefined && offer.commissionAmount !== null) {
    const amount = typeof offer.commissionAmount === "string"
      ? parseFloat(offer.commissionAmount)
      : offer.commissionAmount;

    if (!isNaN(amount)) {
      return `$${Number(amount).toFixed(2)}`;
    }
  }

  if (offer.commissionPercentage !== undefined && offer.commissionPercentage !== null) {
    return `${offer.commissionPercentage}%`; // Just percentage, no $ sign
  }

  if (offer.commissionRate !== undefined && offer.commissionRate !== null) {
    const rate = typeof offer.commissionRate === "string"
      ? parseFloat(offer.commissionRate)
      : offer.commissionRate;

    if (!isNaN(rate)) {
      return `$${Number(rate).toFixed(2)}`;
    }
  }
  return "$0";
};

// Helper to get commission type label
const getCommissionTypeLabel = (offer: any) => {
  if (!offer?.commissionType) return "per sale";
  return offer.commissionType.replace(/_/g, " ");
};

// Helper to show a short company highlight instead of the full bio
const getCompanyHighlight = (description: string | undefined | null, maxLength = 200) => {
  if (!description) return "";

  // Use the first paragraph/line as the highlight
  const firstParagraph = description.split(/\n\s*\n?/)[0]?.trim() || "";
  if (firstParagraph.length <= maxLength) return firstParagraph;

  return `${firstParagraph.slice(0, maxLength).trimEnd()}...`;
};

// Helper to format response time for display
const formatResponseTime = (hours: number | null | undefined) => {
  if (hours === null || hours === undefined) return "No responses yet";
  if (hours < 1) return "Responds < 1hr";
  if (hours < 24) return `Responds in ${hours}hrs`;
  return `Responds in ${Math.round(hours / 24)}d`;
};

export default function OfferDetail() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, params] = useRoute("/offers/:id");
  const [, setLocation] = useLocation();
  const { state: sidebarState, isMobile } = useSidebar();
  const offerId = params?.id;

  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [showVideoPlatformDialog, setShowVideoPlatformDialog] = useState(false);
  const [applicationMessage, setApplicationMessage] = useState("");
  const [preferredCommission, setPreferredCommission] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [errorDialog, setErrorDialog] = useState({ open: false, title: "Error", description: "An error occurred", errorDetails: "" });

  const { data: profile, isLoading: profileLoading } = useQuery<any>({
    queryKey: ["/api/profile"],
    enabled: isAuthenticated && user?.role === "creator",
  });

  // Auth check
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setErrorDialog({
        open: true,
        title: "Authentication Required",
        description: "Please log in to view offer details.",
        errorDetails: "You must be logged in to access this page.",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading]);

  // Fetch offer details with company and videos
  const { data: offer, isLoading: offerLoading } = useQuery<any>({
    queryKey: [`/api/offers/${offerId}`],
    enabled: !!offerId && isAuthenticated,
  });

  // Fetch company response time
  const { data: responseTimeData } = useQuery<any>({
    queryKey: [`/api/companies/${offer?.companyId}/response-time`],
    enabled: !!offer?.companyId,
  });

  // Check if favorited
  const { data: isFavorite } = useQuery<boolean>({
    queryKey: [`/api/favorites/${offerId}`],
    enabled: !!offerId && isAuthenticated,
  });

  // Fetch user's applications
  const { data: applications } = useQuery<any[]>({
    queryKey: ["/api/applications"],
    enabled: isAuthenticated,
  });

  // Fetch reviews
  const { data: reviews, isLoading: reviewsLoading } = useQuery<any[]>({
    queryKey: [`/api/offers/${offerId}/reviews`],
    enabled: !!offerId,
  });

  // Check if user already applied
  const existingApplication = applications?.find(
    app => app.offer?.id === offerId || app.offerId === offerId
  );
  const hasApplied = !!existingApplication;
  const applicationStatus = existingApplication?.status;

  const creatorPlatforms = useMemo(() => {
    if (!profile || user?.role !== "creator") return [];

    return [
      { name: "YouTube", url: profile.youtubeUrl, followers: profile.youtubeFollowers },
      { name: "TikTok", url: profile.tiktokUrl, followers: profile.tiktokFollowers },
      { name: "Instagram", url: profile.instagramUrl, followers: profile.instagramFollowers },
    ];
  }, [profile, user?.role]);

  const requirementCheck = useMemo(() => {
    if (!offer || user?.role !== "creator") {
      return { meets: true, reasons: [] as string[] };
    }

    if (profileLoading) {
      return { meets: null as boolean | null, reasons: [] as string[] };
    }

    if (!profile) {
      return {
        meets: false,
        reasons: ["Set up your creator profile to verify eligibility for this offer."],
      };
    }

    const reasons: string[] = [];

    if (offer.minimumFollowers) {
      const hasRequiredFollowers = creatorPlatforms.some((platform) =>
        (platform.followers || 0) >= offer.minimumFollowers
      );

      if (!hasRequiredFollowers) {
        reasons.push(`Minimum ${Number(offer.minimumFollowers).toLocaleString()} followers required on at least one platform.`);
      }
    }

    if (offer.allowedPlatforms?.length) {
      const hasAllowedPlatform = creatorPlatforms.some(
        (platform) => platform.url && offer.allowedPlatforms.includes(platform.name)
      );

      if (!hasAllowedPlatform) {
        reasons.push(`You need an active presence on one of: ${offer.allowedPlatforms.join(", ")}.`);
      }
    }

    return {
      meets: reasons.length === 0,
      reasons,
    };
  }, [offer, profile, profileLoading, user?.role, creatorPlatforms]);

  // Debug log to check application matching
  console.log('[OfferDetail] Checking application status:', {
    offerId,
    hasApplications: !!applications,
    applicationCount: applications?.length,
    existingApplication: existingApplication?.id,
    hasApplied,
    applicationStatus
  });

  // Get apply button configuration based on status
  const getApplyButtonConfig = () => {
    if (hasApplied) {
      // If already applied, gray out the button
      switch (applicationStatus) {
        case "pending":
          return {
            text: "Applied - Pending",
            disabled: true,
            variant: "secondary" as const,
            icon: <Clock className="h-4 w-4" />,
          };
        case "approved":
          return {
            text: "Applied - Approved",
            disabled: true,
            variant: "outline" as const,
            icon: <CheckCircle2 className="h-4 w-4" />,
          };
        case "active":
          return {
            text: "Applied - Active",
            disabled: true,
            variant: "outline" as const,
            icon: <Check className="h-4 w-4" />,
          };
        case "rejected":
          return {
            text: "Applied - Rejected",
            disabled: true,
            variant: "outline" as const,
            icon: <Check className="h-4 w-4" />,
          };
        default:
          return {
            text: "Already Applied",
            disabled: true,
            variant: "secondary" as const,
            icon: <Check className="h-4 w-4" />,
          };
      }
    }

    if (requirementCheck.meets === null) {
      return {
        text: "Checking eligibility...",
        disabled: true,
        variant: "secondary" as const,
        icon: <Clock className="h-4 w-4" />,
      };
    }

    if (requirementCheck.meets === false) {
      return {
        text: "Requirements Not Met",
        disabled: true,
        variant: "secondary" as const,
        icon: <AlertTriangle className="h-4 w-4" />,
      };
    }

    return {
      text: "Apply Now",
      disabled: false,
      variant: "default" as const,
      icon: null,
    };
  };

  const buttonConfig = getApplyButtonConfig();

  // Toggle favorite mutation
  const favoriteMutation = useMutation({
    mutationFn: async () => {
      if (isFavorite) {
        await apiRequest("DELETE", `/api/favorites/${offerId}`);
      } else {
        await apiRequest("POST", "/api/favorites", { offerId: offerId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/favorites/${offerId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
      toast({
        title: isFavorite ? "Removed from favorites" : "Added to favorites",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        setErrorDialog({
          open: true,
          title: "Session Expired",
          description: "Your session has expired. Please log in again to continue.",
          errorDetails: error.message || "Unauthorized access",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      setErrorDialog({
        open: true,
        title: "Favorites Error",
        description: "Unable to update your favorites list. Please try again.",
        errorDetails: error.message || "Failed to update favorites",
      });
    },
  });

  // Apply mutation - FIXED: Send offerId as string, not number
  const applyMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        offerId: offerId, // Keep as string - don't convert to Number
        message: applicationMessage,
      };
      
      // Only include preferredCommission if it has a value
      if (preferredCommission) {
        payload.preferredCommission = preferredCommission;
      }
      
      return await apiRequest("POST", "/api/applications", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      setShowApplyDialog(false);
      toast({
        title: "Application Submitted!",
        description: "You'll hear back within 48 hours. Check My Applications for updates.",
      });
      setApplicationMessage("");
      setPreferredCommission("");
      setTermsAccepted(false);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        setErrorDialog({
          open: true,
          title: "Session Expired",
          description: "Your session has expired. Please log in again to continue.",
          errorDetails: error.message || "Unauthorized access",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }

      // Check if this is a video platform requirement error
      if (error.message && error.message.includes("video platform")) {
        setShowApplyDialog(false);
        setShowVideoPlatformDialog(true);
        return;
      }

      setErrorDialog({
        open: true,
        title: "Application Error",
        description: "Unable to submit your application. Please try again.",
        errorDetails: error.message || "Failed to submit application",
      });
    },
  });

  // Calculate average rating
  const averageRating = offer?.company?.averageRating ||
    (reviews && reviews.length > 0
      ? reviews.reduce((acc: number, r: any) => acc + (r.overallRating || 0), 0) / reviews.length
      : 0);

  const [showFullCompanyDescription, setShowFullCompanyDescription] = useState(false);

  const companyDescription = offer?.company?.description?.trim() || "";
  const companyHighlight = getCompanyHighlight(companyDescription);
  const hasMoreCompanyDescription =
    companyDescription && companyHighlight && companyDescription !== companyHighlight;
  const visibleCompanyDescription = showFullCompanyDescription ? companyDescription : companyHighlight;
  const mainNiches = useMemo(() => {
    if (!offer) return [];

    const niches: string[] = [];

    if (offer.primaryNiche) niches.push(offer.primaryNiche);
    if (offer.secondaryNiche) niches.push(offer.secondaryNiche);
    if (Array.isArray(offer.additionalNiches)) niches.push(...offer.additionalNiches);

    return niches.filter(Boolean);
  }, [offer]);

  // Loading state
  if (isLoading || offerLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <DetailPageSkeleton />
      </div>
    );
  }

  // Not found state
  if (!offer) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground mb-4">Offer not found</p>
            <Button onClick={() => setLocation("/browse")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Browse
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-24">
      {/* Main Content Container */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Header Card */}
        <Card className="rounded-2xl shadow-sm border border-gray-200 mb-6">
          <CardContent className="p-6">
            {/* Top Row: Back button and Save button */}
            <div className="flex items-center justify-between mb-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/browse")}
                className="gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => favoriteMutation.mutate()}
                disabled={favoriteMutation.isPending}
                className="gap-2"
              >
                <Heart
                  className={`h-4 w-4 transition-all ${
                    isFavorite ? 'fill-red-500 text-red-500' : ''
                  }`}
                />
                {isFavorite ? 'Saved' : 'Save'}
              </Button>
            </div>

            {/* Offer Info Row */}
            <div className="flex flex-col sm:flex-row gap-6">
              {/* Product Image */}
              <div className="flex-shrink-0">
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                  {offer.company?.logoUrl ? (
                    <img
                      src={proxiedSrc(offer.company.logoUrl)}
                      alt={offer.company?.tradeName || offer.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                      <Avatar className="h-16 w-16">
                        <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-primary to-purple-600 text-white">
                          {offer.company?.tradeName?.[0] || offer.title[0]}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                </div>
              </div>

              {/* Offer Details */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                    {offer.company?.tradeName || offer.company?.legalName || offer.title}
                  </h1>
                  {offer.company?.websiteVerified && (
                    <Badge className="bg-green-500 hover:bg-green-600 text-white gap-1 text-xs">
                      <Verified className="h-3 w-3" />
                      Verified
                    </Badge>
                  )}
                </div>

                {/* Industry and Niche Tags */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {offer.company?.industry && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {offer.company.industry.replace(/_/g, ' ')}
                    </span>
                  )}
                  {mainNiches.map((niche) => (
                    <span key={niche} className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                      #{niche}
                    </span>
                  ))}
                </div>

                {/* Website Link */}
                {offer.company?.websiteUrl && (
                  <a
                    href={offer.company.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {offer.company.websiteUrl.replace(/^https?:\/\//, '')}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Commission Card - Full Width with prominent display */}
        <Card className="rounded-xl shadow-sm border border-gray-200 mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="text-xs text-gray-500 mb-1">Commission Rate</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-bold text-green-600">
                    {formatCommission(offer)}
                  </span>
                  <span className="text-sm text-gray-500 capitalize">
                    {getCommissionTypeLabel(offer)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  <span>{offer.activeCreators || 0} active</span>
                </div>
                {responseTimeData?.responseTime !== null && responseTimeData?.responseTime !== undefined && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    <span>{formatResponseTime(responseTimeData.responseTime)}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Description Card */}
        <Card className="rounded-xl shadow-sm border border-gray-200 mb-6">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Description</h3>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
              {companyHighlight || offer.fullDescription || offer.description || offer.shortDescription || "No description available."}
            </p>
            {hasMoreCompanyDescription && (
              <Button
                variant="ghost"
                size="sm"
                className="px-0 h-auto text-primary mt-2"
                onClick={() => setShowFullCompanyDescription((prev) => !prev)}
              >
                {showFullCompanyDescription ? "See less" : "See more"}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Performance and Videos Tabs */}
        <Card className="rounded-xl shadow-sm border border-gray-200 mb-6">
          <Tabs defaultValue="performance" className="w-full">
            <div className="border-b border-gray-200">
              <TabsList className="h-auto p-0 bg-transparent w-full justify-start rounded-none">
                <TabsTrigger
                  value="performance"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none px-6 py-3 text-sm font-medium"
                >
                  Performance
                </TabsTrigger>
                <TabsTrigger
                  value="videos"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none px-6 py-3 text-sm font-medium"
                >
                  Videos
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Performance Tab Content */}
            <TabsContent value="performance" className="p-6 mt-0">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {/* Active Creators */}
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white border border-gray-200 mb-2">
                    <Users className="h-5 w-5 text-gray-600" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{offer.activeCreatorsCount || 0}</div>
                  <div className="text-xs text-gray-500 mt-1">Active Creators</div>
                </div>

                {/* Total Clicks */}
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white border border-gray-200 mb-2">
                    <MousePointer className="h-5 w-5 text-gray-600" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{offer.totalClicks || 0}</div>
                  <div className="text-xs text-gray-500 mt-1">Total Clicks</div>
                </div>

                {/* Min Payout */}
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white border border-gray-200 mb-2">
                    <Wallet className="h-5 w-5 text-gray-600" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">${offer.minimumPayout || 50}</div>
                  <div className="text-xs text-gray-500 mt-1">Min Payout</div>
                </div>

                {/* Response Time */}
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white border border-gray-200 mb-2">
                    <Clock className="h-5 w-5 text-gray-600" />
                  </div>
                  <div className="text-lg font-bold text-gray-900">{formatResponseTime(responseTimeData?.responseTime)}</div>
                  <div className="text-xs text-gray-500 mt-1">Company Response Time</div>
                </div>

                {/* Cookie Duration */}
                {offer.cookieDuration && (
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white border border-gray-200 mb-2">
                      <Shield className="h-5 w-5 text-gray-600" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{offer.cookieDuration}</div>
                    <div className="text-xs text-gray-500 mt-1">Cookie Days</div>
                  </div>
                )}

                {/* Avg Order Value */}
                {offer.averageOrderValue && (
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white border border-gray-200 mb-2">
                      <TrendingUp className="h-5 w-5 text-gray-600" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">${offer.averageOrderValue}</div>
                    <div className="text-xs text-gray-500 mt-1">Avg Order</div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Videos Tab Content */}
            <TabsContent value="videos" className="p-6 mt-0">
              {!videos || videos.length === 0 ? (
                <div className="text-center py-12">
                  <Video className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No example videos available</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {videos.map((video: any) => (
                    <div
                      key={video.id}
                      className="group relative cursor-pointer"
                      onClick={() => setSelectedVideo(video)}
                    >
                      <div className="aspect-video rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                        {video.thumbnailUrl ? (
                          <img
                            src={proxiedSrc(video.thumbnailUrl)}
                            alt={video.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-400 via-pink-400 to-blue-400">
                            <Video className="h-8 w-8 text-white/50" />
                          </div>
                        )}

                        {/* Play overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                          <div className="bg-white/90 backdrop-blur rounded-full p-2 transform scale-0 group-hover:scale-100 transition-transform">
                            <Play className="h-4 w-4 text-primary fill-primary" />
                          </div>
                        </div>
                      </div>
                      <p className="text-xs font-medium text-gray-700 mt-2 truncate">
                        {video.title || "Untitled"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </Card>
      </div>


      {/* Sticky Apply Button */}
      <div
        className="fixed bottom-0 right-0 border-t bg-background/95 backdrop-blur-lg shadow-2xl p-2 sm:p-4 z-50"
        style={{
          left: isMobile ? 0 : sidebarState === 'expanded' ? 'var(--sidebar-width, 16rem)' : 'var(--sidebar-width-icon, 3rem)'
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <div className="min-w-0">
              <div className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">Earn Commission</div>
              <div className="text-base sm:text-2xl font-bold text-green-600 whitespace-nowrap">
                {formatCommission(offer)}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-shrink-0 w-full sm:w-auto">
            {!hasApplied && requirementCheck.meets === false && (
              <div className="flex items-start gap-2 text-xs sm:text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 max-w-xl">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium">You don't meet this offer's creator requirements.</p>
                  {requirementCheck.reasons.length > 0 && (
                    <ul className="list-disc list-inside space-y-0.5 text-red-800 text-xs sm:text-sm leading-tight">
                      {requirementCheck.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {hasApplied && existingApplication?.createdAt && (
              <Badge variant="secondary" className="hidden lg:flex text-xs whitespace-nowrap">
                Applied {new Date(existingApplication.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Badge>
            )}

            <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
              <DialogTrigger asChild>
                <Button
                  size="lg"
                  className="gap-2 text-sm sm:text-base rounded-xl shadow-lg hover:shadow-xl transition-all"
                  variant={buttonConfig.variant}
                  disabled={buttonConfig.disabled}
                >
                  {buttonConfig.icon}
                  {buttonConfig.text}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                {hasApplied && existingApplication ? (
                  // Show "Already Applied" message
                  <>
                    <DialogHeader>
                      <DialogTitle>Application Already Submitted</DialogTitle>
                      <DialogDescription>
                        You have already applied to this offer
                      </DialogDescription>
                    </DialogHeader>

                    <div className="py-6">
                      <div className={`rounded-lg p-6 ${
                        applicationStatus === 'approved' || applicationStatus === 'active'
                          ? 'bg-green-50 border-2 border-green-200'
                          : applicationStatus === 'rejected'
                          ? 'bg-red-50 border-2 border-red-200'
                          : 'bg-blue-50 border-2 border-blue-200'
                      }`}>
                        <div className="flex items-start gap-4">
                          <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                            applicationStatus === 'approved' || applicationStatus === 'active'
                              ? 'bg-green-100'
                              : applicationStatus === 'rejected'
                              ? 'bg-red-100'
                              : 'bg-blue-100'
                          }`}>
                            {applicationStatus === 'approved' || applicationStatus === 'active' ? (
                              <CheckCircle2 className="h-6 w-6 text-green-600" />
                            ) : (
                              <Clock className={`h-6 w-6 ${
                                applicationStatus === 'rejected' ? 'text-red-600' : 'text-blue-600'
                              }`} />
                            )}
                          </div>
                          <div className="flex-1">
                            <h3 className={`text-lg font-semibold mb-2 ${
                              applicationStatus === 'approved' || applicationStatus === 'active'
                                ? 'text-green-900'
                                : applicationStatus === 'rejected'
                                ? 'text-red-900'
                                : 'text-blue-900'
                            }`}>
                              {applicationStatus === 'approved' 
                                ? 'Application Approved'
                                : applicationStatus === 'active'
                                ? 'Active Campaign'
                                : applicationStatus === 'rejected'
                                ? 'Application Not Approved'
                                : 'Application Pending Review'}
                            </h3>
                            <p className={`text-sm mb-4 ${
                              applicationStatus === 'approved' || applicationStatus === 'active'
                                ? 'text-green-700'
                                : applicationStatus === 'rejected'
                                ? 'text-red-700'
                                : 'text-blue-700'
                            }`}>
                              {applicationStatus === 'approved'
                                ? 'Your application has been approved! You can now start promoting this offer.'
                                : applicationStatus === 'active'
                                ? 'Your campaign is active. Keep up the great work!'
                                : applicationStatus === 'rejected'
                                ? 'Unfortunately, your application was not approved at this time. You cannot reapply to this offer.'
                                : 'Your application is being reviewed. You\'ll hear back within 48 hours. You cannot submit another application while this one is pending.'}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-gray-600 bg-white/50 rounded-lg p-3">
                              <Clock className="h-4 w-4" />
                              <span className="font-medium">Applied on:</span>
                              <span>
                                {new Date(existingApplication.createdAt).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                })}
                              </span>
                              <span>at</span>
                              <span>
                                {new Date(existingApplication.createdAt).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setShowApplyDialog(false)}
                      >
                        Close
                      </Button>
                    </DialogFooter>
                  </>
                ) : (
                  // Show application form
                  <>
                    <DialogHeader>
                      <DialogTitle>Apply to {offer.title}</DialogTitle>
                      <DialogDescription>
                        Tell {offer.company?.tradeName || 'the company'} why you're interested in promoting their offer
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="message">Why are you interested? *</Label>
                        <Textarea
                          id="message"
                          placeholder="Share details about your audience, content style, and why you'd be a great fit for this offer..."
                          value={applicationMessage}
                          onChange={(e) => setApplicationMessage(e.target.value.slice(0, 500))}
                          className="min-h-32 resize-none"
                        />
                        <p className="text-xs text-muted-foreground text-right">
                          {applicationMessage.length}/500 characters
                        </p>
                      </div>

                      {offer.commissionType === 'hybrid' && (
                        <div className="space-y-2">
                          <Label htmlFor="commission">Preferred Commission Model</Label>
                          <Select value={preferredCommission} onValueChange={setPreferredCommission}>
                            <SelectTrigger id="commission">
                              <SelectValue placeholder="Select your preferred model" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">Standard Commission</SelectItem>
                              <SelectItem value="per_sale">Per Sale</SelectItem>
                              <SelectItem value="retainer">Monthly Retainer</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="flex items-start gap-2 pt-4">
                        <Checkbox
                          id="terms"
                          checked={termsAccepted}
                          onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                        />
                        <Label htmlFor="terms" className="text-sm font-normal cursor-pointer leading-relaxed">
                          I accept the terms and conditions and agree to promote this offer ethically and authentically to my audience
                        </Label>
                      </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                      <Button
                        variant="outline"
                        onClick={() => setShowApplyDialog(false)}
                        disabled={applyMutation.isPending}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => applyMutation.mutate()}
                        disabled={!applicationMessage.trim() || !termsAccepted || applyMutation.isPending}
                      >
                        {applyMutation.isPending ? (
                          <>
                            <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent mr-2"></div>
                            Submitting...
                          </>
                        ) : (
                          "Submit Application"
                        )}
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Video Player Dialog */}
      {selectedVideo && (
        <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{selectedVideo.title || "Video"}</DialogTitle>
              <DialogDescription>
                {selectedVideo.description || "Preview this example video"}
              </DialogDescription>
            </DialogHeader>
            {selectedVideo.videoUrl ? (
              <div className="w-full">
                <VideoPlayer
                  videoUrl={selectedVideo.videoUrl}
                  thumbnail={selectedVideo.thumbnailUrl}
                  autoPlay
                  className="aspect-video w-full"
                />
              </div>
            ) : (
              <div className="aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center text-white">
                <div className="text-center">
                  <Video className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>Video not available</p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Video Platform Requirement Dialog */}
      <AlertDialog open={showVideoPlatformDialog} onOpenChange={setShowVideoPlatformDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-6 w-6" />
              Video Platform Required
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-2">
              <p className="text-base font-semibold text-foreground">
                You must add at least one video platform to your profile before applying to offers.
              </p>
              <p className="text-sm">
                We only accept <strong>video content creators</strong> with an active presence on:
              </p>
              <ul className="list-disc list-inside space-y-1.5 ml-2 text-sm">
                <li><strong>YouTube</strong> - Video channels</li>
                <li><strong>TikTok</strong> - Short-form video content</li>
                <li><strong>Instagram</strong> - Reels and video content</li>
              </ul>
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-4">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>💡 Next Step:</strong> Add your video platform URL in your profile settings, then come back to apply!
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogAction
              onClick={() => {
                setShowVideoPlatformDialog(false);
                setLocation("/settings");
              }}
              className="w-full sm:w-auto"
            >
              Go to Settings
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hide scrollbar for tab navigation */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Error Dialog */}
      <GenericErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
        title={errorDialog.title}
        description={errorDialog.description}
        errorDetails={errorDialog.errorDetails}
        variant="error"
      />
    </div>
  );
}