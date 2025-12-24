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
import { Calendar, Users, Plus, Edit2, Settings, AlertTriangle, CheckCircle, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { User, PtoPolicy, DepartmentPtoSetting } from '@/../../shared/schema';

const policyFormSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  additionalDays: z.number().min(0).default(0),
  notes: z.string().optional()
});

const individualPolicyEditSchema = z.object({
  vacationDays: z.number().min(0).max(365),
  sickDays: z.number().min(0).max(365),
  personalDays: z.number().min(0).max(365),
  notes: z.string().optional()
});

const departmentFormSchema = z.object({
  department: z.string().min(1, 'Department is required'),
  baseDays: z.number().min(0, 'Base days must be 0 or more').max(365, 'Base days cannot exceed 365'),
  vacationDays: z.number().min(0).max(365).optional(),
  sickDays: z.number().min(0).max(365).optional(),
  personalDays: z.number().min(0).max(365).optional()
});

export default function PtoPolicies() {
  const { toast } = useToast();
  const [isCustomizeDialogOpen, setIsCustomizeDialogOpen] = useState(false);
  const [isDepartmentDialogOpen, setIsDepartmentDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
  const [selectedPolicy, setSelectedPolicy] = useState<PtoPolicy | null>(null);

  const { data: currentUser } = useQuery<User>({
    queryKey: ['/api/auth/me'],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Fetch from correct endpoints
  const { data: companyPolicy } = useQuery<{ vacationDays: number; sickDays: number; personalDays: number }>({
    queryKey: ['/api/pto/company-policy'],
  });

  const { data: departmentSettings = [] } = useQuery<DepartmentPtoSetting[]>({
    queryKey: ['/api/pto/department-settings'],
  });

  const { data: individualPolicies = [] } = useQuery<PtoPolicy[]>({
    queryKey: ['/api/pto/individual-policies'],
  });

  const { data: policies = individualPolicies, isLoading: policiesLoading } = useQuery<PtoPolicy[]>({
    queryKey: ['/api/pto/individual-policies'],
  });

  const { data: ptoRequests = [] } = useQuery<Array<{ id: string; employeeId: string; type: string; status: string }>>({
    queryKey: ['/api/pto'],
  });

  const policyForm = useForm<z.infer<typeof policyFormSchema>>({
    resolver: zodResolver(policyFormSchema),
    defaultValues: {
      employeeId: '',
      additionalDays: 0,
      notes: ''
    }
  });

  // Default to company standard: 5 vacation, 5 sick, 2 personal = 12 total
  const departmentForm = useForm<z.infer<typeof departmentFormSchema>>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: {
      department: '',
      baseDays: 12,
      vacationDays: 5,
      sickDays: 5,
      personalDays: 2
    }
  });

  // Default to company standard: 5 vacation, 5 sick, 2 personal = 12 total
  const editPolicyForm = useForm<z.infer<typeof individualPolicyEditSchema>>({
    resolver: zodResolver(individualPolicyEditSchema),
    defaultValues: {
      vacationDays: 5,
      sickDays: 5,
      personalDays: 2,
      notes: ''
    }
  });

  const createPolicyMutation = useMutation({
    mutationFn: (data: z.infer<typeof policyFormSchema>) => {
      // Calculate totalDays based on company policy or default (5 vacation, 5 sick, 2 personal = 12 total)
      const baseDays = companyPolicy?.vacationDays || 5;
      const totalDays = baseDays + (data.additionalDays || 0);
      
      return apiRequest('/api/pto/individual-policies', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          totalDays,
          baseDays,
          policyLevel: 'INDIVIDUAL'
        }),
      });
    },
    onSuccess: () => {
      // Invalidate all related queries to ensure data syncs
      queryClient.invalidateQueries({ queryKey: ['/api/pto/individual-policies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pto-policies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pto'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pto/department-settings'] });
      setIsCustomizeDialogOpen(false);
      policyForm.reset();
      toast({
        title: 'Success',
        description: 'PTO policy updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update PTO policy',
        variant: 'destructive',
      });
    }
  });

  const updateIndividualPolicyMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: z.infer<typeof individualPolicyEditSchema> }) => {
      const totalDays = data.vacationDays + data.sickDays + data.personalDays;
      // Get the current policy to preserve usedDays
      const currentPolicy = (policies as PtoPolicy[]).find(p => p.id === id);
      const usedDays = currentPolicy?.usedDays || 0;
      
      return apiRequest(`/api/pto/individual-policies/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...data,
          totalDays,
          baseDays: totalDays,
          remainingDays: totalDays - usedDays,
          usedDays // Preserve used days
        }),
      });
    },
    onSuccess: () => {
      // Invalidate all related queries to ensure data syncs
      queryClient.invalidateQueries({ queryKey: ['/api/pto/individual-policies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pto-policies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pto'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pto/department-settings'] });
      setIsEditDialogOpen(false);
      editPolicyForm.reset();
      toast({
        title: 'Success',
        description: 'Individual PTO policy updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update individual PTO policy',
        variant: 'destructive',
      });
    }
  });

  const updateDepartmentSettingMutation = useMutation({
    mutationFn: (data: z.infer<typeof departmentFormSchema>) => {
      // Default to company standard: 5 vacation, 5 sick, 2 personal = 12 total
      const vacationDays = data.vacationDays || data.baseDays || 5;
      const sickDays = data.sickDays || 5;
      const personalDays = data.personalDays || 2;
      const totalDays = vacationDays + sickDays + personalDays;
      
      return apiRequest('/api/pto/department-settings', {
        method: 'POST',
        body: JSON.stringify({
          department: data.department,
          vacationDays,
          sickDays,
          personalDays,
          totalDays,
          baseDays: totalDays,
          overridesCompany: true
        }),
      });
    },
    onSuccess: () => {
      // Invalidate all related queries to ensure data syncs
      queryClient.invalidateQueries({ queryKey: ['/api/pto/department-settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pto/individual-policies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pto-policies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pto'] });
      setIsDepartmentDialogOpen(false);
      departmentForm.reset();
      toast({
        title: 'Success',
        description: 'Department PTO settings updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update department settings',
        variant: 'destructive',
      });
    }
  });

  const onSubmitPolicy = (data: z.infer<typeof policyFormSchema>) => {
    createPolicyMutation.mutate(data);
  };

  const onSubmitDepartment = (data: z.infer<typeof departmentFormSchema>) => {
    updateDepartmentSettingMutation.mutate(data);
  };

  const handleEditDepartmentSetting = (dept: string) => {
    const deptSetting = (departmentSettings as DepartmentPtoSetting[]).find((s: DepartmentPtoSetting) => s.department === dept);
    // Default to company standard: 5 vacation, 5 sick, 2 personal = 12 total
    if (deptSetting) {
      departmentForm.setValue('department', dept);
      departmentForm.setValue('vacationDays', deptSetting.vacationDays || 5);
      departmentForm.setValue('sickDays', deptSetting.sickDays || 5);
      departmentForm.setValue('personalDays', deptSetting.personalDays || 2);
      departmentForm.setValue('baseDays', deptSetting.totalDays || 12);
    } else {
      // If no setting exists, use company defaults
      departmentForm.setValue('department', dept);
      departmentForm.setValue('vacationDays', companyPolicy?.vacationDays || 5);
      departmentForm.setValue('sickDays', companyPolicy?.sickDays || 5);
      departmentForm.setValue('personalDays', companyPolicy?.personalDays || 2);
      departmentForm.setValue('baseDays', (companyPolicy?.vacationDays || 5) + (companyPolicy?.sickDays || 5) + (companyPolicy?.personalDays || 2));
    }
    setIsDepartmentDialogOpen(true);
  };

  const handleEditPolicy = (policy: PtoPolicy) => {
    setSelectedPolicy(policy);
    // Default to company standard: 5 vacation, 5 sick, 2 personal = 12 total
    editPolicyForm.setValue('vacationDays', policy.vacationDays || 5);
    editPolicyForm.setValue('sickDays', policy.sickDays || 5);
    editPolicyForm.setValue('personalDays', policy.personalDays || 2);
    editPolicyForm.setValue('notes', policy.notes || '');
    setIsEditDialogOpen(true);
  };

  const onSubmitEditPolicy = (data: z.infer<typeof individualPolicyEditSchema>) => {
    if (selectedPolicy) {
      updateIndividualPolicyMutation.mutate({ id: selectedPolicy.id, data });
    }
  };

  const initializePoliciesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/pto-policies/initialize', {
        method: 'POST'
      });
    },
    onSuccess: (data: any) => {
      // Invalidate all related queries to ensure data syncs
      queryClient.invalidateQueries({ queryKey: ['/api/pto/individual-policies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pto-policies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pto'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pto/department-settings'] });
      toast({
        title: 'Success',
        description: data.message || 'PTO policies initialized successfully'
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Filter eligible employees (exclude 1099/Sales)
  const eligibleEmployees = (users as User[]).filter((u: User) => 
    u.isActive && 
    u.employmentType !== '1099' && 
    u.department !== 'Sales'
  );

  // Get unique departments from users
  const departments = Array.from(new Set((users as User[]).map((u: User) => u.department))).filter(Boolean) as string[];

  // Group policies by department
  const policiesByDepartment = (policies as PtoPolicy[]).reduce((acc: any, policy: PtoPolicy) => {
    const user = (users as User[]).find((u: User) => u.id === policy.employeeId);
    if (user) {
      const dept = user.department || 'No Department';
      if (!acc[dept]) acc[dept] = [];
      acc[dept].push({ ...policy, user });
    }
    return acc;
  }, {});

  // Calculate department statistics - show ALL departments
  const departmentStats = departments.map(dept => {
    // Get all eligible employees in department (exclude 1099 only, but INCLUDE Marketing/Sales departments)
    const deptUsers = (users as User[]).filter((u: User) => 
      u.department === dept && 
      u.isActive && 
      u.employmentType !== '1099'
    );
    
    // Get policies for department employees
    const deptPolicies = (policies as PtoPolicy[]).filter((p: PtoPolicy) => {
      const user = (users as User[]).find((u: User) => u.id === p.employeeId);
      return user?.department === dept && user?.employmentType !== '1099';
    });
    
    const deptSetting = (departmentSettings as DepartmentPtoSetting[]).find((s: DepartmentPtoSetting) => s.department === dept);
    
    // Calculate base days from department or company settings
    const basePtoConfig = deptSetting || companyPolicy || { vacationDays: 9, sickDays: 2, personalDays: 2 };
    const baseDays = (basePtoConfig.vacationDays || 0) + (basePtoConfig.sickDays || 0) + (basePtoConfig.personalDays || 0);
    
    // For employees with policies, use actual totals
    // For employees without policies, use the expected base days
    const employeesWithPolicies = deptPolicies.length;
    const employeesWithoutPolicies = Math.max(0, deptUsers.length - employeesWithPolicies);
    
    const actualTotalDays = deptPolicies.reduce((sum: number, p: PtoPolicy) => sum + p.totalDays, 0);
    const expectedTotalDays = employeesWithoutPolicies * baseDays;
    const totalDays = actualTotalDays + expectedTotalDays;
    
    const usedDays = deptPolicies.reduce((sum: number, p: PtoPolicy) => sum + p.usedDays, 0);
    const actualRemainingDays = deptPolicies.reduce((sum: number, p: PtoPolicy) => sum + p.remainingDays, 0);
    const expectedRemainingDays = expectedTotalDays; // Unused policies have full days remaining
    const remainingDays = actualRemainingDays + expectedRemainingDays;
    
    return {
      department: dept,
      employeeCount: deptUsers.length,
      baseDays,
      totalDays,
      usedDays,
      remainingDays,
      averageUsed: deptUsers.length > 0 ? (usedDays / deptUsers.length).toFixed(1) : '0.0',
      hasSetting: !!deptSetting
    };
  }).filter(stat => stat.employeeCount > 0 || stat.hasSetting); // Show departments with employees or settings

  // Check if current user has permission to edit PTO policies
  const currentUserTyped = currentUser as User | undefined;
  const isFordBarsi = currentUserTyped?.role === 'GENERAL_MANAGER' || currentUserTyped?.email === 'ford.barsi@theroofdocs.com';
  const isAhmed = currentUserTyped?.email === 'ahmed.mahmoud@theroofdocs.com' || currentUserTyped?.role === 'TRUE_ADMIN';
  // Allow edit for ADMIN role (consistent with system-wide permissions), General Manager, and specific users
  const canEdit = currentUserTyped?.role === 'ADMIN' || isFordBarsi || isAhmed;
  // Ahmed always has manager access via email fallback
  const isManager = currentUserTyped?.email === 'ahmed.mahmoud@theroofdocs.com' ||
    ['SYSTEM_ADMIN', 'HR_ADMIN', 'GENERAL_MANAGER', 'TERRITORY_MANAGER', 'MANAGER', 'TRUE_ADMIN', 'ADMIN', 'TERRITORY_SALES_MANAGER'].includes(currentUserTyped?.role || '');

  if (policiesLoading) {
    return <div className="flex items-center justify-center h-64">Loading PTO policies...</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">PTO Policy Management</h1>
          <p className="text-muted-foreground mt-2">Manage paid time off policies and allocations</p>
        </div>
        {isManager && (
          <div className="flex gap-2">
            <Dialog open={isDepartmentDialogOpen} onOpenChange={setIsDepartmentDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Settings className="h-4 w-4 mr-2" />
                  Department Settings
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Department PTO Settings</DialogTitle>
                  <DialogDescription>
                    Set base PTO days for each department
                  </DialogDescription>
                </DialogHeader>
                <Form {...departmentForm}>
                  <form onSubmit={departmentForm.handleSubmit(onSubmitDepartment)} className="space-y-4">
                    <FormField
                      control={departmentForm.control}
                      name="department"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Department</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select department" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {departments.map(dept => (
                                <SelectItem key={dept} value={dept}>
                                  {dept}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={departmentForm.control}
                      name="vacationDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vacation Days</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={departmentForm.control}
                      name="sickDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sick Days</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={departmentForm.control}
                      name="personalDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Personal Days</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="bg-gray-50 p-3 rounded-md">
                      <p className="text-sm text-muted-foreground">
                        Total Days: {(departmentForm.watch('vacationDays') || 0) + (departmentForm.watch('sickDays') || 0) + (departmentForm.watch('personalDays') || 0)}
                      </p>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={updateDepartmentSettingMutation.isPending}>
                        {updateDepartmentSettingMutation.isPending ? 'Updating...' : 'Update Settings'}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            <Dialog open={isCustomizeDialogOpen} onOpenChange={setIsCustomizeDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Customize Policy
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Customize PTO Policy</DialogTitle>
                  <DialogDescription>
                    Adjust PTO allocation for individual employees
                  </DialogDescription>
                </DialogHeader>
                <Form {...policyForm}>
                  <form onSubmit={policyForm.handleSubmit(onSubmitPolicy)} className="space-y-4">
                    <FormField
                      control={policyForm.control}
                      name="employeeId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Employee</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select employee" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {(users as User[]).map((user: User) => (
                                <SelectItem key={user.id} value={user.id}>
                                  {user.firstName} {user.lastName} - {user.department}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={policyForm.control}
                      name="additionalDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Additional Days</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              onChange={e => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Extra PTO days beyond department base allocation
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={policyForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Reason for adjustment..."
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button type="submit" disabled={createPolicyMutation.isPending}>
                        {createPolicyMutation.isPending ? 'Saving...' : 'Save Policy'}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            {/* Edit Individual Policy Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Individual PTO Policy</DialogTitle>
                  <DialogDescription>
                    Update vacation, sick, and personal days for this employee
                  </DialogDescription>
                </DialogHeader>
                <Form {...editPolicyForm}>
                  <form onSubmit={editPolicyForm.handleSubmit(onSubmitEditPolicy)} className="space-y-4">
                    <FormField
                      control={editPolicyForm.control}
                      name="vacationDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vacation Days</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editPolicyForm.control}
                      name="sickDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sick Days</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editPolicyForm.control}
                      name="personalDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Personal Days</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editPolicyForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Reason for adjustment..."
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="bg-gray-50 p-3 rounded-md">
                      <p className="text-sm text-muted-foreground">
                        Total Days: {(editPolicyForm.watch('vacationDays') || 0) + (editPolicyForm.watch('sickDays') || 0) + (editPolicyForm.watch('personalDays') || 0)}
                      </p>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={updateIndividualPolicyMutation.isPending}>
                        {updateIndividualPolicyMutation.isPending ? 'Updating...' : 'Update Policy'}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {isFordBarsi && (
        <Alert className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>PTO Approval Authority</AlertTitle>
          <AlertDescription>
            As General Manager, you are the sole approver for all PTO requests across the organization.
            All PTO requests will be routed to you for final approval.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="by-department">By Department</TabsTrigger>
          <TabsTrigger value="individual">Individual Policies</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {canEdit && (policies as PtoPolicy[]).length < eligibleEmployees.length && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Missing PTO Policies</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <span>
                  {eligibleEmployees.length - (policies as PtoPolicy[]).length} employees don't have PTO policies configured.
                </span>
                <Button
                  onClick={() => initializePoliciesMutation.mutate()}
                  disabled={initializePoliciesMutation.isPending}
                  size="sm"
                  className="ml-4"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  {initializePoliciesMutation.isPending ? 'Initializing...' : 'Initialize All Policies'}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total PTO Days</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(policies as PtoPolicy[]).reduce((sum: number, p: PtoPolicy) => sum + p.totalDays, 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Across all employees
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Used PTO Days</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(policies as PtoPolicy[]).reduce((sum: number, p: PtoPolicy) => sum + p.usedDays, 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total days taken
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Remaining PTO</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(policies as PtoPolicy[]).reduce((sum: number, p: PtoPolicy) => sum + p.remainingDays, 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Available days
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Department Overview</CardTitle>
              <CardDescription>PTO allocation and usage by department</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-center">Employees</TableHead>
                    <TableHead className="text-center">Base Days</TableHead>
                    <TableHead className="text-center">Total Days</TableHead>
                    <TableHead className="text-center">Used Days</TableHead>
                    <TableHead className="text-center">Avg Used</TableHead>
                    <TableHead className="text-center">Remaining</TableHead>
                    {canEdit && <TableHead className="text-center">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departmentStats.map(stat => (
                    <TableRow key={stat.department}>
                      <TableCell className="font-medium">{stat.department}</TableCell>
                      <TableCell className="text-center">{stat.employeeCount}</TableCell>
                      <TableCell className="text-center">{stat.baseDays}</TableCell>
                      <TableCell className="text-center">{stat.totalDays}</TableCell>
                      <TableCell className="text-center">{stat.usedDays}</TableCell>
                      <TableCell className="text-center">{stat.averageUsed}</TableCell>
                      <TableCell className="text-center">{stat.remainingDays}</TableCell>
                      {canEdit && (
                        <TableCell className="text-center">
                          <Button
                            onClick={() => handleEditDepartmentSetting(stat.department)}
                            size="sm"
                            variant="outline"
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-department" className="space-y-4">
          {Object.entries(policiesByDepartment).map(([dept, deptPolicies]: [string, any]) => (
            <Card key={dept}>
              <CardHeader>
                <CardTitle>{dept}</CardTitle>
                <CardDescription>
                  {deptPolicies.length} employees
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead className="text-center">Base Days</TableHead>
                      <TableHead className="text-center">Additional Days</TableHead>
                      <TableHead className="text-center">Total Days</TableHead>
                      <TableHead className="text-center">Used</TableHead>
                      <TableHead className="text-center">Remaining</TableHead>
                      <TableHead>Customized By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deptPolicies.map((policy: any) => {
                      const customizer = policy.customizedBy ? 
                        (users as User[]).find((u: User) => u.id === policy.customizedBy) : null;
                      
                      return (
                        <TableRow key={policy.id}>
                          <TableCell className="font-medium">
                            {policy.user.firstName} {policy.user.lastName}
                          </TableCell>
                          <TableCell className="text-center">{policy.baseDays}</TableCell>
                          <TableCell className="text-center">
                            {policy.additionalDays > 0 && (
                              <Badge variant="secondary">+{policy.additionalDays}</Badge>
                            )}
                            {policy.additionalDays === 0 && '-'}
                          </TableCell>
                          <TableCell className="text-center">{policy.totalDays}</TableCell>
                          <TableCell className="text-center">{policy.usedDays}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={policy.remainingDays < 5 ? 'destructive' : 'default'}>
                              {policy.remainingDays}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {customizer ? (
                              <span className="text-sm text-muted-foreground">
                                {customizer.firstName} {customizer.lastName}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="individual" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Individual PTO Policies</CardTitle>
              <CardDescription>
                Detailed view of each employee's PTO allocation. Click on any row to edit individual policies.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-center">Vacation</TableHead>
                    <TableHead className="text-center">Sick</TableHead>
                    <TableHead className="text-center">Personal</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Used</TableHead>
                    <TableHead className="text-center">Remaining</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(policies as PtoPolicy[]).map((policy: PtoPolicy) => {
                    const user = (users as User[]).find((u: User) => u.id === policy.employeeId);
                    if (!user) return null;
                    
                    // Skip Sales/1099 employees - they're not eligible for PTO
                    if (user.employmentType === '1099') return null;
                    
                    return (
                      <TableRow key={policy.id}>
                        <TableCell className="font-medium">
                          {user.firstName} {user.lastName}
                        </TableCell>
                        <TableCell>{user.department || 'N/A'}</TableCell>
                        <TableCell className="text-center">{policy.vacationDays || 0}</TableCell>
                        <TableCell className="text-center">{policy.sickDays || 0}</TableCell>
                        <TableCell className="text-center">{policy.personalDays || 0}</TableCell>
                        <TableCell className="text-center font-semibold">{policy.totalDays}</TableCell>
                        <TableCell className="text-center">{policy.usedDays}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={policy.remainingDays < 5 ? 'destructive' : 'default'}>
                            {policy.remainingDays}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditPolicy(policy)}
                            >
                              <Edit2 className="h-4 w-4" />
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
      </Tabs>
    </div>
  );
}