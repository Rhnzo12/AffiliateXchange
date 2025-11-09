import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { TrendingUp, Plus, DollarSign, Users, Eye, MoreVertical, Trash2, Edit, ImageIcon, Play, Star } from "lucide-react";
import { Link } from "wouter";
import { proxiedSrc } from "../lib/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { apiRequest, queryClient } from "../lib/queryClient";
import { TopNavBar } from "../components/TopNavBar";
import { OfferCardSkeleton } from "../components/skeletons";

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

// Helper function to get offer category badge
const getOfferCategory = (offer: any): { label: string; color: string } | null => {
  const commissionValue = getCommissionValue(offer);
  const createdDate = new Date(offer.createdAt);
  const daysSinceCreated = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

  // Priority order for badges
  if (offer.isPriority) {
    return { label: "TRENDING", color: "bg-gradient-to-r from-orange-500 to-pink-500" };
  }

  if (commissionValue >= 100) {
    return { label: "HIGH COMMISSION", color: "bg-gradient-to-r from-green-600 to-emerald-600" };
  }

  if (daysSinceCreated <= 7) {
    return { label: "NEW", color: "bg-gradient-to-r from-blue-600 to-cyan-600" };
  }

  if (offer.commissionType === 'monthly_retainer') {
    return { label: "RETAINER", color: "bg-gradient-to-r from-purple-600 to-violet-600" };
  }

  return null;
};

export default function CompanyOffers() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [offerToDelete, setOfferToDelete] = useState<{ id: string; title: string } | null>(null);

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

  const { data: offers = [], isLoading: loadingOffers } = useQuery<any[]>({
    queryKey: ["/api/company/offers"],
    enabled: isAuthenticated,
  });

  const deleteMutation = useMutation({
    mutationFn: async (offerId: string) => {
      await apiRequest("DELETE", `/api/offers/${offerId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/offers"] });
      toast({
        title: "Success",
        description: "Offer deleted successfully",
      });
      setOfferToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete offer",
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = (offer: any) => {
    setOfferToDelete({ id: offer.id, title: offer.title });
  };

  const handleConfirmDelete = () => {
    if (offerToDelete) {
      deleteMutation.mutate(offerToDelete.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation Bar */}
      <TopNavBar />

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-foreground">My Offers</h1>
            <p className="text-muted-foreground text-base">
              Manage your affiliate offers and track performance
            </p>
          </div>
          <Link href="/company/offers/create">
            <Button className="gap-2" data-testid="button-create-offer">
              <Plus className="h-4 w-4" />
              Create New Offer
            </Button>
          </Link>
        </div>

        {/* Offers Grid */}
        {loadingOffers ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <OfferCardSkeleton key={i} />
            ))}
          </div>
        ) : offers.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="p-16 text-center">
              <div className="mx-auto w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
                <TrendingUp className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <h3 className="font-semibold text-xl mb-2">No offers yet</h3>
              <p className="text-muted-foreground mb-6">
                Create your first affiliate offer to start working with creators
              </p>
              <Link href="/company/offers/create">
                <Button data-testid="button-create-first-offer">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Offer
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {offers.map((offer: any) => {
              const category = getOfferCategory(offer);

              return (
                <Card
                  key={offer.id}
                  className="group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-visible h-full relative"
                  data-testid={`card-offer-${offer.id}`}
                >
                  {/* Thumbnail Container with Logo */}
                  <div className="relative">
                    {/* Thumbnail */}
                    <div className="aspect-video relative overflow-hidden bg-gradient-to-br from-purple-100 to-pink-100 rounded-t-lg">
                      {offer.featuredImageUrl ? (
                        <img
                          src={proxiedSrc(offer.featuredImageUrl)}
                          alt={offer.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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

                      {/* Action Menu Button - Top Left */}
                      <div className="absolute top-3 left-3 z-10">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-md backdrop-blur-sm"
                              style={{
                                width: '36px',
                                height: '36px',
                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                border: 'none',
                                cursor: 'pointer',
                              }}
                              onClick={(e) => e.preventDefault()}
                              data-testid={`button-menu-${offer.id}`}
                            >
                              <MoreVertical className="h-5 w-5 text-gray-600" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem asChild>
                              <Link href={`/company/offers/${offer.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/company/offers/${offer.id}/edit`}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Offer
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={(e) => {
                                e.preventDefault();
                                handleDeleteClick(offer);
                              }}
                              data-testid={`button-delete-${offer.id}`}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Offer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Category Badge - Top Right */}
                      {category && (
                        <div className={`absolute top-0 right-0 ${category.color} text-white px-3 py-1.5 rounded-bl-lg shadow-lg font-bold text-xs tracking-wide`}>
                          {category.label}
                        </div>
                      )}

                      {/* Status Badge - Bottom Right Corner */}
                      <div className="absolute bottom-2 right-2">
                        <Badge
                          variant={offer.status === 'approved' ? 'default' : 'secondary'}
                          className="shadow-md"
                          data-testid={`badge-status-${offer.id}`}
                        >
                          {offer.status}
                        </Badge>
                      </div>
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
                        <Badge
                          variant="outline"
                          className={`text-xs border ${NICHE_COLORS[offer.primaryNiche] || 'bg-secondary'}`}
                        >
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

                      {/* Applications count */}
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{offer.applicationCount || 0} apps</span>
                      </div>
                    </div>

                    {/* View Count */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground pt-2 border-t">
                      <Eye className="h-3 w-3" />
                      <span>{offer.viewCount || 0} views</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!offerToDelete} onOpenChange={() => setOfferToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the offer "{offerToDelete?.title}". This action cannot be undone.
                {offers.find(o => o.id === offerToDelete?.id)?.applicationCount > 0 && (
                  <span className="block mt-2 text-destructive font-semibold">
                    ⚠️ Warning: This offer has {offers.find(o => o.id === offerToDelete?.id)?.applicationCount} active application(s).
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                disabled={deleteMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete Offer"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}