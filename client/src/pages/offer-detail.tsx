import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Heart, Star, Play, CheckCircle2, DollarSign, Clock, MapPin, Users, Check } from "lucide-react";

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

export default function OfferDetail() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, params] = useRoute("/offers/:id");
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

  // Scroll spy effect using Intersection Observer
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: "-80px 0px -60% 0px", // Account for sticky header and better triggering
      threshold: 0.1, // Simplified threshold
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      // Don't update active section when user is clicking tabs
      if (isScrolling) return;

      // Find the entry with the highest intersection ratio
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

    // Observe all sections
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
    // Immediately update active tab
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
      // Calculate the position of the sticky nav
      const stickyNavElement = document.querySelector('[class*="sticky"]');
      const navHeight = stickyNavElement ? stickyNavElement.getBoundingClientRect().height : 80;
      
      // Get the position of the section and scroll to it
      const elementPosition = ref.current.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - navHeight - 10; // Extra 10px padding
      
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });

      // Reset scrolling flag after animation completes
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

  // Check if user has already applied to this offer
  const { data: applications } = useQuery<any[]>({
    queryKey: ["/api/applications"],
    enabled: isAuthenticated,
  });

  // Fetch reviews for this offer
  const { data: reviews, isLoading: reviewsLoading } = useQuery<any[]>({
    queryKey: [`/api/offers/${offerId}/reviews`],
    enabled: !!offerId,
  });

  // Find if there's an existing application for this offer
  const existingApplication = applications?.find(
    app => app.offer?.id === offerId || app.offerId === offerId
  );
  const hasApplied = !!existingApplication;
  const applicationStatus = existingApplication?.status;

  // Get button text and state based on application status
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
      {/* Hero Image */}
      <div className="aspect-[21/9] relative bg-muted rounded-lg overflow-hidden mb-6">
        {offer.featuredImageUrl ? (
          <img src={offer.featuredImageUrl} alt={offer.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play className="h-20 w-20 text-muted-foreground/50" />
          </div>
        )}
        {offer.isPriority && (
          <Badge className="absolute top-4 right-4 bg-primary text-lg px-4 py-2">
            Featured
          </Badge>
        )}
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            {offer.company?.logoUrl && (
              <Avatar className="h-12 w-12">
                <AvatarImage src={offer.company.logoUrl} alt={offer.company.tradeName} />
                <AvatarFallback>{offer.company.tradeName?.[0]}</AvatarFallback>
              </Avatar>
            )}
            <div>
              <h1 className="text-3xl font-bold">{offer.title}</h1>
              <p className="text-muted-foreground">{offer.company?.tradeName || "Company"}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => favoriteMutation.mutate()}
            data-testid="button-favorite"
            className="h-10 w-10"
          >
            <Heart className={`h-5 w-5 ${isFavorite ? 'fill-primary text-primary' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Sticky Navigation */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b mb-6">
        <div className="flex">
          <button
            onClick={() => scrollToSection("overview")}
            className={`flex-1 px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeSection === "overview"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-testid="tab-overview"
          >
            Overview
          </button>
          <button
            onClick={() => scrollToSection("videos")}
            className={`flex-1 px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeSection === "videos"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-testid="tab-videos"
          >
            Videos ({offer.videos?.length || 0})
          </button>
          <button
            onClick={() => scrollToSection("requirements")}
            className={`flex-1 px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeSection === "requirements"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-testid="tab-requirements"
          >
            Requirements
          </button>
          <button
            onClick={() => scrollToSection("reviews")}
            className={`flex-1 px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeSection === "reviews"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-testid="tab-reviews"
          >
            Reviews
          </button>
        </div>
      </div>

      {/* Overview Section */}
      <div ref={overviewRef} data-section="overview" className="space-y-6 mb-12">
        <Card className="border-card-border">
          <CardHeader>
            <CardTitle>About This Offer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground whitespace-pre-wrap">
              {offer.fullDescription || offer.description || offer.shortDescription || "No description available"}
            </p>
            
            <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Commission</div>
                <div className="text-2xl font-bold font-mono text-primary">
                  {formatCommission(offer)}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Commission Type</div>
                <Badge>{offer.commissionType?.replace(/_/g, ' ') || 'Standard'}</Badge>
              </div>
              {offer.paymentSchedule && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Payment Schedule</div>
                  <div className="font-semibold">{offer.paymentSchedule}</div>
                </div>
              )}
              {offer.minimumPayout && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Minimum Payout</div>
                  <div className="font-semibold font-mono">${offer.minimumPayout}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Videos Section */}
      <div ref={videosRef} data-section="videos" className="space-y-6 mb-12">
        <h2 className="text-2xl font-bold">Example Videos</h2>
        {!offer.videos || offer.videos.length === 0 ? (
          <Card className="border-card-border">
            <CardContent className="p-12 text-center">
              <Play className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No example videos available</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {offer.videos.map((video: any) => (
              <Card
                key={video.id}
                className="hover-elevate cursor-pointer border-card-border"
                onClick={() => setSelectedVideo(video)}
                data-testid={`video-${video.id}`}
              >
                <div className="aspect-video relative bg-muted rounded-t-lg overflow-hidden">
                  {video.thumbnailUrl ? (
                    <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Play className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <Play className="h-12 w-12 text-white" />
                  </div>
                </div>
                <CardContent className="p-3">
                  <h4 className="font-semibold text-sm line-clamp-1">{video.title}</h4>
                  {video.creatorCredit && (
                    <p className="text-xs text-muted-foreground mt-1">by {video.creatorCredit}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Requirements Section */}
      <div ref={requirementsRef} data-section="requirements" className="space-y-6 mb-12">
        <h2 className="text-2xl font-bold">Creator Requirements</h2>
        <Card className="border-card-border">
          <CardContent className="space-y-4 pt-6">
            {offer.minimumFollowers && (
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="font-semibold">Minimum Followers</div>
                  <div className="text-muted-foreground">{offer.minimumFollowers.toLocaleString()}</div>
                </div>
              </div>
            )}
            {offer.allowedPlatforms && offer.allowedPlatforms.length > 0 && (
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="font-semibold">Allowed Platforms</div>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {offer.allowedPlatforms.map((platform: string) => (
                      <Badge key={platform} variant="secondary">{platform}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {offer.geographicRestrictions && offer.geographicRestrictions.length > 0 && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="font-semibold">Geographic Restrictions</div>
                  <div className="text-muted-foreground">{offer.geographicRestrictions.join(', ')}</div>
                </div>
              </div>
            )}
            {offer.contentStyleRequirements && (
              <div className="pt-4 border-t">
                <div className="font-semibold mb-2">Content Style Requirements</div>
                <p className="text-muted-foreground whitespace-pre-wrap">{offer.contentStyleRequirements}</p>
              </div>
            )}
            {offer.brandSafetyRequirements && (
              <div className="pt-4 border-t">
                <div className="font-semibold mb-2">Brand Safety Requirements</div>
                <p className="text-muted-foreground whitespace-pre-wrap">{offer.brandSafetyRequirements}</p>
              </div>
            )}
            {!offer.minimumFollowers && 
             !offer.allowedPlatforms?.length && 
             !offer.geographicRestrictions?.length && 
             !offer.contentStyleRequirements && 
             !offer.brandSafetyRequirements && (
              <p className="text-center py-8 text-muted-foreground">
                No specific requirements listed
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reviews Section */}
      <div ref={reviewsRef} data-section="reviews" className="space-y-6 mb-12">
        <h2 className="text-2xl font-bold">Creator Reviews</h2>
        <Card className="border-card-border">
          <CardContent className="pt-6">
            {reviewsLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading reviews...</p>
              </div>
            ) : !reviews || reviews.length === 0 ? (
              <div className="text-center py-12">
                <Star className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">No reviews yet</p>
                <p className="text-sm text-muted-foreground mt-1">Be the first to work with this offer and leave a review</p>
              </div>
            ) : (
              <div className="space-y-6">
                {reviews.map((review: any) => (
                  <div key={review.id} className="border-b pb-6 last:border-0">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`h-4 w-4 ${
                                  star <= review.overallRating
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "text-gray-300"
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm font-medium">{review.overallRating}/5</span>
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
                      <p className="text-sm mb-4">{review.reviewText}</p>
                    )}

                    {/* Rating breakdown */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {review.paymentSpeedRating && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Payment Speed</span>
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
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Communication</span>
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
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Offer Quality</span>
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
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Support</span>
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
                      <div className="mt-4 bg-muted/50 rounded-lg p-4">
                        <p className="text-sm font-medium mb-2">Company Response</p>
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

      {/* Sticky Apply Button */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur p-4 z-40">
        <div className="max-w-7xl mx-auto flex flex-col items-end gap-2">
          <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
            <DialogTrigger asChild>
              <Button 
                size="lg" 
                className="gap-2" 
                data-testid="button-apply"
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
                  <Label htmlFor="message">Why are you interested? *</Label>
                  <Textarea
                    id="message"
                    placeholder="Tell the company about your audience and why you'd be a great fit..."
                    value={applicationMessage}
                    onChange={(e) => setApplicationMessage(e.target.value.slice(0, 500))}
                    className="min-h-32"
                    data-testid="textarea-application-message"
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {applicationMessage.length}/500
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="commission">Preferred Commission Model</Label>
                  <Select value={preferredCommission} onValueChange={setPreferredCommission}>
                    <SelectTrigger id="commission" data-testid="select-preferred-commission">
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
                    data-testid="checkbox-terms"
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
                  data-testid="button-submit-application"
                >
                  {applyMutation.isPending ? "Submitting..." : "Submit Application"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {/* Show application date if user has already applied */}
          {hasApplied && existingApplication?.createdAt && (
            <Badge variant="secondary" className="text-xs">
              Applied on {new Date(existingApplication.createdAt).toLocaleDateString()}
            </Badge>
          )}
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
                <video src={selectedVideo.videoUrl} controls className="w-full h-full" />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}