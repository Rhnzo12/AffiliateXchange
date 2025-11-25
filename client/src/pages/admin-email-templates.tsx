import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Plus, Pencil, Trash2, Mail, Eye, Copy, Code, X, Info } from "lucide-react";
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

const CATEGORIES = [
  { value: 'application', label: 'Application' },
  { value: 'payment', label: 'Payment' },
  { value: 'offer', label: 'Offer' },
  { value: 'company', label: 'Company' },
  { value: 'system', label: 'System' },
  { value: 'moderation', label: 'Moderation' },
  { value: 'authentication', label: 'Authentication' },
];

const COMMON_VARIABLES = [
  'userName',
  'companyName',
  'offerTitle',
  'applicationId',
  'trackingLink',
  'trackingCode',
  'amount',
  'grossAmount',
  'platformFee',
  'processingFee',
  'transactionId',
  'reviewRating',
  'reviewText',
  'messagePreview',
  'daysUntilExpiration',
  'linkUrl',
  'verificationUrl',
  'resetUrl',
  'otpCode',
];

const BASE_STYLES = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6;
    color: #333;
    background-color: #f4f4f4;
    margin: 0;
    padding: 0;
  }
  .container {
    max-width: 600px;
    margin: 0 auto;
    background-color: #ffffff;
    padding: 20px;
  }
  .header {
    background-color: #4F46E5;
    color: #ffffff;
    padding: 30px 20px;
    text-align: center;
    border-radius: 8px 8px 0 0;
  }
  .content {
    padding: 30px 20px;
  }
  .button {
    display: inline-block;
    padding: 12px 30px;
    background-color: #4F46E5;
    color: #ffffff;
    text-decoration: none;
    border-radius: 6px;
    margin: 20px 0;
    font-weight: 600;
  }
  .footer {
    text-align: center;
    padding: 20px;
    color: #666;
    font-size: 14px;
  }
`;

const DEFAULT_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Email Title</h1>
    </div>
    <div class="content">
      <p>Hi {{userName}},</p>
      <p>Your message content goes here.</p>
      <a href="{{linkUrl}}" class="button">Take Action</a>
    </div>
    <div class="footer">
      <p>This is an automated notification from Affiliate Marketplace.</p>
      <p>Update your <a href="/settings">notification preferences</a> anytime.</p>
    </div>
  </div>
</body>
</html>`;

export default function AdminEmailTemplates() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState<string>("system");
  const [subject, setSubject] = useState("");
  const [htmlContent, setHtmlContent] = useState(DEFAULT_TEMPLATE);
  const [description, setDescription] = useState("");
  const [availableVariables, setAvailableVariables] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);

  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; description: string; errorDetails?: string }>({
    open: false,
    title: "",
    description: ""
  });

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

  const handleCreate = () => {
    setEditingTemplate(null);
    setName("");
    setSlug("");
    setCategory("system");
    setSubject("");
    setHtmlContent(DEFAULT_TEMPLATE);
    setDescription("");
    setAvailableVariables([]);
    setIsActive(true);
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
    setAvailableVariables(template.availableVariables || []);
    setIsActive(template.isActive);
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

  const handlePreview = async (template: EmailTemplate) => {
    try {
      const response = await fetch(`/api/admin/email-templates/${template.id}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sampleData: {
            userName: "John Doe",
            companyName: "Acme Corp",
            offerTitle: "Summer Sale Promotion",
            amount: "$500.00",
            trackingLink: "https://track.example.com/abc123",
            linkUrl: "https://app.affiliatexchange.com/dashboard",
          },
        }),
      });

      if (!response.ok) throw new Error("Failed to preview template");

      const data = await response.json();
      setPreviewSubject(data.subject);
      setPreviewHtml(data.html);
      setShowPreviewDialog(true);
    } catch (error: any) {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to preview template",
        errorDetails: error.message,
      });
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Template name is required",
      });
      return;
    }

    if (!slug.trim()) {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Template slug is required",
      });
      return;
    }

    if (!subject.trim()) {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Subject line is required",
      });
      return;
    }

    if (!htmlContent.trim()) {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "HTML content is required",
      });
      return;
    }

    const data = {
      name,
      slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      category,
      subject,
      htmlContent,
      description: description || null,
      availableVariables,
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
    setHtmlContent(DEFAULT_TEMPLATE);
    setDescription("");
    setAvailableVariables([]);
    setIsActive(true);
  };

  const handleNameChange = (value: string) => {
    setName(value);
    // Auto-generate slug from name if slug is empty or matches previous auto-generated value
    if (!editingTemplate && (!slug || slug === name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))) {
      setSlug(value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    }
  };

  const toggleVariable = (variable: string) => {
    if (availableVariables.includes(variable)) {
      setAvailableVariables(availableVariables.filter(v => v !== variable));
    } else {
      setAvailableVariables([...availableVariables, variable]);
    }
  };

  const insertVariable = (variable: string) => {
    setHtmlContent(htmlContent + `{{${variable}}}`);
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
      template.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.subject.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const activeCount = templates.filter(t => t.isActive).length;
  const categoryGroups = CATEGORIES.map(cat => ({
    ...cat,
    count: templates.filter(t => t.category === cat.value).length,
  }));

  return (
    <div className="space-y-6">
      <TopNavBar />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Email Templates</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage email templates with customizable variables
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
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
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {categoryGroups.filter(c => c.count > 0).length}
            </div>
          </CardContent>
        </Card>
      </div>

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
                <TableHead>Slug</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTemplates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {template.slug}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {CATEGORIES.find(c => c.value === template.category)?.label || template.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {template.subject}
                    </TableCell>
                    <TableCell>
                      {template.isActive ? (
                        <Badge variant="default" className="bg-green-500">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePreview(template)}
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(template)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDuplicate(template)}
                          title="Duplicate"
                          disabled={duplicateTemplateMutation.isPending}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(template)}
                          disabled={deleteTemplateMutation.isPending || template.isSystem}
                          title={template.isSystem ? "System templates cannot be deleted" : "Delete"}
                        >
                          <Trash2 className={`h-4 w-4 ${template.isSystem ? 'text-muted-foreground' : 'text-destructive'}`} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Email Template" : "Create Email Template"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? "Update the email template details and content."
                : "Create a new email template with customizable variables."}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="variables">Variables</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name *</label>
                  <Input
                    placeholder="e.g., Application Approved"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Slug *</label>
                  <Input
                    placeholder="e.g., application-approved"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Unique identifier used to reference this template in code
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category *</label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between space-x-2 pt-6">
                  <div>
                    <label className="text-sm font-medium">Active</label>
                    <p className="text-xs text-muted-foreground">
                      Inactive templates won't be used
                    </p>
                  </div>
                  <Switch
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Subject Line *</label>
                <Input
                  placeholder="e.g., Your application has been approved!"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  You can use variables like {"{{userName}}"} or {"{{offerTitle}}"}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  placeholder="Brief description of when this template is used..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>
            </TabsContent>

            <TabsContent value="content" className="space-y-4 py-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">HTML Content *</label>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Info className="h-3 w-3" />
                    Use {"{{variableName}}"} for dynamic content
                  </div>
                </div>
                <Textarea
                  placeholder="Enter HTML content..."
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  rows={20}
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-muted-foreground">Quick insert:</span>
                {COMMON_VARIABLES.slice(0, 8).map(variable => (
                  <Button
                    key={variable}
                    variant="outline"
                    size="sm"
                    onClick={() => insertVariable(variable)}
                    className="text-xs"
                  >
                    <Code className="h-3 w-3 mr-1" />
                    {variable}
                  </Button>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="variables" className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Available Variables</label>
                <p className="text-xs text-muted-foreground">
                  Select the variables that this template uses. This helps admins understand what data is available.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {COMMON_VARIABLES.map(variable => (
                  <div
                    key={variable}
                    className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                      availableVariables.includes(variable)
                        ? 'bg-primary/10 border-primary'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => toggleVariable(variable)}
                  >
                    <input
                      type="checkbox"
                      checked={availableVariables.includes(variable)}
                      onChange={() => toggleVariable(variable)}
                      className="rounded"
                    />
                    <span className="text-sm font-mono">{`{{${variable}}}`}</span>
                  </div>
                ))}
              </div>

              {availableVariables.length > 0 && (
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">Selected Variables:</p>
                  <div className="flex flex-wrap gap-2">
                    {availableVariables.map(variable => (
                      <Badge key={variable} variant="secondary" className="font-mono">
                        {`{{${variable}}}`}
                        <button
                          onClick={() => toggleVariable(variable)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
            >
              {editingTemplate ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              Subject: <strong>{previewSubject}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="border rounded-lg overflow-hidden">
            <iframe
              srcDoc={previewHtml}
              className="w-full h-[500px]"
              title="Email Preview"
            />
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
