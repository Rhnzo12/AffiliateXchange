import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
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
import { Label } from "../components/ui/label";
import {
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  MessageCircle,
  DollarSign,
  Search,
  X,
  ArrowUpDown,
  MoreHorizontal,
  Eye,
  Users,
  TrendingUp,
  Calendar,
} from "lucide-react";
import { apiRequest, queryClient } from "../lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { TopNavBar } from "../components/TopNavBar";
import { ListSkeleton } from "../components/skeletons";
import { ReviewPromptDialog } from "../components/ReviewPromptDialog";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import { proxiedSrc } from "../lib/image";

type CompanyApplicationsProps = {
  hideTopNav?: boolean;
};

type SortField = "creator" | "offer" | "status" | "applied" | "conversions";
type SortDirection = "asc" | "desc";

export default function CompanyApplications({ hideTopNav = false }: CompanyApplicationsProps) {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [conversionDialogOpen, setConversionDialogOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [saleAmount, setSaleAmount] = useState("");
  const [reviewPromptOpen, setReviewPromptOpen] = useState(false);
  const [reviewPromptData, setReviewPromptData] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("applied");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setErrorDialog({
        title: "Unauthorized",
        message: "You are logged out. Logging in again...",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading]);

  const { data: applications = [], isLoading: loadingApplications } = useQuery<any[]>({
    queryKey: ["/api/company/applications"],
    enabled: isAuthenticated,
  });

  // Fetch company's fee info
  interface CompanyFeeInfo {
    platformFeePercentage: number;
    platformFeeDisplay: string;
    processingFeePercentage: number;
    processingFeeDisplay: string;
    totalFeePercentage: number;
    totalFeeDisplay: string;
    creatorPayoutPercentage: number;
    creatorPayoutDisplay: string;
    isCustomFee: boolean;
  }

  const { data: feeInfo } = useQuery<CompanyFeeInfo>({
    queryKey: ["/api/company/fee"],
    enabled: isAuthenticated,
  });

  // Stats
  const stats = useMemo(() => {
    return {
      total: applications.length,
      pending: applications.filter((a: any) => a.status === "pending").length,
      approved: applications.filter((a: any) => a.status === "approved").length,
      rejected: applications.filter((a: any) => a.status === "rejected").length,
      active: applications.filter((a: any) => a.status === "active").length,
    };
  }, [applications]);

  const filteredApplications = useMemo(() => {
    let result = applications.filter((app: any) => {
      // Status filter
      if (statusFilter !== "all" && app.status !== statusFilter) {
        return false;
      }

      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch =
          app.creator?.firstName?.toLowerCase().includes(search) ||
          app.creator?.lastName?.toLowerCase().includes(search) ||
          app.creator?.email?.toLowerCase().includes(search) ||
          app.offer?.title?.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      return true;
    });

    // Sort
    result.sort((a: any, b: any) => {
      let comparison = 0;
      switch (sortField) {
        case "creator":
          const nameA = a.creator?.firstName || "";
          const nameB = b.creator?.firstName || "";
          comparison = nameA.localeCompare(nameB);
          break;
        case "offer":
          comparison = (a.offer?.title || "").localeCompare(b.offer?.title || "");
          break;
        case "status":
          comparison = (a.status || "").localeCompare(b.status || "");
          break;
        case "applied":
          comparison = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
          break;
        case "conversions":
          comparison = (a.conversionCount || 0) - (b.conversionCount || 0);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [applications, searchTerm, statusFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const completeApplicationMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      const response = await apiRequest('POST', `/api/applications/${applicationId}/complete`);
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/applications"] });
      toast({
        title: "Work Approved",
        description: "Creator work has been marked as complete.",
      });

      if (data.promptReview && data.companyId && data.companyName) {
        setReviewPromptData({
          companyId: data.companyId,
          companyName: data.companyName,
          applicationId: data.application?.id,
        });
        setReviewPromptOpen(true);
      }
    },
    onError: (error: any) => {
      setErrorDialog({
        title: "Error",
        message: error.message || "Failed to mark work as complete",
      });
    },
  });

  const startConversationMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      const response = await apiRequest('POST', '/api/conversations/start', { applicationId });
      return response.json();
    },
    onSuccess: (data: any) => {
      setLocation(`/company/messages?conversation=${data.conversationId}`);
    },
    onError: (error: any) => {
      setErrorDialog({
        title: "Error",
        message: error.message || "Failed to start conversation",
      });
    },
  });

  const approveApplicationMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      const response = await apiRequest('PUT', `/api/applications/${applicationId}/approve`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/applications"] });
      toast({
        title: "Application Approved",
        description: "Creator has been approved and tracking link generated.",
      });
    },
    onError: (error: any) => {
      setErrorDialog({
        title: "Error",
        message: error.message || "Failed to approve application",
      });
    },
  });

  const rejectApplicationMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      const response = await apiRequest('PUT', `/api/applications/${applicationId}/reject`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/applications"] });
      toast({
        title: "Application Rejected",
        description: "Application has been rejected.",
      });
    },
    onError: (error: any) => {
      setErrorDialog({
        title: "Error",
        message: error.message || "Failed to reject application",
      });
    },
  });

  const recordConversionMutation = useMutation({
    mutationFn: async ({ applicationId, saleAmount }: { applicationId: string; saleAmount?: string }) => {
      const body = saleAmount ? { saleAmount: parseFloat(saleAmount) } : {};
      const response = await apiRequest('POST', `/api/conversions/${applicationId}`, body);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/company"] });
      setConversionDialogOpen(false);
      setSaleAmount("");
      setSelectedApplication(null);
      toast({
        title: "Conversion Recorded",
        description: "Conversion and payment have been created successfully.",
      });
    },
    onError: (error: any) => {
      setErrorDialog({
        title: "Error",
        message: error.message || "Failed to record conversion",
      });
    },
  });

  const handleApprove = (applicationId: string) => {
    if (confirm("Approve this application? This will generate a tracking link for the creator.")) {
      approveApplicationMutation.mutate(applicationId);
    }
  };

  const handleReject = (applicationId: string) => {
    if (confirm("Reject this application? This action cannot be undone.")) {
      rejectApplicationMutation.mutate(applicationId);
    }
  };

  const handleRecordConversion = (application: any) => {
    if (application.conversionCount > 0) {
      const conversionText = application.conversionCount === 1 ? 'conversion' : 'conversions';
      const confirmed = confirm(
        `${application.creator?.firstName || 'This creator'} already has ${application.conversionCount} ${conversionText} recorded.\n\n` +
        `Total earnings so far: $${application.totalEarnings || '0.00'}\n\n` +
        `Do you want to record another conversion?`
      );

      if (!confirmed) {
        return;
      }
    }

    setSelectedApplication(application);
    setSaleAmount("");
    setConversionDialogOpen(true);
  };

  const handleSubmitConversion = () => {
    if (!selectedApplication) return;

    if (selectedApplication.offer?.commissionType === 'per_sale') {
      const amount = parseFloat(saleAmount);
      if (isNaN(amount) || amount <= 0) {
        setErrorDialog({
          title: "Invalid Amount",
          message: "Please enter a valid sale amount greater than 0.",
        });
        return;
      }
    }

    recordConversionMutation.mutate({
      applicationId: selectedApplication.id,
      saleAmount: selectedApplication.offer?.commissionType === 'per_sale' ? saleAmount : undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Pending</Badge>;
      case "approved":
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Approved</Badge>;
      case "active":
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Active</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800 border-red-200">Rejected</Badge>;
      case "completed":
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200">Completed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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
    { key: "pending", label: "Pending", count: stats.pending },
    { key: "approved", label: "Approved", count: stats.approved },
    { key: "active", label: "Active", count: stats.active },
    { key: "rejected", label: "Rejected", count: stats.rejected },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {!hideTopNav && <TopNavBar />}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
          <p className="text-gray-500 mt-1">Review and manage creator applications for your offers</p>
        </div>

        {/* Mobile Compact Stats */}
        <div className="md:hidden">
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
            <div className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-lg shadow-sm border border-gray-100 min-w-fit">
              <Users className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-900">{stats.total}</span>
              <span className="text-xs text-gray-500">Total</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-lg shadow-sm border border-gray-100 min-w-fit">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold text-gray-900">{stats.pending}</span>
              <span className="text-xs text-gray-500">Pending</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-lg shadow-sm border border-gray-100 min-w-fit">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-semibold text-gray-900">{stats.approved}</span>
              <span className="text-xs text-gray-500">Approved</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-lg shadow-sm border border-gray-100 min-w-fit">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-semibold text-gray-900">{stats.rejected}</span>
              <span className="text-xs text-gray-500">Rejected</span>
            </div>
          </div>
        </div>

        {/* Desktop Stats Cards */}
        <div className="hidden md:grid md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Applications</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <Users className="h-5 w-5 text-gray-600" />
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
                <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-600" />
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
                <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Rejected</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.rejected}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-red-600" />
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
                    placeholder="Search by creator or offer..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 bg-gray-50 border-gray-200 h-9 md:h-10 text-sm"
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
            {loadingApplications ? (
              <div className="p-6">
                <ListSkeleton count={5} />
              </div>
            ) : filteredApplications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <FileText className="h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-1">No applications found</h3>
                <p className="text-sm text-gray-500">
                  {searchTerm ? "Try adjusting your search terms" : "No applications match the current filter"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead className="w-[250px]">
                      <button
                        onClick={() => handleSort("creator")}
                        className="flex items-center gap-1 font-medium text-gray-700 hover:text-gray-900"
                      >
                        Creator
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("offer")}
                        className="flex items-center gap-1 font-medium text-gray-700 hover:text-gray-900"
                      >
                        Offer
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
                        onClick={() => handleSort("conversions")}
                        className="flex items-center gap-1 font-medium text-gray-700 hover:text-gray-900"
                      >
                        Conversions
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("applied")}
                        className="flex items-center gap-1 font-medium text-gray-700 hover:text-gray-900"
                      >
                        Applied
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead className="w-[120px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApplications.map((app: any) => (
                    <TableRow key={app.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border">
                            <AvatarImage src={proxiedSrc(app.creator?.profileImageUrl)} />
                            <AvatarFallback className="bg-gray-100 text-gray-600">
                              {app.creator?.firstName?.[0] || "C"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                              {app.creator?.firstName} {app.creator?.lastName}
                            </p>
                            <p className="text-sm text-gray-500 truncate">{app.creator?.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-900 truncate">{app.offer?.title || "-"}</span>
                      </TableCell>
                      <TableCell>{getStatusBadge(app.status)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <span className="font-medium text-gray-900">{app.conversionCount || 0}</span>
                          <span className="text-gray-500 ml-1">(${app.totalEarnings || "0.00"})</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">{formatDate(app.createdAt)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => startConversationMutation.mutate(app.id)}
                              className="cursor-pointer"
                            >
                              <MessageCircle className="h-4 w-4 mr-2" />
                              Message Creator
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {app.status === "pending" && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleApprove(app.id)}
                                  className="cursor-pointer text-emerald-600"
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleReject(app.id)}
                                  className="cursor-pointer text-red-600"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Reject
                                </DropdownMenuItem>
                              </>
                            )}
                            {app.status === "approved" && (
                              <DropdownMenuItem
                                onClick={() => handleRecordConversion(app)}
                                className="cursor-pointer"
                              >
                                <DollarSign className="h-4 w-4 mr-2" />
                                Record Conversion
                              </DropdownMenuItem>
                            )}
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
          {loadingApplications ? (
            <ListSkeleton count={5} />
          ) : filteredApplications.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-1">No applications found</h3>
                <p className="text-sm text-gray-500 text-center">
                  {searchTerm ? "Try adjusting your search terms" : "No applications match the current filter"}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredApplications.map((app: any) => (
              <Card key={app.id} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12 border">
                        <AvatarImage src={proxiedSrc(app.creator?.profileImageUrl)} />
                        <AvatarFallback className="bg-gray-100 text-gray-600">
                          {app.creator?.firstName?.[0] || "C"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {app.creator?.firstName} {app.creator?.lastName}
                        </p>
                        <p className="text-sm text-gray-500">{app.offer?.title}</p>
                      </div>
                    </div>
                    {getStatusBadge(app.status)}
                  </div>

                  {/* Stats Row */}
                  <div className="flex items-center justify-between py-3 border-t border-b border-gray-100">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">
                        <span className="font-medium text-gray-900">{app.conversionCount || 0}</span>
                        <span className="text-gray-500"> conversions</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">${app.totalEarnings || "0.00"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{formatDate(app.createdAt)}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 mt-3">
                    {app.status === "pending" ? (
                      <>
                        <Button
                          size="sm"
                          className="flex-1 bg-primary hover:bg-primary/90"
                          onClick={() => handleApprove(app.id)}
                          disabled={approveApplicationMutation.isPending}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => handleReject(app.id)}
                          disabled={rejectApplicationMutation.isPending}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => startConversationMutation.mutate(app.id)}
                        >
                          <MessageCircle className="h-4 w-4 mr-1" />
                          Message
                        </Button>
                        {app.status === "approved" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => handleRecordConversion(app)}
                          >
                            <DollarSign className="h-4 w-4 mr-1" />
                            Conversion
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Results count */}
        {!loadingApplications && filteredApplications.length > 0 && (
          <p className="text-sm text-gray-500 text-center">
            Showing {filteredApplications.length} of {applications.length} applications
          </p>
        )}
      </div>

      {/* Record Conversion Dialog */}
      <Dialog open={conversionDialogOpen} onOpenChange={setConversionDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Record Conversion</DialogTitle>
            <DialogDescription>
              Record a new conversion for {selectedApplication?.creator?.firstName || 'this creator'}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Offer</Label>
              <p className="text-sm text-muted-foreground">{selectedApplication?.offer?.title || 'N/A'}</p>
            </div>

            <div className="space-y-2">
              <Label>Commission Type</Label>
              <p className="text-sm text-muted-foreground capitalize">
                {selectedApplication?.offer?.commissionType?.replace('_', ' ') || 'N/A'}
              </p>
            </div>

            {selectedApplication?.offer?.commissionType === 'per_sale' && (
              <div className="space-y-2">
                <Label htmlFor="saleAmount">Sale Amount ($) *</Label>
                <Input
                  id="saleAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Enter sale amount"
                  value={saleAmount}
                  onChange={(e) => setSaleAmount(e.target.value)}
                />
                {saleAmount && parseFloat(saleAmount) > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Commission: ${(parseFloat(saleAmount) * (parseFloat(selectedApplication?.offer?.commissionPercentage || '0') / 100)).toFixed(2)}
                  </p>
                )}
              </div>
            )}

            <div className="bg-muted/50 p-3 rounded-md space-y-1 text-xs">
              <p className="font-medium">Fee Breakdown:</p>
              <p className="text-muted-foreground">Platform Fee: {feeInfo?.platformFeeDisplay || '4%'}</p>
              <p className="text-muted-foreground">Processing Fee: {feeInfo?.processingFeeDisplay || '3%'}</p>
              <p className="text-muted-foreground">Creator Receives: {feeInfo?.creatorPayoutDisplay || '93%'}</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConversionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitConversion} disabled={recordConversionMutation.isPending}>
              {recordConversionMutation.isPending ? 'Recording...' : 'Record'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Prompt Dialog */}
      {reviewPromptData && (
        <ReviewPromptDialog
          open={reviewPromptOpen}
          onOpenChange={setReviewPromptOpen}
          companyId={reviewPromptData.companyId}
          companyName={reviewPromptData.companyName}
          applicationId={reviewPromptData.applicationId}
        />
      )}

      {/* Error Dialog */}
      <GenericErrorDialog
        open={!!errorDialog}
        onOpenChange={(open) => !open && setErrorDialog(null)}
        title={errorDialog?.title || "Error"}
        description={errorDialog?.message || "An unexpected error occurred"}
      />
    </div>
  );
}
