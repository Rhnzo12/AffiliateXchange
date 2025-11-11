import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useLocation } from "wouter";
import { queryClient } from "../lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Progress } from "../components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import {
  Sparkles,
  Upload,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  X,
  ChevronsUpDown,
  Video
} from "lucide-react";

const STEPS = [
  { id: 1, title: "Profile Image", description: "Upload your profile picture" },
  { id: 2, title: "Content Niches", description: "Select your content categories" },
  { id: 3, title: "Video Platforms", description: "Connect your social channels" },
];

const AVAILABLE_NICHES = [
  { value: "gaming", label: "Gaming" },
  { value: "tech", label: "Technology & Software" },
  { value: "fitness", label: "Fitness & Health" },
  { value: "beauty", label: "Beauty & Fashion" },
  { value: "food", label: "Food & Cooking" },
  { value: "finance", label: "Finance & Investing" },
  { value: "education", label: "Education & Learning" },
  { value: "travel", label: "Travel & Lifestyle" },
  { value: "home", label: "Home & Garden" },
  { value: "entertainment", label: "Entertainment" },
  { value: "other", label: "Other" },
];

export default function CreatorOnboarding() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Step 1: Profile Image
  const [profileImageUrl, setProfileImageUrl] = useState("");

  // Step 2: Niches
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);

  // Step 3: Video Platforms
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeFollowers, setYoutubeFollowers] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [tiktokFollowers, setTiktokFollowers] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [instagramFollowers, setInstagramFollowers] = useState("");

  // Check if user should be here
  useEffect(() => {
    if (user && user.role !== 'creator') {
      setLocation('/company/dashboard');
    }
  }, [user, setLocation]);

  const calculateProgress = () => {
    return ((currentStep - 1) / (STEPS.length - 1)) * 100;
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const isImage = imageExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!isImage) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an image file (JPG, PNG, GIF, WebP)",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5242880) {
      toast({
        title: "File Too Large",
        description: "Image file must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingImage(true);

    try {
      const uploadResponse = await fetch("/api/objects/upload", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ folder: "creatorprofile", resourceType: "image" }),
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to get upload URL");
      }

      const uploadData = await uploadResponse.json();

      const formData = new FormData();
      formData.append('file', file);

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

      const uploadResult = await fetch(uploadData.uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (!uploadResult.ok) {
        throw new Error("Failed to upload file");
      }

      const cloudinaryResponse = await uploadResult.json();
      setProfileImageUrl(cloudinaryResponse.secure_url);

      toast({
        title: "Success!",
        description: "Profile image uploaded successfully.",
      });
    } catch (error) {
      console.error("Image upload error:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const toggleNiche = (niche: string) => {
    setSelectedNiches(prev =>
      prev.includes(niche)
        ? prev.filter(n => n !== niche)
        : [...prev, niche]
    );
  };

  const removeNiche = (niche: string) => {
    setSelectedNiches(prev => prev.filter(n => n !== niche));
  };

  const handleNext = () => {
    if (currentStep === 2 && selectedNiches.length === 0) {
      toast({
        title: "Please Select Niches",
        description: "Select at least one content niche to help us recommend relevant offers.",
        variant: "destructive",
      });
      return;
    }

    if (currentStep === 3) {
      // On last step, go to complete
      handleComplete();
    } else {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
    }
  };

  const handleSkip = () => {
    // Skip entire onboarding and go to browse
    setLocation("/browse");
  };

  const handleComplete = async () => {
    // Validate at least one video platform
    const hasVideoPlatform = youtubeUrl || tiktokUrl || instagramUrl;
    if (!hasVideoPlatform) {
      toast({
        title: "Video Platform Required",
        description: "Please add at least one video platform (YouTube, TikTok, or Instagram) to continue.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        profileImageUrl: profileImageUrl || null,
        niches: selectedNiches,
        youtubeUrl: youtubeUrl || null,
        youtubeFollowers: youtubeFollowers ? parseInt(youtubeFollowers) : null,
        tiktokUrl: tiktokUrl || null,
        tiktokFollowers: tiktokFollowers ? parseInt(tiktokFollowers) : null,
        instagramUrl: instagramUrl || null,
        instagramFollowers: instagramFollowers ? parseInt(instagramFollowers) : null,
      };

      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save profile");
      }

      toast({
        title: "Success!",
        description: "Your profile has been set up. Let's find some offers!",
      });

      // Refresh user data and redirect
      await queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      setTimeout(() => {
        setLocation("/browse");
      }, 1000);
    } catch (error: any) {
      console.error("Onboarding error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <Alert>
              <Sparkles className="h-4 w-4" />
              <AlertTitle>Welcome to AffiliateXchange!</AlertTitle>
              <AlertDescription>
                Let's set up your creator profile. This helps companies find you and recommend relevant offers.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <Label>Profile Image (Optional)</Label>
              <p className="text-sm text-muted-foreground">
                Upload a profile picture to personalize your account
              </p>

              <div className="flex flex-col items-center gap-4">
                {profileImageUrl ? (
                  <div className="relative">
                    <Avatar className="h-32 w-32">
                      <AvatarImage src={profileImageUrl} alt="Profile" />
                      <AvatarFallback className="text-2xl">
                        {user?.firstName?.[0] || user?.username?.[0] || 'C'}
                      </AvatarFallback>
                    </Avatar>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2"
                      onClick={() => setProfileImageUrl("")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="w-full">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={isUploadingImage}
                      className="hidden"
                      id="image-upload"
                    />
                    <label
                      htmlFor="image-upload"
                      className={`border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer block ${
                        isUploadingImage ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        {isUploadingImage ? (
                          <>
                            <Upload className="h-8 w-8 text-blue-600 animate-pulse" />
                            <div className="text-sm font-medium text-blue-600">
                              Uploading Image...
                            </div>
                          </>
                        ) : (
                          <>
                            <Upload className="h-8 w-8 text-primary" />
                            <div className="text-sm font-medium">
                              Click to upload profile image
                            </div>
                            <div className="text-xs text-muted-foreground">
                              JPG, PNG, GIF, WebP (max 5MB)
                            </div>
                          </>
                        )}
                      </div>
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Select Your Content Niches</AlertTitle>
              <AlertDescription>
                Choose the categories that best describe your content. This helps us recommend offers that match your audience.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <Label>Content Niches <span className="text-red-500">*</span></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                  >
                    {selectedNiches.length === 0 ? (
                      <span className="text-muted-foreground">Select your content niches...</span>
                    ) : (
                      <span>{selectedNiches.length} niche{selectedNiches.length !== 1 ? 's' : ''} selected</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <div className="max-h-[300px] overflow-y-auto p-4 space-y-2">
                    {AVAILABLE_NICHES.map((niche) => (
                      <div key={niche.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`niche-${niche.value}`}
                          checked={selectedNiches.includes(niche.value)}
                          onCheckedChange={() => toggleNiche(niche.value)}
                        />
                        <label
                          htmlFor={`niche-${niche.value}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                        >
                          {niche.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {selectedNiches.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedNiches.map((nicheValue) => {
                    const niche = AVAILABLE_NICHES.find(n => n.value === nicheValue);
                    return (
                      <Badge key={nicheValue} variant="secondary" className="gap-1">
                        {niche?.label || nicheValue}
                        <button
                          type="button"
                          onClick={() => removeNiche(nicheValue)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Select at least one niche. You can add more or change them later in settings.
              </p>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <Alert className={!youtubeUrl && !tiktokUrl && !instagramUrl ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'}>
              <Video className={`h-5 w-5 ${!youtubeUrl && !tiktokUrl && !instagramUrl ? 'text-red-600' : 'text-blue-600'}`} />
              <AlertTitle className={!youtubeUrl && !tiktokUrl && !instagramUrl ? 'text-red-900 dark:text-red-300' : 'text-blue-900 dark:text-blue-300'}>
                {!youtubeUrl && !tiktokUrl && !instagramUrl ? '⚠️ Video Platform Required' : '✓ Video Platform Added'}
              </AlertTitle>
              <AlertDescription className={!youtubeUrl && !tiktokUrl && !instagramUrl ? 'text-red-800 dark:text-red-200' : 'text-blue-800 dark:text-blue-200'}>
                {!youtubeUrl && !tiktokUrl && !instagramUrl ? (
                  <>
                    <strong>Add at least one video platform to continue.</strong>
                    <br />
                    We only accept video content creators (YouTube, TikTok, or Instagram Reels).
                  </>
                ) : (
                  <>
                    <strong>Great!</strong> You've added a video platform. Companies can now see your reach.
                  </>
                )}
              </AlertDescription>
            </Alert>

            <div className="space-y-6">
              {/* YouTube */}
              <div className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-red-500 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">YT</span>
                  </div>
                  <Label className="text-base font-semibold">YouTube</Label>
                </div>
                <Input
                  type="url"
                  placeholder="https://youtube.com/@yourchannel"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Subscriber count"
                  value={youtubeFollowers}
                  onChange={(e) => setYoutubeFollowers(e.target.value)}
                />
              </div>

              {/* TikTok */}
              <div className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-black dark:bg-white flex items-center justify-center">
                    <span className="text-white dark:text-black font-bold text-sm">TT</span>
                  </div>
                  <Label className="text-base font-semibold">TikTok</Label>
                </div>
                <Input
                  type="url"
                  placeholder="https://tiktok.com/@yourusername"
                  value={tiktokUrl}
                  onChange={(e) => setTiktokUrl(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Follower count"
                  value={tiktokFollowers}
                  onChange={(e) => setTiktokFollowers(e.target.value)}
                />
              </div>

              {/* Instagram */}
              <div className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">IG</span>
                  </div>
                  <Label className="text-base font-semibold">Instagram</Label>
                </div>
                <Input
                  type="url"
                  placeholder="https://instagram.com/yourusername"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Follower count"
                  value={instagramFollowers}
                  onChange={(e) => setInstagramFollowers(e.target.value)}
                />
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <img src="/logo.png" alt="AffiliateXchange Logo" className="h-10 w-10 rounded-md object-cover" />
            <span className="text-2xl font-bold">AffiliateXchange</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Creator Profile Setup</h1>
          <p className="text-muted-foreground">Let's get you started with affiliate offers</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {STEPS.map((step, index) => (
              <div
                key={step.id}
                className={`flex-1 text-center ${index < STEPS.length - 1 ? 'mr-2' : ''}`}
              >
                <div
                  className={`text-xs font-medium mb-1 ${
                    currentStep >= step.id ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {step.title}
                </div>
              </div>
            ))}
          </div>
          <Progress value={calculateProgress()} className="h-2" />
          <div className="text-center mt-2 text-sm text-muted-foreground">
            Step {currentStep} of {STEPS.length}
          </div>
        </div>

        {/* Content Card */}
        <Card>
          <CardHeader>
            <CardTitle>{STEPS[currentStep - 1].title}</CardTitle>
            <CardDescription>{STEPS[currentStep - 1].description}</CardDescription>
          </CardHeader>
          <CardContent>
            {renderStepContent()}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t">
              <Button
                variant="outline"
                onClick={handleSkip}
                disabled={isSubmitting}
              >
                Skip for Now
              </Button>

              <Button
                onClick={handleNext}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  "Saving..."
                ) : currentStep === STEPS.length ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Complete Setup
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Help Text */}
        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>You can always update your profile later in Settings</p>
        </div>
      </div>
    </div>
  );
}
