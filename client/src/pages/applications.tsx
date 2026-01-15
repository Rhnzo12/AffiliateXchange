import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCreatorPageTour } from "../components/CreatorTour";
import { CREATOR_TOUR_IDS, applicationsTourSteps } from "../lib/creatorTourConfig";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Progress } from "../components/ui/progress";
import { Copy, ExternalLink, MessageSquare, TrendingUp, FileText, Clock, CheckCircle2, Star, StarOff, Filter, Search, X, DollarSign, Calendar, CheckCircle, AlertTriangle, Eye, MessageCircle, Upload, ChevronLeft, SlidersHorizontal, MoreHorizontal } from "lucide-react";
import { Link, useLocation } from "wouter";
import { proxiedSrc } from "../lib/image";
import { TopNavBar } from "../components/TopNavBar";
import { ListSkeleton } from "../components/skeletons";
import { Input } from "../components/ui/input";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

const STATUS_COLORS: Record<string, any> = {
  pending: { variant: "secondary" as const, icon: Clock },
  approved: { variant: "default" as const, icon: CheckCircle2 },
  active: { variant: "default" as const, icon: TrendingUp },
  completed: { variant: "secondary" as const, icon: CheckCircle2 },
};

// Helper function to format commission display
const formatCommission = (offer: any) => {
  if (!offer) return "CA$0";

  if (offer.commissionAmount) {
    return `CA$${offer.commissionAmount}`;
  } else if (offer.commissionPercentage) {
    return `${offer.commissionPercentage}%`;
  } else if (offer.commissionRate) {
    return `CA$${offer.commissionRate}`;
  }
  return "CA$0";
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
          aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
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
  const [, setLocation] = useLocation();

  // Quick Guide Tour
  useCreatorPageTour(CREATOR_TOUR_IDS.APPLICATIONS, applicationsTourSteps);

  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [offerFilter, setOfferFilter] = useState("all");
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
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
  }>({
    open: false,
    title: "",
    description: "",
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = "/login";
    }
  }, [isAuthenticated, isLoading]);

  const { data: applications, isLoading: applicationsLoading } = useQuery<any[]>({
    queryKey: ["/api/applications"],
    enabled: isAuthenticated,
  });

  // Retainer-related queries
  const { data: retainerContracts } = useQuery<any[]>({
    queryKey: ["/api/retainer-contracts"],
    enabled: isAuthenticated,
  });

  const { data: myRetainerApplications } = useQuery<any[]>({
    queryKey: ["/api/creator/retainer-applications"],
    enabled: isAuthenticated,
  });

  // Fetch platform fee settings
  const { data: feeSettings } = useQuery<{
    totalFeePercentage: number;
    totalFeeDisplay: string;
  }>({
    queryKey: ["/api/platform/fees"],
    enabled: isAuthenticated,
  });

  const totalFeePercentage = feeSettings?.totalFeePercentage ?? 0.07;
  const totalFeeDisplay = feeSettings?.totalFeeDisplay ?? "7%";

  const totalApplications = applications?.length ?? 0;

  const uniqueStatuses = useMemo(
    () => Array.from(new Set((applications || []).map((app: any) => app.status).filter(Boolean))),
    [applications]
  );

  const uniqueOffers = useMemo(() => {
    const map = new Map<string, string>();
    (applications || []).forEach((app: any) => {
      if (app.offer?.id && app.offer?.title) {
        map.set(app.offer.id, app.offer.title);
      }
    });
    return Array.from(map.entries());
  }, [applications]);

  // Fetch user's reviews to check which applications have been reviewed
  const { data: userReviews = [] } = useQuery<any[]>({
    queryKey: ["/api/user/reviews"],
    enabled: isAuthenticated,
  });

  // Retainer computed values
  const contractMap = useMemo(() => {
    const map = new Map();
    retainerContracts?.forEach((contract: any) => {
      map.set(contract.id, contract);
    });
    return map;
  }, [retainerContracts]);

  const approvedRetainerApplications = useMemo(
    () => myRetainerApplications?.filter((app: any) => app.status === "approved") || [],
    [myRetainerApplications]
  );

  const completedRetainerApplications = useMemo(
    () => myRetainerApplications?.filter((app: any) => app.status === "completed") || [],
    [myRetainerApplications]
  );

  const activeRetainerContracts = useMemo(
    () =>
      approvedRetainerApplications
        .map((application: any) => ({
          application,
          contract: contractMap.get(application.contractId),
        }))
        .filter((item) => item.contract),
    [approvedRetainerApplications, contractMap]
  );

  const completedRetainerContracts = useMemo(
    () =>
      completedRetainerApplications
        .map((application: any) => ({
          application,
          contract: contractMap.get(application.contractId),
        }))
        .filter((item) => item.contract),
    [completedRetainerApplications, contractMap]
  );

  const totalActiveNet = useMemo(
    () =>
      activeRetainerContracts.reduce(
        (sum, { contract }) => sum + Number(contract?.monthlyAmount || 0) * (1 - totalFeePercentage),
        0
      ),
    [activeRetainerContracts, totalFeePercentage]
  );

  const totalActiveVideos = useMemo(
    () => activeRetainerContracts.reduce((sum, { contract }) => sum + Number(contract?.videosPerMonth || 0), 0),
    [activeRetainerContracts]
  );

  const totalDeliveredVideos = useMemo(
    () => activeRetainerContracts.reduce((sum, { contract }) => sum + Number(contract?.submittedVideos || 0), 0),
    [activeRetainerContracts]
  );

  const remainingCycleVideos = Math.max(0, totalActiveVideos - totalDeliveredVideos);
  const portfolioCompletion = totalActiveVideos
    ? Math.min(100, Math.round((totalDeliveredVideos / totalActiveVideos) * 100))
    : 0;

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
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message,
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
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Please provide an overall rating",
      });
      return;
    }

    submitReviewMutation.mutate(reviewForm);
  };

  const filteredApplications = useMemo(() => {
    return (applications || []).filter((app: any) => {
      const matchesTab = activeTab === "all" || app.status === activeTab;
      const matchesStatus = statusFilter === "all" || app.status === statusFilter;
      const matchesOffer = offerFilter === "all" || app.offer?.id === offerFilter;
      const matchesSearch = searchTerm
        ? [
            app.offer?.title,
            app.offer?.company?.tradeName,
            app.offer?.primaryNiche,
            app.offer?.secondaryNiche,
          ]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(searchTerm.toLowerCase()))
        : true;

      return matchesTab && matchesStatus && matchesOffer && matchesSearch;
    });
  }, [activeTab, applications, offerFilter, searchTerm, statusFilter]);

  const hasActiveFilters =
    searchTerm.trim().length > 0 || statusFilter !== "all" || offerFilter !== "all";

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setOfferFilter("all");
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-lg">Loading...</div>
    </div>;
  }

  return (
    <div className="space-y-6">
      <TopNavBar />

      {/* ========== MOBILE LAYOUT ========== */}
      <div className="md:hidden space-y-4 pb-4">
        {/* Mobile Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/browse">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold">My Applications</h1>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <SlidersHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="p-2 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {uniqueStatuses.map((status) => (
                        <SelectItem key={status} value={status} className="capitalize">
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Offer</label>
                  <Select value={offerFilter} onValueChange={setOfferFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All offers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Offers</SelectItem>
                      {uniqueOffers.map(([id, title]) => (
                        <SelectItem key={id} value={id}>
                          {title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={clearFilters} className="w-full text-xs">
                    <X className="h-3 w-3 mr-1" />
                    Clear Filters
                  </Button>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search offers or niche"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="pl-10 h-11 bg-muted/50 border-0"
          />
        </div>

        {/* Mobile Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          <Button
            variant={activeTab === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("all")}
            className={`rounded-full px-4 h-9 text-sm whitespace-nowrap flex-shrink-0 ${
              activeTab === "all" ? "bg-primary text-primary-foreground" : "bg-muted/50 border-0"
            }`}
          >
            All ({applications?.length || 0})
          </Button>
          <Button
            variant={activeTab === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("pending")}
            className={`rounded-full px-4 h-9 text-sm whitespace-nowrap flex-shrink-0 ${
              activeTab === "pending" ? "bg-primary text-primary-foreground" : "bg-muted/50 border-0"
            }`}
          >
            Pending
          </Button>
          <Button
            variant={activeTab === "approved" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("approved")}
            className={`rounded-full px-4 h-9 text-sm whitespace-nowrap flex-shrink-0 ${
              activeTab === "approved" ? "bg-primary text-primary-foreground" : "bg-muted/50 border-0"
            }`}
          >
            Approved
          </Button>
          <Button
            variant={activeTab === "active" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("active")}
            className={`rounded-full px-4 h-9 text-sm whitespace-nowrap flex-shrink-0 ${
              activeTab === "active" ? "bg-primary text-primary-foreground" : "bg-muted/50 border-0"
            }`}
          >
            Active
          </Button>
        </div>

        {/* Mobile Application Cards */}
        {applicationsLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-card-border animate-pulse">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <div className="w-24 h-24 bg-muted rounded-lg flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                      <div className="h-6 bg-muted rounded w-20" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : totalApplications === 0 ? (
          <Card className="border-card-border">
            <CardContent className="p-8 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
              <h3 className="font-semibold text-base mb-1">No applications yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Start browsing offers and apply to begin earning</p>
              <Link href="/browse">
                <Button variant="default" size="sm">
                  Browse Offers
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : filteredApplications.length === 0 ? (
          <Card className="border-card-border">
            <CardContent className="p-8 text-center">
              <Search className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="font-semibold text-base mb-1">No applications match</h3>
              <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredApplications.map((application: any) => {
              const StatusIcon = STATUS_COLORS[application.status]?.icon || Clock;
              const canShowReviewButton = application.status === 'approved' || application.status === 'active';
              const existingReview = getExistingReview(application.id);

              return (
                <Card key={application.id} className="border-card-border overflow-hidden">
                  <CardContent className="p-4 space-y-4">
                    {/* Product Info Row */}
                    <div className="flex gap-4">
                      {/* Product Image */}
                      <div className="w-24 h-24 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                        {application.offer?.featuredImageUrl ? (
                          <img
                            src={proxiedSrc(application.offer.featuredImageUrl)}
                            alt={application.offer.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FileText className="h-8 w-8 text-muted-foreground/50" />
                          </div>
                        )}
                      </div>

                      {/* Product Details */}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <Link href={`/offers/${application.offer?.id}`}>
                          <h3 className="font-semibold text-sm leading-tight line-clamp-2 hover:text-primary">
                            {application.offer?.title || "Untitled Offer"}
                          </h3>
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {application.offer?.company?.tradeName || "Company"}
                        </p>
                        <Badge
                          {...STATUS_COLORS[application.status]}
                          className="gap-1 text-xs capitalize"
                        >
                          <StatusIcon className="h-3 w-3" />
                          {application.status}
                        </Badge>
                      </div>
                    </div>

                    {/* Commission & Type Row */}
                    <div className="flex justify-between text-sm border-t border-b py-3">
                      <div>
                        <span className="text-muted-foreground">Commission:</span>
                        <span className="ml-2 font-medium font-mono">{formatCommission(application.offer)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Type:</span>
                        <span className="ml-2 font-medium capitalize">
                          {application.offer?.commissionType?.replace(/_/g, ' ') || 'Per Sale'}
                        </span>
                      </div>
                    </div>

                    {/* Tracking Link Section - Only for approved applications */}
                    {application.status === 'approved' && application.trackingLink && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Your Tracking Link</p>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <code className="text-xs text-muted-foreground break-all">
                            {application.trackingLink}
                          </code>
                        </div>
                        <Button
                          onClick={() => copyTrackingLink(application.trackingLink)}
                          className="w-full h-11 gap-2"
                        >
                          <Copy className="h-4 w-4" />
                          Copy Link
                        </Button>
                      </div>
                    )}

                    {/* Action Buttons Row */}
                    <div className="flex items-center justify-between pt-2">
                      <Link href={`/analytics/${application.id}`}>
                        <Button variant="ghost" size="sm" className="gap-2 text-sm h-9 px-0">
                          <TrendingUp className="h-4 w-4" />
                          View Analytics
                        </Button>
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <Link href={`/applications/${application.id}`}>
                            <DropdownMenuItem className="gap-2">
                              <FileText className="h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                          </Link>
                          <Link href={`/messages?application=${application.id}`}>
                            <DropdownMenuItem className="gap-2">
                              <MessageSquare className="h-4 w-4" />
                              Message Company
                            </DropdownMenuItem>
                          </Link>
                          <Link href={`/offers/${application.offer?.id}`}>
                            <DropdownMenuItem className="gap-2">
                              <ExternalLink className="h-4 w-4" />
                              View Offer
                            </DropdownMenuItem>
                          </Link>
                          {canShowReviewButton && (
                            <DropdownMenuItem onClick={() => handleOpenReviewDialog(application)} className="gap-2">
                              <Star className="h-4 w-4" />
                              {existingReview ? "Edit Review" : "Leave Review"}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ========== DESKTOP LAYOUT ========== */}
      <div className="hidden md:block space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">My Applications</h1>
          <p className="text-muted-foreground mt-1">Track all your affiliate applications in one place</p>
        </div>

        <Card className="border-card-border">
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span className="text-sm font-semibold uppercase tracking-wider">Search & Filter</span>
              </div>
              <div className="sm:ml-auto text-sm text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{filteredApplications.length}</span> of {totalApplications}
                {` application${totalApplications === 1 ? "" : "s"}`}
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs sm:ml-4">
                  <X className="h-3 w-3 mr-1" />
                  Clear Filters
                </Button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Search</label>
                <Input
                  placeholder="Search by offer or niche"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {uniqueStatuses.map((status) => (
                      <SelectItem key={status} value={status} className="capitalize">
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Offer</label>
                <Select value={offerFilter} onValueChange={setOfferFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All offers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Offers</SelectItem>
                    {uniqueOffers.map(([id, title]) => (
                      <SelectItem key={id} value={id}>
                        {title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Monthly Retainers Dashboard - Desktop Only */}
      {(activeRetainerContracts.length > 0 || completedRetainerContracts.length > 0) && (
        <Card className="hidden md:block border-card-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Active Monthly Retainers</CardTitle>
            <p className="text-sm text-muted-foreground">Your active and completed retainer contracts at a glance</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Active retainers</span>
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    {portfolioCompletion}% on track
                  </Badge>
                </div>
                <p className="text-2xl font-semibold">{activeRetainerContracts.length}</p>
                <p className="text-xs text-muted-foreground">{remainingCycleVideos} video{remainingCycleVideos === 1 ? "" : "s"} to deliver this cycle</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Monthly net</span>
                  <DollarSign className="h-3.5 w-3.5 text-primary" />
                </div>
                <p className="text-2xl font-semibold">CA${totalActiveNet.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-muted-foreground">After platform fees across all active retainers</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Throughput</span>
                  <Clock className="h-3.5 w-3.5 text-primary" />
                </div>
                <p className="text-2xl font-semibold">{totalDeliveredVideos}/{totalActiveVideos || 0}</p>
                <p className="text-xs text-muted-foreground">Videos submitted versus this month's quota</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <p className="text-sm font-semibold">Active contracts</p>
              </div>
              {activeRetainerContracts.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Once you're approved, your retainers will appear here with progress trackers and quick actions.
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {activeRetainerContracts.map(({ contract }) => {
                    const delivered = Number(contract?.submittedVideos || 0);
                    const totalVideos = Number(contract?.videosPerMonth || 1);
                    const progressValue = Math.min(100, Math.round((delivered / totalVideos) * 100));
                    const netAmount = Number(contract?.monthlyAmount || 0) * (1 - totalFeePercentage);
                    const remainingVideos = Math.max(0, totalVideos - delivered);

                    return (
                      <Card key={`active-${contract.id}`} className="border-card-border">
                        <CardContent className="p-4 space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold">{contract.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {contract.videosPerMonth} videos/mo • {contract.durationMonths} month term
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Calendar className="h-3.5 w-3.5" />
                                <span>Next payout in {Math.max(1, (contract.durationMonths || 1) * 4)} weeks</span>
                              </div>
                            </div>
                            <Badge variant="outline" className="bg-primary/10 text-primary">
                              Net CA${netAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo
                            </Badge>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Progress</span>
                              <span>
                                {delivered}/{totalVideos} videos
                              </span>
                            </div>
                            <Progress value={progressValue} />
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span className="flex items-center gap-1 text-emerald-600">
                                <CheckCircle className="h-3.5 w-3.5" /> Delivered {delivered}
                              </span>
                              <span className="flex items-center gap-1 text-amber-600">
                                <AlertTriangle className="h-3.5 w-3.5" /> {remainingVideos} remaining
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" size="sm" onClick={() => setLocation(`/retainers/${contract.id}`)}>
                              <Upload className="h-3.5 w-3.5 mr-1" />
                              Upload video
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setLocation(`/messages`)}>
                              <MessageCircle className="h-3.5 w-3.5 mr-1" />
                              Message company
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setLocation(`/retainers/${contract.id}`)}>
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              View brief
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-muted" />
                <p className="text-sm font-semibold">Completed contracts</p>
              </div>
              {completedRetainerContracts.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Track historical performance and earnings once you finish a retainer.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {completedRetainerContracts.map(({ contract }) => (
                    <Card key={`completed-${contract.id}`} className="border-card-border">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">{contract.title}</p>
                          <Badge variant="secondary" className="bg-muted text-foreground">Completed</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Earned CA${Number(contract.monthlyAmount || 0).toLocaleString()} per month over {contract.durationMonths}{" "}
                          month{contract.durationMonths === 1 ? "" : "s"}
                        </p>
                        <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Consistently delivered {contract.videosPerMonth} videos per month</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Star className="h-3.5 w-3.5 text-amber-500" />
                            <span>Use this as a proof point in future pitches</span>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="px-0 justify-start">
                          Leave a review
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs - Desktop Only */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="hidden md:block">
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
          {applicationsLoading ? (
            <ListSkeleton count={3} />
          ) : totalApplications === 0 ? (
            <Card className="border-card-border">
              <CardContent className="p-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">No applications yet</h3>
                <p className="text-muted-foreground mb-4">Start browsing offers and apply to begin earning</p>
                <Link href="/browse">
                  <Button
                    data-testid="button-browse-offers"
                    variant="ghost"
                    className="bg-muted text-black border-none shadow-none hover:bg-muted"
                  >
                    Browse Offers
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : filteredApplications.length === 0 ? (
            <Card className="border-card-border">
              <CardContent className="p-10 text-center space-y-2">
                <Search className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                <h3 className="font-semibold text-lg">No applications match your filters</h3>
                <p className="text-sm text-muted-foreground">Try adjusting your search or filter selections.</p>
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
                            src={proxiedSrc(application.offer.featuredImageUrl)}
                            alt={application.offer.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
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
                          <Link href={`/applications/${application.id}`}>
                            <Button size="sm" variant="default" data-testid={`button-view-details-${application.id}`} className="gap-2">
                              <FileText className="h-4 w-4" />
                              View Details
                            </Button>
                          </Link>
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
        <DialogContent className="w-[calc(100%-64px)] max-w-sm md:max-w-2xl mx-auto max-h-[90vh] overflow-y-auto rounded-2xl p-6">
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

            <div className="grid grid-cols-2 gap-3 border-t pt-4">
              <Button
                variant="outline"
                onClick={() => setReviewDialog({ open: false, application: null })}
                className="h-12 rounded-xl border-2 border-gray-200 font-medium"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitReview}
                disabled={submitReviewMutation.isPending || reviewForm.overallRating === 0}
                className="h-12 rounded-xl bg-primary hover:bg-primary/90 font-medium"
              >
                {submitReviewMutation.isPending ? "Submitting..." : "Submit Review"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Error Dialog */}
      <GenericErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
        title={errorDialog.title}
        description={errorDialog.description}
        variant="error"
      />
    </div>
  );
}
