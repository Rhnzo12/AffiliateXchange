import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { useToast } from "../hooks/use-toast";
import { apiRequest, queryClient } from "../lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
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
import { Checkbox } from "../components/ui/checkbox";
import {
  DollarSign,
  Video,
  Calendar,
  ArrowLeft,
  Upload,
  Play,
  ExternalLink,
  Gift,
  ShieldCheck,
  Clock3,
  Info,
  CheckCircle2,
  Send,
  Star,
  Briefcase,
  Users,
  Tag,
  Bookmark,
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../hooks/useAuth";
import { VideoPlayer } from "../components/VideoPlayer";
import { useSidebar } from "../components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import { uploadToCloudinary } from "../lib/cloudinary-upload";
import { useCreatorPageTour } from "../components/CreatorTour";
import { CREATOR_TOUR_IDS, retainerDetailTourSteps } from "../lib/creatorTourConfig";
import { PlatformBadge } from "../lib/platform-icons";

const uploadDeliverableSchema = z.object({
  platformUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  monthNumber: z.string().min(1, "Month number is required"),
  videoNumber: z.string().min(1, "Video number is required"),
});

type UploadDeliverableForm = z.infer<typeof uploadDeliverableSchema>;

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

export default function CreatorRetainerDetail() {
  const [, params] = useRoute("/retainers/:id");
  const { toast} = useToast();
  const { user } = useAuth();
  const { state: sidebarState, isMobile } = useSidebar();
  const contractId = params?.id;
  const [open, setOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [resubmitOpen, setResubmitOpen] = useState(false);
  const [selectedDeliverable, setSelectedDeliverable] = useState<any>(null);
  const [resubmitVideoUrl, setResubmitVideoUrl] = useState("");
  const [isResubmitUploading, setIsResubmitUploading] = useState(false);
  const resubmitVideoInputRef = useRef<HTMLInputElement>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);

  // Quick tour for retainer detail page
  useCreatorPageTour(CREATOR_TOUR_IDS.RETAINER_DETAIL, retainerDetailTourSteps);

  const { data: contract, isLoading } = useQuery<any>({
    queryKey: [`/api/retainer-contracts/${contractId}`],
    enabled: !!contractId,
  });

  const { data: myApplication } = useQuery<any>({
    queryKey: ["/api/creator/retainer-applications"],
  });

  const { data: deliverables } = useQuery<any[]>({
    queryKey: [`/api/retainer-contracts/${contractId}/deliverables`],
    enabled: !!contractId && myApplication?.some((app: any) => app.contractId === contractId && app.status === "approved"),
  });

  // Fetch platform fee settings
  const { data: feeSettings } = useQuery<{
    platformFeePercentage: number;
    stripeFeePercentage: number;
    totalFeePercentage: number;
    totalFeeDisplay: string;
  }>({
    queryKey: ["/api/platform/fees"],
  });

  const form = useForm<UploadDeliverableForm>({
    resolver: zodResolver(uploadDeliverableSchema),
    defaultValues: {
      platformUrl: "",
      title: "",
      description: "",
      monthNumber: "1",
      videoNumber: "1",
    },
  });

  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (max 500MB)
    if (file.size > 500 * 1024 * 1024) {
      setErrorDialog({
        title: "File Too Large",
        message: "Video file must be less than 500MB",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Use contract ID and creator ID for organized folder structure
      const folder = contractId && user?.id
        ? `creatorlink/retainer/${contractId}/${user.id}`
        : user?.id
        ? `creatorlink/retainer/${user.id}`
        : "creatorlink/retainer";

      // Get Cloudinary upload parameters
      const uploadResponse = await fetch("/api/objects/upload", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folder,
          resourceType: "video",
          contentType: file.type,
          fileName: file.name,
        }), // Save retainer videos in contract-specific folder
      });
      const uploadData = await uploadResponse.json();

      console.log('[Retainer Upload] Upload parameters received:', uploadData);

      const uploadResult = await uploadToCloudinary(uploadData, file);

      if (uploadResult?.secure_url) {
        const uploadedVideoUrl = uploadResult.secure_url;
        console.log('[Retainer Upload] Final video URL:', uploadedVideoUrl);

        setVideoUrl(uploadedVideoUrl);
        setIsUploading(false);

        toast({
          title: "Success!",
          description: "Video uploaded successfully. Fill in the details below.",
        });
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      console.error("Video upload error:", error);
      setIsUploading(false);
      setErrorDialog({
        title: "Upload Failed",
        message: "Failed to upload video. Please try again.",
      });
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async (data: UploadDeliverableForm) => {
      if (!videoUrl) {
        throw new Error("Please upload a video file first");
      }
      const payload = {
        contractId,
        monthNumber: parseInt(data.monthNumber),
        videoNumber: parseInt(data.videoNumber),
        videoUrl: videoUrl,
        platformUrl: data.platformUrl || undefined,
        title: data.title,
        description: data.description || undefined,
      };
      return await apiRequest("POST", "/api/creator/retainer-deliverables", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/retainer-contracts/${contractId}/deliverables`] });
      queryClient.invalidateQueries({ queryKey: ["/api/retainer-contracts"] });
      toast({
        title: "Deliverable Submitted",
        description: "Your video has been submitted for review.",
      });
      setOpen(false);
      form.reset();
      setVideoUrl("");
    },
    onError: (error: Error) => {
      setErrorDialog({
        title: "Error",
        message: error.message || "Failed to submit deliverable",
      });
    },
  });

  const onSubmit = (data: UploadDeliverableForm) => {
    uploadMutation.mutate(data);
  };

  const resubmitForm = useForm<UploadDeliverableForm>({
    resolver: zodResolver(uploadDeliverableSchema),
  });

  const applyForm = useForm<ApplyRetainerForm>({
    resolver: zodResolver(applyRetainerSchema),
    defaultValues: {
      message: "",
      portfolioLinks: "",
      proposedStartDate: "",
      selectedTierId: "",
      acceptTerms: false,
    },
  });

  const handleResubmitVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsResubmitUploading(true);

    try {
      // Use contract ID and creator ID for organized folder structure
      const folder = contractId && user?.id
        ? `creatorlink/retainer/${contractId}/${user.id}`
        : user?.id
        ? `creatorlink/retainer/${user.id}`
        : "creatorlink/retainer";

      // Get Cloudinary upload parameters
      const uploadResponse = await fetch("/api/objects/upload", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ folder, resourceType: "video" }),
      });
      const uploadData = await uploadResponse.json();

      console.log('[Resubmit Upload] Upload parameters received:', uploadData);

      // Create FormData for Cloudinary upload
      const formData = new FormData();
      formData.append('file', file);

      // Add Cloudinary parameters
      if (uploadData.uploadPreset) {
        formData.append('upload_preset', uploadData.uploadPreset);
      } else if (uploadData.signature) {
        formData.append('signature', uploadData.signature);
        formData.append('timestamp', uploadData.timestamp.toString());
        formData.append('api_key', uploadData.apiKey);
      }

      if (uploadData.folder) {
        formData.append('folder', uploadData.folder);
        console.log('[Resubmit Upload] Folder parameter set to:', uploadData.folder);
      }

      console.log('[Resubmit Upload] FormData entries:', Array.from(formData.entries()));

      // Upload video to Cloudinary
      const uploadResult = await fetch(uploadData.uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (uploadResult.ok) {
        const cloudinaryResponse = await uploadResult.json();
        console.log('[Resubmit Upload] Cloudinary response:', cloudinaryResponse);
        const uploadedVideoUrl = cloudinaryResponse.secure_url;
        console.log('[Resubmit Upload] Final video URL:', uploadedVideoUrl);

        setResubmitVideoUrl(uploadedVideoUrl);
        setIsResubmitUploading(false);

        toast({
          title: "Success!",
          description: "Video uploaded successfully. Fill in the rest of the form to resubmit.",
        });
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      console.error("Video upload error:", error);
      setIsResubmitUploading(false);
      setErrorDialog({
        title: "Upload Failed",
        message: "Failed to upload video. Please try again.",
      });
    }
  };

  const resubmitMutation = useMutation({
    mutationFn: async (data: UploadDeliverableForm) => {
      if (!resubmitVideoUrl) {
        throw new Error("Please upload a video file first");
      }
      if (!selectedDeliverable) {
        throw new Error("No deliverable selected");
      }
      const payload = {
        videoUrl: resubmitVideoUrl,
        platformUrl: data.platformUrl || undefined,
        title: data.title,
        description: data.description || undefined,
      };
      return await apiRequest("PATCH", `/api/creator/retainer-deliverables/${selectedDeliverable.id}/resubmit`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/retainer-contracts/${contractId}/deliverables`] });
      queryClient.invalidateQueries({ queryKey: ["/api/retainer-contracts"] });
      toast({
        title: "Revision Submitted",
        description: "Your revised video has been submitted for review.",
      });
      setResubmitOpen(false);
      resubmitForm.reset();
      setResubmitVideoUrl("");
      setSelectedDeliverable(null);
    },
    onError: (error: Error) => {
      setErrorDialog({
        title: "Error",
        message: error.message || "Failed to resubmit deliverable",
      });
    },
  });

  const onResubmit = (data: UploadDeliverableForm) => {
    resubmitMutation.mutate(data);
  };

  const handleResubmitClick = (deliverable: any) => {
    setSelectedDeliverable(deliverable);
    resubmitForm.reset({
      title: deliverable.title,
      description: deliverable.description || "",
      platformUrl: deliverable.platformUrl || "",
      monthNumber: deliverable.monthNumber.toString(),
      videoNumber: deliverable.videoNumber.toString(),
    });
    setResubmitOpen(true);
  };

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
      return await apiRequest("POST", `/api/creator/retainer-contracts/${contractId}/apply`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/creator/retainer-applications"] });
      toast({
        title: "Application Submitted!",
        description: "Your application has been sent. The company will review it soon.",
      });
      setApplyOpen(false);
      applyForm.reset();
    },
    onError: (error: Error) => {
      setErrorDialog({
        title: "Application Failed",
        message: error.message || "Failed to submit application",
      });
    },
  });

  const onApplySubmit = (data: ApplyRetainerForm) => {
    applyMutation.mutate(data);
  };

  if (isLoading) {
    return <div className="space-y-6">Loading...</div>;
  }

  if (!contract) {
    return <div className="space-y-6">Contract not found</div>;
  }

  const currentApplication = myApplication?.find((app: any) => app.contractId === contractId);
  const isApproved = currentApplication?.status === "approved";
  const isPending = currentApplication?.status === "pending";

  const contractMonthlyAmount = Number(contract.monthlyAmount) || 0;
  const contractVideosPerMonth = Math.max(1, Number(contract.videosPerMonth) || 1);
  const basePerVideo = contractMonthlyAmount / contractVideosPerMonth;
  // Use dynamic fee from platform settings, fallback to 7% if not loaded
  const totalFeePercentage = feeSettings?.totalFeePercentage ?? 0.07;
  const totalFeeDisplay = feeSettings?.totalFeeDisplay ?? "7%";
  const platformFee = contractMonthlyAmount * totalFeePercentage;
  const creatorTakeHome = Math.max(contractMonthlyAmount - platformFee, 0);
  const hasRetainerTiers = Array.isArray(contract.retainerTiers) && contract.retainerTiers.length > 0;

  const formatCurrency = (value: number, options?: Intl.NumberFormatOptions) =>
    value.toLocaleString("en-CA", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      ...options,
      style: "currency",
      currency: "CAD",
    });

  const formatSecondsToMinutes = (seconds?: number) => {
    if (!seconds) return undefined;
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} min${minutes !== 1 ? "s" : ""}`;
  };

  const calculatePerVideoCost = (monthlyAmount: number, videosPerMonth: number) => {
    const safeVideos = Math.max(1, Number(videosPerMonth) || 1);
    return monthlyAmount / safeVideos;
  };

  const tierSummaries = (contract.retainerTiers || []).map((tier: any) => {
    const monthlyAmount = Number(tier.monthlyAmount) || 0;
    const videosPerMonth = Math.max(1, Number(tier.videosPerMonth) || 1);
    return {
      ...tier,
      monthlyAmount,
      videosPerMonth,
      perVideoCost: calculatePerVideoCost(monthlyAmount, videosPerMonth),
    };
  });

  const bestValueTier = tierSummaries.length > 0
    ? tierSummaries.reduce((best: any, tier: any) => {
        if (tier.perVideoCost < best.perVideoCost) {
          return tier;
        }
        return best;
      })
    : null;

  const getValidationBadge = (label: string, isValid: boolean) => (
    <Badge variant={isValid ? "outline" : "destructive"} className="gap-1">
      {isValid ? <CheckCircle2 className="h-3 w-3" /> : <Info className="h-3 w-3" />}
      {label}
    </Badge>
  );

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "pending_review":
        return "default";
      case "approved":
        return "outline";
      case "revision_requested":
        return "secondary";
      case "rejected":
        return "destructive";
      default:
        return "secondary";
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/retainers">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-semibold" data-testid="heading-contract-title">
          {contract.title}
        </h1>
        {currentApplication && (
          <Badge variant={isApproved ? "outline" : isPending ? "default" : "destructive"}>
            {currentApplication.status}
          </Badge>
        )}
      </div>

      {/* Submit Video Dialog for Approved Creators */}
      {isApproved && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-submit-deliverable" className="mb-4">
              <Upload className="h-4 w-4 mr-2" />
              Submit Video
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Submit Deliverable</DialogTitle>
              <DialogDescription>
                Upload a new video for this retainer contract
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="monthNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Month Number</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            data-testid="input-month-number"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="videoNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Video Number</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            data-testid="input-video-number"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Within this month
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Video Title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter video title"
                          data-testid="input-video-title"
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
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Add any notes about this video"
                          rows={3}
                          data-testid="input-description"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <label htmlFor="video-upload" className="block text-sm font-medium mb-2">
                    Video File
                  </label>
                  <input
                    type="file"
                    id="video-upload"
                    ref={videoInputRef}
                    accept="video/*"
                    onChange={handleVideoUpload}
                    disabled={isUploading}
                    className="hidden"
                    aria-label="Upload video file"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => videoInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full"
                  >
                    {isUploading ? (
                      <>
                        <Upload className="h-4 w-4 mr-2 animate-pulse" />
                        Uploading...
                      </>
                    ) : videoUrl ? (
                      <>
                        <Video className="h-4 w-4 mr-2" />
                        Video Uploaded
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Choose Video File
                      </>
                    )}
                  </Button>
                  {videoUrl && (
                    <p className="text-xs text-green-600">
                      Video uploaded successfully
                    </p>
                  )}
                  {!videoUrl && (
                    <p className="text-xs text-muted-foreground">
                      Select your video file (max 500MB)
                    </p>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="platformUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Platform URL (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://tiktok.com/@brand/video/..."
                          data-testid="input-platform-url"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Link to the video on {contract.requiredPlatform}
                      </FormDescription>
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
                      form.reset();
                      setVideoUrl("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={uploadMutation.isPending}
                    data-testid="button-submit-upload"
                  >
                    {uploadMutation.isPending ? "Submitting..." : "Submit Video"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}

      {/* Resubmit Revision Dialog */}
      <Dialog open={resubmitOpen} onOpenChange={setResubmitOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Resubmit Revision</DialogTitle>
            <DialogDescription>
              Upload a new video to address the requested revisions for Month {selectedDeliverable?.monthNumber}, Video #{selectedDeliverable?.videoNumber}
            </DialogDescription>
          </DialogHeader>
          <Form {...resubmitForm}>
            <form onSubmit={resubmitForm.handleSubmit(onResubmit)} className="space-y-4">
              <FormField
                control={resubmitForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Video Title</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter video title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={resubmitForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Add any notes about this video" rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <FormLabel htmlFor="resubmit-video-upload">Upload New Video</FormLabel>
                <div className="mt-2">
                  <input
                    type="file"
                    id="resubmit-video-upload"
                    ref={resubmitVideoInputRef}
                    onChange={handleResubmitVideo}
                    accept="video/*"
                    className="hidden"
                    aria-label="Upload new video for resubmission"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => resubmitVideoInputRef.current?.click()}
                    disabled={isResubmitUploading}
                    className="w-full"
                  >
                    {isResubmitUploading ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Uploading...
                      </>
                    ) : resubmitVideoUrl ? (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Video Uploaded - Click to Replace
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Choose Video File
                      </>
                    )}
                  </Button>
                  {resubmitVideoUrl && (
                    <p className="text-xs text-green-600 mt-2">✓ Video ready to submit</p>
                  )}
                </div>
              </div>

              <FormField
                control={resubmitForm.control}
                name="platformUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Platform URL (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://youtube.com/watch?v=..." />
                    </FormControl>
                    <FormDescription>
                      Link to where this video is published
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <input type="hidden" {...resubmitForm.register("monthNumber")} />
              <input type="hidden" {...resubmitForm.register("videoNumber")} />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setResubmitOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={resubmitMutation.isPending || !resubmitVideoUrl || isResubmitUploading}
                >
                  {resubmitMutation.isPending ? "Submitting..." : "Submit Revision"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Apply Dialog */}
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          {/* Header */}
          <div className="p-6 border-b">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">Review details & apply</DialogTitle>
              <DialogDescription>
                Transparent pricing, clear commitments, and quick approvals for {contract?.title}
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Main Content - Two Column Layout */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
              {/* Left Column - Contract Details */}
              <div className="p-6 border-r border-gray-200">
                {/* Stats Row */}
                <div className="grid grid-cols-4 gap-3 mb-6">
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">Rating</div>
                    <div className="flex items-center justify-center gap-1">
                      <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                      <span className="text-sm font-medium">New</span>
                    </div>
                  </div>
                  <div className="text-center border-l border-gray-200">
                    <div className="text-xs text-gray-500 mb-1">Active creators</div>
                    <div className="text-sm font-medium">0</div>
                  </div>
                  <div className="text-center border-l border-gray-200">
                    <div className="text-xs text-gray-500 mb-1">Contract length</div>
                    <div className="text-sm font-medium">{contract?.durationMonths} months</div>
                  </div>
                  <div className="text-center border-l border-gray-200">
                    <div className="text-xs text-gray-500 mb-1">Approvals</div>
                    <div className="text-sm font-medium">
                      {contract?.contentApprovalRequired ? 'Required' : 'Auto-post'}
                    </div>
                  </div>
                </div>

                {/* Tier Selection if available */}
                {hasRetainerTiers && (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Choose your tier</h4>
                    <div className="space-y-2">
                      {tierSummaries.map((tier: any, index: number) => (
                        <div
                          key={`${tier.name}-${index}`}
                          className={`border rounded-lg p-3 cursor-pointer transition-all ${
                            applyForm.watch('selectedTierId') === tier.id?.toString()
                              ? 'border-primary bg-primary/5'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => applyForm.setValue('selectedTierId', tier.id?.toString() || '')}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                applyForm.watch('selectedTierId') === tier.id?.toString()
                                  ? 'border-primary'
                                  : 'border-gray-300'
                              }`}>
                                {applyForm.watch('selectedTierId') === tier.id?.toString() && (
                                  <div className="w-2 h-2 rounded-full bg-primary" />
                                )}
                              </div>
                              <span className="font-medium">{tier.name}</span>
                              {bestValueTier?.id === tier.id && (
                                <Badge className="bg-emerald-500 text-white text-xs">Selected</Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mt-1 ml-6">
                            {formatCurrency(tier.monthlyAmount)}/mo · {tier.videosPerMonth} videos · {tier.durationMonths} months
                          </p>
                          <p className="text-xs text-gray-500 ml-6">
                            {formatCurrency(tier.perVideoCost, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per video · Net {formatCurrency(tier.monthlyAmount * (1 - totalFeePercentage))} after {totalFeeDisplay} fee
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2 text-right">
                      <a href="#" className="text-primary hover:underline">Transparent pricing</a>
                    </p>
                  </div>
                )}

                {/* Requirements Section */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Requirements</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white border border-gray-200 rounded-lg p-3">
                      <div className="text-xs font-medium text-gray-900 mb-1">Video length</div>
                      <div className="text-sm text-gray-600">
                        {formatSecondsToMinutes(contract?.minimumVideoLengthSeconds) || 'Per brief'}
                      </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-3">
                      <div className="text-xs font-medium text-gray-900 mb-1">Posting cadence</div>
                      <div className="text-sm text-gray-600 line-clamp-2">
                        {contract?.postingSchedule || `${contractVideosPerMonth} videos/month`}
                      </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-3">
                      <div className="text-xs font-medium text-gray-900 mb-1">Approvals</div>
                      <div className="text-sm text-gray-600">
                        {contract?.contentApprovalRequired ? 'Content approval required' : 'Auto-approval'}
                      </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-3">
                      <div className="text-xs font-medium text-gray-900 mb-1">Exclusivity</div>
                      <div className="text-sm text-gray-600">
                        {contract?.exclusivityRequired ? 'Exclusivity expected' : 'Non-exclusive'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Example Videos Section */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Example videos</h4>
                  <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="space-y-1">
                        <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
                            <Video className="h-4 w-4 text-gray-400" />
                          </div>
                          <div className="absolute top-1 left-1 text-[10px] text-gray-500 bg-white/80 px-1 rounded">
                            {contract?.requiredPlatform || 'YouTube'} Shorts
                          </div>
                          <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1 rounded">
                            45s
                          </div>
                        </div>
                        <p className="text-xs font-medium text-gray-900 truncate">Example video {i}</p>
                        <p className="text-[10px] text-gray-500 line-clamp-2">Demonstrates tone and pacing the company loves.</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column - Application Form */}
              <div className="p-6 bg-gray-50/50">
                <Form {...applyForm}>
                  <form onSubmit={applyForm.handleSubmit(onApplySubmit)} className="space-y-4">
                    {/* Why are you interested */}
                    <FormField
                      control={applyForm.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel className="text-sm font-medium">
                              Why are you interested?
                            </FormLabel>
                            <span className="text-xs text-gray-400">{field.value?.length || 0}/500</span>
                          </div>
                          <FormControl>
                            <Textarea
                              placeholder="Share your niche, experience, and why this brand is a great fit."
                              className="min-h-[120px] resize-none bg-white"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Portfolio Links */}
                    <FormField
                      control={applyForm.control}
                      name="portfolioLinks"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">
                            Portfolio Links (Optional)
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://tiktok.com/@yourprofile, https://instagram.com/yourprofile"
                              className="bg-white"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-xs text-gray-500">
                            Comma-separated URLs to your social profiles
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Proposed Start Date */}
                    <FormField
                      control={applyForm.control}
                      name="proposedStartDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">
                            Proposed Start Date (Optional)
                          </FormLabel>
                          <FormControl>
                            <Input type="date" className="bg-white" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Terms Checkbox */}
                    <FormField
                      control={applyForm.control}
                      name="acceptTerms"
                      render={({ field }) => (
                        <FormItem>
                          <div className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                className="mt-0.5"
                              />
                              <div>
                                <FormLabel className="text-sm font-medium cursor-pointer">
                                  I understand the deliverables
                                </FormLabel>
                                <p className="text-xs text-gray-500 mt-1">
                                  {contract?.videosPerMonth} videos per month for {contract?.durationMonths} months, following the posted schedule and approval requirements.
                                </p>
                              </div>
                            </div>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Info Message */}
                    <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 flex items-start gap-2">
                      <Info className="h-4 w-4 text-teal-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-teal-700">
                        We'll review your application right away.
                      </p>
                    </div>
                  </form>
                </Form>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t bg-white p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm">
                <span className="font-semibold">Selected tier {bestValueTier?.name || 'Base'}</span>
                <Badge variant="secondary" className="ml-2">
                  {formatCurrency(bestValueTier?.monthlyAmount ?? contractMonthlyAmount)}/mo
                </Badge>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatCurrency((bestValueTier?.monthlyAmount ?? contractMonthlyAmount) / (bestValueTier?.videosPerMonth ?? contractVideosPerMonth), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per video · Net {formatCurrency((bestValueTier?.monthlyAmount ?? contractMonthlyAmount) * (1 - totalFeePercentage))} after fees
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setApplyOpen(false);
                    applyForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={applyForm.handleSubmit(onApplySubmit)}
                  disabled={applyMutation.isPending}
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  {applyMutation.isPending ? "Submitting..." : "Submit application"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========== MOBILE LAYOUT ========== */}
      <div className="md:hidden space-y-4 pb-20">
        {/* Mobile Hero Card */}
        <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 text-white rounded-xl p-4 shadow-lg">
          {/* Reward Header */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[10px] text-teal-400 font-medium flex items-center gap-1 mb-0.5">
                <Gift className="h-2.5 w-2.5" /> Reward
              </p>
              <div className="text-3xl font-bold">
                {formatCurrency(bestValueTier?.monthlyAmount ?? contractMonthlyAmount)}
              </div>
              <p className="text-xs text-white/70 mt-0.5">
                Total payout for {bestValueTier?.videosPerMonth ?? contractVideosPerMonth}-video
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px] bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <Bookmark className="h-3 w-3 mr-1" /> Bookmark Offer
            </Button>
          </div>

          {/* Info Cards Row */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-white/10 rounded-lg p-2">
              <div className="flex items-center gap-1 text-[9px] text-white/60 mb-0.5">
                <Calendar className="h-2.5 w-2.5" /> Duration
                <Info className="h-2 w-2" />
              </div>
              <p className="text-sm font-bold">{contract.durationMonths} months</p>
              <p className="text-[8px] text-white/50 truncate">Deliverables on trial</p>
            </div>

            <div className="bg-white/10 rounded-lg p-2">
              <div className="flex items-center gap-1 text-[9px] text-white/60 mb-0.5">
                <DollarSign className="h-2.5 w-2.5" /> Payment Terms
              </div>
              <p className="text-sm font-bold">{formatCurrency(contractMonthlyAmount)}/month</p>
              <p className="text-[8px] text-white/50 truncate">Sponsored ad required</p>
            </div>

            <div className="bg-white/10 rounded-lg p-2">
              <div className="flex items-center gap-1 text-[9px] text-white/60 mb-0.5">
                <Tag className="h-2.5 w-2.5" /> Niche
              </div>
              <p className="text-sm font-bold truncate">{contract.niches?.[0] || "General"}</p>
              <p className="text-[8px] text-white/50 truncate">Based on category</p>
            </div>
          </div>

          {/* Tags Row */}
          <div className="flex flex-wrap gap-1.5">
            <Badge className="bg-teal-600 text-white border-none text-[9px] h-5 px-2">
              Campaign Offer
            </Badge>
            <Badge variant="outline" className="border-white/30 text-white/80 text-[9px] h-5 px-2">
              Earnings
            </Badge>
            <Badge variant="outline" className="border-white/30 text-white/80 text-[9px] h-5 px-2">
              All {contract.niches?.[0] || "categories"}
            </Badge>
          </div>
        </div>

        {/* Mobile Deliverable Requirements */}
        <Card className="border-card-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">Deliverable Requirements</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-teal-500 mt-0.5 shrink-0" />
              <span className="text-xs text-muted-foreground">
                Minimum length {formatSecondsToMinutes(contract.minimumVideoLengthSeconds) || "1 min"}
              </span>
            </div>
            {contract.contentGuidelines && (
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-500 mt-0.5 shrink-0" />
                <span className="text-xs text-muted-foreground line-clamp-2">{contract.contentGuidelines}</span>
              </div>
            )}
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-teal-500 mt-0.5 shrink-0" />
              <span className="text-xs text-muted-foreground">
                {contract.contentApprovalRequired ? "Content approval required before posting" : "Maintain FTC-compliant disclosure"}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-teal-500 mt-0.5 shrink-0" />
              <span className="text-xs text-muted-foreground">
                {contract.brandSafetyRequirements || "No vulgar language, maintain light, trendy tone"}
              </span>
            </div>
            <div className="pt-2 text-right">
              <Button variant="link" className="text-teal-500 p-0 h-auto text-xs">
                View Details →
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Mobile Tiered Package */}
        <Card className="border-card-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">Tiered Package</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs font-semibold">{contract.company?.tradeName || contract.company?.legalName || "Company"}</p>
                <p className="text-[10px] text-muted-foreground">{contract.title}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-2">
                <div>
                  <p className="text-muted-foreground">Views estimate</p>
                  <p className="font-semibold">Up to 30k</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Click-through rate</p>
                  <p className="font-semibold">About 3%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Earning potential</p>
                  <p className="font-semibold">Up to {formatCurrency(creatorTakeHome * contract.durationMonths)}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="font-semibold">{formatCurrency(contractMonthlyAmount)} one time payout</p>
                </div>
                <div className="flex items-center gap-1">
                  <Tag className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Technology</span>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {contract.niches?.[0] || "Tech"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mobile Live Summary Preview */}
        <Card className="border-card-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">Live Summary Preview</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b">
                <span className="text-muted-foreground">Gross monthly</span>
                <span className="font-semibold">{formatCurrency(contractMonthlyAmount)}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b">
                <span className="text-muted-foreground">Platform fee ({totalFeeDisplay})</span>
                <span className="font-semibold">{formatCurrency(platformFee)}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b">
                <span className="text-muted-foreground">Net to creator</span>
                <span className="font-semibold text-teal-600">{formatCurrency(creatorTakeHome)}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">Videos per month</span>
                <span className="font-semibold">{contractVideosPerMonth}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mobile Sticky Apply Button */}
        {!currentApplication && (
          <div className="fixed bottom-0 left-0 right-0 p-3 bg-background border-t z-50">
            <Button
              className="w-full h-10 bg-teal-500 hover:bg-teal-600 text-white text-sm"
              onClick={() => setApplyOpen(true)}
              data-testid="button-apply-mobile"
            >
              <Send className="h-4 w-4 mr-2" /> Apply Now
            </Button>
          </div>
        )}
      </div>

      {/* ========== DESKTOP LAYOUT ========== */}
      <div className="hidden md:block space-y-6">
        {/* Main Content Grid - Hero + Tiered Package */}
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Left Side - Hero Card */}
        <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-lg">
          {/* Reward Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-teal-400 font-medium flex items-center gap-1 mb-1">
                <Gift className="h-3 w-3" /> Reward
              </p>
              <div className="text-4xl font-bold">
                {formatCurrency(bestValueTier?.monthlyAmount ?? contractMonthlyAmount)}
              </div>
              <p className="text-sm text-white/70 mt-1">
                Total payout for {bestValueTier?.videosPerMonth ?? contractVideosPerMonth} video{(bestValueTier?.videosPerMonth ?? contractVideosPerMonth) > 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {contract.requiredPlatform && (
                <Badge className="bg-red-500/90 text-white border-none text-xs">
                  {contract.requiredPlatform} Focused
                </Badge>
              )}
              <Badge className="bg-teal-500/90 text-white border-none text-xs">
                Affiliate Focused Campaign
              </Badge>
            </div>
          </div>

          {/* Info Cards Row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white/10 rounded-xl p-3 backdrop-blur">
              <div className="flex items-center gap-1 text-xs text-white/60 mb-1">
                <Calendar className="h-3 w-3" /> Duration
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3" />
                    </TooltipTrigger>
                    <TooltipContent>Contract duration</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-lg font-bold">{contract.durationMonths} months</p>
              <p className="text-[10px] text-white/50">Deliverables on this trial</p>
            </div>

            <div className="bg-white/10 rounded-xl p-3 backdrop-blur">
              <div className="flex items-center gap-1 text-xs text-white/60 mb-1">
                <DollarSign className="h-3 w-3" /> Payment Terms
              </div>
              <p className="text-lg font-bold">{formatCurrency(contractMonthlyAmount)} month</p>
              <p className="text-[10px] text-white/50">Nets: {formatCurrency(creatorTakeHome)} per month</p>
            </div>

            <div className="bg-white/10 rounded-xl p-3 backdrop-blur">
              <div className="flex items-center gap-1 text-xs text-white/60 mb-1">
                <Tag className="h-3 w-3" /> Niche
              </div>
              <p className="text-lg font-bold truncate">
                {contract.niches?.[0] || "General"}
              </p>
              <p className="text-[10px] text-white/50">Based on category</p>
            </div>
          </div>

          {/* Tags Row */}
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-teal-600 text-white border-none text-xs">
              Compare Offer
            </Badge>
            {contract.minimumFollowers && (
              <Badge variant="outline" className="border-white/30 text-white/80 text-xs">
                {contract.minimumFollowers.toLocaleString()}+ Followers
              </Badge>
            )}
            <Badge variant="outline" className="border-white/30 text-white/80 text-xs">
              Earning Scheme
            </Badge>
            {!contract.contentApprovalRequired && (
              <Badge variant="outline" className="border-white/30 text-white/80 text-xs">
                Self Regulates
              </Badge>
            )}
          </div>
        </div>

        {/* Right Side - Tiered Package Card */}
        <Card className="border-card-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Tiered Package</CardTitle>
              {!currentApplication && (
                <Button
                  className="bg-teal-500 hover:bg-teal-600 text-white"
                  onClick={() => setApplyOpen(true)}
                  data-testid="button-apply-retainer"
                >
                  Apply Now
                  <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" /> Campaign Length
                </div>
                <span className="font-semibold">{contract.durationMonths} months</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <DollarSign className="h-4 w-4" /> Payment Terms
                </div>
                <span className="font-semibold">{formatCurrency(contractMonthlyAmount)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" /> Minimum Followers
                </div>
                <span className="font-semibold">
                  {contract.minimumFollowers ? contract.minimumFollowers.toLocaleString() + '+' : 'None'}
                </span>
              </div>
            </div>

            {/* Posting Schedule Section */}
            <div className="pt-2">
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <Calendar className="h-4 w-4" /> Posting Schedule
              </div>
              <p className="text-sm text-muted-foreground">
                {contract.postingSchedule || `Post ${contractVideosPerMonth} video${contractVideosPerMonth > 1 ? 's' : ''} per month`}
              </p>
              {contract.minimumVideoLengthSeconds && (
                <p className="text-xs text-muted-foreground mt-1">
                  Recommended length: {formatSecondsToMinutes(contract.minimumVideoLengthSeconds)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deliverable Requirements Section */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-card-border">
          <CardHeader>
            <CardTitle className="text-base">Deliverable Requirements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-teal-500 mt-0.5 shrink-0" />
              <span className="text-sm text-muted-foreground">
                Minimum length {formatSecondsToMinutes(contract.minimumVideoLengthSeconds) || "per brief"}
              </span>
            </div>
            {contract.contentGuidelines && (
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 text-teal-500 mt-0.5 shrink-0" />
                <span className="text-sm text-muted-foreground">{contract.contentGuidelines}</span>
              </div>
            )}
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-teal-500 mt-0.5 shrink-0" />
              <span className="text-sm text-muted-foreground">
                Publish {contractVideosPerMonth} {contract.requiredPlatform || "video"} video{contractVideosPerMonth > 1 ? 's' : ''} per month
              </span>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-teal-500 mt-0.5 shrink-0" />
              <span className="text-sm text-muted-foreground">
                {contract.contentApprovalRequired ? "Content approval required before posting" : "Maintain FTC-compliant disclosure"}
              </span>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-teal-500 mt-0.5 shrink-0" />
              <span className="text-sm text-muted-foreground">
                {contract.brandSafetyRequirements || "Follow provided talking points"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-teal-500 mt-0.5 shrink-0" />
              <div>
                <span className="text-sm font-medium">Exclusivity</span>
                <p className="text-sm text-muted-foreground">
                  {contract.exclusivityRequired ? "No competing products during contract" : "Non-exclusive - work with other brands"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-teal-500 mt-0.5 shrink-0" />
              <div>
                <span className="text-sm font-medium">Content Usage</span>
                <p className="text-sm text-muted-foreground">
                  Brand may repurpose content for ads
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-teal-500 mt-0.5 shrink-0" />
              <div>
                <span className="text-sm font-medium">Geographic</span>
                <p className="text-sm text-muted-foreground">
                  {contract.platformAccountDetails || "Global"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tiered Offers Section */}
      {hasRetainerTiers && (
        <Card className="border-card-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Tiered</CardTitle>
                <Gift className="h-4 w-4 text-teal-500" />
                <span className="text-sm font-medium">{contract.title}</span>
              </div>
              <Button variant="link" className="text-teal-500 p-0 h-auto text-sm">
                <Bookmark className="h-3 w-3 mr-1" /> Bookmark Offer
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {tierSummaries.map((tier: any, index: number) => (
              <div key={`tier-${index}`} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{tier.name}</Badge>
                  <span className="text-sm text-muted-foreground">{tier.durationMonths} months</span>
                </div>
                <span className="font-semibold">{formatCurrency(tier.monthlyAmount)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Live Summary Preview Section */}
      <Card className="border-card-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Live Summary Preview</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Info className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Real-time breakdown using company-provided details</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Brand Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <Briefcase className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Brand</p>
                  <p className="font-semibold">{contract.company?.tradeName || contract.company?.legalName || contract.title}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(contractMonthlyAmount)} one-time payout</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Views estimate</p>
                  <p className="font-semibold">Up to 20k</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Brands</p>
                  <p className="font-semibold text-sm">{contract.title}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(contractMonthlyAmount)} one-time</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Click-through rate</p>
                  <p className="font-semibold">About 3%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Category</p>
                  <p className="text-xs text-muted-foreground">{contract.niches?.[0] || "General"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Earning potential</p>
                  <p className="font-semibold">Up to {formatCurrency(creatorTakeHome * contract.durationMonths)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Technology</p>
                  <Badge variant="outline" className="text-xs mt-1">
                    {contract.niches?.[0] || "Tech"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="space-y-3 p-4 rounded-lg bg-muted/30">
              <h4 className="font-semibold text-sm">Financial Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Gross monthly</span>
                  <span className="font-semibold">{formatCurrency(contractMonthlyAmount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Platform fee ({totalFeeDisplay})</span>
                  <span className="font-semibold">{formatCurrency(platformFee)}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-muted-foreground">Net to creator</span>
                  <span className="font-semibold text-teal-600">{formatCurrency(creatorTakeHome)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Videos per month</span>
                  <span className="font-semibold">{contractVideosPerMonth}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Value per video</span>
                  <span className="font-semibold">{formatCurrency(basePerVideo, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contract Description */}
      <Card className="border-card-border">
        <CardHeader>
          <CardTitle className="text-base">Contract Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2 text-sm">Description</h4>
            <p className="text-sm text-muted-foreground">{contract.description}</p>
          </div>

          {contract.niches && contract.niches.length > 0 && (
            <div className="pt-4 border-t">
              <h4 className="font-semibold mb-2 text-sm">Target Niches</h4>
              <div className="flex gap-2 flex-wrap">
                {contract.niches.map((niche: string, index: number) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {niche}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deliverables Tab for Approved Creators */}
      {isApproved && (
        <Tabs defaultValue="deliverables" className="space-y-6">
          <TabsList>
            <TabsTrigger value="deliverables" data-testid="tab-deliverables">
              My Deliverables ({deliverables?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="deliverables" className="space-y-6">
            {deliverables && deliverables.length > 0 ? (
              <div className="grid gap-4">
                {deliverables.map((deliverable: any) => (
                  <Card
                    key={deliverable.id}
                    className="border-card-border"
                    data-testid={`deliverable-card-${deliverable.id}`}
                  >
                    <CardContent className="p-6">
                      <div className="grid lg:grid-cols-[320px_1fr] gap-6">
                        {/* Left Column: Video */}
                        <div className="space-y-3">
                          <div className="rounded-lg overflow-hidden bg-black border-2 border-border">
                            <VideoPlayer
                              videoUrl={deliverable.videoUrl}
                              className="w-full aspect-video"
                            />
                          </div>

                          {/* Status Badge */}
                          <div className="flex justify-center">
                            <Badge variant={getStatusBadgeVariant(deliverable.status)} className="text-xs">
                              {deliverable.status.replace("_", " ")}
                            </Badge>
                          </div>
                        </div>

                        {/* Right Column: Details */}
                        <div className="space-y-4">
                          {/* Header */}
                          <div>
                            <h3 className="text-xl font-bold">{deliverable.title}</h3>
                            <p className="text-sm text-muted-foreground">
                              Month {deliverable.monthNumber} - Video #{deliverable.videoNumber}
                            </p>
                          </div>

                          {/* Description */}
                          {deliverable.description && (
                            <div>
                              <h4 className="font-semibold text-sm mb-1">Description</h4>
                              <p className="text-sm text-muted-foreground">
                                {deliverable.description}
                              </p>
                            </div>
                          )}

                          {/* Platform Link */}
                          {deliverable.platformUrl && (
                            <div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(deliverable.platformUrl, "_blank")}
                                data-testid={`button-view-platform-${deliverable.id}`}
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                View on Platform
                              </Button>
                            </div>
                          )}

                          {/* Review Notes */}
                          {deliverable.reviewNotes && (
                            <div className="pt-3 border-t">
                              <h4 className="font-semibold text-sm mb-1">Review Notes</h4>
                              <p className="text-sm text-muted-foreground">
                                {deliverable.reviewNotes}
                              </p>
                            </div>
                          )}

                          {/* Resubmit Button for Revision Requested */}
                          {deliverable.status === 'revision_requested' && (
                            <div className="pt-3 border-t">
                              <Button
                                onClick={() => handleResubmitClick(deliverable)}
                                className="w-full"
                                variant="default"
                              >
                                <Upload className="h-4 w-4 mr-2" />
                                Resubmit Revision
                              </Button>
                            </div>
                          )}

                          {/* Timestamps */}
                          <div className="pt-3 border-t space-y-1">
                            {deliverable.submittedAt && (
                              <p className="text-xs text-muted-foreground">
                                Submitted {format(new Date(deliverable.submittedAt), "MMM d, yyyy 'at' h:mm a")}
                              </p>
                            )}
                            {deliverable.reviewedAt && (
                              <p className="text-xs text-muted-foreground">
                                Reviewed {format(new Date(deliverable.reviewedAt), "MMM d, yyyy 'at' h:mm a")}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-card-border">
                <CardContent className="p-12 text-center">
                  <Video className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No deliverables submitted yet. Click "Submit Video" to upload your first video.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
      </div>

      <GenericErrorDialog
        open={!!errorDialog}
        onOpenChange={(open) => !open && setErrorDialog(null)}
        title={errorDialog?.title || "Error"}
        description={errorDialog?.message || "An error occurred"}
      />
    </div>
  );
}
