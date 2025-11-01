import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, Star, Play, X } from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Helper function to format commission display
const formatCommission = (offer: any) => {
  if (!offer) return "$0";
  
  if (offer.commissionAmount) {
    return `$${offer.commissionAmount}`;
  } else if (offer.commissionPercentage) {
    return `${offer.commissionPercentage}%`;
  } else if (offer.commissionRate) {
    return `$${offer.commissionRate}`;
  }
  return "$0";
};

export default function Favorites() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = "/login";
    }
  }, [isAuthenticated, isLoading]);

  const { data: favorites, isLoading: favoritesLoading } = useQuery<any[]>({
    queryKey: ["/api/favorites"],
    enabled: isAuthenticated,
  });

  const removeFavoriteMutation = useMutation({
    mutationFn: async (offerId: string) => {
      await apiRequest("DELETE", `/api/favorites/${offerId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
      toast({
        title: "Removed from favorites",
        description: "Offer removed from your favorites list",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to remove favorite",
        variant: "destructive",
      });
    },
  });

  const handleRemoveFavorite = (e: React.MouseEvent, offerId: string) => {
    e.preventDefault();
    e.stopPropagation();
    removeFavoriteMutation.mutate(offerId);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-lg">Loading...</div>
    </div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Favorite Offers</h1>
        <p className="text-muted-foreground mt-1">
          {favorites && favorites.length > 0 
            ? `${favorites.length} saved ${favorites.length === 1 ? 'offer' : 'offers'}`
            : 'Your saved offers for later'
          }
        </p>
      </div>

      {/* Favorites Grid */}
      {favoritesLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse border-card-border">
              <div className="aspect-video bg-muted rounded-t-lg" />
              <CardContent className="p-4 space-y-3">
                <div className="h-4 bg-muted rounded" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !favorites || favorites.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="p-12 text-center">
            <Heart className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">No favorites yet</h3>
            <p className="text-muted-foreground mb-4">Save offers by clicking the heart icon</p>
            <Link href="/browse">
              <Button>Browse Offers</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {favorites.map((favorite: any) => {
            const offer = favorite.offer;
            if (!offer) return null; // Skip if offer data is missing
            
            return (
              <Link key={favorite.id} href={`/offers/${offer.id}`}>
                <Card className="hover-elevate cursor-pointer border-card-border h-full" data-testid={`favorite-${offer.id}`}>
                  <div className="aspect-video relative bg-muted rounded-t-lg overflow-hidden">
                    {offer.featuredImageUrl ? (
                      <img src={offer.featuredImageUrl} alt={offer.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play className="h-12 w-12 text-muted-foreground/50" />
                      </div>
                    )}
                    {offer.isPriority && (
                      <Badge className="absolute top-2 right-2 bg-primary">
                        Featured
                      </Badge>
                    )}
                    <button
                      className="absolute top-2 left-2 h-8 w-8 rounded-full bg-red-500/90 backdrop-blur flex items-center justify-center hover:bg-red-600 transition-colors"
                      onClick={(e) => handleRemoveFavorite(e, offer.id)}
                      title="Remove from favorites"
                    >
                      <X className="h-4 w-4 text-white" />
                    </button>
                  </div>

                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold line-clamp-1 flex-1">{offer.title}</h3>
                      {offer.company?.logoUrl && (
                        <img 
                          src={offer.company.logoUrl} 
                          alt={offer.company.tradeName} 
                          className="h-8 w-8 rounded-full object-cover" 
                        />
                      )}
                    </div>
                    
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {offer.shortDescription || offer.description || "No description available"}
                    </p>

                    <div className="flex flex-wrap gap-1">
                      {offer.primaryNiche && (
                        <Badge variant="secondary" className="text-xs">{offer.primaryNiche}</Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Star className="h-3 w-3 fill-primary text-primary" />
                        <span>{offer.company?.averageRating?.toFixed(1) || '5.0'}</span>
                      </div>
                      <div className="font-mono font-semibold text-primary">
                        {formatCommission(offer)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}