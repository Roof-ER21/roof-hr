import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Textarea } from '@/components/ui/textarea';
import { Users, UserPlus, Link, Calendar, ArrowRight, Briefcase, UserCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import type { User, EmployeeAssignment } from '@/../../shared/schema';
import { useAuth } from '@/lib/auth';

const formSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  assignedToId: z.string().min(1, 'Manager/Supervisor is required'),
  assignmentType: z.enum(['PRIMARY', 'SECONDARY']),
  responsibilities: z.array(z.string()).default([]),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  notes: z.string().optional()
});

export default function EmployeeAssignments() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<EmployeeAssignment | null>(null);
  const [responsibilityInput, setResponsibilityInput] = useState('');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeId: '',
      assignedToId: '',
      assignmentType: 'PRIMARY',
      responsibilities: [],
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      notes: ''
    }
  });

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['/api/employee-assignments'],
  });

  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
  });

  const createMutation = useMutation({
    mutationFn: (data: z.infer<typeof formSchema>) => 
      apiRequest('/api/employee-assignments', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employee-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: 'Success',
        description: 'Employee assignment created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create assignment',
        variant: 'destructive',
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => 
      apiRequest(`/api/employee-assignments/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employee-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: 'Success',
        description: 'Assignment deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete assignment',
        variant: 'destructive',
      });
    }
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createMutation.mutate(data);
  };

  const addResponsibility = () => {
    if (responsibilityInput.trim()) {
      const current = form.getValues('responsibilities');
      form.setValue('responsibilities', [...current, responsibilityInput.trim()]);
      setResponsibilityInput('');
    }
  };

  const removeResponsibility = (index: number) => {
    const current = form.getValues('responsibilities');
    form.setValue('responsibilities', current.filter((_, i) => i !== index));
  };

  // Group assignments by manager
  const assignmentsByManager = assignments.reduce((acc: any, assignment: EmployeeAssignment) => {
    const managerId = assignment.assignedToId;
    if (!acc[managerId]) {
      acc[managerId] = [];
    }
    acc[managerId].push(assignment);
    return acc;
  }, {});

  // Get managers (users who have employees assigned to them)
  const managers = users.filter((user: User) => 
    ['MANAGER', 'ADMIN', 'GENERAL_MANAGER', 'TRUE_ADMIN', 'TERRITORY_SALES_MANAGER'].includes(user.role)
  );

  // Get employees without primary assignment
  const unassignedEmployees = users.filter((user: User) => {
    const primaryAssignment = assignments.find((a: EmployeeAssignment) => 
      a.employeeId === user.id && a.assignmentType === 'PRIMARY' && a.isActive
    );
    return !primaryAssignment;
  });

  const isManager = ['ADMIN', 'MANAGER', 'GENERAL_MANAGER', 'TRUE_ADMIN'].includes(currentUser?.role);

  if (assignmentsLoading) {
    return <div className="flex items-center justify-center h-64">Loading assignments...</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Employee Assignments</h1>
          <p className="text-muted-foreground mt-2">Manage reporting structure and responsibilities</p>
        </div>
        {isManager && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                New Assignment
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Create Employee Assignment</DialogTitle>
                <DialogDescription>
                  Assign an employee to a manager or supervisor
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="employeeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employee</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select employee" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {users.map((user: User) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.firstName} {user.lastName} - {user.position}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="assignedToId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assign To (Manager/Supervisor)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select manager" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {managers.map((user: User) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.firstName} {user.lastName} - {user.role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="assignmentType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assignment Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="PRIMARY">Primary Manager</SelectItem>
                            <SelectItem value="SECONDARY">Secondary/Dotted Line</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Primary managers have direct reporting responsibility
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="responsibilities"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Responsibilities</FormLabel>
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Input
                              value={responsibilityInput}
                              onChange={(e) => setResponsibilityInput(e.target.value)}
                              placeholder="Add responsibility..."
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addResponsibility();
                                }
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={addResponsibility}
                            >
                              Add
                            </Button>
                          </div>
                          <div className="space-y-1">
                            {field.value.map((resp, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <Badge variant="secondary">{resp}</Badge>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeResponsibility(index)}
                                >
                                  Remove
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Date (Optional)</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormDescription>
                            Leave blank for ongoing assignment
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Additional notes about this assignment..." 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? 'Creating...' : 'Create Assignment'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
            <Link className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assignments.length}</div>
            <p className="text-xs text-muted-foreground">Active assignments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Primary Assignments</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {assignments.filter((a: EmployeeAssignment) => a.assignmentType === 'PRIMARY').length}
            </div>
            <p className="text-xs text-muted-foreground">Direct reports</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unassigned Employees</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unassignedEmployees.length}</div>
            <p className="text-xs text-muted-foreground">Need primary assignment</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="by-manager" className="space-y-4">
        <TabsList>
          <TabsTrigger value="by-manager">By Manager</TabsTrigger>
          <TabsTrigger value="all-assignments">All Assignments</TabsTrigger>
          <TabsTrigger value="unassigned">Unassigned</TabsTrigger>
        </TabsList>

        <TabsContent value="by-manager" className="space-y-4">
          {Object.entries(assignmentsByManager).map(([managerId, managerAssignments]: [string, any]) => {
            const manager = users.find((u: User) => u.id === managerId);
            if (!manager) return null;

            return (
              <Card key={managerId}>
                <CardHeader>
                  <CardTitle>
                    {manager.firstName} {manager.lastName}
                  </CardTitle>
                  <CardDescription>
                    {manager.role} - {(managerAssignments as EmployeeAssignment[]).length} direct reports
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Responsibilities</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(managerAssignments as EmployeeAssignment[]).map((assignment: EmployeeAssignment) => {
                        const employee = users.find((u: User) => u.id === assignment.employeeId);
                        
                        return (
                          <TableRow key={assignment.id}>
                            <TableCell className="font-medium">
                              {employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={assignment.assignmentType === 'PRIMARY' ? 'default' : 'secondary'}>
                                {assignment.assignmentType}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-xs">
                              {assignment.responsibilities?.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {assignment.responsibilities.slice(0, 2).map((resp, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {resp}
                                    </Badge>
                                  ))}
                                  {assignment.responsibilities.length > 2 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{assignment.responsibilities.length - 2} more
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>{format(new Date(assignment.startDate), 'MMM dd, yyyy')}</TableCell>
                            <TableCell>
                              <Badge variant={assignment.isActive ? 'default' : 'secondary'}>
                                {assignment.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {isManager && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => deleteMutation.mutate(assignment.id)}
                                >
                                  Remove
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="all-assignments">
          <Card>
            <CardHeader>
              <CardTitle>All Employee Assignments</CardTitle>
              <CardDescription>Complete list of all assignments</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Reports To</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment: EmployeeAssignment) => {
                    const employee = users.find((u: User) => u.id === assignment.employeeId);
                    const manager = users.find((u: User) => u.id === assignment.assignedToId);
                    
                    return (
                      <TableRow key={assignment.id}>
                        <TableCell className="font-medium">
                          {employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown'}
                        </TableCell>
                        <TableCell>
                          {manager ? `${manager.firstName} ${manager.lastName}` : 'Unknown'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={assignment.assignmentType === 'PRIMARY' ? 'default' : 'secondary'}>
                            {assignment.assignmentType}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(assignment.startDate), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>
                          {assignment.endDate ? 
                            format(new Date(assignment.endDate), 'MMM dd, yyyy') : 
                            <span className="text-muted-foreground">Ongoing</span>
                          }
                        </TableCell>
                        <TableCell>
                          <Badge variant={assignment.isActive ? 'default' : 'secondary'}>
                            {assignment.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isManager && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deleteMutation.mutate(assignment.id)}
                            >
                              Remove
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unassigned">
          <Card>
            <CardHeader>
              <CardTitle>Unassigned Employees</CardTitle>
              <CardDescription>
                Employees without a primary manager assignment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Hire Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unassignedEmployees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <UserCheck className="h-8 w-8" />
                          <p className="text-sm">All employees have been assigned to managers</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    unassignedEmployees.map((employee: User) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">
                        {employee.firstName} {employee.lastName}
                      </TableCell>
                      <TableCell>{employee.position}</TableCell>
                      <TableCell>{employee.department || '-'}</TableCell>
                      <TableCell>
                        {employee.hireDate ? 
                          format(new Date(employee.hireDate), 'MMM dd, yyyy') : 
                          '-'
                        }
                      </TableCell>
                      <TableCell>
                        {isManager ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              form.reset({
                                employeeId: employee.id,
                                assignedToId: '',
                                assignmentType: 'PRIMARY',
                                responsibilities: [],
                                startDate: new Date().toISOString().split('T')[0],
                                endDate: '',
                                notes: ''
                              });
                              setIsCreateDialogOpen(true);
                            }}
                            className="hover:bg-primary hover:text-primary-foreground transition-colors"
                          >
                            <UserPlus className="h-4 w-4 mr-1" />
                            Assign Manager
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">No permission</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}