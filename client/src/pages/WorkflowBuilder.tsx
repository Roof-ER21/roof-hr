import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  Play,
  Plus,
  Edit,
  Trash,
  Copy,
  Save,
  GitBranch,
  Mail,
  Clock,
  User,
  Bell,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';

interface WorkflowStep {
  id: string;
  name: string;
  type: 'ACTION' | 'CONDITION' | 'NOTIFICATION' | 'DELAY' | 'APPROVAL';
  actionType?: string;
  conditions?: any;
  delay?: number;
  delayUnit?: 'MINUTES' | 'HOURS' | 'DAYS';
  notificationTo?: string;
  notificationTemplate?: string;
  nextStepIfTrue?: string;
  nextStepIfFalse?: string;
  order: number;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  triggerType: 'MANUAL' | 'SCHEDULED' | 'EVENT';
  triggerEvent?: string;
  schedule?: string;
  isActive: boolean;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
  executionCount?: number;
  lastExecutedAt?: string;
}

const stepTypeIcons = {
  ACTION: <CheckCircle className="h-4 w-4" />,
  CONDITION: <GitBranch className="h-4 w-4" />,
  NOTIFICATION: <Mail className="h-4 w-4" />,
  DELAY: <Clock className="h-4 w-4" />,
  APPROVAL: <User className="h-4 w-4" />,
};

const stepTypeColors = {
  ACTION: 'bg-blue-100 text-blue-800',
  CONDITION: 'bg-purple-100 text-purple-800',
  NOTIFICATION: 'bg-green-100 text-green-800',
  DELAY: 'bg-yellow-100 text-yellow-800',
  APPROVAL: 'bg-orange-100 text-orange-800',
};

function WorkflowStepCard({ step, onEdit, onDelete }: {
  step: WorkflowStep;
  onEdit: (step: WorkflowStep) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="mb-2">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge className={stepTypeColors[step.type]}>
              {stepTypeIcons[step.type]}
              <span className="ml-1">{step.type}</span>
            </Badge>
            <div>
              <p className="font-medium">{step.name}</p>
              {step.actionType && (
                <p className="text-sm text-gray-600">{step.actionType}</p>
              )}
              {step.delay && (
                <p className="text-sm text-gray-600">
                  Wait {step.delay} {step.delayUnit?.toLowerCase()}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit(step)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDelete(step.id)}
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function WorkflowBuilder() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isStepOpen, setIsStepOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  
  const [workflowForm, setWorkflowForm] = useState<{
    name: string;
    description: string;
    triggerType: 'MANUAL' | 'SCHEDULED' | 'EVENT';
    triggerEvent: string;
    schedule: string;
  }>({
    name: '',
    description: '',
    triggerType: 'MANUAL',
    triggerEvent: '',
    schedule: '',
  });
  
  const [stepForm, setStepForm] = useState<Partial<WorkflowStep>>({
    name: '',
    type: 'ACTION',
    actionType: '',
    delay: 1,
    delayUnit: 'HOURS',
    notificationTo: '',
    notificationTemplate: '',
  });

  // Fetch workflows
  const { data: workflows = [] } = useQuery<Workflow[]>({
    queryKey: ['/api/workflows'],
    queryFn: async () => {
      const response = await fetch('/api/workflows', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch workflows');
      return response.json();
    }
  });

  // Create workflow
  const createWorkflowMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/workflows', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      toast({
        title: 'Workflow created',
        description: 'Your workflow has been created successfully.',
      });
      setIsCreateOpen(false);
      resetWorkflowForm();
    },
  });

  // Update workflow
  const updateWorkflowMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest(`/api/workflows/${id}`, 'PATCH', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      toast({
        title: 'Workflow updated',
        description: 'Your workflow has been updated successfully.',
      });
    },
  });

  // Delete workflow
  const deleteWorkflowMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/workflows/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      toast({
        title: 'Workflow deleted',
        description: 'Your workflow has been deleted successfully.',
      });
      setSelectedWorkflow(null);
    },
  });

  // Execute workflow
  const executeWorkflowMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/workflows/${id}/execute`, 'POST'),
    onSuccess: () => {
      toast({
        title: 'Workflow executed',
        description: 'Your workflow has been executed successfully.',
      });
    },
  });

  const resetWorkflowForm = () => {
    setWorkflowForm({
      name: '',
      description: '',
      triggerType: 'MANUAL',
      triggerEvent: '',
      schedule: '',
    });
  };

  const resetStepForm = () => {
    setStepForm({
      name: '',
      type: 'ACTION',
      actionType: '',
      delay: 1,
      delayUnit: 'HOURS',
      notificationTo: '',
      notificationTemplate: '',
    });
    setEditingStep(null);
  };

  const handleCreateWorkflow = () => {
    createWorkflowMutation.mutate({
      ...workflowForm,
      isActive: true,
      steps: [],
    });
  };

  const handleAddStep = () => {
    if (!selectedWorkflow || !stepForm.name) return;

    const newStep: WorkflowStep = {
      id: `step-${Date.now()}`,
      name: stepForm.name || '',
      type: stepForm.type as WorkflowStep['type'],
      actionType: stepForm.actionType,
      delay: stepForm.delay,
      delayUnit: stepForm.delayUnit as WorkflowStep['delayUnit'],
      notificationTo: stepForm.notificationTo,
      notificationTemplate: stepForm.notificationTemplate,
      order: selectedWorkflow.steps.length,
    };

    const updatedSteps = editingStep
      ? selectedWorkflow.steps.map(s => s.id === editingStep.id ? { ...newStep, id: editingStep.id } : s)
      : [...selectedWorkflow.steps, newStep];

    updateWorkflowMutation.mutate({
      id: selectedWorkflow.id,
      data: { steps: updatedSteps },
    });

    setSelectedWorkflow({
      ...selectedWorkflow,
      steps: updatedSteps,
    });

    setIsStepOpen(false);
    resetStepForm();
  };

  const handleDeleteStep = (stepId: string) => {
    if (!selectedWorkflow) return;

    const updatedSteps = selectedWorkflow.steps
      .filter(s => s.id !== stepId)
      .map((s, index) => ({ ...s, order: index }));

    updateWorkflowMutation.mutate({
      id: selectedWorkflow.id,
      data: { steps: updatedSteps },
    });

    setSelectedWorkflow({
      ...selectedWorkflow,
      steps: updatedSteps,
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!selectedWorkflow || !over || active.id === over.id) {
      setActiveId(null);
      return;
    }

    const oldIndex = selectedWorkflow.steps.findIndex(s => s.id === active.id);
    const newIndex = selectedWorkflow.steps.findIndex(s => s.id === over.id);
    
    const updatedSteps = arrayMove(selectedWorkflow.steps, oldIndex, newIndex)
      .map((s, index) => ({ ...s, order: index }));

    updateWorkflowMutation.mutate({
      id: selectedWorkflow.id,
      data: { steps: updatedSteps },
    });

    setSelectedWorkflow({
      ...selectedWorkflow,
      steps: updatedSteps,
    });
    
    setActiveId(null);
  };

  const canEdit = ['ADMIN', 'MANAGER', 'GENERAL_MANAGER', 'TRUE_ADMIN', 'HR_MANAGER'].includes(user?.role || '');

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Workflow Builder</h1>
          <p className="text-gray-600 mt-1">Create and manage automated workflows</p>
        </div>
        {canEdit && (
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Workflow
          </Button>
        )}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Workflow List */}
        <div className="col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>Workflows</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {workflows.map((workflow) => (
                  <Card
                    key={workflow.id}
                    className={`cursor-pointer hover:bg-gray-50 ${
                      selectedWorkflow?.id === workflow.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => setSelectedWorkflow(workflow)}
                  >
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{workflow.name}</p>
                          <p className="text-sm text-gray-600">{workflow.description}</p>
                          <div className="flex gap-2 mt-2">
                            <Badge variant={workflow.isActive ? 'default' : 'secondary'}>
                              {workflow.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            <Badge variant="outline">
                              {workflow.triggerType}
                            </Badge>
                            {workflow.executionCount !== undefined && (
                              <Badge variant="outline">
                                {workflow.executionCount} runs
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Workflow Editor */}
        <div className="col-span-8">
          {selectedWorkflow ? (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>{selectedWorkflow.name}</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => executeWorkflowMutation.mutate(selectedWorkflow.id)}
                    >
                      <Play className="mr-1 h-4 w-4" />
                      Execute
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsStepOpen(true)}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Add Step
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this workflow?')) {
                          deleteWorkflowMutation.mutate(selectedWorkflow.id);
                        }
                      }}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <p className="text-gray-600">{selectedWorkflow.description}</p>
                  {selectedWorkflow.lastExecutedAt && (
                    <p className="text-sm text-gray-500 mt-2">
                      Last executed: {new Date(selectedWorkflow.lastExecutedAt).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold mb-2">Workflow Steps</h3>
                  {selectedWorkflow.steps.length > 0 ? (
                    <DndContext
                      collisionDetection={closestCenter}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={selectedWorkflow.steps.map(s => s.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {selectedWorkflow.steps.map((step) => (
                          <WorkflowStepCard
                            key={step.id}
                            step={step}
                            onEdit={(step) => {
                              setEditingStep(step);
                              setStepForm(step);
                              setIsStepOpen(true);
                            }}
                            onDelete={handleDeleteStep}
                          />
                        ))}
                      </SortableContext>
                      <DragOverlay>
                        {activeId ? (
                          <WorkflowStepCard
                            step={selectedWorkflow.steps.find(s => s.id === activeId)!}
                            onEdit={() => {}}
                            onDelete={() => {}}
                          />
                        ) : null}
                      </DragOverlay>
                    </DndContext>
                  ) : (
                    <p className="text-gray-500 text-center py-8">
                      No steps added yet. Click "Add Step" to get started.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <p className="text-gray-500">
                  Select a workflow from the list or create a new one
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Create Workflow Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Workflow</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={workflowForm.name}
                onChange={(e) => setWorkflowForm({ ...workflowForm, name: e.target.value })}
                placeholder="e.g., New Employee Onboarding"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={workflowForm.description}
                onChange={(e) => setWorkflowForm({ ...workflowForm, description: e.target.value })}
                placeholder="Describe what this workflow does"
                rows={3}
              />
            </div>
            <div>
              <Label>Trigger Type</Label>
              <Select
                value={workflowForm.triggerType}
                onValueChange={(value: any) => setWorkflowForm({ ...workflowForm, triggerType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                  <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                  <SelectItem value="EVENT">Event-based</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {workflowForm.triggerType === ('EVENT' as const) && (
              <div>
                <Label>Trigger Event</Label>
                <Select
                  value={workflowForm.triggerEvent}
                  onValueChange={(value) => setWorkflowForm({ ...workflowForm, triggerEvent: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select event" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CANDIDATE_APPLIED">Candidate Applied</SelectItem>
                    <SelectItem value="CANDIDATE_HIRED">Candidate Hired</SelectItem>
                    <SelectItem value="EMPLOYEE_ONBOARDED">Employee Onboarded</SelectItem>
                    <SelectItem value="PTO_APPROVED">PTO Approved</SelectItem>
                    <SelectItem value="REVIEW_DUE">Review Due</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {workflowForm.triggerType === ('SCHEDULED' as const) && (
              <div>
                <Label>Schedule (Cron Expression)</Label>
                <Input
                  value={workflowForm.schedule}
                  onChange={(e) => setWorkflowForm({ ...workflowForm, schedule: e.target.value })}
                  placeholder="e.g., 0 9 * * MON (Every Monday at 9 AM)"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateWorkflow}>
              Create Workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Step Dialog */}
      <Dialog open={isStepOpen} onOpenChange={setIsStepOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStep ? 'Edit Step' : 'Add Step'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Step Name</Label>
              <Input
                value={stepForm.name}
                onChange={(e) => setStepForm({ ...stepForm, name: e.target.value })}
                placeholder="e.g., Send Welcome Email"
              />
            </div>
            <div>
              <Label>Step Type</Label>
              <Select
                value={stepForm.type}
                onValueChange={(value: any) => setStepForm({ ...stepForm, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTION">Action</SelectItem>
                  <SelectItem value="CONDITION">Condition</SelectItem>
                  <SelectItem value="NOTIFICATION">Notification</SelectItem>
                  <SelectItem value="DELAY">Delay</SelectItem>
                  <SelectItem value="APPROVAL">Approval</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {stepForm.type === 'ACTION' && (
              <div>
                <Label>Action Type</Label>
                <Select
                  value={stepForm.actionType}
                  onValueChange={(value) => setStepForm({ ...stepForm, actionType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CREATE_TASK">Create Task</SelectItem>
                    <SelectItem value="UPDATE_STATUS">Update Status</SelectItem>
                    <SelectItem value="ASSIGN_TO_USER">Assign to User</SelectItem>
                    <SelectItem value="CREATE_DOCUMENT">Create Document</SelectItem>
                    <SelectItem value="SEND_EMAIL">Send Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {stepForm.type === 'DELAY' && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label>Duration</Label>
                  <Input
                    type="number"
                    value={stepForm.delay}
                    onChange={(e) => setStepForm({ ...stepForm, delay: parseInt(e.target.value) })}
                    min="1"
                  />
                </div>
                <div className="flex-1">
                  <Label>Unit</Label>
                  <Select
                    value={stepForm.delayUnit}
                    onValueChange={(value: any) => setStepForm({ ...stepForm, delayUnit: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MINUTES">Minutes</SelectItem>
                      <SelectItem value="HOURS">Hours</SelectItem>
                      <SelectItem value="DAYS">Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            
            {stepForm.type === 'NOTIFICATION' && (
              <>
                <div>
                  <Label>Send To</Label>
                  <Select
                    value={stepForm.notificationTo}
                    onValueChange={(value) => setStepForm({ ...stepForm, notificationTo: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select recipient" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CANDIDATE">Candidate</SelectItem>
                      <SelectItem value="EMPLOYEE">Employee</SelectItem>
                      <SelectItem value="MANAGER">Manager</SelectItem>
                      <SelectItem value="HR_TEAM">HR Team</SelectItem>
                      <SelectItem value="CUSTOM">Custom Email</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Email Template</Label>
                  <Input
                    value={stepForm.notificationTemplate}
                    onChange={(e) => setStepForm({ ...stepForm, notificationTemplate: e.target.value })}
                    placeholder="Select or enter template name"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsStepOpen(false);
              resetStepForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleAddStep}>
              {editingStep ? 'Update Step' : 'Add Step'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}