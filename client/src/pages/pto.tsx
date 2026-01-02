import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, Plus, Check, X, Info, AlertCircle, Building, Users, User, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PtoCalendar } from '@/components/PtoCalendar';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/auth';
import { DEPARTMENTS } from '@/../../shared/constants/departments';
import { employeeGetsPto, ADMIN_ROLES } from '@shared/constants/roles';

const ptoSchema = z.object({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  type: z.enum(['VACATION', 'SICK', 'PERSONAL']).default('VACATION'),
  reason: z.string().min(1, "Reason is required"),
});

type PTOFormData = z.infer<typeof ptoSchema>;

const adminPtoSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  type: z.enum(['VACATION', 'SICK', 'PERSONAL']).default('VACATION'),
  reason: z.string().optional(),
});

type AdminPTOFormData = z.infer<typeof adminPtoSchema>;

function PTO() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState('requests');
  const [editingCompanyPolicy, setEditingCompanyPolicy] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<string | null>(null);
  const [editingEmployeePolicy, setEditingEmployeePolicy] = useState<string | null>(null);
  const [addingIndividual, setAddingIndividual] = useState(false);
  const [addingDepartment, setAddingDepartment] = useState(false);
  // Denial dialog state
  const [denyingRequestId, setDenyingRequestId] = useState<string | null>(null);
  const [denyNotes, setDenyNotes] = useState('');
  // Status filter for PTO requests
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'DENIED'>('ALL');
  // Admin PTO creation dialog
  const [adminPtoDialogOpen, setAdminPtoDialogOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [adminPtoAutoApprove, setAdminPtoAutoApprove] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Check if user is eligible for PTO
  const userGetsPto = employeeGetsPto({ department: user?.department, employmentType: user?.employmentType });

  // Check if user can edit PTO policies (Ford Barsi or Ahmed Admin)
  const canEditPolicies = user?.email === 'ford.barsi@theroofdocs.com' ||
                         user?.email === 'ahmed.mahmoud@theroofdocs.com' ||
                         user?.role === 'ADMIN';

  // Check if user is an admin (for showing policy tabs)
  const isAdmin = user?.role && ADMIN_ROLES.includes(user.role);

  // PTO Approvers - Only these users can approve/deny PTO requests
  const PTO_APPROVER_EMAILS = [
    'ford.barsi@theroofdocs.com',
    'ahmed.mahmoud@theroofdocs.com',
    'reese.samala@theroofdocs.com',
    'oliver.brown@theroofdocs.com'
  ];
  const canApprovePto = user?.email ? PTO_APPROVER_EMAILS.includes(user.email) : false;

  // Check if user is a manager/admin (to show full list vs personal list)
  const isManager = user?.role && ['ADMIN', 'SYSTEM_ADMIN', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'MANAGER'].includes(user.role);

  const { data: ptoRequests, isLoading } = useQuery({
    queryKey: ['/api/pto'],
    queryFn: async () => {
      const response = await fetch('/api/pto', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch PTO requests');
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

  const { data: settings } = useQuery({
    queryKey: ['/api/settings'],
    queryFn: async () => {
      const response = await fetch('/api/settings', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch settings');
      return response.json();
    }
  });
  
  // Fetch company-wide PTO policy
  const { data: companyPolicy } = useQuery({
    queryKey: ['/api/pto/company-policy'],
    queryFn: async () => {
      const response = await fetch('/api/pto/company-policy', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch company policy');
      return response.json();
    }
  });
  
  // Fetch department PTO settings
  const { data: departmentSettings } = useQuery({
    queryKey: ['/api/pto/department-settings'],
    queryFn: async () => {
      const response = await fetch('/api/pto/department-settings', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch department settings');
      return response.json();
    }
  });
  
  // Fetch individual PTO policies
  const { data: individualPolicies } = useQuery({
    queryKey: ['/api/pto/individual-policies'],
    queryFn: async () => {
      const response = await fetch('/api/pto/individual-policies', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch individual policies');
      return response.json();
    }
  });

  // Fetch current user's PTO balance (same endpoint as My Portal for consistency)
  const { data: myPtoBalance } = useQuery({
    queryKey: ['/api/employee-portal/pto-balance'],
    queryFn: async () => {
      const response = await fetch('/api/employee-portal/pto-balance', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch PTO balance');
      return response.json();
    }
  });

  const form = useForm<PTOFormData>({
    resolver: zodResolver(ptoSchema),
    defaultValues: {
      startDate: '',
      endDate: '',
      type: 'VACATION',
      reason: '',
    }
  });

  // Admin form for creating PTO on behalf of employees
  const adminForm = useForm<AdminPTOFormData>({
    resolver: zodResolver(adminPtoSchema),
    defaultValues: {
      employeeId: '',
      startDate: '',
      endDate: '',
      type: 'VACATION',
      reason: '',
    }
  });

  // Admin mutation for creating PTO on behalf of employees
  const adminCreatePTOMutation = useMutation({
    mutationFn: async (data: AdminPTOFormData & { autoApprove: boolean }) => {
      const response = await fetch('/api/admin/create-pto-for-employee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create PTO for employee');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/pto'] });
      setAdminPtoDialogOpen(false);
      adminForm.reset();
      setAdminPtoAutoApprove(true);
      toast({
        title: 'Success',
        description: data.message || 'PTO created successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create PTO',
        variant: 'destructive'
      });
    }
  });

  const onAdminSubmit = (data: AdminPTOFormData) => {
    adminCreatePTOMutation.mutate({ ...data, autoApprove: adminPtoAutoApprove });
  };

  // Helper to parse YYYY-MM-DD as local date (not UTC)
  const parseLocalDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const createPTOMutation = useMutation({
    mutationFn: async (data: PTOFormData) => {
      // Validate dates - parse as LOCAL time, not UTC
      const startDate = parseLocalDate(data.startDate);
      const endDate = parseLocalDate(data.endDate);

      if (startDate > endDate) {
        throw new Error('End date cannot be before start date');
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (startDate < today) {
        throw new Error('Start date cannot be in the past');
      }

      // Check for blackout dates
      if (settings?.ptoPolicy?.blackoutDates) {
        const blackoutDates = settings.ptoPolicy.blackoutDates;
        const requestedDates: string[] = [];
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
          requestedDates.push(format(currentDate, 'yyyy-MM-dd'));
          currentDate.setDate(currentDate.getDate() + 1);
        }

        const conflictingDates = requestedDates.filter(date =>
          blackoutDates.includes(date)
        );

        if (conflictingDates.length > 0) {
          throw new Error(`Request includes blackout dates: ${conflictingDates.join(', ')}. Please choose different dates.`);
        }
      }

      const timeDiff = endDate.getTime() - startDate.getTime();
      const days = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;

      const requestBody = {
        startDate: data.startDate,
        endDate: data.endDate,
        type: data.type,
        reason: data.reason,
        days
      };

      const response = await fetch('/api/pto', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create PTO request');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pto'] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: 'Success',
        description: 'PTO request submitted successfully'
      });
    },
    onError: (error: any) => {
      console.error('PTO mutation error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit PTO request',
        variant: 'destructive'
      });
    }
  });

  const updatePTOMutation = useMutation({
    mutationFn: async ({ id, status, reviewNotes }: { id: string; status: string; reviewNotes?: string }) => {
      const response = await fetch(`/api/pto/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status, reviewNotes })
      });
      if (!response.ok) throw new Error('Failed to update PTO request');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pto'] });
      toast({
        title: 'Success',
        description: 'PTO request updated successfully'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to update PTO request',
        variant: 'destructive'
      });
    }
  });

  const onSubmit = (data: PTOFormData) => {
    createPTOMutation.mutate(data);
  };

  const handleApprove = (id: string) => {
    updatePTOMutation.mutate({ id, status: 'APPROVED' });
  };

  const handleDeny = (id: string) => {
    setDenyingRequestId(id);
    setDenyNotes('');
  };

  const confirmDeny = () => {
    if (denyingRequestId) {
      updatePTOMutation.mutate({
        id: denyingRequestId,
        status: 'DENIED',
        reviewNotes: denyNotes.trim() || undefined
      });
      setDenyingRequestId(null);
      setDenyNotes('');
    }
  };

  // Add mutations for policy management (must be before any conditional returns)
  const updateCompanyPolicyMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/pto/company-policy', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update company policy');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pto/company-policy'] });
      setEditingCompanyPolicy(false);
      toast({
        title: 'Success',
        description: 'Company PTO policy updated successfully'
      });
    }
  });

  const updateDepartmentSettingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await fetch(`/api/pto/department-settings/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update department settings');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pto/department-settings'] });
      setEditingDepartment(null);
      toast({
        title: 'Success',
        description: 'Department PTO settings updated successfully'
      });
    }
  });

  const updateIndividualPolicyMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await fetch(`/api/pto/individual-policies/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update individual policy');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pto/individual-policies'] });
      setEditingEmployeePolicy(null);
      toast({
        title: 'Success',
        description: 'Individual PTO policy updated successfully'
      });
    }
  });

  // Add missing mutations for creating policies
  const createDepartmentSettingMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/pto/department-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create department settings');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pto/department-settings'] });
      setAddingDepartment(false);
      toast({
        title: 'Success',
        description: 'Department PTO settings created successfully'
      });
    }
  });

  const createIndividualPolicyMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/pto/individual-policies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create individual policy');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pto/individual-policies'] });
      setAddingIndividual(false);
      toast({
        title: 'Success',
        description: 'Individual PTO policy created successfully'
      });
    }
  });

  const getUserById = (id: string) => {
    return users?.find((user: any) => user.id === id);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'APPROVED': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'DENIED': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  // Helper function to calculate effective PTO for an employee
  const getEffectivePTO = (employee: any) => {
    // Sales/1099 contractors get 0 PTO unless manually overridden
    if (employee?.department === 'Sales' || employee?.employmentType === '1099') {
      // Check if there's an individual policy override
      const individualPolicy = individualPolicies?.find((p: any) => p.employeeId === employee.id);
      if (individualPolicy) {
        return {
          vacationDays: individualPolicy.vacationDays || 0,
          sickDays: individualPolicy.sickDays || 0,
          personalDays: individualPolicy.personalDays || 0,
          totalDays: individualPolicy.totalDays || 0,
          source: 'individual'
        };
      }
      // No PTO for Sales/1099 by default
      return {
        vacationDays: 0,
        sickDays: 0,
        personalDays: 0,
        totalDays: 0,
        source: 'none (Sales/1099)'
      };
    }

    // Check for individual policy override first
    const individualPolicy = individualPolicies?.find((p: any) => p.employeeId === employee?.id);
    if (individualPolicy) {
      return {
        vacationDays: individualPolicy.vacationDays || 0,
        sickDays: individualPolicy.sickDays || 0,
        personalDays: individualPolicy.personalDays || 0,
        totalDays: individualPolicy.totalDays || 0,
        source: 'individual'
      };
    }

    // Check for department policy
    const deptSetting = departmentSettings?.find((d: any) => d.department === employee?.department);
    if (deptSetting && deptSetting.overridesCompany) {
      return {
        vacationDays: deptSetting.vacationDays || 0,
        sickDays: deptSetting.sickDays || 0,
        personalDays: deptSetting.personalDays || 0,
        totalDays: (deptSetting.vacationDays || 0) + (deptSetting.sickDays || 0) + (deptSetting.personalDays || 0),
        source: 'department'
      };
    }

    // Fall back to company policy
    if (companyPolicy) {
      return {
        vacationDays: companyPolicy.vacationDays || 0,
        sickDays: companyPolicy.sickDays || 0,
        personalDays: companyPolicy.personalDays || 0,
        totalDays: companyPolicy.totalDays || 0,
        source: 'company'
      };
    }

    // No policy defined
    return {
      vacationDays: 0,
      sickDays: 0,
      personalDays: 0,
      totalDays: 0,
      source: 'none'
    };
  };

  if (isLoading) {
    return <div className="p-8">Loading PTO requests...</div>;
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-secondary-950 dark:text-white">PTO Management</h1>
        <p className="mt-2 text-sm text-secondary-600 dark:text-gray-400">
          Manage time off requests and PTO policies at company, department, and individual levels
        </p>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-4' : 'grid-cols-1'}`}>
          <TabsTrigger value="requests">PTO Requests</TabsTrigger>
          {isAdmin && (
            <>
              <TabsTrigger value="company" disabled={!canEditPolicies}>
                <Building className="w-4 h-4 mr-2" />
                Company Policy
              </TabsTrigger>
              <TabsTrigger value="department" disabled={!canEditPolicies}>
                <Users className="w-4 h-4 mr-2" />
                Department Policies
              </TabsTrigger>
              <TabsTrigger value="individual" disabled={!canEditPolicies}>
                <User className="w-4 h-4 mr-2" />
                Individual Policies
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* PTO Requests Tab */}
        <TabsContent value="requests" className="space-y-4">
          {/* Your PTO Balance - same calculation as My Portal */}
          {myPtoBalance && (
            <Card className="mb-6 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                  <Calendar className="h-5 w-5" />
                  Your PTO Balance ({new Date().getFullYear()})
                </CardTitle>
                <CardDescription>
                  Time off you've used and have remaining this year
                  {myPtoBalance.policySource && (
                    <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                      Policy: {myPtoBalance.policySource}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground">Vacation</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {myPtoBalance.remainingVacation}/{myPtoBalance.vacationDays}
                    </p>
                    <p className="text-xs text-muted-foreground">remaining</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground">Sick</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {myPtoBalance.remainingSick}/{myPtoBalance.sickDays}
                    </p>
                    <p className="text-xs text-muted-foreground">remaining</p>
                  </div>
                  <div className="text-center p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground">Personal</p>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {myPtoBalance.remainingPersonal}/{myPtoBalance.personalDays}
                    </p>
                    <p className="text-xs text-muted-foreground">remaining</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                      {myPtoBalance.remainingDays}/{myPtoBalance.totalDays}
                    </p>
                    <p className="text-xs text-muted-foreground">remaining</p>
                  </div>
                </div>
                {myPtoBalance.pendingDays > 0 && (
                  <Alert className="mt-4 border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
                    <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                      You have <strong>{myPtoBalance.pendingDays} day(s)</strong> pending approval
                    </AlertDescription>
                  </Alert>
                )}
                {/* Soft enforcement reminder for 5 days in Jan/Feb/Dec */}
                <Alert className="mt-4 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertDescription className="text-amber-800 dark:text-amber-200">
                    <strong>Reminder:</strong> You must use 5 PTO days during January, February, or December each year.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {/* PTO Policy Information */}
          {companyPolicy && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              PTO Policy Information
            </CardTitle>
            <CardDescription>
              Current company-wide policy for paid time off requests
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Vacation Days</p>
                <p className="text-2xl font-bold">{companyPolicy.vacationDays} days</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sick Days</p>
                <p className="text-2xl font-bold">{companyPolicy.sickDays} days</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Personal Days</p>
                <p className="text-2xl font-bold">{companyPolicy.personalDays} days</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm font-medium text-muted-foreground">Total Annual PTO</p>
              <p className="text-3xl font-bold text-primary">{companyPolicy.totalDays} days</p>
            </div>
            
            {/* Check for department-specific policy */}
            {user && departmentSettings?.find((d: any) => d.department === user.department) && (
              <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-800 dark:text-blue-200">
                  <strong>Note:</strong> Your department has a custom PTO policy that overrides the company policy.
                </AlertDescription>
              </Alert>
            )}

            {/* Check for individual policy */}
            {user && individualPolicies?.find((p: any) => p.employeeId === user.id) && (
              <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                <Info className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  <strong>Note:</strong> You have a custom individual PTO policy that overrides department and company policies.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-secondary-950 dark:text-white">PTO Requests</h1>
          <p className="mt-2 text-sm text-secondary-600 dark:text-gray-400">
            Manage time off requests and approvals
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          {!userGetsPto ? (
            <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                <strong>PTO is not available for your role.</strong>
                {user?.department === 'Sales' ? ' Sales employees are 1099 contractors and do not receive PTO.' :
                 user?.employmentType && ['1099', 'CONTRACTOR', 'SUB_CONTRACTOR'].includes(user.employmentType) ? ' Contractors do not receive PTO benefits.' :
                 ' Please contact HR for more information.'}
              </AlertDescription>
            </Alert>
          ) : (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Request PTO
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Time Off</DialogTitle>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    {...form.register('startDate')}
                  />
                </div>

                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    {...form.register('endDate')}
                  />
                </div>

                <div>
                  <Label htmlFor="type">Type of Time Off</Label>
                  <Select
                    value={form.watch('type')}
                    onValueChange={(value: 'VACATION' | 'SICK' | 'PERSONAL') => form.setValue('type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VACATION">Vacation</SelectItem>
                      <SelectItem value="SICK">Sick</SelectItem>
                      <SelectItem value="PERSONAL">Personal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="reason">Reason</Label>
                  <Textarea
                    id="reason"
                    {...form.register('reason')}
                    placeholder="Please provide a reason for your time off request"
                  />
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createPTOMutation.isPending}>
                    {createPTOMutation.isPending ? 'Submitting...' : 'Submit Request'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          )}

          {/* Admin: Create PTO for Employee - Only Oliver, Ford, Reese, Ahmed */}
          {canApprovePto && (
            <Dialog open={adminPtoDialogOpen} onOpenChange={setAdminPtoDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="ml-2">
                  <Users className="w-4 h-4 mr-2" />
                  Add PTO for Employee
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create PTO for Employee</DialogTitle>
                </DialogHeader>
                <form onSubmit={adminForm.handleSubmit(onAdminSubmit)} className="space-y-4">
                  <div>
                    <Label htmlFor="admin-employee">Employee</Label>
                    <Select
                      value={adminForm.watch('employeeId')}
                      onValueChange={(value) => adminForm.setValue('employeeId', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {users?.filter((u: any) => u.isActive).map((u: any) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.firstName} {u.lastName} ({u.department || 'No Dept'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="admin-startDate">Start Date</Label>
                      <Input
                        id="admin-startDate"
                        type="date"
                        {...adminForm.register('startDate')}
                      />
                    </div>
                    <div>
                      <Label htmlFor="admin-endDate">End Date</Label>
                      <Input
                        id="admin-endDate"
                        type="date"
                        {...adminForm.register('endDate')}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="admin-type">Type of Time Off</Label>
                    <Select
                      value={adminForm.watch('type')}
                      onValueChange={(value: 'VACATION' | 'SICK' | 'PERSONAL') => adminForm.setValue('type', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="VACATION">Vacation</SelectItem>
                        <SelectItem value="SICK">Sick</SelectItem>
                        <SelectItem value="PERSONAL">Personal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="admin-reason">Reason (Optional)</Label>
                    <Textarea
                      id="admin-reason"
                      {...adminForm.register('reason')}
                      placeholder="Reason for PTO"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="auto-approve"
                      checked={adminPtoAutoApprove}
                      onCheckedChange={setAdminPtoAutoApprove}
                    />
                    <Label htmlFor="auto-approve" className="cursor-pointer">
                      Auto-approve (creates calendar events immediately)
                    </Label>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setAdminPtoDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={adminCreatePTOMutation.isPending}>
                      {adminCreatePTOMutation.isPending ? 'Creating...' : 'Create PTO'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* PTO Requests Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle>{isManager ? 'All PTO Requests' : 'My PTO Requests'}</CardTitle>
            {/* Status Filter Bar */}
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant={statusFilter === 'ALL' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('ALL')}
              >
                All
              </Button>
              <Button
                size="sm"
                variant={statusFilter === 'PENDING' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('PENDING')}
                className={statusFilter === 'PENDING' ? '' : 'border-yellow-300 text-yellow-700 hover:bg-yellow-50'}
              >
                Pending
              </Button>
              <Button
                size="sm"
                variant={statusFilter === 'APPROVED' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('APPROVED')}
                className={statusFilter === 'APPROVED' ? 'bg-green-600 hover:bg-green-700' : 'border-green-300 text-green-700 hover:bg-green-50'}
              >
                Approved
              </Button>
              <Button
                size="sm"
                variant={statusFilter === 'DENIED' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('DENIED')}
                className={statusFilter === 'DENIED' ? 'bg-red-600 hover:bg-red-700' : 'border-red-300 text-red-700 hover:bg-red-50'}
              >
                Denied
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Employee</th>
                  <th className="text-left py-3 px-4">Dates</th>
                  <th className="text-left py-3 px-4">Days</th>
                  <th className="text-left py-3 px-4">Type</th>
                  <th className="text-left py-3 px-4">Reason</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ptoRequests
                  ?.filter((request: any) => statusFilter === 'ALL' || request.status === statusFilter)
                  .map((request: any) => {
                  const employee = getUserById(request.employeeId);
                  return (
                    <tr key={request.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-secondary-200 dark:bg-gray-700 rounded-full flex items-center justify-center mr-3">
                            <span className="text-xs font-medium text-secondary-700 dark:text-gray-200">
                              {employee?.firstName?.[0]}{employee?.lastName?.[0]}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">{employee?.firstName} {employee?.lastName}</div>
                            <div className="text-sm text-secondary-500 dark:text-gray-400">{employee?.position}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">{request.days}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className={
                          request.type === 'VACATION' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          request.type === 'SICK' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          'bg-purple-50 text-purple-700 border-purple-200'
                        }>
                          {request.type || 'VACATION'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">{request.reason}</td>
                      <td className="py-3 px-4">
                        <Badge className={getStatusColor(request.status)}>
                          {request.status}
                        </Badge>
                        {request.status === 'DENIED' && request.reviewNotes && (
                          <div className="text-red-600 dark:text-red-400 text-sm mt-1">
                            <span className="font-medium">Reason:</span> {request.reviewNotes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {request.status === 'PENDING' && canApprovePto && (
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleApprove(request.id)}
                              disabled={updatePTOMutation.isPending}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeny(request.id)}
                              disabled={updatePTOMutation.isPending}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Deny
                            </Button>
                          </div>
                        )}
                        {request.status === 'PENDING' && !canApprovePto && (
                          <span className="text-sm text-muted-foreground">Pending approval</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* PTO Calendar */}
      <div className="mt-8">
        <PtoCalendar />
      </div>
    </TabsContent>

    {/* Company Policy Tab */}
    <TabsContent value="company" className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Company-Wide PTO Policy
            </span>
            {canEditPolicies && !editingCompanyPolicy && (
              <Button
                size="sm"
                onClick={() => setEditingCompanyPolicy(true)}
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Policy
              </Button>
            )}
          </CardTitle>
          <CardDescription>
            Base policy that applies to all employees company-wide
          </CardDescription>
        </CardHeader>
        <CardContent>
          {editingCompanyPolicy ? (
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const data = {
                vacationDays: parseInt(formData.get('vacationDays') as string),
                sickDays: parseInt(formData.get('sickDays') as string),
                personalDays: parseInt(formData.get('personalDays') as string),
                totalDays: parseInt(formData.get('vacationDays') as string) +
                          parseInt(formData.get('sickDays') as string) +
                          parseInt(formData.get('personalDays') as string),
                accrualRate: formData.get('accrualRate') as string || 'MONTHLY',
                waitingPeriodDays: parseInt(formData.get('waitingPeriodDays') as string) || 90,
                lastUpdatedBy: user?.id
              };
              updateCompanyPolicyMutation.mutate(data);
            }} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="vacationDays">Vacation Days</Label>
                  <Input
                    id="vacationDays"
                    name="vacationDays"
                    type="number"
                    defaultValue={companyPolicy?.vacationDays || 5}
                    min="0"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="sickDays">Sick Days</Label>
                  <Input 
                    id="sickDays" 
                    name="sickDays" 
                    type="number" 
                    defaultValue={companyPolicy?.sickDays || 5}
                    min="0"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="personalDays">Personal Days</Label>
                  <Input
                    id="personalDays"
                    name="personalDays"
                    type="number"
                    defaultValue={companyPolicy?.personalDays || 2}
                    min="0"
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="accrualRate">Accrual Rate</Label>
                  <Select name="accrualRate" defaultValue={companyPolicy?.accrualRate || 'MONTHLY'}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="YEARLY">Yearly</SelectItem>
                      <SelectItem value="PER_PAY_PERIOD">Per Pay Period</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="waitingPeriodDays">Waiting Period (Days)</Label>
                  <Input 
                    id="waitingPeriodDays" 
                    name="waitingPeriodDays" 
                    type="number" 
                    defaultValue={companyPolicy?.waitingPeriodDays || 90}
                    min="0"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingCompanyPolicy(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  Save Policy
                </Button>
              </div>
            </form>
          ) : (
            companyPolicy ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Vacation Days</Label>
                    <p className="text-2xl font-bold">{companyPolicy.vacationDays} days</p>
                  </div>
                  <div>
                    <Label>Sick Days</Label>
                    <p className="text-2xl font-bold">{companyPolicy.sickDays} days</p>
                  </div>
                  <div>
                    <Label>Personal Days</Label>
                    <p className="text-2xl font-bold">{companyPolicy.personalDays} days</p>
                  </div>
                </div>
                <div>
                  <Label>Total Annual PTO</Label>
                  <p className="text-3xl font-bold text-primary">{companyPolicy.totalDays} days</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-muted-foreground">No company policy defined yet.</p>
                {canEditPolicies && (
                  <Button onClick={() => setEditingCompanyPolicy(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Company Policy
                  </Button>
                )}
              </div>
            )
          )}
        </CardContent>
      </Card>
    </TabsContent>

    {/* Department Policies Tab */}
    <TabsContent value="department" className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Department PTO Settings
            </span>
            {canEditPolicies && !addingDepartment && (
              <Button
                size="sm"
                onClick={() => setAddingDepartment(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Department
              </Button>
            )}
          </CardTitle>
          <CardDescription>
            Override company policy for specific departments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {addingDepartment && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="text-lg">Add Department Policy</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const departmentValue = (e.currentTarget.querySelector('[name="department"]') as HTMLInputElement)?.value;
                  const data = {
                    department: departmentValue,
                    vacationDays: parseInt(formData.get('vacationDays') as string),
                    sickDays: parseInt(formData.get('sickDays') as string),
                    personalDays: parseInt(formData.get('personalDays') as string),
                    totalDays: parseInt(formData.get('vacationDays') as string) + 
                              parseInt(formData.get('sickDays') as string) + 
                              parseInt(formData.get('personalDays') as string),
                    overridesCompany: true
                  };
                  createDepartmentSettingMutation.mutate(data);
                }} className="space-y-4">
                  <div>
                    <Label htmlFor="department">Department</Label>
                    <input type="hidden" name="department" />
                    <Select onValueChange={(value) => {
                      const input = document.querySelector('[name="department"]') as HTMLInputElement;
                      if (input) input.value = value;
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a department" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map((dept) => (
                          <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="vacationDays">Vacation Days</Label>
                      <Input 
                        id="vacationDays"
                        name="vacationDays" 
                        type="number" 
                        defaultValue="10"
                        min="0"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="sickDays">Sick Days</Label>
                      <Input 
                        id="sickDays"
                        name="sickDays" 
                        type="number" 
                        defaultValue="5"
                        min="0"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="personalDays">Personal Days</Label>
                      <Input 
                        id="personalDays"
                        name="personalDays" 
                        type="number" 
                        defaultValue="3"
                        min="0"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setAddingDepartment(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">
                      Add Department Policy
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
          {departmentSettings && departmentSettings.length > 0 ? (
            <div className="space-y-4">
              {departmentSettings.map((dept: any) => (
                <Card key={dept.id}>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      {dept.department}
                      {canEditPolicies && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingDepartment(dept.id)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {editingDepartment === dept.id ? (
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const data = {
                          vacationDays: parseInt(formData.get('vacationDays') as string),
                          sickDays: parseInt(formData.get('sickDays') as string),
                          personalDays: parseInt(formData.get('personalDays') as string),
                          totalDays: parseInt(formData.get('vacationDays') as string) + 
                                    parseInt(formData.get('sickDays') as string) + 
                                    parseInt(formData.get('personalDays') as string),
                          overridesCompany: true
                        };
                        updateDepartmentSettingMutation.mutate({ id: dept.id, data });
                      }} className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label htmlFor={`vacation-${dept.id}`}>Vacation Days</Label>
                            <Input 
                              id={`vacation-${dept.id}`}
                              name="vacationDays" 
                              type="number" 
                              defaultValue={dept.vacationDays}
                              min="0"
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor={`sick-${dept.id}`}>Sick Days</Label>
                            <Input 
                              id={`sick-${dept.id}`}
                              name="sickDays" 
                              type="number" 
                              defaultValue={dept.sickDays}
                              min="0"
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor={`personal-${dept.id}`}>Personal Days</Label>
                            <Input 
                              id={`personal-${dept.id}`}
                              name="personalDays" 
                              type="number" 
                              defaultValue={dept.personalDays}
                              min="0"
                              required
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setEditingDepartment(null)}
                          >
                            Cancel
                          </Button>
                          <Button type="submit">Save</Button>
                        </div>
                      </form>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <Label>Vacation</Label>
                            <p className="font-semibold">{dept.vacationDays || 0} days</p>
                          </div>
                          <div>
                            <Label>Sick</Label>
                            <p className="font-semibold">{dept.sickDays || 0} days</p>
                          </div>
                          <div>
                            <Label>Personal</Label>
                            <p className="font-semibold">{dept.personalDays || 0} days</p>
                          </div>
                          <div>
                            <Label>Total</Label>
                            <p className="font-semibold text-primary">
                              {(dept.vacationDays || 0) + (dept.sickDays || 0) + (dept.personalDays || 0)} days
                            </p>
                          </div>
                        </div>
                        {dept.department === 'Sales' && (
                          <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
                            Note: Sales employees are 1099 contractors and do not receive PTO unless individually assigned
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No department-specific policies defined.</p>
          )}
        </CardContent>
      </Card>
    </TabsContent>

    {/* Individual Policies Tab */}
    <TabsContent value="individual" className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Individual Employee PTO Policies
            </span>
            {canEditPolicies && (
              <Button
                size="sm"
                onClick={() => setAddingIndividual(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Individual Policy
              </Button>
            )}
          </CardTitle>
          <CardDescription>
            Custom PTO allocations for specific employees
          </CardDescription>
        </CardHeader>
        <CardContent>
          {addingIndividual && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="text-lg">New Individual Policy</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const employeeIdValue = (e.currentTarget.querySelector('[name="employeeId"]') as HTMLInputElement)?.value;
                  const data = {
                    employeeId: employeeIdValue,
                    vacationDays: parseInt(formData.get('vacationDays') as string),
                    sickDays: parseInt(formData.get('sickDays') as string),
                    personalDays: parseInt(formData.get('personalDays') as string),
                    totalDays: parseInt(formData.get('vacationDays') as string) + 
                              parseInt(formData.get('sickDays') as string) + 
                              parseInt(formData.get('personalDays') as string),
                    reason: formData.get('reason') as string,
                    effectiveDate: new Date().toISOString()
                  };
                  createIndividualPolicyMutation.mutate(data);
                }} className="space-y-4">
                  <div>
                    <Label htmlFor="employeeId">Employee</Label>
                    <input type="hidden" name="employeeId" />
                    <Select onValueChange={(value) => {
                      const input = document.querySelector('[name="employeeId"]') as HTMLInputElement;
                      if (input) input.value = value;
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {users?.map((user: any) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.firstName} {user.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="new-ind-vacation">Vacation Days</Label>
                      <Input 
                        id="new-ind-vacation"
                        name="vacationDays" 
                        type="number" 
                        defaultValue="10"
                        min="0"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="new-ind-sick">Sick Days</Label>
                      <Input 
                        id="new-ind-sick"
                        name="sickDays" 
                        type="number" 
                        defaultValue="5"
                        min="0"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="new-ind-personal">Personal Days</Label>
                      <Input 
                        id="new-ind-personal"
                        name="personalDays" 
                        type="number" 
                        defaultValue="3"
                        min="0"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="reason">Reason for Custom Policy</Label>
                    <Input 
                      id="reason"
                      name="reason" 
                      placeholder="e.g., Senior position, retention bonus, etc."
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setAddingIndividual(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">Create Policy</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {individualPolicies && individualPolicies.length > 0 ? (
            <div className="space-y-4">
              {individualPolicies.map((policy: any) => {
                const employee = getUserById(policy.employeeId);
                return (
                  <Card key={policy.id}>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center justify-between">
                        {employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown Employee'}
                        {canEditPolicies && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingEmployeePolicy(policy.id)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {editingEmployeePolicy === policy.id ? (
                        <form onSubmit={(e) => {
                          e.preventDefault();
                          const formData = new FormData(e.currentTarget);
                          const data = {
                            vacationDays: parseInt(formData.get('vacationDays') as string),
                            sickDays: parseInt(formData.get('sickDays') as string),
                            personalDays: parseInt(formData.get('personalDays') as string),
                            totalDays: parseInt(formData.get('vacationDays') as string) + 
                                      parseInt(formData.get('sickDays') as string) + 
                                      parseInt(formData.get('personalDays') as string),
                            reason: formData.get('reason') as string
                          };
                          updateIndividualPolicyMutation.mutate({ id: policy.id, data });
                        }} className="space-y-4">
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <Label htmlFor={`ind-vacation-${policy.id}`}>Vacation Days</Label>
                              <Input 
                                id={`ind-vacation-${policy.id}`}
                                name="vacationDays" 
                                type="number" 
                                defaultValue={policy.vacationDays || 10}
                                min="0"
                                required
                              />
                            </div>
                            <div>
                              <Label htmlFor={`ind-sick-${policy.id}`}>Sick Days</Label>
                              <Input 
                                id={`ind-sick-${policy.id}`}
                                name="sickDays" 
                                type="number" 
                                defaultValue={policy.sickDays || 5}
                                min="0"
                                required
                              />
                            </div>
                            <div>
                              <Label htmlFor={`ind-personal-${policy.id}`}>Personal Days</Label>
                              <Input 
                                id={`ind-personal-${policy.id}`}
                                name="personalDays" 
                                type="number" 
                                defaultValue={policy.personalDays || 3}
                                min="0"
                                required
                              />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor={`reason-${policy.id}`}>Reason</Label>
                            <Input 
                              id={`reason-${policy.id}`}
                              name="reason" 
                              defaultValue={policy.reason || ''}
                              placeholder="Reason for custom policy"
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button 
                              type="button" 
                              variant="outline" 
                              onClick={() => setEditingEmployeePolicy(null)}
                            >
                              Cancel
                            </Button>
                            <Button type="submit">Save</Button>
                          </div>
                        </form>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-4 gap-4">
                            <div>
                              <Label>Vacation</Label>
                              <p className="font-semibold">{policy.vacationDays || policy.baseDays || 0} days</p>
                            </div>
                            <div>
                              <Label>Sick</Label>
                              <p className="font-semibold">{policy.sickDays || 0} days</p>
                            </div>
                            <div>
                              <Label>Personal</Label>
                              <p className="font-semibold">{policy.personalDays || 0} days</p>
                            </div>
                            <div>
                              <Label>Total</Label>
                              <p className="font-semibold text-primary">{policy.totalDays || 0} days</p>
                            </div>
                          </div>
                          {policy.reason && (
                            <div>
                              <Label>Reason</Label>
                              <p className="text-sm text-muted-foreground">{policy.reason}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground">No individual employee policies defined.</p>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  </Tabs>

      {/* Denial Notes Dialog */}
      <Dialog open={!!denyingRequestId} onOpenChange={(open) => !open && setDenyingRequestId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <X className="w-5 h-5 text-red-500" />
              Deny PTO Request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to deny this PTO request? You can optionally add a note explaining the reason.
            </p>
            <div>
              <Label htmlFor="denyNotes">Denial Note (optional)</Label>
              <Textarea
                id="denyNotes"
                placeholder="e.g., Coverage conflict, busy period, short notice..."
                value={denyNotes}
                onChange={(e) => setDenyNotes(e.target.value)}
                className="mt-2"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDenyingRequestId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeny}
                disabled={updatePTOMutation.isPending}
              >
                <X className="w-4 h-4 mr-1" />
                Deny Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PTO;
