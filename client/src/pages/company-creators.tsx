import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Users, MessageSquare, TrendingUp, ExternalLink, Search, SlidersHorizontal } from "lucide-react";
import { Link, useLocation } from "wouter";
import { TopNavBar } from "../components/TopNavBar";
import { apiRequest } from "../lib/queryClient";

export default function CompanyCreators() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [offerFilter, setOfferFilter] = useState("all");

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
  const creators = useMemo(() => {
    return applications
      .filter((app: any) => app.status === 'approved' && app.creator)
      .reduce((acc: any[], app: any) => {
        const existing = acc.find((creator: any) => creator.id === app.creator.id);
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
  }, [applications]);

  const platformOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    if (creators.some((creator: any) => creator.youtubeUrl)) {
      options.push({ value: "youtube", label: "YouTube" });
    }
    if (creators.some((creator: any) => creator.tiktokUrl)) {
      options.push({ value: "tiktok", label: "TikTok" });
    }
    if (creators.some((creator: any) => creator.instagramUrl)) {
      options.push({ value: "instagram", label: "Instagram" });
    }
    return options;
  }, [creators]);

  const offerOptions = useMemo(() => {
    const uniqueOffers = new Map<string, string>();
    for (const creator of creators) {
      for (const application of creator.applications || []) {
        const offerId = application.offer?.id;
        if (offerId && !uniqueOffers.has(offerId)) {
          uniqueOffers.set(offerId, application.offer?.title || "Untitled Offer");
        }
      }
    }
    return Array.from(uniqueOffers.entries());
  }, [creators]);

  const filteredCreators = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return creators.filter((creator: any) => {
      const matchesPlatform =
        platformFilter === "all" ||
        (platformFilter === "youtube" && creator.youtubeUrl) ||
        (platformFilter === "tiktok" && creator.tiktokUrl) ||
        (platformFilter === "instagram" && creator.instagramUrl);

      if (!matchesPlatform) {
        return false;
      }

      const matchesOffer =
        offerFilter === "all" ||
        creator.applications?.some((application: any) => application.offer?.id === offerFilter);

      if (!matchesOffer) {
        return false;
      }

      if (normalizedSearch.length === 0) {
        return true;
      }

      const searchableContent = [
        creator.firstName,
        creator.lastName,
        creator.bio,
        creator.email,
        creator.applications
          ?.map((application: any) => application.offer?.title)
          .filter(Boolean)
          .join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableContent.includes(normalizedSearch);
    });
  }, [creators, offerFilter, platformFilter, searchTerm]);

  const hasActiveFilters =
    searchTerm.trim().length > 0 || platformFilter !== "all" || offerFilter !== "all";

  const handleClearFilters = () => {
    setSearchTerm("");
    setPlatformFilter("all");
    setOfferFilter("all");
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
          Manage relationships with creators promoting your offers ({creators.length} total)
        </p>
        {creators.length > 0 && filteredCreators.length !== creators.length && (
          <p className="text-sm text-muted-foreground mt-1">
            Showing {filteredCreators.length} creator{filteredCreators.length === 1 ? "" : "s"} that
            match your filters
          </p>
        )}
      </div>

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
      ) : (
        <div className="space-y-6">
          <Card className="border border-card-border bg-muted/30">
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="w-full lg:max-w-sm">
                  <Label htmlFor="creator-search" className="flex items-center gap-2 text-sm font-medium">
                    <Search className="h-4 w-4" />
                    Search creators
                  </Label>
                  <div className="relative mt-2">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="creator-search"
                      className="pl-9"
                      placeholder="Search by name, offer, or bio"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      data-testid="input-creator-search"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:flex lg:flex-row lg:items-end lg:gap-4">
                  <div className="min-w-[200px]">
                    <Label htmlFor="platform-filter" className="flex items-center gap-2 text-sm font-medium">
                      <SlidersHorizontal className="h-4 w-4" />
                      Filter by platform
                    </Label>
                    <Select value={platformFilter} onValueChange={setPlatformFilter}>
                      <SelectTrigger id="platform-filter" data-testid="select-platform-filter">
                        <SelectValue placeholder="All platforms" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All platforms</SelectItem>
                        {platformOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="min-w-[200px]">
                    <Label htmlFor="offer-filter" className="flex items-center gap-2 text-sm font-medium">
                      <SlidersHorizontal className="h-4 w-4" />
                      Filter by offer
                    </Label>
                    <Select value={offerFilter} onValueChange={setOfferFilter}>
                      <SelectTrigger id="offer-filter" data-testid="select-creator-offer-filter">
                        <SelectValue placeholder="All offers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All offers</SelectItem>
                        {offerOptions.map(([id, title]) => (
                          <SelectItem key={id} value={id}>
                            {title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {hasActiveFilters && (
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                    data-testid="button-clear-creator-filters"
                  >
                    Clear filters
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {filteredCreators.length === 0 ? (
            <Card className="border-card-border">
              <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <Search className="h-10 w-10 text-muted-foreground/60" />
                <div>
                  <h3 className="text-lg font-semibold">No creators match these filters</h3>
                  <p className="text-sm text-muted-foreground">
                    Try adjusting your search or filters to see more creators.
                  </p>
                </div>
                <Button variant="outline" onClick={handleClearFilters} size="sm">
                  Clear filters
                </Button>
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
      )}
    </div>
  );
}
