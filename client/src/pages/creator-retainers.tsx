import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "../hooks/use-toast";
import { apiRequest, queryClient } from "../lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "../components/ui/form";
import { Checkbox } from "../components/ui/checkbox";
import { Input } from "../components/ui/input";
import { Slider } from "../components/ui/slider";
import { Textarea } from "../components/ui/textarea";
import { Progress } from "../components/ui/progress";
import {
  DollarSign,
  Video,
  Calendar,
  Briefcase,
  Send,
  CheckCircle,
  Clock,
  Eye,
  AlertTriangle,
  Search,
  Flame,
  Sparkles,
  Heart,
  Star,
  ShieldCheck,
  Info,
  MessageCircle,
  Upload,
  Users as UsersIcon,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { TopNavBar } from "../components/TopNavBar";
import { ListSkeleton } from "../components/skeletons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";

const applyRetainerSchema = z.object({
  message: z
    .string()
    .min(20, "Tell us why you're interested (at least 20 characters)")
    .max(500, "Keep your note under 500 characters"),
  portfolioLinks: z.string().optional(),
  proposedStartDate: z.string().optional(),
  selectedTierId: z.string().optional(),
  acceptTerms: z
    .boolean()
    .refine((val) => val === true, { message: "You need to accept the expectations before applying" })
    .default(false),
});

type ApplyRetainerForm = z.infer<typeof applyRetainerSchema>;

export default function CreatorRetainers() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [showVideoPlatformDialog, setShowVideoPlatformDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [budgetFilter, setBudgetFilter] = useState("all");
  const [nicheFilter, setNicheFilter] = useState("all");
  const [durationFilter, setDurationFilter] = useState("all");
  const [preferenceFilter, setPreferenceFilter] = useState<string[]>([]);
  const [amountRange, setAmountRange] = useState<number[]>([0, 10000]);
  const [favoriteContracts, setFavoriteContracts] = useState<Set<string>>(new Set());
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(false);

  const handlePreferenceToggle = (preference: string) => {
    setPreferenceFilter((prev) =>
      prev.includes(preference) ? prev.filter((item) => item !== preference) : [...prev, preference]
    );
  };

  const toggleFavorite = (contractId: string) => {
    setFavoriteContracts((prev) => {
      const updated = new Set(prev);
      if (updated.has(contractId)) {
        updated.delete(contractId);
      } else {
        updated.add(contractId);
      }
      return updated;
    });
  };

  const buildTierOptions = (contract?: any) => {
    if (!contract) return [];
    const monthlyAmount = Number(contract.monthlyAmount || 0);

    if (Array.isArray(contract.retainerTiers) && contract.retainerTiers.length > 0) {
      return contract.retainerTiers;
    }

    return [
      {
        name: "Standard",
        monthlyAmount: monthlyAmount,
        videosPerMonth: contract.videosPerMonth,
        durationMonths: contract.durationMonths,
      },
    ];
  };

  const { data: contracts, isLoading } = useQuery<any[]>({
    queryKey: ["/api/retainer-contracts"],
  });

  const { data: myApplications } = useQuery<any[]>({
    queryKey: ["/api/creator/retainer-applications"],
  });

  const form = useForm<ApplyRetainerForm>({
    resolver: zodResolver(applyRetainerSchema),
    defaultValues: {
      message: "",
      portfolioLinks: "",
      proposedStartDate: "",
      selectedTierId: "",
      acceptTerms: false,
    },
  });

  const applyMutation = useMutation({
    mutationFn: async (data: ApplyRetainerForm) => {
      const payload = {
        message: data.message,
        portfolioLinks: data.portfolioLinks
          ? data.portfolioLinks.split(",").map((link) => link.trim()).filter(Boolean)
          : [],
        proposedStartDate: data.proposedStartDate || undefined,
        selectedTierId: data.selectedTierId || undefined,
      };
      return await apiRequest("POST", `/api/creator/retainer-contracts/${selectedContract.id}/apply`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/creator/retainer-applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/retainer-contracts"] });
      toast({
        title: "Application Submitted",
        description: "Your retainer application has been sent to the company.",
      });
      setOpen(false);
      setSelectedContract(null);
      form.reset();
    },
    onError: (error: Error) => {
      // Check if this is a video platform requirement error
      if (error.message && error.message.includes("video platform")) {
        setOpen(false);
        setShowVideoPlatformDialog(true);
        return;
      }

      toast({
        title: "Error",
        description: error.message || "Failed to submit application",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ApplyRetainerForm) => {
    applyMutation.mutate(data);
  };

  // Get application for a specific contract
  const getApplication = (contractId: string) => {
    return myApplications?.find((app: any) => app.contractId === contractId);
  };

  // Get button text, badge, and icon based on application status
  const getApplicationStatus = (contractId: string) => {
    const application = getApplication(contractId);
    if (!application) return {
      badge: null,
      buttonText: 'Apply Now', 
      disabled: false,
      variant: 'default' as const,
      icon: Send
    };
    
    switch (application.status) {
      case 'pending':
        return { 
          badge: 'Pending Review', 
          buttonText: 'Application Pending', 
          disabled: true,
          variant: 'secondary' as const,
          icon: Clock
        };
      case 'approved':
        return { 
          badge: 'Approved ✓', 
          buttonText: 'Application Approved', 
          disabled: true,
          variant: 'default' as const,
          icon: CheckCircle
        };
      case 'rejected':
        return { 
          badge: 'Not Selected', 
          buttonText: 'Apply Again', 
          disabled: false,
          variant: 'destructive' as const,
          icon: Send
        };
      default:
        return { 
          badge: 'Applied', 
          buttonText: 'Applied', 
          disabled: true,
          variant: 'secondary' as const,
          icon: Clock
        };
    }
  };

  const uniquePlatforms = useMemo(() => {
    const set = new Set<string>();
    contracts?.forEach((contract: any) => {
      if (contract.requiredPlatform) {
        set.add(contract.requiredPlatform);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [contracts]);

  const uniqueNiches = useMemo(() => {
    const set = new Set<string>();
    contracts?.forEach((contract: any) => {
      if (Array.isArray(contract.niches)) {
        contract.niches.forEach((niche: string) => {
          if (niche) {
            set.add(niche);
          }
        });
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [contracts]);

  const filteredContracts = useMemo(() => {
    if (!contracts) return [];
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return contracts.filter((contract: any) => {
      const matchesSearch = normalizedSearch
        ? [
            contract.title,
            contract.description,
            contract.company?.tradeName,
            contract.company?.legalName,
            Array.isArray(contract.niches) ? contract.niches.join(" ") : "",
          ]
            .filter(Boolean)
            .some((field) => String(field).toLowerCase().includes(normalizedSearch))
        : true;

      const matchesPlatform =
        platformFilter === "all" || contract.requiredPlatform?.toLowerCase() === platformFilter.toLowerCase();

      const monthlyAmount = contract.monthlyAmount ? parseFloat(contract.monthlyAmount) : 0;
      const matchesBudget =
        budgetFilter === "all" || monthlyAmount >= Number(budgetFilter);

      const matchesAmountRange = monthlyAmount >= amountRange[0] && monthlyAmount <= amountRange[1];

      const matchesNiche =
        nicheFilter === "all" || (Array.isArray(contract.niches) && contract.niches.some((n: string) => n === nicheFilter));

      const matchesDuration =
        durationFilter === "all" || Number(contract.durationMonths || 0) === Number(durationFilter);

      const matchesPreferences = preferenceFilter.every((preference) => {
        if (preference === "exclusivity") return contract.exclusivityRequired;
        if (preference === "approval_required") return contract.contentApprovalRequired;
        if (preference === "no_approval") return !contract.contentApprovalRequired;
        return true;
      });

      return (
        matchesSearch &&
        matchesPlatform &&
        matchesBudget &&
        matchesAmountRange &&
        matchesNiche &&
        matchesDuration &&
        matchesPreferences
      );
    });
  }, [contracts, searchTerm, platformFilter, budgetFilter, amountRange, nicheFilter, durationFilter, preferenceFilter]);

  const filtersApplied =
    searchTerm.trim() !== "" ||
    platformFilter !== "all" ||
    budgetFilter !== "all" ||
    nicheFilter !== "all" ||
    durationFilter !== "all" ||
    preferenceFilter.length > 0 ||
    amountRange[0] !== 0 ||
    amountRange[1] !== 10000;

  const contractMap = useMemo(() => {
    const map = new Map();
    contracts?.forEach((contract: any) => {
      map.set(contract.id, contract);
    });
    return map;
  }, [contracts]);

  const approvedApplications = useMemo(
    () => myApplications?.filter((app: any) => app.status === "approved") || [],
    [myApplications]
  );

  const completedApplications = useMemo(
    () => myApplications?.filter((app: any) => app.status === "completed") || [],
    [myApplications]
  );

  const activeContracts = useMemo(
    () =>
      approvedApplications
        .map((application: any) => ({
          application,
          contract: contractMap.get(application.contractId),
        }))
        .filter((item) => item.contract),
    [approvedApplications, contractMap]
  );

  const completedContracts = useMemo(
    () =>
      completedApplications
        .map((application: any) => ({
          application,
          contract: contractMap.get(application.contractId),
        }))
        .filter((item) => item.contract),
    [completedApplications, contractMap]
  );

  const totalMonthlyRetainer = activeContracts.reduce((sum, item) => {
    const amount = Number(item.contract?.monthlyAmount || 0);
    return sum + amount;
  }, 0);

  const totalVideosPerMonth = activeContracts.reduce((sum, item) => {
    const videos = Number(item.contract?.videosPerMonth || 0);
    return sum + videos;
  }, 0);

  const estimatedNetMonthly = totalMonthlyRetainer * 0.93;

  const messageValue = form.watch("message");
  const messageChars = messageValue?.length || 0;
  const selectedTierOptions = useMemo(() => buildTierOptions(selectedContract), [selectedContract]);
  const selectedTierId = form.watch("selectedTierId");
  const activeTier =
    selectedTierOptions.find((tier: any) => (tier.name || tier.id)?.toString() === selectedTierId) || selectedTierOptions[0];
  const selectedTierNet = Number(activeTier?.monthlyAmount || 0) * 0.93;
  const selectedTierPerVideo =
    Number(activeTier?.monthlyAmount || 0) / Math.max(1, Number(activeTier?.videosPerMonth || 1));

  useEffect(() => {
    if (selectedTierOptions.length > 0) {
      const defaultId = (selectedTierOptions[0].name || selectedTierOptions[0].id || "standard").toString();
      form.setValue("selectedTierId", defaultId);
    }
  }, [selectedTierOptions, form]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <TopNavBar />
        <div>
          <h1 className="text-3xl font-bold">Monthly Retainers</h1>
          <p className="text-muted-foreground">Browse ongoing monthly video production contracts</p>
        </div>
        <ListSkeleton count={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TopNavBar />
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-creator-retainers">
          Monthly Retainers
        </h1>
        <p className="text-muted-foreground">
          Browse ongoing monthly video production contracts
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-card-border">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-muted-foreground">Total gross monthly</div>
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold">${totalMonthlyRetainer.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Before 7% platform fee</p>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-muted-foreground">Estimated net</div>
              <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold">${estimatedNetMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-xs text-muted-foreground">After 7% platform fee</p>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-muted-foreground">Active contracts</div>
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold">{activeContracts.length}</p>
            <p className="text-xs text-muted-foreground">With predictable monthly payouts</p>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-muted-foreground">Videos due / month</div>
              <Video className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold">{totalVideosPerMonth}</p>
            <p className="text-xs text-muted-foreground">Track your monthly commitments</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-card-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">My Retainers Dashboard</CardTitle>
          <p className="text-sm text-muted-foreground">See your active and completed retainers at a glance</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <p className="text-sm font-semibold">Active contracts</p>
            </div>
            {activeContracts.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Once you're approved, your retainers will appear here with progress trackers and quick actions.
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {activeContracts.map(({ contract }) => {
                  const delivered = Number(contract?.submittedVideos || 0);
                  const totalVideos = Number(contract?.videosPerMonth || 1);
                  const progressValue = Math.min(100, Math.round((delivered / totalVideos) * 100));
                  const netAmount = Number(contract?.monthlyAmount || 0) * 0.93;

                  return (
                    <Card key={`active-${contract.id}`} className="border-card-border">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{contract.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {contract.videosPerMonth} videos/mo • {contract.durationMonths} month term
                            </p>
                          </div>
                          <Badge variant="outline" className="bg-primary/10 text-primary">
                            Net ${netAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo
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
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>Next payout expected in {Math.max(1, (contract.durationMonths || 1) * 4)} weeks</span>
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
            {completedContracts.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Track historical performance and earnings once you finish a retainer.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {completedContracts.map(({ contract }) => (
                  <Card key={`completed-${contract.id}`} className="border-card-border">
                    <CardContent className="p-4 space-y-2">
                      <p className="text-sm font-semibold">{contract.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Earned ${Number(contract.monthlyAmount || 0).toLocaleString()} per month over {contract.durationMonths}{" "}
                        month{contract.durationMonths === 1 ? "" : "s"}
                      </p>
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

      {contracts && contracts.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="p-12 text-center">
            <Briefcase className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No Retainer Contracts Available</h3>
            <p className="text-muted-foreground">
              Check back later for new monthly retainer opportunities
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="border-card-border">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Search & Filter</CardTitle>
                  <p className="text-sm text-muted-foreground">Find retainers that match your pricing, cadence, and preferences.</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsFilterCollapsed(!isFilterCollapsed)}
                  aria-label="Toggle filter visibility"
                  data-testid="button-toggle-filter"
                >
                  {isFilterCollapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
                </Button>
              </div>
            </CardHeader>
            {!isFilterCollapsed && (
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Search</p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search by title, company, or niche"
                      className="pl-9"
                      data-testid="input-retainer-search"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Platform</p>
                  <Select value={platformFilter} onValueChange={setPlatformFilter}>
                    <SelectTrigger data-testid="select-platform-filter">
                      <SelectValue placeholder="All platforms" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All platforms</SelectItem>
                      {uniquePlatforms.map((platform) => (
                        <SelectItem key={platform} value={platform}>
                          {platform}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Contract length</p>
                  <Select value={durationFilter} onValueChange={setDurationFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All lengths" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any duration</SelectItem>
                      <SelectItem value="3">3 months</SelectItem>
                      <SelectItem value="6">6 months</SelectItem>
                      <SelectItem value="12">12 months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Preferences</p>
                  <div className="grid grid-cols-1 gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={preferenceFilter.includes("approval_required")}
                        onCheckedChange={() => handlePreferenceToggle("approval_required")}
                      />
                      <span>Approval required</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={preferenceFilter.includes("no_approval")}
                        onCheckedChange={() => handlePreferenceToggle("no_approval")}
                      />
                      <span>No approval needed</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={preferenceFilter.includes("exclusivity")}
                        onCheckedChange={() => handlePreferenceToggle("exclusivity")}
                      />
                      <span>Exclusivity allowed</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">Monthly amount range</p>
                    <Badge variant="outline">${amountRange[0].toLocaleString()} - ${amountRange[1].toLocaleString()}</Badge>
                  </div>
                  <Slider
                    value={amountRange}
                    min={0}
                    max={10000}
                    step={250}
                    onValueChange={(value) => setAmountRange(value as number[])}
                  />
                  <p className="text-xs text-muted-foreground">Transparent pricing shows gross amounts before fees.</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Niche</p>
                  <Select value={nicheFilter} onValueChange={setNicheFilter}>
                    <SelectTrigger data-testid="select-niche-filter">
                      <SelectValue placeholder="All niches" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All niches</SelectItem>
                      {uniqueNiches.map((niche) => (
                        <SelectItem key={niche} value={niche}>
                          {niche}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <p className="text-sm font-medium text-muted-foreground pt-2">Quick minimum budget</p>
                  <Select value={budgetFilter} onValueChange={setBudgetFilter}>
                    <SelectTrigger data-testid="select-budget-filter">
                      <SelectValue placeholder="All budgets" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All budgets</SelectItem>
                      <SelectItem value="500">$500+</SelectItem>
                      <SelectItem value="1000">$1,000+</SelectItem>
                      <SelectItem value="2500">$2,500+</SelectItem>
                      <SelectItem value="5000">$5,000+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {filtersApplied && (
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSearchTerm("");
                      setPlatformFilter("all");
                      setBudgetFilter("all");
                      setNicheFilter("all");
                      setDurationFilter("all");
                      setPreferenceFilter([]);
                      setAmountRange([0, 10000]);
                    }}
                    data-testid="button-clear-retainer-filters"
                  >
                    Clear filters
                  </Button>
                </div>
              )}
            </CardContent>
            )}
          </Card>

          {filteredContracts.length === 0 ? (
            <Card className="border-card-border">
              <CardContent className="p-12 text-center space-y-2">
                <Briefcase className="h-12 w-12 text-muted-foreground/50 mx-auto" />
                <h3 className="font-semibold">No retainer contracts match your filters</h3>
                <p className="text-muted-foreground">Try adjusting your search or filter selections to discover more opportunities.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {filteredContracts.map((contract: any) => {
                const applicationStatus = getApplicationStatus(contract.id);
                const StatusIcon = applicationStatus.icon;
                const monthlyAmount = Number(contract.monthlyAmount || 0);
                const perVideo = contract.videosPerMonth ? monthlyAmount / Number(contract.videosPerMonth) : monthlyAmount;
                const tierOptions = Array.isArray(contract.retainerTiers) && contract.retainerTiers.length > 0
                  ? contract.retainerTiers
                  : [
                      {
                        name: "Standard",
                        monthlyAmount: monthlyAmount,
                        videosPerMonth: contract.videosPerMonth,
                        durationMonths: contract.durationMonths,
                      },
                    ];
                const bestValueTier = tierOptions.reduce((prev: any, current: any) => {
                  const prevRate = Number(prev.monthlyAmount || 0) / Math.max(1, Number(prev.videosPerMonth || 1));
                  const currentRate = Number(current.monthlyAmount || 0) / Math.max(1, Number(current.videosPerMonth || 1));
                  return currentRate < prevRate ? current : prev;
                }, tierOptions[0]);
                const isPriority = monthlyAmount >= 5000 || contract.exclusivityRequired;
                const isTrending = (contract.retainerTiers?.length || 0) >= 3 || monthlyAmount >= 3000;

                return (
                  <Link key={contract.id} href={`/retainers/${contract.id}`}>
                    <Card
                      className="group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-visible h-full ring-2 ring-purple-400/50 hover:ring-purple-500 hover:shadow-purple-500/20"
                      data-testid={`retainer-card-${contract.id}`}
                    >
                      {/* Thumbnail Container with Logo */}
                      <div className="relative">
                        {/* Gradient Background */}
                        <div className="aspect-video relative overflow-hidden rounded-t-lg bg-gradient-to-br from-purple-100 via-violet-100 to-indigo-100">
                          {/* Favorite button - Top Left */}
                          <button
                            className="absolute top-3 left-3 rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-md backdrop-blur-sm"
                            style={{
                              width: '36px',
                              height: '36px',
                              backgroundColor: 'rgba(255, 255, 255, 0.95)',
                              border: 'none',
                              cursor: 'pointer',
                              zIndex: 10
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              toggleFavorite(contract.id);
                            }}
                            data-testid={`button-favorite-${contract.id}`}
                          >
                            <Heart className={`h-5 w-5 transition-all ${favoriteContracts.has(contract.id) ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
                          </button>

                          {/* Category Badge - Top Right */}
                          {(isPriority || isTrending) && (
                            <div className={`absolute top-0 right-0 ${isPriority ? 'bg-red-500' : 'bg-amber-500'} text-white px-3 py-1.5 rounded-bl-lg shadow-lg font-bold text-xs tracking-wide`}>
                              {isPriority ? 'PRIORITY' : isTrending ? 'TRENDING' : 'RETAINER'}
                            </div>
                          )}
                        </div>

                        {/* Company Logo - Positioned outside thumbnail but inside wrapper */}
                        {contract.company?.logoUrl && (
                          <div className="absolute -bottom-6 sm:-bottom-7 left-3 sm:left-4 h-12 w-12 sm:h-14 sm:w-14 rounded-lg sm:rounded-xl overflow-hidden bg-white shadow-lg border-2 border-background z-20">
                            <img
                              src={contract.company.logoUrl}
                              alt={contract.company.tradeName}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        )}
                      </div>

                      <CardContent className="p-4 sm:p-5 pt-7 sm:pt-8 space-y-2 sm:space-y-3">
                        {/* Title */}
                        <h3 className="font-semibold text-sm sm:text-base line-clamp-2 text-foreground leading-snug" data-testid={`text-retainer-title-${contract.id}`}>
                          {contract.title}
                        </h3>

                        {/* Company Name */}
                        {contract.company?.tradeName && (
                          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1">
                            {contract.company.tradeName}
                          </p>
                        )}

                        {/* Hashtag Badges */}
                        <div className="flex flex-wrap gap-1 sm:gap-1.5">
                          {contract.niches && contract.niches.slice(0, 2).map((niche: string, index: number) => (
                            <Badge key={index} variant="secondary" className="text-[10px] sm:text-xs font-normal">
                              #{niche}
                            </Badge>
                          ))}
                        </div>

                        {/* Commission and Stats */}
                        <div className="flex items-end justify-between pt-1 sm:pt-2">
                          <div>
                            <div className="text-xl sm:text-2xl font-bold text-purple-600 group-hover:text-purple-700 transition-colors">
                              ${monthlyAmount.toLocaleString()}
                            </div>
                            <div className="text-[10px] sm:text-xs text-purple-600/70 font-medium">
                              per month
                            </div>
                          </div>

                          {/* Active creators */}
                          <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                            <UsersIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                            <span className="hidden xs:inline">{contract.activeCreators || 0} active</span>
                            <span className="xs:hidden">{contract.activeCreators || 0}</span>
                          </div>
                        </div>

                        {/* Application Status */}
                        {applicationStatus.badge && (
                          <div className="pt-2 sm:pt-3 border-t mt-2 sm:mt-3">
                            <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={
                                    applicationStatus.variant === "default" && applicationStatus.badge.includes("Approved")
                                      ? "default"
                                      : applicationStatus.variant === "destructive"
                                      ? "destructive"
                                      : "secondary"
                                  }
                                  className={`text-xs ${applicationStatus.badge.includes("Approved") ? "bg-green-500 hover:bg-green-600" : ""}`}
                                >
                                  {applicationStatus.badge}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl sm:max-w-5xl lg:max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review details & apply</DialogTitle>
            <DialogDescription>
              Transparent pricing, clear commitments, and quick approvals for {selectedContract?.title}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid lg:grid-cols-[1.6fr_1fr] gap-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div className="rounded-md border p-3">
                      <p className="text-muted-foreground">Rating</p>
                      <p className="font-semibold flex items-center gap-1"><Star className="h-4 w-4 text-yellow-500" />
                        {selectedContract?.company?.rating || "New"}
                      </p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-muted-foreground">Active creators</p>
                      <p className="font-semibold">{selectedContract?.activeCreators || 0}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-muted-foreground">Contract length</p>
                      <p className="font-semibold">{selectedContract?.durationMonths} months</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-muted-foreground">Approvals</p>
                      <p className="font-semibold">{selectedContract?.contentApprovalRequired ? "Required" : "Auto-post"}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Choose your tier</p>
                      <Badge variant="outline">Transparent pricing</Badge>
                    </div>
                    <FormField
                      control={form.control}
                      name="selectedTierId"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <RadioGroup
                              value={field.value}
                              onValueChange={field.onChange}
                              className="grid gap-3 md:grid-cols-2"
                            >
                              {selectedTierOptions.map((tier: any, index: number) => {
                                const tierNet = Number(tier.monthlyAmount || 0) * 0.93;
                                const tierPerVideo =
                                  Number(tier.monthlyAmount || 0) / Math.max(1, Number(tier.videosPerMonth || 1));
                                const tierId = (tier.name || tier.id || index).toString();

                                return (
                                  <label
                                    key={tierId}
                                    className="flex gap-3 rounded-lg border bg-muted/40 p-3 hover:border-primary cursor-pointer"
                                  >
                                    <RadioGroupItem value={tierId} />
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <p className="font-semibold">{tier.name || `Tier ${index + 1}`}</p>
                                        {tier.name === activeTier?.name && (
                                          <Badge className="bg-primary/10 text-primary" variant="outline">
                                            Selected
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-sm text-muted-foreground">
                                        ${Number(tier.monthlyAmount || 0).toLocaleString()} / mo • {tier.videosPerMonth} videos • {tier.durationMonths} months
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        ${tierPerVideo.toFixed(2)} per video • Net ${tierNet.toLocaleString()} after 7% fee
                                      </p>
                                    </div>
                                  </label>
                                );
                              })}
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Requirements</p>
                    <div className="grid sm:grid-cols-2 gap-3 text-sm">
                      <div className="rounded-md border p-3 space-y-1">
                        <p className="font-semibold">Video length</p>
                        <p className="text-muted-foreground">
                          {selectedContract?.minimumVideoLengthSeconds
                            ? `${selectedContract.minimumVideoLengthSeconds}s minimum`
                            : "Short-form friendly"}
                        </p>
                      </div>
                      <div className="rounded-md border p-3 space-y-1">
                        <p className="font-semibold">Posting cadence</p>
                        <p className="text-muted-foreground">{selectedContract?.postingSchedule || "Flexible schedule"}</p>
                      </div>
                      <div className="rounded-md border p-3 space-y-1">
                        <p className="font-semibold">Approvals</p>
                        <p className="text-muted-foreground">
                          {selectedContract?.contentApprovalRequired
                            ? "Company approves before posting"
                            : "Auto-approval after 7 minutes"}
                        </p>
                      </div>
                      <div className="rounded-md border p-3 space-y-1">
                        <p className="font-semibold">Exclusivity</p>
                        <p className="text-muted-foreground">
                          {selectedContract?.exclusivityRequired ? "Exclusivity expected" : "You can work with others"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Example videos</p>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {(selectedContract?.exampleVideos?.length
                        ? selectedContract.exampleVideos
                        : Array.from({ length: 6 }, (_, index) => ({
                            title: `Example video ${index + 1}`,
                            platform: selectedContract?.requiredPlatform || "Preferred platform",
                          }))
                      ).map((example: any, index: number) => (
                        <div key={`example-${index}`} className="rounded-lg border bg-muted/30 p-3 space-y-1">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{example.platform}</span>
                            <span>{selectedContract?.minimumVideoLengthSeconds || 45}s</span>
                          </div>
                          <p className="font-semibold text-sm">{example.title || "Creator example"}</p>
                          <p className="text-xs text-muted-foreground">Demonstrates tone and pacing the company loves.</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 rounded-lg border bg-muted/40 p-4">
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-base">Why are you interested?</FormLabel>
                    <span className={`text-xs ${messageChars > 500 ? "text-red-500" : "text-muted-foreground"}`}>
                      {messageChars}/500
                    </span>
                  </div>
                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            placeholder="Share your niche, experience, and why this brand is a great fit."
                            rows={5}
                            data-testid="input-application-message"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="portfolioLinks"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Portfolio Links (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://tiktok.com/@yourprofile, https://instagram.com/yourprofile"
                            data-testid="input-portfolio-links"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Comma-separated URLs to your social profiles
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="proposedStartDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Proposed Start Date (Optional)</FormLabel>
                        <FormControl>
                          <Input type="date" data-testid="input-start-date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="acceptTerms"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <div className="flex items-start gap-2 rounded-md border bg-background p-3">
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          <div className="space-y-1 text-sm">
                            <FormLabel className="text-sm">I understand the deliverables</FormLabel>
                            <p className="text-muted-foreground text-xs">
                              {selectedContract?.videosPerMonth} videos per month for {selectedContract?.durationMonths} months, following the posted schedule and approval requirements.
                            </p>
                          </div>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                    <div className="flex items-center gap-2 font-semibold">
                      <Info className="h-4 w-4" />  We’ll review your application right away.
                    </div>
                    <p className="text-xs mt-1">
                    </p>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 bg-background/95 pt-4 border-t flex flex-col gap-3 md:flex-row md:items-center md:justify-between backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div className="space-y-1 text-sm">
                  <p className="font-semibold flex items-center gap-2">
                    Selected tier {activeTier?.name || "Standard"}
                    <Badge variant="secondary">${Number(activeTier?.monthlyAmount || 0).toLocaleString()} / mo</Badge>
                  </p>
                  <p className="text-muted-foreground text-xs">
                    ${selectedTierPerVideo.toFixed(2)} per video • Net ${selectedTierNet.toLocaleString()} after fees
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setOpen(false);
                      setSelectedContract(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={applyMutation.isPending} data-testid="button-submit-application">
                    {applyMutation.isPending ? "Submitting..." : "Submit application"}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Video Platform Requirement Dialog */}
      <AlertDialog open={showVideoPlatformDialog} onOpenChange={setShowVideoPlatformDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-6 w-6" />
              Video Platform Required
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-2">
              <p className="text-base font-semibold text-foreground">
                You must add at least one video platform to your profile before applying to retainer contracts.
              </p>
              <p className="text-sm">
                We only accept <strong>video content creators</strong> with an active presence on:
              </p>
              <ul className="list-disc list-inside space-y-1.5 ml-2 text-sm">
                <li><strong>YouTube</strong> - Video channels</li>
                <li><strong>TikTok</strong> - Short-form video content</li>
                <li><strong>Instagram</strong> - Reels and video content</li>
              </ul>
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-4">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>💡 Next Step:</strong> Add your video platform URL in your profile settings, then come back to apply!
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogAction
              onClick={() => {
                setShowVideoPlatformDialog(false);
                setLocation("/settings");
              }}
              className="w-full sm:w-auto"
            >
              Go to Settings
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}