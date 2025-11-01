import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, MessageSquare, Reply } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function CompanyReviews() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [responseDialog, setResponseDialog] = useState<{ open: boolean; reviewId: string | null; response: string }>({
    open: false,
    reviewId: null,
    response: "",
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: companyReviews = [], isLoading: loadingReviews } = useQuery<any[]>({
    queryKey: ["/api/company/reviews"],
    enabled: isAuthenticated,
  });

  const submitResponseMutation = useMutation({
    mutationFn: async ({ reviewId, response }: { reviewId: string; response: string }) => {
      const res = await fetch(`/api/reviews/${reviewId}/respond`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ response }),
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to submit response");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/reviews"] });
      toast({
        title: "Response submitted",
        description: "Your response has been posted successfully",
      });
      setResponseDialog({ open: false, reviewId: null, response: "" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenResponseDialog = (reviewId: string) => {
    setResponseDialog({ open: true, reviewId, response: "" });
  };

  const handleSubmitResponse = () => {
    if (!responseDialog.reviewId || !responseDialog.response.trim()) {
      toast({
        title: "Error",
        description: "Please enter a response",
        variant: "destructive",
      });
      return;
    }

    submitResponseMutation.mutate({
      reviewId: responseDialog.reviewId,
      response: responseDialog.response.trim(),
    });
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-muted-foreground/30'
            }`}
          />
        ))}
      </div>
    );
  };

  const averageRating = companyReviews.length > 0
    ? (companyReviews.reduce((sum: number, r: any) => sum + r.overallRating, 0) / companyReviews.length).toFixed(1)
    : '0.0';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Reviews</h1>
        <p className="text-muted-foreground mt-1">
          See what creators are saying about your offers
        </p>
      </div>

      {companyReviews.length > 0 && (
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{averageRating}</div>
              <div className="flex gap-1 mt-2">
                {renderStars(Math.round(parseFloat(averageRating)))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{companyReviews.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                From creators who worked with you
              </p>
            </CardContent>
          </Card>

          <Card className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">5-Star Reviews</CardTitle>
              <Star className="h-4 w-4 text-yellow-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {companyReviews.filter((r: any) => r.overallRating === 5).length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {companyReviews.length > 0
                  ? `${Math.round((companyReviews.filter((r: any) => r.overallRating === 5).length / companyReviews.length) * 100)}%`
                  : '0%'} of total
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {loadingReviews ? (
        <div className="text-center py-12">
          <div className="animate-pulse text-lg text-muted-foreground">
            Loading reviews...
          </div>
        </div>
      ) : companyReviews.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Star className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No reviews yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Reviews from creators will appear here once they complete campaigns
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {companyReviews.map((review: any) => (
            <Card key={review.id} className="border-card-border" data-testid={`card-review-${review.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={review.creator?.profileImageUrl} />
                      <AvatarFallback>
                        {review.creator?.firstName?.[0] || 'C'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-base">
                        {review.creator?.firstName || 'Creator'}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {renderStars(review.overallRating)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-4">{review.reviewText}</p>

                {/* Rating breakdown */}
                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  {review.paymentSpeedRating && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Payment Speed</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className={`h-3 w-3 ${star <= review.paymentSpeedRating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                        ))}
                      </div>
                    </div>
                  )}
                  {review.communicationRating && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Communication</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className={`h-3 w-3 ${star <= review.communicationRating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                        ))}
                      </div>
                    </div>
                  )}
                  {review.offerQualityRating && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Offer Quality</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className={`h-3 w-3 ${star <= review.offerQualityRating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                        ))}
                      </div>
                    </div>
                  )}
                  {review.supportRating && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Support</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className={`h-3 w-3 ${star <= review.supportRating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {review.companyResponse ? (
                  <div className="mt-4 p-3 bg-muted/50 rounded-md">
                    <div className="text-xs font-semibold text-muted-foreground mb-1">
                      Your Response
                    </div>
                    <p className="text-sm">{review.companyResponse}</p>
                    {review.companyRespondedAt && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Responded {formatDistanceToNow(new Date(review.companyRespondedAt), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenResponseDialog(review.id)}
                    className="mt-2"
                  >
                    <Reply className="h-4 w-4 mr-2" />
                    Respond to Review
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Response Dialog */}
      <Dialog open={responseDialog.open} onOpenChange={(open) => setResponseDialog({ ...responseDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Respond to Review</DialogTitle>
            <DialogDescription>
              Write a thoughtful response to this creator's review
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Thank you for your review..."
              value={responseDialog.response}
              onChange={(e) => setResponseDialog({ ...responseDialog, response: e.target.value })}
              rows={6}
              className="resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setResponseDialog({ open: false, reviewId: null, response: "" })}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitResponse}
                disabled={submitResponseMutation.isPending || !responseDialog.response.trim()}
              >
                {submitResponseMutation.isPending ? "Submitting..." : "Submit Response"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
