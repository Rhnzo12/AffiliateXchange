import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Separator } from "../components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Upload, Building2, X, ChevronsUpDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Checkbox } from "../components/ui/checkbox";
import { Badge } from "../components/ui/badge";

// Available niche options - MUST match offer niche values for recommendations to work
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

export default function Settings() {
  const { toast } = useToast();
  const { isAuthenticated, user } = useAuth();
  
  // Creator profile states
  const [bio, setBio] = useState("");
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [youtubeFollowers, setYoutubeFollowers] = useState("");
  const [tiktokFollowers, setTiktokFollowers] = useState("");
  const [instagramFollowers, setInstagramFollowers] = useState("");
  
  // Company profile states
  const [tradeName, setTradeName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [industry, setIndustry] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");
  const [contactName, setContactName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Account info states
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Password change states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const { data: profile } = useQuery<any>({
    queryKey: ["/api/profile"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (user) {
      // Load user account data
      setUsername(user.username || "");
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
    }
  }, [user]);

  useEffect(() => {
    if (profile) {
      console.log("[Settings] Profile loaded:", profile);

      // Load creator profile data
      if (user?.role === 'creator') {
        setBio(profile.bio || "");
        setSelectedNiches(profile.niches || []);
        setYoutubeUrl(profile.youtubeUrl || "");
        setTiktokUrl(profile.tiktokUrl || "");
        setInstagramUrl(profile.instagramUrl || "");
        setYoutubeFollowers(profile.youtubeFollowers?.toString() || "");
        setTiktokFollowers(profile.tiktokFollowers?.toString() || "");
        setInstagramFollowers(profile.instagramFollowers?.toString() || "");
      }

      // Load company profile data
      if (user?.role === 'company') {
        setTradeName(profile.tradeName || "");
        setLegalName(profile.legalName || "");
        setLogoUrl(profile.logoUrl || "");
        setIndustry(profile.industry || "");
        setWebsiteUrl(profile.websiteUrl || "");
        setCompanyDescription(profile.description || "");
        setContactName(profile.contactName || "");
        setPhoneNumber(profile.phoneNumber || "");
      }
    }
  }, [profile, user?.role]);

  // Handle logo upload
  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
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

    // Validate file size (5MB limit)
    if (file.size > 5242880) {
      toast({
        title: "File Too Large",
        description: "Image file must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingLogo(true);

    try {
      // Get upload URL from backend
      const uploadResponse = await fetch("/api/objects/upload", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ folder: "company-logos", resourceType: "image" }),
      });
      
      if (!uploadResponse.ok) {
        throw new Error("Failed to get upload URL");
      }
      
      const uploadData = await uploadResponse.json();

      // Upload file to Cloudinary
      const formData = new FormData();
      formData.append('file', file);

      if (uploadData.uploadPreset) {
        formData.append('upload_preset', uploadData.uploadPreset);
      } else if (uploadData.signature) {
        formData.append('signature', uploadData.signature);
        formData.append('timestamp', uploadData.timestamp.toString());
        formData.append('api_key', uploadData.apiKey);
        formData.append('resource_type', 'image');
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
      const uploadedUrl = cloudinaryResponse.secure_url;
      
      // Set the logo URL
      setLogoUrl(uploadedUrl);
      
      toast({
        title: "Success!",
        description: "Logo uploaded successfully. Don't forget to save your changes.",
      });
    } catch (error) {
      console.error("Logo upload error:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload logo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      queryClient.clear();
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        title: "Error",
        description: "Failed to logout. Please try again.",
        variant: "destructive",
      });
      setIsLoggingOut(false);
    }
  };

  // Toggle niche selection
  const toggleNiche = (niche: string) => {
    setSelectedNiches(prev =>
      prev.includes(niche)
        ? prev.filter(n => n !== niche)
        : [...prev, niche]
    );
  };

  // Remove a specific niche
  const removeNiche = (niche: string) => {
    setSelectedNiches(prev => prev.filter(n => n !== niche));
  };

  const updateAccountMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        username: username.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      };

      if (!payload.username) {
        throw new Error("Username is required");
      }

      const result = await apiRequest("PUT", "/api/auth/account", payload);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Success",
        description: "Account information updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update account information",
        variant: "destructive",
      });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (!currentPassword) {
        throw new Error("Current password is required");
      }

      if (!newPassword) {
        throw new Error("New password is required");
      }

      if (newPassword.length < 8) {
        throw new Error("New password must be at least 8 characters");
      }

      if (newPassword !== confirmPassword) {
        throw new Error("Passwords do not match");
      }

      const payload = {
        currentPassword,
        newPassword,
      };

      const result = await apiRequest("PUT", "/api/auth/password", payload);
      return result;
    },
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({
        title: "Success",
        description: "Password changed successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      let payload: any = {};

      // Creator profile payload
      if (user?.role === 'creator') {
        console.log("[Settings] Saving niches:", selectedNiches);

        payload = {
          bio,
          niches: selectedNiches,
          youtubeUrl,
          tiktokUrl,
          instagramUrl,
          youtubeFollowers: youtubeFollowers ? parseInt(youtubeFollowers) : null,
          tiktokFollowers: tiktokFollowers ? parseInt(tiktokFollowers) : null,
          instagramFollowers: instagramFollowers ? parseInt(instagramFollowers) : null,
        };
      }

      // Company profile payload
      if (user?.role === 'company') {
        payload = {
          tradeName,
          legalName,
          logoUrl,
          industry,
          websiteUrl,
          description: companyDescription,
          contactName,
          phoneNumber,
        };
      }

      console.log("[Settings] API payload:", payload);

      const result = await apiRequest("PUT", "/api/profile", payload);
      console.log("[Settings] API response:", result);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account preferences</p>
      </div>

      <Card className="border-card-border">
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage
                src={user?.profileImageUrl || ''}
                alt={user?.firstName || 'User'}
                referrerPolicy="no-referrer"
              />
              <AvatarFallback className="text-lg">{user?.firstName?.[0] || user?.email?.[0] || 'U'}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-semibold">{user?.firstName} {user?.lastName}</div>
              <div className="text-sm text-muted-foreground">{user?.email}</div>
              <div className="text-xs text-muted-foreground capitalize mt-1">{user?.role} Account</div>
            </div>
          </div>

          <Separator />

          {/* COMPANY PROFILE SECTION */}
          {user?.role === 'company' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="tradeName" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Company Name (Trade Name) *
                </Label>
                <Input
                  id="tradeName"
                  type="text"
                  placeholder="Your Company Name"
                  value={tradeName}
                  onChange={(e) => setTradeName(e.target.value)}
                  data-testid="input-trade-name"
                />
                <p className="text-xs text-muted-foreground">
                  This is the name that will appear on all your offers
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="logoUrl">Company Logo *</Label>
                <div className="space-y-4">
                  {logoUrl ? (
                    <div className="relative inline-block">
                      <div className="flex items-center gap-4 p-4 border rounded-lg">
                        <Avatar className="h-24 w-24">
                          <AvatarImage src={logoUrl} alt={tradeName || 'Company logo'} />
                          <AvatarFallback className="text-2xl">
                            {tradeName?.[0] || 'C'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">Current Logo</p>
                          <p className="text-sm text-muted-foreground">This logo will appear on all your offers</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2"
                        onClick={() => setLogoUrl("")}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        disabled={isUploadingLogo}
                        className="hidden"
                        id="logo-upload"
                      />
                      <label
                        htmlFor="logo-upload"
                        className={`border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer block ${
                          isUploadingLogo ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <div className="flex flex-col items-center gap-2">
                          {isUploadingLogo ? (
                            <>
                              <Upload className="h-8 w-8 text-blue-600 animate-pulse" />
                              <div className="text-sm font-medium text-blue-600">
                                Uploading Logo...
                              </div>
                            </>
                          ) : (
                            <>
                              <Upload className="h-8 w-8 text-primary" />
                              <div className="text-sm font-medium">
                                Click to upload company logo
                              </div>
                              <div className="text-xs text-muted-foreground">
                                JPG, PNG, GIF, WebP (max 5MB)
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Recommended: 500x500px or larger, square format
                              </div>
                            </>
                          )}
                        </div>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="legalName">Legal Company Name</Label>
                <Input
                  id="legalName"
                  type="text"
                  placeholder="Official registered company name"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  data-testid="input-legal-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger id="industry" data-testid="select-industry">
                    <SelectValue placeholder="Select your industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technology">Technology</SelectItem>
                    <SelectItem value="ecommerce">E-commerce</SelectItem>
                    <SelectItem value="fashion">Fashion & Apparel</SelectItem>
                    <SelectItem value="beauty">Beauty & Cosmetics</SelectItem>
                    <SelectItem value="health">Health & Wellness</SelectItem>
                    <SelectItem value="fitness">Fitness</SelectItem>
                    <SelectItem value="food">Food & Beverage</SelectItem>
                    <SelectItem value="travel">Travel & Hospitality</SelectItem>
                    <SelectItem value="finance">Finance & Insurance</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                    <SelectItem value="entertainment">Entertainment</SelectItem>
                    <SelectItem value="gaming">Gaming</SelectItem>
                    <SelectItem value="home">Home & Garden</SelectItem>
                    <SelectItem value="automotive">Automotive</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="websiteUrl">Company Website</Label>
                <Input
                  id="websiteUrl"
                  type="url"
                  placeholder="https://yourcompany.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  data-testid="input-website-url"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyDescription">Company Description</Label>
                <Textarea
                  id="companyDescription"
                  placeholder="Tell creators about your company, products, and what makes you unique..."
                  value={companyDescription}
                  onChange={(e) => setCompanyDescription(e.target.value)}
                  className="min-h-32"
                  data-testid="textarea-company-description"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contactName">Contact Name</Label>
                  <Input
                    id="contactName"
                    type="text"
                    placeholder="Primary contact person"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    data-testid="input-contact-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    data-testid="input-phone-number"
                  />
                </div>
              </div>

              {/* Show warning if critical fields are missing */}
              {(!tradeName || !logoUrl) && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-800">
                    <strong>⚠️ Important:</strong> Please fill in your Company Name and upload a Logo. 
                    These are required for your offers to display properly.
                  </p>
                </div>
              )}

              <Button
                onClick={() => updateProfileMutation.mutate()}
                disabled={updateProfileMutation.isPending}
                data-testid="button-save-profile"
              >
                {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </>
          )}

          {/* CREATOR PROFILE SECTION */}
          {user?.role === 'creator' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  placeholder="Tell companies about yourself and your audience..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="min-h-24"
                  data-testid="textarea-bio"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="niches">Content Niches</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                      data-testid="button-select-niches"
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

                {/* Display selected niches as badges */}
                {selectedNiches.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
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
                  Your niches help us recommend relevant offers. Select all that apply to your content.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="youtube">YouTube Channel URL</Label>
                  <Input
                    id="youtube"
                    type="url"
                    placeholder="https://youtube.com/@yourchannel"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    data-testid="input-youtube"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="youtube-followers">YouTube Subscribers</Label>
                  <Input
                    id="youtube-followers"
                    type="number"
                    placeholder="10000"
                    value={youtubeFollowers}
                    onChange={(e) => setYoutubeFollowers(e.target.value)}
                    data-testid="input-youtube-followers"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="tiktok">TikTok Profile URL</Label>
                  <Input
                    id="tiktok"
                    type="url"
                    placeholder="https://tiktok.com/@yourusername"
                    value={tiktokUrl}
                    onChange={(e) => setTiktokUrl(e.target.value)}
                    data-testid="input-tiktok"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tiktok-followers">TikTok Followers</Label>
                  <Input
                    id="tiktok-followers"
                    type="number"
                    placeholder="50000"
                    value={tiktokFollowers}
                    onChange={(e) => setTiktokFollowers(e.target.value)}
                    data-testid="input-tiktok-followers"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="instagram">Instagram Profile URL</Label>
                  <Input
                    id="instagram"
                    type="url"
                    placeholder="https://instagram.com/yourusername"
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                    data-testid="input-instagram"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instagram-followers">Instagram Followers</Label>
                  <Input
                    id="instagram-followers"
                    type="number"
                    placeholder="25000"
                    value={instagramFollowers}
                    onChange={(e) => setInstagramFollowers(e.target.value)}
                    data-testid="input-instagram-followers"
                  />
                </div>
              </div>

              <Button
                onClick={() => updateProfileMutation.mutate()}
                disabled={updateProfileMutation.isPending}
                data-testid="button-save-profile"
              >
                {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-card-border">
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username *</Label>
            <Input
              id="username"
              type="text"
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              data-testid="input-username"
            />
            <p className="text-xs text-muted-foreground">
              Your unique username for the platform
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                type="text"
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                data-testid="input-first-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                type="text"
                placeholder="Doe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                data-testid="input-last-name"
              />
            </div>
          </div>

          <Button
            onClick={() => updateAccountMutation.mutate()}
            disabled={updateAccountMutation.isPending}
            data-testid="button-save-account"
          >
            {updateAccountMutation.isPending ? "Saving..." : "Save Account Info"}
          </Button>
        </CardContent>
      </Card>

      {!user?.googleId && (
        <Card className="border-card-border">
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password *</Label>
              <Input
                id="currentPassword"
                type="password"
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                data-testid="input-current-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password *</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Enter new password (min 8 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                data-testid="input-new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password *</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                data-testid="input-confirm-password"
              />
            </div>

            <Button
              onClick={() => changePasswordMutation.mutate()}
              disabled={changePasswordMutation.isPending}
              data-testid="button-change-password"
            >
              {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-card-border">
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Log Out</div>
              <div className="text-sm text-muted-foreground">Sign out of your account</div>
            </div>
            <Button
              variant="outline"
              onClick={handleLogout}
              disabled={isLoggingOut}
              data-testid="button-logout"
            >
              {isLoggingOut ? "Logging out..." : "Log Out"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}