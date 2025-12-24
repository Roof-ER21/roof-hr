/**
 * Campaign Builder - Email/SMS Campaign Creation Interface
 * Full-featured campaign builder with templates, scheduling, and A/B testing
 */

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  Mail, MessageSquare, Users, Calendar, Clock, Send, Eye,
  FileText, Loader2, CheckCircle, AlertCircle, Sparkles,
  Target, BarChart, ArrowRight, Copy, Trash2, Plus, Save
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: 'welcome' | 'announcement' | 'reminder' | 'newsletter' | 'custom';
}

interface CampaignData {
  name: string;
  type: 'email' | 'sms';
  subject: string;
  body: string;
  recipientType: 'all' | 'department' | 'role' | 'custom';
  recipientFilter: string;
  scheduleType: 'now' | 'later' | 'recurring';
  scheduledAt?: string;
  recurringPattern?: string;
  abTestEnabled: boolean;
  abTestSubject?: string;
}

// Pre-built email templates
const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'welcome-new-hire',
    name: 'New Hire Welcome',
    subject: 'Welcome to The Roof Docs!',
    body: `Dear {{firstName}},

Welcome to The Roof Docs team! We're thrilled to have you join us.

Your first day is {{startDate}}. Please report to our office at 8:30 AM.

Before your first day, please complete the following:
1. Review the employee handbook (attached)
2. Complete your onboarding paperwork
3. Set up your company email account

If you have any questions, don't hesitate to reach out.

Best regards,
The HR Team`,
    category: 'welcome'
  },
  {
    id: 'company-announcement',
    name: 'Company Announcement',
    subject: 'Important Company Update',
    body: `Dear Team,

We have an important announcement to share with you.

{{announcement_content}}

If you have any questions, please reach out to your manager or HR.

Best regards,
The Roof Docs Leadership Team`,
    category: 'announcement'
  },
  {
    id: 'pto-reminder',
    name: 'PTO Expiration Reminder',
    subject: 'Reminder: Your PTO Balance',
    body: `Dear {{firstName}},

This is a friendly reminder about your current PTO balance.

Current Balance: {{ptoBalance}} hours
Expiring Soon: {{expiringPto}} hours

Please remember to use your PTO before it expires. If you have any questions about your balance, please contact HR.

Best regards,
HR Department`,
    category: 'reminder'
  },
  {
    id: 'monthly-newsletter',
    name: 'Monthly Newsletter',
    subject: 'The Roof Docs Monthly Update - {{month}}',
    body: `Hi {{firstName}},

Here's what's happening at The Roof Docs this month!

**Company Highlights**
{{highlights}}

**New Team Members**
{{new_hires}}

**Upcoming Events**
{{events}}

**Recognition Corner**
{{recognition}}

Have a great month!
The Roof Docs Team`,
    category: 'newsletter'
  },
  {
    id: 'performance-review',
    name: 'Performance Review Notice',
    subject: 'Your Performance Review is Scheduled',
    body: `Dear {{firstName}},

Your performance review has been scheduled for {{reviewDate}} at {{reviewTime}}.

Please prepare by:
1. Completing your self-assessment
2. Reviewing your goals from last quarter
3. Preparing discussion points

Your manager: {{managerName}}
Location: {{location}}

Best regards,
HR Department`,
    category: 'reminder'
  },
  {
    id: 'blank-template',
    name: 'Blank Template',
    subject: '',
    body: '',
    category: 'custom'
  }
];

// Categories for filtering
const categoryConfig = {
  welcome: { label: 'Welcome', color: 'bg-green-100 text-green-700 border-green-200' },
  announcement: { label: 'Announcement', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  reminder: { label: 'Reminder', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  newsletter: { label: 'Newsletter', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  custom: { label: 'Custom', color: 'bg-gray-100 text-gray-700 border-gray-200' }
};

interface CampaignBuilderProps {
  onCampaignCreated?: () => void;
}

export function CampaignBuilder({ onCampaignCreated }: CampaignBuilderProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);

  const [campaign, setCampaign] = useState<CampaignData>({
    name: '',
    type: 'email',
    subject: '',
    body: '',
    recipientType: 'all',
    recipientFilter: '',
    scheduleType: 'now',
    abTestEnabled: false
  });

  // Fetch departments for segmentation
  const { data: departments = [] } = useQuery<any[]>({
    queryKey: ['/api/departments']
  });

  // Fetch employee count for preview
  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ['/api/employees']
  });

  // Create campaign mutation
  const createCampaign = useMutation({
    mutationFn: async (data: CampaignData) => {
      return apiRequest('/api/email-campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name: data.name,
          type: data.type,
          subject: data.subject,
          body: data.body,
          recipientType: data.recipientType,
          recipientFilter: data.recipientFilter,
          status: data.scheduleType === 'now' ? 'sending' : 'scheduled',
          scheduledAt: data.scheduledAt,
          recurringPattern: data.recurringPattern,
          abTestEnabled: data.abTestEnabled,
          abTestSubject: data.abTestSubject
        })
      });
    },
    onSuccess: () => {
      toast({
        title: 'Campaign Created!',
        description: campaign.scheduleType === 'now'
          ? 'Your campaign is being sent now'
          : 'Your campaign has been scheduled'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/email-campaigns'] });
      onCampaignCreated?.();
      resetForm();
    },
    onError: () => {
      toast({
        title: 'Failed to create campaign',
        description: 'Please try again',
        variant: 'destructive'
      });
    }
  });

  const resetForm = () => {
    setCampaign({
      name: '',
      type: 'email',
      subject: '',
      body: '',
      recipientType: 'all',
      recipientFilter: '',
      scheduleType: 'now',
      abTestEnabled: false
    });
    setStep(1);
    setSelectedTemplate(null);
  };

  const applyTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setCampaign(prev => ({
      ...prev,
      subject: template.subject,
      body: template.body
    }));
  };

  const getRecipientCount = () => {
    if (campaign.recipientType === 'all') {
      return employees.length;
    }
    if (campaign.recipientType === 'department' && campaign.recipientFilter) {
      return employees.filter((e: any) => e.department === campaign.recipientFilter).length;
    }
    if (campaign.recipientType === 'role' && campaign.recipientFilter) {
      return employees.filter((e: any) => e.role === campaign.recipientFilter).length;
    }
    return 0;
  };

  const canProceed = () => {
    if (step === 1) return campaign.name.trim() !== '';
    if (step === 2) return campaign.subject.trim() !== '' && campaign.body.trim() !== '';
    if (step === 3) return campaign.recipientType !== '';
    return true;
  };

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {[
            { num: 1, label: 'Setup' },
            { num: 2, label: 'Content' },
            { num: 3, label: 'Recipients' },
            { num: 4, label: 'Schedule' }
          ].map(({ num, label }) => (
            <div
              key={num}
              className={cn(
                "flex items-center gap-2 cursor-pointer",
                num <= step ? "text-blue-600" : "text-gray-400"
              )}
              onClick={() => num < step && setStep(num)}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center font-medium",
                step === num ? "bg-blue-600 text-white" :
                step > num ? "bg-green-500 text-white" :
                "bg-gray-200 text-gray-500"
              )}>
                {step > num ? <CheckCircle className="w-5 h-5" /> : num}
              </div>
              <span className="hidden sm:inline font-medium">{label}</span>
              {num < 4 && <ArrowRight className="w-4 h-4 text-gray-300" />}
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={resetForm}>
          <Trash2 className="w-4 h-4 mr-2" />
          Reset
        </Button>
      </div>

      {/* Step 1: Campaign Setup */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-500" />
              Campaign Setup
            </CardTitle>
            <CardDescription>Choose campaign type and give it a name</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Campaign Type */}
            <div className="space-y-3">
              <Label>Campaign Type</Label>
              <div className="grid grid-cols-2 gap-4">
                <Card
                  className={cn(
                    "cursor-pointer transition-all",
                    campaign.type === 'email' && "ring-2 ring-blue-500 bg-blue-50"
                  )}
                  onClick={() => setCampaign(prev => ({ ...prev, type: 'email' }))}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className={cn(
                      "p-3 rounded-lg",
                      campaign.type === 'email' ? "bg-blue-500" : "bg-gray-100"
                    )}>
                      <Mail className={cn(
                        "w-6 h-6",
                        campaign.type === 'email' ? "text-white" : "text-gray-500"
                      )} />
                    </div>
                    <div>
                      <p className="font-medium">Email Campaign</p>
                      <p className="text-sm text-gray-500">HTML emails with rich formatting</p>
                    </div>
                  </CardContent>
                </Card>
                <Card
                  className={cn(
                    "cursor-pointer transition-all",
                    campaign.type === 'sms' && "ring-2 ring-green-500 bg-green-50"
                  )}
                  onClick={() => setCampaign(prev => ({ ...prev, type: 'sms' }))}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className={cn(
                      "p-3 rounded-lg",
                      campaign.type === 'sms' ? "bg-green-500" : "bg-gray-100"
                    )}>
                      <MessageSquare className={cn(
                        "w-6 h-6",
                        campaign.type === 'sms' ? "text-white" : "text-gray-500"
                      )} />
                    </div>
                    <div>
                      <p className="font-medium">SMS Campaign</p>
                      <p className="text-sm text-gray-500">Short text messages</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Campaign Name */}
            <div className="space-y-2">
              <Label htmlFor="campaign-name">Campaign Name</Label>
              <Input
                id="campaign-name"
                placeholder="e.g., Q4 Company Newsletter"
                value={campaign.name}
                onChange={(e) => setCampaign(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Content */}
      {step === 2 && (
        <div className="grid grid-cols-3 gap-6">
          {/* Template Selector */}
          <Card className="col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {EMAIL_TEMPLATES.map((template) => (
                    <Card
                      key={template.id}
                      className={cn(
                        "cursor-pointer transition-all hover:shadow-md",
                        selectedTemplate?.id === template.id && "ring-2 ring-blue-500"
                      )}
                      onClick={() => applyTemplate(template)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-sm">{template.name}</p>
                            <Badge variant="outline" className={cn("text-xs mt-1", categoryConfig[template.category].color)}>
                              {categoryConfig[template.category].label}
                            </Badge>
                          </div>
                          {selectedTemplate?.id === template.id && (
                            <CheckCircle className="w-4 h-4 text-blue-500" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Content Editor */}
          <Card className="col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Compose {campaign.type === 'email' ? 'Email' : 'Message'}
                </span>
                <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {campaign.type === 'email' && (
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject Line</Label>
                  <Input
                    id="subject"
                    placeholder="Enter email subject..."
                    value={campaign.subject}
                    onChange={(e) => setCampaign(prev => ({ ...prev, subject: e.target.value }))}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="body">{campaign.type === 'email' ? 'Email Body' : 'Message'}</Label>
                <Textarea
                  id="body"
                  placeholder={campaign.type === 'email'
                    ? "Write your email content here... Use {{variable}} for personalization"
                    : "Write your SMS message (160 chars recommended)..."
                  }
                  value={campaign.body}
                  onChange={(e) => setCampaign(prev => ({ ...prev, body: e.target.value }))}
                  className="min-h-[300px] font-mono text-sm"
                />
                {campaign.type === 'sms' && (
                  <p className="text-xs text-gray-500">
                    Character count: {campaign.body.length}/160
                    {campaign.body.length > 160 && (
                      <span className="text-yellow-600 ml-2">
                        (Will be sent as {Math.ceil(campaign.body.length / 160)} messages)
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* A/B Testing */}
              {campaign.type === 'email' && (
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart className="w-4 h-4 text-purple-500" />
                      <Label htmlFor="ab-test">Enable A/B Testing</Label>
                    </div>
                    <Switch
                      id="ab-test"
                      checked={campaign.abTestEnabled}
                      onCheckedChange={(checked) => setCampaign(prev => ({ ...prev, abTestEnabled: checked }))}
                    />
                  </div>
                  {campaign.abTestEnabled && (
                    <div className="space-y-2">
                      <Label htmlFor="ab-subject">Alternative Subject Line (Test B)</Label>
                      <Input
                        id="ab-subject"
                        placeholder="Enter alternative subject for A/B test..."
                        value={campaign.abTestSubject || ''}
                        onChange={(e) => setCampaign(prev => ({ ...prev, abTestSubject: e.target.value }))}
                      />
                      <p className="text-xs text-gray-500">
                        50% of recipients will receive each subject line. Best performer will be used for future sends.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 3: Recipients */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-green-500" />
              Select Recipients
            </CardTitle>
            <CardDescription>Choose who will receive this campaign</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: 'all', label: 'All Employees', desc: 'Send to everyone in the company', icon: Users },
                { value: 'department', label: 'By Department', desc: 'Target specific department(s)', icon: Target },
                { value: 'role', label: 'By Role', desc: 'Target specific role(s)', icon: Users },
                { value: 'custom', label: 'Custom List', desc: 'Upload or paste email list', icon: FileText }
              ].map(({ value, label, desc, icon: Icon }) => (
                <Card
                  key={value}
                  className={cn(
                    "cursor-pointer transition-all",
                    campaign.recipientType === value && "ring-2 ring-green-500 bg-green-50"
                  )}
                  onClick={() => setCampaign(prev => ({ ...prev, recipientType: value as any, recipientFilter: '' }))}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className={cn(
                      "p-3 rounded-lg",
                      campaign.recipientType === value ? "bg-green-500" : "bg-gray-100"
                    )}>
                      <Icon className={cn(
                        "w-6 h-6",
                        campaign.recipientType === value ? "text-white" : "text-gray-500"
                      )} />
                    </div>
                    <div>
                      <p className="font-medium">{label}</p>
                      <p className="text-sm text-gray-500">{desc}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Department/Role Selection */}
            {(campaign.recipientType === 'department' || campaign.recipientType === 'role') && (
              <div className="space-y-2">
                <Label>
                  Select {campaign.recipientType === 'department' ? 'Department' : 'Role'}
                </Label>
                <Select
                  value={campaign.recipientFilter}
                  onValueChange={(value) => setCampaign(prev => ({ ...prev, recipientFilter: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${campaign.recipientType}...`} />
                  </SelectTrigger>
                  <SelectContent>
                    {campaign.recipientType === 'department' ? (
                      departments.map((dept: any) => (
                        <SelectItem key={dept.id || dept} value={dept.name || dept}>
                          {dept.name || dept}
                        </SelectItem>
                      ))
                    ) : (
                      ['Manager', 'Sales Rep', 'Installer', 'Admin', 'HR', 'Finance'].map((role) => (
                        <SelectItem key={role} value={role}>{role}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Custom List */}
            {campaign.recipientType === 'custom' && (
              <div className="space-y-2">
                <Label>Email Addresses (one per line)</Label>
                <Textarea
                  placeholder="john@example.com&#10;jane@example.com&#10;..."
                  value={campaign.recipientFilter}
                  onChange={(e) => setCampaign(prev => ({ ...prev, recipientFilter: e.target.value }))}
                  className="min-h-[150px] font-mono text-sm"
                />
              </div>
            )}

            {/* Recipient Count */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="font-medium">Estimated Recipients</p>
                  <p className="text-sm text-gray-500">Based on current selection</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-600">{getRecipientCount()}</p>
                <p className="text-sm text-gray-500">people</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Schedule */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-500" />
              Schedule Delivery
            </CardTitle>
            <CardDescription>Choose when to send your campaign</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              {[
                { value: 'now', label: 'Send Now', desc: 'Deliver immediately', icon: Send },
                { value: 'later', label: 'Schedule', desc: 'Pick a date & time', icon: Calendar },
                { value: 'recurring', label: 'Recurring', desc: 'Repeat on schedule', icon: Clock }
              ].map(({ value, label, desc, icon: Icon }) => (
                <Card
                  key={value}
                  className={cn(
                    "cursor-pointer transition-all",
                    campaign.scheduleType === value && "ring-2 ring-purple-500 bg-purple-50"
                  )}
                  onClick={() => setCampaign(prev => ({ ...prev, scheduleType: value as any }))}
                >
                  <CardContent className="flex flex-col items-center text-center gap-3 p-6">
                    <div className={cn(
                      "p-3 rounded-lg",
                      campaign.scheduleType === value ? "bg-purple-500" : "bg-gray-100"
                    )}>
                      <Icon className={cn(
                        "w-6 h-6",
                        campaign.scheduleType === value ? "text-white" : "text-gray-500"
                      )} />
                    </div>
                    <div>
                      <p className="font-medium">{label}</p>
                      <p className="text-sm text-gray-500">{desc}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {campaign.scheduleType === 'later' && (
              <div className="space-y-2">
                <Label>Schedule Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={campaign.scheduledAt || ''}
                  onChange={(e) => setCampaign(prev => ({ ...prev, scheduledAt: e.target.value }))}
                />
              </div>
            )}

            {campaign.scheduleType === 'recurring' && (
              <div className="space-y-2">
                <Label>Recurring Pattern</Label>
                <Select
                  value={campaign.recurringPattern || ''}
                  onValueChange={(value) => setCampaign(prev => ({ ...prev, recurringPattern: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select pattern..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Bi-weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Campaign Summary */}
            <Separator />
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 space-y-4">
              <h4 className="font-semibold flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                Campaign Summary
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Campaign Name</p>
                  <p className="font-medium">{campaign.name}</p>
                </div>
                <div>
                  <p className="text-gray-500">Type</p>
                  <p className="font-medium capitalize">{campaign.type}</p>
                </div>
                <div>
                  <p className="text-gray-500">Recipients</p>
                  <p className="font-medium">{getRecipientCount()} people</p>
                </div>
                <div>
                  <p className="text-gray-500">Delivery</p>
                  <p className="font-medium capitalize">
                    {campaign.scheduleType === 'now' ? 'Immediate' :
                     campaign.scheduleType === 'later' && campaign.scheduledAt ?
                       format(new Date(campaign.scheduledAt), 'PPp') :
                       campaign.recurringPattern || 'Scheduled'}
                  </p>
                </div>
                {campaign.abTestEnabled && (
                  <div className="col-span-2">
                    <p className="text-gray-500">A/B Testing</p>
                    <p className="font-medium text-purple-600">Enabled - 2 subject line variants</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(s => Math.max(1, s - 1))}
          disabled={step === 1}
        >
          Previous
        </Button>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setShowPreview(true)}>
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </Button>
          {step < 4 ? (
            <Button
              onClick={() => setStep(s => Math.min(4, s + 1))}
              disabled={!canProceed()}
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={() => createCampaign.mutate(campaign)}
              disabled={createCampaign.isPending || !canProceed()}
              className="bg-gradient-to-r from-green-500 to-emerald-500"
            >
              {createCampaign.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {campaign.scheduleType === 'now' ? 'Send Campaign' : 'Schedule Campaign'}
            </Button>
          )}
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Campaign Preview
            </DialogTitle>
            <DialogDescription>
              How your {campaign.type} will appear to recipients
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {campaign.type === 'email' && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-800 p-4 border-b">
                  <p className="text-sm text-gray-500">Subject:</p>
                  <p className="font-medium">{campaign.subject || '(No subject)'}</p>
                </div>
                <div className="p-4 bg-white dark:bg-gray-900">
                  <pre className="whitespace-pre-wrap text-sm font-sans">
                    {campaign.body || '(No content)'}
                  </pre>
                </div>
              </div>
            )}
            {campaign.type === 'sms' && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-2xl p-4 max-w-xs mx-auto">
                <p className="text-sm">{campaign.body || '(No message)'}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
