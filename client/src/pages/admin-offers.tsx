import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, CheckCircle2, XCircle, DollarSign } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function AdminOffers() {
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

  const { data: offers = [], isLoading: loadingOffers } = useQuery<any[]>({
    queryKey: ["/api/admin/offers"],
    enabled: isAuthenticated,
  });

  const approveMutation = useMutation({
    mutationFn: async (offerId: string) => {
      const response = await apiRequest("POST", `/api/admin/offers/${offerId}/approve`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/offers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "Success",
        description: "Offer approved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve offer",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (offerId: string) => {
      const response = await apiRequest("POST", `/api/admin/offers/${offerId}/reject`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/offers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "Success",
        description: "Offer rejected",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject offer",
        variant: "destructive",
      });
    },
  });

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
        <h1 className="text-3xl font-bold">Offer Approvals</h1>
        <p className="text-muted-foreground mt-1">
          Review and approve affiliate offers
        </p>
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
            <CheckCircle2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              No pending offers to review at this time
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer: any) => (
            <Card key={offer.id} className="border-card-border" data-testid={`card-offer-${offer.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg line-clamp-1">{offer.title}</CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge 
                          variant={offer.status === 'approved' ? 'default' : 'secondary'}
                          data-testid={`badge-status-${offer.id}`}
                        >
                          {offer.status}
                        </Badge>
                        {offer.primaryNiche && (
                          <Badge variant="outline" className="text-xs">
                            {offer.primaryNiche}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {offer.shortDescription || offer.description || "No description"}
                </p>
                
                {offer.productUrl && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Product URL</div>
                    <a 
                      href={offer.productUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline break-all"
                      data-testid={`link-product-${offer.id}`}
                    >
                      {offer.productUrl}
                    </a>
                  </div>
                )}

                <div className="flex items-center gap-4 pt-3 border-t">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Commission</div>
                    <div className="text-sm font-semibold flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      {offer.commissionPercentage || offer.commissionAmount || offer.commissionRate || 0}
                      {offer.commissionType === 'per_sale' && '%'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Type</div>
                    <div className="text-sm">
                      {offer.commissionType?.replace(/_/g, ' ') || 'N/A'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-3 border-t">
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-2"
                    onClick={() => approveMutation.mutate(offer.id)}
                    disabled={approveMutation.isPending || offer.status === 'approved'}
                    data-testid={`button-approve-${offer.id}`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => rejectMutation.mutate(offer.id)}
                    disabled={rejectMutation.isPending || offer.status === 'rejected'}
                    data-testid={`button-reject-${offer.id}`}
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
