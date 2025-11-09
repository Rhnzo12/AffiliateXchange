import { useEffect, useState } from "react";
import { useUser } from "../hooks/use-user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Clock, CheckCircle2, XCircle, AlertCircle, FileText, Shield, Mail, Globe } from "lucide-react";
import { useLocation } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";

type CompanyStatus = "pending" | "approved" | "rejected" | "pending_more_info";

interface CompanyProfile {
  id: string;
  status: CompanyStatus;
  legalName: string;
  websiteUrl: string | null;
  websiteVerificationMethod: string | null;
  websiteVerificationToken: string | null;
  websiteVerified: boolean;
  emailVerified: boolean;
  additionalInfoRequested: string | null;
  rejectionReason: string | null;
  reapplyAfterDate: string | null;
  createdAt: string;
}

export default function CompanyPending() {
  const { user, isLoading: userLoading } = useUser();
  const [, navigate] = useLocation();
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userLoading && (!user || user.role !== "company")) {
      navigate("/login");
      return;
    }

    if (user) {
      fetchCompanyStatus();
    }
  }, [user, userLoading, navigate]);

  const fetchCompanyStatus = async () => {
    try {
      const response = await fetch("/api/company-profile", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch company profile");
      }

      const data = await response.json();
      setCompany(data);

      // Redirect if approved
      if (data.status === "approved") {
        navigate("/company/dashboard");
      }
    } catch (error) {
      console.error("Error fetching company status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (userLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>Failed to load company profile</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/company/dashboard")}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusIcon = () => {
    switch (company.status) {
      case "pending":
        return <Clock className="h-16 w-16 text-yellow-500" />;
      case "pending_more_info":
        return <AlertCircle className="h-16 w-16 text-orange-500" />;
      case "rejected":
        return <XCircle className="h-16 w-16 text-red-500" />;
      default:
        return <CheckCircle2 className="h-16 w-16 text-green-500" />;
    }
  };

  const getStatusTitle = () => {
    switch (company.status) {
      case "pending":
        return "Application Under Review";
      case "pending_more_info":
        return "Additional Information Requested";
      case "rejected":
        return "Application Rejected";
      default:
        return "Application Approved";
    }
  };

  const getStatusDescription = () => {
    switch (company.status) {
      case "pending":
        return "Your company registration is being reviewed by our admin team. This typically takes 24-48 hours.";
      case "pending_more_info":
        return "Our admin team needs additional information to process your application.";
      case "rejected":
        return "Your application was not approved at this time.";
      default:
        return "Congratulations! Your company has been approved.";
    }
  };

  const daysSinceSubmission = Math.floor(
    (Date.now() - new Date(company.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6 py-8">
        <div className="flex items-center justify-center gap-2 mb-8">
          <img src="/logo.png" alt="AffiliateXchange Logo" className="h-10 w-10 rounded-md object-cover" />
          <span className="text-2xl font-bold">AffiliateXchange</span>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {getStatusIcon()}
            </div>
            <CardTitle className="text-2xl">{getStatusTitle()}</CardTitle>
            <CardDescription>{getStatusDescription()}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status-specific content */}
            {company.status === "pending" && (
              <>
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">What's happening now?</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <FileText className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
                      <span>Admin team is reviewing your business registration documents</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Shield className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
                      <span>Verifying company information and authenticity</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Globe className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
                      <span>Checking website verification</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Mail className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
                      <span>You'll receive an email once the review is complete</span>
                    </li>
                  </ul>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Submitted</p>
                    <p className="font-semibold">{daysSinceSubmission} {daysSinceSubmission === 1 ? 'day' : 'days'} ago</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Expected Response</p>
                    <p className="font-semibold">24-48 hours</p>
                  </div>
                </div>

                {company.websiteVerificationMethod && !company.websiteVerified && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Website Verification Pending</AlertTitle>
                    <AlertDescription className="mt-2">
                      <p className="mb-2">
                        {company.websiteVerificationMethod === "meta_tag"
                          ? "Add this meta tag to your website's <head> section:"
                          : "Add this DNS TXT record to your domain:"}
                      </p>
                      <code className="block p-2 bg-muted rounded text-xs break-all">
                        {company.websiteVerificationMethod === "meta_tag"
                          ? `<meta name="affiliatexchange-verification" content="${company.websiteVerificationToken}" />`
                          : `TXT record: affiliatexchange-verification=${company.websiteVerificationToken}`}
                      </code>
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}

            {company.status === "pending_more_info" && company.additionalInfoRequested && (
              <>
                <Alert variant="default">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Information Required</AlertTitle>
                  <AlertDescription className="mt-2">
                    {company.additionalInfoRequested}
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Button onClick={() => navigate("/company/settings")} className="w-full">
                    Update Information
                  </Button>
                  <Button variant="outline" onClick={fetchCompanyStatus} className="w-full">
                    Refresh Status
                  </Button>
                </div>
              </>
            )}

            {company.status === "rejected" && (
              <>
                {company.rejectionReason && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>Rejection Reason</AlertTitle>
                    <AlertDescription className="mt-2">
                      {company.rejectionReason}
                    </AlertDescription>
                  </Alert>
                )}

                {company.reapplyAfterDate && (
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm">
                      You can reapply after:{" "}
                      <span className="font-semibold">
                        {new Date(company.reapplyAfterDate).toLocaleDateString()}
                      </span>
                    </p>
                  </div>
                )}

                <Button
                  variant="outline"
                  onClick={() => navigate("/register")}
                  className="w-full"
                  disabled={
                    company.reapplyAfterDate &&
                    new Date(company.reapplyAfterDate) > new Date()
                  }
                >
                  {company.reapplyAfterDate &&
                  new Date(company.reapplyAfterDate) > new Date()
                    ? "Reapplication Not Yet Available"
                    : "Create New Application"}
                </Button>
              </>
            )}

            {/* What you can do while waiting */}
            {company.status === "pending" && (
              <div className="border-t pt-6">
                <h3 className="font-semibold mb-3">While You Wait</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>You can draft offers (they won't be published until approved)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>View your company dashboard</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Update your company profile</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span>Cannot publish live offers yet</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span>Cannot receive applications yet</span>
                  </div>
                </div>

                <Button onClick={() => navigate("/company/dashboard")} className="w-full mt-4">
                  Go to Dashboard
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Company Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Submitted Information</CardTitle>
            <CardDescription>Review the information you submitted</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Company Name</p>
                <p className="font-semibold">{company.legalName}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Website</p>
                <p className="font-semibold">
                  {company.websiteUrl ? (
                    <a
                      href={company.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {company.websiteUrl}
                    </a>
                  ) : (
                    "Not provided"
                  )}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Email Verified</p>
                <p className="font-semibold">
                  {company.emailVerified ? (
                    <span className="text-green-600">✓ Verified</span>
                  ) : (
                    <span className="text-yellow-600">Pending</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Website Verified</p>
                <p className="font-semibold">
                  {company.websiteVerified ? (
                    <span className="text-green-600">✓ Verified</span>
                  ) : (
                    <span className="text-yellow-600">Pending</span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Support */}
        <Card>
          <CardHeader>
            <CardTitle>Need Help?</CardTitle>
            <CardDescription>Contact our support team if you have questions</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              If you have any questions about your application status or need assistance,
              please don't hesitate to reach out to our support team.
            </p>
            <Button variant="outline" className="w-full">
              Contact Support
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
