import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../components/ui/tooltip";
import {
  Plus,
  Pencil,
  Trash2,
  Mail,
  Eye,
  Copy,
  ChevronDown,
  Bold,
  Link,
  List,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  User,
  Building,
  FileText,
  Sparkles,
  LayoutTemplate,
  Palette,
  Type,
} from "lucide-react";
import { TopNavBar } from "../components/TopNavBar";
import { GenericErrorDialog } from "../components/GenericErrorDialog";

interface EmailTemplate {
  id: string;
  name: string;
  slug: string;
  category: string;
  subject: string;
  htmlContent: string;
  description: string | null;
  availableVariables: string[];
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TemplateType {
  type: string;
  category: string;
  name: string;
  description: string;
  slug: string;
  variables: Array<{
    name: string;
    description: string;
    example: string;
  }>;
}

const CATEGORIES = [
  { value: 'application', label: 'Application', icon: FileText, description: 'Application status updates' },
  { value: 'payment', label: 'Payment', icon: DollarSign, description: 'Payment notifications' },
  { value: 'offer', label: 'Offer', icon: Sparkles, description: 'Offer approvals and updates' },
  { value: 'company', label: 'Company', icon: Building, description: 'Company registration' },
  { value: 'system', label: 'System', icon: AlertCircle, description: 'System announcements' },
  { value: 'moderation', label: 'Moderation', icon: AlertCircle, description: 'Content moderation' },
  { value: 'authentication', label: 'Authentication', icon: User, description: 'Login and security' },
];

// User-friendly variable definitions with descriptions
const VARIABLES = [
  { name: 'userName', label: 'User Name', description: 'The recipient\'s name', example: 'John Doe', icon: User },
  { name: 'companyName', label: 'Company Name', description: 'The company\'s name', example: 'Acme Corp', icon: Building },
  { name: 'offerTitle', label: 'Offer Title', description: 'The name of the offer', example: 'Summer Sale Promotion', icon: FileText },
  { name: 'amount', label: 'Amount', description: 'Payment or commission amount', example: '$500.00', icon: DollarSign },
  { name: 'trackingLink', label: 'Tracking Link', description: 'Unique affiliate tracking URL', example: 'https://track.example.com/abc123', icon: Link },
  { name: 'linkUrl', label: 'Action Link', description: 'Link to relevant page in the app', example: 'https://app.example.com/dashboard', icon: Link },
  { name: 'transactionId', label: 'Transaction ID', description: 'Payment transaction reference', example: 'TXN-12345', icon: FileText },
  { name: 'reviewRating', label: 'Review Rating', description: 'Star rating (1-5)', example: '5', icon: Sparkles },
  { name: 'daysUntilExpiration', label: 'Days Until Expiration', description: 'Countdown for expiring items', example: '7', icon: Clock },
  { name: 'otpCode', label: 'OTP Code', description: 'One-time verification code', example: '123456', icon: AlertCircle },
  { name: 'verificationUrl', label: 'Verification URL', description: 'Email verification link', example: 'https://app.example.com/verify/abc', icon: Link },
  { name: 'resetUrl', label: 'Password Reset URL', description: 'Password reset link', example: 'https://app.example.com/reset/abc', icon: Link },
];

// Pre-built content blocks
const CONTENT_BLOCKS = [
  {
    name: 'Greeting',
    description: 'Standard greeting with user name',
    content: '<p>Hi {{userName}},</p>',
  },
  {
    name: 'Success Message',
    description: 'Green success box',
    content: `<div style="background-color: #ECFDF5; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0; border-radius: 4px;">
  <p style="margin: 0; color: #065F46;">Your message here</p>
</div>`,
  },
  {
    name: 'Warning Message',
    description: 'Yellow warning box',
    content: `<div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 4px;">
  <p style="margin: 0; color: #92400E;">Your warning message here</p>
</div>`,
  },
  {
    name: 'Error Message',
    description: 'Red error box',
    content: `<div style="background-color: #FEE2E2; border-left: 4px solid #EF4444; padding: 15px; margin: 20px 0; border-radius: 4px;">
  <p style="margin: 0; color: #991B1B;">Your error message here</p>
</div>`,
  },
  {
    name: 'Info Box',
    description: 'Blue information box',
    content: `<div style="background-color: #EFF6FF; border-left: 4px solid #3B82F6; padding: 15px; margin: 20px 0; border-radius: 4px;">
  <p style="margin: 0; color: #1E40AF;">Your information here</p>
</div>`,
  },
  {
    name: 'Action Button',
    description: 'Primary call-to-action button',
    content: `<div style="text-align: center; margin: 30px 0;">
  <a href="{{linkUrl}}" style="display: inline-block; padding: 12px 30px; background-color: #4F46E5; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">Take Action</a>
</div>`,
  },
  {
    name: 'Amount Display',
    description: 'Large amount/price display',
    content: `<div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
  <p style="margin: 0 0 5px 0; font-size: 14px; color: #6B7280;">Amount</p>
  <p style="margin: 0; font-size: 32px; font-weight: bold; color: #111827;">{{amount}}</p>
</div>`,
  },
  {
    name: 'Footer',
    description: 'Standard email footer',
    content: `<div style="text-align: center; padding: 20px; color: #666; font-size: 14px; border-top: 1px solid #E5E7EB; margin-top: 30px;">
  <p>This is an automated notification from Affiliate Marketplace.</p>
  <p>Update your <a href="/settings" style="color: #4F46E5;">notification preferences</a> anytime.</p>
</div>`,
  },
];

// Starter templates
const STARTER_TEMPLATES = [
  {
    name: 'Simple Notification',
    description: 'Basic notification with message and button',
    subject: 'Notification from Affiliate Marketplace',
    content: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background-color: #4F46E5; color: #ffffff; padding: 30px 20px; text-align: center; }
    .content { padding: 30px 20px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Notification</h1>
    </div>
    <div class="content">
      <p>Hi {{userName}},</p>
      <p>Your notification message goes here.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{linkUrl}}" style="display: inline-block; padding: 12px 30px; background-color: #4F46E5; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">View Details</a>
      </div>
    </div>
    <div class="footer">
      <p>This is an automated notification from Affiliate Marketplace.</p>
    </div>
  </div>
</body>
</html>`,
  },
  {
    name: 'Success Notification',
    description: 'Approval or success message with green theme',
    subject: 'Great news! {{offerTitle}}',
    content: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background-color: #10B981; color: #ffffff; padding: 30px 20px; text-align: center; }
    .content { padding: 30px 20px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Congratulations!</h1>
    </div>
    <div class="content">
      <p>Hi {{userName}},</p>
      <div style="background-color: #ECFDF5; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; color: #065F46;">Your success message here</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{linkUrl}}" style="display: inline-block; padding: 12px 30px; background-color: #10B981; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">Get Started</a>
      </div>
    </div>
    <div class="footer">
      <p>This is an automated notification from Affiliate Marketplace.</p>
    </div>
  </div>
</body>
</html>`,
  },
  {
    name: 'Payment Notification',
    description: 'Payment received or processed template',
    subject: 'Payment Update: {{amount}}',
    content: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background-color: #10B981; color: #ffffff; padding: 30px 20px; text-align: center; }
    .content { padding: 30px 20px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Payment Update</h1>
    </div>
    <div class="content">
      <p>Hi {{userName}},</p>
      <p>Your payment has been processed.</p>
      <div style="background-color: #ECFDF5; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <p style="margin: 0 0 5px 0; font-size: 14px; color: #065F46;">Amount</p>
        <p style="margin: 0; font-size: 32px; font-weight: bold; color: #047857;">{{amount}}</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{linkUrl}}" style="display: inline-block; padding: 12px 30px; background-color: #10B981; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">View Payment Details</a>
      </div>
    </div>
    <div class="footer">
      <p>This is an automated notification from Affiliate Marketplace.</p>
    </div>
  </div>
</body>
</html>`,
  },
  {
    name: 'Warning/Action Required',
    description: 'Urgent action or warning message',
    subject: 'Action Required',
    content: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background-color: #F59E0B; color: #ffffff; padding: 30px 20px; text-align: center; }
    .content { padding: 30px 20px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Action Required</h1>
    </div>
    <div class="content">
      <p>Hi {{userName}},</p>
      <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; font-weight: 600; color: #92400E;">Important Notice</p>
        <p style="margin: 10px 0 0 0; color: #78350F;">Your warning message here.</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{linkUrl}}" style="display: inline-block; padding: 12px 30px; background-color: #F59E0B; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">Take Action</a>
      </div>
    </div>
    <div class="footer">
      <p>This is an automated notification from Affiliate Marketplace.</p>
    </div>
  </div>
</body>
</html>`,
  },
  {
    name: 'Request More Information',
    description: 'Ask user to provide additional details',
    subject: 'Additional Information Needed',
    content: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background-color: #3B82F6; color: #ffffff; padding: 30px 20px; text-align: center; }
    .content { padding: 30px 20px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Information Needed</h1>
    </div>
    <div class="content">
      <p>Hi {{userName}},</p>
      <p>Thank you for your submission. To proceed with your request, we need some additional information.</p>
      <div style="background-color: #EFF6FF; border-left: 4px solid #3B82F6; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; font-weight: 600; color: #1E40AF;">What we need:</p>
        <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #1E3A8A;">
          <li>Item 1</li>
          <li>Item 2</li>
          <li>Item 3</li>
        </ul>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{linkUrl}}" style="display: inline-block; padding: 12px 30px; background-color: #3B82F6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">Provide Information</a>
      </div>
    </div>
    <div class="footer">
      <p>This is an automated notification from Affiliate Marketplace.</p>
    </div>
  </div>
</body>
</html>`,
  },
  {
    name: 'Rejection Notice',
    description: 'Polite rejection with reason',
    subject: 'Update on Your Request',
    content: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background-color: #6B7280; color: #ffffff; padding: 30px 20px; text-align: center; }
    .content { padding: 30px 20px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Request Update</h1>
    </div>
    <div class="content">
      <p>Hi {{userName}},</p>
      <p>Thank you for your interest. After careful review, we're unable to approve your request at this time.</p>
      <div style="background-color: #F3F4F6; border-left: 4px solid #6B7280; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; font-weight: 600; color: #374151;">Reason:</p>
        <p style="margin: 10px 0 0 0; color: #4B5563;">Please add the specific reason here.</p>
      </div>
      <p>If you have questions or would like to discuss this further, please don't hesitate to reach out.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{linkUrl}}" style="display: inline-block; padding: 12px 30px; background-color: #6B7280; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">Contact Support</a>
      </div>
    </div>
    <div class="footer">
      <p>This is an automated notification from Affiliate Marketplace.</p>
    </div>
  </div>
</body>
</html>`,
  },
];

export default function AdminEmailTemplates() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showStarterDialog, setShowStarterDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<'visual' | 'code'>('visual');
  const contentRef = useRef<HTMLTextAreaElement>(null);

  // Form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState<string>("system");
  const [subject, setSubject] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; description: string; errorDetails?: string }>({
    open: false,
    title: "",
    description: ""
  });
  const [selectedTemplateType, setSelectedTemplateType] = useState<TemplateType | null>(null);

  const { data: templates = [], isLoading: templatesLoading } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/admin/email-templates"],
    queryFn: async () => {
      const response = await fetch("/api/admin/email-templates", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch email templates");
      return response.json();
    },
    enabled: isAuthenticated && user?.role === 'admin',
  });

  const { data: templateTypes = [] } = useQuery<TemplateType[]>({
    queryKey: ["/api/admin/email-templates/available-types"],
    queryFn: async () => {
      const response = await fetch("/api/admin/email-templates/available-types", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch template types");
      return response.json();
    },
    enabled: isAuthenticated && user?.role === 'admin',
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/admin/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to create template");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-templates"] });
      toast({
        title: "Template Created",
        description: "The email template has been successfully created.",
      });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to create template",
        errorDetails: error.message,
      });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await fetch(`/api/admin/email-templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to update template");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-templates"] });
      toast({
        title: "Template Updated",
        description: "The email template has been successfully updated.",
      });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to update template",
        errorDetails: error.message,
      });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/email-templates/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to delete template");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-templates"] });
      toast({
        title: "Template Deleted",
        description: "The email template has been successfully deleted.",
      });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to delete template",
        errorDetails: error.message,
      });
    },
  });

  const duplicateTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/email-templates/${id}/duplicate`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to duplicate template");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-templates"] });
      toast({
        title: "Template Duplicated",
        description: "The email template has been duplicated. You can now edit the copy.",
      });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to duplicate template",
        errorDetails: error.message,
      });
    },
  });

  // Insert variable at cursor position
  const insertVariable = useCallback((variableName: string) => {
    const textarea = contentRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = htmlContent;
      const before = text.substring(0, start);
      const after = text.substring(end);
      const newText = before + `{{${variableName}}}` + after;
      setHtmlContent(newText);

      // Set cursor position after inserted variable
      setTimeout(() => {
        textarea.focus();
        const newPos = start + variableName.length + 4;
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    } else {
      setHtmlContent(htmlContent + `{{${variableName}}}`);
    }
  }, [htmlContent]);

  // Insert content block
  const insertContentBlock = useCallback((content: string) => {
    const textarea = contentRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const text = htmlContent;
      const before = text.substring(0, start);
      const after = text.substring(start);
      setHtmlContent(before + '\n' + content + '\n' + after);
    } else {
      setHtmlContent(htmlContent + '\n' + content);
    }
  }, [htmlContent]);

  // Insert variable into subject
  const insertSubjectVariable = useCallback((variableName: string) => {
    setSubject(subject + `{{${variableName}}}`);
  }, [subject]);

  const handleCreate = () => {
    setEditingTemplate(null);
    setName("");
    setSlug("");
    setCategory("system");
    setSubject("");
    setHtmlContent("");
    setDescription("");
    setIsActive(true);
    setSelectedTemplateType(null);
    setShowStarterDialog(true);
  };

  const handleSelectStarter = (starter: typeof STARTER_TEMPLATES[0] | null, templateType?: TemplateType) => {
    setShowStarterDialog(false);
    if (starter) {
      setSubject(starter.subject);
      setHtmlContent(starter.content);
      setName(starter.name);
    }
    if (templateType) {
      setSelectedTemplateType(templateType);
      setSlug(templateType.slug);
      setCategory(templateType.category);
      setName(templateType.name);
      setDescription(templateType.description);
    }
    setShowDialog(true);
  };

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setName(template.name);
    setSlug(template.slug);
    setCategory(template.category);
    setSubject(template.subject);
    setHtmlContent(template.htmlContent);
    setDescription(template.description || "");
    setIsActive(template.isActive);
    // Find matching template type for variable suggestions
    const matchingType = templateTypes.find(t => t.slug === template.slug);
    setSelectedTemplateType(matchingType || null);
    setShowDialog(true);
  };

  const handleDelete = (template: EmailTemplate) => {
    if (template.isSystem) {
      setErrorDialog({
        open: true,
        title: "Cannot Delete",
        description: "System templates cannot be deleted.",
      });
      return;
    }

    if (confirm("Are you sure you want to delete this email template? This action cannot be undone.")) {
      deleteTemplateMutation.mutate(template.id);
    }
  };

  const handleDuplicate = (template: EmailTemplate) => {
    duplicateTemplateMutation.mutate(template.id);
  };

  const handlePreview = async (template?: EmailTemplate) => {
    const templateToPreview = template || { subject, htmlContent: htmlContent };

    // Generate preview with sample data
    const sampleData: Record<string, string> = {};
    VARIABLES.forEach(v => {
      sampleData[v.name] = v.example;
    });

    let processedSubject = templateToPreview.subject;
    let processedHtml = templateToPreview.htmlContent;

    // Replace variables with sample data
    Object.entries(sampleData).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      processedSubject = processedSubject.replace(regex, value);
      processedHtml = processedHtml.replace(regex, value);
    });

    setPreviewSubject(processedSubject);
    setPreviewHtml(processedHtml);
    setShowPreviewDialog(true);
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      setErrorDialog({
        open: true,
        title: "Missing Information",
        description: "Please enter a template name",
      });
      return;
    }

    if (!subject.trim()) {
      setErrorDialog({
        open: true,
        title: "Missing Information",
        description: "Please enter an email subject line",
      });
      return;
    }

    if (!htmlContent.trim()) {
      setErrorDialog({
        open: true,
        title: "Missing Information",
        description: "Please add email content",
      });
      return;
    }

    // Auto-generate slug from name if not editing
    const finalSlug = editingTemplate
      ? slug
      : (slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));

    // Extract used variables from content
    const usedVariables: string[] = [];
    const variableRegex = /\{\{(\w+)\}\}/g;
    let match;
    const contentToCheck = subject + htmlContent;
    while ((match = variableRegex.exec(contentToCheck)) !== null) {
      if (!usedVariables.includes(match[1])) {
        usedVariables.push(match[1]);
      }
    }

    const data = {
      name,
      slug: finalSlug,
      category,
      subject,
      htmlContent,
      description: description || null,
      availableVariables: usedVariables,
      isActive,
    };

    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createTemplateMutation.mutate(data);
    }
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingTemplate(null);
    setName("");
    setSlug("");
    setCategory("system");
    setSubject("");
    setHtmlContent("");
    setDescription("");
    setIsActive(true);
    setActiveTab('visual');
    setSelectedTemplateType(null);
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (!editingTemplate && !slug) {
      setSlug(value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
  };

  if (isLoading || templatesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return null;
  }

  const filteredTemplates = templates.filter(template => {
    const matchesCategory = categoryFilter === "all" || template.category === categoryFilter;
    const matchesSearch = !searchTerm ||
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.subject.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const activeCount = templates.filter(t => t.isActive).length;

  return (
    <div className="space-y-6">
      <TopNavBar />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Email Templates</h1>
          <p className="text-muted-foreground mt-2">
            Create and customize email notifications sent to users
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{templates.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-muted-foreground">
              {templates.length - activeCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Template List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              All Templates
            </CardTitle>
            <div className="flex gap-2">
              <Input
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTemplates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No templates found. Click "Create Template" to add one.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTemplates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {template.name}
                        {template.isSystem && (
                          <Badge variant="outline" className="text-xs">System</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {CATEGORIES.find(c => c.value === template.category)?.label || template.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[250px] truncate text-muted-foreground">
                      {template.subject}
                    </TableCell>
                    <TableCell>
                      {template.isActive ? (
                        <Badge className="bg-green-500">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => handlePreview(template)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Preview</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(template)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => handleDuplicate(template)}>
                              <Copy className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Duplicate</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(template)}
                              disabled={template.isSystem}
                            >
                              <Trash2 className={`h-4 w-4 ${template.isSystem ? 'text-muted-foreground' : 'text-destructive'}`} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{template.isSystem ? 'System templates cannot be deleted' : 'Delete'}</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Starter Template Selection Dialog */}
      <Dialog open={showStarterDialog} onOpenChange={setShowStarterDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Choose a Starting Point</DialogTitle>
            <DialogDescription>
              Select a notification type to customize, use a design template, or start from scratch
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-6">
            {/* Notification Types - Grouped by Category */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Notification Templates (Recommended)
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Select a notification type to override its default email. The correct variables will be automatically available.
              </p>

              {/* Group template types by category */}
              {Object.entries(
                templateTypes.reduce((acc, t) => {
                  if (!acc[t.category]) acc[t.category] = [];
                  acc[t.category].push(t);
                  return acc;
                }, {} as Record<string, TemplateType[]>)
              ).map(([cat, types]) => {
                const catInfo = CATEGORIES.find(c => c.value === cat);
                const CatIcon = catInfo?.icon || Mail;

                // Check if template already exists for this type
                const existingForCat = types.filter(t =>
                  templates.some(template => template.slug === t.slug)
                );

                return (
                  <div key={cat} className="mb-4">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      <CatIcon className="h-3 w-3" />
                      {catInfo?.label || cat}
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {types.map(templateType => {
                        const exists = templates.some(t => t.slug === templateType.slug);
                        return (
                          <Card
                            key={templateType.type}
                            className={`cursor-pointer hover:border-primary transition-colors p-3 ${exists ? 'opacity-60' : ''}`}
                            onClick={() => {
                              if (!exists) {
                                handleSelectStarter(null, templateType);
                              }
                            }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{templateType.name}</p>
                                <p className="text-xs text-muted-foreground line-clamp-2">{templateType.description}</p>
                              </div>
                              {exists && (
                                <Badge variant="secondary" className="text-xs shrink-0">Exists</Badge>
                              )}
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <Separator />

            {/* Design Templates */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Design Templates
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Start with a pre-designed layout and customize it
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {/* Blank template option */}
                <Card
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => handleSelectStarter(null)}
                >
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Blank Template
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-1">
                    <p className="text-xs text-muted-foreground">Start from scratch</p>
                  </CardContent>
                </Card>

                {/* Pre-built templates */}
                {STARTER_TEMPLATES.map((starter, index) => (
                  <Card
                    key={index}
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => handleSelectStarter(starter)}
                  >
                    <CardHeader className="p-3 pb-1">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <LayoutTemplate className="h-4 w-4" />
                        {starter.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-1">
                      <p className="text-xs text-muted-foreground">{starter.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Email Template" : "Create Email Template"}
            </DialogTitle>
            <DialogDescription>
              Design your email using the visual editor or content blocks
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 py-4">
            {/* Template Type Info Banner */}
            {selectedTemplateType && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900">Customizing: {selectedTemplateType.name}</h4>
                    <p className="text-sm text-blue-700 mt-1">{selectedTemplateType.description}</p>
                    <p className="text-xs text-blue-600 mt-2">
                      Slug: <code className="bg-blue-100 px-1 rounded">{selectedTemplateType.slug}</code>
                      {" · "}
                      {selectedTemplateType.variables.length} variables available
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Template Name *</Label>
                <Input
                  placeholder="e.g., Application Approved"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <div className="flex items-center gap-2">
                          <cat.icon className="h-4 w-4" />
                          {cat.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Subject Line */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Subject Line *</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="h-3 w-3 mr-1" />
                      Insert Variable
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel>Click to insert</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {VARIABLES.slice(0, 5).map(v => (
                      <DropdownMenuItem key={v.name} onClick={() => insertSubjectVariable(v.name)}>
                        <v.icon className="h-4 w-4 mr-2 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{v.label}</div>
                          <div className="text-xs text-muted-foreground">Example: {v.example}</div>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Input
                placeholder="e.g., Your application has been approved!"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                This is what recipients see in their inbox. Use variables like {'{{'} userName {'}}'}
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Internal Description (optional)</Label>
              <Input
                placeholder="When is this template used? (internal note)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <Separator />

            {/* Email Content Editor */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Email Content *</Label>
                <div className="flex items-center gap-2">
                  {/* Content Blocks Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <LayoutTemplate className="h-4 w-4 mr-2" />
                        Add Block
                        <ChevronDown className="h-4 w-4 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <DropdownMenuLabel>Content Blocks</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {CONTENT_BLOCKS.map((block, index) => (
                        <DropdownMenuItem key={index} onClick={() => insertContentBlock(block.content)}>
                          <div>
                            <div className="font-medium">{block.name}</div>
                            <div className="text-xs text-muted-foreground">{block.description}</div>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Variables Dropdown - Shows template-specific variables if available */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Type className="h-4 w-4 mr-2" />
                        Insert Variable
                        <ChevronDown className="h-4 w-4 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
                      {selectedTemplateType && selectedTemplateType.variables.length > 0 ? (
                        <>
                          <DropdownMenuLabel className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            Variables for {selectedTemplateType.name}
                          </DropdownMenuLabel>
                          <p className="px-2 pb-2 text-xs text-muted-foreground">
                            These variables are available for this notification type
                          </p>
                          <DropdownMenuSeparator />
                          {selectedTemplateType.variables.map(v => (
                            <DropdownMenuItem key={v.name} onClick={() => insertVariable(v.name)}>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium font-mono text-xs bg-muted px-1 rounded">{`{{${v.name}}}`}</span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">{v.description}</div>
                                <div className="text-xs text-blue-600 mt-0.5">Example: {v.example}</div>
                              </div>
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-xs text-muted-foreground">All Variables</DropdownMenuLabel>
                          {VARIABLES.map(v => (
                            <DropdownMenuItem key={v.name} onClick={() => insertVariable(v.name)} className="opacity-70">
                              <v.icon className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <div className="font-medium text-sm">{v.label}</div>
                                <div className="text-xs text-muted-foreground truncate">{v.description}</div>
                              </div>
                            </DropdownMenuItem>
                          ))}
                        </>
                      ) : (
                        <>
                          <DropdownMenuLabel>Dynamic Variables</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {VARIABLES.map(v => (
                            <DropdownMenuItem key={v.name} onClick={() => insertVariable(v.name)}>
                              <v.icon className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <div className="font-medium">{v.label}</div>
                                <div className="text-xs text-muted-foreground truncate">{v.description}</div>
                              </div>
                            </DropdownMenuItem>
                          ))}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Preview Button */}
                  <Button variant="outline" size="sm" onClick={() => handlePreview()}>
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                </div>
              </div>

              {/* Editor */}
              <div className="border rounded-lg">
                <div className="flex items-center gap-1 p-2 border-b bg-muted/50">
                  <span className="text-xs text-muted-foreground px-2">
                    Tip: Click "Add Block" to insert pre-formatted sections, or "Insert Variable" for dynamic content
                  </span>
                </div>
                <Textarea
                  ref={contentRef}
                  placeholder="Start typing your email content here...

You can:
• Click 'Add Block' above to insert pre-formatted sections (buttons, alerts, etc.)
• Click 'Insert Variable' to add dynamic content like {{userName}}
• Type or paste your HTML content directly"
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  rows={16}
                  className="font-mono text-sm border-0 rounded-none focus-visible:ring-0"
                />
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
              <div>
                <Label className="font-medium">Active Status</Label>
                <p className="text-sm text-muted-foreground">
                  When active, this template will be used for sending emails
                </p>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
            >
              {editingTemplate ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              This shows how the email will appear with sample data filled in
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 flex-1 overflow-hidden">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium text-muted-foreground">Subject:</span>
              <span className="text-sm">{previewSubject}</span>
            </div>

            <div className="border rounded-lg overflow-hidden flex-1">
              <iframe
                srcDoc={previewHtml}
                className="w-full h-[500px]"
                title="Email Preview"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Dialog */}
      <GenericErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
        title={errorDialog.title}
        description={errorDialog.description}
        errorDetails={errorDialog.errorDetails}
        variant="error"
      />
    </div>
  );
}
