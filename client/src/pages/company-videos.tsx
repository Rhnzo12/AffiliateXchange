import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { apiRequest, queryClient } from "../lib/queryClient";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Play, Trash2, ExternalLink, Video, Filter, X, Search, Clock, CheckCircle2, Eye } from "lucide-react";
import { proxiedSrc } from "../lib/image";
import { useEffect, useMemo, useState } from "react";
import { TopNavBar } from "../components/TopNavBar";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import { VideoPlayer } from "../components/VideoPlayer";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";

type CompanyVideosProps = {
  hideTopNav?: boolean;
};

export default function CompanyVideos({ hideTopNav = false }: CompanyVideosProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [offerFilter, setOfferFilter] = useState("all");
  const [creditFilter, setCreditFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [pendingOfferFilter, setPendingOfferFilter] = useState("all");
  const [pendingCreditFilter, setPendingCreditFilter] = useState("all");
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);

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
      setErrorDialog({
        title: "Error",
        message: "Failed to delete video. Please try again.",
      });
    },
  });

  // Approve video mutation
  const approveMutation = useMutation({
    mutationFn: async (videoId: string) => {
      await apiRequest("POST", `/api/offer-videos/${videoId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/offers"] });
      toast({
        title: "Video Approved",
        description: "The promotional video has been approved.",
      });
    },
    onError: (error: Error) => {
      setErrorDialog({
        title: "Error",
        message: "Failed to approve video. Please try again.",
      });
    },
  });

  // Reject video mutation
  const rejectMutation = useMutation({
    mutationFn: async (videoId: string) => {
      await apiRequest("POST", `/api/offer-videos/${videoId}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/offers"] });
      toast({
        title: "Video Rejected",
        description: "The promotional video has been rejected.",
      });
    },
    onError: (error: Error) => {
      setErrorDialog({
        title: "Error",
        message: "Failed to reject video. Please try again.",
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

  // Stats
  const stats = useMemo(() => {
    return {
      total: allVideos.length,
      pending: allVideos.filter((v: any) => v.status === 'pending' || !v.status).length,
      approved: allVideos.filter((v: any) => v.status === 'approved').length,
    };
  }, [allVideos]);

  const uniqueOffers = useMemo(() => {
    const seen = new Map<string, string>();
    allVideos.forEach((video: any) => {
      if (video.offerId && video.offerTitle) {
        seen.set(video.offerId, video.offerTitle);
      }
    });
    return Array.from(seen.entries());
  }, [allVideos]);

  const filteredVideos = useMemo(() => {
    let result = allVideos.filter((video: any) => {
      const matchesSearch = searchTerm
        ? [video.title, video.description, video.offerTitle, video.creatorCredit]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(searchTerm.toLowerCase()))
        : true;
      const matchesOffer = offerFilter === "all" || video.offerId === offerFilter;
      const matchesCredit =
        creditFilter === "all"
          ? true
          : creditFilter === "with"
            ? Boolean(video.creatorCredit)
            : !video.creatorCredit;
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "pending"
            ? video.status === "pending" || !video.status
            : video.status === statusFilter;

      return matchesSearch && matchesOffer && matchesCredit && matchesStatus;
    });

    // Sort
    result.sort((a, b) => {
      if (sortOrder === "newest") {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    });

    return result;
  }, [allVideos, creditFilter, offerFilter, searchTerm, sortOrder, statusFilter]);

  const hasActiveFilters =
    searchTerm.trim().length > 0 || offerFilter !== "all" || creditFilter !== "all" || statusFilter !== "all";

  const clearFilters = () => {
    setSearchTerm("");
    setOfferFilter("all");
    setCreditFilter("all");
    setStatusFilter("all");
    setPendingOfferFilter("all");
    setPendingCreditFilter("all");
  };

  const applyFilters = () => {
    setOfferFilter(pendingOfferFilter);
    setCreditFilter(pendingCreditFilter);
    setFilterMenuOpen(false);
  };

  useEffect(() => {
    if (filterMenuOpen) {
      setPendingOfferFilter(offerFilter);
      setPendingCreditFilter(creditFilter);
    }
  }, [creditFilter, filterMenuOpen, offerFilter]);

  const getStatusBadge = (video: any) => {
    const status = video.status || 'pending';
    if (status === 'approved') {
      return <Badge className="bg-teal-500 hover:bg-teal-600 text-white text-[10px] px-1.5 py-0.5">Approved</Badge>;
    }
    if (status === 'rejected') {
      return <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">Rejected</Badge>;
    }
    return <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] px-1.5 py-0.5">Pending Approval</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-2"></div>
          <div className="h-4 bg-gray-100 rounded w-32"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {!hideTopNav && <TopNavBar />}

      {/* Search and Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by title, offer, or creator name..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="pl-9 h-9 text-sm bg-white"
            />
          </div>
          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger className="w-[100px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>
          <DropdownMenu open={filterMenuOpen} onOpenChange={setFilterMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <Filter className="h-4 w-4" />
                <span className="hidden sm:inline">Filter</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="filter-menu-scroll w-72 space-y-2">
              <DropdownMenuLabel>Filter videos</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <Accordion type="multiple" className="space-y-1">
                <AccordionItem value="offer" className="border-none">
                  <AccordionTrigger className="px-2 py-1 text-sm font-medium hover:no-underline">
                    Offer
                  </AccordionTrigger>
                  <AccordionContent className="space-y-1">
                    <DropdownMenuRadioGroup
                      value={pendingOfferFilter}
                      onValueChange={setPendingOfferFilter}
                    >
                      <DropdownMenuRadioItem value="all" onSelect={(e) => e.preventDefault()}>All Offers</DropdownMenuRadioItem>
                      {uniqueOffers.map(([id, title]) => (
                        <DropdownMenuRadioItem key={id} value={id} onSelect={(e) => e.preventDefault()}>
                          {title}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="credit" className="border-none">
                  <AccordionTrigger className="px-2 py-1 text-sm font-medium hover:no-underline">
                    Creator Credit
                  </AccordionTrigger>
                  <AccordionContent className="space-y-1">
                    <DropdownMenuRadioGroup
                      value={pendingCreditFilter}
                      onValueChange={setPendingCreditFilter}
                    >
                      <DropdownMenuRadioItem value="all" onSelect={(e) => e.preventDefault()}>All Videos</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="with" onSelect={(e) => e.preventDefault()}>With Creator Credit</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="without" onSelect={(e) => e.preventDefault()}>Without Creator Credit</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
              <DropdownMenuSeparator />
              <div className="flex items-center justify-between gap-2 px-2 pb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-muted-foreground"
                  onClick={(event) => {
                    event.preventDefault();
                    clearFilters();
                  }}
                >
                  <X className="h-4 w-4" />
                  Clear filters
                </Button>
                <Button
                  size="sm"
                  className="gap-2 border-0 bg-gray-200 text-black shadow-none hover:bg-gray-300"
                  onClick={applyFilters}
                >
                  Apply
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <span className="font-semibold text-gray-900">{stats.total.toLocaleString()}</span>
        <span className="text-gray-500">Promotional Videos</span>
        <span className="text-gray-300 mx-1">|</span>
        <span className="font-semibold text-amber-600">{stats.pending.toLocaleString()}</span>
        <span className="text-gray-500">Pending Approval</span>
        {hasActiveFilters && (
          <>
            <span className="text-gray-300 mx-1">|</span>
            <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={clearFilters}>
              <X className="h-3 w-3 mr-1" />
              Clear Filters
            </Button>
          </>
        )}
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        <button
          onClick={() => setStatusFilter("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            statusFilter === "all"
              ? "bg-primary text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All ({stats.total})
        </button>
        <button
          onClick={() => setStatusFilter("pending")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            statusFilter === "pending"
              ? "bg-primary text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Pending ({stats.pending})
        </button>
        <button
          onClick={() => setStatusFilter("approved")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            statusFilter === "approved"
              ? "bg-primary text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Approved ({stats.approved})
        </button>
      </div>

      {allVideos.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-12 text-center">
            <Play className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">No promotional videos uploaded yet</p>
            <p className="text-sm text-gray-500 mt-2">
              Upload videos to your offers to showcase your products
            </p>
          </CardContent>
        </Card>
      ) : filteredVideos.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-10 text-center space-y-2">
            <Video className="h-10 w-10 text-gray-300 mx-auto" />
            <p className="font-medium text-gray-900">No videos match your filters</p>
            <p className="text-sm text-gray-500">
              Try adjusting your search keywords or filter selections.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {filteredVideos.map((video: any) => (
            <Card
              key={video.id}
              className="border-0 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              data-testid={`video-card-${video.id}`}
            >
              <div
                className="relative bg-gray-100 cursor-pointer aspect-[4/3] overflow-hidden"
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
                    <Play className="h-8 w-8 text-gray-300" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <Play className="h-10 w-10 text-white" />
                </div>
                {/* Status Badge */}
                <div className="absolute top-2 left-2">
                  {getStatusBadge(video)}
                </div>
              </div>
              <CardContent className="p-3">
                <h4 className="font-semibold text-sm text-gray-900 line-clamp-1" data-testid={`text-video-title-${video.id}`}>
                  {video.title}
                </h4>
                {video.description && (
                  <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                    {video.description}
                  </p>
                )}

                {video.creatorCredit && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[10px] bg-gray-100">
                        {video.creatorCredit.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-gray-600 truncate">{video.creatorCredit}</span>
                  </div>
                )}

                <div className="flex gap-1.5 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`/company/offers/${video.offerId}`, '_blank');
                    }}
                    data-testid={`button-view-offer-${video.id}`}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View Offer
                  </Button>

                  {(video.status === 'pending' || !video.status) && (
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-teal-500 hover:bg-teal-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        approveMutation.mutate(video.id);
                      }}
                    >
                      Approve
                    </Button>
                  )}

                  {(video.status === 'pending' || !video.status) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        rejectMutation.mutate(video.id);
                      }}
                    >
                      Reject
                    </Button>
                  )}
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

      <GenericErrorDialog
        open={!!errorDialog}
        onOpenChange={(open) => !open && setErrorDialog(null)}
        title={errorDialog?.title}
        description={errorDialog?.message}
      />
    </div>
  );
}
