import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DollarSign, Video, Calendar, Briefcase, CheckCircle, XCircle, Clock, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

export default function CompanyRetainerDetail() {
  const [, params] = useRoute("/company/retainers/:id");
  const contractId = params?.id;
  const { toast } = useToast();
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  // Use the correct API endpoint - /api/retainer-contracts/:id (not /api/company/retainer-contracts/:id)
  const { data: contract, isLoading, error } = useQuery<any>({
    queryKey: [`/api/retainer-contracts/${contractId}`],
    enabled: !!contractId,
  });

  // Use the correct API endpoint for applications
  const { data: applications } = useQuery<any[]>({
    queryKey: [`/api/retainer-contracts/${contractId}/applications`],
    enabled: !!contractId,
  });

  const approveMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      return await apiRequest("PATCH", `/api/company/retainer-applications/${applicationId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/retainer-contracts/${contractId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/retainer-contracts/${contractId}/applications`] });
      queryClient.invalidateQueries({ queryKey: ["/api/company/retainer-contracts"] });
      toast({
        title: "Application Approved",
        description: "The creator has been assigned to this retainer contract.",
      });
      setApproveDialogOpen(false);
      setSelectedApplication(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve application",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      return await apiRequest("PATCH", `/api/company/retainer-applications/${applicationId}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/retainer-contracts/${contractId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/retainer-contracts/${contractId}/applications`] });
      queryClient.invalidateQueries({ queryKey: ["/api/company/retainer-contracts"] });
      toast({
        title: "Application Rejected",
        description: "The application has been rejected.",
      });
      setRejectDialogOpen(false);
      setSelectedApplication(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject application",
        variant: "destructive",
      });
    },
  });

  const handleApprove = (application: any) => {
    setSelectedApplication(application);
    setApproveDialogOpen(true);
  };

  const handleReject = (application: any) => {
    setSelectedApplication(application);
    setRejectDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Loading...</h1>
          <p className="text-muted-foreground">Fetching contract details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Contract</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {(error as Error)?.message || "Failed to load contract"}
              </p>
              <Link href="/company/retainers">
                <Button className="mt-4">Back to Retainers</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Contract Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-muted-foreground">
                The retainer contract you're looking for doesn't exist.
              </p>
              <Link href="/company/retainers">
                <Button className="mt-4">Back to Retainers</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isContractAssigned = contract.status === 'in_progress' || !!contract.assignedCreatorId;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{contract.title}</h1>
          <p className="text-muted-foreground">Retainer Contract Details</p>
        </div>
        <Badge variant={isContractAssigned ? 'default' : 'secondary'}>
          {isContractAssigned ? 'In Progress' : 'Open'}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contract Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{contract.description}</p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monthly Payment</p>
                <p className="font-semibold">
                  ${parseFloat(contract.monthlyAmount).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Video className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Videos/Month</p>
                <p className="font-semibold">{contract.videosPerMonth}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="font-semibold">{contract.durationMonths} months</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Platform</p>
                <p className="font-semibold">{contract.requiredPlatform}</p>
              </div>
            </div>
          </div>

          {contract.contentGuidelines && (
            <div className="pt-4 border-t">
              <h4 className="font-semibold text-sm mb-2">Content Guidelines</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {contract.contentGuidelines}
              </p>
            </div>
          )}

          {contract.assignedCreator && (
            <div className="pt-4 border-t">
              <h4 className="font-semibold text-sm mb-2">Assigned Creator</h4>
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>
                    {contract.assignedCreator.firstName?.[0]}{contract.assignedCreator.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {contract.assignedCreator.firstName} {contract.assignedCreator.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">@{contract.assignedCreator.username}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Applications</CardTitle>
            <Badge variant="outline">
              {applications?.length || 0} Application{applications?.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {!applications || applications.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No applications yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {applications.map((application: any) => (
                <Card key={application.id} className="border-card-border">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback>
                            {application.creator?.firstName?.[0]}{application.creator?.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold">
                                {application.creator?.firstName} {application.creator?.lastName}
                              </h4>
                              {getStatusBadge(application.status)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              @{application.creator?.username}
                            </p>
                          </div>

                          <div>
                            <h5 className="text-sm font-medium mb-1">Message</h5>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {application.message}
                            </p>
                          </div>

                          {application.portfolioLinks && application.portfolioLinks.length > 0 && (
                            <div>
                              <h5 className="text-sm font-medium mb-2">Portfolio Links</h5>
                              <div className="flex flex-wrap gap-2">
                                {application.portfolioLinks.map((link: string, index: number) => (
                                  <a
                                    key={index}
                                    href={link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    Link {index + 1}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          {application.proposedStartDate && (
                            <div>
                              <h5 className="text-sm font-medium">Proposed Start Date</h5>
                              <p className="text-sm text-muted-foreground">
                                {new Date(application.proposedStartDate).toLocaleDateString()}
                              </p>
                            </div>
                          )}

                          <div className="flex gap-2 pt-2">
                            {application.status === 'pending' && (
                              <>
                                <Button
                                  onClick={() => handleApprove(application)}
                                  size="sm"
                                  disabled={isContractAssigned}
                                  className="bg-green-500 hover:bg-green-600"
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Approve
                                </Button>
                                <Button
                                  onClick={() => handleReject(application)}
                                  variant="destructive"
                                  size="sm"
                                  disabled={isContractAssigned}
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Reject
                                </Button>
                              </>
                            )}
                            {application.status === 'approved' && (
                              <Button
                                disabled
                                size="sm"
                                className="bg-green-500"
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Approved
                              </Button>
                            )}
                            {application.status === 'rejected' && (
                              <Button
                                disabled
                                variant="destructive"
                                size="sm"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Rejected
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approve Confirmation Dialog */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Application</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve this application? This will assign{" "}
              <span className="font-semibold">
                {selectedApplication?.creator?.firstName} {selectedApplication?.creator?.lastName}
              </span>{" "}
              to this retainer contract and change the contract status to "In Progress".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => approveMutation.mutate(selectedApplication?.id)}
              disabled={approveMutation.isPending}
              className="bg-green-500 hover:bg-green-600"
            >
              {approveMutation.isPending ? "Approving..." : "Approve Application"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Confirmation Dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Application</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject this application from{" "}
              <span className="font-semibold">
                {selectedApplication?.creator?.firstName} {selectedApplication?.creator?.lastName}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => rejectMutation.mutate(selectedApplication?.id)}
              disabled={rejectMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Application"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}