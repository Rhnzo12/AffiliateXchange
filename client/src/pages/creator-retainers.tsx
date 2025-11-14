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
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { DollarSign, Video, Calendar, Briefcase, Send, CheckCircle, Clock, Eye, AlertTriangle, Search } from "lucide-react";
import { useMemo, useState } from "react";
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

const applyRetainerSchema = z.object({
  message: z.string().min(20, "Message must be at least 20 characters"),
  portfolioLinks: z.string().optional(),
  proposedStartDate: z.string().optional(),
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

      const matchesNiche =
        nicheFilter === "all" || (Array.isArray(contract.niches) && contract.niches.some((n: string) => n === nicheFilter));

      return matchesSearch && matchesPlatform && matchesBudget && matchesNiche;
    });
  }, [contracts, searchTerm, platformFilter, budgetFilter, nicheFilter]);

  const filtersApplied =
    searchTerm.trim() !== "" || platformFilter !== "all" || budgetFilter !== "all" || nicheFilter !== "all";

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
              <CardTitle className="text-lg">Search & Filter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  <p className="text-sm font-medium text-muted-foreground">Minimum Monthly Budget</p>
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
                    }}
                    data-testid="button-clear-retainer-filters"
                  >
                    Clear filters
                  </Button>
                </div>
              )}
            </CardContent>
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

                return (
              <Card
                key={contract.id}
                className="group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-card-border cursor-pointer ring-2 ring-primary/30 hover:ring-primary/50 hover:shadow-primary/20"
                data-testid={`retainer-card-${contract.id}`}
              >
                <CardHeader className="pb-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <CardTitle className="text-xl" data-testid={`text-retainer-title-${contract.id}`}>
                            {contract.title}
                          </CardTitle>
                          {applicationStatus.badge && (
                            <Badge
                              variant={
                                applicationStatus.variant === 'default' && applicationStatus.badge.includes('Approved')
                                  ? 'default'
                                  : applicationStatus.variant === 'destructive'
                                  ? 'destructive'
                                  : 'secondary'
                              }
                              className={
                                applicationStatus.badge.includes('Approved')
                                  ? 'bg-green-500 hover:bg-green-600'
                                  : ''
                              }
                            >
                              {applicationStatus.badge}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          by {contract.company?.tradeName || contract.company?.legalName || "Company"}
                        </p>
                      </div>
                    </div>
                    <p className="text-muted-foreground line-clamp-2 leading-relaxed">
                      {contract.description}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-primary/5 transition-colors duration-200">
                      <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                        <DollarSign className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Monthly Payment</p>
                        <p className="font-semibold">
                          ${parseFloat(contract.monthlyAmount).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-primary/5 transition-colors duration-200">
                      <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                        <Video className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Videos/Month</p>
                        <p className="font-semibold">{contract.videosPerMonth}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-primary/5 transition-colors duration-200">
                      <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                        <Calendar className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Duration</p>
                        <p className="font-semibold">{contract.durationMonths} months</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-primary/5 transition-colors duration-200">
                      <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                        <Briefcase className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Platform</p>
                        <p className="font-semibold">{contract.requiredPlatform}</p>
                      </div>
                    </div>
                  </div>

                  {contract.contentGuidelines && (
                    <div className="pt-4 border-t">
                      <h4 className="font-semibold text-sm mb-2">Content Guidelines</h4>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {contract.contentGuidelines}
                      </p>
                    </div>
                  )}

                  {contract.niches && contract.niches.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {contract.niches.map((niche: string, index: number) => (
                        <Badge key={index} variant="outline">
                          {niche}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Link href={`/retainers/${contract.id}`} className="flex-1">
                      <Button
                        variant="outline"
                        className="w-full group/btn hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-200 font-medium"
                        data-testid={`button-view-details-${contract.id}`}
                      >
                        <Eye className="h-4 w-4 mr-2 group-hover/btn:scale-110 transition-transform duration-200" />
                        View Details
                      </Button>
                    </Link>
                    <Button
                      onClick={() => {
                        setSelectedContract(contract);
                        setOpen(true);
                      }}
                      variant={
                        applicationStatus.badge?.includes('Approved')
                          ? 'default'
                          : applicationStatus.variant === 'destructive'
                          ? 'destructive'
                          : 'default'
                      }
                      className={`flex-1 font-medium ${
                        applicationStatus.badge?.includes('Approved')
                          ? 'bg-green-500 hover:bg-green-600'
                          : ''
                      }`}
                      disabled={applicationStatus.disabled}
                      data-testid={`button-apply-${contract.id}`}
                    >
                      <StatusIcon className="h-4 w-4 mr-2" />
                      {applicationStatus.buttonText}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
              })}
            </div>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Apply for Retainer Contract</DialogTitle>
            <DialogDescription>
              Submit your application for: {selectedContract?.title}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cover Message</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Introduce yourself and explain why you're a great fit for this retainer..."
                        rows={6}
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
                      <Input
                        type="date"
                        data-testid="input-start-date"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
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
                <Button
                  type="submit"
                  disabled={applyMutation.isPending}
                  data-testid="button-submit-application"
                >
                  {applyMutation.isPending ? "Submitting..." : "Submit Application"}
                </Button>
              </DialogFooter>
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