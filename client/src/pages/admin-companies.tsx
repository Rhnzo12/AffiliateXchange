import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
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
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Building2,
  ExternalLink,
  Search,
  X,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  MoreHorizontal,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  Ban,
  ArrowUpDown,
  Calendar,
  Globe,
  ChevronLeft,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import { TopNavBar } from "../components/TopNavBar";
import { Link, useLocation } from "wouter";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import { ListSkeleton } from "../components/skeletons";

type Company = {
  id: string;
  legalName: string;
  tradeName?: string;
  industry?: string;
  websiteUrl?: string;
  status: "pending" | "approved" | "rejected" | "suspended";
  createdAt: string;
  approvedAt?: string;
  isDeletedUser?: boolean;
  user?: {
    email: string;
    username: string;
  };
};

type CompanyWithRisk = {
  id: string;
  legalName: string;
  tradeName?: string;
  riskScore: number;
  riskLevel: "high" | "medium" | "low";
  riskIndicators: string[];
};

type SortField = "name" | "industry" | "status" | "joined";
type SortDirection = "asc" | "desc";

export default function AdminCompanies() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("joined");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
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

  const { data: companies = [], isLoading: loadingCompanies } = useQuery<Company[]>({
    queryKey: ["/api/admin/companies/all"],
    queryFn: async () => {
      const response = await fetch("/api/admin/companies/all", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch companies");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const { data: riskData } = useQuery<{
    companies: CompanyWithRisk[];
    summary: {
      total: number;
      highRisk: number;
      mediumRisk: number;
      lowRisk: number;
    };
  }>({
    queryKey: ["/api/admin/companies/risk-assessments"],
    queryFn: async () => {
      const response = await fetch("/api/admin/companies/risk-assessments", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch risk assessments");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const riskMap = useMemo(() => {
    const map = new Map<string, CompanyWithRisk>();
    riskData?.companies?.forEach((company) => {
      map.set(company.id, company);
    });
    return map;
  }, [riskData]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Filter and sort companies
  const filteredCompanies = useMemo(() => {
    let result = companies.filter((company) => {
      // Status filter
      if (statusFilter !== "all" && company.status !== statusFilter) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          company.legalName?.toLowerCase().includes(query) ||
          company.tradeName?.toLowerCase().includes(query) ||
          company.user?.email?.toLowerCase().includes(query) ||
          company.user?.username?.toLowerCase().includes(query) ||
          company.industry?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      return true;
    });

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = (a.legalName || "").localeCompare(b.legalName || "");
          break;
        case "industry":
          comparison = (a.industry || "").localeCompare(b.industry || "");
          break;
        case "status":
          comparison = (a.status || "").localeCompare(b.status || "");
          break;
        case "joined":
          comparison = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [companies, searchQuery, statusFilter, sortField, sortDirection]);

  // Stats
  const stats = useMemo(() => {
    return {
      total: companies.length,
      approved: companies.filter((c) => c.status === "approved").length,
      pending: companies.filter((c) => c.status === "pending").length,
      rejected: companies.filter((c) => c.status === "rejected").length,
      suspended: companies.filter((c) => c.status === "suspended").length,
    };
  }, [companies]);

  const getStatusBadge = (status: string) => {
    return (
      <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-100 capitalize">
        {status}
      </Badge>
    );
  };

  const getRiskIndicator = (companyId: string) => {
    const riskInfo = riskMap.get(companyId);
    if (!riskInfo) return <span className="text-sm text-gray-400">-</span>;

    const { riskLevel, riskScore, riskIndicators } = riskInfo;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5">
              {riskLevel === "high" ? (
                <ShieldAlert className="h-4 w-4 text-gray-500" />
              ) : riskLevel === "medium" ? (
                <AlertTriangle className="h-4 w-4 text-gray-500" />
              ) : (
                <ShieldCheck className="h-4 w-4 text-gray-500" />
              )}
              <span className="text-sm text-gray-600">{riskScore}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-semibold capitalize">{riskLevel} Risk ({riskScore}/100)</p>
              {riskIndicators.length > 0 && (
                <ul className="text-xs text-muted-foreground list-disc pl-3">
                  {riskIndicators.slice(0, 3).map((ind, i) => (
                    <li key={i}>{ind}</li>
                  ))}
                </ul>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
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
    { key: "rejected", label: "Rejected", count: stats.rejected },
    { key: "suspended", label: "Suspended", count: stats.suspended },
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
            <h1 className="text-xl font-bold text-gray-900">Companies</h1>
            <p className="text-sm text-gray-500">{stats.total} total</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Desktop Header */}
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold text-gray-900">Company Management</h1>
          <p className="text-gray-500 mt-1">Manage all companies on the platform</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-gray-600" />
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
                  <CheckCircle className="h-5 w-5 text-gray-600" />
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
                  <p className="text-sm text-gray-500">Rejected</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.rejected}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-gray-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm col-span-2 md:col-span-1">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Suspended</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.suspended}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <Ban className="h-5 w-5 text-gray-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              {/* Status Tabs */}
              <div className="flex gap-1 overflow-x-auto pb-2 md:pb-0">
                {statusTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setStatusFilter(tab.key)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                      statusFilter === tab.key
                        ? "bg-primary text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {tab.label}
                    <span className="ml-1.5 text-xs opacity-70">({tab.count})</span>
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="flex-1 md:max-w-sm">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by name, email, industry..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-gray-50 border-gray-200"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
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
            {loadingCompanies ? (
              <div className="p-6">
                <ListSkeleton count={5} />
              </div>
            ) : filteredCompanies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Building2 className="h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-1">No companies found</h3>
                <p className="text-sm text-gray-500">
                  {searchQuery ? "Try adjusting your search terms" : "No companies match the current filter"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead className="w-[280px]">
                      <button
                        onClick={() => handleSort("name")}
                        className="flex items-center gap-1 font-medium text-gray-700 hover:text-gray-900"
                      >
                        Company
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("industry")}
                        className="flex items-center gap-1 font-medium text-gray-700 hover:text-gray-900"
                      >
                        Industry
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("status")}
                        className="flex items-center gap-1 font-medium text-gray-700 hover:text-gray-900"
                      >
                        Status
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("joined")}
                        className="flex items-center gap-1 font-medium text-gray-700 hover:text-gray-900"
                      >
                        Joined
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead className="w-[80px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompanies.map((company) => (
                    <TableRow key={company.id} className="hover:bg-gray-50 cursor-pointer">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 shrink-0">
                            <Building2 className="h-5 w-5 text-gray-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{company.legalName}</p>
                            {company.tradeName && company.tradeName !== company.legalName && (
                              <p className="text-xs text-gray-500 truncate">{company.tradeName}</p>
                            )}
                            {company.websiteUrl && (
                              <a
                                href={company.websiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Globe className="h-3 w-3" />
                                Website
                              </a>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">{company.industry || "-"}</span>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <p
                            className={`text-sm truncate ${company.isDeletedUser ? "line-through text-gray-400" : "text-gray-900"}`}
                          >
                            {company.user?.email || "-"}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">@{company.user?.username}</span>
                            {company.isDeletedUser && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                Deleted
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(company.status)}</TableCell>
                      <TableCell>
                        {company.status === "approved" ? (
                          getRiskIndicator(company.id)
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">{formatDate(company.createdAt)}</span>
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
                              onClick={() => navigate(`/admin/companies/${company.id}`)}
                              className="cursor-pointer"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
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
          {loadingCompanies ? (
            <ListSkeleton count={5} />
          ) : filteredCompanies.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Building2 className="h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-1">No companies found</h3>
                <p className="text-sm text-gray-500 text-center">
                  {searchQuery ? "Try adjusting your search terms" : "No companies match the current filter"}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredCompanies.map((company) => (
              <Card key={company.id} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-gray-100 shrink-0">
                        <Building2 className="h-6 w-6 text-gray-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{company.legalName}</p>
                        {company.tradeName && company.tradeName !== company.legalName && (
                          <p className="text-xs text-gray-500 truncate">{company.tradeName}</p>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(company.status)}
                  </div>

                  {/* Info Row */}
                  <div className="flex items-center gap-4 mb-3 py-2 border-y border-gray-100">
                    {company.industry && (
                      <span className="text-sm text-gray-600">{company.industry}</span>
                    )}
                    {company.status === "approved" && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">Risk:</span>
                        {getRiskIndicator(company.id)}
                      </div>
                    )}
                  </div>

                  {/* Contact */}
                  <div className="mb-3">
                    <p
                      className={`text-sm ${company.isDeletedUser ? "line-through text-gray-400" : "text-gray-700"}`}
                    >
                      {company.user?.email || "-"}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">@{company.user?.username}</span>
                      {company.isDeletedUser && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          Deleted
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{formatDate(company.createdAt)}</span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/admin/companies/${company.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Results count */}
        {!loadingCompanies && filteredCompanies.length > 0 && (
          <p className="text-sm text-gray-500 text-center">
            Showing {filteredCompanies.length} of {companies.length} companies
          </p>
        )}
      </div>

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
