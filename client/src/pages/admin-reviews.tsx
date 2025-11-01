import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, Eye, EyeOff, Trash2, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function AdminReviews() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [adminNote, setAdminNote] = useState("");
  const [editedReview, setEditedReview] = useState<any>(null);

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

  const { data: reviews = [], isLoading: loadingReviews } = useQuery<any[]>({
    queryKey: ["/api/admin/reviews"],
    enabled: isAuthenticated,
  });

  const hideReviewMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const response = await apiRequest("POST", `/api/admin/reviews/${reviewId}/hide`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      toast({
        title: "Success",
        description: "Review hidden successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to hide review",
        variant: "destructive",
      });
    },
  });

  const deleteReviewMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const response = await apiRequest("DELETE", `/api/admin/reviews/${reviewId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      toast({
        title: "Success",
        description: "Review deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete review",
        variant: "destructive",
      });
    },
  });

  const saveNoteMutation = useMutation({
    mutationFn: async ({ reviewId, note }: { reviewId: string; note: string }) => {
      const response = await apiRequest("POST", `/api/admin/reviews/${reviewId}/note`, { note });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      toast({
        title: "Success",
        description: "Admin note saved successfully",
      });
      setIsNoteDialogOpen(false);
      setAdminNote("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save note",
        variant: "destructive",
      });
    },
  });

  const updateReviewMutation = useMutation({
    mutationFn: async ({ reviewId, updates }: { reviewId: string; updates: any }) => {
      const response = await apiRequest("PATCH", `/api/admin/reviews/${reviewId}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      toast({
        title: "Success",
        description: "Review updated successfully",
      });
      setIsEditDialogOpen(false);
      setEditedReview(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update review",
        variant: "destructive",
      });
    },
  });

  const approveReviewMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const response = await apiRequest("POST", `/api/admin/reviews/${reviewId}/approve`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      toast({
        title: "Success",
        description: "Review approved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve review",
        variant: "destructive",
      });
    },
  });

  const handleAddNote = (review: any) => {
    setSelectedReview(review);
    setAdminNote(review.adminNote || "");
    setIsNoteDialogOpen(true);
  };

  const handleEdit = (review: any) => {
    setSelectedReview(review);
    setEditedReview({
      reviewText: review.reviewText || "",
      overallRating: review.overallRating,
      paymentSpeedRating: review.paymentSpeedRating,
      communicationRating: review.communicationRating,
      offerQualityRating: review.offerQualityRating,
      supportRating: review.supportRating,
    });
    setIsEditDialogOpen(true);
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

  if (isLoading || loadingReviews) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Review Management</h1>
        <p className="text-muted-foreground mt-1">
          View, approve, edit, or delete reviews across the platform
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-card-border" data-testid="card-total-reviews">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-reviews">{reviews.length}</div>
          </CardContent>
        </Card>

        <Card className="border-card-border" data-testid="card-hidden-reviews">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hidden</CardTitle>
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-hidden-reviews">
              {reviews.filter((r: any) => r.isHidden).length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-card-border" data-testid="card-pending-approval">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary" data-testid="text-pending-approval">
              {reviews.filter((r: any) => !r.isApproved).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {reviews.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No reviews yet</h3>
              <p className="text-muted-foreground">
                Reviews will appear here once creators start submitting them
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((review: any) => (
            <Card 
              key={review.id} 
              className={`border-card-border ${review.isHidden ? 'opacity-50' : ''}`}
              data-testid={`card-review-${review.id}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {renderStars(review.overallRating)}
                      <span className="text-sm text-muted-foreground">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </span>
                      {review.isHidden && (
                        <Badge variant="secondary" data-testid={`badge-hidden-${review.id}`}>
                          <EyeOff className="h-3 w-3 mr-1" />
                          Hidden
                        </Badge>
                      )}
                      {!review.isApproved && (
                        <Badge variant="outline" data-testid={`badge-pending-${review.id}`}>
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Pending Approval
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-base">Creator ID: {review.creatorId}</CardTitle>
                    <CardDescription>Company ID: {review.companyId}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {!review.isApproved && (
                      <Button
                        size="sm"
                        onClick={() => approveReviewMutation.mutate(review.id)}
                        disabled={approveReviewMutation.isPending}
                        data-testid={`button-approve-${review.id}`}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(review)}
                      data-testid={`button-edit-${review.id}`}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddNote(review)}
                      data-testid={`button-note-${review.id}`}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      Note
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => hideReviewMutation.mutate(review.id)}
                      disabled={hideReviewMutation.isPending}
                      data-testid={`button-hide-${review.id}`}
                    >
                      <EyeOff className="h-4 w-4 mr-1" />
                      {review.isHidden ? 'Hidden' : 'Hide'}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (confirm('Are you sure you want to permanently delete this review?')) {
                          deleteReviewMutation.mutate(review.id);
                        }
                      }}
                      disabled={deleteReviewMutation.isPending}
                      data-testid={`button-delete-${review.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Review Text:</h4>
                    <p className="text-sm text-muted-foreground">{review.reviewText || 'No review text'}</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Payment Speed</p>
                      {renderStars(review.paymentSpeedRating)}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Communication</p>
                      {renderStars(review.communicationRating)}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Offer Quality</p>
                      {renderStars(review.offerQualityRating)}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Support</p>
                      {renderStars(review.supportRating)}
                    </div>
                  </div>
                  {review.companyResponse && (
                    <div className="bg-muted p-3 rounded-md">
                      <h4 className="text-sm font-medium mb-1">Company Response:</h4>
                      <p className="text-sm">{review.companyResponse}</p>
                    </div>
                  )}
                  {review.adminNote && (
                    <div className="bg-primary/5 p-3 rounded-md border border-primary/20">
                      <h4 className="text-sm font-medium mb-1">Admin Note:</h4>
                      <p className="text-sm">{review.adminNote}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Admin Note Dialog */}
      <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
        <DialogContent data-testid="dialog-admin-note">
          <DialogHeader>
            <DialogTitle>Admin Note</DialogTitle>
            <DialogDescription>
              Add an internal note about this review (not visible to users)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="adminNote">Note</Label>
              <Textarea
                id="adminNote"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Add your internal note here..."
                rows={4}
                data-testid="textarea-admin-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsNoteDialogOpen(false)}
              data-testid="button-cancel-note"
            >
              Cancel
            </Button>
            <Button
              onClick={() => selectedReview && saveNoteMutation.mutate({ 
                reviewId: selectedReview.id, 
                note: adminNote 
              })}
              disabled={saveNoteMutation.isPending}
              data-testid="button-save-note"
            >
              Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Review Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-edit-review">
          <DialogHeader>
            <DialogTitle>Edit Review</DialogTitle>
            <DialogDescription>
              Modify the review content and ratings
            </DialogDescription>
          </DialogHeader>
          {editedReview && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="reviewText">Review Text</Label>
                <Textarea
                  id="reviewText"
                  value={editedReview.reviewText}
                  onChange={(e) => setEditedReview({ ...editedReview, reviewText: e.target.value })}
                  placeholder="Review text..."
                  rows={4}
                  data-testid="textarea-review-text"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Overall Rating: {editedReview.overallRating}</Label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={editedReview.overallRating}
                    onChange={(e) => setEditedReview({ ...editedReview, overallRating: parseInt(e.target.value) })}
                    className="w-full"
                    data-testid="input-overall-rating"
                  />
                </div>
                <div>
                  <Label>Payment Speed: {editedReview.paymentSpeedRating}</Label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={editedReview.paymentSpeedRating}
                    onChange={(e) => setEditedReview({ ...editedReview, paymentSpeedRating: parseInt(e.target.value) })}
                    className="w-full"
                    data-testid="input-payment-speed-rating"
                  />
                </div>
                <div>
                  <Label>Communication: {editedReview.communicationRating}</Label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={editedReview.communicationRating}
                    onChange={(e) => setEditedReview({ ...editedReview, communicationRating: parseInt(e.target.value) })}
                    className="w-full"
                    data-testid="input-communication-rating"
                  />
                </div>
                <div>
                  <Label>Offer Quality: {editedReview.offerQualityRating}</Label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={editedReview.offerQualityRating}
                    onChange={(e) => setEditedReview({ ...editedReview, offerQualityRating: parseInt(e.target.value) })}
                    className="w-full"
                    data-testid="input-offer-quality-rating"
                  />
                </div>
                <div>
                  <Label>Support: {editedReview.supportRating}</Label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={editedReview.supportRating}
                    onChange={(e) => setEditedReview({ ...editedReview, supportRating: parseInt(e.target.value) })}
                    className="w-full"
                    data-testid="input-support-rating"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={() => selectedReview && editedReview && updateReviewMutation.mutate({
                reviewId: selectedReview.id,
                updates: { ...editedReview, isEdited: true }
              })}
              disabled={updateReviewMutation.isPending}
              data-testid="button-save-edit"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
