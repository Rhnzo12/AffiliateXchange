import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Copy, ExternalLink, MessageSquare, TrendingUp, FileText, Clock, CheckCircle2, Star, StarOff } from "lucide-react";
import { Link } from "wouter";

const STATUS_COLORS: Record<string, any> = {
  pending: { variant: "secondary" as const, icon: Clock },
  approved: { variant: "default" as const, icon: CheckCircle2 },
  active: { variant: "default" as const, icon: TrendingUp },
  completed: { variant: "secondary" as const, icon: CheckCircle2 },
};

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

interface ReviewFormData {
  applicationId: string;
  companyId: string;
  reviewText: string;
  overallRating: number;
  paymentSpeedRating: number;
  communicationRating: number;
  offerQualityRating: number;
  supportRating: number;
}

const StarRating = ({ rating, onRatingChange }: { rating: number; onRatingChange: (rating: number) => void }) => {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onRatingChange(star)}
          className="focus:outline-none"
        >
          <Star
            className={`h-6 w-6 cursor-pointer transition-colors ${
              star <= rating
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300 hover:text-yellow-200"
            }`}
          />
        </button>
      ))}
    </div>
  );
};

export default function Applications() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [reviewDialog, setReviewDialog] = useState<{ open: boolean; application: any | null }>({
    open: false,
    application: null,
  });
  const [reviewForm, setReviewForm] = useState<ReviewFormData>({
    applicationId: "",
    companyId: "",
    reviewText: "",
    overallRating: 0,
    paymentSpeedRating: 0,
    communicationRating: 0,
    offerQualityRating: 0,
    supportRating: 0,
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = "/login";
    }
  }, [isAuthenticated, isLoading]);

  const { data: applications } = useQuery<any[]>({
    queryKey: ["/api/applications"],
    enabled: isAuthenticated,
  });

  // Fetch user's reviews to check which applications have been reviewed
  const { data: userReviews = [] } = useQuery<any[]>({
    queryKey: ["/api/user/reviews"],
    enabled: isAuthenticated,
  });

  const submitReviewMutation = useMutation({
    mutationFn: async (reviewData: ReviewFormData) => {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(reviewData),
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to submit review");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/reviews"] });
      toast({
        title: "Review submitted",
        description: "Thank you for your feedback!",
      });
      setReviewDialog({ open: false, application: null });
      setReviewForm({
        applicationId: "",
        companyId: "",
        reviewText: "",
        overallRating: 0,
        paymentSpeedRating: 0,
        communicationRating: 0,
        offerQualityRating: 0,
        supportRating: 0,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const copyTrackingLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({
      title: "Copied!",
      description: "Tracking link copied to clipboard",
    });
  };

  const getExistingReview = (applicationId: string) => {
    return userReviews.find((review: any) => review.applicationId === applicationId);
  };

  const hasReview = (applicationId: string) => {
    return userReviews.some((review: any) => review.applicationId === applicationId);
  };

  const handleOpenReviewDialog = (application: any) => {
    const existingReview = getExistingReview(application.id);

    setReviewDialog({ open: true, application });

    if (existingReview) {
      // Editing existing review
      setReviewForm({
        applicationId: application.id,
        companyId: application.offer?.companyId || "",
        reviewText: existingReview.reviewText || "",
        overallRating: existingReview.overallRating || 0,
        paymentSpeedRating: existingReview.paymentSpeedRating || 0,
        communicationRating: existingReview.communicationRating || 0,
        offerQualityRating: existingReview.offerQualityRating || 0,
        supportRating: existingReview.supportRating || 0,
      });
    } else {
      // New review
      setReviewForm({
        applicationId: application.id,
        companyId: application.offer?.companyId || "",
        reviewText: "",
        overallRating: 0,
        paymentSpeedRating: 0,
        communicationRating: 0,
        offerQualityRating: 0,
        supportRating: 0,
      });
    }
  };

  const handleSubmitReview = () => {
    if (reviewForm.overallRating === 0) {
      toast({
        title: "Error",
        description: "Please provide an overall rating",
        variant: "destructive",
      });
      return;
    }

    submitReviewMutation.mutate(reviewForm);
  };

  const filteredApplications = applications?.filter(app => {
    if (activeTab === "all") return true;
    return app.status === activeTab;
  });

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-lg">Loading...</div>
    </div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">My Applications</h1>
        <p className="text-muted-foreground mt-1">Track all your affiliate applications in one place</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">
            All ({applications?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending
          </TabsTrigger>
          <TabsTrigger value="approved" data-testid="tab-approved">
            Approved
          </TabsTrigger>
          <TabsTrigger value="active" data-testid="tab-active">
            Active
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4 mt-6">
          {!filteredApplications || filteredApplications.length === 0 ? (
            <Card className="border-card-border">
              <CardContent className="p-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">No applications yet</h3>
                <p className="text-muted-foreground mb-4">Start browsing offers and apply to begin earning</p>
                <Link href="/browse">
                  <Button data-testid="button-browse-offers">Browse Offers</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            filteredApplications.map((application: any) => {
              const StatusIcon = STATUS_COLORS[application.status]?.icon || Clock;
              const canShowReviewButton = application.status === 'approved' || application.status === 'active';
              const existingReview = getExistingReview(application.id);

              return (
                <Card key={application.id} className="border-card-border hover-elevate" data-testid={`application-${application.id}`}>
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-6">
                      {/* Offer Thumbnail */}
                      <div className="md:w-48 aspect-video bg-muted rounded-lg overflow-hidden flex-shrink-0">
                        {application.offer?.featuredImageUrl ? (
                          <img
                            src={application.offer.featuredImageUrl}
                            alt={application.offer.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FileText className="h-8 w-8 text-muted-foreground/50" />
                          </div>
                        )}
                      </div>

                      {/* Application Details */}
                      <div className="flex-1 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-1">
                            <Link href={`/offers/${application.offer?.id}`}>
                              <h3 className="font-semibold text-lg hover:text-primary cursor-pointer">
                                {application.offer?.title || "Untitled Offer"}
                              </h3>
                            </Link>
                            <p className="text-sm text-muted-foreground">
                              {application.offer?.company?.tradeName || "Company"}
                            </p>
                          </div>
                          <Badge {...STATUS_COLORS[application.status]} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {application.status}
                          </Badge>
                        </div>

                        <div className="grid sm:grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground">Applied</div>
                            <div className="font-medium">
                              {new Date(application.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Commission</div>
                            <div className="font-medium font-mono">
                              {formatCommission(application.offer)}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Type</div>
                            <Badge variant="secondary" className="mt-1">
                              {application.offer?.commissionType?.replace(/_/g, ' ') || 'Standard'}
                            </Badge>
                          </div>
                        </div>

                        {application.status === 'approved' && application.trackingLink && (
                          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                            <div className="text-sm font-medium">Your Tracking Link</div>
                            <div className="flex gap-2">
                              <code className="flex-1 text-sm bg-background px-3 py-2 rounded border overflow-x-auto">
                                {application.trackingLink}
                              </code>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyTrackingLink(application.trackingLink)}
                                data-testid={`button-copy-link-${application.id}`}
                                className="gap-2"
                              >
                                <Copy className="h-4 w-4" />
                                Copy
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Quick Actions */}
                        <div className="flex flex-wrap gap-2 pt-2">
                          {application.trackingLink && (
                            <Link href={`/analytics/${application.id}`}>
                              <Button size="sm" variant="outline" data-testid={`button-analytics-${application.id}`} className="gap-2">
                                <TrendingUp className="h-4 w-4" />
                                View Analytics
                              </Button>
                            </Link>
                          )}
                          <Link href={`/messages?application=${application.id}`}>
                            <Button size="sm" variant="outline" data-testid={`button-message-${application.id}`} className="gap-2">
                              <MessageSquare className="h-4 w-4" />
                              Message Company
                            </Button>
                          </Link>
                          <Link href={`/offers/${application.offer?.id}`}>
                            <Button size="sm" variant="outline" data-testid={`button-view-offer-${application.id}`} className="gap-2">
                              <ExternalLink className="h-4 w-4" />
                              View Offer
                            </Button>
                          </Link>
                          {canShowReviewButton && (
                            <Button
                              size="sm"
                              variant={existingReview ? "outline" : "default"}
                              onClick={() => handleOpenReviewDialog(application)}
                              data-testid={`button-review-${application.id}`}
                              className="gap-2"
                            >
                              <Star className="h-4 w-4" />
                              {existingReview ? "Edit Review" : "Leave Review"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* Review Dialog */}
      <Dialog open={reviewDialog.open} onOpenChange={(open) => setReviewDialog({ ...reviewDialog, open })}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {getExistingReview(reviewDialog.application?.id) ? "Edit Review" : "Leave a Review"}
            </DialogTitle>
            <DialogDescription>
              Share your experience working with {reviewDialog.application?.offer?.company?.tradeName || "this company"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Overall Rating */}
            <div className="space-y-2">
              <Label className="text-base">Overall Rating *</Label>
              <StarRating
                rating={reviewForm.overallRating}
                onRatingChange={(rating) => setReviewForm({ ...reviewForm, overallRating: rating })}
              />
            </div>

            {/* Review Text */}
            <div className="space-y-2">
              <Label htmlFor="reviewText" className="text-base">Your Review</Label>
              <Textarea
                id="reviewText"
                placeholder="Share your experience working with this company..."
                value={reviewForm.reviewText}
                onChange={(e) => setReviewForm({ ...reviewForm, reviewText: e.target.value })}
                rows={4}
                className="resize-none"
              />
            </div>

            {/* Detailed Ratings */}
            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium">Detailed Ratings (Optional)</h4>

              <div className="space-y-2">
                <Label>Payment Speed</Label>
                <StarRating
                  rating={reviewForm.paymentSpeedRating}
                  onRatingChange={(rating) => setReviewForm({ ...reviewForm, paymentSpeedRating: rating })}
                />
              </div>

              <div className="space-y-2">
                <Label>Communication</Label>
                <StarRating
                  rating={reviewForm.communicationRating}
                  onRatingChange={(rating) => setReviewForm({ ...reviewForm, communicationRating: rating })}
                />
              </div>

              <div className="space-y-2">
                <Label>Offer Quality</Label>
                <StarRating
                  rating={reviewForm.offerQualityRating}
                  onRatingChange={(rating) => setReviewForm({ ...reviewForm, offerQualityRating: rating })}
                />
              </div>

              <div className="space-y-2">
                <Label>Support</Label>
                <StarRating
                  rating={reviewForm.supportRating}
                  onRatingChange={(rating) => setReviewForm({ ...reviewForm, supportRating: rating })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button
                variant="outline"
                onClick={() => setReviewDialog({ open: false, application: null })}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitReview}
                disabled={submitReviewMutation.isPending || reviewForm.overallRating === 0}
              >
                {submitReviewMutation.isPending ? "Submitting..." : "Submit Review"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
