import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Heart, Star, Play, X, Search } from "lucide-react";
import { Link } from "wouter";
import { proxiedSrc } from "../lib/image";
import { apiRequest, queryClient } from "../lib/queryClient";
import { TopNavBar } from "../components/TopNavBar";
import { CardGridSkeleton } from "../components/skeletons";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [commissionFilter, setCommissionFilter] = useState("all");

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

  const commissionTypes = useMemo(() => {
    if (!favorites) return [];

    const unique = new Set<string>();

    favorites.forEach((favorite) => {
      const type = favorite.offer?.commissionType;
      if (type) {
        unique.add(type);
      }
    });

    return Array.from(unique).sort();
  }, [favorites]);

  const filteredFavorites = useMemo(() => {
    if (!favorites) return [];

    const normalizedSearch = searchTerm.trim().toLowerCase();

    return favorites.filter((favorite) => {
      const offer = favorite.offer;

      if (!offer) {
        return false;
      }

      if (commissionFilter !== "all" && offer.commissionType !== commissionFilter) {
        return false;
      }

      if (normalizedSearch.length === 0) {
        return true;
      }

      const searchableContent = [
        offer.title,
        offer.company?.tradeName,
        offer.shortDescription,
        offer.commissionType?.replace(/_/g, " "),
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());

      return searchableContent.some((content) => content.includes(normalizedSearch));
    });
  }, [commissionFilter, favorites, searchTerm]);

  const hasActiveFilters =
    searchTerm.trim().length > 0 || commissionFilter !== "all";

  const clearFilters = () => {
    setSearchTerm("");
    setCommissionFilter("all");
  };

  const totalFavorites = favorites?.length ?? 0;
  const displayCount = hasActiveFilters ? filteredFavorites.length : totalFavorites;
  const hasFavorites = totalFavorites > 0;
  const noFilteredResults = hasFavorites && filteredFavorites.length === 0;

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-lg">Loading...</div>
    </div>;
  }

  return (
    <div className="space-y-6">
      <TopNavBar />
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Favorite Offers</h1>
        <p className="text-muted-foreground mt-1">
          {hasFavorites
            ? `${displayCount} saved ${displayCount === 1 ? 'offer' : 'offers'}`
            : 'Your saved offers for later'
          }
        </p>
      </div>

      <div className="space-y-4 rounded-lg border border-card-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-1 flex-col gap-4 md:flex-row md:items-end">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="favorites-search" className="text-sm font-medium text-muted-foreground">
                Search favorites
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="favorites-search"
                  placeholder="Search by offer or company"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-9"
                  data-testid="input-favorites-search"
                />
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-2 md:max-w-xs">
              <Label htmlFor="favorites-commission-filter" className="text-sm font-medium text-muted-foreground">
                Commission type
              </Label>
              <Select
                value={commissionFilter}
                onValueChange={setCommissionFilter}
              >
                <SelectTrigger id="favorites-commission-filter" data-testid="select-favorites-commission">
                  <SelectValue placeholder="All commission types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All commission types</SelectItem>
                  {commissionTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="self-start"
              data-testid="button-clear-favorites-filters"
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Favorites Grid */}
      {favoritesLoading ? (
        <CardGridSkeleton count={8} />
      ) : !hasFavorites ? (
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
      ) : noFilteredResults ? (
        <Card className="border-card-border">
          <CardContent className="p-12 text-center">
            <Search className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">No favorites match your filters</h3>
            <p className="text-muted-foreground mb-4">Try adjusting your search or filter selections</p>
            <Button variant="ghost" onClick={clearFilters} data-testid="button-clear-favorites-empty">
              Clear filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredFavorites.map((favorite: any) => {
            const offer = favorite.offer;

            return (
              <Link key={favorite.id} href={`/offers/${offer.id}`}>
                <Card className="hover-elevate cursor-pointer border-card-border h-full" data-testid={`favorite-${offer.id}`}>
                  <div className="aspect-video relative bg-muted rounded-t-lg overflow-hidden">
                    {offer.featuredImageUrl ? (
                      <img src={proxiedSrc(offer.featuredImageUrl)} alt={offer.title} className="w-full h-full object-cover" />
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