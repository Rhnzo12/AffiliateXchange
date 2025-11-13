import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { apiRequest, queryClient } from "../lib/queryClient";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
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
} from "../components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Play, Trash2, ExternalLink, Video, Search, SlidersHorizontal } from "lucide-react";
import { proxiedSrc } from "../lib/image";
import { useMemo, useState } from "react";
import { TopNavBar } from "../components/TopNavBar";
import { VideoPlayer } from "../components/VideoPlayer";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

export default function CompanyVideos() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [offerFilter, setOfferFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");

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

  const offerOptions = useMemo(() => {
    const uniqueOffers = new Map<string, string>();
    for (const video of allVideos) {
      if (video.offerId && !uniqueOffers.has(video.offerId)) {
        uniqueOffers.set(video.offerId, video.offerTitle || "Untitled Offer");
      }
    }
    return Array.from(uniqueOffers.entries());
  }, [allVideos]);

  const platformOptions = useMemo(() => {
    const uniquePlatforms = new Set<string>();
    for (const video of allVideos) {
      if (video.originalPlatform) {
        uniquePlatforms.add(video.originalPlatform);
      }
    }
    return Array.from(uniquePlatforms.values());
  }, [allVideos]);

  const filteredVideos = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return allVideos.filter((video: any) => {
      const matchesOffer = offerFilter === "all" || video.offerId === offerFilter;
      const matchesPlatform =
        platformFilter === "all" || video.originalPlatform === platformFilter;

      if (normalizedSearch.length === 0) {
        return matchesOffer && matchesPlatform;
      }

      const searchableContent = [
        video.title,
        video.description,
        video.offerTitle,
        video.creatorCredit,
        video.originalPlatform,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = searchableContent.includes(normalizedSearch);

      return matchesOffer && matchesPlatform && matchesSearch;
    });
  }, [allVideos, offerFilter, platformFilter, searchTerm]);

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
      <TopNavBar />
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-company-videos">Promotional Videos</h1>
        <p className="text-muted-foreground">
          All promotional videos across your offers ({allVideos.length} total)
        </p>
        {allVideos.length > 0 && filteredVideos.length !== allVideos.length && (
          <p className="text-sm text-muted-foreground mt-1">
            Showing {filteredVideos.length} video{filteredVideos.length === 1 ? "" : "s"} that match your
            filters
          </p>
        )}
      </div>

      {allVideos.length > 0 && (
        <div className="border border-card-border rounded-lg p-4 bg-muted/30">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="w-full md:max-w-sm">
              <Label htmlFor="video-search" className="flex items-center gap-2 text-sm font-medium">
                <Search className="h-4 w-4" />
                Search videos
              </Label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="video-search"
                  placeholder="Search by title, offer, or creator"
                  className="pl-9"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  data-testid="input-video-search"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="offer-filter" className="flex items-center gap-2 text-sm font-medium">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filter by offer
                </Label>
                <Select value={offerFilter} onValueChange={setOfferFilter}>
                  <SelectTrigger id="offer-filter" data-testid="select-offer-filter">
                    <SelectValue placeholder="All offers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All offers</SelectItem>
                    {offerOptions.map(([id, title]) => (
                      <SelectItem key={id} value={id}>
                        {title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="platform-filter" className="flex items-center gap-2 text-sm font-medium">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filter by platform
                </Label>
                <Select value={platformFilter} onValueChange={setPlatformFilter}>
                  <SelectTrigger id="platform-filter" data-testid="select-platform-filter">
                    <SelectValue placeholder="All platforms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All platforms</SelectItem>
                    {platformOptions.map((platform) => (
                      <SelectItem key={platform} value={platform}>
                        {platform}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      )}

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
      ) : filteredVideos.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="p-12 text-center space-y-2">
            <SlidersHorizontal className="h-12 w-12 text-muted-foreground/50 mx-auto" />
            <p className="text-muted-foreground font-medium">No videos match your filters</p>
            <p className="text-sm text-muted-foreground">
              Try adjusting your search or clearing the filters to see all videos
            </p>
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={() => {
                setSearchTerm("");
                setOfferFilter("all");
                setPlatformFilter("all");
              }} data-testid="button-clear-video-filters">
                Clear filters
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredVideos.map((video: any) => (
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
                    src={proxiedSrc(video.thumbnailUrl)}
                    alt={video.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                    loading="lazy"
                    decoding="async"
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
        <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="line-clamp-2">{selectedVideo.title || "Video"}</DialogTitle>
              <DialogDescription className="line-clamp-3">
                {selectedVideo.description || "Preview this promotional video"}
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
            {(selectedVideo.creatorCredit || selectedVideo.originalPlatform) && (
              <div className="flex flex-col gap-2 text-sm text-muted-foreground pt-2">
                {selectedVideo.creatorCredit && (
                  <div className="flex items-start gap-2">
                    <span className="font-medium flex-shrink-0">Creator:</span>
                    <span className="break-words line-clamp-2">{selectedVideo.creatorCredit}</span>
                  </div>
                )}
                {selectedVideo.originalPlatform && (
                  <div className="flex items-start gap-2">
                    <span className="font-medium flex-shrink-0">Platform:</span>
                    <span className="break-words line-clamp-2">{selectedVideo.originalPlatform}</span>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedVideo(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
