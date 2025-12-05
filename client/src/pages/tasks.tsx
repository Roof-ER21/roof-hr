import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  ClipboardList, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Circle,
  User,
  Calendar,
  Search,
  Filter
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  assignedTo: z.string().min(1),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  dueDate: z.string().optional(),
  category: z.string().min(1),
  tags: z.array(z.string()).optional(),
});

type TaskFormData = z.infer<typeof taskSchema>;

function Tasks() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['/api/tasks'],
    queryFn: async () => {
      const response = await fetch('/api/tasks', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch tasks');
      return response.json();
    }
  });

  const { data: users } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    }
  });

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      description: '',
      assignedTo: '',
      priority: 'MEDIUM',
      dueDate: '',
      category: '',
      tags: [],
    }
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: TaskFormData) => {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...data,
          tags: selectedTags,
        })
      });
      if (!response.ok) throw new Error('Failed to create task');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      setIsDialogOpen(false);
      form.reset();
      setSelectedTags([]);
      toast({
        title: 'Success',
        description: 'Task created successfully'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to create task',
        variant: 'destructive'
      });
    }
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<any> }) => {
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...data,
          completedAt: data.status === 'COMPLETED' ? new Date().toISOString() : undefined
        })
      });
      if (!response.ok) throw new Error('Failed to update task');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({
        title: 'Success',
        description: 'Task updated successfully'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to update task',
        variant: 'destructive'
      });
    }
  });

  const onSubmit = (data: TaskFormData) => {
    createTaskMutation.mutate(data);
  };

  const handleStatusChange = (taskId: string, newStatus: string) => {
    updateTaskMutation.mutate({
      id: taskId,
      data: { status: newStatus }
    });
  };

  const handleTagAdd = (tag: string) => {
    if (tag && !selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleTagRemove = (tag: string) => {
    setSelectedTags(selectedTags.filter(t => t !== tag));
  };

  const getUserById = (id: string) => {
    return users?.find((user: any) => user.id === id);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'LOW': return 'bg-gray-100 text-gray-800';
      case 'MEDIUM': return 'bg-blue-100 text-blue-800';
      case 'HIGH': return 'bg-orange-100 text-orange-800';
      case 'URGENT': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'TODO': return 'bg-gray-100 text-gray-800';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'TODO': return <Circle className="w-4 h-4" />;
      case 'IN_PROGRESS': return <Clock className="w-4 h-4" />;
      case 'COMPLETED': return <CheckCircle className="w-4 h-4" />;
      case 'CANCELLED': return <AlertTriangle className="w-4 h-4" />;
      default: return <Circle className="w-4 h-4" />;
    }
  };

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date() && true;
  };

  const filteredTasks = tasks?.filter((task: any) => {
    const statusMatch = filterStatus === 'all' || task.status === filterStatus;
    const priorityMatch = filterPriority === 'all' || task.priority === filterPriority;
    const searchMatch = searchTerm === '' || 
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.category.toLowerCase().includes(searchTerm.toLowerCase());
    return statusMatch && priorityMatch && searchMatch;
  }) || [];

  const tasksByStatus = {
    todo: filteredTasks.filter((task: any) => task.status === 'TODO'),
    inProgress: filteredTasks.filter((task: any) => task.status === 'IN_PROGRESS'),
    completed: filteredTasks.filter((task: any) => task.status === 'COMPLETED'),
  };

  const stats = {
    total: tasks?.length || 0,
    todo: tasks?.filter((task: any) => task.status === 'TODO').length || 0,
    inProgress: tasks?.filter((task: any) => task.status === 'IN_PROGRESS').length || 0,
    completed: tasks?.filter((task: any) => task.status === 'COMPLETED').length || 0,
    overdue: tasks?.filter((task: any) => 
      task.status !== 'COMPLETED' && isOverdue(task.dueDate)
    ).length || 0,
  };

  if (tasksLoading) {
    return <div className="p-8">Loading tasks...</div>;
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-secondary-950">Tasks</h1>
          <p className="mt-2 text-sm text-secondary-600">
            Manage and track team tasks and assignments
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="title">Task Title</Label>
                  <Input
                    id="title"
                    {...form.register('title')}
                    placeholder="Enter task title"
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    {...form.register('description')}
                    placeholder="Task description and details"
                    rows={3}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="assignedTo">Assigned To</Label>
                    <Select onValueChange={(value) => form.setValue('assignedTo', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select assignee" />
                      </SelectTrigger>
                      <SelectContent>
                        {users?.map((user: any) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.firstName} {user.lastName} - {user.position}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select onValueChange={(value) => form.setValue('priority', value as any)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="URGENT">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      {...form.register('category')}
                      placeholder="e.g., Development, Design, Admin"
                    />
                  </div>
                  <div>
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input
                      id="dueDate"
                      type="datetime-local"
                      {...form.register('dueDate')}
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Tags</Label>
                  <div className="flex items-center space-x-2 mt-2">
                    <Input
                      placeholder="Add tag and press Enter"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleTagAdd((e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedTags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => handleTagRemove(tag)}>
                        {tag} ×
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createTaskMutation.isPending}>
                    {createTaskMutation.isPending ? 'Creating...' : 'Create Task'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5 mb-8">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center">
              <ClipboardList className="w-6 h-6 text-blue-500" />
              <div className="ml-5">
                <dl>
                  <dt className="text-sm font-medium text-secondary-500">Total Tasks</dt>
                  <dd className="text-2xl font-semibold text-secondary-900">{stats.total}</dd>
                </dl>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center">
              <Circle className="w-6 h-6 text-gray-500" />
              <div className="ml-5">
                <dl>
                  <dt className="text-sm font-medium text-secondary-500">To Do</dt>
                  <dd className="text-2xl font-semibold text-secondary-900">{stats.todo}</dd>
                </dl>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center">
              <Clock className="w-6 h-6 text-blue-500" />
              <div className="ml-5">
                <dl>
                  <dt className="text-sm font-medium text-secondary-500">In Progress</dt>
                  <dd className="text-2xl font-semibold text-secondary-900">{stats.inProgress}</dd>
                </dl>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center">
              <CheckCircle className="w-6 h-6 text-green-500" />
              <div className="ml-5">
                <dl>
                  <dt className="text-sm font-medium text-secondary-500">Completed</dt>
                  <dd className="text-2xl font-semibold text-secondary-900">{stats.completed}</dd>
                </dl>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <div className="ml-5">
                <dl>
                  <dt className="text-sm font-medium text-secondary-500">Overdue</dt>
                  <dd className="text-2xl font-semibold text-secondary-900">{stats.overdue}</dd>
                </dl>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-secondary-500" />
              <Input
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
            <div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="TODO">To Do</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks Kanban View */}
      <Tabs defaultValue="kanban" className="space-y-6">
        <TabsList>
          <TabsTrigger value="kanban">Kanban Board</TabsTrigger>
          <TabsTrigger value="list">List View</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* To Do Column */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Circle className="w-5 h-5 mr-2 text-gray-500" />
                  To Do ({tasksByStatus.todo.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {tasksByStatus.todo.map((task: any) => {
                  const assignee = getUserById(task.assignedTo);
                  const overdue = isOverdue(task.dueDate);
                  
                  return (
                    <Card key={task.id} className={`cursor-pointer hover:shadow-md transition-shadow ${overdue ? 'border-red-200' : ''}`}>
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <h4 className="font-medium text-sm">{task.title}</h4>
                            <Badge className={getPriorityColor(task.priority)}>
                              {task.priority}
                            </Badge>
                          </div>
                          
                          {task.description && (
                            <p className="text-xs text-secondary-600 line-clamp-2">{task.description}</p>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <User className="w-3 h-3 text-secondary-500" />
                              <span className="text-xs text-secondary-600">
                                {assignee?.firstName} {assignee?.lastName}
                              </span>
                            </div>
                            
                            {task.dueDate && (
                              <div className={`flex items-center space-x-1 ${overdue ? 'text-red-600' : 'text-secondary-500'}`}>
                                <Calendar className="w-3 h-3" />
                                <span className="text-xs">
                                  {new Date(task.dueDate).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-xs">
                              {task.category}
                            </Badge>
                            
                            <Select
                              value={task.status}
                              onValueChange={(value) => handleStatusChange(task.id, value)}
                            >
                              <SelectTrigger className="w-32 h-6 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="TODO">To Do</SelectItem>
                                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                                <SelectItem value="COMPLETED">Completed</SelectItem>
                                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {task.tags && task.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {task.tags.map((tag: string) => (
                                <Badge key={tag} variant="secondary" className="text-xs px-1 py-0">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </CardContent>
            </Card>

            {/* In Progress Column */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="w-5 h-5 mr-2 text-blue-500" />
                  In Progress ({tasksByStatus.inProgress.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {tasksByStatus.inProgress.map((task: any) => {
                  const assignee = getUserById(task.assignedTo);
                  const overdue = isOverdue(task.dueDate);
                  
                  return (
                    <Card key={task.id} className={`cursor-pointer hover:shadow-md transition-shadow ${overdue ? 'border-red-200' : ''}`}>
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <h4 className="font-medium text-sm">{task.title}</h4>
                            <Badge className={getPriorityColor(task.priority)}>
                              {task.priority}
                            </Badge>
                          </div>
                          
                          {task.description && (
                            <p className="text-xs text-secondary-600 line-clamp-2">{task.description}</p>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <User className="w-3 h-3 text-secondary-500" />
                              <span className="text-xs text-secondary-600">
                                {assignee?.firstName} {assignee?.lastName}
                              </span>
                            </div>
                            
                            {task.dueDate && (
                              <div className={`flex items-center space-x-1 ${overdue ? 'text-red-600' : 'text-secondary-500'}`}>
                                <Calendar className="w-3 h-3" />
                                <span className="text-xs">
                                  {new Date(task.dueDate).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-xs">
                              {task.category}
                            </Badge>
                            
                            <Select
                              value={task.status}
                              onValueChange={(value) => handleStatusChange(task.id, value)}
                            >
                              <SelectTrigger className="w-32 h-6 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="TODO">To Do</SelectItem>
                                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                                <SelectItem value="COMPLETED">Completed</SelectItem>
                                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {task.tags && task.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {task.tags.map((tag: string) => (
                                <Badge key={tag} variant="secondary" className="text-xs px-1 py-0">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </CardContent>
            </Card>

            {/* Completed Column */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
                  Completed ({tasksByStatus.completed.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {tasksByStatus.completed.map((task: any) => {
                  const assignee = getUserById(task.assignedTo);
                  
                  return (
                    <Card key={task.id} className="cursor-pointer hover:shadow-md transition-shadow opacity-75">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <h4 className="font-medium text-sm line-through">{task.title}</h4>
                            <Badge className={getPriorityColor(task.priority)}>
                              {task.priority}
                            </Badge>
                          </div>
                          
                          {task.description && (
                            <p className="text-xs text-secondary-600 line-clamp-2">{task.description}</p>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <User className="w-3 h-3 text-secondary-500" />
                              <span className="text-xs text-secondary-600">
                                {assignee?.firstName} {assignee?.lastName}
                              </span>
                            </div>
                            
                            {task.completedAt && (
                              <div className="flex items-center space-x-1 text-green-600">
                                <CheckCircle className="w-3 h-3" />
                                <span className="text-xs">
                                  {new Date(task.completedAt).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-xs">
                              {task.category}
                            </Badge>
                            
                            <Select
                              value={task.status}
                              onValueChange={(value) => handleStatusChange(task.id, value)}
                            >
                              <SelectTrigger className="w-32 h-6 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="TODO">To Do</SelectItem>
                                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                                <SelectItem value="COMPLETED">Completed</SelectItem>
                                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {task.tags && task.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {task.tags.map((tag: string) => (
                                <Badge key={tag} variant="secondary" className="text-xs px-1 py-0">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="list">
          <Card>
            <CardHeader>
              <CardTitle>All Tasks ({filteredTasks.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Task</th>
                      <th className="text-left py-3 px-4">Assignee</th>
                      <th className="text-left py-3 px-4">Priority</th>
                      <th className="text-left py-3 px-4">Status</th>
                      <th className="text-left py-3 px-4">Category</th>
                      <th className="text-left py-3 px-4">Due Date</th>
                      <th className="text-left py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map((task: any) => {
                      const assignee = getUserById(task.assignedTo);
                      const overdue = isOverdue(task.dueDate);
                      
                      return (
                        <tr key={task.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div>
                              <div className={`font-medium ${task.status === 'COMPLETED' ? 'line-through opacity-75' : ''}`}>
                                {task.title}
                              </div>
                              {task.description && (
                                <div className="text-sm text-secondary-500 line-clamp-1">
                                  {task.description}
                                </div>
                              )}
                              {task.tags && task.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {task.tags.map((tag: string) => (
                                    <Badge key={tag} variant="secondary" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center">
                              <div className="w-8 h-8 bg-secondary-200 rounded-full flex items-center justify-center mr-3">
                                <span className="text-xs font-medium">
                                  {assignee?.firstName?.[0]}{assignee?.lastName?.[0]}
                                </span>
                              </div>
                              <div>
                                <div className="font-medium">{assignee?.firstName} {assignee?.lastName}</div>
                                <div className="text-sm text-secondary-500">{assignee?.position}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge className={getPriorityColor(task.priority)}>
                              {task.priority}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Select
                              value={task.status}
                              onValueChange={(value) => handleStatusChange(task.id, value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue>
                                  <Badge className={getStatusColor(task.status)}>
                                    <div className="flex items-center">
                                      {getStatusIcon(task.status)}
                                      <span className="ml-1">{task.status.replace('_', ' ')}</span>
                                    </div>
                                  </Badge>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="TODO">To Do</SelectItem>
                                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                                <SelectItem value="COMPLETED">Completed</SelectItem>
                                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline">{task.category}</Badge>
                          </td>
                          <td className="py-3 px-4">
                            {task.dueDate ? (
                              <span className={overdue && task.status !== 'COMPLETED' ? 'text-red-600 font-medium' : ''}>
                                {new Date(task.dueDate).toLocaleDateString()}
                                {overdue && task.status !== 'COMPLETED' && (
                                  <Badge className="ml-2 bg-red-100 text-red-800">Overdue</Badge>
                                )}
                              </span>
                            ) : (
                              <span className="text-gray-500">No due date</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <Button variant="outline" size="sm">
                              Edit
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default Tasks;
