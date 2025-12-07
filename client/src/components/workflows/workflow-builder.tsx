import { useState, useEffect } from 'react';
import { Plus, Play, Pause, Archive, Edit, Trash2, Settings, ChevronRight, GitBranch, Clock, Bell, CheckCircle, Zap, Sparkles } from 'lucide-react';
import { WorkflowTemplates } from './workflow-templates';
import { WorkflowExecutionHistory } from './workflow-execution-history';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { Workflow, WorkflowStep } from '@/../../shared/schema';

const stepTypeIcons = {
  ACTION: <Zap className="h-4 w-4" />,
  CONDITION: <GitBranch className="h-4 w-4" />,
  DELAY: <Clock className="h-4 w-4" />,
  NOTIFICATION: <Bell className="h-4 w-4" />,
  APPROVAL: <CheckCircle className="h-4 w-4" />,
  INTEGRATION: <Settings className="h-4 w-4" />,
};

const stepTypeColors = {
  ACTION: 'bg-blue-100 text-blue-800',
  CONDITION: 'bg-purple-100 text-purple-800',
  DELAY: 'bg-yellow-100 text-yellow-800',
  NOTIFICATION: 'bg-green-100 text-green-800',
  APPROVAL: 'bg-orange-100 text-orange-800',
  INTEGRATION: 'bg-indigo-100 text-indigo-800',
};

export function WorkflowBuilder() {
  const queryClient = useQueryClient();
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditingStep, setIsEditingStep] = useState<any>(null);
  const [newWorkflow, setNewWorkflow] = useState({
    name: '',
    description: '',
    type: 'CUSTOM',
    trigger: 'MANUAL',
    triggerConfig: '',
  });
  const [newStep, setNewStep] = useState({
    name: '',
    type: 'ACTION',
    actionType: '',
    config: '{}',
    conditions: '',
    retryAttempts: 0,
    retryDelay: 0,
  });

  // Fetch workflows
  const { data: workflows = [], isLoading } = useQuery<Workflow[]>({
    queryKey: ['/api/workflows'],
  });

  // Fetch workflow steps
  const { data: workflowSteps = [] } = useQuery<WorkflowStep[]>({
    queryKey: selectedWorkflow ? [`/api/workflows/${selectedWorkflow.id}/steps`] : ['/api/workflows/steps-disabled'],
    enabled: !!selectedWorkflow,
  });

  // Create workflow mutation
  const createWorkflow = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/workflows', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      toast({
        title: 'Success',
        description: 'Workflow created successfully',
      });
      setIsCreating(false);
      setNewWorkflow({
        name: '',
        description: '',
        type: 'CUSTOM',
        trigger: 'MANUAL',
        triggerConfig: '',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create workflow',
        variant: 'destructive',
      });
    },
  });

  // Update workflow status
  const updateWorkflowStatus = useMutation({
    mutationFn: async ({ id, status }: any) => {
      return await apiRequest(`/api/workflows/${id}/status`, 'PATCH', { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      toast({
        title: 'Success',
        description: 'Workflow status updated',
      });
    },
  });

  // Create workflow step
  const createStep = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/workflow-steps', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/workflows/${selectedWorkflow?.id}/steps`] });
      toast({
        title: 'Success',
        description: 'Step added successfully',
      });
      setIsEditingStep(null);
      setNewStep({
        name: '',
        type: 'ACTION',
        actionType: '',
        config: '{}',
        conditions: '',
        retryAttempts: 0,
        retryDelay: 0,
      });
    },
  });

  // Delete workflow step
  const deleteStep = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/workflow-steps/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/workflows/${selectedWorkflow?.id}/steps`] });
      toast({
        title: 'Success',
        description: 'Step deleted successfully',
      });
    },
  });

  // Execute workflow
  const executeWorkflow = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/workflows/${id}/execute`, 'POST', {});
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Workflow execution started',
      });
    },
  });

  const handleCreateWorkflow = () => {
    createWorkflow.mutate(newWorkflow);
  };

  const handleAddStep = () => {
    if (!selectedWorkflow) return;
    
    createStep.mutate({
      workflowId: selectedWorkflow.id,
      stepNumber: workflowSteps.length + 1,
      ...newStep,
    });
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      DRAFT: 'bg-gray-100 text-gray-800',
      ACTIVE: 'bg-green-100 text-green-800',
      PAUSED: 'bg-yellow-100 text-yellow-800',
      ARCHIVED: 'bg-red-100 text-red-800',
    };
    return <Badge className={colors[status as keyof typeof colors] || ''}>{status}</Badge>;
  };

  return (
    <Tabs defaultValue="workflows" className="h-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="workflows">Active Workflows</TabsTrigger>
        <TabsTrigger value="templates">Templates</TabsTrigger>
      </TabsList>

      <TabsContent value="workflows" className="mt-4">
        <div className="grid grid-cols-12 gap-6">
          {/* Workflow List */}
          <div className="col-span-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Workflows</CardTitle>
                  <Dialog open={isCreating} onOpenChange={setIsCreating}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    New Workflow
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Workflow</DialogTitle>
                    <DialogDescription>
                      Define a new automated workflow for your HR processes
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={newWorkflow.name}
                        onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                        placeholder="e.g., New Hire Onboarding"
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={newWorkflow.description}
                        onChange={(e) => setNewWorkflow({ ...newWorkflow, description: e.target.value })}
                        placeholder="Describe what this workflow does..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="type">Type</Label>
                      <Select
                        value={newWorkflow.type}
                        onValueChange={(value) => setNewWorkflow({ ...newWorkflow, type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="RECRUITMENT">Recruitment</SelectItem>
                          <SelectItem value="ONBOARDING">Onboarding</SelectItem>
                          <SelectItem value="PERFORMANCE">Performance</SelectItem>
                          <SelectItem value="DOCUMENT">Document</SelectItem>
                          <SelectItem value="CUSTOM">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="trigger">Trigger</Label>
                      <Select
                        value={newWorkflow.trigger}
                        onValueChange={(value) => setNewWorkflow({ ...newWorkflow, trigger: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MANUAL">Manual</SelectItem>
                          <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                          <SelectItem value="EVENT">Event-based</SelectItem>
                          <SelectItem value="CONDITION">Condition-based</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreating(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateWorkflow}>
                      Create Workflow
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              {isLoading ? (
                <div className="text-center py-4">Loading workflows...</div>
              ) : workflows.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No workflows created yet
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-medium text-blue-900">Active Workflows ({workflows.length})</p>
                    <p className="text-xs text-blue-700">These workflows are ready to automate your HR processes</p>
                  </div>
                  {workflows.map((workflow: any) => (
                    <div
                      key={workflow.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedWorkflow?.id === workflow.id
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => setSelectedWorkflow(workflow)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{workflow.name}</h4>
                        {getStatusBadge(workflow.status)}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {workflow.description || 'No description'}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="font-medium">{workflow.type}</span>
                        <span>•</span>
                        <span>{workflow.trigger}</span>
                        <span>•</span>
                        <span>{workflow.executionCount || 0} runs</span>
                      </div>
                      {workflow.type === 'RECRUITMENT' && (
                        <div className="mt-2 pt-2 border-t">
                          <p className="text-xs text-blue-600 font-medium">
                            Connected to: Candidate Screening Pipeline
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Workflow Builder */}
      <div className="col-span-8">
        {selectedWorkflow ? (
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{selectedWorkflow.name}</CardTitle>
                  <CardDescription>{selectedWorkflow.description}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {selectedWorkflow.status === 'DRAFT' && (
                    <Button
                      size="sm"
                      onClick={() => updateWorkflowStatus.mutate({ 
                        id: selectedWorkflow.id, 
                        status: 'ACTIVE' 
                      })}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Activate
                    </Button>
                  )}
                  {selectedWorkflow.status === 'ACTIVE' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateWorkflowStatus.mutate({ 
                          id: selectedWorkflow.id, 
                          status: 'PAUSED' 
                        })}
                      >
                        <Pause className="h-4 w-4 mr-2" />
                        Pause
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => executeWorkflow.mutate(selectedWorkflow.id)}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Run Now
                      </Button>
                    </>
                  )}
                  {selectedWorkflow.status === 'PAUSED' && (
                    <Button
                      size="sm"
                      onClick={() => updateWorkflowStatus.mutate({ 
                        id: selectedWorkflow.id, 
                        status: 'ACTIVE' 
                      })}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Resume
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateWorkflowStatus.mutate({ 
                      id: selectedWorkflow.id, 
                      status: 'ARCHIVED' 
                    })}
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    Archive
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="steps">
                <TabsList>
                  <TabsTrigger value="steps">Workflow Steps</TabsTrigger>
                  <TabsTrigger value="executions">Execution History</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>
                
                <TabsContent value="steps" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Workflow Steps</h3>
                    <Dialog open={!!isEditingStep} onOpenChange={(open) => !open && setIsEditingStep(null)}>
                      <DialogTrigger asChild>
                        <Button size="sm" onClick={() => setIsEditingStep(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Step
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Workflow Step</DialogTitle>
                          <DialogDescription>
                            Configure a new step in your workflow
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="stepName">Step Name</Label>
                            <Input
                              id="stepName"
                              value={newStep.name}
                              onChange={(e) => setNewStep({ ...newStep, name: e.target.value })}
                              placeholder="e.g., Send Welcome Email"
                            />
                          </div>
                          <div>
                            <Label htmlFor="stepType">Step Type</Label>
                            <Select
                              value={newStep.type}
                              onValueChange={(value) => setNewStep({ ...newStep, type: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ACTION">Action</SelectItem>
                                <SelectItem value="CONDITION">Condition</SelectItem>
                                <SelectItem value="DELAY">Delay</SelectItem>
                                <SelectItem value="NOTIFICATION">Notification</SelectItem>
                                <SelectItem value="APPROVAL">Approval</SelectItem>
                                <SelectItem value="INTEGRATION">Integration</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {newStep.type === 'ACTION' && (
                            <div>
                              <Label htmlFor="actionType">Action Type</Label>
                              <Input
                                id="actionType"
                                value={newStep.actionType}
                                onChange={(e) => setNewStep({ ...newStep, actionType: e.target.value })}
                                placeholder="e.g., SEND_EMAIL"
                              />
                            </div>
                          )}
                          <div>
                            <Label htmlFor="retryAttempts">Retry Attempts</Label>
                            <Input
                              id="retryAttempts"
                              type="number"
                              value={newStep.retryAttempts}
                              onChange={(e) => setNewStep({ ...newStep, retryAttempts: parseInt(e.target.value) })}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsEditingStep(null)}>
                            Cancel
                          </Button>
                          <Button onClick={handleAddStep}>
                            Add Step
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {workflowSteps.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No steps defined yet. Add your first step to begin building the workflow.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {workflowSteps.map((step: any, index: number) => (
                        <div key={step.id} className="relative">
                          {index > 0 && (
                            <div className="absolute left-6 -top-2 h-4 w-0.5 bg-border" />
                          )}
                          <div className="flex items-start gap-3 p-4 rounded-lg border hover:bg-muted/50">
                            <div className={`p-2 rounded-lg ${stepTypeColors[step.type as keyof typeof stepTypeColors]}`}>
                              {stepTypeIcons[step.type as keyof typeof stepTypeIcons]}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium">{step.name}</h4>
                                <div className="flex items-center gap-2">
                                  <Button size="sm" variant="ghost">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    onClick={() => deleteStep.mutate(step.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                Step {step.stepNumber} • {step.type}
                                {step.actionType && ` • ${step.actionType}`}
                              </p>
                              {step.retryAttempts > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Retry up to {step.retryAttempts} times
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="executions">
                  <WorkflowExecutionHistory workflowId={selectedWorkflow.id} />
                </TabsContent>

                <TabsContent value="settings">
                  <div className="space-y-4">
                    <div>
                      <Label>Workflow Type</Label>
                      <p className="text-sm text-muted-foreground">{selectedWorkflow.type}</p>
                    </div>
                    <div>
                      <Label>Trigger</Label>
                      <p className="text-sm text-muted-foreground">{selectedWorkflow.trigger}</p>
                    </div>
                    
                    {selectedWorkflow.type === 'RECRUITMENT' && (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <Label className="text-blue-900">Recruitment Stage Connection</Label>
                        <p className="text-sm text-blue-700 mt-1">
                          This workflow is triggered when candidates move between stages:
                        </p>
                        <ul className="text-sm text-blue-600 mt-2 space-y-1">
                          <li>• APPLIED → SCREENING: Initial application review</li>
                          <li>• SCREENING → INTERVIEW: Phone screening passed</li>
                          <li>• INTERVIEW → OFFER: Interview process completed</li>
                          <li>• OFFER → HIRED: Offer accepted</li>
                        </ul>
                      </div>
                    )}
                    
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-3">API Integrations Status</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-2 rounded bg-muted">
                          <span className="text-sm">OpenAI API (AI Screening)</span>
                          <Badge variant="default">✓ Configured</Badge>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded bg-muted">
                          <span className="text-sm">Gmail (Email)</span>
                          <Badge variant="secondary">OAuth Required</Badge>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded bg-muted">
                          <span className="text-sm">Google Calendar (Scheduling)</span>
                          <Badge variant="secondary">OAuth Required</Badge>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded bg-muted">
                          <span className="text-sm">Google Voice (SMS)</span>
                          <Badge variant="outline">Manual Setup</Badge>
                        </div>
                      </div>
                      <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded">
                        <p className="text-xs text-blue-800">
                          Gmail and Google Calendar require OAuth authentication. 
                          Navigate to Admin Control Hub to connect your Google account.
                        </p>
                      </div>
                    </div>
                    
                    <div>
                      <Label>Created By</Label>
                      <p className="text-sm text-muted-foreground">{selectedWorkflow.createdBy}</p>
                    </div>
                    <div>
                      <Label>Execution Count</Label>
                      <p className="text-sm text-muted-foreground">{selectedWorkflow.executionCount || 0} times</p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ) : (
          <Card className="h-full flex items-center justify-center">
            <CardContent>
              <div className="text-center">
                <GitBranch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a Workflow</h3>
                <p className="text-muted-foreground">
                  Choose a workflow from the list to view and edit its steps
                </p>
              </div>
            </CardContent>
          </Card>
        )}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="templates" className="mt-4">
        <WorkflowTemplates onTemplateSelect={(template) => {
          // Handle template selection if needed
          console.log('Template selected:', template);
        }} />
      </TabsContent>
    </Tabs>
  );
}