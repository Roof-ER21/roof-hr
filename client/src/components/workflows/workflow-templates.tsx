import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { FileText, Users, TrendingUp, Shield, LogOut, Sparkles } from 'lucide-react';

const templateCategories = {
  RECRUITMENT: { icon: <Users className="h-5 w-5" />, color: 'bg-blue-100 text-blue-800' },
  ONBOARDING: { icon: <Sparkles className="h-5 w-5" />, color: 'bg-green-100 text-green-800' },
  OFFBOARDING: { icon: <LogOut className="h-5 w-5" />, color: 'bg-red-100 text-red-800' },
  PERFORMANCE: { icon: <TrendingUp className="h-5 w-5" />, color: 'bg-purple-100 text-purple-800' },
  COMPLIANCE: { icon: <Shield className="h-5 w-5" />, color: 'bg-yellow-100 text-yellow-800' },
};

// Default workflow templates
const defaultTemplates = [
  {
    id: 'new-hire-onboarding',
    name: 'New Hire Onboarding',
    category: 'ONBOARDING',
    description: 'Complete onboarding workflow for new employees including document collection, training assignments, and equipment setup',
    config: JSON.stringify({
      type: 'ONBOARDING',
      trigger: 'MANUAL',
      steps: [
        { stepNumber: 1, name: 'Send Welcome Email', type: 'NOTIFICATION', actionType: 'SEND_EMAIL', config: '{"template": "welcome_email"}' },
        { stepNumber: 2, name: 'Collect Documents', type: 'ACTION', actionType: 'COLLECT_DOCUMENTS', config: '{"documents": ["I9", "W4", "Direct Deposit"]}' },
        { stepNumber: 3, name: 'Wait for Documents', type: 'DELAY', config: '{"duration": 48, "unit": "hours"}' },
        { stepNumber: 4, name: 'Manager Approval', type: 'APPROVAL', config: '{"approver": "manager"}' },
        { stepNumber: 5, name: 'IT Setup', type: 'ACTION', actionType: 'CREATE_ACCOUNTS', config: '{"systems": ["email", "slack", "github"]}' },
        { stepNumber: 6, name: 'Schedule Training', type: 'ACTION', actionType: 'SCHEDULE_MEETING', config: '{"type": "training", "duration": 60}' },
      ],
    }),
  },
  {
    id: 'candidate-screening',
    name: 'Candidate Screening Process',
    category: 'RECRUITMENT',
    description: 'Automated candidate screening workflow with initial review, phone screening, and interview scheduling',
    config: JSON.stringify({
      type: 'RECRUITMENT',
      trigger: 'EVENT',
      triggerConfig: '{"event": "candidate_applied"}',
      steps: [
        { stepNumber: 1, name: 'AI Resume Screening', type: 'ACTION', actionType: 'AI_SCREEN', config: '{"criteria": "job_requirements"}' },
        { stepNumber: 2, name: 'Check Qualifications', type: 'CONDITION', config: '{"condition": "score > 70"}' },
        { stepNumber: 3, name: 'Send Rejection', type: 'NOTIFICATION', actionType: 'SEND_EMAIL', config: '{"template": "rejection_email"}', conditions: '{"if": "failed_screening"}' },
        { stepNumber: 4, name: 'Schedule Phone Screen', type: 'ACTION', actionType: 'SCHEDULE_INTERVIEW', config: '{"type": "phone_screen"}' },
        { stepNumber: 5, name: 'Send Interview Invite', type: 'NOTIFICATION', actionType: 'SEND_EMAIL', config: '{"template": "interview_invite"}' },
      ],
    }),
  },
  {
    id: 'quarterly-review',
    name: 'Quarterly Performance Review',
    category: 'PERFORMANCE',
    description: 'Automated quarterly performance review process with self-assessment and manager review',
    config: JSON.stringify({
      type: 'PERFORMANCE',
      trigger: 'SCHEDULED',
      triggerConfig: '{"cron": "0 0 1 */3 *"}',
      steps: [
        { stepNumber: 1, name: 'Send Self-Assessment', type: 'NOTIFICATION', actionType: 'SEND_FORM', config: '{"form": "self_assessment"}' },
        { stepNumber: 2, name: 'Wait for Response', type: 'DELAY', config: '{"duration": 7, "unit": "days"}' },
        { stepNumber: 3, name: 'Manager Review', type: 'APPROVAL', config: '{"approver": "manager", "form": "performance_review"}' },
        { stepNumber: 4, name: 'Schedule 1-on-1', type: 'ACTION', actionType: 'SCHEDULE_MEETING', config: '{"type": "review_meeting"}' },
        { stepNumber: 5, name: 'Update Records', type: 'ACTION', actionType: 'UPDATE_EMPLOYEE', config: '{"fields": ["performance_score", "last_review"]}' },
      ],
    }),
  },
  {
    id: 'compliance-training',
    name: 'Annual Compliance Training',
    category: 'COMPLIANCE',
    description: 'Ensure all employees complete required annual compliance training',
    config: JSON.stringify({
      type: 'DOCUMENT',
      trigger: 'SCHEDULED',
      triggerConfig: '{"cron": "0 0 1 1 *"}',
      steps: [
        { stepNumber: 1, name: 'Assign Training', type: 'ACTION', actionType: 'ASSIGN_TRAINING', config: '{"courses": ["harassment", "safety", "ethics"]}' },
        { stepNumber: 2, name: 'Send Notification', type: 'NOTIFICATION', actionType: 'SEND_EMAIL', config: '{"template": "training_assigned"}' },
        { stepNumber: 3, name: 'First Reminder', type: 'DELAY', config: '{"duration": 7, "unit": "days"}' },
        { stepNumber: 4, name: 'Check Completion', type: 'CONDITION', config: '{"condition": "training_completed"}' },
        { stepNumber: 5, name: 'Escalate to Manager', type: 'NOTIFICATION', actionType: 'NOTIFY_MANAGER', config: '{"message": "Employee has not completed training"}', conditions: '{"if": "not_completed"}' },
      ],
    }),
  },
  {
    id: 'employee-offboarding',
    name: 'Employee Offboarding',
    category: 'OFFBOARDING',
    description: 'Complete offboarding process including access revocation and exit interview',
    config: JSON.stringify({
      type: 'CUSTOM',
      trigger: 'MANUAL',
      steps: [
        { stepNumber: 1, name: 'Schedule Exit Interview', type: 'ACTION', actionType: 'SCHEDULE_MEETING', config: '{"type": "exit_interview"}' },
        { stepNumber: 2, name: 'Collect Equipment', type: 'ACTION', actionType: 'CREATE_TASK', config: '{"task": "collect_equipment", "assignee": "it_team"}' },
        { stepNumber: 3, name: 'Revoke Access', type: 'ACTION', actionType: 'REVOKE_ACCESS', config: '{"systems": ["email", "slack", "github", "building"]}' },
        { stepNumber: 4, name: 'Final Payroll', type: 'ACTION', actionType: 'PROCESS_PAYROLL', config: '{"type": "final_payment"}' },
        { stepNumber: 5, name: 'Archive Records', type: 'ACTION', actionType: 'ARCHIVE_EMPLOYEE', config: '{"retention": "7_years"}' },
      ],
    }),
  },
];

export function WorkflowTemplates({ onTemplateSelect }: { onTemplateSelect?: (template: any) => void }) {
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [workflowDetails, setWorkflowDetails] = useState({
    name: '',
    description: '',
  });

  // For now, use default templates. In production, fetch from API
  const templates = defaultTemplates;

  // Create workflow from template
  const createFromTemplate = useMutation<any, Error, any>({
    mutationFn: async (data: any) => {
      // Parse the template config to create workflow and steps
      const config = JSON.parse(data.template.config);

      // Create the workflow first
      const workflowRes: Response = await apiRequest('/api/workflows', 'POST', {
        name: data.name,
        description: data.description,
        type: config.type || 'CUSTOM',
        trigger: config.trigger || 'MANUAL',
        triggerConfig: config.triggerConfig || '',
      });
      const workflow = await workflowRes.json();
      
      // Create steps for the workflow
      if (config.steps && workflow.id) {
        for (const step of config.steps) {
          await apiRequest('/api/workflow-steps', 'POST', {
            workflowId: workflow.id,
            stepNumber: step.stepNumber,
            name: step.name,
            type: step.type,
            actionType: step.actionType || '',
            config: step.config || '{}',
            conditions: step.conditions || '',
            retryAttempts: step.retryAttempts || 0,
            retryDelay: step.retryDelay || 0,
          });
        }
      }
      
      return workflow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      toast({
        title: 'Success',
        description: 'Workflow created from template',
      });
      setIsCreating(false);
      setSelectedTemplate(null);
      setWorkflowDetails({ name: '', description: '' });
    },
    onError: (error) => {
      console.error('Error creating workflow from template:', error);
      toast({
        title: 'Error',
        description: 'Failed to create workflow from template',
        variant: 'destructive',
      });
    },
  });

  const handleCreateFromTemplate = () => {
    if (!selectedTemplate) return;
    
    createFromTemplate.mutate({
      template: selectedTemplate,
      name: workflowDetails.name || selectedTemplate.name,
      description: workflowDetails.description || selectedTemplate.description,
    });
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <Card key={template.id} className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-lg ${templateCategories[template.category as keyof typeof templateCategories].color}`}>
                  {templateCategories[template.category as keyof typeof templateCategories].icon}
                </div>
                <Badge variant="outline">{template.category}</Badge>
              </div>
              <CardTitle className="text-lg">{template.name}</CardTitle>
              <CardDescription>{template.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {JSON.parse(template.config).steps.length} steps
                </span>
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedTemplate(template);
                    setIsCreating(true);
                    setWorkflowDetails({
                      name: template.name,
                      description: template.description,
                    });
                  }}
                >
                  Use Template
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create from Template Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Workflow from Template</DialogTitle>
            <DialogDescription>
              Customize the workflow details before creating
            </DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-lg ${templateCategories[selectedTemplate.category as keyof typeof templateCategories].color}`}>
                    {templateCategories[selectedTemplate.category as keyof typeof templateCategories].icon}
                  </div>
                  <div>
                    <h4 className="font-medium">{selectedTemplate.name}</h4>
                    <p className="text-sm text-muted-foreground">Template</p>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="workflowName">Workflow Name</Label>
                <Input
                  id="workflowName"
                  value={workflowDetails.name}
                  onChange={(e) => setWorkflowDetails({ ...workflowDetails, name: e.target.value })}
                  placeholder="Enter workflow name"
                />
              </div>

              <div>
                <Label htmlFor="workflowDescription">Description</Label>
                <Textarea
                  id="workflowDescription"
                  value={workflowDetails.description}
                  onChange={(e) => setWorkflowDetails({ ...workflowDetails, description: e.target.value })}
                  placeholder="Describe what this workflow does"
                  rows={3}
                />
              </div>

              <div>
                <Label>Workflow Steps</Label>
                <ScrollArea className="h-[200px] rounded-lg border p-4">
                  <div className="space-y-2">
                    {JSON.parse(selectedTemplate.config).steps.map((step: any) => (
                      <div key={step.stepNumber} className="flex items-center gap-2">
                        <Badge variant="outline" className="w-8 h-8 rounded-full p-0 flex items-center justify-center">
                          {step.stepNumber}
                        </Badge>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{step.name}</p>
                          <p className="text-xs text-muted-foreground">{step.type}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreating(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFromTemplate}>
              Create Workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}