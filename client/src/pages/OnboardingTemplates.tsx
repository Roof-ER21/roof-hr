import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit2, Trash2, ClipboardList, Users, CheckCircle, Circle, GripVertical, X } from 'lucide-react';
import type { OnboardingTemplate, OnboardingInstance, User } from '@/../../shared/schema';

interface Task {
  title: string;
  description: string;
  dueInDays: number;
}

const DEPARTMENTS = [
  'Sales',
  'Marketing',
  'Operations',
  'Engineering',
  'HR',
  'Finance',
  'IT',
  'Customer Service'
];

export default function OnboardingTemplates() {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<OnboardingTemplate | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isInstancesDialogOpen, setIsInstancesDialogOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [department, setDepartment] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState<Task>({ title: '', description: '', dueInDays: 1 });

  // Fetch templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['/api/onboarding-templates'],
    queryFn: async () => {
      const response = await fetch('/api/onboarding-templates', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch onboarding templates');
      }
      return response.json();
    }
  });

  // Fetch users
  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      return response.json();
    }
  });

  // Fetch onboarding instances
  const { data: instances = [] } = useQuery({
    queryKey: ['/api/onboarding-instances'],
    queryFn: async () => {
      const response = await fetch('/api/onboarding-instances', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch onboarding instances');
      }
      return response.json();
    }
  });

  // Create template mutation
  const createMutation = useMutation({
    mutationFn: (data: { name: string; description: string; department: string; tasks: string }) =>
      apiRequest('/api/onboarding-templates', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/onboarding-templates'] });
      await queryClient.refetchQueries({ queryKey: ['/api/onboarding-templates'] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: 'Success',
        description: 'Onboarding template created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create template',
        variant: 'destructive',
      });
    }
  });

  // Update template mutation
  const updateMutation = useMutation({
    mutationFn: (data: { id: string; updates: any }) =>
      apiRequest(`/api/onboarding-templates/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify(data.updates),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/onboarding-templates'] });
      await queryClient.refetchQueries({ queryKey: ['/api/onboarding-templates'] });
      setIsEditDialogOpen(false);
      resetForm();
      toast({
        title: 'Success',
        description: 'Template updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update template',
        variant: 'destructive',
      });
    }
  });

  // Delete template mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/onboarding-templates/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/onboarding-templates'] });
      toast({
        title: 'Success',
        description: 'Template deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete template',
        variant: 'destructive',
      });
    }
  });

  // Assign template mutation
  const assignMutation = useMutation({
    mutationFn: (data: { templateId: string; employeeId: string }) =>
      apiRequest(`/api/onboarding-templates/${data.templateId}/assign/${data.employeeId}`, {
        method: 'POST',
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/onboarding-instances'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/onboarding-templates'] })
      ]);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['/api/onboarding-instances'] }),
        queryClient.refetchQueries({ queryKey: ['/api/onboarding-templates'] })
      ]);
      setIsAssignDialogOpen(false);
      setSelectedEmployeeId('');
      toast({
        title: 'Success',
        description: 'Template assigned to employee successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to assign template',
        variant: 'destructive',
      });
    }
  });

  // Update instance progress mutation
  const updateProgressMutation = useMutation({
    mutationFn: (data: { id: string; completedTasks: number }) =>
      apiRequest(`/api/onboarding-instances/${data.id}/progress`, {
        method: 'PUT',
        body: JSON.stringify({ completedTasks: data.completedTasks }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/onboarding-instances'] });
      await queryClient.refetchQueries({ queryKey: ['/api/onboarding-instances'] });
      toast({
        title: 'Success',
        description: 'Progress updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update progress',
        variant: 'destructive',
      });
    }
  });

  const resetForm = () => {
    setName('');
    setDescription('');
    setDepartment('');
    setTasks([]);
    setNewTask({ title: '', description: '', dueInDays: 1 });
    setSelectedTemplate(null);
  };

  const handleAddTask = () => {
    if (newTask.title && newTask.description) {
      setTasks([...tasks, newTask]);
      setNewTask({ title: '', description: '', dueInDays: 1 });
    }
  };

  const handleRemoveTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  const handleCreateTemplate = () => {
    if (!name || tasks.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a name and at least one task',
        variant: 'destructive',
      });
      return;
    }

    createMutation.mutate({
      name,
      description,
      department,
      tasks: JSON.stringify(tasks)
    });
  };

  const handleUpdateTemplate = () => {
    if (!selectedTemplate || !name || tasks.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a name and at least one task',
        variant: 'destructive',
      });
      return;
    }

    updateMutation.mutate({
      id: selectedTemplate.id,
      updates: {
        name,
        description,
        department,
        tasks: JSON.stringify(tasks)
      }
    });
  };

  const openEditDialog = (template: OnboardingTemplate) => {
    setSelectedTemplate(template);
    setName(template.name);
    setDescription(template.description || '');
    setDepartment(template.department || '');
    try {
      const parsedTasks = JSON.parse(template.tasks);
      setTasks(Array.isArray(parsedTasks) ? parsedTasks : []);
    } catch {
      setTasks([]);
    }
    setIsEditDialogOpen(true);
  };

  const openViewDialog = (template: OnboardingTemplate) => {
    setSelectedTemplate(template);
    try {
      const parsedTasks = JSON.parse(template.tasks);
      setTasks(Array.isArray(parsedTasks) ? parsedTasks : []);
    } catch {
      setTasks([]);
    }
    setIsViewDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleAssign = () => {
    if (selectedTemplate && selectedEmployeeId) {
      assignMutation.mutate({
        templateId: selectedTemplate.id,
        employeeId: selectedEmployeeId
      });
    }
  };

  if (templatesLoading) {
    return <div className="flex items-center justify-center h-64">Loading templates...</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Onboarding Templates</h1>
          <p className="text-muted-foreground mt-2">Manage department-specific onboarding workflows</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsInstancesDialogOpen(true)}>
            <Users className="h-4 w-4 mr-2" />
            View Instances
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates && templates.length > 0 ? (
          templates.map((template: OnboardingTemplate) => {
            let taskCount = 0;
            try {
              const parsedTasks = JSON.parse(template.tasks);
              taskCount = Array.isArray(parsedTasks) ? parsedTasks.length : 0;
            } catch {
              taskCount = 0;
            }

            return (
              <Card key={template.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <ClipboardList className="h-5 w-5" />
                        {template.name}
                      </CardTitle>
                      {template.department && (
                        <Badge variant="outline" className="mt-2">
                          {template.department}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {template.description && (
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                    )}

                    <div className="space-y-2">
                      <div className="text-sm">
                        <span className="font-medium">Tasks:</span>{' '}
                        <Badge variant="outline" className="ml-1">
                          {taskCount}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openViewDialog(template)}
                      >
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(template)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedTemplate(template);
                          setIsAssignDialogOpen(true);
                        }}
                      >
                        <Users className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(template.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="col-span-full text-center text-muted-foreground py-12">
            No templates found. Create your first onboarding template to get started.
          </div>
        )}
      </div>

      {/* Create Template Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Onboarding Template</DialogTitle>
            <DialogDescription>
              Define a new onboarding template with tasks and timelines
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                placeholder="e.g., Sales Rep Onboarding"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="department">Department</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Template description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="border-t pt-4">
              <Label className="text-base font-semibold">Tasks</Label>
              <div className="space-y-3 mt-3">
                {tasks.map((task, index) => (
                  <div key={index} className="flex items-start gap-2 p-3 border rounded-lg">
                    <GripVertical className="h-5 w-5 text-muted-foreground mt-1" />
                    <div className="flex-1">
                      <div className="font-medium">{task.title}</div>
                      <div className="text-sm text-muted-foreground">{task.description}</div>
                      <div className="text-xs text-muted-foreground mt-1">Due in {task.dueInDays} days</div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveTask(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <div className="border rounded-lg p-3 space-y-2">
                  <Input
                    placeholder="Task title"
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  />
                  <Textarea
                    placeholder="Task description"
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="1"
                      placeholder="Days"
                      value={newTask.dueInDays}
                      onChange={(e) => setNewTask({ ...newTask, dueInDays: parseInt(e.target.value) || 1 })}
                      className="w-24"
                    />
                    <Button onClick={handleAddTask} variant="outline" size="sm">
                      Add Task
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleCreateTemplate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Onboarding Template</DialogTitle>
            <DialogDescription>
              Update template information and tasks
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Template Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="edit-department">Department</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="border-t pt-4">
              <Label className="text-base font-semibold">Tasks</Label>
              <div className="space-y-3 mt-3">
                {tasks.map((task, index) => (
                  <div key={index} className="flex items-start gap-2 p-3 border rounded-lg">
                    <GripVertical className="h-5 w-5 text-muted-foreground mt-1" />
                    <div className="flex-1">
                      <div className="font-medium">{task.title}</div>
                      <div className="text-sm text-muted-foreground">{task.description}</div>
                      <div className="text-xs text-muted-foreground mt-1">Due in {task.dueInDays} days</div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveTask(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <div className="border rounded-lg p-3 space-y-2">
                  <Input
                    placeholder="Task title"
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  />
                  <Textarea
                    placeholder="Task description"
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="1"
                      placeholder="Days"
                      value={newTask.dueInDays}
                      onChange={(e) => setNewTask({ ...newTask, dueInDays: parseInt(e.target.value) || 1 })}
                      className="w-24"
                    />
                    <Button onClick={handleAddTask} variant="outline" size="sm">
                      Add Task
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleUpdateTemplate}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Updating...' : 'Update Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Template Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.name}</DialogTitle>
            <DialogDescription>
              {selectedTemplate?.description || 'Template details'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedTemplate?.department && (
              <div>
                <Label>Department</Label>
                <Badge variant="outline" className="ml-2">
                  {selectedTemplate.department}
                </Badge>
              </div>
            )}

            <div>
              <Label className="text-base font-semibold">Tasks ({tasks.length})</Label>
              <div className="space-y-2 mt-3">
                {tasks.map((task, index) => (
                  <div key={index} className="p-3 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium">{task.title}</div>
                        <div className="text-sm text-muted-foreground mt-1">{task.description}</div>
                      </div>
                      <Badge variant="secondary" className="ml-2">
                        Day {task.dueInDays}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Template Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Template to Employee</DialogTitle>
            <DialogDescription>
              Select an employee to assign {selectedTemplate?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="employee">Select Employee</Label>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user: User) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} - {user.position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleAssign}
              disabled={!selectedEmployeeId || assignMutation.isPending}
            >
              {assignMutation.isPending ? 'Assigning...' : 'Assign Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Onboarding Instances Dialog */}
      <Dialog open={isInstancesDialogOpen} onOpenChange={setIsInstancesDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Active Onboarding Instances</DialogTitle>
            <DialogDescription>
              View and manage employee onboarding progress
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {instances && instances.length > 0 ? (
              instances.map((instance: OnboardingInstance) => {
                const employee = users.find((u: User) => u.id === instance.employeeId);
                const template = templates.find((t: OnboardingTemplate) => t.id === instance.templateId);
                let totalTasks = 0;
                try {
                  if (template) {
                    const parsedTasks = JSON.parse(template.tasks);
                    totalTasks = Array.isArray(parsedTasks) ? parsedTasks.length : 0;
                  }
                } catch {
                  totalTasks = 0;
                }

                const progress = totalTasks > 0 ? (instance.completedTasks / totalTasks) * 100 : 0;

                return (
                  <Card key={instance.id}>
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium">
                              {employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown Employee'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {template?.name || 'Unknown Template'}
                            </div>
                          </div>
                          <Badge variant={instance.status === 'completed' ? 'default' : 'secondary'}>
                            {instance.status}
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Progress</span>
                            <span>{instance.completedTasks} / {totalTasks} tasks</span>
                          </div>
                          <Progress value={progress} />
                        </div>

                        {instance.status !== 'completed' && (
                          <div className="flex gap-2 pt-2">
                            <Input
                              type="number"
                              min="0"
                              max={totalTasks}
                              placeholder="Completed tasks"
                              className="w-32"
                              defaultValue={instance.completedTasks}
                              onBlur={(e) => {
                                const newValue = parseInt(e.target.value) || 0;
                                if (newValue !== instance.completedTasks && newValue >= 0 && newValue <= totalTasks) {
                                  updateProgressMutation.mutate({
                                    id: instance.id,
                                    completedTasks: newValue
                                  });
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                updateProgressMutation.mutate({
                                  id: instance.id,
                                  completedTasks: totalTasks
                                });
                              }}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Mark Complete
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="text-center text-muted-foreground py-12">
                No active onboarding instances found
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInstancesDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
