import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, CheckCircle, Clock, XCircle, MessageCircle, DollarSign } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";

export default function CompanyApplications() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [conversionDialogOpen, setConversionDialogOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [saleAmount, setSaleAmount] = useState("");

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

  const { data: applications = [], isLoading: loadingApplications } = useQuery<any[]>({
    queryKey: ["/api/company/applications"],
    enabled: isAuthenticated,
  });

  const completeApplicationMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      const response = await apiRequest('POST', `/api/applications/${applicationId}/complete`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/applications"] });
      toast({
        title: "Work Approved",
        description: "Creator work has been marked as complete.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark work as complete",
        variant: "destructive",
      });
    },
  });

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

  const approveApplicationMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      const response = await apiRequest('PUT', `/api/applications/${applicationId}/approve`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/applications"] });
      toast({
        title: "Application Approved",
        description: "Creator has been approved and tracking link generated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve application",
        variant: "destructive",
      });
    },
  });

  const rejectApplicationMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      const response = await apiRequest('PUT', `/api/applications/${applicationId}/reject`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/applications"] });
      toast({
        title: "Application Rejected",
        description: "Application has been rejected.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject application",
        variant: "destructive",
      });
    },
  });

  const recordConversionMutation = useMutation({
    mutationFn: async ({ applicationId, saleAmount }: { applicationId: string; saleAmount?: string }) => {
      const body = saleAmount ? { saleAmount: parseFloat(saleAmount) } : {};
      const response = await apiRequest('POST', `/api/conversions/${applicationId}`, body);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/company"] });
      setConversionDialogOpen(false);
      setSaleAmount("");
      setSelectedApplication(null);
      toast({
        title: "Conversion Recorded",
        description: "Conversion and payment have been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record conversion",
        variant: "destructive",
      });
    },
  });

  const handleMarkComplete = (applicationId: string, creatorName: string) => {
    if (confirm(`Mark work as complete for ${creatorName}? This action cannot be undone.`)) {
      completeApplicationMutation.mutate(applicationId);
    }
  };

  const handleApprove = (applicationId: string) => {
    if (confirm("Approve this application? This will generate a tracking link for the creator.")) {
      approveApplicationMutation.mutate(applicationId);
    }
  };

  const handleReject = (applicationId: string) => {
    if (confirm("Reject this application? This action cannot be undone.")) {
      rejectApplicationMutation.mutate(applicationId);
    }
  };

  const handleMessageCreator = (applicationId: string) => {
    startConversationMutation.mutate(applicationId);
  };

  const handleRecordConversion = (application: any) => {
    setSelectedApplication(application);
    setSaleAmount("");
    setConversionDialogOpen(true);
  };

  const handleSubmitConversion = () => {
    if (!selectedApplication) return;

    // For per_sale commission types, require a sale amount
    if (selectedApplication.offer?.commissionType === 'per_sale') {
      const amount = parseFloat(saleAmount);
      if (isNaN(amount) || amount <= 0) {
        toast({
          title: "Invalid Amount",
          description: "Please enter a valid sale amount greater than 0.",
          variant: "destructive",
        });
        return;
      }
    }

    recordConversionMutation.mutate({
      applicationId: selectedApplication.id,
      saleAmount: selectedApplication.offer?.commissionType === 'per_sale' ? saleAmount : undefined,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <FileText className="h-4 w-4" />;
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
      <div>
        <h1 className="text-3xl font-bold">Applications</h1>
        <p className="text-muted-foreground mt-1">
          Review and manage creator applications for your offers
        </p>
      </div>

      {loadingApplications ? (
        <div className="text-center py-12">
          <div className="animate-pulse text-lg text-muted-foreground">
            Loading applications...
          </div>
        </div>
      ) : applications.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No applications yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Creators will appear here when they apply to your offers
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {applications.map((app: any) => (
            <Card key={app.id} className="border-card-border" data-testid={`card-application-${app.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={app.creator?.profileImageUrl} />
                      <AvatarFallback>
                        {app.creator?.firstName?.[0] || 'C'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">
                        {app.creator?.firstName || 'Creator'}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {app.offer?.title || 'Offer'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(app.status)}
                    <Badge 
                      variant={
                        app.status === 'approved' ? 'default' : 
                        app.status === 'pending' ? 'secondary' : 
                        'destructive'
                      }
                      data-testid={`badge-status-${app.id}`}
                    >
                      {app.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground mb-1">Applied</div>
                    <div className="font-medium">
                      {formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Total Clicks</div>
                    <div className="font-medium">{app.clickCount || 0}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Conversions</div>
                    <div className="font-medium">{app.conversionCount || 0}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Earnings</div>
                    <div className="font-medium">${app.totalEarnings || '0.00'}</div>
                  </div>
                </div>

                {app.trackingLink && (
                  <div className="p-3 bg-muted/50 rounded-md">
                    <div className="text-xs text-muted-foreground mb-1">Tracking Link</div>
                    <code className="text-xs break-all">{app.trackingLink}</code>
                  </div>
                )}

                {/* Approve/Reject buttons for pending applications */}
                {app.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleApprove(app.id)}
                      variant="default"
                      className="flex-1"
                      disabled={approveApplicationMutation.isPending}
                      data-testid={`button-approve-${app.id}`}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {approveApplicationMutation.isPending ? 'Approving...' : 'Approve'}
                    </Button>
                    <Button
                      onClick={() => handleReject(app.id)}
                      variant="destructive"
                      className="flex-1"
                      disabled={rejectApplicationMutation.isPending}
                      data-testid={`button-reject-${app.id}`}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      {rejectApplicationMutation.isPending ? 'Rejecting...' : 'Reject'}
                    </Button>
                  </div>
                )}

                {/* Message, Record Conversion, and Complete buttons for approved applications */}
                {(app.status === 'approved' || app.status === 'rejected') && (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleMessageCreator(app.id)}
                        variant="outline"
                        className="flex-1"
                        disabled={startConversationMutation.isPending}
                        data-testid={`button-message-creator-${app.id}`}
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        {startConversationMutation.isPending ? 'Opening...' : 'Message Creator'}
                      </Button>

                      {app.status === 'approved' && !app.completedAt && (
                        <Button
                          onClick={() => handleMarkComplete(app.id, app.creator?.firstName || 'this creator')}
                          variant="default"
                          className="flex-1"
                          disabled={completeApplicationMutation.isPending}
                          data-testid={`button-mark-complete-${app.id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          {completeApplicationMutation.isPending ? 'Processing...' : 'Mark Work Complete'}
                        </Button>
                      )}
                    </div>

                    {/* Record Conversion button for approved applications */}
                    {app.status === 'approved' && !app.completedAt && (
                      <Button
                        onClick={() => handleRecordConversion(app)}
                        variant="secondary"
                        className="w-full"
                        disabled={recordConversionMutation.isPending}
                        data-testid={`button-record-conversion-${app.id}`}
                      >
                        <DollarSign className="h-4 w-4 mr-2" />
                        Record Conversion
                      </Button>
                    )}
                  </div>
                )}

                {app.completedAt && (
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    <span>
                      Work completed {formatDistanceToNow(new Date(app.completedAt), { addSuffix: true })}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Record Conversion Dialog */}
      <Dialog open={conversionDialogOpen} onOpenChange={setConversionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Conversion</DialogTitle>
            <DialogDescription>
              Record a new conversion for {selectedApplication?.creator?.firstName || 'this creator'}.
              {selectedApplication?.offer?.commissionType === 'per_sale'
                ? " Enter the sale amount to calculate the commission."
                : " This will create a payment based on the fixed commission amount."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Offer</Label>
              <p className="text-sm text-muted-foreground">
                {selectedApplication?.offer?.title || 'N/A'}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Commission Type</Label>
              <p className="text-sm text-muted-foreground capitalize">
                {selectedApplication?.offer?.commissionType?.replace('_', ' ') || 'N/A'}
              </p>
            </div>

            {selectedApplication?.offer?.commissionType === 'per_sale' && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Commission Rate</Label>
                <p className="text-sm text-muted-foreground">
                  {selectedApplication?.offer?.commissionPercentage}%
                </p>
              </div>
            )}

            {selectedApplication?.offer?.commissionType !== 'per_sale' && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Commission Amount</Label>
                <p className="text-sm text-muted-foreground">
                  ${selectedApplication?.offer?.commissionAmount || '0.00'}
                </p>
              </div>
            )}

            {selectedApplication?.offer?.commissionType === 'per_sale' && (
              <div className="space-y-2">
                <Label htmlFor="saleAmount">Sale Amount ($) *</Label>
                <Input
                  id="saleAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Enter sale amount (e.g., 1000.00)"
                  value={saleAmount}
                  onChange={(e) => setSaleAmount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSubmitConversion();
                    }
                  }}
                />
                {saleAmount && parseFloat(saleAmount) > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Commission will be: ${(parseFloat(saleAmount) * (parseFloat(selectedApplication?.offer?.commissionPercentage || '0') / 100)).toFixed(2)}
                  </p>
                )}
              </div>
            )}

            <div className="bg-muted/50 p-3 rounded-md space-y-1">
              <p className="text-xs font-medium">Fee Breakdown:</p>
              <p className="text-xs text-muted-foreground">• Platform Fee: 4%</p>
              <p className="text-xs text-muted-foreground">• Stripe Fee: 3%</p>
              <p className="text-xs text-muted-foreground">• Creator Receives: 93%</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConversionDialogOpen(false)}
              disabled={recordConversionMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitConversion}
              disabled={recordConversionMutation.isPending}
            >
              {recordConversionMutation.isPending ? 'Recording...' : 'Record Conversion'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
