import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Plus, DollarSign, Users, Eye, MoreVertical, Trash2, Edit } from "lucide-react";
import { Link } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";

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
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Offers</h1>
          <p className="text-muted-foreground mt-1">
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

      {loadingOffers ? (
        <div className="text-center py-12">
          <div className="animate-pulse text-lg text-muted-foreground">
            Loading offers...
          </div>
        </div>
      ) : offers.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TrendingUp className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No offers yet</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
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
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer: any) => (
            <Card key={offer.id} className="border-card-border" data-testid={`card-offer-${offer.id}`}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg line-clamp-1">{offer.title}</CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge 
                      variant={offer.status === 'live' ? 'default' : 'secondary'}
                      data-testid={`badge-status-${offer.id}`}
                    >
                      {offer.status}
                    </Badge>
                    <Badge variant="outline" data-testid={`badge-type-${offer.id}`}>
                      {offer.commissionType?.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      data-testid={`button-menu-${offer.id}`}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
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
                      onClick={() => handleDeleteClick(offer)}
                      data-testid={`button-delete-${offer.id}`}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Offer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {offer.shortDescription || offer.description || "No description"}
                  </p>
                  {offer.primaryNiche && (
                    <Badge variant="outline" className="text-xs">
                      {offer.primaryNiche}
                    </Badge>
                  )}
                </div>
                
                <div className="grid grid-cols-3 gap-4 pt-3 border-t">
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">Commission</div>
                    <div className="text-sm font-semibold flex items-center justify-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      {offer.commissionPercentage || offer.commissionAmount || offer.commissionRate || 0}
                      {offer.commissionType === 'per_sale' && '%'}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">Applications</div>
                    <div className="text-sm font-semibold flex items-center justify-center gap-1">
                      <Users className="h-3 w-3" />
                      {offer.applicationCount || 0}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">Clicks</div>
                    <div className="text-sm font-semibold">
                      {offer.clickCount || 0}
                    </div>
                  </div>
                </div>

                <Link href={`/company/offers/${offer.id}`}>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    data-testid={`button-view-${offer.id}`}
                  >
                    View Offer
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
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
  );
}