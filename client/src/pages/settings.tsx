import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Settings() {
  const { toast } = useToast();
  const { isAuthenticated, user } = useAuth();
  const [bio, setBio] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [youtubeFollowers, setYoutubeFollowers] = useState("");
  const [tiktokFollowers, setTiktokFollowers] = useState("");
  const [instagramFollowers, setInstagramFollowers] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const { data: profile } = useQuery<any>({
    queryKey: ["/api/profile"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (profile) {
      setBio(profile.bio || "");
      setYoutubeUrl(profile.youtubeUrl || "");
      setTiktokUrl(profile.tiktokUrl || "");
      setInstagramUrl(profile.instagramUrl || "");
      setYoutubeFollowers(profile.youtubeFollowers?.toString() || "");
      setTiktokFollowers(profile.tiktokFollowers?.toString() || "");
      setInstagramFollowers(profile.instagramFollowers?.toString() || "");
    }
  }, [profile]);

  // ✅ FIXED: This is the corrected logout function
  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      
      // Call logout endpoint with POST request
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      // Clear all cached queries
      queryClient.clear();
      
      // Redirect to login page
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

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("PUT", "/api/profile", {
        bio,
        youtubeUrl,
        tiktokUrl,
        instagramUrl,
        youtubeFollowers: youtubeFollowers ? parseInt(youtubeFollowers) : null,
        tiktokFollowers: tiktokFollowers ? parseInt(tiktokFollowers) : null,
        instagramFollowers: instagramFollowers ? parseInt(instagramFollowers) : null,
      });
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
              <AvatarImage src={user?.profileImageUrl || ''} alt={user?.firstName || 'User'} />
              <AvatarFallback className="text-lg">{user?.firstName?.[0] || user?.email?.[0] || 'U'}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-semibold">{user?.firstName} {user?.lastName}</div>
              <div className="text-sm text-muted-foreground">{user?.email}</div>
              <div className="text-xs text-muted-foreground capitalize mt-1">{user?.role} Account</div>
            </div>
          </div>

          <Separator />

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