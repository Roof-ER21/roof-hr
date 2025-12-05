import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Mail, Plus, Send, Users, Clock, Eye, MousePointer, MessageSquare, Pause, Play, Trash2, Edit, ChevronRight, Sparkles } from 'lucide-react';
import { format } from 'date-fns';

interface EmailCampaign {
  id: string;
  name: string;
  description?: string;
  type: 'ONBOARDING' | 'NURTURE' | 'FOLLOW_UP' | 'REJECTION' | 'OFFER' | 'GENERAL';
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  targetAudience: 'ALL_CANDIDATES' | 'SPECIFIC_STAGE' | 'CUSTOM';
  stageFilter?: string;
  totalRecipients: number;
  sentCount: number;
  openCount: number;
  clickCount: number;
  responseCount: number;
  createdBy: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface CampaignStep {
  id: string;
  campaignId: string;
  stepNumber: number;
  name: string;
  subject: string;
  content: string;
  delayDays: number;
  conditionType: 'ALWAYS' | 'IF_OPENED' | 'IF_NOT_OPENED' | 'IF_CLICKED' | 'IF_NOT_CLICKED';
  isActive: boolean;
}

export function EmailCampaignManager() {
  const { toast } = useToast();
  const [selectedCampaign, setSelectedCampaign] = useState<EmailCampaign | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  // Fetch campaigns
  const { data: campaigns = [], isLoading } = useQuery<EmailCampaign[]>({
    queryKey: ['/api/email-campaigns'],
  });

  // Fetch campaign steps
  const { data: campaignSteps = [] } = useQuery<CampaignStep[]>({
    queryKey: selectedCampaign ? [`/api/email-campaigns/${selectedCampaign.id}/steps`] : [],
    enabled: !!selectedCampaign,
  });

  // Create campaign mutation
  const createCampaignMutation = useMutation({
    mutationFn: (data: Partial<EmailCampaign>) => 
      apiRequest('/api/email-campaigns', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-campaigns'] });
      setShowCreateDialog(false);
      toast({
        title: 'Campaign Created',
        description: 'Your email campaign has been created successfully.',
      });
    },
  });

  // Update campaign status
  const updateCampaignStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest(`/api/email-campaigns/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-campaigns'] });
      toast({
        title: 'Status Updated',
        description: 'Campaign status has been updated.',
      });
    },
  });

  // Generate AI content
  const generateAiContentMutation = useMutation({
    mutationFn: (prompt: string) =>
      apiRequest('/api/ai/generate-email', {
        method: 'POST',
        body: JSON.stringify({ prompt }),
      }),
    onSuccess: (data) => {
      toast({
        title: 'Content Generated',
        description: 'AI-generated email content is ready.',
      });
      setShowAiDialog(false);
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-500';
      case 'PAUSED': return 'bg-yellow-500';
      case 'COMPLETED': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getCampaignTypeIcon = (type: string) => {
    switch (type) {
      case 'ONBOARDING': return '🎯';
      case 'NURTURE': return '🌱';
      case 'FOLLOW_UP': return '📞';
      case 'REJECTION': return '❌';
      case 'OFFER': return '🎉';
      default: return '📧';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Email Campaigns</h2>
          <p className="text-muted-foreground">
            Create and manage multi-step email campaigns for candidate engagement
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Sparkles className="h-4 w-4 mr-2" />
                AI Generate
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Email with AI</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Describe the email you want to generate</Label>
                  <Textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="E.g., Create a friendly follow-up email for candidates who passed the initial screening..."
                    rows={4}
                  />
                </div>
                <Button
                  onClick={() => generateAiContentMutation.mutate(aiPrompt)}
                  disabled={!aiPrompt || generateAiContentMutation.isPending}
                >
                  {generateAiContentMutation.isPending ? 'Generating...' : 'Generate'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Campaign</DialogTitle>
              </DialogHeader>
              <CreateCampaignForm
                onSubmit={(data) => createCampaignMutation.mutate(data)}
                onCancel={() => setShowCreateDialog(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Campaign Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {campaigns.filter(c => c.status === 'ACTIVE').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Recipients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {campaigns.reduce((sum, c) => sum + c.totalRecipients, 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Average Open Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {campaigns.length > 0
                ? Math.round(
                    campaigns.reduce((sum, c) => 
                      sum + (c.sentCount > 0 ? (c.openCount / c.sentCount) * 100 : 0), 0
                    ) / campaigns.length
                  )
                : 0}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {campaigns.reduce((sum, c) => sum + c.responseCount, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns List */}
      <Card>
        <CardHeader>
          <CardTitle>All Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No campaigns created yet. Click "New Campaign" to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedCampaign(campaign)}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{getCampaignTypeIcon(campaign.type)}</span>
                        <h3 className="font-semibold text-lg">{campaign.name}</h3>
                        <Badge className={getStatusColor(campaign.status)}>
                          {campaign.status}
                        </Badge>
                      </div>
                      {campaign.description && (
                        <p className="text-sm text-muted-foreground">{campaign.description}</p>
                      )}
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {campaign.totalRecipients} recipients
                        </span>
                        <span className="flex items-center gap-1">
                          <Send className="h-3 w-3" />
                          {campaign.sentCount} sent
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {campaign.openCount} opens
                        </span>
                        <span className="flex items-center gap-1">
                          <MousePointer className="h-3 w-3" />
                          {campaign.clickCount} clicks
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {campaign.responseCount} responses
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {campaign.status === 'ACTIVE' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateCampaignStatusMutation.mutate({
                              id: campaign.id,
                              status: 'PAUSED',
                            });
                          }}
                        >
                          <Pause className="h-4 w-4" />
                        </Button>
                      )}
                      {campaign.status === 'PAUSED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateCampaignStatusMutation.mutate({
                              id: campaign.id,
                              status: 'ACTIVE',
                            });
                          }}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Handle edit
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Campaign Details Modal */}
      {selectedCampaign && (
        <Dialog open={!!selectedCampaign} onOpenChange={() => setSelectedCampaign(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedCampaign.name}</DialogTitle>
            </DialogHeader>
            <CampaignDetails campaign={selectedCampaign} steps={campaignSteps} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Create Campaign Form Component
function CreateCampaignForm({ onSubmit, onCancel }: {
  onSubmit: (data: Partial<EmailCampaign>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'GENERAL' as EmailCampaign['type'],
    targetAudience: 'ALL_CANDIDATES' as EmailCampaign['targetAudience'],
    stageFilter: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Campaign Name</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="E.g., Q1 Candidate Nurture Campaign"
          required
        />
      </div>

      <div>
        <Label>Description</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe the purpose and goals of this campaign..."
          rows={3}
        />
      </div>

      <div>
        <Label>Campaign Type</Label>
        <Select
          value={formData.type}
          onValueChange={(value) => setFormData({ ...formData, type: value as EmailCampaign['type'] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ONBOARDING">Onboarding</SelectItem>
            <SelectItem value="NURTURE">Nurture</SelectItem>
            <SelectItem value="FOLLOW_UP">Follow-up</SelectItem>
            <SelectItem value="REJECTION">Rejection</SelectItem>
            <SelectItem value="OFFER">Offer</SelectItem>
            <SelectItem value="GENERAL">General</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Target Audience</Label>
        <Select
          value={formData.targetAudience}
          onValueChange={(value) => setFormData({ ...formData, targetAudience: value as EmailCampaign['targetAudience'] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL_CANDIDATES">All Candidates</SelectItem>
            <SelectItem value="SPECIFIC_STAGE">Specific Stage</SelectItem>
            <SelectItem value="CUSTOM">Custom Selection</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {formData.targetAudience === 'SPECIFIC_STAGE' && (
        <div>
          <Label>Stage Filter</Label>
          <Select
            value={formData.stageFilter}
            onValueChange={(value) => setFormData({ ...formData, stageFilter: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="APPLIED">Applied</SelectItem>
              <SelectItem value="SCREENING">Screening</SelectItem>
              <SelectItem value="INTERVIEW">Interview</SelectItem>
              <SelectItem value="OFFER">Offer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          Create Campaign
        </Button>
      </div>
    </form>
  );
}

// Campaign Details Component
function CampaignDetails({ campaign, steps }: {
  campaign: EmailCampaign;
  steps: CampaignStep[];
}) {
  return (
    <div className="space-y-6">
      {/* Campaign Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Type</Label>
          <p className="text-sm">{campaign.type}</p>
        </div>
        <div>
          <Label>Status</Label>
          <Badge className={getStatusColor(campaign.status)}>
            {campaign.status}
          </Badge>
        </div>
        <div>
          <Label>Target Audience</Label>
          <p className="text-sm">{campaign.targetAudience}</p>
        </div>
        <div>
          <Label>Created</Label>
          <p className="text-sm">{format(new Date(campaign.createdAt), 'PPP')}</p>
        </div>
      </div>

      {/* Campaign Steps */}
      <div>
        <h3 className="font-semibold mb-3">Campaign Steps</h3>
        {steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No steps configured yet.</p>
        ) : (
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div key={step.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                      {step.stepNumber}
                    </div>
                    <div>
                      <p className="font-medium">{step.name}</p>
                      <p className="text-sm text-muted-foreground">{step.subject}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {step.delayDays > 0 && (
                      <Badge variant="outline">
                        <Clock className="h-3 w-3 mr-1" />
                        +{step.delayDays} days
                      </Badge>
                    )}
                    <Badge variant={step.isActive ? 'default' : 'secondary'}>
                      {step.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <ChevronRight className="h-4 w-4 mx-auto mt-2 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Campaign Analytics */}
      <div>
        <h3 className="font-semibold mb-3">Performance Analytics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold">{campaign.sentCount}</p>
            <p className="text-sm text-muted-foreground">Emails Sent</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">
              {campaign.sentCount > 0 
                ? Math.round((campaign.openCount / campaign.sentCount) * 100) 
                : 0}%
            </p>
            <p className="text-sm text-muted-foreground">Open Rate</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">
              {campaign.sentCount > 0 
                ? Math.round((campaign.clickCount / campaign.sentCount) * 100) 
                : 0}%
            </p>
            <p className="text-sm text-muted-foreground">Click Rate</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{campaign.responseCount}</p>
            <p className="text-sm text-muted-foreground">Responses</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'ACTIVE': return 'bg-green-100 text-green-800';
    case 'PAUSED': return 'bg-yellow-100 text-yellow-800';
    case 'COMPLETED': return 'bg-blue-100 text-blue-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}