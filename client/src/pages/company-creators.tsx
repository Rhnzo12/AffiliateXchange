import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, MessageSquare, TrendingUp, ExternalLink } from "lucide-react";
import { Link } from "wouter";

export default function CompanyCreators() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Creators</h1>
        <p className="text-muted-foreground mt-1">
          Manage relationships with creators promoting your offers
        </p>
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
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {creators.map((creator: any) => (
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
                  <Link href="/company/messages" className="flex-1">
                    <Button 
                      variant="outline" 
                      className="w-full gap-2"
                      data-testid={`button-message-${creator.id}`}
                    >
                      <MessageSquare className="h-4 w-4" />
                      Message
                    </Button>
                  </Link>
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
