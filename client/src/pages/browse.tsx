import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Slider } from "../components/ui/slider";
import { Checkbox } from "../components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../components/ui/sheet";
import { Search, SlidersHorizontal, TrendingUp, DollarSign, Clock, Star, Play, Heart, ArrowRight, Users } from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "../lib/queryClient";
import { proxiedSrc } from "../lib/image";
import { TopNavBar } from "../components/TopNavBar";
import { OfferCardSkeleton } from "../components/skeletons";

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

// Niche color mapping for badges
const NICHE_COLORS: Record<string, string> = {
  "Technology": "bg-blue-500/10 text-blue-600 border-blue-500/20",
  "Fashion": "bg-pink-500/10 text-pink-600 border-pink-500/20",
  "Beauty": "bg-purple-500/10 text-purple-600 border-purple-500/20",
  "Fitness": "bg-green-500/10 text-green-600 border-green-500/20",
  "Gaming": "bg-orange-500/10 text-orange-600 border-orange-500/20",
  "Travel": "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  "Food": "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  "Lifestyle": "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  "Business": "bg-gray-500/10 text-gray-600 border-gray-500/20",
  "Education": "bg-teal-500/10 text-teal-600 border-teal-500/20",
};

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

// Helper function to get commission type label
const getCommissionTypeLabel = (offer: any) => {
  const type = COMMISSION_TYPES.find(t => t.value === offer.commissionType);
  return type?.label.toLowerCase() || "per sale";
};

// Helper function to get commission value for sorting
const getCommissionValue = (offer: any): number => {
  if (offer.commissionAmount) return offer.commissionAmount;
  if (offer.commissionPercentage) return offer.commissionPercentage;
  if (offer.commissionRate) return offer.commissionRate;
  return 0;
};

export default function Browse() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
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

  // Apply client-side filters
  const filteredOffers = offers?.filter(offer => {
    // Category filter (from category pills)
    if (selectedCategory !== "All" && offer.primaryNiche !== selectedCategory) {
      return false;
    }

    // Commission range filter
    const commissionValue = getCommissionValue(offer);
    if (commissionValue < commissionRange[0] || commissionValue > commissionRange[1]) {
      return false;
    }

    return true;
  }) || [];

  // Get trending offers (priority + high commission)
  const trendingOffers = filteredOffers
    ?.filter(offer => offer.isPriority || getCommissionValue(offer) > 15)
    ?.slice(0, 4) || [];

  const regularOffers = filteredOffers || [];

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
    setSelectedCategory("All");
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
    <div className="min-h-screen bg-background">
      {/* Top Navigation Bar */}
      <TopNavBar>
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search offers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-muted/50"
            data-testid="input-search-header"
          />
        </div>
      </TopNavBar>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-8">
        {/* Header - Left Aligned, Black Text */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-foreground">Browse Offers</h1>
          <p className="text-muted-foreground text-base">Discover exclusive affiliate opportunities from verified brands</p>
        </div>

        {/* Category Pills - Horizontal Scroll */}
        <div className="relative">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {["All", ...NICHES].map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-5 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === category
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                    : 'bg-secondary/50 hover:bg-secondary text-secondary-foreground'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex items-center gap-4">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-52" data-testid="select-sort">
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
                  <div className="flex items-center justify-between">
                    <Label>Commission Type</Label>
                    {commissionType && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCommissionType("")}
                        className="h-auto p-0 text-xs"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  <Select value={commissionType || undefined} onValueChange={(value) => setCommissionType(value)}>
                    <SelectTrigger data-testid="select-commission-type">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
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

        {/* Trending Offers Section */}
        {offersLoading ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              <h2 className="text-2xl font-bold text-foreground">Trending Offers</h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <OfferCardSkeleton key={i} />
              ))}
            </div>
          </div>
        ) : trendingOffers.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-orange-500" />
                <h2 className="text-2xl font-bold text-foreground">Trending Offers</h2>
              </div>
              <Button variant="ghost" className="gap-1 text-primary hover:gap-2 transition-all">
                See All <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {trendingOffers.map((offer) => {
                const isFavorite = favorites.some(f => f.offerId === offer.id);
                
                return (
                  <Link key={offer.id} href={`/offers/${offer.id}`}>
                    <Card className="group hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-visible h-full">
                      {/* Thumbnail Container with Logo */}
                      <div className="relative">
                        {/* Clean Thumbnail - No Gradient Overlay */}
                        <div className="aspect-video relative overflow-hidden bg-gradient-to-br from-purple-100 to-pink-100 rounded-t-lg">
                          {offer.featuredImageUrl ? (
                            <img
                              src={proxiedSrc(offer.featuredImageUrl)}
                              alt={offer.title}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Play className="h-12 w-12 text-muted-foreground/30" />
                            </div>
                          )}

                          {/* Favorite button - Top Left */}
                          <button
                            className="absolute top-3 left-3 rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-md backdrop-blur-sm"
                            style={{ 
                              width: '36px',
                              height: '36px',
                              backgroundColor: 'rgba(255, 255, 255, 0.95)',
                              border: 'none',
                              cursor: 'pointer',
                              zIndex: 10
                            }}
                            onClick={(e) => handleFavoriteToggle(e, offer.id)}
                            data-testid={`button-favorite-${offer.id}`}
                          >
                            <Heart className={`h-5 w-5 transition-all ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
                          </button>

                          {/* Status Badge - Top Right */}
                          {offer.isPriority && (
                            <Badge className="absolute top-3 right-3 bg-orange-500 text-white border-0 shadow-lg">
                              TRENDING
                            </Badge>
                          )}
                        </div>

                        {/* Company Logo - Positioned outside thumbnail but inside wrapper */}
                        {offer.company?.logoUrl && (
                          <div className="absolute -bottom-7 left-4 h-14 w-14 rounded-xl overflow-hidden bg-white shadow-lg border-2 border-background z-20">
                            <img 
                              src={offer.company.logoUrl} 
                              alt={offer.company.tradeName} 
                              className="h-full w-full object-cover"
                            />
                          </div>
                        )}
                      </div>

                      <CardContent className="p-5 pt-8 space-y-3">
                        {/* Title */}
                        <h3 className="font-semibold text-base line-clamp-2 text-foreground leading-snug">
                          {offer.title}
                        </h3>

                        {/* Company Name */}
                        {offer.company?.tradeName && (
                          <p className="text-sm text-muted-foreground">
                            {offer.company.tradeName}
                          </p>
                        )}

                        {/* Hashtag Badges */}
                        <div className="flex flex-wrap gap-1.5">
                          {offer.primaryNiche && (
                            <Badge variant="secondary" className="text-xs font-normal">
                              #{offer.primaryNiche}
                            </Badge>
                          )}
                          {offer.secondaryNiche && (
                            <Badge variant="secondary" className="text-xs font-normal">
                              #{offer.secondaryNiche}
                            </Badge>
                          )}
                        </div>

                        {/* Commission and Stats */}
                        <div className="flex items-end justify-between pt-2">
                          <div>
                            <div className="text-2xl font-bold text-green-600">
                              {formatCommission(offer)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {getCommissionTypeLabel(offer)}
                            </div>
                          </div>
                          
                          {/* Active creators (if you have this data) */}
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Users className="h-4 w-4" />
                            <span>0 active</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* All Offers Grid */}
        <div className="space-y-4">
          {!offersLoading && regularOffers.length > 0 && trendingOffers.length > 0 && (
            <h2 className="text-2xl font-bold text-foreground">All Offers</h2>
          )}

          {offersLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <OfferCardSkeleton key={i} />
              ))}
            </div>
          ) : !regularOffers || regularOffers.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="p-16 text-center">
                <div className="mx-auto w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
                  <TrendingUp className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <h3 className="font-semibold text-xl mb-2">No offers found</h3>
                <p className="text-muted-foreground mb-6">Try adjusting your filters or search terms</p>
                <Button onClick={clearFilters} variant="outline">
                  Clear Filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              {regularOffers.map((offer) => {
                const isFavorite = favorites.some(f => f.offerId === offer.id);
                
                return (
                  <Link key={offer.id} href={`/offers/${offer.id}`}>
                    <Card className="group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden h-full" data-testid={`card-offer-${offer.id}`}>
                      {/* Thumbnail */}
                      <div className="aspect-video relative overflow-hidden">
                        {offer.featuredImageUrl ? (
                          <>
                            <img
                              src={proxiedSrc(offer.featuredImageUrl)}
                              alt={offer.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                console.error(`Image failed to load: ${offer.title}`, offer.featuredImageUrl);
                                (e.target as HTMLImageElement).style.display = 'none';
                                const fallback = (e.target as HTMLImageElement).nextElementSibling;
                                if (fallback) fallback.classList.remove('hidden');
                              }}
                            />
                            {/* Fallback if image fails */}
                            <div className="hidden absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-purple-500/10">
                              <Play className="h-12 w-12 text-muted-foreground/50" />
                            </div>
                          </>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-purple-500/10">
                            <Play className="h-12 w-12 text-muted-foreground/50" />
                          </div>
                        )}

                        {offer.isPriority && (
                          <Badge className="absolute top-3 right-3 bg-primary shadow-md">
                            Featured
                          </Badge>
                        )}
                        
                        {/* Favorite button */}
                        <button
                          className="rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-lg backdrop-blur-md"
                          style={{ 
                            position: 'absolute',
                            top: '12px',
                            left: '12px',
                            width: '36px',
                            height: '36px',
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            zIndex: 10,
                            border: 'none',
                            cursor: 'pointer'
                          }}
                          onClick={(e) => handleFavoriteToggle(e, offer.id)}
                          data-testid={`button-favorite-${offer.id}`}
                        >
                          <Heart className={`h-5 w-5 transition-all ${isFavorite ? 'fill-red-500 text-red-500 scale-110' : 'text-gray-600'}`} />
                        </button>
                      </div>

                      <CardContent className="p-5 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-base line-clamp-1 flex-1">{offer.title}</h3>
                          {offer.company?.logoUrl && (
                            <img src={offer.company.logoUrl} alt={offer.company.tradeName} className="h-9 w-9 rounded-full object-cover ring-2 ring-border" />
                          )}
                        </div>

                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{offer.shortDescription}</p>

                        <div className="flex flex-wrap gap-1.5">
                          {offer.primaryNiche && (
                            <Badge variant="outline" className={`text-xs border ${NICHE_COLORS[offer.primaryNiche] || 'bg-secondary'}`}>
                              {offer.primaryNiche}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t">
                          <div className="flex items-center gap-1.5 text-sm">
                            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                            <span className="font-medium text-foreground">{offer.company?.averageRating?.toFixed(1) || '5.0'}</span>
                          </div>
                          <div className="flex items-center gap-1 font-mono font-bold text-primary">
                            <DollarSign className="h-4 w-4" />
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
      </div>
    </div>
  );
}