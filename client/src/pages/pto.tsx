import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, Plus, Check, X, Info, AlertCircle, Building, Users, User, Edit, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PtoCalendar } from '@/components/PtoCalendar';
import { format } from 'date-fns';
import { ALL_HOLIDAYS } from '@shared/constants/holidays';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/auth';
import { DEPARTMENTS } from '@/../../shared/constants/departments';
import { employeeGetsPto, ADMIN_ROLES, PTO_APPROVER_EMAILS, PTO_DEPARTMENT_APPROVERS } from '@shared/constants/roles';
import { PTO_POLICY } from '@shared/constants/pto-policy';
import { apiRequest } from '@/lib/queryClient';
import { apiRequest } from '@/lib/queryClient';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ptoSchema = z.object({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  type: z.enum(['VACATION', 'SICK', 'PERSONAL']).default('VACATION'),
  reason: z.string().min(1, "Reason is required"),
  halfDay: z.boolean().optional().default(false),
  halfDayPeriod: z.enum(['AM', 'PM']).optional(),
});

type PTOFormData = z.infer<typeof ptoSchema>;

const adminPtoSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  type: z.enum(['VACATION', 'SICK', 'PERSONAL']).default('VACATION'),
  reason: z.string().optional(),
  halfDay: z.boolean().optional().default(false),
  halfDayPeriod: z.enum(['AM', 'PM']).optional(),
});

type AdminPTOFormData = z.infer<typeof adminPtoSchema>;
type HolidayEntry = { date: string; name: string };

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
  const [timeFilter, setTimeFilter] = useState<'ALL' | 'PAST' | 'FUTURE'>('ALL');
  const [analyticsStartDate, setAnalyticsStartDate] = useState(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    return format(start, 'yyyy-MM-dd');
  });
  const [analyticsEndDate, setAnalyticsEndDate] = useState(() => {
    const now = new Date();
    const end = new Date(now.getFullYear(), 11, 31);
    return format(end, 'yyyy-MM-dd');
  });
  const [analyticsEmployeeId, setAnalyticsEmployeeId] = useState('ALL');
  const [holidayDraft, setHolidayDraft] = useState<HolidayEntry[]>([]);
  const [holidayDateInput, setHolidayDateInput] = useState('');
  const [holidayNameInput, setHolidayNameInput] = useState('');
  // Admin PTO creation dialog
  const [adminPtoDialogOpen, setAdminPtoDialogOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [adminPtoAutoApprove, setAdminPtoAutoApprove] = useState(true);
  const [adminEmployeeSearch, setAdminEmployeeSearch] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<any | null>(null);
  const [editKeepApproved, setEditKeepApproved] = useState(true);
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
  const isCoreApprover = user?.email ? PTO_APPROVER_EMAILS.includes(user.email) : false;
  const deptApproverEntry = user?.email
    ? PTO_DEPARTMENT_APPROVERS.find((entry) => entry.email.toLowerCase() === user.email.toLowerCase())
    : null;
  const canApprovePto = isCoreApprover || !!deptApproverEntry;
  const isDepartmentApprover = !!deptApproverEntry;
  const showAnalytics = canApprovePto;

  // Check if user is a manager/admin (to show full list vs personal list)
  const isManager = user?.role && ['ADMIN', 'SYSTEM_ADMIN', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'MANAGER'].includes(user.role);
  const tabsGridClass = isAdmin
    ? (showAnalytics ? 'grid-cols-5' : 'grid-cols-4')
    : (showAnalytics ? 'grid-cols-2' : 'grid-cols-1');

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
    },
    refetchInterval: 60000,
    refetchOnWindowFocus: true
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
    },
    refetchInterval: 300000,
    refetchOnWindowFocus: true
  });

  const adminEligibleEmployees = (users || []).filter((u: any) => {
    if (!u?.isActive) return false;
    return employeeGetsPto({ department: u.department, employmentType: u.employmentType });
  });

  const filteredAdminEmployees = adminEligibleEmployees.filter((u: any) => {
    if (!adminEmployeeSearch.trim()) return true;
    const search = adminEmployeeSearch.trim().toLowerCase();
    const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
    return (
      fullName.includes(search) ||
      (u.email || '').toLowerCase().includes(search) ||
      (u.department || '').toLowerCase().includes(search)
    );
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
      halfDay: false,
      halfDayPeriod: 'AM',
    }
  });

  const editForm = useForm<PTOFormData>({
    resolver: zodResolver(ptoSchema),
    defaultValues: {
      startDate: '',
      endDate: '',
      type: 'VACATION',
      reason: '',
      halfDay: false,
      halfDayPeriod: 'AM',
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
      halfDay: false,
      halfDayPeriod: 'AM',
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

  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseHolidaySchedule = (raw?: string | null): HolidayEntry[] => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((entry: any) => typeof entry?.date === 'string')
        .map((entry: any) => ({
          date: entry.date,
          name: typeof entry?.name === 'string' ? entry.name : 'Company Holiday'
        }));
    } catch (error) {
      console.error('[PTO] Failed to parse holidaySchedule JSON:', error);
      return [];
    }
  };

  const holidaySchedule = useMemo(() => parseHolidaySchedule(companyPolicy?.holidaySchedule), [companyPolicy]);
  const fallbackHolidayEntries = useMemo(
    () => ALL_HOLIDAYS.map((holiday) => ({ date: holiday.date, name: holiday.name })),
    []
  );
  const holidayDateSet = useMemo(() => {
    const source = holidaySchedule.length ? holidaySchedule : fallbackHolidayEntries;
    return new Set(source.map((holiday) => holiday.date));
  }, [holidaySchedule]);

  useEffect(() => {
    const source = holidaySchedule.length ? holidaySchedule : fallbackHolidayEntries;
    setHolidayDraft(source);
  }, [companyPolicy?.holidaySchedule, holidaySchedule, fallbackHolidayEntries]);

  const sortedHolidayDraft = useMemo(
    () => [...holidayDraft].sort((a, b) => a.date.localeCompare(b.date)),
    [holidayDraft]
  );

  const isBusinessDay = (date: Date): boolean => {
    const day = date.getDay();
    if (day === 0 || day === 6) return false;
    return !holidayDateSet.has(formatLocalDate(date));
  };

  const countBusinessDaysBetween = (start: Date, end: Date): number => {
    const current = new Date(start);
    const endDate = new Date(end);
    current.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    let days = 0;

    while (current <= endDate) {
      if (isBusinessDay(current)) days++;
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const halfDaySuffixRegex = /\(?\s*half[-\s]?day\s*(AM|PM)?\s*\)?/i;
  const extractHalfDayPeriod = (reason?: string) => {
    if (!reason) return null;
    const match = reason.match(/\bhalf[-\s]?day\b.*\b(AM|PM)\b/i) || reason.match(/\b(AM|PM)\b\s*half[-\s]?day/i);
    if (!match) return null;
    const period = match[1]?.toUpperCase();
    return period === 'AM' || period === 'PM' ? period : null;
  };
  const stripHalfDaySuffix = (reason?: string) => {
    if (!reason) return '';
    return reason.replace(halfDaySuffixRegex, '').trim();
  };
  const appendHalfDaySuffix = (reason: string, period: 'AM' | 'PM' | undefined) => {
    const normalizedReason = (reason || '').trim();
    if (halfDaySuffixRegex.test(normalizedReason)) return normalizedReason;
    const suffix = period ? `Half-day ${period}` : 'Half-day';
    return normalizedReason ? `${normalizedReason} (${suffix})` : suffix;
  };

  const watchedStartDate = form.watch('startDate');
  const watchedEndDate = form.watch('endDate');
  const watchedHalfDay = form.watch('halfDay');

  useEffect(() => {
    if (watchedHalfDay && watchedStartDate) {
      if (watchedEndDate !== watchedStartDate) {
        form.setValue('endDate', watchedStartDate);
      }
    }
  }, [watchedHalfDay, watchedStartDate, watchedEndDate, form]);

  const watchedEditStart = editForm.watch('startDate');
  const watchedEditEnd = editForm.watch('endDate');
  const watchedEditHalfDay = editForm.watch('halfDay');

  useEffect(() => {
    if (watchedEditHalfDay && watchedEditStart) {
      if (watchedEditEnd !== watchedEditStart) {
        editForm.setValue('endDate', watchedEditStart);
      }
    }
  }, [watchedEditHalfDay, watchedEditStart, watchedEditEnd, editForm]);

  const businessDaysPreview = useMemo(() => {
    if (!watchedStartDate || !watchedEndDate) return null;
    const start = parseLocalDate(watchedStartDate);
    const end = parseLocalDate(watchedEndDate);
    if (start > end) {
      return { days: 0, error: 'End date cannot be before start date' };
    }
    if (watchedHalfDay) {
      if (watchedStartDate !== watchedEndDate) {
        return { days: 0, error: 'Half-day requests must be for a single date' };
      }
      const valid = isBusinessDay(start);
      return { days: valid ? 0.5 : 0, error: valid ? null : 'Selected date is not a business day' };
    }
    const days = countBusinessDaysBetween(start, end);
    return { days, error: days === 0 ? 'Selected range has no business days' : null };
  }, [watchedStartDate, watchedEndDate, watchedHalfDay]);

  const createPTOMutation = useMutation({
    mutationFn: async (data: PTOFormData) => {
      // Validate dates - parse as LOCAL time, not UTC
      const startDate = parseLocalDate(data.startDate);
      const endDate = parseLocalDate(data.endDate);
      const isHalfDay = !!data.halfDay;

      if (startDate > endDate) {
        throw new Error('End date cannot be before start date');
      }

      if (isHalfDay && data.startDate !== data.endDate) {
        throw new Error('Half-day requests must be for a single date');
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

      let days = countBusinessDaysBetween(startDate, endDate);
      if (isHalfDay) {
        if (!isBusinessDay(startDate)) {
          throw new Error('Selected date is not a business day');
        }
        days = 0.5;
      }
      if (days <= 0) {
        throw new Error('Selected date range has no business days');
      }

      const requestBody = {
        startDate: data.startDate,
        endDate: data.endDate,
        type: data.type,
        reason: data.halfDay ? appendHalfDaySuffix(data.reason, data.halfDayPeriod) : data.reason,
        days,
        halfDay: data.halfDay,
        halfDayPeriod: data.halfDayPeriod
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

  const editPTOMutation = useMutation({
    mutationFn: async ({ id, data, keepApproved }: { id: string; data: PTOFormData; keepApproved: boolean }) => {
      const response = await fetch(`/api/pto/${id}/edit`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ ...data, keepApproved })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update PTO request');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pto'] });
      setEditDialogOpen(false);
      setEditingRequest(null);
      toast({
        title: 'Updated',
        description: 'PTO request updated successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update PTO request',
        variant: 'destructive'
      });
    }
  });

  const cancelPTOMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/pto/${id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel PTO request');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pto'] });
      toast({
        title: 'Cancelled',
        description: 'Your PTO request has been cancelled.'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel PTO request',
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

  const finalizePtoMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/pto/${id}/final-review`, {
        method: 'PATCH'
      });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['/api/pto'], (old: any) => {
        if (!old) return old;
        return old.map((req: any) => req.id === updated.id ? updated : req);
      });
      toast({
        title: 'Final review completed',
        description: 'PTO request has been fully approved.'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to complete final review',
        variant: 'destructive'
      });
    }
  });

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

  const handleCancel = (id: string) => {
    cancelPTOMutation.mutate(id);
  };

  const handleEditRequest = (request: any) => {
    const inferredHalfDay = request.days === 0.5;
    const inferredPeriod = extractHalfDayPeriod(request.reason) || 'AM';
    setEditingRequest(request);
    editForm.reset({
      startDate: request.startDate || '',
      endDate: request.endDate || '',
      type: request.type || 'VACATION',
      reason: stripHalfDaySuffix(request.reason || ''),
      halfDay: inferredHalfDay,
      halfDayPeriod: inferredPeriod
    });
    setEditKeepApproved(request.status === 'APPROVED' && isCoreApprover);
    setEditDialogOpen(true);
  };

  const onEditSubmit = (data: PTOFormData) => {
    if (!editingRequest) return;
    editPTOMutation.mutate({
      id: editingRequest.id,
      data: {
        ...data,
        reason: data.halfDay ? appendHalfDaySuffix(data.reason, data.halfDayPeriod) : data.reason
      },
      keepApproved: editKeepApproved && canApprovePto && editingRequest.status === 'APPROVED'
    });
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
      queryClient.invalidateQueries({ queryKey: ['/api/pto/department-settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pto/individual-policies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/employee-portal/pto-balance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pto'] });
      setEditingCompanyPolicy(false);
      toast({
        title: 'Success',
        description: 'Company PTO policy updated successfully'
      });
    }
  });

  const updateHolidayScheduleMutation = useMutation({
    mutationFn: async (holidays: HolidayEntry[]) => {
      const payload = {
        holidaySchedule: JSON.stringify(holidays),
        lastUpdatedBy: user?.id
      };
      const response = await fetch('/api/pto/company-policy', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Failed to update company holidays');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pto/company-policy'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pto'] });
      toast({
        title: 'Success',
        description: 'Company holidays updated successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update company holidays',
        variant: 'destructive'
      });
    }
  });

  const handleAddHoliday = () => {
    const date = holidayDateInput.trim();
    const name = holidayNameInput.trim() || 'Company Holiday';
    if (!date) {
      toast({
        title: 'Missing date',
        description: 'Choose a date for the holiday.',
        variant: 'destructive'
      });
      return;
    }
    if (holidayDraft.some((entry) => entry.date === date)) {
      toast({
        title: 'Duplicate date',
        description: 'That date already exists in the holiday list.',
        variant: 'destructive'
      });
      return;
    }
    const next = [...holidayDraft, { date, name }].sort((a, b) => a.date.localeCompare(b.date));
    setHolidayDraft(next);
    setHolidayDateInput('');
    setHolidayNameInput('');
  };

  const handleRemoveHoliday = (date: string) => {
    setHolidayDraft((prev) => prev.filter((entry) => entry.date !== date));
  };

  const handleSaveHolidays = () => {
    if (!companyPolicy) {
      toast({
        title: 'Missing company policy',
        description: 'Create the company PTO policy before saving holidays.',
        variant: 'destructive'
      });
      return;
    }
    const sanitized = holidayDraft
      .filter((entry) => entry.date)
      .map((entry) => ({
        date: entry.date,
        name: entry.name?.trim() || 'Company Holiday'
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    updateHolidayScheduleMutation.mutate(sanitized);
  };

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
      queryClient.invalidateQueries({ queryKey: ['/api/pto/individual-policies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/employee-portal/pto-balance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pto'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/employee-portal/pto-balance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pto'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/pto/individual-policies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/employee-portal/pto-balance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pto'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/employee-portal/pto-balance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pto'] });
      setAddingIndividual(false);
      toast({
        title: 'Success',
        description: 'Individual PTO policy created successfully'
      });
    }
  });

  // Reset all PTO balances mutation
  const [resetResults, setResetResults] = useState<any>(null);
  const resetAllPTOMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/pto/admin/reset-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reset PTO');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setResetResults(data.results);
      queryClient.invalidateQueries({ queryKey: ['/api/pto/individual-policies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pto-policies'] });
      toast({
        title: 'PTO Reset Complete',
        description: data.message
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reset PTO',
        variant: 'destructive'
      });
    }
  });

  const getUserById = (id: string) => {
    return users?.find((user: any) => user.id === id);
  };

  const getStatusColor = (status: string, isCancelled: boolean = false) => {
    if (isCancelled) {
      return 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
    }
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'APPROVED': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'DENIED': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const isCancelledRequest = (request: any) => {
    if (request.status !== 'DENIED') return false;
    const notes = (request.reviewNotes || '').toLowerCase();
    return notes.includes('cancelled') || notes.includes('canceled');
  };

  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const filteredPtoRequests = (ptoRequests || []).filter((request: any) => {
    if (statusFilter !== 'ALL' && request.status !== statusFilter) return false;
    if (timeFilter === 'PAST') {
      const endDate = parseLocalDate(request.endDate);
      return request.status === 'APPROVED' && endDate < today;
    }
    if (timeFilter === 'FUTURE') {
      const startDate = parseLocalDate(request.startDate);
      return request.status === 'APPROVED' && startDate > today;
    }
    return true;
  });

  const analyticsRangeStart = parseLocalDate(analyticsStartDate);
  const analyticsRangeEnd = parseLocalDate(analyticsEndDate);

  const countOverlappingDays = (request: any, rangeStart: Date, rangeEnd: Date) => {
    const requestStart = parseLocalDate(request.startDate);
    const requestEnd = parseLocalDate(request.endDate);
    const start = requestStart > rangeStart ? requestStart : rangeStart;
    const end = requestEnd < rangeEnd ? requestEnd : rangeEnd;

    if (start > end) return 0;
    if (request.days <= 0.5 && requestStart.getTime() === requestEnd.getTime()) {
      return isBusinessDay(requestStart) ? request.days : 0;
    }

    let days = 0;
    const current = new Date(start);
    while (current <= end) {
      if (isBusinessDay(current)) days++;
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const countMonthUsage = (
    requests: any[],
    year: number,
    monthIndex: number,
    rangeStart?: Date,
    rangeEnd?: Date
  ) => {
    const monthStart = new Date(year, monthIndex, 1);
    const monthEnd = new Date(year, monthIndex + 1, 0);
    const start = rangeStart && rangeStart > monthStart ? rangeStart : monthStart;
    const end = rangeEnd && rangeEnd < monthEnd ? rangeEnd : monthEnd;
    if (start > end) return 0;
    return requests.reduce((sum, request) => {
      return sum + countOverlappingDays(request, start, end);
    }, 0);
  };

  const analytics = useMemo(() => {
    const approvedRequests = (ptoRequests || []).filter((request: any) => {
      if (request.status !== 'APPROVED') return false;
      const requestStart = parseLocalDate(request.startDate);
      const requestEnd = parseLocalDate(request.endDate);
      return requestStart <= analyticsRangeEnd && requestEnd >= analyticsRangeStart;
    });

    const approvedPast = approvedRequests.filter((request: any) => {
      const endDate = parseLocalDate(request.endDate);
      return endDate < today;
    });

    const approvedFuture = approvedRequests.filter((request: any) => {
      const startDate = parseLocalDate(request.startDate);
      return startDate > today;
    });

    const currentYear = today.getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31);
    const approvedPastThisYear = approvedPast.filter((request: any) => {
      const requestStart = parseLocalDate(request.startDate);
      const requestEnd = parseLocalDate(request.endDate);
      return requestStart <= yearEnd && requestEnd >= yearStart;
    });
    const approvedFutureThisYear = approvedFuture.filter((request: any) => {
      const requestStart = parseLocalDate(request.startDate);
      const requestEnd = parseLocalDate(request.endDate);
      return requestStart <= yearEnd && requestEnd >= yearStart;
    });

    const employeeUsage: Record<string, any> = {};
    const departmentUsage: Record<string, any> = {};
    const typeTotals = {
      VACATION: 0,
      SICK: 0,
      PERSONAL: 0
    };
    const employeeTypeTotals: Record<string, { VACATION: number; SICK: number; PERSONAL: number }> = {};
    let totalUsedDays = 0;
    let totalFutureDays = 0;

    for (const request of approvedPastThisYear) {
      const employee = getUserById(request.employeeId);
      const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown';
      const department = employee?.department || 'Unassigned';
      const type = (request.type || 'VACATION') as 'VACATION' | 'SICK' | 'PERSONAL';
      const days = countOverlappingDays(request, analyticsRangeStart, analyticsRangeEnd);

      totalUsedDays += days;
      typeTotals[type] += days;

      if (!employeeUsage[request.employeeId]) {
        employeeUsage[request.employeeId] = {
          employeeId: request.employeeId,
          name: employeeName,
          department,
          vacationDays: 0,
          sickDays: 0,
          personalDays: 0,
          totalDays: 0
        };
      }
      if (!employeeTypeTotals[request.employeeId]) {
        employeeTypeTotals[request.employeeId] = { VACATION: 0, SICK: 0, PERSONAL: 0 };
      }
      if (type === 'VACATION') employeeUsage[request.employeeId].vacationDays += days;
      if (type === 'SICK') employeeUsage[request.employeeId].sickDays += days;
      if (type === 'PERSONAL') employeeUsage[request.employeeId].personalDays += days;
      employeeUsage[request.employeeId].totalDays += days;
      employeeTypeTotals[request.employeeId][type] += days;

      if (!departmentUsage[department]) {
        departmentUsage[department] = {
          department,
          vacationDays: 0,
          sickDays: 0,
          personalDays: 0,
          totalDays: 0,
          employeeCount: 0
        };
      }
      if (type === 'VACATION') departmentUsage[department].vacationDays += days;
      if (type === 'SICK') departmentUsage[department].sickDays += days;
      if (type === 'PERSONAL') departmentUsage[department].personalDays += days;
      departmentUsage[department].totalDays += days;
    }

    for (const request of approvedFuture) {
      totalFutureDays += countOverlappingDays(request, analyticsRangeStart, analyticsRangeEnd);
    }

    const employeesWithUsage = new Set(Object.keys(employeeUsage));
    const departmentsWithUsage = Object.keys(departmentUsage);

    for (const department of departmentsWithUsage) {
      const employeesInDepartment = Object.values(employeeUsage).filter((employee: any) => employee.department === department);
      departmentUsage[department].employeeCount = employeesInDepartment.length;
    }

    const employeeMonthUsage: Record<string, { jan: number; feb: number; dec: number }> = {};
    const employeeMonthlyUsage: Record<string, { usedDays: number[]; upcomingDays: number[] }> = {};
    for (const employeeId of employeesWithUsage) {
      const employeeRequests = approvedPastThisYear.filter((request: any) => request.employeeId === employeeId);
      const employeeFutureRequests = approvedFutureThisYear.filter((request: any) => request.employeeId === employeeId);
      employeeMonthUsage[employeeId] = {
        jan: countMonthUsage(employeeRequests, currentYear, 0, analyticsRangeStart, analyticsRangeEnd),
        feb: countMonthUsage(employeeRequests, currentYear, 1, analyticsRangeStart, analyticsRangeEnd),
        dec: countMonthUsage(employeeRequests, currentYear, 11, analyticsRangeStart, analyticsRangeEnd),
      };
      employeeMonthlyUsage[employeeId] = {
        usedDays: MONTH_LABELS.map((_, monthIndex) =>
          countMonthUsage(employeeRequests, currentYear, monthIndex, analyticsRangeStart, analyticsRangeEnd)
        ),
        upcomingDays: MONTH_LABELS.map((_, monthIndex) =>
          countMonthUsage(employeeFutureRequests, currentYear, monthIndex, analyticsRangeStart, analyticsRangeEnd)
        )
      };
    }

    const employeeRows = Object.values(employeeUsage).sort((a: any, b: any) => b.totalDays - a.totalDays);
    const departmentRows = Object.values(departmentUsage).sort((a: any, b: any) => b.totalDays - a.totalDays);
    const monthlyUsage = MONTH_LABELS.map((label, monthIndex) => ({
      label,
      usedDays: countMonthUsage(approvedPastThisYear, currentYear, monthIndex, analyticsRangeStart, analyticsRangeEnd),
      upcomingDays: countMonthUsage(approvedFutureThisYear, currentYear, monthIndex, analyticsRangeStart, analyticsRangeEnd),
    }));
    const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    const nextMonthUpcomingDays = approvedFuture.reduce((sum: number, request: any) => {
      return sum + countOverlappingDays(request, nextMonthStart, nextMonthEnd);
    }, 0);

    return {
      year: currentYear,
      totalUsedDays,
      totalFutureDays,
      employeeCount: employeesWithUsage.size,
      departmentCount: departmentsWithUsage.length,
      employeeRows,
      departmentRows,
      janUsedDays: countMonthUsage(approvedPastThisYear, currentYear, 0, analyticsRangeStart, analyticsRangeEnd),
      febUsedDays: countMonthUsage(approvedPastThisYear, currentYear, 1, analyticsRangeStart, analyticsRangeEnd),
      decUsedDays: countMonthUsage(approvedPastThisYear, currentYear, 11, analyticsRangeStart, analyticsRangeEnd),
      employeeMonthUsage,
      employeeMonthlyUsage,
      monthlyUsage,
      nextMonthUpcomingDays,
      nextMonthLabel: format(nextMonthStart, 'MMM yyyy'),
      typeTotals,
      employeeTypeTotals
    };
  }, [ptoRequests, today, users, analyticsRangeEnd, analyticsRangeStart]);

  const analyticsEmployeeOptions = analytics.employeeRows;
  const selectedMonthUsage = useMemo(() => {
    if (analyticsEmployeeId === 'ALL') {
      return {
        jan: analytics.janUsedDays,
        feb: analytics.febUsedDays,
        dec: analytics.decUsedDays
      };
    }
    return analytics.employeeMonthUsage[analyticsEmployeeId] || { jan: 0, feb: 0, dec: 0 };
  }, [analytics, analyticsEmployeeId]);

  const selectedTypeTotals = useMemo(() => {
    if (analyticsEmployeeId === 'ALL') {
      return analytics.typeTotals;
    }
    return analytics.employeeTypeTotals[analyticsEmployeeId] || { VACATION: 0, SICK: 0, PERSONAL: 0 };
  }, [analytics, analyticsEmployeeId]);

  const selectedMonthlyUsage = useMemo(() => {
    if (analyticsEmployeeId === 'ALL') {
      return analytics.monthlyUsage || MONTH_LABELS.map((label) => ({ label, usedDays: 0, upcomingDays: 0 }));
    }
    const entry = analytics.employeeMonthlyUsage?.[analyticsEmployeeId];
    if (!entry) {
      return MONTH_LABELS.map((label) => ({ label, usedDays: 0, upcomingDays: 0 }));
    }
    return MONTH_LABELS.map((label, index) => ({
      label,
      usedDays: entry.usedDays[index] || 0,
      upcomingDays: entry.upcomingDays[index] || 0
    }));
  }, [analytics, analyticsEmployeeId]);

  const maxMonthlyDays = useMemo(() => {
    const maxValue = Math.max(
      ...selectedMonthlyUsage.map((month) => month.usedDays + month.upcomingDays),
      1
    );
    return maxValue;
  }, [selectedMonthlyUsage]);

  const typeTotalDays = selectedTypeTotals.VACATION + selectedTypeTotals.SICK + selectedTypeTotals.PERSONAL;

  const typeSegments = useMemo(() => ([
    { key: 'VACATION', label: 'Vacation', value: selectedTypeTotals.VACATION, color: '#3b82f6' },
    { key: 'SICK', label: 'Sick', value: selectedTypeTotals.SICK, color: '#f97316' },
    { key: 'PERSONAL', label: 'Personal', value: selectedTypeTotals.PERSONAL, color: '#a855f7' }
  ]), [selectedTypeTotals]);

  const typeChartBackground = useMemo(() => {
    if (typeTotalDays <= 0) {
      return 'conic-gradient(#e5e7eb 0% 100%)';
    }
    let cumulative = 0;
    const stops = typeSegments.map((segment) => {
      const percent = (segment.value / typeTotalDays) * 100;
      const start = cumulative;
      cumulative += percent;
      return `${segment.color} ${start}% ${cumulative}%`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  }, [typeSegments, typeTotalDays]);

  const formatDays = (value: number) => {
    return Number.isInteger(value) ? `${value}` : value.toFixed(1);
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
    if (deptSetting && deptSetting.inheritFromCompany === false) {
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
        <TabsList className={`grid w-full ${tabsGridClass}`}>
          <TabsTrigger value="requests">PTO Requests</TabsTrigger>
          {showAnalytics && <TabsTrigger value="analytics">Analytics</TabsTrigger>}
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
            {user && departmentSettings?.find((d: any) => d.department === user.department && d.inheritFromCompany === false) && (
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
                    disabled={form.watch('halfDay')}
                    {...form.register('endDate')}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Half-day request</p>
                    <p className="text-xs text-muted-foreground">Only one date; counts as 0.5 day.</p>
                  </div>
                  <Switch
                    checked={!!form.watch('halfDay')}
                    onCheckedChange={(value) => form.setValue('halfDay', value)}
                  />
                </div>
                {form.watch('halfDay') && (
                  <div>
                    <Label htmlFor="halfDayPeriod">Half-day period</Label>
                    <Select
                      value={form.watch('halfDayPeriod') || 'AM'}
                      onValueChange={(value: 'AM' | 'PM') => form.setValue('halfDayPeriod', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select period" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AM">Morning (AM)</SelectItem>
                        <SelectItem value="PM">Afternoon (PM)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  Weekends and company holidays are not counted toward PTO.
                </div>
                {businessDaysPreview && (
                  <div className={`text-sm ${businessDaysPreview.error ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                    Business days: {businessDaysPreview.days}
                    {businessDaysPreview.error ? ` (${businessDaysPreview.error})` : ''}
                  </div>
                )}

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
            <Dialog
              open={adminPtoDialogOpen}
              onOpenChange={(open) => {
                setAdminPtoDialogOpen(open);
                if (!open) {
                  setAdminEmployeeSearch('');
                }
              }}
            >
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
                    <Input
                      id="admin-employee-search"
                      value={adminEmployeeSearch}
                      onChange={(e) => setAdminEmployeeSearch(e.target.value)}
                      placeholder="Search by name, email, or department"
                      className="mb-2"
                    />
                    <Select
                      value={adminForm.watch('employeeId')}
                      onValueChange={(value) => adminForm.setValue('employeeId', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredAdminEmployees.map((u: any) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.firstName} {u.lastName} ({u.department || 'No Dept'})
                          </SelectItem>
                        ))}
                        {filteredAdminEmployees.length === 0 && (
                          <SelectItem value="__no_results__" disabled>
                            No eligible employees match your search.
                          </SelectItem>
                        )}
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

      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditingRequest(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit PTO Request</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="editStartDate">Start Date</Label>
              <Input
                id="editStartDate"
                type="date"
                {...editForm.register('startDate')}
              />
            </div>
            <div>
              <Label htmlFor="editEndDate">End Date</Label>
              <Input
                id="editEndDate"
                type="date"
                disabled={editForm.watch('halfDay')}
                {...editForm.register('endDate')}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Weekends and company holidays are not counted toward PTO.
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Half-day request</p>
                <p className="text-xs text-muted-foreground">Only one date; counts as 0.5 day.</p>
              </div>
              <Switch
                checked={!!editForm.watch('halfDay')}
                onCheckedChange={(value) => editForm.setValue('halfDay', value)}
              />
            </div>
            {editForm.watch('halfDay') && (
              <div>
                <Label htmlFor="editHalfDayPeriod">Half-day period</Label>
                <Select
                  value={editForm.watch('halfDayPeriod') || 'AM'}
                  onValueChange={(value: 'AM' | 'PM') => editForm.setValue('halfDayPeriod', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AM">Morning (AM)</SelectItem>
                    <SelectItem value="PM">Afternoon (PM)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor="editType">Type of Time Off</Label>
              <Select
                value={editForm.watch('type')}
                onValueChange={(value: 'VACATION' | 'SICK' | 'PERSONAL') => editForm.setValue('type', value)}
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
              <Label htmlFor="editReason">Reason</Label>
              <Textarea
                id="editReason"
                {...editForm.register('reason')}
                placeholder="Please provide a reason for your time off request"
              />
            </div>
            {isCoreApprover && editingRequest?.status === 'APPROVED' ? (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Keep Approved</p>
                  <p className="text-xs text-muted-foreground">Toggle off to resubmit for approval.</p>
                </div>
                <Switch checked={editKeepApproved} onCheckedChange={setEditKeepApproved} />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Changes will resubmit this request for approval.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editPTOMutation.isPending}>
                {editPTOMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* PTO Requests Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle>
              {isManager ? 'All PTO Requests' : isDepartmentApprover ? 'Department PTO Requests' : 'My PTO Requests'}
            </CardTitle>
            {/* Status Filter Bar */}
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant={statusFilter === 'ALL' ? 'default' : 'outline'}
                onClick={() => {
                  setStatusFilter('ALL');
                  setTimeFilter('ALL');
                }}
              >
                All
              </Button>
              <Button
                size="sm"
                variant={statusFilter === 'PENDING' ? 'default' : 'outline'}
                onClick={() => {
                  setStatusFilter('PENDING');
                  setTimeFilter('ALL');
                }}
                className={statusFilter === 'PENDING' ? '' : 'border-yellow-300 text-yellow-700 hover:bg-yellow-50'}
              >
                Pending
              </Button>
              <Button
                size="sm"
                variant={statusFilter === 'APPROVED' ? 'default' : 'outline'}
                onClick={() => {
                  setStatusFilter('APPROVED');
                  setTimeFilter('ALL');
                }}
                className={statusFilter === 'APPROVED' ? 'bg-green-600 hover:bg-green-700' : 'border-green-300 text-green-700 hover:bg-green-50'}
              >
                Approved
              </Button>
              <Button
                size="sm"
                variant={statusFilter === 'DENIED' ? 'default' : 'outline'}
                onClick={() => {
                  setStatusFilter('DENIED');
                  setTimeFilter('ALL');
                }}
                className={statusFilter === 'DENIED' ? 'bg-red-600 hover:bg-red-700' : 'border-red-300 text-red-700 hover:bg-red-50'}
              >
                Denied
              </Button>
              <Button
                size="sm"
                variant={timeFilter === 'PAST' ? 'default' : 'outline'}
                onClick={() => {
                  setStatusFilter('APPROVED');
                  setTimeFilter('PAST');
                }}
                className={timeFilter === 'PAST' ? 'bg-secondary-900 hover:bg-secondary-800' : ''}
              >
                Past Approved
              </Button>
              <Button
                size="sm"
                variant={timeFilter === 'FUTURE' ? 'default' : 'outline'}
                onClick={() => {
                  setStatusFilter('APPROVED');
                  setTimeFilter('FUTURE');
                }}
                className={timeFilter === 'FUTURE' ? 'bg-secondary-900 hover:bg-secondary-800' : ''}
              >
                Upcoming Approved
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
                {filteredPtoRequests.length > 0 ? (
                  filteredPtoRequests.map((request: any) => {
                  const employee = getUserById(request.employeeId);
                  const isCancelled = isCancelledRequest(request);
                  const statusLabel = isCancelled ? 'CANCELLED' : request.status;
                  const isOwnRequest = request.employeeId === user?.id;
                  const canApproveThisRequest = isCoreApprover || (!!deptApproverEntry && employee?.department === deptApproverEntry.department);
                  const pendingAdminReview = request.status === 'APPROVED' &&
                    typeof request.reviewNotes === 'string' &&
                    request.reviewNotes.toLowerCase().includes('pending final admin review');
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
                        {parseLocalDate(request.startDate).toLocaleDateString()} - {parseLocalDate(request.endDate).toLocaleDateString()}
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
                        <Badge className={getStatusColor(request.status, isCancelled)}>
                          {statusLabel}
                        </Badge>
                        {request.status === 'DENIED' && request.reviewNotes && (
                          <div className={`${isCancelled ? 'text-gray-500 dark:text-gray-400' : 'text-red-600 dark:text-red-400'} text-sm mt-1`}>
                            <span className="font-medium">{isCancelled ? 'Note' : 'Reason'}:</span> {request.reviewNotes}
                          </div>
                        )}
                        {pendingAdminReview && (
                          <div className="text-xs text-amber-700 dark:text-amber-300 mt-1 flex items-center gap-2">
                            <span>Pending final admin review (within 48 hours).</span>
                            {isCoreApprover && (
                              <Button
                                size="xs"
                                variant="secondary"
                                onClick={() => finalizePtoMutation.mutate(request.id)}
                                disabled={finalizePtoMutation.isPending}
                              >
                                {finalizePtoMutation.isPending ? 'Finalizing...' : 'Confirm'}
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {(isOwnRequest || isManager) && ['PENDING', 'APPROVED'].includes(request.status) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditRequest(request)}
                            disabled={editPTOMutation.isPending}
                            className="mr-2"
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                        )}
                        {request.status === 'PENDING' && canApproveThisRequest && !isOwnRequest && (
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
                        {isOwnRequest && ['PENDING', 'APPROVED'].includes(request.status) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancel(request.id)}
                            disabled={cancelPTOMutation.isPending}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                        )}
                        {request.status === 'PENDING' && !canApproveThisRequest && !isOwnRequest && (
                          <span className="text-sm text-muted-foreground">Pending approval</span>
                        )}
                      </td>
                    </tr>
                  );
                })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                      No PTO requests match these filters.
                    </td>
                  </tr>
                )}
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

    {/* PTO Analytics Tab */}
    {showAnalytics && (
    <TabsContent value="analytics" className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Used PTO Analytics ({analytics.year})</CardTitle>
          <CardDescription>
            Approved PTO that has already been taken this year (past end dates).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <Label htmlFor="analytics-start">Range Start</Label>
              <Input
                id="analytics-start"
                type="date"
                value={analyticsStartDate}
                onChange={(e) => setAnalyticsStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="analytics-end">Range End</Label>
              <Input
                id="analytics-end"
                type="date"
                value={analyticsEndDate}
                onChange={(e) => setAnalyticsEndDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="analytics-employee">Employee</Label>
              <Select value={analyticsEmployeeId} onValueChange={setAnalyticsEmployeeId}>
                <SelectTrigger id="analytics-employee">
                  <SelectValue placeholder="All employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All employees</SelectItem>
                  {analyticsEmployeeOptions.map((employee: any) => (
                    <SelectItem key={employee.employeeId} value={employee.employeeId}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const now = new Date();
                  const start = new Date(now.getFullYear(), 0, 1);
                  const end = new Date(now.getFullYear(), 11, 31);
                  setAnalyticsStartDate(format(start, 'yyyy-MM-dd'));
                  setAnalyticsEndDate(format(end, 'yyyy-MM-dd'));
                }}
              >
                This Year
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border p-3">
              <div className="text-sm text-muted-foreground">Total Used Days</div>
              <div className="text-2xl font-semibold">{analytics.totalUsedDays}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-sm text-muted-foreground">Employees With Usage</div>
              <div className="text-2xl font-semibold">{analytics.employeeCount}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-sm text-muted-foreground">Departments</div>
              <div className="text-2xl font-semibold">{analytics.departmentCount}</div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <div className="rounded-lg border p-3">
              <div className="text-sm text-muted-foreground">Upcoming Approved Days</div>
              <div className="text-2xl font-semibold">{analytics.totalFutureDays}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-sm text-muted-foreground">Upcoming {analytics.nextMonthLabel}</div>
              <div className="text-2xl font-semibold">{formatDays(analytics.nextMonthUpcomingDays)}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-sm text-muted-foreground">Jan Used Days</div>
              <div className="text-2xl font-semibold">{analytics.janUsedDays}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-sm text-muted-foreground">Feb Used Days</div>
              <div className="text-2xl font-semibold">{analytics.febUsedDays}</div>
            </div>
            <div className="rounded-lg border p-3 md:col-span-2">
              <div className="text-sm text-muted-foreground">Dec Used Days</div>
              <div className="text-2xl font-semibold">{analytics.decUsedDays}</div>
            </div>
          </div>
          <div className="mt-4">
            <div className="text-sm font-medium text-muted-foreground mb-3">
              Jan/Feb/Dec Usage ({analyticsEmployeeId === 'ALL' ? 'All employees' : 'Selected employee'})
            </div>
            <div className="grid grid-cols-3 gap-4">
              {(['jan', 'feb', 'dec'] as const).map((monthKey) => {
                const value = selectedMonthUsage[monthKey];
                const maxValue = Math.max(selectedMonthUsage.jan, selectedMonthUsage.feb, selectedMonthUsage.dec, 1);
                const heightPercent = value === 0 ? 6 : Math.round((value / maxValue) * 100);
                const label = monthKey === 'jan' ? 'Jan' : monthKey === 'feb' ? 'Feb' : 'Dec';
                const barColor = monthKey === 'jan' ? 'bg-blue-500' : monthKey === 'feb' ? 'bg-emerald-500' : 'bg-amber-500';
                return (
                  <div key={monthKey} className="flex flex-col items-center gap-2">
                    <div className="w-full h-20 bg-muted/30 rounded-md flex items-end overflow-hidden shadow-inner">
                      <div
                        className={`w-full ${barColor} transition-all duration-700 ease-out ${value === 0 ? 'opacity-40' : ''}`}
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">{value} days</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-6">
            <div className="text-sm font-medium text-muted-foreground mb-3">
              PTO by Month ({analyticsEmployeeId === 'ALL' ? 'All employees' : 'Selected employee'})
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Used days
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                Upcoming days
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              {selectedMonthlyUsage.map((month) => {
                const totalDays = month.usedDays + month.upcomingDays;
                const totalPercent = totalDays === 0 ? 6 : Math.max(Math.round((totalDays / maxMonthlyDays) * 100), 10);
                const usedPercent = totalDays === 0 ? 0 : Math.round((month.usedDays / totalDays) * 100);
                const upcomingPercent = totalDays === 0 ? 0 : 100 - usedPercent;
                return (
                  <div key={month.label} className="flex flex-col items-center gap-2">
                    <div className="w-full h-24 bg-muted/30 rounded-md flex items-end overflow-hidden shadow-inner">
                      <div className="w-full flex flex-col justify-end" style={{ height: `${totalPercent}%` }}>
                        {upcomingPercent > 0 && (
                          <div
                            className="w-full bg-sky-400/80 transition-all duration-700 ease-out"
                            style={{ height: `${upcomingPercent}%` }}
                          />
                        )}
                        {usedPercent > 0 && (
                          <div
                            className="w-full bg-emerald-500 transition-all duration-700 ease-out"
                            style={{ height: `${usedPercent}%` }}
                          />
                        )}
                      </div>
                    </div>
                    <div className="text-sm font-medium">{month.label}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatDays(month.usedDays)} used • {formatDays(month.upcomingDays)} upcoming
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-6 rounded-lg border p-4">
            <div className="text-sm font-medium text-muted-foreground mb-3">
              PTO Type Mix ({analyticsEmployeeId === 'ALL' ? 'All employees' : 'Selected employee'})
            </div>
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="relative h-32 w-32 shrink-0">
                <div
                  className="absolute inset-0 rounded-full transition-[background] duration-700 ease-out"
                  style={{ background: typeChartBackground }}
                />
                <div className="absolute inset-4 rounded-full bg-background shadow-inner" />
                <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold">
                  {formatDays(typeTotalDays)} days
                </div>
              </div>
              <div className="grid w-full grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                {typeSegments.map((segment) => (
                  <div key={segment.key} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                      <span className="font-medium">{segment.label}</span>
                    </div>
                    <span className="text-muted-foreground">{formatDays(segment.value)} days</span>
                  </div>
                ))}
              </div>
            </div>
            {typeTotalDays === 0 && (
              <div className="mt-3 text-xs text-muted-foreground">
                No past approved PTO in this range.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>By Department</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.departmentRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">No past approved PTO found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-3">Department</th>
                      <th className="text-left py-2 pr-3">Employees</th>
                      <th className="text-left py-2 pr-3">Vacation</th>
                      <th className="text-left py-2 pr-3">Sick</th>
                      <th className="text-left py-2 pr-3">Personal</th>
                      <th className="text-left py-2 pr-3">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.departmentRows.map((row: any) => (
                      <tr key={row.department} className="border-b">
                        <td className="py-2 pr-3 font-medium">{row.department}</td>
                        <td className="py-2 pr-3">{row.employeeCount}</td>
                        <td className="py-2 pr-3">{row.vacationDays}</td>
                        <td className="py-2 pr-3">{row.sickDays}</td>
                        <td className="py-2 pr-3">{row.personalDays}</td>
                        <td className="py-2 pr-3 font-semibold">{row.totalDays}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By Employee</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.employeeRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">No past approved PTO found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-3">Employee</th>
                      <th className="text-left py-2 pr-3">Department</th>
                      <th className="text-left py-2 pr-3">Vacation</th>
                      <th className="text-left py-2 pr-3">Sick</th>
                      <th className="text-left py-2 pr-3">Personal</th>
                      <th className="text-left py-2 pr-3">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.employeeRows.map((row: any) => (
                      <tr key={row.employeeId} className="border-b">
                        <td className="py-2 pr-3 font-medium">{row.name}</td>
                        <td className="py-2 pr-3">{row.department}</td>
                        <td className="py-2 pr-3">{row.vacationDays}</td>
                        <td className="py-2 pr-3">{row.sickDays}</td>
                        <td className="py-2 pr-3">{row.personalDays}</td>
                        <td className="py-2 pr-3 font-semibold">{row.totalDays}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TabsContent>
    )}

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
                    defaultValue={companyPolicy?.vacationDays ?? PTO_POLICY.DEFAULT_VACATION_DAYS}
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
                    defaultValue={companyPolicy?.sickDays ?? PTO_POLICY.DEFAULT_SICK_DAYS}
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
                    defaultValue={companyPolicy?.personalDays ?? PTO_POLICY.DEFAULT_PERSONAL_DAYS}
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Company Holidays
          </CardTitle>
          <CardDescription>
            Used to exclude days from PTO counts and highlight holidays on the calendar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sortedHolidayDraft.length === 0 ? (
              <div className="text-sm text-muted-foreground">No company holidays configured yet.</div>
            ) : (
              <div className="space-y-2">
                {sortedHolidayDraft.map((holiday) => (
                  <div
                    key={holiday.date}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div>
                      <div className="font-medium">{holiday.name || 'Company Holiday'}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(parseLocalDate(holiday.date), 'MMM d, yyyy')}
                      </div>
                    </div>
                    {canEditPolicies && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveHoliday(holiday.date)}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {canEditPolicies && (
              <div className="rounded-md border p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_auto] gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="holiday-date">Date</Label>
                    <Input
                      id="holiday-date"
                      type="date"
                      value={holidayDateInput}
                      onChange={(event) => setHolidayDateInput(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="holiday-name">Holiday Name</Label>
                    <Input
                      id="holiday-name"
                      placeholder="Company Holiday"
                      value={holidayNameInput}
                      onChange={(event) => setHolidayNameInput(event.target.value)}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" onClick={handleAddHoliday}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Holiday
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Changes apply after saving.</span>
                  <Button
                    type="button"
                    onClick={handleSaveHolidays}
                    disabled={updateHolidayScheduleMutation.isPending}
                  >
                    {updateHolidayScheduleMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Holidays'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Admin Reset PTO Card */}
      {canEditPolicies && (
        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
              <RefreshCw className="h-5 w-5" />
              Reset All PTO Balances
            </CardTitle>
            <CardDescription>
              Reset all employees to their default PTO based on employment type and department.
              W2 employees get 17 days (10 vacation + 5 sick + 2 personal).
              1099/Sales get 0 days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
                <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <AlertDescription className="text-orange-800 dark:text-orange-200">
                  This will reset all employee PTO balances to their default values. Used days will be preserved.
                </AlertDescription>
              </Alert>

              <Button
                variant="destructive"
                onClick={() => {
                  if (window.confirm('Are you sure you want to reset all PTO balances? This cannot be undone.')) {
                    resetAllPTOMutation.mutate();
                  }
                }}
                disabled={resetAllPTOMutation.isPending}
              >
                {resetAllPTOMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reset All PTO
                  </>
                )}
              </Button>

              {resetResults && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Reset Results:</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-green-600 dark:text-green-400 font-bold">{resetResults.updated}</span> updated
                    </div>
                    <div>
                      <span className="text-blue-600 dark:text-blue-400 font-bold">{resetResults.created}</span> created
                    </div>
                    <div>
                      <span className="text-orange-600 dark:text-orange-400 font-bold">{resetResults.skipped}</span> skipped
                    </div>
                  </div>
                  {resetResults.errors?.length > 0 && (
                    <div className="mt-2 text-red-600 dark:text-red-400 text-sm">
                      Errors: {resetResults.errors.join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
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
                    inheritFromCompany: false
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
                        defaultValue={PTO_POLICY.DEFAULT_VACATION_DAYS}
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
                        defaultValue={PTO_POLICY.DEFAULT_SICK_DAYS}
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
                        defaultValue={PTO_POLICY.DEFAULT_PERSONAL_DAYS}
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
                          inheritFromCompany: false
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
                        defaultValue={PTO_POLICY.DEFAULT_VACATION_DAYS}
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
                        defaultValue={PTO_POLICY.DEFAULT_SICK_DAYS}
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
                        defaultValue={PTO_POLICY.DEFAULT_PERSONAL_DAYS}
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
