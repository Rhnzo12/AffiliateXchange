import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Star,
  Eye,
  EyeOff,
  Trash2,
  FileText,
  CheckCircle2,
  AlertCircle,
  Search,
  X,
  MessageSquare,
  MoreHorizontal,
  ArrowUpDown,
  ChevronLeft,
  Clock,
  Pencil,
} from "lucide-react";
import { apiRequest, queryClient } from "../lib/queryClient";
import { TopNavBar } from "../components/TopNavBar";
import { ListSkeleton } from "../components/skeletons";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import { Link } from "wouter";

type SortField = "date" | "rating" | "status";
type SortDirection = "asc" | "desc";

export default function AdminReviews() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isRespondDialogOpen, setIsRespondDialogOpen] = useState(false);
  const [adminNote, setAdminNote] = useState("");
  const [adminResponse, setAdminResponse] = useState("");
  const [editedReview, setEditedReview] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
  }>({ open: false, title: "", description: "" });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setErrorDialog({
        open: true,
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading]);

  const { data: reviews = [], isLoading: loadingReviews } = useQuery<any[]>({
    queryKey: ["/api/admin/reviews"],
    queryFn: async () => {
      const response = await fetch("/api/admin/reviews", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch reviews");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  // Stats
  const stats = useMemo(() => {
    return {
      total: reviews.length,
      approved: reviews.filter((r: any) => r.isApproved && !r.isHidden).length,
      pending: reviews.filter((r: any) => !r.isApproved).length,
      hidden: reviews.filter((r: any) => r.isHidden).length,
    };
  }, [reviews]);

  // Filter and sort reviews
  const filteredReviews = useMemo(() => {
    let result = reviews.filter((review: any) => {
      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "approved" && (!review.isApproved || review.isHidden)) return false;
        if (statusFilter === "pending" && review.isApproved) return false;
        if (statusFilter === "hidden" && !review.isHidden) return false;
      }

      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch =
          review.reviewText?.toLowerCase().includes(search) ||
          review.companyName?.toLowerCase().includes(search) ||
          review.creatorId?.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      return true;
    });

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "date":
          comparison = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
          break;
        case "rating":
          comparison = (a.overallRating || 0) - (b.overallRating || 0);
          break;
        case "status":
          const statusA = a.isHidden ? "hidden" : a.isApproved ? "approved" : "pending";
          const statusB = b.isHidden ? "hidden" : b.isApproved ? "approved" : "pending";
          comparison = statusA.localeCompare(statusB);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [reviews, searchTerm, statusFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

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
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to hide review",
      });
    },
  });

  const unhideReviewMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const response = await apiRequest("POST", `/api/admin/reviews/${reviewId}/unhide`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      toast({
        title: "Success",
        description: "Review is now visible",
      });
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to unhide review",
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
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to delete review",
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
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to save note",
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
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to update review",
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
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to approve review",
      });
    },
  });

  const respondToReviewMutation = useMutation({
    mutationFn: async ({ reviewId, response }: { reviewId: string; response: string }) => {
      const res = await apiRequest("PUT", `/api/admin/reviews/${reviewId}/respond`, { response });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      toast({
        title: "Success",
        description: "Platform response added successfully",
      });
      setIsRespondDialogOpen(false);
      setAdminResponse("");
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to add platform response",
      });
    },
  });

  const handleAddNote = (review: any) => {
    setSelectedReview(review);
    setAdminNote(review.adminNote || "");
    setIsNoteDialogOpen(true);
  };

  const handleRespond = (review: any) => {
    setSelectedReview(review);
    setAdminResponse(review.adminResponse || "");
    setIsRespondDialogOpen(true);
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

  const renderStars = (rating: number, size: "sm" | "md" = "sm") => {
    const sizeClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${sizeClass} ${
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-200'
            }`}
          />
        ))}
      </div>
    );
  };

  const getStatusBadge = (review: any) => {
    if (review.isHidden) {
      return (
        <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-100">
          Hidden
        </Badge>
      );
    }
    if (!review.isApproved) {
      return (
        <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-100">
          Pending
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-100">
        Approved
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const truncateText = (text: string, maxLength: number = 80) => {
    if (!text) return "-";
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  const statusTabs = [
    { key: "all", label: "All", count: stats.total },
    { key: "approved", label: "Approved", count: stats.approved },
    { key: "pending", label: "Pending", count: stats.pending },
    { key: "hidden", label: "Hidden", count: stats.hidden },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavBar />

      {/* Mobile Header */}
      <div className="md:hidden px-4 py-4 bg-white border-b">
        <div className="flex items-center gap-3">
          <Link href="/admin/dashboard">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Reviews</h1>
            <p className="text-sm text-gray-500">{stats.total} total</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6 space-y-4 md:space-y-6">
        {/* Desktop Header */}
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold text-gray-900">Review Management</h1>
          <p className="text-gray-500 mt-1">View and manage reviews across the platform</p>
        </div>

        {/* Mobile Compact Stats */}
        <div className="md:hidden">
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
            <div className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-lg shadow-sm border border-gray-100 min-w-fit">
              <FileText className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-900">{stats.total}</span>
              <span className="text-xs text-gray-500">Total</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-lg shadow-sm border border-gray-100 min-w-fit">
              <CheckCircle2 className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-900">{stats.approved}</span>
              <span className="text-xs text-gray-500">Approved</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-lg shadow-sm border border-gray-100 min-w-fit">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-900">{stats.pending}</span>
              <span className="text-xs text-gray-500">Pending</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-lg shadow-sm border border-gray-100 min-w-fit">
              <EyeOff className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-900">{stats.hidden}</span>
              <span className="text-xs text-gray-500">Hidden</span>
            </div>
          </div>
        </div>

        {/* Desktop Stats Cards */}
        <div className="hidden md:grid md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Reviews</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-gray-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Approved</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.approved}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-gray-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Pending</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-gray-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Hidden</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.hidden}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <EyeOff className="h-5 w-5 text-gray-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 md:p-4">
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
              {/* Status Tabs */}
              <div className="flex gap-1 overflow-x-auto pb-1 md:pb-0 -mx-1 px-1">
                {statusTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setStatusFilter(tab.key)}
                    className={`px-2.5 py-1 md:px-3 md:py-1.5 rounded-full text-xs md:text-sm font-medium whitespace-nowrap transition-colors ${
                      statusFilter === tab.key
                        ? "bg-primary text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {tab.label}
                    <span className="ml-1 text-[10px] md:text-xs opacity-70">({tab.count})</span>
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="flex-1 md:max-w-sm">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search reviews..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 bg-gray-50 border-gray-200 h-9 md:h-10 text-sm"
                    data-testid="input-search-reviews"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Desktop Table */}
        <Card className="border-0 shadow-sm hidden md:block">
          <CardContent className="p-0">
            {loadingReviews ? (
              <div className="p-6">
                <ListSkeleton count={5} />
              </div>
            ) : filteredReviews.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <FileText className="h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-1">No reviews found</h3>
                <p className="text-sm text-gray-500">
                  {searchTerm ? "Try adjusting your search terms" : "No reviews match the current filter"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead className="w-[350px]">Review</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("rating")}
                        className="flex items-center gap-1 font-medium text-gray-700 hover:text-gray-900"
                      >
                        Rating
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("status")}
                        className="flex items-center gap-1 font-medium text-gray-700 hover:text-gray-900"
                      >
                        Status
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("date")}
                        className="flex items-center gap-1 font-medium text-gray-700 hover:text-gray-900"
                      >
                        Date
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReviews.map((review: any) => (
                    <TableRow
                      key={review.id}
                      className={`hover:bg-gray-50 ${review.isHidden ? 'opacity-60' : ''}`}
                      data-testid={`row-review-${review.id}`}
                    >
                      <TableCell>
                        <div className="max-w-[350px]">
                          <p className="text-sm text-gray-900 line-clamp-2">
                            {truncateText(review.reviewText, 100)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">By: {review.creatorId}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-700">{review.companyName || review.companyId}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {renderStars(review.overallRating)}
                          <span className="text-sm text-gray-600">{review.overallRating}</span>
                        </div>
                      </TableCell>
                      <TableCell data-testid={`badge-status-${review.id}`}>
                        {getStatusBadge(review)}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">{formatDate(review.createdAt)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {!review.isApproved && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => approveReviewMutation.mutate(review.id)}
                                  className="cursor-pointer"
                                  data-testid={`button-approve-${review.id}`}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleEdit(review)}
                              className="cursor-pointer"
                              data-testid={`button-edit-${review.id}`}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit Review
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleAddNote(review)}
                              className="cursor-pointer"
                              data-testid={`button-note-${review.id}`}
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              Add Note
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleRespond(review)}
                              className="cursor-pointer"
                              data-testid={`button-respond-${review.id}`}
                            >
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Platform Response
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {review.isHidden ? (
                              <DropdownMenuItem
                                onClick={() => unhideReviewMutation.mutate(review.id)}
                                className="cursor-pointer"
                                data-testid={`button-unhide-${review.id}`}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Show Review
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => hideReviewMutation.mutate(review.id)}
                                className="cursor-pointer"
                                data-testid={`button-hide-${review.id}`}
                              >
                                <EyeOff className="h-4 w-4 mr-2" />
                                Hide Review
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => {
                                if (confirm('Are you sure you want to permanently delete this review?')) {
                                  deleteReviewMutation.mutate(review.id);
                                }
                              }}
                              className="cursor-pointer text-red-600"
                              data-testid={`button-delete-${review.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Review
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {loadingReviews ? (
            <ListSkeleton count={5} />
          ) : filteredReviews.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-1">No reviews found</h3>
                <p className="text-sm text-gray-500 text-center">
                  {searchTerm ? "Try adjusting your search terms" : "No reviews match the current filter"}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredReviews.map((review: any) => (
              <Card
                key={review.id}
                className={`border-0 shadow-sm ${review.isHidden ? 'opacity-60' : ''}`}
                data-testid={`card-review-${review.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {renderStars(review.overallRating, "md")}
                        <span className="text-sm font-medium text-gray-900">{review.overallRating}/5</span>
                      </div>
                      <p className="text-sm text-gray-500">{review.companyName || review.companyId}</p>
                    </div>
                    <div data-testid={`badge-status-${review.id}`}>{getStatusBadge(review)}</div>
                  </div>

                  <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                    {review.reviewText || "No review text"}
                  </p>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>By: {review.creatorId}</span>
                      <span>{formatDate(review.createdAt)}</span>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          Actions
                          <MoreHorizontal className="h-4 w-4 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {!review.isApproved && (
                          <>
                            <DropdownMenuItem
                              onClick={() => approveReviewMutation.mutate(review.id)}
                              className="cursor-pointer"
                              data-testid={`button-approve-${review.id}`}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Approve
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleEdit(review)}
                          className="cursor-pointer"
                          data-testid={`button-edit-${review.id}`}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleAddNote(review)}
                          className="cursor-pointer"
                          data-testid={`button-note-${review.id}`}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Note
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleRespond(review)}
                          className="cursor-pointer"
                          data-testid={`button-respond-${review.id}`}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Respond
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {review.isHidden ? (
                          <DropdownMenuItem
                            onClick={() => unhideReviewMutation.mutate(review.id)}
                            className="cursor-pointer"
                            data-testid={`button-unhide-${review.id}`}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Show
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => hideReviewMutation.mutate(review.id)}
                            className="cursor-pointer"
                            data-testid={`button-hide-${review.id}`}
                          >
                            <EyeOff className="h-4 w-4 mr-2" />
                            Hide
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => {
                            if (confirm('Are you sure you want to permanently delete this review?')) {
                              deleteReviewMutation.mutate(review.id);
                            }
                          }}
                          className="cursor-pointer text-red-600"
                          data-testid={`button-delete-${review.id}`}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Results count */}
        {!loadingReviews && filteredReviews.length > 0 && (
          <p className="text-sm text-gray-500 text-center">
            Showing {filteredReviews.length} of {reviews.length} reviews
          </p>
        )}
      </div>

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
                  <Label htmlFor="overall-rating">Overall Rating: {editedReview.overallRating}</Label>
                  <input
                    type="range"
                    id="overall-rating"
                    min="1"
                    max="5"
                    value={editedReview.overallRating}
                    onChange={(e) => setEditedReview({ ...editedReview, overallRating: parseInt(e.target.value) })}
                    className="w-full"
                    data-testid="input-overall-rating"
                    aria-label="Overall rating"
                  />
                </div>
                <div>
                  <Label htmlFor="payment-speed-rating">Payment Speed: {editedReview.paymentSpeedRating}</Label>
                  <input
                    type="range"
                    id="payment-speed-rating"
                    min="1"
                    max="5"
                    value={editedReview.paymentSpeedRating}
                    onChange={(e) => setEditedReview({ ...editedReview, paymentSpeedRating: parseInt(e.target.value) })}
                    className="w-full"
                    data-testid="input-payment-speed-rating"
                    aria-label="Payment speed rating"
                  />
                </div>
                <div>
                  <Label htmlFor="communication-rating">Communication: {editedReview.communicationRating}</Label>
                  <input
                    type="range"
                    id="communication-rating"
                    min="1"
                    max="5"
                    value={editedReview.communicationRating}
                    onChange={(e) => setEditedReview({ ...editedReview, communicationRating: parseInt(e.target.value) })}
                    className="w-full"
                    data-testid="input-communication-rating"
                    aria-label="Communication rating"
                  />
                </div>
                <div>
                  <Label htmlFor="offer-quality-rating">Offer Quality: {editedReview.offerQualityRating}</Label>
                  <input
                    type="range"
                    id="offer-quality-rating"
                    min="1"
                    max="5"
                    value={editedReview.offerQualityRating}
                    onChange={(e) => setEditedReview({ ...editedReview, offerQualityRating: parseInt(e.target.value) })}
                    className="w-full"
                    data-testid="input-offer-quality-rating"
                    aria-label="Offer quality rating"
                  />
                </div>
                <div>
                  <Label htmlFor="support-rating">Support: {editedReview.supportRating}</Label>
                  <input
                    type="range"
                    id="support-rating"
                    min="1"
                    max="5"
                    value={editedReview.supportRating}
                    onChange={(e) => setEditedReview({ ...editedReview, supportRating: parseInt(e.target.value) })}
                    className="w-full"
                    aria-label="Support rating"
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

      {/* Platform Response Dialog */}
      <Dialog open={isRespondDialogOpen} onOpenChange={setIsRespondDialogOpen}>
        <DialogContent data-testid="dialog-platform-response">
          <DialogHeader>
            <DialogTitle>Platform Response</DialogTitle>
            <DialogDescription>
              Add an official platform response to this review (visible to all users)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="adminResponse">Response</Label>
              <Textarea
                id="adminResponse"
                value={adminResponse}
                onChange={(e) => setAdminResponse(e.target.value)}
                placeholder="Enter your official platform response..."
                rows={4}
                data-testid="textarea-admin-response"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRespondDialogOpen(false)}
              data-testid="button-cancel-response"
            >
              Cancel
            </Button>
            <Button
              onClick={() => selectedReview && respondToReviewMutation.mutate({
                reviewId: selectedReview.id,
                response: adminResponse
              })}
              disabled={respondToReviewMutation.isPending || !adminResponse.trim()}
              data-testid="button-save-response"
            >
              Save Response
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
