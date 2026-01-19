import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "../lib/queryClient";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Plus,
  Pencil,
  Trash2,
  ShieldAlert,
  Search,
  X,
  AlertTriangle,
  ShieldCheck,
  ShieldOff,
  ChevronLeft,
  MoreHorizontal,
  ArrowUpDown,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { TopNavBar } from "../components/TopNavBar";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import { ListSkeleton } from "../components/skeletons";
import { Link } from "wouter";

type SortField = "keyword" | "category" | "severity" | "status";
type SortDirection = "asc" | "desc";

type BannedKeyword = {
  id: string;
  keyword: string;
  category: 'profanity' | 'spam' | 'legal' | 'harassment' | 'custom';
  isActive: boolean;
  severity: number;
  description: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function AdminKeywordManagement() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editingKeyword, setEditingKeyword] = useState<BannedKeyword | null>(null);
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState<BannedKeyword['category']>("custom");
  const [severity, setSeverity] = useState(1);
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("keyword");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
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

  const { data: keywords = [], isLoading: keywordsLoading } = useQuery<BannedKeyword[]>({
    queryKey: ["/api/admin/moderation/keywords"],
    enabled: isAuthenticated && user?.role === 'admin',
  });

  // Stats
  const stats = useMemo(() => {
    return {
      total: keywords.length,
      active: keywords.filter((k) => k.isActive).length,
      inactive: keywords.filter((k) => !k.isActive).length,
      highSeverity: keywords.filter((k) => k.severity >= 4).length,
    };
  }, [keywords]);

  // Filter and sort keywords
  const filteredKeywords = useMemo(() => {
    let result = keywords.filter((kw) => {
      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "active" && !kw.isActive) return false;
        if (statusFilter === "inactive" && kw.isActive) return false;
        if (statusFilter === "high-severity" && kw.severity < 4) return false;
      }

      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch =
          kw.keyword.toLowerCase().includes(search) ||
          kw.description?.toLowerCase().includes(search) ||
          kw.category.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      return true;
    });

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "keyword":
          comparison = a.keyword.localeCompare(b.keyword);
          break;
        case "category":
          comparison = a.category.localeCompare(b.category);
          break;
        case "severity":
          comparison = a.severity - b.severity;
          break;
        case "status":
          comparison = (a.isActive ? 1 : 0) - (b.isActive ? 1 : 0);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [keywords, searchTerm, statusFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const createKeywordMutation = useMutation({
    mutationFn: async (data: {
      keyword: string;
      category: string;
      severity: number;
      description?: string;
      isActive: boolean;
    }) => {
      const response = await apiRequest("POST", "/api/admin/moderation/keywords", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/keywords"] });
      toast({
        title: "Keyword Added",
        description: "The banned keyword has been successfully added.",
      });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to add banned keyword",
        errorDetails: error.message,
      });
    },
  });

  const updateKeywordMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        keyword: string;
        category: string;
        severity: number;
        description?: string;
        isActive: boolean;
      };
    }) => {
      const response = await apiRequest("PUT", `/api/admin/moderation/keywords/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/keywords"] });
      toast({
        title: "Keyword Updated",
        description: "The banned keyword has been successfully updated.",
      });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to update banned keyword",
        errorDetails: error.message,
      });
    },
  });

  const deleteKeywordMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/admin/moderation/keywords/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/keywords"] });
      toast({
        title: "Keyword Deleted",
        description: "The banned keyword has been successfully deleted.",
      });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to delete banned keyword",
        errorDetails: error.message,
      });
    },
  });

  const toggleKeywordMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("PATCH", `/api/admin/moderation/keywords/${id}/toggle`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/keywords"] });
      toast({
        title: "Keyword Status Updated",
        description: "The keyword status has been toggled.",
      });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to toggle keyword status",
        errorDetails: error.message,
      });
    },
  });

  const handleCreate = () => {
    setEditingKeyword(null);
    setKeyword("");
    setCategory("custom");
    setSeverity(1);
    setDescription("");
    setIsActive(true);
    setShowDialog(true);
  };

  const handleEdit = (kw: BannedKeyword) => {
    setEditingKeyword(kw);
    setKeyword(kw.keyword);
    setCategory(kw.category);
    setSeverity(kw.severity);
    setDescription(kw.description || "");
    setIsActive(kw.isActive);
    setShowDialog(true);
  };

  const handleDelete = (id: string) => {
    if (
      confirm(
        "Are you sure you want to delete this banned keyword? This action cannot be undone."
      )
    ) {
      deleteKeywordMutation.mutate(id);
    }
  };

  const handleSubmit = () => {
    if (!keyword.trim()) {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Keyword is required",
      });
      return;
    }

    const data = {
      keyword: keyword.trim(),
      category,
      severity,
      description: description.trim() || undefined,
      isActive,
    };

    if (editingKeyword) {
      updateKeywordMutation.mutate({
        id: editingKeyword.id,
        data,
      });
    } else {
      createKeywordMutation.mutate(data);
    }
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingKeyword(null);
    setKeyword("");
    setCategory("custom");
    setSeverity(1);
    setDescription("");
    setIsActive(true);
  };

  const getCategoryBadge = (cat: string) => {
    return (
      <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-100 capitalize">
        {cat}
      </Badge>
    );
  };

  const getSeverityDisplay = (sev: number) => {
    return (
      <div className="flex items-center gap-1.5">
        <span className={`font-medium ${sev >= 4 ? 'text-gray-900' : 'text-gray-600'}`}>{sev}/5</span>
        {sev >= 4 && <AlertTriangle className="h-3.5 w-3.5 text-gray-500" />}
      </div>
    );
  };

  const getSeverityColor = (sev: number) => {
    if (sev >= 4) return "text-gray-900 font-bold";
    if (sev >= 3) return "text-gray-700 font-semibold";
    return "text-gray-500";
  };

  if (isLoading || keywordsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return null;
  }

  const statusTabs = [
    { key: "all", label: "All", count: stats.total },
    { key: "active", label: "Active", count: stats.active },
    { key: "inactive", label: "Inactive", count: stats.inactive },
    { key: "high-severity", label: "High Severity", count: stats.highSeverity },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavBar />

      {/* Mobile Header */}
      <div className="md:hidden px-4 py-4 bg-white border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/dashboard">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Keywords</h1>
              <p className="text-sm text-gray-500">{stats.total} total</p>
            </div>
          </div>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6 space-y-4 md:space-y-6">
        {/* Desktop Header */}
        <div className="hidden md:flex md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Banned Keywords Management</h1>
            <p className="text-gray-500 mt-1">Manage keywords for automatic content moderation</p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Keyword
          </Button>
        </div>

        {/* Mobile Compact Stats */}
        <div className="md:hidden">
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
            <div className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-lg shadow-sm border border-gray-100 min-w-fit">
              <ShieldAlert className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-900">{stats.total}</span>
              <span className="text-xs text-gray-500">Total</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-lg shadow-sm border border-gray-100 min-w-fit">
              <ShieldCheck className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-900">{stats.active}</span>
              <span className="text-xs text-gray-500">Active</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-lg shadow-sm border border-gray-100 min-w-fit">
              <ShieldOff className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-900">{stats.inactive}</span>
              <span className="text-xs text-gray-500">Inactive</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-lg shadow-sm border border-gray-100 min-w-fit">
              <AlertTriangle className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-900">{stats.highSeverity}</span>
              <span className="text-xs text-gray-500">High</span>
            </div>
          </div>
        </div>

        {/* Desktop Stats Cards */}
        <div className="hidden md:grid md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Keywords</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <ShieldAlert className="h-5 w-5 text-gray-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Active</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-gray-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Inactive</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.inactive}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <ShieldOff className="h-5 w-5 text-gray-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">High Severity</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.highSeverity}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-gray-600" />
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
                    placeholder="Search keywords..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 bg-gray-50 border-gray-200 h-9 md:h-10 text-sm"
                    data-testid="input-search-keywords"
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
            {keywordsLoading ? (
              <div className="p-6">
                <ListSkeleton count={5} />
              </div>
            ) : filteredKeywords.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <ShieldAlert className="h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-1">No keywords found</h3>
                <p className="text-sm text-gray-500">
                  {searchTerm ? "Try adjusting your search terms" : "No keywords match the current filter"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead className="w-[200px]">
                      <button
                        onClick={() => handleSort("keyword")}
                        className="flex items-center gap-1 font-medium text-gray-700 hover:text-gray-900"
                      >
                        Keyword
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("category")}
                        className="flex items-center gap-1 font-medium text-gray-700 hover:text-gray-900"
                      >
                        Category
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("severity")}
                        className="flex items-center gap-1 font-medium text-gray-700 hover:text-gray-900"
                      >
                        Severity
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("status")}
                        className="flex items-center gap-1 font-medium text-gray-700 hover:text-gray-900"
                      >
                        Status
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredKeywords.map((kw) => (
                    <TableRow
                      key={kw.id}
                      className={`hover:bg-gray-50 ${!kw.isActive ? 'opacity-60' : ''}`}
                      data-testid={`row-keyword-${kw.id}`}
                    >
                      <TableCell>
                        <span className="font-mono font-semibold text-gray-900">{kw.keyword}</span>
                      </TableCell>
                      <TableCell>{getCategoryBadge(kw.category)}</TableCell>
                      <TableCell>{getSeverityDisplay(kw.severity)}</TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-500 truncate max-w-[200px] block">
                          {kw.description || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="bg-gray-100 text-gray-700 hover:bg-gray-100"
                        >
                          {kw.isActive ? "Active" : "Inactive"}
                        </Badge>
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
                              onClick={() => handleEdit(kw)}
                              className="cursor-pointer"
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit Keyword
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => toggleKeywordMutation.mutate(kw.id)}
                              className="cursor-pointer"
                            >
                              {kw.isActive ? (
                                <>
                                  <ToggleLeft className="h-4 w-4 mr-2" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <ToggleRight className="h-4 w-4 mr-2" />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(kw.id)}
                              className="cursor-pointer text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Keyword
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
        <div className="md:hidden space-y-2">
          {keywordsLoading ? (
            <ListSkeleton count={5} />
          ) : filteredKeywords.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ShieldAlert className="h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-1">No keywords found</h3>
                <p className="text-sm text-gray-500 text-center">
                  {searchTerm ? "Try adjusting your search terms" : "No keywords match the current filter"}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredKeywords.map((kw) => (
              <Card
                key={kw.id}
                className={`border-0 shadow-sm ${!kw.isActive ? 'opacity-60' : ''}`}
                data-testid={`card-keyword-${kw.id}`}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Switch
                        checked={kw.isActive}
                        onCheckedChange={() => toggleKeywordMutation.mutate(kw.id)}
                        disabled={toggleKeywordMutation.isPending}
                        className="shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-mono font-semibold text-gray-900 truncate">{kw.keyword}</p>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={`text-xs ${getSeverityColor(kw.severity)}`}>
                              {kw.severity}/5
                            </span>
                            {kw.severity >= 4 && <AlertTriangle className="h-3 w-3 text-gray-500" />}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs text-gray-500 capitalize">{kw.category}</span>
                          <span className="text-gray-300">|</span>
                          <span className="text-xs text-gray-500">{kw.isActive ? "Active" : "Inactive"}</span>
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={() => handleEdit(kw)}
                          className="cursor-pointer"
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(kw.id)}
                          className="cursor-pointer text-red-600"
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
        {!keywordsLoading && filteredKeywords.length > 0 && (
          <p className="text-sm text-gray-500 text-center">
            Showing {filteredKeywords.length} of {keywords.length} keywords
          </p>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingKeyword ? "Edit Keyword" : "Add Banned Keyword"}</DialogTitle>
            <DialogDescription>
              {editingKeyword
                ? "Update the banned keyword settings"
                : "Add a new keyword to automatically flag inappropriate content"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="keyword">Keyword *</Label>
              <Input
                id="keyword"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="e.g., spam, scam, etc."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select value={category} onValueChange={(val) => setCategory(val as any)}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="profanity">Profanity</SelectItem>
                  <SelectItem value="spam">Spam</SelectItem>
                  <SelectItem value="legal">Legal</SelectItem>
                  <SelectItem value="harassment">Harassment</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="severity">
                Severity: <span className={getSeverityColor(severity)}>{severity}</span>
              </Label>
              <input
                type="range"
                id="severity"
                min="1"
                max="5"
                value={severity}
                onChange={(e) => setSeverity(parseInt(e.target.value))}
                className="w-full"
                aria-label="Severity level"
              />
              <p className="text-xs text-gray-500">
                1 = Low severity, 5 = Critical severity
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Why is this keyword banned?"
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="isActive">Active (keyword will be used in moderation)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createKeywordMutation.isPending || updateKeywordMutation.isPending}
            >
              {editingKeyword ? "Update" : "Add"} Keyword
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
