import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DollarSign, Video, Calendar, Briefcase, Send, CheckCircle, XCircle, Clock } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";

const applyRetainerSchema = z.object({
  message: z.string().min(20, "Message must be at least 20 characters"),
  portfolioLinks: z.string().optional(),
  proposedStartDate: z.string().optional(),
});

type ApplyRetainerForm = z.infer<typeof applyRetainerSchema>;

export default function CreatorRetainers() {
  const { toast } = useToast();
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [open, setOpen] = useState(false);

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

  // Check if user can apply (no application or rejected)
  const canApply = (contractId: string) => {
    const application = getApplication(contractId);
    if (!application) return true;
    // Can reapply if rejected
    return application.status === 'rejected';
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Monthly Retainers</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
        <div className="grid gap-6">
          {contracts?.map((contract: any) => {
            const applicationStatus = getApplicationStatus(contract.id);
            const allowApply = canApply(contract.id);
            const StatusIcon = applicationStatus.icon;
            
            return (
              <Card
                key={contract.id}
                className="hover-elevate border-card-border"
                data-testid={`retainer-card-${contract.id}`}
              >
                <CardHeader>
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
                      <p className="text-muted-foreground line-clamp-3">
                        {contract.description}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <DollarSign className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Monthly Payment</p>
                        <p className="font-semibold">
                          ${parseFloat(contract.monthlyAmount).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <Video className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Videos/Month</p>
                        <p className="font-semibold">{contract.videosPerMonth}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <Calendar className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Duration</p>
                        <p className="font-semibold">{contract.durationMonths} months</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
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

                  <div className="flex gap-2 pt-2">
                    <Link href={`/retainers/${contract.id}`} className="flex-1">
                      <Button
                        variant="outline"
                        className="w-full"
                        data-testid={`button-view-details-${contract.id}`}
                      >
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
                      className={`flex-1 ${
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
    </div>
  );
}