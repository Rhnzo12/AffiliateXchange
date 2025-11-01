import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Search, SlidersHorizontal, TrendingUp, DollarSign, Clock, Star, Play, Heart } from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";

const NICHES = [
  "Technology", "Fashion", "Beauty", "Fitness", "Gaming", 
  "Travel", "Food", "Lifestyle", "Business", "Education"
];

const COMMISSION_TYPES = [
  { value: "per_sale", label: "Per Sale" },
  { value: "per_lead", label: "Per Lead" },
  { value: "per_click", label: "Per Click" },
  { value: "monthly_retainer", label: "Monthly Retainer" },
  { value: "hybrid", label: "Hybrid" },
];

// Helper function to format commission display
const formatCommission = (offer: any) => {
  if (offer.commissionAmount) {
    return `$${offer.commissionAmount}`;
  } else if (offer.commissionPercentage) {
    return `${offer.commissionPercentage}%`;
  } else if (offer.commissionRate) {
    return `$${offer.commissionRate}`;
  }
  return "$0";
};

export default function Browse() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [commissionType, setCommissionType] = useState<string>("");
  const [commissionRange, setCommissionRange] = useState([0, 10000]);
  const [sortBy, setSortBy] = useState("newest");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = "/login";
    }
  }, [isAuthenticated, isLoading]);

  const { data: offers, isLoading: offersLoading } = useQuery<any[]>({
    queryKey: ["/api/offers", { search: searchTerm, niches: selectedNiches, commissionType, sortBy }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedNiches.length > 0) params.append('niches', selectedNiches.join(','));
      if (commissionType) params.append('commissionType', commissionType);
      if (sortBy) params.append('sortBy', sortBy);
      
      const url = `/api/offers${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch offers');
      const data = await res.json();
      
      return data;
    },
    enabled: isAuthenticated,
  });

  const toggleNiche = (niche: string) => {
    setSelectedNiches(prev =>
      prev.includes(niche) ? prev.filter(n => n !== niche) : [...prev, niche]
    );
  };

  const clearFilters = () => {
    setSelectedNiches([]);
    setCommissionType("");
    setCommissionRange([0, 10000]);
    setSearchTerm("");
  };

  const { data: favorites = [] } = useQuery<any[]>({
    queryKey: ["/api/favorites"],
    enabled: isAuthenticated,
  });

  const favoriteMutation = useMutation({
    mutationFn: async ({ offerId, isFav }: { offerId: string; isFav: boolean }) => {
      if (isFav) {
        await apiRequest("DELETE", `/api/favorites/${offerId}`);
      } else {
        await apiRequest("POST", "/api/favorites", { offerId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to update favorites",
        variant: "destructive",
      });
    },
  });

  const handleFavoriteToggle = (e: React.MouseEvent, offerId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const isFav = favorites.some(f => f.offerId === offerId);
    favoriteMutation.mutate({ offerId, isFav });
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
        <h1 className="text-3xl font-bold">Browse Offers</h1>
        <p className="text-muted-foreground mt-1">Discover exclusive affiliate opportunities from verified brands</p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search offers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-sort">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="highest_commission">Highest Commission</SelectItem>
            <SelectItem value="most_popular">Most Popular</SelectItem>
            <SelectItem value="trending">Trending</SelectItem>
          </SelectContent>
        </Select>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" data-testid="button-filters" className="gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {(selectedNiches.length > 0 || commissionType) && (
                <Badge variant="secondary" className="ml-1">
                  {selectedNiches.length + (commissionType ? 1 : 0)}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Filter Offers</SheetTitle>
              <SheetDescription>Refine your search with advanced filters</SheetDescription>
            </SheetHeader>

            <div className="space-y-6 mt-6">
              {/* Niche Filter */}
              <div className="space-y-3">
                <Label>Niche/Category</Label>
                <div className="space-y-2">
                  {NICHES.map((niche) => (
                    <div key={niche} className="flex items-center gap-2">
                      <Checkbox
                        id={`niche-${niche}`}
                        checked={selectedNiches.includes(niche)}
                        onCheckedChange={() => toggleNiche(niche)}
                        data-testid={`checkbox-niche-${niche}`}
                      />
                      <Label
                        htmlFor={`niche-${niche}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {niche}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Commission Type */}
              <div className="space-y-3">
                <Label>Commission Type</Label>
                <Select value={commissionType} onValueChange={setCommissionType}>
                  <SelectTrigger data-testid="select-commission-type">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All types</SelectItem>
                    {COMMISSION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Commission Range */}
              <div className="space-y-3">
                <Label>Commission Range</Label>
                <div className="px-2 py-4">
                  <Slider
                    value={commissionRange}
                    onValueChange={setCommissionRange}
                    max={10000}
                    step={100}
                    data-testid="slider-commission"
                  />
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>${commissionRange[0]}</span>
                  <span>${commissionRange[1]}</span>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <Button onClick={clearFilters} variant="outline" className="flex-1" data-testid="button-clear-filters">
                  Clear All
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Offers Grid */}
      {offersLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i} className="animate-pulse">
              <div className="aspect-video bg-muted rounded-t-lg" />
              <CardContent className="p-4 space-y-3">
                <div className="h-4 bg-muted rounded" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !offers || offers.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="p-12 text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">No offers found</h3>
            <p className="text-muted-foreground">Try adjusting your filters or search terms</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {offers.map((offer) => {
            const isFavorite = favorites.some(f => f.offerId === offer.id);
            
            return (
              <Link key={offer.id} href={`/offers/${offer.id}`}>
                <Card className="hover-elevate cursor-pointer border-card-border h-full" data-testid={`card-offer-${offer.id}`}>
                  {/* Thumbnail */}
                  <div className="aspect-video relative bg-muted rounded-t-lg overflow-hidden">
                    {offer.featuredImageUrl ? (
                      <>
                        <img 
                          src={offer.featuredImageUrl} 
                          alt={offer.title} 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            console.error(`Image failed to load: ${offer.title}`, offer.featuredImageUrl);
                            (e.target as HTMLImageElement).style.display = 'none';
                            const fallback = (e.target as HTMLImageElement).nextElementSibling;
                            if (fallback) fallback.classList.remove('hidden');
                          }}
                        />
                        {/* Fallback if image fails */}
                        <div className="hidden absolute inset-0 flex items-center justify-center bg-muted">
                          <Play className="h-12 w-12 text-muted-foreground/50" />
                        </div>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Play className="h-12 w-12 text-muted-foreground/50" />
                      </div>
                    )}

                    {offer.isPriority && (
                      <Badge className="absolute top-2 right-2 bg-primary">
                        Featured
                      </Badge>
                    )}
                    
                    {/* Favorite button - shows on all offers */}
                    <button
                      className="rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-lg"
                      style={{ 
                        position: 'absolute',
                        top: '8px',
                        left: '8px',
                        width: '32px',
                        height: '32px',
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        backdropFilter: 'blur(8px)',
                        zIndex: 9999,
                        border: 'none',
                        cursor: 'pointer'
                      }}
                      onClick={(e) => handleFavoriteToggle(e, offer.id)}
                      data-testid={`button-favorite-${offer.id}`}
                    >
                      <Heart className={`h-4 w-4 ${isFavorite ? 'fill-primary text-primary' : 'text-gray-600'}`} />
                    </button>
                  </div>

                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold line-clamp-1 flex-1">{offer.title}</h3>
                      {offer.company?.logoUrl && (
                        <img src={offer.company.logoUrl} alt={offer.company.tradeName} className="h-8 w-8 rounded-full object-cover" />
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-2">{offer.shortDescription}</p>

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