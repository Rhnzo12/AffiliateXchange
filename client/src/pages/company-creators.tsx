import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Users, MessageSquare, TrendingUp, ExternalLink, Filter, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { TopNavBar } from "../components/TopNavBar";
import { apiRequest } from "../lib/queryClient";

export default function CompanyCreators() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [offerFilter, setOfferFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");

  const startConversationMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      const response = await apiRequest('POST', '/api/conversations/start', { applicationId });
      return response.json();
    },
    onSuccess: (data: any) => {
      // Redirect to company messages with conversation selected
      setLocation(`/company/messages?conversation=${data.conversationId}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start conversation",
        variant: "destructive",
      });
    },
  });

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

  const { data: applications = [], isLoading: loadingCreators } = useQuery<any[]>({
    queryKey: ["/api/company/applications"],
    enabled: isAuthenticated,
  });

  // Get unique creators from approved applications
  const creators = applications
    .filter((app: any) => app.status === 'approved' && app.creator)
    .reduce((acc: any[], app: any) => {
      const existing = acc.find(c => c.id === app.creator.id);
      if (!existing) {
        acc.push({
          ...app.creator,
          applications: [app],
          totalClicks: app.clickCount || 0,
          totalConversions: app.conversionCount || 0,
          totalEarnings: parseFloat(app.totalEarnings || '0'),
        });
      } else {
        existing.applications.push(app);
        existing.totalClicks += app.clickCount || 0;
        existing.totalConversions += app.conversionCount || 0;
        existing.totalEarnings += parseFloat(app.totalEarnings || '0');
      }
      return acc;
    }, []);

  const uniqueOfferOptions = useMemo(() => {
    const map = new Map<string, string>();
    creators.forEach((creator: any) => {
      creator.applications.forEach((application: any) => {
        if (application.offer?.id && application.offer?.title) {
          map.set(application.offer.id, application.offer.title);
        }
      });
    });
    return Array.from(map.entries());
  }, [creators]);

  const filteredCreators = useMemo(() => {
    return creators.filter((creator: any) => {
      const matchesSearch = searchTerm
        ? [
            creator.firstName,
            creator.lastName,
            creator.bio,
            creator.applications.map((app: any) => app.offer?.title).join(" "),
          ]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(searchTerm.toLowerCase()))
        : true;

      const matchesOffer =
        offerFilter === "all" ||
        creator.applications.some((application: any) => application.offer?.id === offerFilter);

      const matchesPlatform = (() => {
        if (platformFilter === "all") return true;
        if (platformFilter === "youtube") return Boolean(creator.youtubeUrl);
        if (platformFilter === "tiktok") return Boolean(creator.tiktokUrl);
        if (platformFilter === "instagram") return Boolean(creator.instagramUrl);
        return true;
      })();

      return matchesSearch && matchesOffer && matchesPlatform;
    });
  }, [creators, offerFilter, platformFilter, searchTerm]);

  const hasActiveFilters =
    searchTerm.trim().length > 0 || offerFilter !== "all" || platformFilter !== "all";

  const clearFilters = () => {
    setSearchTerm("");
    setOfferFilter("all");
    setPlatformFilter("all");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <TopNavBar />
      <div>
        <h1 className="text-3xl font-bold">Creators</h1>
        <p className="text-muted-foreground mt-1">
          Manage relationships with creators promoting your offers
        </p>
      </div>

      <Card className="border-card-border">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-semibold uppercase tracking-wider">Search & Filter</span>
            </div>
            <div className="sm:ml-auto text-sm text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{filteredCreators.length}</span> of {creators.length}
              {` creator${creators.length === 1 ? "" : "s"}`}
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="text-xs sm:ml-4" onClick={clearFilters}>
                <X className="h-3 w-3 mr-1" />
                Clear Filters
              </Button>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <Input
                placeholder="Search by creator, bio, or offer"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Offer</label>
              <Select value={offerFilter} onValueChange={setOfferFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All offers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Offers</SelectItem>
                  {uniqueOfferOptions.map(([id, title]) => (
                    <SelectItem key={id} value={id}>
                      {title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Platform</label>
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All platforms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loadingCreators ? (
        <div className="text-center py-12">
          <div className="animate-pulse text-lg text-muted-foreground">
            Loading creators...
          </div>
        </div>
      ) : creators.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No active creators yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Approved creators will appear here when they start promoting your offers
            </p>
          </CardContent>
        </Card>
      ) : filteredCreators.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-3">
            <Users className="h-12 w-12 text-muted-foreground/40" />
            <h3 className="text-lg font-semibold">No creators match your filters</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Try updating your search query or clearing your selected filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredCreators.map((creator: any) => (
            <Card key={creator.id} className="border-card-border" data-testid={`card-creator-${creator.id}`}>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={creator.profileImageUrl} />
                    <AvatarFallback>
                      {creator.firstName?.[0] || 'C'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg line-clamp-1">
                      {creator.firstName || 'Creator'}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {creator.applications.length} active {creator.applications.length === 1 ? 'offer' : 'offers'}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {creator.bio && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {creator.bio}
                  </p>
                )}

                <div className="grid grid-cols-3 gap-3 pt-3 border-t">
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">Clicks</div>
                    <div className="text-sm font-semibold">{creator.totalClicks}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">Conversions</div>
                    <div className="text-sm font-semibold">{creator.totalConversions}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">Earned</div>
                    <div className="text-sm font-semibold">${creator.totalEarnings.toFixed(2)}</div>
                  </div>
                </div>

                {(creator.youtubeUrl || creator.tiktokUrl || creator.instagramUrl) && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {creator.youtubeUrl && (
                      <Badge variant="outline" className="gap-1">
                        <ExternalLink className="h-3 w-3" />
                        YouTube
                      </Badge>
                    )}
                    {creator.tiktokUrl && (
                      <Badge variant="outline" className="gap-1">
                        <ExternalLink className="h-3 w-3" />
                        TikTok
                      </Badge>
                    )}
                    {creator.instagramUrl && (
                      <Badge variant="outline" className="gap-1">
                        <ExternalLink className="h-3 w-3" />
                        Instagram
                      </Badge>
                    )}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    data-testid={`button-message-${creator.id}`}
                    onClick={() => startConversationMutation.mutate(creator.applications[0].id)}
                    disabled={startConversationMutation.isPending}
                  >
                    <MessageSquare className="h-4 w-4" />
                    Message
                  </Button>
                  <Link href="/company/analytics" className="flex-1">
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      data-testid={`button-analytics-${creator.id}`}
                    >
                      <TrendingUp className="h-4 w-4" />
                      Analytics
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
