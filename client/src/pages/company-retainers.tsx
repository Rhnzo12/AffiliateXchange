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
  DialogTrigger,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, DollarSign, Video, Calendar, Users } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";

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
});

type CreateRetainerForm = z.infer<typeof createRetainerSchema>;

export default function CompanyRetainers() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { data: contracts, isLoading } = useQuery<any[]>({
    queryKey: ["/api/company/retainer-contracts"],
  });

  const form = useForm<CreateRetainerForm>({
    resolver: zodResolver(createRetainerSchema),
    defaultValues: {
      title: "",
      description: "",
      monthlyAmount: "",
      videosPerMonth: "",
      durationMonths: "",
      requiredPlatform: "",
      platformAccountDetails: "",
      contentGuidelines: "",
      brandSafetyRequirements: "",
      minimumFollowers: "",
      niches: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateRetainerForm) => {
      const payload = {
        ...data,
        monthlyAmount: data.monthlyAmount,
        videosPerMonth: parseInt(data.videosPerMonth),
        durationMonths: parseInt(data.durationMonths),
        minimumFollowers: data.minimumFollowers ? parseInt(data.minimumFollowers) : undefined,
        niches: data.niches ? data.niches.split(",").map((n) => n.trim()).filter(Boolean) : [],
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
      toast({
        title: "Error Creating Contract",
        description: String(errorMessage),
        variant: "destructive",
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
        <div>
          <h1 className="text-3xl font-bold">Monthly Retainers</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-company-retainers">
            Monthly Retainers
          </h1>
          <p className="text-muted-foreground">
            Hire creators for ongoing monthly video production
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
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
                          <Input
                            type="number"
                            placeholder="3"
                            data-testid="input-retainer-duration"
                            {...field}
                          />
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

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
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
      </div>

      {contracts && contracts.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="p-12 text-center">
            <DollarSign className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No Retainer Contracts</h3>
            <p className="text-muted-foreground mb-4">
              Create your first monthly retainer contract to hire creators for ongoing video production
            </p>
            <Button onClick={() => setOpen(true)} data-testid="button-create-first-retainer">
              <Plus className="h-4 w-4 mr-2" />
              Create Retainer
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {contracts?.map((contract: any) => (
            <Card
              key={contract.id}
              className="hover-elevate border-card-border"
              data-testid={`retainer-card-${contract.id}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-xl" data-testid={`text-retainer-title-${contract.id}`}>
                        {contract.title}
                      </CardTitle>
                      <Badge variant={getStatusBadgeVariant(contract.status)}>
                        {contract.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground line-clamp-2">
                      {contract.description}
                    </p>
                  </div>
                  <Link href={`/company/retainers/${contract.id}`}>
                    <Button variant="outline" data-testid={`button-view-retainer-${contract.id}`}>
                      View Details
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Monthly Payment</p>
                      <p className="font-semibold">${parseFloat(contract.monthlyAmount).toLocaleString()}</p>
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
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Platform</p>
                      <p className="font-semibold">{contract.requiredPlatform}</p>
                    </div>
                  </div>
                </div>

                {contract.applicationCount > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      <strong>{contract.applicationCount}</strong> creator{contract.applicationCount === 1 ? "" : "s"} applied
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
