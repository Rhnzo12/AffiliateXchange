import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { useToast } from "../hooks/use-toast";
import { apiRequest, queryClient } from "../lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
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
import { DollarSign, Video, Calendar, ArrowLeft, Upload, Play, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../hooks/useAuth";
import { VideoPlayer } from "../components/VideoPlayer";

const uploadDeliverableSchema = z.object({
  platformUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  monthNumber: z.string().min(1, "Month number is required"),
  videoNumber: z.string().min(1, "Video number is required"),
});

type UploadDeliverableForm = z.infer<typeof uploadDeliverableSchema>;

export default function CreatorRetainerDetail() {
  const [, params] = useRoute("/retainers/:id");
  const { toast} = useToast();
  const { user } = useAuth();
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

  const { data: contract, isLoading } = useQuery<any>({
    queryKey: ["/api/retainer-contracts", contractId],
    enabled: !!contractId,
  });

  const { data: myApplication } = useQuery<any>({
    queryKey: ["/api/creator/retainer-applications"],
  });

  const { data: deliverables } = useQuery<any[]>({
    queryKey: ["/api/retainer-contracts", contractId, "deliverables"],
    enabled: !!contractId && myApplication?.some((app: any) => app.contractId === contractId && app.status === "approved"),
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
      toast({
        title: "File Too Large",
        description: "Video file must be less than 500MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Get Cloudinary upload parameters
      const uploadResponse = await fetch("/api/objects/upload", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ folder: "creatorlink/retainer", resourceType: "video" }), // Save retainer videos in 'creatorlink/retainer' folder
      });
      const uploadData = await uploadResponse.json();

      console.log('[Retainer Upload] Upload parameters received:', uploadData);

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
        formData.append('resource_type', 'video');
      }

      if (uploadData.folder) {
        formData.append('folder', uploadData.folder);
        console.log('[Retainer Upload] Folder parameter set to:', uploadData.folder);
      }

      console.log('[Retainer Upload] FormData entries:', Array.from(formData.entries()));

      // Upload video to Cloudinary
      const uploadResult = await fetch(uploadData.uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (uploadResult.ok) {
        const cloudinaryResponse = await uploadResult.json();
        console.log('[Retainer Upload] Cloudinary response:', cloudinaryResponse);
        const uploadedVideoUrl = cloudinaryResponse.secure_url;
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
      toast({
        title: "Upload Failed",
        description: "Failed to upload video. Please try again.",
        variant: "destructive",
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
      queryClient.invalidateQueries({ queryKey: ["/api/retainer-contracts", contractId, "deliverables"] });
      toast({
        title: "Deliverable Submitted",
        description: "Your video has been submitted for review.",
      });
      setOpen(false);
      form.reset();
      setVideoUrl("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit deliverable",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: UploadDeliverableForm) => {
    uploadMutation.mutate(data);
  };

  const resubmitForm = useForm<UploadDeliverableForm>({
    resolver: zodResolver(uploadDeliverableSchema),
  });

  const handleResubmitVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsResubmitUploading(true);

    try {
      // Get Cloudinary upload parameters
      const uploadResponse = await fetch("/api/objects/upload", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ folder: "retainer", resourceType: "video" }),
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
        formData.append('resource_type', 'video');
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
      toast({
        title: "Upload Failed",
        description: "Failed to upload video. Please try again.",
        variant: "destructive",
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
      queryClient.invalidateQueries({ queryKey: ["/api/retainer-contracts", contractId, "deliverables"] });
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
      toast({
        title: "Error",
        description: error.message || "Failed to resubmit deliverable",
        variant: "destructive",
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

  if (isLoading) {
    return <div className="space-y-6">Loading...</div>;
  }

  if (!contract) {
    return <div className="space-y-6">Contract not found</div>;
  }

  const currentApplication = myApplication?.find((app: any) => app.contractId === contractId);
  const isApproved = currentApplication?.status === "approved";
  const isPending = currentApplication?.status === "pending";

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
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/retainers">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold" data-testid="heading-contract-title">
              {contract.title}
            </h1>
            {currentApplication && (
              <Badge variant={isApproved ? "outline" : isPending ? "default" : "destructive"}>
                {currentApplication.status}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            by {contract.company?.tradeName || contract.company?.legalName || "Company"}
          </p>
        </div>
        {isApproved && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-submit-deliverable">
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
                    <label className="block text-sm font-medium mb-2">
                      Video File
                    </label>
                    <input
                      type="file"
                      ref={videoInputRef}
                      accept="video/*"
                      onChange={handleVideoUpload}
                      disabled={isUploading}
                      className="hidden"
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
                          Video Uploaded ✓
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
                        ✓ Video uploaded successfully
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
      </div>

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
                <FormLabel>Upload New Video</FormLabel>
                <div className="mt-2">
                  <input
                    type="file"
                    ref={resubmitVideoInputRef}
                    onChange={handleResubmitVideo}
                    accept="video/*"
                    className="hidden"
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

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="border-card-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Monthly Payment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-primary" />
              <div className="text-2xl font-bold">
                ${parseFloat(contract.monthlyAmount).toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Videos Per Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Video className="h-8 w-8 text-primary" />
              <div className="text-2xl font-bold">{contract.videosPerMonth}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Contract Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Calendar className="h-8 w-8 text-primary" />
              <div className="text-2xl font-bold">{contract.durationMonths} months</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="details" className="space-y-6">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          {isApproved && (
            <TabsTrigger value="deliverables" data-testid="tab-deliverables">
              My Deliverables ({deliverables?.length || 0})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          <Card className="border-card-border">
            <CardHeader>
              <CardTitle>Contract Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Description</h4>
                <p className="text-muted-foreground">{contract.description}</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <h4 className="font-semibold mb-1">Required Platform</h4>
                  <p className="text-muted-foreground">{contract.requiredPlatform}</p>
                </div>
                {contract.minimumFollowers && (
                  <div>
                    <h4 className="font-semibold mb-1">Minimum Followers</h4>
                    <p className="text-muted-foreground">
                      {contract.minimumFollowers.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {contract.platformAccountDetails && (
                <div className="pt-4 border-t">
                  <h4 className="font-semibold mb-2">Platform Account Details</h4>
                  <p className="text-muted-foreground">{contract.platformAccountDetails}</p>
                </div>
              )}

              {contract.contentGuidelines && (
                <div className="pt-4 border-t">
                  <h4 className="font-semibold mb-2">Content Guidelines</h4>
                  <p className="text-muted-foreground">{contract.contentGuidelines}</p>
                </div>
              )}

              {contract.brandSafetyRequirements && (
                <div className="pt-4 border-t">
                  <h4 className="font-semibold mb-2">Brand Safety Requirements</h4>
                  <p className="text-muted-foreground">{contract.brandSafetyRequirements}</p>
                </div>
              )}

              {contract.niches && contract.niches.length > 0 && (
                <div className="pt-4 border-t">
                  <h4 className="font-semibold mb-2">Target Niches</h4>
                  <div className="flex gap-2 flex-wrap">
                    {contract.niches.map((niche: string, index: number) => (
                      <Badge key={index} variant="outline">
                        {niche}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isApproved && (
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
                                📤 Submitted {format(new Date(deliverable.submittedAt), "MMM d, yyyy 'at' h:mm a")}
                              </p>
                            )}
                            {deliverable.reviewedAt && (
                              <p className="text-xs text-muted-foreground">
                                ✅ Reviewed {format(new Date(deliverable.reviewedAt), "MMM d, yyyy 'at' h:mm a")}
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
        )}
      </Tabs>
    </div>
  );
}
