import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "../components/ui/form";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { useToast } from "../hooks/use-toast";
import { Link } from "wouter";
import { Building2, FileText, Shield, CheckCircle2, Upload, ArrowLeft, ArrowRight } from "lucide-react";
import { Progress } from "../components/ui/progress";

// Step 1: Company Information
const step1Schema = z.object({
  legalName: z.string().min(2, "Legal name is required"),
  tradeName: z.string().optional(),
  industry: z.string().min(1, "Industry is required"),
  websiteUrl: z.string().url("Must be a valid URL"),
  companySize: z.enum(["1-10", "11-50", "51-200", "201-1000", "1000+"]),
  yearFounded: z.number().min(1800).max(new Date().getFullYear()),
  description: z.string().max(1000, "Description must be max 1000 characters"),
});

// Step 2: Contact Information
const step2Schema = z.object({
  contactName: z.string().min(2, "Contact name is required"),
  contactJobTitle: z.string().min(2, "Job title is required"),
  email: z.string().email("Invalid email address"),
  phoneNumber: z.string().min(10, "Phone number is required"),
  businessAddress: z.string().min(10, "Complete business address is required"),
});

// Step 3: Verification Documents
const step3Schema = z.object({
  verificationMethod: z.enum(["business_registration", "ein_tax_id"]),
  verificationDocumentUrl: z.string().optional(),
  einTaxId: z.string().optional(),
  websiteVerificationMethod: z.enum(["meta_tag", "dns_txt"]),
  socialMediaProfiles: z.object({
    facebook: z.string().optional(),
    twitter: z.string().optional(),
    linkedin: z.string().optional(),
    instagram: z.string().optional(),
  }).optional(),
}).refine((data) => {
  if (data.verificationMethod === "business_registration") {
    return !!data.verificationDocumentUrl;
  } else {
    return !!data.einTaxId;
  }
}, {
  message: "Please provide either a business registration document or EIN/Tax ID",
  path: ["verificationDocumentUrl"],
});

// Step 4: Account Setup
const step4Schema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
  logoUrl: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Combined schema
const companyRegisterSchema = step1Schema.merge(step2Schema).merge(step3Schema).merge(step4Schema);

type CompanyRegisterForm = z.infer<typeof companyRegisterSchema>;

const STEPS = [
  { title: "Company Info", icon: Building2, description: "Basic company details" },
  { title: "Contact Info", icon: FileText, description: "Primary contact details" },
  { title: "Verification", icon: Shield, description: "Documents & verification" },
  { title: "Account Setup", icon: CheckCircle2, description: "Create your account" },
];

export default function CompanyRegister() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [websiteVerificationToken, setWebsiteVerificationToken] = useState<string>("");
  const { toast } = useToast();

  const form = useForm<CompanyRegisterForm>({
    resolver: zodResolver(companyRegisterSchema),
    mode: "onChange",
    defaultValues: {
      legalName: "",
      tradeName: "",
      industry: "",
      websiteUrl: "",
      companySize: "1-10",
      yearFounded: new Date().getFullYear(),
      description: "",
      contactName: "",
      contactJobTitle: "",
      email: "",
      phoneNumber: "",
      businessAddress: "",
      verificationMethod: "business_registration",
      verificationDocumentUrl: "",
      einTaxId: "",
      websiteVerificationMethod: "meta_tag",
      socialMediaProfiles: {
        facebook: "",
        twitter: "",
        linkedin: "",
        instagram: "",
      },
      username: "",
      password: "",
      confirmPassword: "",
      logoUrl: "",
    },
  });

  const handleNext = async () => {
    let isValid = false;

    // Validate current step
    switch (currentStep) {
      case 0:
        isValid = await form.trigger(["legalName", "tradeName", "industry", "websiteUrl", "companySize", "yearFounded", "description"]);
        break;
      case 1:
        isValid = await form.trigger(["contactName", "contactJobTitle", "email", "phoneNumber", "businessAddress"]);
        break;
      case 2:
        isValid = await form.trigger(["verificationMethod", "verificationDocumentUrl", "einTaxId", "websiteVerificationMethod"]);
        // Generate website verification token when moving to next step
        if (isValid && !websiteVerificationToken) {
          const token = generateVerificationToken();
          setWebsiteVerificationToken(token);
        }
        break;
      case 3:
        isValid = await form.trigger(["username", "password", "confirmPassword"]);
        break;
    }

    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const generateVerificationToken = () => {
    return `affiliatexchange-verify-${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Logo must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    // Validate image format
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
      toast({
        title: "Error",
        description: "Logo must be JPG, PNG, GIF, or WebP",
        variant: "destructive",
      });
      return;
    }

    setUploadingLogo(true);
    try {
      // Get Cloudinary upload parameters
      const paramsResponse = await fetch("/api/upload/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!paramsResponse.ok) {
        throw new Error("Failed to get upload parameters");
      }

      const uploadParams = await paramsResponse.json();

      // Upload to Cloudinary
      const formData = new FormData();
      formData.append("file", file);

      if (uploadParams.uploadPreset) {
        formData.append("upload_preset", uploadParams.uploadPreset);
      } else {
        formData.append("signature", uploadParams.signature);
        formData.append("timestamp", uploadParams.timestamp.toString());
        formData.append("api_key", uploadParams.apiKey);
      }

      if (uploadParams.folder) {
        formData.append("folder", uploadParams.folder);
      }

      const uploadResponse = await fetch(uploadParams.uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload to Cloudinary failed");
      }

      const uploadResult = await uploadResponse.json();
      form.setValue("logoUrl", uploadResult.secure_url);

      toast({
        title: "Success",
        description: "Logo uploaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload logo",
        variant: "destructive",
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Document must be less than 10MB",
        variant: "destructive",
      });
      return;
    }

    setUploadingDocument(true);
    try {
      // Get Cloudinary upload parameters
      const paramsResponse = await fetch("/api/upload/verification-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!paramsResponse.ok) {
        throw new Error("Failed to get upload parameters");
      }

      const uploadParams = await paramsResponse.json();

      // Upload to Cloudinary
      const formData = new FormData();
      formData.append("file", file);

      if (uploadParams.uploadPreset) {
        formData.append("upload_preset", uploadParams.uploadPreset);
      } else {
        formData.append("signature", uploadParams.signature);
        formData.append("timestamp", uploadParams.timestamp.toString());
        formData.append("api_key", uploadParams.apiKey);
      }

      if (uploadParams.folder) {
        formData.append("folder", uploadParams.folder);
      }

      const uploadResponse = await fetch(uploadParams.uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload to Cloudinary failed");
      }

      const uploadResult = await uploadResponse.json();
      form.setValue("verificationDocumentUrl", uploadResult.secure_url);

      toast({
        title: "Success",
        description: "Verification document uploaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload document",
        variant: "destructive",
      });
    } finally {
      setUploadingDocument(false);
    }
  };

  const onSubmit = async (data: CompanyRegisterForm) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/register/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          role: "company",
          websiteVerificationToken,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Registration failed");
      }

      toast({
        title: "Success!",
        description: "Your company registration has been submitted for review. You'll receive an email within 24-48 hours.",
      });

      // Redirect to pending page
      setTimeout(() => {
        window.location.href = "/company/pending";
      }, 2000);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-3xl space-y-6">
        <div className="flex items-center justify-center gap-2">
          <img src="/logo.png" alt="AffiliateXchange Logo" className="h-10 w-10 rounded-md object-cover" />
          <span className="text-2xl font-bold">AffiliateXchange</span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Company Registration</CardTitle>
            <CardDescription>
              Complete all steps to submit your company for approval
            </CardDescription>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Step {currentStep + 1} of {STEPS.length}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardHeader>
          <CardContent>
            {/* Step Indicators */}
            <div className="grid grid-cols-4 gap-2 mb-8">
              {STEPS.map((step, index) => {
                const StepIcon = step.icon;
                const isActive = index === currentStep;
                const isCompleted = index < currentStep;

                return (
                  <div
                    key={index}
                    className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
                      isActive
                        ? "border-primary bg-primary/5"
                        : isCompleted
                        ? "border-green-500 bg-green-50 dark:bg-green-950"
                        : "border-muted"
                    }`}
                  >
                    <StepIcon
                      className={`h-6 w-6 mb-1 ${
                        isActive
                          ? "text-primary"
                          : isCompleted
                          ? "text-green-500"
                          : "text-muted-foreground"
                      }`}
                    />
                    <span className="text-xs font-medium text-center">{step.title}</span>
                  </div>
                );
              })}
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Step 1: Company Information */}
                {currentStep === 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Company Information</h3>

                    <FormField
                      control={form.control}
                      name="legalName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Legal Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Acme Corporation Inc." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="tradeName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Trade/DBA Name (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Acme" {...field} />
                          </FormControl>
                          <FormDescription>If different from legal name</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="industry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Industry/Primary Niche *</FormLabel>
                          <FormControl>
                            <Input placeholder="E-commerce, Technology, Fashion, etc." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="websiteUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website URL *</FormLabel>
                          <FormControl>
                            <Input type="url" placeholder="https://www.example.com" {...field} />
                          </FormControl>
                          <FormDescription>This will be verified in the next steps</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="companySize"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company Size *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select size" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="1-10">1-10 employees</SelectItem>
                                <SelectItem value="11-50">11-50 employees</SelectItem>
                                <SelectItem value="51-200">51-200 employees</SelectItem>
                                <SelectItem value="201-1000">201-1000 employees</SelectItem>
                                <SelectItem value="1000+">1000+ employees</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="yearFounded"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Year Founded *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="2020"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Description *</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe your company, products, and what you're looking for in affiliate partnerships..."
                              className="min-h-32"
                              maxLength={1000}
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            {field.value?.length || 0} / 1000 characters
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Step 2: Contact Information */}
                {currentStep === 1 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Contact Information</h3>

                    <FormField
                      control={form.control}
                      name="contactName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Primary Contact Full Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="contactJobTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Job Title *</FormLabel>
                          <FormControl>
                            <Input placeholder="Marketing Director" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Email *</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="john@company.com" {...field} />
                          </FormControl>
                          <FormDescription>
                            A verification link will be sent to this email
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Phone Number *</FormLabel>
                          <FormControl>
                            <Input type="tel" placeholder="+1 (555) 123-4567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="businessAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Complete Business Address *</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="123 Main Street, Suite 100, City, State, ZIP Code, Country"
                              className="min-h-24"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Step 3: Verification Documents */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold">Verification Documents</h3>

                    <div className="bg-muted p-4 rounded-lg">
                      <p className="text-sm font-medium mb-2">Required Documents</p>
                      <p className="text-sm text-muted-foreground">
                        You must provide ONE of the following: Business Registration Certificate OR EIN/Tax ID Number
                      </p>
                    </div>

                    <FormField
                      control={form.control}
                      name="verificationMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Verification Method *</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="grid grid-cols-2 gap-4"
                            >
                              <div>
                                <RadioGroupItem
                                  value="business_registration"
                                  id="business_registration"
                                  className="peer sr-only"
                                />
                                <label
                                  htmlFor="business_registration"
                                  className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-card p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                                >
                                  <FileText className="mb-2 h-6 w-6" />
                                  <span className="text-sm font-medium">Business Registration</span>
                                </label>
                              </div>
                              <div>
                                <RadioGroupItem
                                  value="ein_tax_id"
                                  id="ein_tax_id"
                                  className="peer sr-only"
                                />
                                <label
                                  htmlFor="ein_tax_id"
                                  className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-card p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                                >
                                  <Shield className="mb-2 h-6 w-6" />
                                  <span className="text-sm font-medium">EIN/Tax ID</span>
                                </label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {form.watch("verificationMethod") === "business_registration" && (
                      <FormField
                        control={form.control}
                        name="verificationDocumentUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Upload Business Registration Certificate *</FormLabel>
                            <FormControl>
                              <div className="space-y-2">
                                <Input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  onChange={handleDocumentUpload}
                                  disabled={uploadingDocument}
                                />
                                {field.value && (
                                  <p className="text-sm text-green-600">✓ Document uploaded</p>
                                )}
                              </div>
                            </FormControl>
                            <FormDescription>
                              PDF or image format, max 10MB
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {form.watch("verificationMethod") === "ein_tax_id" && (
                      <FormField
                        control={form.control}
                        name="einTaxId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>EIN/Tax ID Number *</FormLabel>
                            <FormControl>
                              <Input placeholder="12-3456789" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="websiteVerificationMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website Verification Method *</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="grid grid-cols-2 gap-4"
                            >
                              <div>
                                <RadioGroupItem
                                  value="meta_tag"
                                  id="meta_tag"
                                  className="peer sr-only"
                                />
                                <label
                                  htmlFor="meta_tag"
                                  className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-card p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                                >
                                  <span className="text-sm font-medium">Meta Tag</span>
                                </label>
                              </div>
                              <div>
                                <RadioGroupItem
                                  value="dns_txt"
                                  id="dns_txt"
                                  className="peer sr-only"
                                />
                                <label
                                  htmlFor="dns_txt"
                                  className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-card p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                                >
                                  <span className="text-sm font-medium">DNS TXT Record</span>
                                </label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {websiteVerificationToken && (
                      <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                        <p className="text-sm font-medium mb-2">
                          {form.watch("websiteVerificationMethod") === "meta_tag"
                            ? "Add this Meta Tag to your website:"
                            : "Add this DNS TXT Record:"}
                        </p>
                        <code className="block p-2 bg-white dark:bg-gray-900 rounded text-xs break-all">
                          {form.watch("websiteVerificationMethod") === "meta_tag"
                            ? `<meta name="affiliatexchange-verification" content="${websiteVerificationToken}" />`
                            : `TXT record: affiliatexchange-verification=${websiteVerificationToken}`}
                        </code>
                      </div>
                    )}

                    <div className="space-y-2">
                      <FormLabel>Social Media Profiles (Optional but Recommended)</FormLabel>
                      <FormField
                        control={form.control}
                        name="socialMediaProfiles.linkedin"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input placeholder="LinkedIn URL" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="socialMediaProfiles.facebook"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input placeholder="Facebook URL" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="socialMediaProfiles.twitter"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input placeholder="Twitter/X URL" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="socialMediaProfiles.instagram"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input placeholder="Instagram URL" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                {/* Step 4: Account Setup */}
                {currentStep === 3 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Account Setup</h3>

                    <FormField
                      control={form.control}
                      name="logoUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Logo</FormLabel>
                          <FormControl>
                            <div className="space-y-2">
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={handleLogoUpload}
                                disabled={uploadingLogo}
                              />
                              {field.value && (
                                <div className="flex items-center gap-2">
                                  <img src={field.value} alt="Logo preview" className="h-16 w-16 object-cover rounded" />
                                  <p className="text-sm text-green-600">✓ Logo uploaded</p>
                                </div>
                              )}
                            </div>
                          </FormControl>
                          <FormDescription>
                            Square format, minimum 512x512px, max 5MB
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username *</FormLabel>
                          <FormControl>
                            <Input placeholder="mycompany" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password *</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormDescription>
                            Minimum 6 characters
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password *</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg mt-6">
                      <p className="text-sm font-medium mb-2">What happens next?</p>
                      <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                        <li>Your application will be reviewed within 24-48 hours</li>
                        <li>You'll receive a confirmation email immediately</li>
                        <li>Your status will show as "Pending" until approved</li>
                        <li>You can draft offers but cannot publish until approved</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-between pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={currentStep === 0 || isLoading}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Previous
                  </Button>

                  {currentStep < STEPS.length - 1 ? (
                    <Button type="button" onClick={handleNext}>
                      Next
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? "Submitting..." : "Submit for Review"}
                    </Button>
                  )}
                </div>
              </form>
            </Form>

            <div className="mt-4 text-center text-sm">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
