import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "../hooks/use-toast";
import { apiRequest, queryClient } from "../lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "../components/ui/form";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";
import { Checkbox } from "../components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Plus, DollarSign, Video, Calendar, Users, Eye, Filter, X, ChevronDown, ChevronUp, AlertTriangle, Clock, AlertCircle, MoreVertical, Edit, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../components/ui/dropdown-menu";
import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { TopNavBar } from "../components/TopNavBar";
import { ListSkeleton } from "../components/skeletons";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { useCompanyPageTour } from "../components/CompanyTour";
import { COMPANY_TOUR_IDS, retainersTourSteps } from "../lib/companyTourConfig";
import { PlatformBadge, PlatformIcon } from "../lib/platform-icons";

const retainerTierSchema = z.object({
  name: z.string().min(1, "Tier name is required"),
  monthlyAmount: z.string().min(1, "Monthly amount is required"),
  videosPerMonth: z.string().min(1, "Videos per month is required"),
  durationMonths: z.string().min(1, "Duration is required"),
});

const createRetainerSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  monthlyAmount: z.string().min(1, "Monthly amount is required"),
  videosPerMonth: z.string().min(1, "Videos per month is required"),
  durationMonths: z.string().min(1, "Duration is required"),
  requiredPlatform: z.string().min(1, "Platform is required"),
  platformAccountDetails: z.string().optional(),
  contentGuidelines: z.string().optional(),
  brandSafetyRequirements: z.string().optional(),
  minimumFollowers: z.string().optional(),
  niches: z.string().optional(),
  contentApprovalRequired: z.boolean().default(false),
  exclusivityRequired: z.boolean().default(false),
  minimumVideoLengthSeconds: z.string().optional(),
  postingSchedule: z.string().optional(),
  retainerTiers: z.array(retainerTierSchema).max(5).default([]),
});

type CreateRetainerForm = z.infer<typeof createRetainerSchema>;

export default function CompanyRetainers() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  // Quick tour for retainers page
  useCompanyPageTour(COMPANY_TOUR_IDS.RETAINERS, retainersTourSteps);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    errorDetails?: string;
  }>({
    open: false,
    title: "",
    description: "",
    errorDetails: "",
  });

  // Exit confirmation dialog state
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);
  const [exitMessage, setExitMessage] = useState<{ title: string; description: string }>({
    title: "Leave Page?",
    description: "Are you sure you want to close this dialog?",
  });

  const { data: contracts, isLoading } = useQuery<any[]>({
    queryKey: ["/api/company/retainer-contracts"],
  });

  // Fetch company stats to check approval status
  const { data: companyStats } = useQuery<any>({
    queryKey: ["/api/company/stats"],
  });

  const isCompanyPending = companyStats?.companyProfile?.status === 'pending';

  const contractsList = contracts ?? [];

  const uniqueStatuses = useMemo(
    () => Array.from(new Set(contractsList.map((contract) => contract.status).filter(Boolean))),
    [contractsList]
  );

  const uniquePlatforms = useMemo(
    () => Array.from(new Set(contractsList.map((contract) => contract.requiredPlatform).filter(Boolean))),
    [contractsList]
  );

  const filteredContracts = useMemo(() => {
    return contractsList.filter((contract) => {
      const matchesSearch = searchTerm
        ? [contract.title, contract.description, contract.requiredPlatform, contract.niches?.join(", ")]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(searchTerm.toLowerCase()))
        : true;
      const matchesStatus = statusFilter === "all" || contract.status === statusFilter;
      const matchesPlatform = platformFilter === "all" || contract.requiredPlatform === platformFilter;

      return matchesSearch && matchesStatus && matchesPlatform;
    });
  }, [contractsList, platformFilter, searchTerm, statusFilter]);

  const hasActiveFilters =
    searchTerm.trim().length > 0 || statusFilter !== "all" || platformFilter !== "all";

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setPlatformFilter("all");
  };

  const form = useForm<CreateRetainerForm>({
    resolver: zodResolver(createRetainerSchema),
    defaultValues: {
      title: "",
      description: "",
      monthlyAmount: "",
      videosPerMonth: "",
      durationMonths: "3",
      requiredPlatform: "",
      platformAccountDetails: "",
      contentGuidelines: "",
      brandSafetyRequirements: "",
      minimumFollowers: "",
      niches: "",
      contentApprovalRequired: false,
      exclusivityRequired: false,
      minimumVideoLengthSeconds: "",
      postingSchedule: "",
      retainerTiers: [
        { name: "Bronze", monthlyAmount: "500", videosPerMonth: "12", durationMonths: "3" },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "retainerTiers",
  });

  // Check if form has unsaved changes
  const hasUnsavedChanges = () => {
    const values = form.getValues();
    return (
      values.title.trim() !== "" ||
      values.description.trim() !== "" ||
      values.monthlyAmount.trim() !== "" ||
      values.videosPerMonth.trim() !== "" ||
      values.requiredPlatform.trim() !== "" ||
      (values.platformAccountDetails?.trim() || "") !== "" ||
      (values.contentGuidelines?.trim() || "") !== "" ||
      (values.brandSafetyRequirements?.trim() || "") !== "" ||
      (values.minimumFollowers?.trim() || "") !== "" ||
      (values.niches?.trim() || "") !== "" ||
      values.contentApprovalRequired === true ||
      values.exclusivityRequired === true ||
      (values.minimumVideoLengthSeconds?.trim() || "") !== "" ||
      (values.postingSchedule?.trim() || "") !== ""
    );
  };

  // Handle dialog close attempt - always show confirmation when closing
  const handleDialogClose = (openState: boolean) => {
    if (openState) {
      // Opening the dialog
      setOpen(true);
    } else {
      // Closing the dialog - always show confirmation
      if (hasUnsavedChanges()) {
        setExitMessage({
          title: "Unsaved Changes",
          description: "You have unsaved changes in your retainer contract. Are you sure you want to leave? All your progress will be lost.",
        });
      } else {
        setExitMessage({
          title: "Leave Page?",
          description: "You haven't added any information yet. Are you sure you want to close this dialog?",
        });
      }
      setShowExitConfirmation(true);
    }
  };

  // Confirm closing the dialog
  const confirmCloseDialog = () => {
    setShowExitConfirmation(false);
    setOpen(false);
    form.reset();
  };

  // Cancel closing the dialog
  const cancelCloseDialog = () => {
    setShowExitConfirmation(false);
  };

  // Warn before browser close/refresh when dialog is open with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (open && hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [open]);

  // Handle browser back/forward navigation when dialog is open - always show confirmation
  useEffect(() => {
    if (!open) return;

    // Push a state to detect when user tries to go back
    window.history.pushState(null, "", window.location.href);

    const handlePopState = () => {
      // Push state again to prevent navigation
      window.history.pushState(null, "", window.location.href);

      if (hasUnsavedChanges()) {
        setExitMessage({
          title: "Unsaved Changes",
          description: "You have unsaved changes in your retainer contract. Are you sure you want to leave? All your progress will be lost.",
        });
      } else {
        setExitMessage({
          title: "Leave Page?",
          description: "You haven't added any information yet. Are you sure you want to close this dialog?",
        });
      }
      setShowExitConfirmation(true);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [open, form]);

  const createMutation = useMutation({
    mutationFn: async (data: CreateRetainerForm) => {
      const payload = {
        ...data,
        monthlyAmount: parseFloat(data.monthlyAmount),
        videosPerMonth: parseInt(data.videosPerMonth),
        durationMonths: parseInt(data.durationMonths),
        minimumFollowers: data.minimumFollowers ? parseInt(data.minimumFollowers) : undefined,
        niches: data.niches ? data.niches.split(",").map((n) => n.trim()).filter(Boolean) : [],
        minimumVideoLengthSeconds: data.minimumVideoLengthSeconds
          ? parseInt(data.minimumVideoLengthSeconds)
          : undefined,
        retainerTiers: (data.retainerTiers || []).map((tier) => ({
          name: tier.name,
          monthlyAmount: parseFloat(tier.monthlyAmount),
          videosPerMonth: parseInt(tier.videosPerMonth),
          durationMonths: parseInt(tier.durationMonths),
        })),
      };
      return await apiRequest("POST", "/api/company/retainer-contracts", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/retainer-contracts"] });
      toast({
        title: "Retainer Contract Created",
        description: "Your monthly retainer contract has been posted successfully.",
      });
      setOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data || error?.message || "Failed to create retainer contract";
      setErrorDialog({
        open: true,
        title: "Error Creating Contract",
        description: "We encountered an issue while creating your retainer contract. Please try again.",
        errorDetails: String(errorMessage),
      });
    },
  });

  const onSubmit = (data: CreateRetainerForm) => {
    createMutation.mutate(data);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "open":
        return "default";
      case "in_progress":
        return "secondary";
      case "completed":
        return "outline";
      case "cancelled":
        return "destructive";
      default:
        return "secondary";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <TopNavBar />
        <div>
          <h1 className="text-3xl font-bold">Monthly Retainers</h1>
          <p className="text-muted-foreground">Hire creators for ongoing monthly video production</p>
        </div>
        <ListSkeleton count={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 md:px-0">
      <TopNavBar />

      {/* Company Approval Pending Banner */}
      {isCompanyPending && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0" />
          <p className="flex-1 text-sm text-amber-800 dark:text-amber-200">
            <span className="font-medium">Company Approval Pending:</span> Your company registration is under review. You'll be able to create retainers once approved.
          </p>
          <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50 hidden sm:flex">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        </div>
      )}

      {/* ========== MOBILE LAYOUT ========== */}
      <div className="md:hidden space-y-4">
        {/* Mobile Header with Create Button on Right */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Monthly Retainers</h1>
            <p className="text-xs text-gray-500 mt-0.5">Hire creators for video production</p>
          </div>
          {isCompanyPending ? (
            <Button size="sm" className="gap-1.5 h-9 px-3 rounded-lg text-xs flex-shrink-0" disabled>
              <Plus className="h-4 w-4" />
              Create
            </Button>
          ) : (
            <Dialog open={open} onOpenChange={handleDialogClose}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 h-9 px-3 rounded-lg text-xs flex-shrink-0">
                  <Plus className="h-4 w-4" />
                  Create
                </Button>
              </DialogTrigger>
            </Dialog>
          )}
        </div>

        {/* Mobile Search */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search retainers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-11 rounded-xl border-gray-200 bg-white"
          />
        </div>

        {/* Mobile Filter Buttons */}
        <div className="flex gap-2">
          {/* Status Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={statusFilter !== "all" ? "default" : "outline"}
                size="sm"
                className="gap-1.5 h-9 rounded-lg text-xs"
              >
                <Eye className="h-3.5 w-3.5" />
                {statusFilter === "all" ? "Status" : statusFilter.replace("_", " ")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setStatusFilter("all")}>
                All Statuses
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {uniqueStatuses.map((status) => (
                <DropdownMenuItem
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className="capitalize"
                >
                  {status.replace("_", " ")}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Platform Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={platformFilter !== "all" ? "default" : "outline"}
                size="sm"
                className="gap-1.5 h-9 rounded-lg text-xs"
              >
                <Video className="h-3.5 w-3.5" />
                {platformFilter === "all" ? "Platform" : platformFilter}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setPlatformFilter("all")}>
                All Platforms
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {uniquePlatforms.map((platform) => (
                <DropdownMenuItem
                  key={platform}
                  onClick={() => setPlatformFilter(platform)}
                >
                  {platform}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile Results Count */}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{filteredContracts.length} retainers found</span>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-primary font-medium flex items-center gap-1">
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>

        {/* Mobile Retainers List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
                <div className="h-5 w-3/4 bg-gray-200 rounded mb-2" />
                <div className="h-4 w-1/2 bg-gray-200 rounded mb-3" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-16 bg-gray-100 rounded-lg" />
                  <div className="h-16 bg-gray-100 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredContracts.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No retainers found</p>
            <p className="text-gray-400 text-sm mt-1">Create your first retainer contract</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredContracts.map((contract: any) => (
              <div key={contract.id} className="bg-white rounded-xl border border-gray-100 p-4 ring-2 ring-primary/20">
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <Link href={`/company/retainers/${contract.id}`} className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 line-clamp-2 text-sm">{contract.title}</h3>
                    <Badge variant={getStatusBadgeVariant(contract.status)} className="mt-1.5 text-xs">
                      {contract.status.replace("_", " ")}
                    </Badge>
                  </Link>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <PlatformBadge platform={contract.requiredPlatform} size="sm" />
                    {/* Action Menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                          <MoreVertical className="h-4 w-4 text-gray-500" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/company/retainers/${contract.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/company/retainers/${contract.id}/edit`}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Retainer
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-gray-500 line-clamp-2 mb-3">{contract.description}</p>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs text-gray-400">Monthly</p>
                      <p className="font-semibold text-sm">CA${parseFloat(contract.monthlyAmount).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50">
                    <Video className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs text-gray-400">Videos</p>
                      <p className="font-semibold text-sm">{contract.videosPerMonth}/mo</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50">
                    <Calendar className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs text-gray-400">Duration</p>
                      <p className="font-semibold text-sm">{contract.durationMonths} months</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50">
                    <Users className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs text-gray-400">Applied</p>
                      <p className="font-semibold text-sm">{contract.applicationCount || 0}</p>
                    </div>
                  </div>
                </div>

                {/* Badges */}
                {(contract.exclusivityRequired || contract.contentApprovalRequired) && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100">
                    {contract.exclusivityRequired && (
                      <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                        Exclusivity
                      </Badge>
                    )}
                    {contract.contentApprovalRequired && (
                      <Badge variant="outline" className="text-xs">
                        Approval Required
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========== DESKTOP LAYOUT ========== */}
      <div className="hidden md:block space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold" data-testid="heading-company-retainers">
              Monthly Retainers
            </h1>
            <p className="text-muted-foreground">
              Hire creators for ongoing monthly video production
            </p>
          </div>
        {isCompanyPending ? (
          <Button
            data-testid="button-create-retainer"
            disabled
            title="Your company must be approved before creating retainers"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Retainer
          </Button>
        ) : (
        <Dialog open={open} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-retainer">
              <Plus className="h-4 w-4 mr-2" />
              Create Retainer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Monthly Retainer Contract</DialogTitle>
              <DialogDescription>
                Post a monthly retainer for creators to produce a fixed number of videos
                on brand new accounts for your brand
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract Title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., TikTok Lifestyle Content - 30 Videos/Month"
                          data-testid="input-retainer-title"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the type of content, brand voice, target audience, etc."
                          rows={4}
                          data-testid="input-retainer-description"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="monthlyAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly Payment ($)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="5000.00"
                            data-testid="input-retainer-amount"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="videosPerMonth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Videos Per Month</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="30-50"
                            data-testid="input-retainer-videos"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Typically 30-50 videos per month
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="durationMonths"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contract Duration (Months)</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value || "3"}
                            className="grid grid-cols-2 gap-2"
                          >
                            {["1", "3", "6", "12"].map((value) => (
                              <label
                                key={value}
                                className={`flex items-center gap-2 rounded-md border p-3 cursor-pointer transition-all ${
                                  field.value === value
                                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                    : "hover:border-primary hover:bg-accent"
                                }`}
                              >
                                <RadioGroupItem value={value} />
                                <span className={`font-medium ${field.value === value ? "text-primary" : ""}`}>
                                  {value} month{value === "1" ? "" : "s"}
                                </span>
                              </label>
                            ))}
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="requiredPlatform"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Required Platform</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-retainer-platform">
                              <SelectValue placeholder="Select platform" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="TikTok">TikTok</SelectItem>
                            <SelectItem value="Instagram">Instagram Reels</SelectItem>
                            <SelectItem value="YouTube Shorts">YouTube Shorts</SelectItem>
                            <SelectItem value="Facebook Reels">Facebook Reels</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="platformAccountDetails"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Platform Account Details (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., Creator will be given access to @brandname account, or creator should create brand new account"
                          rows={2}
                          data-testid="input-platform-details"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contentGuidelines"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content Guidelines (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Specific content requirements, posting schedule, editing style, etc."
                          rows={3}
                          data-testid="input-content-guidelines"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                    )}
                  />

                <FormField
                  control={form.control}
                  name="brandSafetyRequirements"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand Safety Requirements (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Topics to avoid, brand safety guidelines, compliance requirements, etc."
                          rows={2}
                          data-testid="input-brand-safety"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                    )}
                  />

                <div className="grid sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="minimumVideoLengthSeconds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum Video Length (seconds)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="45"
                            data-testid="input-minimum-video-length"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Set expectations like 45-60 seconds per video
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="postingSchedule"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Posting Schedule</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., 1 video every weekday"
                            data-testid="input-posting-schedule"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Outline cadence expectations for creators
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contentApprovalRequired"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-1">
                          <FormLabel className="text-base">Content approval required</FormLabel>
                          <FormDescription>Review videos before they go live</FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-content-approval"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="exclusivityRequired"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-1">
                          <FormLabel className="text-base">Exclusivity</FormLabel>
                          <FormDescription>Prevent creators from working with competitors</FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-exclusivity"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="minimumFollowers"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum Followers (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="10000"
                            data-testid="input-min-followers"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="niches"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Niches (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Fashion, Lifestyle, Beauty"
                            data-testid="input-niches"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Comma-separated
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <FormLabel className="text-base">Tiered Retainer Packages (up to 5)</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Offer creators predictable options like Bronze/Silver/Gold with clear deliverables.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        append({
                          name: `Tier ${fields.length + 1}`,
                          monthlyAmount: "1000",
                          videosPerMonth: "20",
                          durationMonths: form.getValues("durationMonths") || "3",
                        })
                      }
                      disabled={fields.length >= 5}
                      data-testid="button-add-tier"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add tier
                    </Button>
                  </div>

                  <div className="grid gap-3">
                    <div className="grid md:grid-cols-5 gap-3 text-xs font-semibold text-muted-foreground px-1 uppercase tracking-wide">
                      <span>Tier name</span>
                      <span>Monthly amount</span>
                      <span>Videos per month</span>
                      <span>Duration</span>
                      <span className="text-right">CA$ / video</span>
                    </div>
                    {fields.map((field, index) => {
                      const monthly = Number(form.watch(`retainerTiers.${index}.monthlyAmount`) || 0);
                      const videos = Math.max(1, Number(form.watch(`retainerTiers.${index}.videosPerMonth`) || 1));
                      const perVideo = (monthly / videos).toFixed(2);

                      return (
                        <div
                          key={field.id}
                          className="grid md:grid-cols-5 gap-3 items-center rounded-md border bg-background p-3"
                        >
                          <Input
                            placeholder="Tier name"
                            {...form.register(`retainerTiers.${index}.name` as const)}
                          />
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Monthly $"
                            {...form.register(`retainerTiers.${index}.monthlyAmount` as const)}
                          />
                          <Input
                            type="number"
                            min="1"
                            placeholder="Videos/mo"
                            {...form.register(`retainerTiers.${index}.videosPerMonth` as const)}
                          />
                          <Input
                            type="number"
                            min="1"
                            placeholder="Months"
                            {...form.register(`retainerTiers.${index}.durationMonths` as const)}
                          />
                          <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
                            <div className="rounded-md bg-primary/5 px-3 py-2 text-primary font-semibold">
                              CA${perVideo}/video
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => remove(index)}
                              disabled={fields.length === 1}
                              data-testid={`button-remove-tier-${index}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDialogClose(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    data-testid="button-submit-retainer"
                  >
                    {createMutation.isPending ? "Creating..." : "Create Retainer"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <Card className="border-card-border">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-semibold uppercase tracking-widest">Search & Filter</span>
            </div>
            <div className="sm:ml-auto text-sm text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{filteredContracts.length}</span> of {contractsList.length}
              {` contract${contractsList.length === 1 ? "" : "s"}`}
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="text-xs sm:ml-4" onClick={clearFilters}>
                <X className="h-3 w-3 mr-1" />
                Reset
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFilterCollapsed(!isFilterCollapsed)}
              aria-label="Toggle filter visibility"
              data-testid="button-toggle-filter"
              className="sm:ml-2"
            >
              {isFilterCollapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
            </Button>
          </div>

          {!isFilterCollapsed && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <Input
                placeholder="Search contracts or niches"
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
                      {status.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Platform</label>
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All platforms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  {uniquePlatforms.map((platform) => (
                    <SelectItem key={platform} value={platform}>
                      {platform}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          )}
        </CardContent>
      </Card>

      {contractsList.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="p-12 text-center">
            <DollarSign className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No Retainer Contracts</h3>
            <p className="text-muted-foreground mb-4">
              Create your first monthly retainer contract to hire creators for ongoing video production
            </p>
          </CardContent>
        </Card>
      ) : filteredContracts.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="p-10 text-center space-y-2">
            <Calendar className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <h3 className="text-lg font-semibold">No contracts match your filters</h3>
            <p className="text-sm text-muted-foreground">Try refining your search or clearing the filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {filteredContracts.map((contract: any) => (
            <Link
              key={contract.id}
              href={`/company/retainers/${contract.id}`}
              className="block"
            >
              <Card
                className="group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-card-border cursor-pointer ring-2 ring-primary/30 hover:ring-primary/50 hover:shadow-primary/20 h-full"
                data-testid={`retainer-card-${contract.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg leading-tight line-clamp-1" data-testid={`text-retainer-title-${contract.id}`}>
                          {contract.title}
                        </CardTitle>
                        <Badge variant={getStatusBadgeVariant(contract.status)} className="mt-1.5">
                          {contract.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <PlatformBadge platform={contract.requiredPlatform} size="sm" className="shrink-0" />
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                      {contract.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {contract.exclusivityRequired && (
                        <Badge className="bg-primary/10 text-primary text-xs" variant="outline">
                          Exclusivity
                        </Badge>
                      )}
                      {contract.minimumVideoLengthSeconds && (
                        <Badge variant="outline" className="text-xs">
                          Min length: {contract.minimumVideoLengthSeconds}s
                        </Badge>
                      )}
                      {contract.postingSchedule && (
                        <Badge variant="outline" className="text-xs">{contract.postingSchedule}</Badge>
                      )}
                      {contract.contentApprovalRequired && (
                        <Badge variant="outline" className="text-xs">Platform</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="flex items-center gap-2 p-2.5 rounded-lg border bg-card hover:bg-primary/5 transition-colors duration-200">
                      <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                        <DollarSign className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Monthly Payment</p>
                        <p className="font-semibold text-sm truncate">CA${parseFloat(contract.monthlyAmount).toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-2.5 rounded-lg border bg-card hover:bg-primary/5 transition-colors duration-200">
                      <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                        <Video className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Videos/Month</p>
                        <p className="font-semibold text-sm">{contract.videosPerMonth}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-2.5 rounded-lg border bg-card hover:bg-primary/5 transition-colors duration-200">
                      <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                        <Calendar className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Duration</p>
                        <p className="font-semibold text-sm">{contract.durationMonths} months</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-2.5 rounded-lg border bg-card hover:bg-primary/5 transition-colors duration-200">
                      <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                        <PlatformIcon platform={contract.requiredPlatform} size="md" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Platform</p>
                        <p className="font-semibold text-sm truncate">{contract.requiredPlatform}</p>
                      </div>
                    </div>
                  </div>

                  {Array.isArray(contract.retainerTiers) && contract.retainerTiers.length > 0 && (
                    <div className="mt-3 pt-3 border-t space-y-2">
                      <p className="text-sm font-semibold">Tiered Packages</p>
                      <div className="flex flex-wrap gap-2">
                        {contract.retainerTiers.map((tier: any, tierIndex: number) => (
                          <div
                            key={`${contract.id}-tier-${tierIndex}`}
                            className="flex items-center gap-2 rounded-lg border p-2 bg-muted/30"
                          >
                            <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                              {tier.name}
                            </Badge>
                            <span className="font-medium text-sm">{tier.name}</span>
                            <Badge variant="outline" className="text-xs">CA${tier.monthlyAmount?.toLocaleString?.() || tier.monthlyAmount}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {tier.videosPerMonth} videos / {tier.durationMonths} month{tier.durationMonths === 1 ? "" : "s"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {contract.applicationCount > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-sm text-muted-foreground">
                        <strong>{contract.applicationCount}</strong> creator{contract.applicationCount === 1 ? "" : "s"} applied
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
      </div>

      <GenericErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
        title={errorDialog.title}
        description={errorDialog.description}
        errorDetails={errorDialog.errorDetails}
        variant="error"
      />

      {/* Exit Confirmation Dialog */}
      <Dialog open={showExitConfirmation} onOpenChange={setShowExitConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              {exitMessage.title}
            </DialogTitle>
            <DialogDescription>
              {exitMessage.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={cancelCloseDialog}>
              Continue
            </Button>
            <Button variant="destructive" onClick={confirmCloseDialog}>
              Leave Page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
