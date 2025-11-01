import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, DollarSign, Users, Eye, Calendar, Upload, Trash2, Video, AlertCircle, Play } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Helper function to generate thumbnail from video
const generateThumbnail = async (videoUrl: string): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = videoUrl;
    video.muted = true;
    
    video.addEventListener('loadeddata', () => {
      // Seek to 1 second or 10% of video duration, whichever is less
      const seekTime = Math.min(1, video.duration * 0.1);
      video.currentTime = seekTime;
    });

    video.addEventListener('seeked', () => {
      // Create canvas and draw video frame
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert canvas to blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create thumbnail blob'));
          }
        },
        'image/jpeg',
        0.8
      );
    });

    video.addEventListener('error', () => {
      reject(new Error('Failed to load video'));
    });
  });
};

export default function CompanyOfferDetail() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, params] = useRoute("/company/offers/:id");
  const offerId = params?.id;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: offer, isLoading: offerLoading } = useQuery<any>({
    queryKey: [`/api/offers/${offerId}`],
    enabled: !!offerId && isAuthenticated,
  });

  const { data: applications = [] } = useQuery<any[]>({
    queryKey: ["/api/company/applications"],
    enabled: isAuthenticated,
  });

  const { data: videos = [], isLoading: videosLoading } = useQuery<any[]>({
    queryKey: [`/api/offers/${offerId}/videos`],
    enabled: !!offerId && isAuthenticated,
  });

  // Filter applications for this offer
  const offerApplications = applications.filter((app: any) => app.offerId === offerId);

  // Video upload state
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [videoDescription, setVideoDescription] = useState("");
  const [creatorCredit, setCreatorCredit] = useState("");
  const [originalPlatform, setOriginalPlatform] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Memoized handler for dialog state to prevent input focus loss
  const handleDialogOpenChange = useCallback((open: boolean) => {
    setShowVideoDialog(open);
    if (!open) {
      // Reset form when dialog closes
      setVideoUrl("");
      setThumbnailUrl("");
      setVideoTitle("");
      setVideoDescription("");
      setCreatorCredit("");
      setOriginalPlatform("");
      setIsUploading(false);
    }
  }, []);

  const createVideoMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", `/api/offers/${offerId}/videos`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/offers/${offerId}/videos`] });
      handleDialogOpenChange(false);
      toast({
        title: "Success",
        description: "Video added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add video",
        variant: "destructive",
      });
    },
  });

  const deleteVideoMutation = useMutation({
    mutationFn: async (videoId: string) => {
      return await apiRequest("DELETE", `/api/offer-videos/${videoId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/offers/${offerId}/videos`] });
      toast({
        title: "Success",
        description: "Video deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete video",
        variant: "destructive",
      });
    },
  });

  // Handle file selection and automatic upload with thumbnail generation
  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const videoExtensions = ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.webm', '.mkv', '.m4v'];
    const isVideo = videoExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (!isVideo) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a video file (MP4, MOV, AVI, WebM, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (500MB)
    if (file.size > 524288000) {
      toast({
        title: "File Too Large",
        description: "Video file must be less than 500MB",
        variant: "destructive",
      });
      return;
    }

    // Start uploading
    setIsUploading(true);

    try {
      // Get Cloudinary upload parameters
      const uploadResponse = await fetch("/api/objects/upload", {
        method: "POST",
        credentials: "include",
      });
      const uploadData = await uploadResponse.json();

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
      }

      // Upload video to Cloudinary
      const uploadResult = await fetch(uploadData.uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (uploadResult.ok) {
        const cloudinaryResponse = await uploadResult.json();
        const uploadedVideoUrl = cloudinaryResponse.secure_url;
        
        toast({
          title: "Video Uploaded",
          description: "Generating thumbnail...",
        });

        // Generate thumbnail from the uploaded video
        try {
          const thumbnailBlob = await generateThumbnail(uploadedVideoUrl);
          
          // Get fresh upload parameters for thumbnail
          const thumbUploadResponse = await fetch("/api/objects/upload", {
            method: "POST",
            credentials: "include",
          });
          const thumbUploadData = await thumbUploadResponse.json();

          // Upload thumbnail to Cloudinary
          const thumbnailFormData = new FormData();
          thumbnailFormData.append('file', thumbnailBlob, 'thumbnail.jpg');
          
          if (thumbUploadData.uploadPreset) {
            thumbnailFormData.append('upload_preset', thumbUploadData.uploadPreset);
          } else if (thumbUploadData.signature) {
            thumbnailFormData.append('signature', thumbUploadData.signature);
            thumbnailFormData.append('timestamp', thumbUploadData.timestamp.toString());
            thumbnailFormData.append('api_key', thumbUploadData.apiKey);
          }

          if (thumbUploadData.folder) {
            thumbnailFormData.append('folder', thumbUploadData.folder + '/thumbnails');
          }

          const thumbnailUploadResult = await fetch(thumbUploadData.uploadUrl, {
            method: "POST",
            body: thumbnailFormData,
          });

          if (thumbnailUploadResult.ok) {
            const thumbnailResponse = await thumbnailUploadResult.json();
            const uploadedThumbnailUrl = thumbnailResponse.secure_url;
            
            setVideoUrl(uploadedVideoUrl);
            setThumbnailUrl(uploadedThumbnailUrl);
            setIsUploading(false);
            
            toast({
              title: "Success!",
              description: "Video and thumbnail uploaded successfully. Fill in the details below.",
            });
          } else {
            // Thumbnail upload failed, but video is uploaded
            setVideoUrl(uploadedVideoUrl);
            setIsUploading(false);
            toast({
              title: "Video Uploaded",
              description: "Video uploaded but thumbnail generation failed. You can still proceed.",
            });
          }
        } catch (thumbnailError) {
          // Thumbnail generation failed, but video is uploaded
          console.error('Thumbnail generation error:', thumbnailError);
          setVideoUrl(uploadedVideoUrl);
          setIsUploading(false);
          toast({
            title: "Video Uploaded",
            description: "Video uploaded but thumbnail generation failed. You can still proceed.",
          });
        }
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      setIsUploading(false);
      toast({
        title: "Upload Failed",
        description: "Failed to upload video. Please try again.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleSubmitVideo = useCallback(() => {
    // Validation
    if (!videoUrl) {
      toast({
        title: "Video Required",
        description: "Please upload a video file before submitting",
        variant: "destructive",
      });
      return;
    }

    if (!videoTitle.trim()) {
      toast({
        title: "Title Required",
        description: "Please provide a title for your video",
        variant: "destructive",
      });
      return;
    }

    if (videoTitle.length > 100) {
      toast({
        title: "Title Too Long",
        description: "Video title must be 100 characters or less",
        variant: "destructive",
      });
      return;
    }

    if (videoDescription.length > 500) {
      toast({
        title: "Description Too Long",
        description: "Video description must be 500 characters or less",
        variant: "destructive",
      });
      return;
    }

    createVideoMutation.mutate({
      videoUrl,
      thumbnailUrl: thumbnailUrl || null,
      title: videoTitle.trim(),
      description: videoDescription.trim(),
      creatorCredit: creatorCredit.trim(),
      originalPlatform: originalPlatform.trim(),
    });
  }, [videoUrl, thumbnailUrl, videoTitle, videoDescription, creatorCredit, originalPlatform, createVideoMutation, toast]);

  const videoCount = videos.length;
  const canAddMoreVideos = videoCount < 12;
  const hasMinimumVideos = videoCount >= 6;

  // Memoize the video uploader to prevent re-renders that cause input focus loss
  const VideoUploader = useMemo(() => (
    <div className="relative">
      <input
        type="file"
        accept="video/*"
        onChange={handleFileSelect}
        disabled={isUploading}
        className="hidden"
        id="video-file-input"
      />
      <label
        htmlFor="video-file-input"
        className={`border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer block ${
          isUploading ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        <div className="flex flex-col items-center gap-2">
          {isUploading ? (
            <>
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <Upload className="h-6 w-6 text-blue-600 dark:text-blue-400 animate-pulse" />
              </div>
              <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                Uploading Video...
              </div>
              <div className="text-xs text-muted-foreground">
                Please wait while your video is being uploaded
              </div>
            </>
          ) : videoUrl ? (
            <>
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <Video className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-sm font-medium text-green-600 dark:text-green-400">
                Video Ready ✓
              </div>
              {thumbnailUrl && (
                <div className="text-xs text-green-600 dark:text-green-400">
                  Thumbnail generated ✓
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                Click to select a different video
              </div>
            </>
          ) : (
            <>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <div className="text-sm font-medium">
                Browse and Select Video
              </div>
              <div className="text-xs text-muted-foreground">
                MP4, MOV, AVI, WebM (max 500MB)
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Video will upload automatically after selection
              </div>
            </>
          )}
        </div>
      </label>
    </div>
  ), [videoUrl, thumbnailUrl, isUploading, handleFileSelect]);

  if (isLoading || offerLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h2 className="text-2xl font-bold">Offer not found</h2>
        <Link href="/company/offers">
          <Button>Back to My Offers</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/company/offers">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{offer.title}</h1>
          <p className="text-muted-foreground mt-1">{offer.productName}</p>
        </div>
        <Badge
          variant={offer.status === 'approved' ? 'default' : 'secondary'}
          data-testid="badge-status"
        >
          {offer.status}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Applications</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{offerApplications.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">View Count</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{offer.viewCount || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commission</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {offer.commissionPercentage ? `${offer.commissionPercentage}%` : 
               offer.commissionAmount ? `$${offer.commissionAmount}` : 'N/A'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Created</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold">
              {new Date(offer.createdAt).toLocaleDateString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Offer Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Short Description</h3>
            <p className="text-muted-foreground">{offer.shortDescription}</p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Full Description</h3>
            <p className="text-muted-foreground whitespace-pre-wrap">{offer.fullDescription}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="font-semibold mb-2">Primary Niche</h3>
              <Badge variant="outline">{offer.primaryNiche}</Badge>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Commission Type</h3>
              <Badge variant="outline">{offer.commissionType?.replace(/_/g, ' ')}</Badge>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Product URL</h3>
            <a 
              href={offer.productUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {offer.productUrl}
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Promotional Videos
          </CardTitle>
          <CardDescription>
            Upload 6-12 videos showcasing your product. Videos help creators understand and promote your offer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasMinimumVideos && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You need at least 6 videos to publish this offer. Currently: {videoCount}/6
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {videoCount} of 12 videos uploaded
            </div>
            <Button
              onClick={() => setShowVideoDialog(true)}
              disabled={!canAddMoreVideos || createVideoMutation.isPending}
              data-testid="button-add-video"
            >
              <Upload className="h-4 w-4 mr-2" />
              Add Video
            </Button>
          </div>

          {videosLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading videos...</div>
          ) : videos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No videos uploaded yet. Add your first video to get started.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {videos.map((video: any) => (
                <Card key={video.id} className="overflow-hidden">
                  <CardContent className="p-4 space-y-2">
                    <div className="aspect-video bg-muted rounded-md relative overflow-hidden">
                      {video.thumbnailUrl ? (
                        <>
                          <img 
                            src={video.thumbnailUrl} 
                            alt={video.title}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <Play className="h-8 w-8 text-white" />
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Video className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm line-clamp-1" data-testid={`text-video-title-${video.id}`}>
                        {video.title}
                      </h4>
                      {video.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {video.description}
                        </p>
                      )}
                      {video.creatorCredit && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Credit: {video.creatorCredit}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => deleteVideoMutation.mutate(video.id)}
                      disabled={deleteVideoMutation.isPending}
                      data-testid={`button-delete-video-${video.id}`}
                    >
                      <Trash2 className="h-3 w-3 mr-2" />
                      Delete
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showVideoDialog} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Promotional Video</DialogTitle>
            <DialogDescription>
              Select a video file to automatically upload (max 500MB), then fill in the details below
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="video-upload">
                Video File <span className="text-destructive">*</span>
              </Label>
              {VideoUploader}
              {!videoUrl && !isUploading && (
                <p className="text-xs text-muted-foreground">
                  Select a video file to automatically upload, then fill in the details below
                </p>
              )}
              {videoUrl && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  ✓ Video uploaded successfully. {thumbnailUrl && 'Thumbnail generated automatically.'} Now fill in the details and click "Add Video"
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="video-title">
                Video Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="video-title"
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
                placeholder="e.g., Product Demo, Tutorial, Review"
                maxLength={100}
                data-testid="input-video-title"
              />
              <p className="text-xs text-muted-foreground">
                {videoTitle.length}/100 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="video-description">Description</Label>
              <Textarea
                id="video-description"
                value={videoDescription}
                onChange={(e) => setVideoDescription(e.target.value)}
                placeholder="Provide a brief description of what this video shows..."
                rows={4}
                maxLength={500}
                data-testid="input-video-description"
              />
              <p className="text-xs text-muted-foreground">
                {videoDescription.length}/500 characters
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="creator-credit">Creator Credit</Label>
                <Input
                  id="creator-credit"
                  value={creatorCredit}
                  onChange={(e) => setCreatorCredit(e.target.value)}
                  placeholder="@username or creator name"
                  data-testid="input-creator-credit"
                />
                <p className="text-xs text-muted-foreground">
                  Optional: Credit the original creator
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="original-platform">Original Platform</Label>
                <Input
                  id="original-platform"
                  value={originalPlatform}
                  onChange={(e) => setOriginalPlatform(e.target.value)}
                  placeholder="TikTok, Instagram, YouTube"
                  data-testid="input-original-platform"
                />
                <p className="text-xs text-muted-foreground">
                  Optional: Where was this posted?
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => handleDialogOpenChange(false)}
              disabled={createVideoMutation.isPending}
              data-testid="button-cancel-video"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitVideo}
              disabled={!videoUrl || !videoTitle || isUploading || createVideoMutation.isPending}
              data-testid="button-submit-video"
            >
              {createVideoMutation.isPending ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-pulse" />
                  Adding Video...
                </>
              ) : isUploading ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-pulse" />
                  Uploading...
                </>
              ) : (
                <>
                  <Video className="h-4 w-4 mr-2" />
                  Add Video
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {offerApplications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Applications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {offerApplications.slice(0, 5).map((app: any) => (
                <div key={app.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                  <div>
                    <p className="font-medium">{app.creatorName || 'Creator'}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(app.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={app.status === 'approved' ? 'default' : 'secondary'}>
                    {app.status}
                  </Badge>
                </div>
              ))}
            </div>
            {offerApplications.length > 5 && (
              <Link href="/company/applications">
                <Button variant="outline" className="w-full mt-4" data-testid="button-view-all">
                  View All Applications
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}