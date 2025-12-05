import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Mail, Edit, Trash, Plus, Send, Eye, Copy } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
  variables?: string[];
  isActive: boolean;
  createdAt: string;
  createdBy: string;
}

export default function EmailTemplates() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSendOpen, setIsSendOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    body: '',
    category: 'GENERAL',
    variables: [] as string[],
  });
  const [previewData, setPreviewData] = useState<any>({});
  const [sendData, setSendData] = useState({
    to: '',
    variables: {} as Record<string, string>,
  });

  const canEdit = user?.role === 'ADMIN' || user?.role === 'HR' || user?.role === 'MANAGER';

  // Fetch templates
  const { data: templates = [] } = useQuery<EmailTemplate[]>({
    queryKey: ['/api/email-templates'],
  });

  // Create template
  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/email-templates', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-templates'] });
      toast({
        title: 'Template created',
        description: 'Email template has been created successfully.',
      });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create email template.',
        variant: 'destructive',
      });
    },
  });

  // AI generation mutation
  const aiGenerateMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/email-templates/ai-generate', 'POST', data),
    onSuccess: (response) => {
      setFormData({
        ...formData,
        subject: response.subject || formData.subject,
        body: response.body || formData.body,
      });
      toast({
        title: 'AI Generated',
        description: 'Email content has been generated successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to generate content with AI.',
        variant: 'destructive',
      });
    },
  });

  // Update template
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest(`/api/email-templates/${id}`, 'PATCH', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-templates'] });
      toast({
        title: 'Template updated',
        description: 'Email template has been updated successfully.',
      });
      setIsEditOpen(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update email template.',
        variant: 'destructive',
      });
    },
  });

  // Delete template
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/email-templates/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-templates'] });
      toast({
        title: 'Template deleted',
        description: 'Email template has been deleted successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete email template.',
        variant: 'destructive',
      });
    },
  });

  // Send email
  const sendMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest(`/api/email-templates/${id}/send`, 'POST', data),
    onSuccess: () => {
      toast({
        title: 'Email sent',
        description: 'Email has been sent successfully.',
      });
      setIsSendOpen(false);
      setSendData({ to: '', variables: {} });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to send email.',
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      subject: '',
      body: '',
      category: 'GENERAL',
      variables: [],
    });
    setSelectedTemplate(null);
  };

  const handleCreate = () => {
    const variables = extractVariables(formData.body + ' ' + formData.subject);
    createMutation.mutate({ ...formData, variables, isActive: true });
  };

  const handleUpdate = () => {
    if (!selectedTemplate) return;
    const variables = extractVariables(formData.body + ' ' + formData.subject);
    updateMutation.mutate({
      id: selectedTemplate.id,
      data: { ...formData, variables },
    });
  };

  const handleEdit = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      body: template.body,
      category: template.category,
      variables: template.variables || [],
    });
    setIsEditOpen(true);
  };

  const handlePreview = async (template: EmailTemplate) => {
    setSelectedTemplate(template);
    const variables = template.variables || [];
    const previewVars: Record<string, string> = {};
    variables.forEach(v => {
      previewVars[v] = `[${v}]`;
    });
    setPreviewData(previewVars);
    setIsPreviewOpen(true);
  };

  const handleSend = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    const variables = template.variables || [];
    const sendVars: Record<string, string> = {};
    variables.forEach(v => {
      sendVars[v] = '';
    });
    setSendData({ to: '', variables: sendVars });
    setIsSendOpen(true);
  };

  const extractVariables = (text: string): string[] => {
    const regex = /{{(\w+)}}/g;
    const matches = text.match(regex) || [];
    return [...new Set(matches.map(m => m.replace(/[{}]/g, '')))];
  };

  const replaceVariables = (text: string, variables: Record<string, string>): string => {
    let result = text;
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, variables[key]);
    });
    return result;
  };

  const categoryColors: Record<string, string> = {
    INTERVIEW: 'bg-blue-100 text-blue-800',
    OFFER: 'bg-green-100 text-green-800',
    REJECTION: 'bg-red-100 text-red-800',
    ONBOARDING: 'bg-purple-100 text-purple-800',
    GENERAL: 'bg-gray-100 text-gray-800',
    FOLLOW_UP: 'bg-yellow-100 text-yellow-800',
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Email Templates</h1>
          <p className="text-gray-600 mt-1">Manage and customize email templates</p>
        </div>
        {canEdit && (
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Template
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Email Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Variables</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell>{template.subject}</TableCell>
                  <TableCell>
                    <Badge className={categoryColors[template.category]}>
                      {template.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {template.variables?.length || 0} variables
                  </TableCell>
                  <TableCell>
                    <Badge variant={template.isActive ? 'default' : 'secondary'}>
                      {template.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePreview(template)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSend(template)}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(template)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteMutation.mutate(template.id)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Email Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Template Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Interview Invitation"
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INTERVIEW">Interview</SelectItem>
                  <SelectItem value="OFFER">Offer</SelectItem>
                  <SelectItem value="REJECTION">Rejection</SelectItem>
                  <SelectItem value="ONBOARDING">Onboarding</SelectItem>
                  <SelectItem value="FOLLOW_UP">Follow Up</SelectItem>
                  <SelectItem value="GENERAL">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject</Label>
              <Input
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="e.g., Interview Invitation for {{position}} at ROOF-ER"
              />
              <p className="text-sm text-gray-500 mt-1">
                Use {{variableName}} for dynamic content
              </p>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Body</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    aiGenerateMutation.mutate({
                      category: formData.category,
                      name: formData.name,
                      subject: formData.subject,
                    });
                  }}
                  disabled={aiGenerateMutation.isPending || !formData.name}
                >
                  {aiGenerateMutation.isPending ? 'Generating...' : '✨ Generate with AI'}
                </Button>
              </div>
              <Textarea
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                placeholder="Dear {{candidateName}},&#10;&#10;We are pleased to invite you..."
                rows={10}
              />
            </div>
            {extractVariables(formData.body + ' ' + formData.subject).length > 0 && (
              <div>
                <Label>Detected Variables</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {extractVariables(formData.body + ' ' + formData.subject).map((v) => (
                    <Badge key={v} variant="secondary">
                      {v}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create & Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Email Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Template Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INTERVIEW">Interview</SelectItem>
                  <SelectItem value="OFFER">Offer</SelectItem>
                  <SelectItem value="REJECTION">Rejection</SelectItem>
                  <SelectItem value="ONBOARDING">Onboarding</SelectItem>
                  <SelectItem value="FOLLOW_UP">Follow Up</SelectItem>
                  <SelectItem value="GENERAL">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject</Label>
              <Input
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Body</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    aiGenerateMutation.mutate({
                      category: formData.category,
                      name: formData.name,
                      subject: formData.subject,
                    });
                  }}
                  disabled={aiGenerateMutation.isPending || !formData.name}
                >
                  {aiGenerateMutation.isPending ? 'Generating...' : '✨ Generate with AI'}
                </Button>
              </div>
              <Textarea
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                rows={10}
              />
            </div>
            {extractVariables(formData.body + ' ' + formData.subject).length > 0 && (
              <div>
                <Label>Detected Variables</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {extractVariables(formData.body + ' ' + formData.subject).map((v) => (
                    <Badge key={v} variant="secondary">
                      {v}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview Email Template</DialogTitle>
          </DialogHeader>
          {selectedTemplate && (
            <div className="space-y-4">
              <div>
                <Label>Subject</Label>
                <div className="p-3 bg-gray-50 rounded">
                  {replaceVariables(selectedTemplate.subject, previewData)}
                </div>
              </div>
              <div>
                <Label>Body</Label>
                <div 
                  className="p-3 bg-gray-50 rounded min-h-[200px] whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{
                    __html: replaceVariables(selectedTemplate.body, previewData)
                  }}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Dialog */}
      <Dialog open={isSendOpen} onOpenChange={setIsSendOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Send Email</DialogTitle>
          </DialogHeader>
          {selectedTemplate && (
            <div className="space-y-4">
              <div>
                <Label>Recipient Email</Label>
                <Input
                  type="email"
                  value={sendData.to}
                  onChange={(e) => setSendData({ ...sendData, to: e.target.value })}
                  placeholder="recipient@example.com"
                />
              </div>
              {selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
                <div>
                  <Label>Template Variables</Label>
                  <div className="space-y-2 mt-2">
                    {selectedTemplate.variables.map((variable) => (
                      <div key={variable}>
                        <Label className="text-sm">{variable}</Label>
                        <Input
                          value={sendData.variables[variable] || ''}
                          onChange={(e) =>
                            setSendData({
                              ...sendData,
                              variables: {
                                ...sendData.variables,
                                [variable]: e.target.value,
                              },
                            })
                          }
                          placeholder={`Enter ${variable}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <Label>Preview</Label>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="font-semibold">
                    {replaceVariables(selectedTemplate.subject, sendData.variables)}
                  </p>
                  <div 
                    className="mt-2 whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{
                      __html: replaceVariables(selectedTemplate.body, sendData.variables)
                    }}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSendOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                selectedTemplate &&
                sendMutation.mutate({ id: selectedTemplate.id, data: sendData })
              }
            >
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}