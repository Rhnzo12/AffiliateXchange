import { useEffect, useState, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { apiRequest, queryClient } from "../lib/queryClient";
import { isUnauthorizedError } from "../lib/authUtils";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Textarea } from "../components/ui/textarea";
import { Checkbox } from "../components/ui/checkbox";
import { Label } from "../components/ui/label";
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
  Sparkles,
  Shield,
  Verified
} from "lucide-react";
import { proxiedSrc } from "../lib/image";

// Helper function to format commission display
const formatCommission = (offer: any) => {
  if (!offer) return "$0";
  
  if (offer.commissionAmount) {
    return `$${offer.commissionAmount}`;
  } else if (offer.commissionPercentage) {
    return `${offer.commissionPercentage}%`;
  } else if (offer.commissionRate) {
    return `$${offer.commissionRate}`;
  }
  return "$0";
};

// Helper to get commission type label
const getCommissionTypeLabel = (offer: any) => {
  if (!offer?.commissionType) return "per sale";
  return offer.commissionType.replace(/_/g, " ");
};

export default function OfferDetail() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, params] = useRoute("/offers/:id");
  const [, setLocation] = useLocation();
  const offerId = params?.id;

  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [applicationMessage, setApplicationMessage] = useState("");
  const [preferredCommission, setPreferredCommission] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [activeSection, setActiveSection] = useState("overview");
  const [isScrolling, setIsScrolling] = useState(false);

  // Refs for sections
  const overviewRef = useRef<HTMLDivElement>(null);
  const videosRef = useRef<HTMLDivElement>(null);
  const requirementsRef = useRef<HTMLDivElement>(null);
  const reviewsRef = useRef<HTMLDivElement>(null);

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

  // Scroll spy effect
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: "-80px 0px -60% 0px",
      threshold: 0.1,
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      if (isScrolling) return;

      let maxEntry = entries[0];
      
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > (maxEntry?.intersectionRatio || 0)) {
          maxEntry = entry;
        }
      });

      if (maxEntry?.isIntersecting) {
        const sectionId = maxEntry.target.getAttribute("data-section");
        if (sectionId) {
          setActiveSection(sectionId);
        }
      }
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    const sections = [overviewRef, videosRef, requirementsRef, reviewsRef];
    sections.forEach((ref) => {
      if (ref.current) {
        observer.observe(ref.current);
      }
    });

    return () => {
      sections.forEach((ref) => {
        if (ref.current) {
          observer.unobserve(ref.current);
        }
      });
    };
  }, [isScrolling]);

  // Smooth scroll to section
  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    setIsScrolling(true);

    const refs: Record<string, React.RefObject<HTMLDivElement>> = {
      overview: overviewRef,
      videos: videosRef,
      requirements: requirementsRef,
      reviews: reviewsRef,
    };

    const ref = refs[sectionId];
    if (ref.current) {
      const stickyNavElement = document.querySelector('[class*="sticky"]');
      const navHeight = stickyNavElement ? stickyNavElement.getBoundingClientRect().height : 80;
      
      const elementPosition = ref.current.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - navHeight - 10;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });

      setTimeout(() => {
        setIsScrolling(false);
      }, 1000);
    }
  };

  const { data: offer, isLoading: offerLoading } = useQuery<any>({
    queryKey: ["/api/offers", offerId],
    enabled: !!offerId && isAuthenticated,
  });

  const { data: isFavorite } = useQuery<boolean>({
    queryKey: ["/api/favorites", offerId],
    enabled: !!offerId && isAuthenticated,
  });

  const { data: applications } = useQuery<any[]>({
    queryKey: ["/api/applications"],
    enabled: isAuthenticated,
  });

  const { data: reviews, isLoading: reviewsLoading } = useQuery<any[]>({
    queryKey: [`/api/offers/${offerId}/reviews`],
    enabled: !!offerId,
  });

  const existingApplication = applications?.find(
    app => app.offer?.id === offerId || app.offerId === offerId
  );
  const hasApplied = !!existingApplication;
  const applicationStatus = existingApplication?.status;

  const getApplyButtonConfig = () => {
    if (!hasApplied) {
      return {
        text: "Apply Now",
        disabled: false,
        variant: "default" as const,
        icon: null,
      };
    }

    switch (applicationStatus) {
      case "pending":
        return {
          text: "Application Pending",
          disabled: true,
          variant: "secondary" as const,
          icon: <Clock className="h-4 w-4" />,
        };
      case "approved":
        return {
          text: "Application Approved",
          disabled: true,
          variant: "default" as const,
          icon: <CheckCircle2 className="h-4 w-4" />,
        };
      case "active":
        return {
          text: "Active Campaign",
          disabled: true,
          variant: "default" as const,
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
  };

  const buttonConfig = getApplyButtonConfig();

  const favoriteMutation = useMutation({
    mutationFn: async () => {
      if (isFavorite) {
        await apiRequest("DELETE", `/api/favorites/${offerId}`);
      } else {
        await apiRequest("POST", "/api/favorites", { offerId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorites", offerId] });
      toast({
        title: isFavorite ? "Removed from favorites" : "Added to favorites",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update favorites",
        variant: "destructive",
      });
    },
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/applications", {
        offerId,
        message: applicationMessage,
        preferredCommission,
      });
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
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to submit application",
        variant: "destructive",
      });
    },
  });

  // Calculate average rating
  const averageRating = offer?.company?.averageRating || 
    (reviews && reviews.length > 0 
      ? reviews.reduce((acc: number, r: any) => acc + (r.overallRating || 0), 0) / reviews.length 
      : 0);

  if (isLoading || offerLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-lg">Loading...</div>
    </div>;
  }

  if (!offer) {
    return <div className="text-center py-12">
      <p className="text-muted-foreground">Offer not found</p>
    </div>;
  }

  return (
    <div className="pb-20">
      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/browse")}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <Button
            variant="outline"
            onClick={() => favoriteMutation.mutate()}
            className="gap-2"
          >
            <Heart className={`h-4 w-4 ${isFavorite ? 'fill-primary text-primary' : ''}`} />
            Save
          </Button>
        </div>
      </div>

      {/* Hero Section with Gradient Background */}
      <div className="relative">
        {/* Hero Image/Gradient Background */}
        <div className="h-[300px] relative bg-gradient-to-br from-primary/20 via-primary/10 to-background overflow-hidden">
          {offer.featuredImageUrl ? (
            <div className="absolute inset-0">
              <img
                src={proxiedSrc(offer.featuredImageUrl)}
                alt={offer.title}
                className="w-full h-full object-cover opacity-30"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />
            </div>
          ) : null}
        </div>

        {/* Company Info Card - Overlapping Hero */}
        <div className="max-w-7xl mx-auto px-6">
          <div className="relative -mt-32">
            <Card className="border-2 shadow-xl">
              <CardContent className="p-8">
                {/* Company Logo Circle */}
                <div className="flex justify-center -mt-20 mb-6">
                  <div className="relative">
                    <Avatar className="h-32 w-32 border-4 border-background shadow-lg">
                      <AvatarImage src={offer.company?.logoUrl} alt={offer.company?.tradeName} />
                      <AvatarFallback className="text-3xl">
                        {offer.company?.tradeName?.[0] || offer.title[0]}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>

                {/* Company Name & Rating */}
                <div className="text-center mb-6">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <h1 className="text-2xl font-bold">
                      {offer.company?.tradeName || offer.company?.legalName || offer.title}
                    </h1>
                    {offer.company?.status === 'approved' && (
                      <Badge className="bg-green-500 text-white gap-1 text-xs">
                        <Verified className="h-3 w-3" />
                        Verified
                      </Badge>
                    )}
                  </div>
                  
                  {/* Star Rating */}
                  {averageRating > 0 && (
                    <div className="flex items-center justify-center gap-2">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 ${
                              star <= Math.round(averageRating)
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {averageRating.toFixed(1)} ({reviews?.length || 0} reviews)
                      </span>
                    </div>
                  )}
                </div>

                {/* Large Commission Card */}
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-6 text-white mb-6">
                  <div className="text-center">
                    <div className="text-5xl font-bold mb-2">
                      {formatCommission(offer)}
                    </div>
                    <div className="text-lg opacity-90">
                      {getCommissionTypeLabel(offer)}
                    </div>
                    
                    {/* Additional Commission Details */}
                    <div className="flex items-center justify-center gap-6 mt-4 text-sm opacity-90">
                      {offer.cookieDuration && (
                        <div>
                          {offer.cookieDuration}-day cookie duration
                        </div>
                      )}
                      {offer.averageOrderValue && (
                        <div>
                          Average order: ${offer.averageOrderValue}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-4 text-center text-sm">
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{offer.activeCreatorCount || 0} active creators</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MousePointer className="h-4 w-4" />
                      <span>{offer.totalClicks || 0} clicks this month</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Wallet className="h-4 w-4" />
                      <span>${offer.minimumPayout || 50} minimum payout</span>
                    </div>
                  </div>
                </div>

                {/* Hashtag Badges */}
                {(offer.primaryNiche || offer.secondaryNiche) && (
                  <div className="flex flex-wrap gap-2 justify-center mt-6 pt-6 border-t">
                    {offer.primaryNiche && (
                      <Badge variant="secondary" className="text-sm">
                        #{offer.primaryNiche}
                      </Badge>
                    )}
                    {offer.secondaryNiche && (
                      <Badge variant="secondary" className="text-sm">
                        #{offer.secondaryNiche}
                      </Badge>
                    )}
                    {offer.additionalNiches?.map((niche: string) => (
                      <Badge key={niche} variant="secondary" className="text-sm">
                        #{niche}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Sticky Tab Navigation */}
      <div className="sticky top-[73px] z-30 bg-background/95 backdrop-blur border-b mt-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex">
            <button
              onClick={() => scrollToSection("overview")}
              className={`flex-1 px-6 py-4 font-medium text-sm transition-colors border-b-2 ${
                activeSection === "overview"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => scrollToSection("videos")}
              className={`flex-1 px-6 py-4 font-medium text-sm transition-colors border-b-2 ${
                activeSection === "videos"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Videos
            </button>
            <button
              onClick={() => scrollToSection("requirements")}
              className={`flex-1 px-6 py-4 font-medium text-sm transition-colors border-b-2 ${
                activeSection === "requirements"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Requirements
            </button>
            <button
              onClick={() => scrollToSection("reviews")}
              className={`flex-1 px-6 py-4 font-medium text-sm transition-colors border-b-2 ${
                activeSection === "reviews"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Reviews
            </button>
          </div>
        </div>
      </div>

      {/* Content Sections */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Overview Section */}
        <div ref={overviewRef} data-section="overview" className="space-y-6 mb-16">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">About This Offer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="prose prose-sm max-w-none">
                <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {offer.fullDescription || offer.description || offer.shortDescription || "No description available"}
                </p>
              </div>
              
              {/* Commission Details Grid */}
              <div className="grid sm:grid-cols-2 gap-6 pt-6 border-t">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Commission Structure</div>
                  <div className="text-2xl font-bold text-primary">
                    {formatCommission(offer)}
                  </div>
                  <Badge variant="secondary" className="mt-2">
                    {getCommissionTypeLabel(offer)}
                  </Badge>
                </div>
                
                {offer.paymentSchedule && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Payment Schedule</div>
                    <div className="text-lg font-semibold">{offer.paymentSchedule}</div>
                  </div>
                )}
                
                {offer.minimumPayout && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Minimum Payout</div>
                    <div className="text-lg font-semibold font-mono">${offer.minimumPayout}</div>
                  </div>
                )}
                
                {offer.cookieDuration && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Cookie Duration</div>
                    <div className="text-lg font-semibold">{offer.cookieDuration} days</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* About the Company */}
          {offer.company && (
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">
                  About {offer.company.tradeName || offer.company.legalName}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {offer.company.description && (
                  <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {offer.company.description}
                  </p>
                )}

                <div className="grid gap-4">
                  {offer.company.industry && (
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <TrendingUp className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">Industry</div>
                        <div className="text-sm text-muted-foreground capitalize">{offer.company.industry}</div>
                      </div>
                    </div>
                  )}

                  {offer.company.websiteUrl && (
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Globe className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">Website</div>
                        <a 
                          href={offer.company.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline break-all"
                        >
                          {offer.company.websiteUrl.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    </div>
                  )}

                  {offer.company.yearFounded && (
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Clock className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">Founded</div>
                        <div className="text-sm text-muted-foreground">{offer.company.yearFounded}</div>
                      </div>
                    </div>
                  )}

                  {offer.company.companySize && (
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">Company Size</div>
                        <div className="text-sm text-muted-foreground capitalize">{offer.company.companySize}</div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Videos Section */}
        <div ref={videosRef} data-section="videos" className="space-y-6 mb-16">
          <div className="flex items-center gap-2">
            <Video className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">
              Example Videos ({offer.videos?.length || 0})
            </h2>
          </div>
          
          {!offer.videos || offer.videos.length === 0 ? (
            <Card>
              <CardContent className="p-16 text-center">
                <Play className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">No example videos available</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {offer.videos.map((video: any) => (
                <Card
                  key={video.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer overflow-hidden group"
                  onClick={() => setSelectedVideo(video)}
                >
                  <div className="aspect-video relative bg-gradient-to-br from-purple-400 via-pink-400 to-blue-400 overflow-hidden">
                    {video.thumbnailUrl ? (
                      <img
                        src={proxiedSrc(video.thumbnailUrl)}
                        alt={video.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                    
                    {/* Play Button Overlay */}
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <div className="bg-white/90 rounded-full p-3">
                        <Play className="h-8 w-8 text-primary fill-primary" />
                      </div>
                    </div>

                    {/* Duration Badge */}
                    {video.duration && (
                      <Badge className="absolute bottom-3 right-3 bg-black/80 text-white border-0">
                        {video.duration}
                      </Badge>
                    )}
                  </div>
                  
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-sm line-clamp-2 mb-1">{video.title}</h4>
                    {video.creatorCredit && (
                      <p className="text-xs text-muted-foreground">by {video.creatorCredit}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Requirements Section - Icon Based */}
        <div ref={requirementsRef} data-section="requirements" className="space-y-6 mb-16">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
            <h2 className="text-2xl font-bold">Creator Requirements</h2>
          </div>
          
          <Card>
            <CardContent className="p-8 space-y-6">
              {/* Minimum Followers */}
              {offer.minimumFollowers && (
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                    <Users className="h-6 w-6 text-purple-500" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-lg mb-1">
                      Minimum {offer.minimumFollowers.toLocaleString()} followers
                    </div>
                    <div className="text-sm text-muted-foreground">
                      On at least one platform (YouTube, TikTok, or Instagram)
                    </div>
                  </div>
                </div>
              )}

              {/* Allowed Platforms */}
              {offer.allowedPlatforms && offer.allowedPlatforms.length > 0 && (
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                    <Video className="h-6 w-6 text-purple-500" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-lg mb-1">
                      Platforms: {offer.allowedPlatforms.join(", ")}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Must be able to post video content
                    </div>
                  </div>
                </div>
              )}

              {/* Geographic Restrictions */}
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                  <Globe className="h-6 w-6 text-cyan-500" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-lg mb-1">
                    Location: {offer.geographicRestrictions && offer.geographicRestrictions.length > 0 
                      ? offer.geographicRestrictions.join(", ")
                      : "Worldwide"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {offer.geographicRestrictions && offer.geographicRestrictions.length > 0
                      ? "Restricted to specific regions"
                      : "No geographic restrictions"}
                  </div>
                </div>
              </div>

              {/* Content Style */}
              {offer.contentStyleRequirements && (
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-6 w-6 text-purple-500" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-lg mb-1">
                      Content Style: {offer.contentStyleRequirements}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      We welcome all authentic content styles
                    </div>
                  </div>
                </div>
              )}

              {/* Brand Safety */}
              {offer.brandSafetyRequirements && (
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                    <Shield className="h-6 w-6 text-orange-500" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-lg mb-1">
                      Brand Safety: {offer.brandSafetyRequirements}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      No explicit, political, or controversial content
                    </div>
                  </div>
                </div>
              )}

              {/* General Requirements Text */}
              {(offer.creatorRequirements || offer.requirements) && (
                <div className="pt-4 border-t">
                  <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {offer.creatorRequirements || offer.requirements}
                  </p>
                </div>
              )}

              {/* No requirements message */}
              {!offer.minimumFollowers && 
               !offer.allowedPlatforms?.length && 
               !offer.contentStyleRequirements && 
               !offer.brandSafetyRequirements &&
               !offer.creatorRequirements &&
               !offer.requirements && (
                <div className="text-center py-8 text-muted-foreground">
                  No specific requirements listed
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Reviews Section */}
        <div ref={reviewsRef} data-section="reviews" className="space-y-6 mb-16">
          <h2 className="text-2xl font-bold">Creator Reviews</h2>
          
          <Card>
            <CardContent className="p-8">
              {reviewsLoading ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Loading reviews...</p>
                </div>
              ) : !reviews || reviews.length === 0 ? (
                <div className="text-center py-12">
                  <Star className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground text-lg">No reviews yet</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Be the first to work with this offer and leave a review
                  </p>
                </div>
              ) : (
                <div className="space-y-8">
                  {reviews.map((review: any) => (
                    <div key={review.id} className="border-b pb-8 last:border-0">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`h-5 w-5 ${
                                    star <= review.overallRating
                                      ? "fill-yellow-400 text-yellow-400"
                                      : "text-gray-300"
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="font-semibold">{review.overallRating}/5</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {new Date(review.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>

                      {review.reviewText && (
                        <p className="mb-4 leading-relaxed">{review.reviewText}</p>
                      )}

                      {/* Rating breakdown */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        {review.paymentSpeedRating && (
                          <div>
                            <div className="text-muted-foreground mb-1">Payment Speed</div>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`h-3 w-3 ${
                                    star <= review.paymentSpeedRating
                                      ? "fill-yellow-400 text-yellow-400"
                                      : "text-gray-300"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        {review.communicationRating && (
                          <div>
                            <div className="text-muted-foreground mb-1">Communication</div>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`h-3 w-3 ${
                                    star <= review.communicationRating
                                      ? "fill-yellow-400 text-yellow-400"
                                      : "text-gray-300"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        {review.offerQualityRating && (
                          <div>
                            <div className="text-muted-foreground mb-1">Offer Quality</div>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`h-3 w-3 ${
                                    star <= review.offerQualityRating
                                      ? "fill-yellow-400 text-yellow-400"
                                      : "text-gray-300"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        {review.supportRating && (
                          <div>
                            <div className="text-muted-foreground mb-1">Support</div>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`h-3 w-3 ${
                                    star <= review.supportRating
                                      ? "fill-yellow-400 text-yellow-400"
                                      : "text-gray-300"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Company response */}
                      {review.companyResponse && (
                        <div className="mt-6 bg-muted/50 rounded-lg p-4">
                          <p className="font-medium mb-2">Company Response</p>
                          <p className="text-sm text-muted-foreground">{review.companyResponse}</p>
                          {review.companyRespondedAt && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Responded on {new Date(review.companyRespondedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sticky Apply Button */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur p-4 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Commission</div>
              <div className="text-xl font-bold text-primary">
                {formatCommission(offer)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {hasApplied && existingApplication?.createdAt && (
              <Badge variant="secondary" className="hidden sm:flex">
                Applied on {new Date(existingApplication.createdAt).toLocaleDateString()}
              </Badge>
            )}
            
            <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
              <DialogTrigger asChild>
                <Button 
                  size="lg" 
                  className="gap-2" 
                  disabled={buttonConfig.disabled}
                  variant={buttonConfig.variant}
                >
                  {buttonConfig.icon}
                  {buttonConfig.text}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Apply to {offer.title}</DialogTitle>
                  <DialogDescription>
                    Tell the company why you're interested in promoting their offer
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="message">Why are you interested?</Label>
                    <Textarea
                      id="message"
                      placeholder="Tell the company about your audience and why you'd be a great fit..."
                      value={applicationMessage}
                      onChange={(e) => setApplicationMessage(e.target.value.slice(0, 500))}
                      className="min-h-32"
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {applicationMessage.length}/500
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="commission">Preferred Commission Model</Label>
                    <Select value={preferredCommission} onValueChange={setPreferredCommission}>
                      <SelectTrigger id="commission">
                        <SelectValue placeholder="Select preferred model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Standard Commission</SelectItem>
                        {offer.commissionType === 'hybrid' && (
                          <>
                            <SelectItem value="per_sale">Per Sale</SelectItem>
                            <SelectItem value="retainer">Monthly Retainer</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2 pt-4">
                    <Checkbox
                      id="terms"
                      checked={termsAccepted}
                      onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                    />
                    <Label htmlFor="terms" className="text-sm font-normal cursor-pointer">
                      I accept the terms and conditions and agree to promote this offer ethically
                    </Label>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    onClick={() => applyMutation.mutate()}
                    disabled={!applicationMessage || !termsAccepted || applyMutation.isPending}
                  >
                    {applyMutation.isPending ? "Submitting..." : "Submit Application"}
                  </Button>
                </DialogFooter>
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
              <DialogTitle>{selectedVideo.title}</DialogTitle>
              {selectedVideo.description && (
                <DialogDescription>{selectedVideo.description}</DialogDescription>
              )}
            </DialogHeader>
            <div className="aspect-video bg-muted rounded-lg overflow-hidden">
              {selectedVideo.videoUrl && (
                <video
                  src={proxiedSrc(selectedVideo.videoUrl)}
                  controls
                  className="w-full h-full"
                  crossOrigin="anonymous"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}