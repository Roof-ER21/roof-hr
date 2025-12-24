/**
 * Visual Workflow Builder - Drag-Drop Workflow Editor
 * Embedded workflow builder for admin panel with visual step connections
 */

import { useState, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Mail, Clock, CheckCircle, GitBranch, User, Bell, Zap,
  Play, Save, Plus, Trash2, GripVertical, ArrowDown, Settings,
  Loader2, X, Edit, Eye, AlertTriangle, Calendar, FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkflowStep {
  id: string;
  type: string;
  name: string;
  config: Record<string, any>;
  order: number;
}

interface Workflow {
  id: string;
  name: string;
  description?: string;
  trigger: 'MANUAL' | 'SCHEDULED' | 'EVENT';
  triggerConfig?: Record<string, any>;
  steps: WorkflowStep[];
  isActive: boolean;
  createdAt: string;
}

// Step type definitions
const STEP_TYPES = [
  {
    type: 'SEND_EMAIL',
    name: 'Send Email',
    icon: Mail,
    color: 'bg-blue-500',
    description: 'Send an email notification',
    configFields: ['template', 'to', 'subject']
  },
  {
    type: 'CREATE_TASK',
    name: 'Create Task',
    icon: CheckCircle,
    color: 'bg-green-500',
    description: 'Create a task for someone',
    configFields: ['assignee', 'title', 'deadline']
  },
  {
    type: 'DELAY',
    name: 'Delay',
    icon: Clock,
    color: 'bg-yellow-500',
    description: 'Wait for a period of time',
    configFields: ['days', 'hours']
  },
  {
    type: 'CONDITION',
    name: 'Condition',
    icon: GitBranch,
    color: 'bg-purple-500',
    description: 'Branch based on a condition',
    configFields: ['field', 'operator', 'value']
  },
  {
    type: 'APPROVAL',
    name: 'Approval',
    icon: User,
    color: 'bg-orange-500',
    description: 'Request approval from someone',
    configFields: ['approver', 'timeout']
  },
  {
    type: 'UPDATE_STATUS',
    name: 'Update Status',
    icon: Zap,
    color: 'bg-indigo-500',
    description: 'Update employee/candidate status',
    configFields: ['status']
  },
  {
    type: 'SCHEDULE_INTERVIEW',
    name: 'Schedule',
    icon: Calendar,
    color: 'bg-pink-500',
    description: 'Schedule a meeting or interview',
    configFields: ['type', 'duration']
  },
  {
    type: 'AI_SCREEN',
    name: 'AI Screen',
    icon: Zap,
    color: 'bg-cyan-500',
    description: 'AI screening of candidate/document',
    configFields: ['criteria']
  }
];

// Draggable step type from palette
function DraggableStepType({ stepType }: { stepType: typeof STEP_TYPES[0] }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${stepType.type}`,
    data: { type: 'new-step', stepType }
  });

  const Icon = stepType.icon;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex items-center gap-2 p-2 rounded-lg border cursor-grab transition-all",
        "hover:bg-gray-50 dark:hover:bg-gray-800 hover:shadow-sm",
        isDragging && "opacity-50"
      )}
    >
      <div className={cn("p-1.5 rounded", stepType.color)}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{stepType.name}</p>
        <p className="text-xs text-gray-500 truncate">{stepType.description}</p>
      </div>
    </div>
  );
}

// Sortable workflow step
function SortableWorkflowStep({
  step,
  onEdit,
  onDelete
}: {
  step: WorkflowStep;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const stepType = STEP_TYPES.find(t => t.type === step.type);
  const Icon = stepType?.icon || Zap;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative",
        isDragging && "opacity-50"
      )}
    >
      <Card className="border-2 hover:border-blue-300 transition-colors">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab hover:bg-gray-100 dark:hover:bg-gray-800 p-1 rounded"
            >
              <GripVertical className="w-4 h-4 text-gray-400" />
            </div>
            <div className={cn("p-2 rounded-lg", stepType?.color || 'bg-gray-500')}>
              <Icon className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{step.name}</p>
              <p className="text-xs text-gray-500">{stepType?.description}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
                <Edit className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={onDelete}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Connection line to next step */}
      <div className="flex justify-center my-1">
        <ArrowDown className="w-4 h-4 text-gray-300" />
      </div>
    </div>
  );
}

// Drop zone for new steps
function DropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'workflow-canvas' });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[400px] p-4 rounded-lg border-2 border-dashed transition-colors",
        isOver ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-700"
      )}
    >
      {children}
    </div>
  );
}

interface VisualWorkflowBuilderProps {
  onWorkflowCreated?: () => void;
}

export function VisualWorkflowBuilder({ onWorkflowCreated }: VisualWorkflowBuilderProps) {
  const { toast } = useToast();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);
  const [showStepConfig, setShowStepConfig] = useState(false);
  const [showWorkflowConfig, setShowWorkflowConfig] = useState(false);
  const [showTestMode, setShowTestMode] = useState(false);

  // Workflow state
  const [workflow, setWorkflow] = useState<Partial<Workflow>>({
    name: 'New Workflow',
    description: '',
    trigger: 'MANUAL',
    steps: [],
    isActive: false
  });

  // Step config form
  const [stepConfig, setStepConfig] = useState<Partial<WorkflowStep>>({
    name: '',
    type: '',
    config: {}
  });

  // Save workflow mutation
  const saveWorkflowMutation = useMutation({
    mutationFn: async (data: Partial<Workflow>) => {
      if (workflow.id) {
        return apiRequest(`/api/workflows/${workflow.id}`, {
          method: 'PATCH',
          body: JSON.stringify(data)
        });
      }
      return apiRequest('/api/workflows', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      toast({
        title: workflow.id ? 'Workflow Updated!' : 'Workflow Created!',
        description: 'Your workflow has been saved'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      onWorkflowCreated?.();
    },
    onError: () => {
      toast({
        title: 'Failed to save workflow',
        description: 'Please try again',
        variant: 'destructive'
      });
    }
  });

  // Test workflow mutation
  const testWorkflowMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/workflows/test`, {
        method: 'POST',
        body: JSON.stringify({
          steps: workflow.steps,
          testData: { employeeId: 'test-employee' }
        })
      });
    },
    onSuccess: () => {
      toast({
        title: 'Test Complete!',
        description: 'Workflow executed successfully in test mode'
      });
      setShowTestMode(false);
    },
    onError: () => {
      toast({
        title: 'Test Failed',
        description: 'Check step configurations',
        variant: 'destructive'
      });
    }
  });

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    // Check if dragging from palette
    if (String(active.id).startsWith('palette-')) {
      const stepType = (active.data.current as any)?.stepType;
      if (stepType) {
        // Create new step
        const newStep: WorkflowStep = {
          id: `step-${Date.now()}`,
          type: stepType.type,
          name: stepType.name,
          config: {},
          order: workflow.steps?.length || 0
        };
        setWorkflow(prev => ({
          ...prev,
          steps: [...(prev.steps || []), newStep]
        }));
        // Open config dialog
        setStepConfig(newStep);
        setEditingStep(newStep);
        setShowStepConfig(true);
      }
      return;
    }

    // Reordering existing steps
    if (active.id !== over.id) {
      const oldIndex = workflow.steps?.findIndex(s => s.id === active.id) ?? -1;
      const newIndex = workflow.steps?.findIndex(s => s.id === over.id) ?? -1;

      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedSteps = arrayMove(workflow.steps || [], oldIndex, newIndex)
          .map((s, idx) => ({ ...s, order: idx }));
        setWorkflow(prev => ({ ...prev, steps: reorderedSteps }));
      }
    }
  };

  const handleSaveStep = () => {
    if (!editingStep || !stepConfig.name) return;

    const updatedSteps = workflow.steps?.map(s =>
      s.id === editingStep.id
        ? { ...s, name: stepConfig.name!, config: stepConfig.config || {} }
        : s
    ) || [];

    setWorkflow(prev => ({ ...prev, steps: updatedSteps }));
    setShowStepConfig(false);
    setEditingStep(null);
  };

  const handleDeleteStep = (stepId: string) => {
    const updatedSteps = (workflow.steps || [])
      .filter(s => s.id !== stepId)
      .map((s, idx) => ({ ...s, order: idx }));
    setWorkflow(prev => ({ ...prev, steps: updatedSteps }));
  };

  const handleEditStep = (step: WorkflowStep) => {
    setStepConfig(step);
    setEditingStep(step);
    setShowStepConfig(true);
  };

  const handleSaveWorkflow = () => {
    if (!workflow.name?.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a workflow name',
        variant: 'destructive'
      });
      return;
    }
    saveWorkflowMutation.mutate(workflow);
  };

  const handleNewWorkflow = () => {
    setWorkflow({
      name: 'New Workflow',
      description: '',
      trigger: 'MANUAL',
      steps: [],
      isActive: false
    });
  };

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-4 gap-6 h-full">
        {/* Step Palette */}
        <Card className="col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Step Types
            </CardTitle>
            <CardDescription className="text-xs">
              Drag to canvas to add
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[450px]">
              <div className="space-y-2">
                {STEP_TYPES.map((stepType) => (
                  <DraggableStepType key={stepType.type} stepType={stepType} />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Workflow Canvas */}
        <Card className="col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  {workflow.name || 'Untitled Workflow'}
                </CardTitle>
                <CardDescription className="text-xs">
                  {workflow.steps?.length || 0} steps | Trigger: {workflow.trigger}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowTestMode(true)}>
                  <Play className="w-3 h-3 mr-1" />
                  Test
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowWorkflowConfig(true)}>
                  <Settings className="w-3 h-3 mr-1" />
                  Settings
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <DropZone>
              {workflow.steps && workflow.steps.length > 0 ? (
                <SortableContext
                  items={workflow.steps.map(s => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-0">
                    {workflow.steps.map((step) => (
                      <SortableWorkflowStep
                        key={step.id}
                        step={step}
                        onEdit={() => handleEditStep(step)}
                        onDelete={() => handleDeleteStep(step.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              ) : (
                <div className="flex flex-col items-center justify-center h-[350px] text-gray-400">
                  <Zap className="w-12 h-12 mb-4 opacity-50" />
                  <p className="text-sm font-medium">Drop steps here to build your workflow</p>
                  <p className="text-xs">Drag from the palette on the left</p>
                </div>
              )}
            </DropZone>
          </CardContent>
        </Card>

        {/* Actions Panel */}
        <Card className="col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Quick Info */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Steps</span>
                <span className="font-medium">{workflow.steps?.length || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Trigger</span>
                <Badge variant="secondary" className="text-xs">{workflow.trigger}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Status</span>
                <Badge variant={workflow.isActive ? "default" : "secondary"} className="text-xs">
                  {workflow.isActive ? 'Active' : 'Draft'}
                </Badge>
              </div>
            </div>

            <Separator />

            {/* Action Buttons */}
            <div className="space-y-2">
              <Button
                className="w-full gap-2"
                onClick={handleSaveWorkflow}
                disabled={saveWorkflowMutation.isPending}
              >
                {saveWorkflowMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Workflow
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleNewWorkflow}
              >
                <Plus className="w-4 h-4" />
                New Workflow
              </Button>
            </div>

            <Separator />

            {/* Help */}
            <div className="text-xs text-gray-500 space-y-1">
              <p className="font-medium">Quick Tips:</p>
              <p>1. Drag steps from the palette</p>
              <p>2. Reorder by dragging in canvas</p>
              <p>3. Click Edit to configure steps</p>
              <p>4. Use Test to preview execution</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Step Configuration Dialog */}
      <Dialog open={showStepConfig} onOpenChange={setShowStepConfig}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Step</DialogTitle>
            <DialogDescription>
              Set up the step parameters
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Step Name</Label>
              <Input
                value={stepConfig.name || ''}
                onChange={(e) => setStepConfig(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter step name..."
              />
            </div>

            {/* Dynamic fields based on step type */}
            {stepConfig.type === 'SEND_EMAIL' && (
              <>
                <div className="space-y-2">
                  <Label>Email Template</Label>
                  <Select
                    value={stepConfig.config?.template || ''}
                    onValueChange={(val) => setStepConfig(prev => ({
                      ...prev,
                      config: { ...prev.config, template: val }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select template..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="welcome">Welcome Email</SelectItem>
                      <SelectItem value="reminder">Reminder</SelectItem>
                      <SelectItem value="approval">Approval Request</SelectItem>
                      <SelectItem value="notification">General Notification</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Send To</Label>
                  <Select
                    value={stepConfig.config?.to || ''}
                    onValueChange={(val) => setStepConfig(prev => ({
                      ...prev,
                      config: { ...prev.config, to: val }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select recipient..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="hr">HR Team</SelectItem>
                      <SelectItem value="candidate">Candidate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {stepConfig.type === 'DELAY' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Days</Label>
                  <Input
                    type="number"
                    value={stepConfig.config?.days || 0}
                    onChange={(e) => setStepConfig(prev => ({
                      ...prev,
                      config: { ...prev.config, days: parseInt(e.target.value) || 0 }
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hours</Label>
                  <Input
                    type="number"
                    value={stepConfig.config?.hours || 0}
                    onChange={(e) => setStepConfig(prev => ({
                      ...prev,
                      config: { ...prev.config, hours: parseInt(e.target.value) || 0 }
                    }))}
                  />
                </div>
              </div>
            )}

            {stepConfig.type === 'CONDITION' && (
              <>
                <div className="space-y-2">
                  <Label>Field</Label>
                  <Input
                    value={stepConfig.config?.field || ''}
                    onChange={(e) => setStepConfig(prev => ({
                      ...prev,
                      config: { ...prev.config, field: e.target.value }
                    }))}
                    placeholder="e.g., status, score, approved"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Operator</Label>
                  <Select
                    value={stepConfig.config?.operator || ''}
                    onValueChange={(val) => setStepConfig(prev => ({
                      ...prev,
                      config: { ...prev.config, operator: val }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select operator..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equals">Equals</SelectItem>
                      <SelectItem value="notEquals">Not Equals</SelectItem>
                      <SelectItem value="gte">Greater or Equal</SelectItem>
                      <SelectItem value="lte">Less or Equal</SelectItem>
                      <SelectItem value="contains">Contains</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Value</Label>
                  <Input
                    value={stepConfig.config?.value || ''}
                    onChange={(e) => setStepConfig(prev => ({
                      ...prev,
                      config: { ...prev.config, value: e.target.value }
                    }))}
                    placeholder="Comparison value..."
                  />
                </div>
              </>
            )}

            {stepConfig.type === 'APPROVAL' && (
              <>
                <div className="space-y-2">
                  <Label>Approver</Label>
                  <Select
                    value={stepConfig.config?.approver || ''}
                    onValueChange={(val) => setStepConfig(prev => ({
                      ...prev,
                      config: { ...prev.config, approver: val }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select approver..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manager">Direct Manager</SelectItem>
                      <SelectItem value="hr">HR Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Timeout (days)</Label>
                  <Input
                    type="number"
                    value={stepConfig.config?.timeout || 3}
                    onChange={(e) => setStepConfig(prev => ({
                      ...prev,
                      config: { ...prev.config, timeout: parseInt(e.target.value) || 3 }
                    }))}
                  />
                </div>
              </>
            )}

            {stepConfig.type === 'CREATE_TASK' && (
              <>
                <div className="space-y-2">
                  <Label>Assignee</Label>
                  <Select
                    value={stepConfig.config?.assignee || ''}
                    onValueChange={(val) => setStepConfig(prev => ({
                      ...prev,
                      config: { ...prev.config, assignee: val }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select assignee..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="hr">HR</SelectItem>
                      <SelectItem value="it">IT</SelectItem>
                      <SelectItem value="payroll">Payroll</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tasks (comma separated)</Label>
                  <Input
                    value={stepConfig.config?.tasks?.join(', ') || ''}
                    onChange={(e) => setStepConfig(prev => ({
                      ...prev,
                      config: { ...prev.config, tasks: e.target.value.split(',').map(t => t.trim()) }
                    }))}
                    placeholder="e.g., Setup laptop, Create email"
                  />
                </div>
              </>
            )}

            {stepConfig.type === 'UPDATE_STATUS' && (
              <div className="space-y-2">
                <Label>New Status</Label>
                <Input
                  value={stepConfig.config?.status || ''}
                  onChange={(e) => setStepConfig(prev => ({
                    ...prev,
                    config: { ...prev.config, status: e.target.value }
                  }))}
                  placeholder="e.g., approved, active, completed"
                />
              </div>
            )}

            {stepConfig.type === 'SCHEDULE_INTERVIEW' && (
              <>
                <div className="space-y-2">
                  <Label>Meeting Type</Label>
                  <Input
                    value={stepConfig.config?.type || ''}
                    onChange={(e) => setStepConfig(prev => ({
                      ...prev,
                      config: { ...prev.config, type: e.target.value }
                    }))}
                    placeholder="e.g., phone-screen, technical, exit"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Duration</Label>
                  <Select
                    value={stepConfig.config?.duration || ''}
                    onValueChange={(val) => setStepConfig(prev => ({
                      ...prev,
                      config: { ...prev.config, duration: val }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select duration..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15m">15 minutes</SelectItem>
                      <SelectItem value="30m">30 minutes</SelectItem>
                      <SelectItem value="1h">1 hour</SelectItem>
                      <SelectItem value="2h">2 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStepConfig(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveStep}>
              Save Step
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Workflow Settings Dialog */}
      <Dialog open={showWorkflowConfig} onOpenChange={setShowWorkflowConfig}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Workflow Settings</DialogTitle>
            <DialogDescription>
              Configure workflow name, trigger, and activation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Workflow Name</Label>
              <Input
                value={workflow.name || ''}
                onChange={(e) => setWorkflow(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter workflow name..."
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={workflow.description || ''}
                onChange={(e) => setWorkflow(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what this workflow does..."
              />
            </div>
            <div className="space-y-2">
              <Label>Trigger</Label>
              <Select
                value={workflow.trigger}
                onValueChange={(val: 'MANUAL' | 'SCHEDULED' | 'EVENT') =>
                  setWorkflow(prev => ({ ...prev, trigger: val }))
                }
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
            <div className="flex items-center justify-between">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-gray-500">Enable workflow execution</p>
              </div>
              <Switch
                checked={workflow.isActive}
                onCheckedChange={(val) => setWorkflow(prev => ({ ...prev, isActive: val }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWorkflowConfig(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowWorkflowConfig(false)}>
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Mode Dialog */}
      <Dialog open={showTestMode} onOpenChange={setShowTestMode}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="w-5 h-5" />
              Test Workflow
            </DialogTitle>
            <DialogDescription>
              Run a dry-run of your workflow with test data
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Test Mode</AlertTitle>
              <AlertDescription>
                No actual emails will be sent or changes made. This is a simulation.
              </AlertDescription>
            </Alert>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <p className="text-sm font-medium mb-2">Steps to execute:</p>
              <div className="space-y-1">
                {workflow.steps?.map((step, idx) => (
                  <div key={step.id} className="text-xs flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span>{step.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestMode(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => testWorkflowMutation.mutate()}
              disabled={testWorkflowMutation.isPending}
              className="gap-2"
            >
              {testWorkflowMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Run Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeId && activeId.startsWith('palette-') && (
          <Card className="shadow-lg">
            <CardContent className="p-3">
              <p className="text-sm font-medium">Dropping step...</p>
            </CardContent>
          </Card>
        )}
      </DragOverlay>
    </DndContext>
  );
}
