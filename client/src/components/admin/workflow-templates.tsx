/**
 * Workflow Templates Library
 * Pre-built workflow templates for common HR automation
 * One-click deploy to create a new workflow from template
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Workflow, Play, Users, Calendar, FileText, Clock,
  CheckCircle, Mail, Bell, ArrowRight, Loader2, Sparkles,
  UserPlus, LogOut, Award, Briefcase, Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkflowStep {
  id: string;
  type: string;
  name: string;
  config: Record<string, any>;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'onboarding' | 'offboarding' | 'pto' | 'performance' | 'recruitment';
  icon: React.ElementType;
  color: string;
  steps: WorkflowStep[];
  estimatedTime: string;
  tags: string[];
}

const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'new-hire-onboarding',
    name: 'New Hire Onboarding',
    description: 'Complete onboarding workflow for new employees including welcome email, task creation, training schedule, and 30-day check-in.',
    category: 'onboarding',
    icon: UserPlus,
    color: 'bg-green-500',
    estimatedTime: '30 days',
    tags: ['automated', 'multi-step', 'email'],
    steps: [
      { id: '1', type: 'SEND_EMAIL', name: 'Send Welcome Email', config: { template: 'welcome', delay: '0d' } },
      { id: '2', type: 'CREATE_TASK', name: 'Create IT Setup Tasks', config: { assignee: 'IT', tasks: ['laptop', 'email', 'access'] } },
      { id: '3', type: 'CREATE_TASK', name: 'Create HR Tasks', config: { assignee: 'HR', tasks: ['paperwork', 'benefits', 'policies'] } },
      { id: '4', type: 'DELAY', name: 'Wait 7 Days', config: { days: 7 } },
      { id: '5', type: 'SEND_EMAIL', name: 'Week 1 Check-in', config: { template: 'week1-checkin' } },
      { id: '6', type: 'SCHEDULE_INTERVIEW', name: 'Schedule Training', config: { type: 'training', duration: '2h' } },
      { id: '7', type: 'DELAY', name: 'Wait 23 Days', config: { days: 23 } },
      { id: '8', type: 'SEND_EMAIL', name: '30-Day Review Reminder', config: { template: '30-day-review', to: 'manager' } }
    ]
  },
  {
    id: 'pto-approval-flow',
    name: 'PTO Approval Flow',
    description: 'Automated PTO request handling with manager approval, HR notification, and calendar sync.',
    category: 'pto',
    icon: Calendar,
    color: 'bg-blue-500',
    estimatedTime: '1-3 days',
    tags: ['approval', 'notification', 'calendar'],
    steps: [
      { id: '1', type: 'SEND_EMAIL', name: 'Notify Manager', config: { template: 'pto-request', to: 'manager' } },
      { id: '2', type: 'APPROVAL', name: 'Manager Approval', config: { approver: 'manager', timeout: '3d' } },
      { id: '3', type: 'CONDITION', name: 'Check Approval', config: { field: 'approved', operator: 'equals', value: true } },
      { id: '4', type: 'SEND_EMAIL', name: 'Notify HR', config: { template: 'pto-approved', to: 'hr' } },
      { id: '5', type: 'UPDATE_STATUS', name: 'Update PTO Status', config: { status: 'approved' } },
      { id: '6', type: 'SEND_EMAIL', name: 'Confirm to Employee', config: { template: 'pto-confirmed', to: 'employee' } }
    ]
  },
  {
    id: 'performance-review-cycle',
    name: 'Performance Review Cycle',
    description: 'Quarterly performance review automation with self-assessment, manager review, and meeting scheduling.',
    category: 'performance',
    icon: Award,
    color: 'bg-purple-500',
    estimatedTime: '2 weeks',
    tags: ['review', 'assessment', 'meeting'],
    steps: [
      { id: '1', type: 'SEND_EMAIL', name: 'Initiate Review Cycle', config: { template: 'review-start', to: 'all-employees' } },
      { id: '2', type: 'CREATE_TASK', name: 'Self-Assessment Task', config: { assignee: 'employee', deadline: '7d' } },
      { id: '3', type: 'DELAY', name: 'Wait for Self-Assessment', config: { days: 7 } },
      { id: '4', type: 'SEND_EMAIL', name: 'Notify Managers', config: { template: 'review-manager', to: 'managers' } },
      { id: '5', type: 'CREATE_TASK', name: 'Manager Review Task', config: { assignee: 'manager', deadline: '5d' } },
      { id: '6', type: 'DELAY', name: 'Wait for Manager Review', config: { days: 5 } },
      { id: '7', type: 'SCHEDULE_INTERVIEW', name: 'Schedule Review Meeting', config: { type: 'performance-review', duration: '1h' } },
      { id: '8', type: 'SEND_EMAIL', name: 'Review Complete', config: { template: 'review-complete', to: 'employee' } }
    ]
  },
  {
    id: 'offboarding-checklist',
    name: 'Offboarding Checklist',
    description: 'Complete offboarding workflow including IT access revocation, equipment return, exit interview, and final pay.',
    category: 'offboarding',
    icon: LogOut,
    color: 'bg-red-500',
    estimatedTime: '2 weeks',
    tags: ['security', 'compliance', 'exit'],
    steps: [
      { id: '1', type: 'SEND_EMAIL', name: 'Offboarding Initiated', config: { template: 'offboarding-start', to: 'employee' } },
      { id: '2', type: 'CREATE_TASK', name: 'IT Access Revocation', config: { assignee: 'IT', tasks: ['email', 'systems', 'badge'] } },
      { id: '3', type: 'CREATE_TASK', name: 'Equipment Return', config: { assignee: 'IT', tasks: ['laptop', 'phone', 'keys'] } },
      { id: '4', type: 'SCHEDULE_INTERVIEW', name: 'Exit Interview', config: { type: 'exit-interview', duration: '30m' } },
      { id: '5', type: 'CREATE_TASK', name: 'Final Pay Calculation', config: { assignee: 'payroll', tasks: ['pto-payout', 'final-check'] } },
      { id: '6', type: 'SEND_EMAIL', name: 'Exit Survey', config: { template: 'exit-survey', to: 'employee' } },
      { id: '7', type: 'UPDATE_STATUS', name: 'Mark Terminated', config: { status: 'terminated' } }
    ]
  },
  {
    id: 'recruitment-pipeline',
    name: 'Recruitment Pipeline',
    description: 'Automated candidate processing from application to offer including screening, interviews, and communications.',
    category: 'recruitment',
    icon: Briefcase,
    color: 'bg-orange-500',
    estimatedTime: '2-4 weeks',
    tags: ['hiring', 'screening', 'interviews'],
    steps: [
      { id: '1', type: 'SEND_EMAIL', name: 'Application Received', config: { template: 'application-received', to: 'candidate' } },
      { id: '2', type: 'AI_SCREEN', name: 'AI Resume Screening', config: { criteria: 'job-requirements' } },
      { id: '3', type: 'CONDITION', name: 'Check Screen Pass', config: { field: 'score', operator: 'gte', value: 70 } },
      { id: '4', type: 'SCHEDULE_INTERVIEW', name: 'Phone Screen', config: { type: 'phone-screen', duration: '30m' } },
      { id: '5', type: 'UPDATE_STATUS', name: 'Update to Screening', config: { status: 'screening' } },
      { id: '6', type: 'SCHEDULE_INTERVIEW', name: 'Technical Interview', config: { type: 'technical', duration: '1h' } },
      { id: '7', type: 'SCHEDULE_INTERVIEW', name: 'Final Interview', config: { type: 'final', duration: '1h' } },
      { id: '8', type: 'SEND_EMAIL', name: 'Offer Letter', config: { template: 'offer-letter', to: 'candidate' } }
    ]
  }
];

const categoryColors = {
  onboarding: 'text-green-600 bg-green-50 border-green-200',
  offboarding: 'text-red-600 bg-red-50 border-red-200',
  pto: 'text-blue-600 bg-blue-50 border-blue-200',
  performance: 'text-purple-600 bg-purple-50 border-purple-200',
  recruitment: 'text-orange-600 bg-orange-50 border-orange-200'
};

interface WorkflowTemplatesProps {
  onTemplateDeployed?: () => void;
}

export function WorkflowTemplates({ onTemplateDeployed }: WorkflowTemplatesProps) {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const deployMutation = useMutation({
    mutationFn: async (template: WorkflowTemplate) => {
      return apiRequest('/api/workflows', {
        method: 'POST',
        body: JSON.stringify({
          name: template.name,
          description: template.description,
          trigger: 'MANUAL',
          steps: template.steps,
          isActive: true,
          fromTemplate: template.id
        })
      });
    },
    onSuccess: (_, template) => {
      toast({
        title: 'Workflow Created!',
        description: `"${template.name}" is now ready to use`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      setShowPreview(false);
      setSelectedTemplate(null);
      onTemplateDeployed?.();
    },
    onError: () => {
      toast({
        title: 'Failed to create workflow',
        description: 'Please try again',
        variant: 'destructive'
      });
    }
  });

  const handlePreview = (template: WorkflowTemplate) => {
    setSelectedTemplate(template);
    setShowPreview(true);
  };

  const handleDeploy = () => {
    if (selectedTemplate) {
      deployMutation.mutate(selectedTemplate);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            Workflow Templates
          </h3>
          <p className="text-sm text-gray-600">Deploy pre-built automations with one click</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {WORKFLOW_TEMPLATES.map((template) => {
          const Icon = template.icon;
          return (
            <Card
              key={template.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handlePreview(template)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className={cn('p-2 rounded-lg', template.color)}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <Badge variant="outline" className={categoryColors[template.category]}>
                    {template.category}
                  </Badge>
                </div>
                <CardTitle className="text-base mt-3">{template.name}</CardTitle>
                <CardDescription className="text-xs line-clamp-2">
                  {template.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Workflow className="w-3 h-3" />
                    {template.steps.length} steps
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {template.estimatedTime}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mt-3">
                  {template.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Template Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          {selectedTemplate && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className={cn('p-2 rounded-lg', selectedTemplate.color)}>
                    <selectedTemplate.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <DialogTitle>{selectedTemplate.name}</DialogTitle>
                    <DialogDescription>{selectedTemplate.description}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex items-center gap-4 text-sm">
                  <Badge variant="outline" className={categoryColors[selectedTemplate.category]}>
                    {selectedTemplate.category}
                  </Badge>
                  <span className="text-gray-500 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {selectedTemplate.estimatedTime}
                  </span>
                  <span className="text-gray-500 flex items-center gap-1">
                    <Workflow className="w-4 h-4" />
                    {selectedTemplate.steps.length} steps
                  </span>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Workflow Steps</h4>
                  <ScrollArea className="h-[300px] border rounded-lg p-4">
                    <div className="space-y-3">
                      {selectedTemplate.steps.map((step, index) => (
                        <div key={step.id} className="flex items-start gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium">
                              {index + 1}
                            </div>
                            {index < selectedTemplate.steps.length - 1 && (
                              <div className="w-0.5 h-8 bg-gray-200 mt-1" />
                            )}
                          </div>
                          <div className="flex-1 pb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {step.type.replace(/_/g, ' ')}
                              </Badge>
                              <span className="font-medium text-sm">{step.name}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {JSON.stringify(step.config).replace(/[{}"]/g, '').replace(/,/g, ', ')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowPreview(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleDeploy}
                  disabled={deployMutation.isPending}
                  className="gap-2"
                >
                  {deployMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  Deploy Workflow
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
