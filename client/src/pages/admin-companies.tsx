import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Building2, CheckCircle2, XCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function AdminCompanies() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

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

  const { data: companies = [], isLoading: loadingCompanies } = useQuery<any[]>({
    queryKey: ["/api/admin/companies"],
    enabled: isAuthenticated,
  });

  const approveMutation = useMutation({
    mutationFn: async (companyId: string) => {
      const response = await apiRequest("POST", `/api/admin/companies/${companyId}/approve`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "Success",
        description: "Company approved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve company",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ companyId, reason }: { companyId: string; reason: string }) => {
      const response = await apiRequest("POST", `/api/admin/companies/${companyId}/reject`, { reason });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "Success",
        description: "Company rejected",
      });
      setIsRejectDialogOpen(false);
      setRejectionReason("");
      setSelectedCompany(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject company",
        variant: "destructive",
      });
    },
  });

  const handleReject = (company: any) => {
    setSelectedCompany(company);
    setIsRejectDialogOpen(true);
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
      <div>
        <h1 className="text-3xl font-bold">Company Approvals</h1>
        <p className="text-muted-foreground mt-1">
          Review and approve companies to join the platform
        </p>
      </div>

      {loadingCompanies ? (
        <div className="text-center py-12">
          <div className="animate-pulse text-lg text-muted-foreground">
            Loading companies...
          </div>
        </div>
      ) : companies.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              No pending companies to review at this time
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((company: any) => (
            <Card key={company.id} className="border-card-border" data-testid={`card-company-${company.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg line-clamp-1">{company.legalName}</CardTitle>
                      <Badge 
                        variant={company.status === 'approved' ? 'default' : 'secondary'}
                        className="mt-2"
                        data-testid={`badge-status-${company.id}`}
                      >
                        {company.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {company.websiteUrl && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Website</div>
                    <a 
                      href={company.websiteUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline break-all"
                      data-testid={`link-website-${company.id}`}
                    >
                      {company.websiteUrl}
                    </a>
                  </div>
                )}
                
                {company.description && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Description</div>
                    <p className="text-sm line-clamp-3">{company.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-3 border-t">
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-2"
                    onClick={() => approveMutation.mutate(company.id)}
                    disabled={approveMutation.isPending || company.status === 'approved'}
                    data-testid={`button-approve-${company.id}`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleReject(company)}
                    disabled={rejectMutation.isPending || company.status === 'rejected'}
                    data-testid={`button-reject-${company.id}`}
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

      {/* Rejection Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent data-testid="dialog-reject-company">
          <DialogHeader>
            <DialogTitle>Reject Company</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this company registration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Rejection Reason</Label>
              <Textarea
                id="reason"
                placeholder="Enter reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="min-h-[100px]"
                data-testid="textarea-rejection-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsRejectDialogOpen(false);
                setRejectionReason("");
                setSelectedCompany(null);
              }}
              data-testid="button-cancel-reject"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedCompany && rejectionReason.trim()) {
                  rejectMutation.mutate({ 
                    companyId: selectedCompany.id, 
                    reason: rejectionReason 
                  });
                }
              }}
              disabled={!rejectionReason.trim() || rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
