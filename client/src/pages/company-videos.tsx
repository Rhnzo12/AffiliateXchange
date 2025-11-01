import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Play, Trash2, ExternalLink } from "lucide-react";
import { useState } from "react";

export default function CompanyVideos() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedVideo, setSelectedVideo] = useState<any>(null);

  // Fetch all offers for the company
  const { data: offers, isLoading } = useQuery<any[]>({
    queryKey: ["/api/company/offers"],
  });

  // Delete video mutation
  const deleteMutation = useMutation({
    mutationFn: async (videoId: string) => {
      await apiRequest("DELETE", `/api/offer-videos/${videoId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/offers"] });
      toast({
        title: "Video Deleted",
        description: "The promotional video has been removed successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to delete video. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Collect all videos from all offers
  const allVideos = offers?.flatMap((offer: any) => 
    (offer.videos || []).map((video: any) => ({
      ...video,
      offerTitle: offer.title,
      offerId: offer.id,
    }))
  ) || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Promotional Videos</h1>
          <p className="text-muted-foreground">Loading your videos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-company-videos">Promotional Videos</h1>
        <p className="text-muted-foreground">
          All promotional videos across your offers ({allVideos.length} total)
        </p>
      </div>

      {allVideos.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="p-12 text-center">
            <Play className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">No promotional videos uploaded yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Upload videos to your offers to showcase your products
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {allVideos.map((video: any) => (
            <Card
              key={video.id}
              className="hover-elevate border-card-border overflow-hidden"
              data-testid={`video-card-${video.id}`}
            >
              <div
                className="aspect-video relative bg-muted cursor-pointer"
                onClick={() => setSelectedVideo(video)}
              >
                {video.thumbnailUrl ? (
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Play className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <Play className="h-12 w-12 text-white" />
                </div>
              </div>
              <CardContent className="p-4 space-y-3">
                <div>
                  <h4 className="font-semibold line-clamp-1" data-testid={`text-video-title-${video.id}`}>
                    {video.title}
                  </h4>
                  {video.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {video.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {video.offerTitle}
                  </Badge>
                </div>

                {video.creatorCredit && (
                  <p className="text-xs text-muted-foreground">
                    by {video.creatorCredit}
                  </p>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`/company/offers/${video.offerId}`, '_blank');
                    }}
                    data-testid={`button-view-offer-${video.id}`}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View Offer
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`button-delete-video-${video.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Video?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{video.title}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(video.id)}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Video Preview Dialog */}
      {selectedVideo && (
        <AlertDialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
          <AlertDialogContent className="max-w-4xl">
            <AlertDialogHeader>
              <AlertDialogTitle>{selectedVideo.title}</AlertDialogTitle>
              {selectedVideo.description && (
                <AlertDialogDescription>{selectedVideo.description}</AlertDialogDescription>
              )}
            </AlertDialogHeader>
            <div className="aspect-video bg-muted rounded-md overflow-hidden">
              <video
                src={selectedVideo.videoUrl}
                controls
                className="w-full h-full"
                autoPlay
              >
                Your browser does not support the video tag.
              </video>
            </div>
            {(selectedVideo.creatorCredit || selectedVideo.originalPlatform) && (
              <div className="flex gap-4 text-sm text-muted-foreground">
                {selectedVideo.creatorCredit && (
                  <span>Creator: {selectedVideo.creatorCredit}</span>
                )}
                {selectedVideo.originalPlatform && (
                  <span>Platform: {selectedVideo.originalPlatform}</span>
                )}
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>Close</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
