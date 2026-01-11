import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "../lib/queryClient";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
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
import {
  ShieldAlert,
  MessageSquare,
  Star,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Filter,
  X,
  Eye,
  Clock,
} from "lucide-react";
import { TopNavBar } from "../components/TopNavBar";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import { Input } from "../components/ui/input";

type ContentFlag = {
  id: string;
  contentType: "message" | "review";
  contentId: string;
  userId: string;
  flagReason: string;
  matchedKeywords: string[];
  status: "pending" | "reviewed" | "dismissed" | "action_taken";
  reviewedBy: string | null;
  reviewedAt: string | null;
  adminNotes: string | null;
  actionTaken: string | null;
  createdAt: string;
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
};

type ModerationStats = {
  pending: number;
  reviewed: number;
  dismissed: number;
  actionTaken: number;
  total: number;
};

export default function AdminModerationDashboard() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { toast } = useToast();
  const [selectedFlag, setSelectedFlag] = useState<ContentFlag | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<"reviewed" | "dismissed" | "action_taken">("reviewed");
  const [adminNotes, setAdminNotes] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [contentTypeFilter, setContentTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    errorDetails?: string;
  }>({
    open: false,
    title: "",
    description: "",
  });

  const { data: flags = [], isLoading: flagsLoading } = useQuery<ContentFlag[]>({
    queryKey: ["/api/admin/moderation/flags"],
    enabled: isAuthenticated && user?.role === 'admin',
  });

  const { data: stats, isLoading: statsLoading } = useQuery<ModerationStats>({
    queryKey: ["/api/admin/moderation/statistics"],
    enabled: isAuthenticated && user?.role === 'admin',
  });

  const filteredFlags = useMemo(() => {
    return flags.filter((flag) => {
      const matchesSearch = searchTerm
        ? flag.flagReason.toLowerCase().includes(searchTerm.toLowerCase()) ||
          flag.contentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
          flag.matchedKeywords.some((kw) => kw.toLowerCase().includes(searchTerm.toLowerCase()))
        : true;

      const matchesStatus = statusFilter === "all" || flag.status === statusFilter;
      const matchesContentType =
        contentTypeFilter === "all" || flag.contentType === contentTypeFilter;

      return matchesSearch && matchesStatus && matchesContentType;
    });
  }, [flags, searchTerm, statusFilter, contentTypeFilter]);

  const hasActiveFilters =
    searchTerm.trim().length > 0 || statusFilter !== "pending" || contentTypeFilter !== "all";

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("pending");
    setContentTypeFilter("all");
  };

  const reviewFlagMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      adminNotes,
      actionTaken,
    }: {
      id: string;
      status: string;
      adminNotes?: string;
      actionTaken?: string;
    }) => {
      const response = await apiRequest("PATCH", `/api/admin/moderation/flags/${id}/review`, {
        status,
        adminNotes,
        actionTaken,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/flags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/statistics"] });
      toast({
        title: "Flag Reviewed",
        description: "The content flag has been successfully reviewed.",
      });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to review content flag",
        errorDetails: error.message,
      });
    },
  });

  const handleReview = (flag: ContentFlag) => {
    setSelectedFlag(flag);
    setReviewStatus("reviewed");
    setAdminNotes(flag.adminNotes || "");
    setActionTaken(flag.actionTaken || "");
    setShowReviewDialog(true);
  };

  const handleQuickAction = (flag: ContentFlag, status: "reviewed" | "dismissed" | "action_taken") => {
    reviewFlagMutation.mutate({
      id: flag.id,
      status,
      adminNotes: status === "dismissed" ? "Quick dismissed by admin" : undefined,
    });
  };

  const handleSubmitReview = () => {
    if (!selectedFlag) return;

    reviewFlagMutation.mutate({
      id: selectedFlag.id,
      status: reviewStatus,
      adminNotes: adminNotes.trim() || undefined,
      actionTaken:
        reviewStatus === "action_taken" && actionTaken.trim() ? actionTaken.trim() : undefined,
    });
  };

  const handleCloseDialog = () => {
    setShowReviewDialog(false);
    setSelectedFlag(null);
    setReviewStatus("reviewed");
    setAdminNotes("");
    setActionTaken("");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "reviewed":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
            <Eye className="h-3 w-3 mr-1" />
            Reviewed
          </Badge>
        );
      case "dismissed":
        return (
          <Badge variant="outline" className="bg-gray-500/10 text-gray-600 border-gray-500/20">
            <XCircle className="h-3 w-3 mr-1" />
            Dismissed
          </Badge>
        );
      case "action_taken":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Action Taken
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getContentTypeBadge = (type: string) => {
    return type === "message" ? (
      <Badge variant="secondary">
        <MessageSquare className="h-3 w-3 mr-1" />
        Message
      </Badge>
    ) : (
      <Badge variant="secondary">
        <Star className="h-3 w-3 mr-1" />
        Review
      </Badge>
    );
  };

  if (isLoading || flagsLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNavBar />

      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-3xl font-bold">Dashboard</h1>
          <p className="text-xs sm:text-base text-muted-foreground mt-1">
            Review and manage flagged content
          </p>
        </div>

        {/* Stats - Horizontal scroll on mobile */}
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-5 sm:gap-4 scrollbar-hide">
          <div className="flex-shrink-0 w-28 sm:w-auto bg-background border rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground">Total Flags</p>
            <p className="text-2xl sm:text-3xl font-bold mt-1">{stats?.total || 0}</p>
          </div>
          <div className="flex-shrink-0 w-28 sm:w-auto bg-background border border-yellow-500/20 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm font-medium text-yellow-600">Pending</p>
            <p className="text-2xl sm:text-3xl font-bold text-yellow-600 mt-1">{stats?.pending || 0}</p>
          </div>
          <div className="flex-shrink-0 w-28 sm:w-auto bg-background border rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm font-medium text-blue-600">Reviewed</p>
            <p className="text-2xl sm:text-3xl font-bold text-blue-600 mt-1">{stats?.reviewed || 0}</p>
          </div>
          <div className="flex-shrink-0 w-28 sm:w-auto bg-background border rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm font-medium text-green-600">Action Taken</p>
            <p className="text-2xl sm:text-3xl font-bold text-green-600 mt-1">{stats?.actionTaken || 0}</p>
          </div>
          <div className="flex-shrink-0 w-28 sm:w-auto bg-background border rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground">Dismissed</p>
            <p className="text-2xl sm:text-3xl font-bold text-muted-foreground mt-1">{stats?.dismissed || 0}</p>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="border rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider">
                Search & Filter
              </span>
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{filteredFlags.length}</span> of{" "}
              {flags.length} flags
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={clearFilters}>
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* Search input full width on mobile */}
          <Input
            placeholder="Search reasons, keywords, or IDs"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9 text-sm"
          />

          {/* Filters row */}
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
                <SelectItem value="action_taken">Action Taken</SelectItem>
              </SelectContent>
            </Select>
            <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="message">Messages</SelectItem>
                <SelectItem value="review">Reviews</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Flagged Content List */}
        {filteredFlags.length === 0 ? (
          <div className="border rounded-lg p-6 sm:p-12 text-center">
            <ShieldAlert className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-medium mb-2">
              {flags.length === 0 ? "No flagged content" : "No flags match your filters"}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {flags.length === 0
                ? "Flagged content will appear here when detected"
                : "Try adjusting your filters"}
            </p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {/* Group by status for mobile */}
            {statusFilter === "pending" && (
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground pb-1 border-b">
                <AlertCircle className="h-4 w-4" />
                Pending ({filteredFlags.length})
              </div>
            )}

            {filteredFlags.map((flag) => (
              <div key={flag.id} className="border rounded-lg overflow-hidden">
                {/* Card Header */}
                <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
                  {/* Top row: badges and timestamp */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      {getContentTypeBadge(flag.contentType)}
                      {getStatusBadge(flag.status)}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(flag.createdAt).toLocaleDateString('en-US', {
                        month: 'numeric',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>

                  {/* User info and actions */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm sm:text-base">
                        User: {flag.user?.username || flag.userId}
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        Contact ID: {flag.contentId}
                      </p>
                    </div>
                    {flag.status === "pending" && (
                      <div className="flex gap-1.5 sm:gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReview(flag)}
                          className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3"
                        >
                          <Eye className="h-3.5 w-3.5 sm:mr-1" />
                          <span className="hidden sm:inline">Review</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleQuickAction(flag, "dismissed")}
                          disabled={reviewFlagMutation.isPending}
                          className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3"
                        >
                          <XCircle className="h-3.5 w-3.5 sm:mr-1" />
                          <span className="hidden sm:inline">Dismiss</span>
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Flag details */}
                  <div className="space-y-2 pt-2 border-t">
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-1">Flag Reason:</h4>
                      <p className="text-xs sm:text-sm">{flag.flagReason}</p>
                    </div>
                    {flag.matchedKeywords && flag.matchedKeywords.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-1">Matched Keywords:</h4>
                        <div className="flex flex-wrap gap-1">
                          {flag.matchedKeywords.map((keyword, idx) => (
                            <Badge
                              key={idx}
                              variant="destructive"
                              className="bg-red-500/10 text-red-600 border-red-500/20 text-xs px-1.5 py-0"
                            >
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {flag.adminNotes && (
                      <div className="bg-primary/5 p-2 sm:p-3 rounded-md border border-primary/20">
                        <h4 className="text-xs font-medium mb-1">Admin Notes:</h4>
                        <p className="text-xs sm:text-sm">{flag.adminNotes}</p>
                      </div>
                    )}
                    {flag.actionTaken && (
                      <div className="bg-green-500/5 p-2 sm:p-3 rounded-md border border-green-500/20">
                        <h4 className="text-xs font-medium mb-1">Action Taken:</h4>
                        <p className="text-xs sm:text-sm">{flag.actionTaken}</p>
                      </div>
                    )}
                    {flag.reviewedBy && flag.reviewedAt && (
                      <p className="text-xs text-muted-foreground">
                        Reviewed by {flag.reviewedBy} on {new Date(flag.reviewedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Review Flagged Content</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Review the flagged content and take appropriate action
            </DialogDescription>
          </DialogHeader>
          {selectedFlag && (
            <div className="space-y-4">
              <div className="bg-muted p-3 sm:p-4 rounded-md space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {getContentTypeBadge(selectedFlag.contentType)}
                  <span className="text-xs sm:text-sm">Content ID: {selectedFlag.contentId}</span>
                </div>
                <div className="text-xs sm:text-sm">
                  <strong>User:</strong> {selectedFlag.user?.username || selectedFlag.userId}
                </div>
                <div className="text-xs sm:text-sm">
                  <strong>Reason:</strong> {selectedFlag.flagReason}
                </div>
                {selectedFlag.matchedKeywords.length > 0 && (
                  <div className="text-xs sm:text-sm">
                    <strong>Keywords:</strong> {selectedFlag.matchedKeywords.join(", ")}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="reviewStatus" className="text-sm">Review Decision *</Label>
                <Select
                  value={reviewStatus}
                  onValueChange={(val) => setReviewStatus(val as any)}
                >
                  <SelectTrigger id="reviewStatus" className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reviewed">Reviewed (No Action Needed)</SelectItem>
                    <SelectItem value="dismissed">Dismissed (False Positive)</SelectItem>
                    <SelectItem value="action_taken">Action Taken</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminNotes" className="text-sm">Admin Notes (Optional)</Label>
                <Textarea
                  id="adminNotes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add internal notes..."
                  rows={3}
                  className="text-sm"
                />
              </div>

              {reviewStatus === "action_taken" && (
                <div className="space-y-2">
                  <Label htmlFor="actionTaken" className="text-sm">Action Taken (Optional)</Label>
                  <Textarea
                    id="actionTaken"
                    value={actionTaken}
                    onChange={(e) => setActionTaken(e.target.value)}
                    placeholder="Describe what action was taken..."
                    rows={3}
                    className="text-sm"
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <Button
              onClick={handleSubmitReview}
              disabled={reviewFlagMutation.isPending}
              className="w-full sm:w-auto order-1 sm:order-2"
            >
              Submit Review
            </Button>
            <Button
              variant="outline"
              onClick={handleCloseDialog}
              className="w-full sm:w-auto order-2 sm:order-1"
            >
              Cancel
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
