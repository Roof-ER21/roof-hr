import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { DashboardSkeleton } from '@/components/ui/skeleton-patterns';
import { EventFormModal } from '@/components/calendar/EventFormModal';
import { DeleteEventDialog } from '@/components/calendar/DeleteEventDialog';
import OrgChart from '@/components/OrgChart';
import { OnboardingTaskList } from '@/components/onboarding/OnboardingTaskList';
import {
  Calendar,
  Clock,
  FileText,
  User,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Edit,
  CheckCircle,
  AlertCircle,
  CalendarDays,
  TrendingUp,
  Award,
  Users,
  Building,
  ChevronRight,
  Umbrella,
  Heart,
  Coffee,
  Video,
  X,
  Plus,
  Pencil,
  Trash2,
  ClipboardList,
  ScrollText,
  GitBranch
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { employeeGetsPto } from '@shared/constants/roles';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';

interface PtoBalance {
  vacationDays: number;
  sickDays: number;
  personalDays: number;
  usedVacation: number;
  usedSick: number;
  usedPersonal: number;
  pendingDays: number;
}

interface PendingItem {
  id: string;
  type: 'review' | 'document' | 'contract' | 'training';
  title: string;
  description: string;
  dueDate?: string;
  action: string;
  link: string;
}

interface CalendarEvent {
  id: string;
  type: 'MEETING' | 'INTERVIEW' | 'PTO' | 'TEAM_PTO' | 'OTHER';
  title: string;
  startDate: string;
  endDate: string;
  color?: string;
  source: string;
  meetLink?: string;
  location?: string;
  description?: string;
  googleEventId?: string;
  allDay?: boolean;
  ptoType?: 'VACATION' | 'SICK' | 'PERSONAL';
  userId?: string;
}

const eventTypeColors: Record<string, { bg: string; text: string; border: string }> = {
  MEETING: { bg: 'bg-green-100 dark:bg-green-900/50', text: 'text-green-700 dark:text-green-200', border: 'border-green-300 dark:border-green-700' },
  INTERVIEW: { bg: 'bg-blue-100 dark:bg-blue-900/50', text: 'text-blue-700 dark:text-blue-200', border: 'border-blue-300 dark:border-blue-700' },
  PTO: { bg: 'bg-red-100 dark:bg-red-900/50', text: 'text-red-700 dark:text-red-200', border: 'border-red-300 dark:border-red-700' },
  TEAM_PTO: { bg: 'bg-purple-100 dark:bg-purple-900/50', text: 'text-purple-700 dark:text-purple-200', border: 'border-purple-300 dark:border-purple-700' },
  OTHER: { bg: 'bg-gray-100 dark:bg-gray-900/50', text: 'text-gray-700 dark:text-gray-200', border: 'border-gray-300 dark:border-gray-700' }
};

function EmployeeDashboard() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Check if user is eligible for PTO
  const userGetsPto = employeeGetsPto({ department: user?.department, employmentType: user?.employmentType });

  // Event CRUD modal state
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<CalendarEvent | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<CalendarEvent | null>(null);
  const [selectedDateForNew, setSelectedDateForNew] = useState<Date | undefined>();

  // Edit Profile modal state
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    phone: user?.phone || '',
    emergencyContactName: user?.emergencyContactName || '',
    emergencyContactPhone: user?.emergencyContactPhone || '',
    address: user?.address || '',
    preferredName: user?.preferredName || '',
    birthday: user?.birthday || ''
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof profileForm) => {
      const response = await fetch(`/api/users/${user?.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update profile');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Profile updated successfully' });
      setShowEditProfile(false);
      refreshUser?.();
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update profile', variant: 'destructive' });
    }
  });

  // Helper to check if user owns the event
  const userOwnsEvent = (event: CalendarEvent) => {
    return event.source === 'user-events' || event.userId === user?.id?.toString();
  };

  // Fetch calendar events
  const { data: calendarEvents = [], isLoading: calendarLoading } = useQuery<CalendarEvent[]>({
    queryKey: ['/api/google/calendar/my-events', currentMonth.toISOString()],
    queryFn: async () => {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      const response = await fetch(
        `/api/google/calendar/my-events?timeMin=${start.toISOString()}&timeMax=${end.toISOString()}`,
        { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }
      );
      if (!response.ok) return [];
      return response.json();
    }
  });

  // Calendar helpers
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const getEventsForDay = (day: Date) => {
    return calendarEvents.filter(event => {
      const eventStart = new Date(event.startDate);
      const eventEnd = new Date(event.endDate);
      return day >= new Date(eventStart.toDateString()) && day <= new Date(eventEnd.toDateString());
    });
  };

  // Fetch PTO balance
  const { data: ptoBalance, isLoading: ptoLoading } = useQuery<PtoBalance>({
    queryKey: ['/api/employee-portal/pto-balance'],
    queryFn: async () => {
      const response = await fetch('/api/employee-portal/pto-balance', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) {
        // Return defaults if endpoint doesn't exist yet
        // Default to company standard: 10 vacation, 5 sick, 2 personal = 17 total
        return {
          vacationDays: 10,
          sickDays: 5,
          personalDays: 2,
          usedVacation: 0,
          usedSick: 0,
          usedPersonal: 0,
          pendingDays: 0
        };
      }
      return response.json();
    }
  });

  // Fetch pending items
  const { data: pendingItems = [], isLoading: pendingLoading } = useQuery<PendingItem[]>({
    queryKey: ['/api/employee-portal/pending-items'],
    queryFn: async () => {
      const response = await fetch('/api/employee-portal/pending-items', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) return [];
      return response.json();
    }
  });

  // Fetch my PTO requests
  const { data: myPtoRequests = [] } = useQuery<any[]>({
    queryKey: ['/api/pto/my-requests'],
    queryFn: async () => {
      const response = await fetch('/api/pto', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) return [];
      const data = await response.json();
      return data.filter((r: any) => r.employeeId === user?.id);
    }
  });

  // Fetch upcoming schedule
  const { data: upcomingEvents = [] } = useQuery<any[]>({
    queryKey: ['/api/employee-portal/upcoming-events'],
    queryFn: async () => {
      const response = await fetch('/api/employee-portal/upcoming-events', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) return [];
      return response.json();
    }
  });

  // Fetch my documents that need acknowledgment
  const { data: documentsToAck = [] } = useQuery<any[]>({
    queryKey: ['/api/employee-portal/documents-to-acknowledge'],
    queryFn: async () => {
      const response = await fetch('/api/employee-portal/documents-to-acknowledge', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) return [];
      return response.json();
    }
  });

  // Fetch my onboarding tasks
  const { data: onboardingInstances = [] } = useQuery<any[]>({
    queryKey: ['/api/onboarding-instances', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const response = await fetch(`/api/onboarding-instances?employeeId=${user.id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!user?.id
  });

  // Fetch my unsigned contracts
  const { data: myContracts = [] } = useQuery<any[]>({
    queryKey: ['/api/employee-contracts/my-contracts'],
    queryFn: async () => {
      const response = await fetch('/api/employee-contracts', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) return [];
      const contracts = await response.json();
      // Filter for contracts assigned to current user
      return contracts.filter((c: any) => c.employeeId === user?.id);
    },
    enabled: !!user?.id
  });

  // Get unsigned contracts
  const unsignedContracts = myContracts.filter((c: any) => c.status === 'SENT' || c.status === 'PENDING');

  // Get active onboarding (in progress)
  const activeOnboarding = onboardingInstances.filter((o: any) => o.status === 'IN_PROGRESS' || o.status === 'NOT_STARTED');

  if (ptoLoading || pendingLoading) {
    return (
      <div className="p-6">
        <Breadcrumbs />
        <DashboardSkeleton />
      </div>
    );
  }

  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'APPROVED': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'DENIED': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  // Calculate PTO percentages
  const vacationUsedPercent = ptoBalance ? (ptoBalance.usedVacation / ptoBalance.vacationDays) * 100 : 0;
  const sickUsedPercent = ptoBalance ? (ptoBalance.usedSick / ptoBalance.sickDays) * 100 : 0;
  const personalUsedPercent = ptoBalance ? (ptoBalance.usedPersonal / ptoBalance.personalDays) * 100 : 0;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <Breadcrumbs />

      {/* Header with Profile */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={user?.profilePhoto} alt={`${user?.firstName} ${user?.lastName}`} />
            <AvatarFallback className="text-lg bg-primary text-white">
              {getInitials(user?.firstName, user?.lastName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Welcome back, {user?.firstName}!
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              {user?.position} • {user?.department || 'No Department'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setProfileForm({
                phone: user?.phone || '',
                emergencyContactName: user?.emergencyContactName || '',
                emergencyContactPhone: user?.emergencyContactPhone || '',
                address: user?.address || '',
                preferredName: user?.preferredName || '',
                birthday: user?.birthday || ''
              });
              setShowEditProfile(true);
            }}
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Profile
          </Button>
          {userGetsPto && (
            <Link to="/pto">
              <Button size="sm">
                <Calendar className="w-4 h-4 mr-2" />
                Request PTO
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* PTO Balance Cards */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Umbrella className="w-5 h-5 text-blue-600 dark:text-blue-300" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Vacation Days</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {(ptoBalance?.vacationDays || 0) - (ptoBalance?.usedVacation || 0)}
                    <span className="text-sm font-normal text-gray-500"> / {ptoBalance?.vacationDays || 0}</span>
                  </p>
                </div>
              </div>
            </div>
            <Progress value={vacationUsedPercent} className="h-2" />
            <p className="text-xs text-gray-500 mt-1">
              {ptoBalance?.usedVacation || 0} days used
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
                  <Heart className="w-5 h-5 text-red-600 dark:text-red-300" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Sick Days</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {(ptoBalance?.sickDays || 0) - (ptoBalance?.usedSick || 0)}
                    <span className="text-sm font-normal text-gray-500"> / {ptoBalance?.sickDays || 0}</span>
                  </p>
                </div>
              </div>
            </div>
            <Progress value={sickUsedPercent} className="h-2 [&>div]:bg-red-500" />
            <p className="text-xs text-gray-500 mt-1">
              {ptoBalance?.usedSick || 0} days used
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <Coffee className="w-5 h-5 text-purple-600 dark:text-purple-300" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Personal Days</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {(ptoBalance?.personalDays || 0) - (ptoBalance?.usedPersonal || 0)}
                    <span className="text-sm font-normal text-gray-500"> / {ptoBalance?.personalDays || 0}</span>
                  </p>
                </div>
              </div>
            </div>
            <Progress value={personalUsedPercent} className="h-2 [&>div]:bg-purple-500" />
            <p className="text-xs text-gray-500 mt-1">
              {ptoBalance?.usedPersonal || 0} days used
            </p>
          </CardContent>
        </Card>
      </div>

      {/* PTO Usage Reminder */}
      <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
        <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span><strong>Reminder:</strong> You must use 5 PTO days during January, February, or December each year.</span>
        </p>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Profile & Quick Actions */}
        <div className="space-y-6">
          {/* Profile Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">My Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">{user?.email}</span>
              </div>
              {user?.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{user?.phone}</span>
                </div>
              )}
              {user?.department && (
                <div className="flex items-center gap-3">
                  <Building className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{user?.department}</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Briefcase className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">{user?.position || 'No Position'}</span>
              </div>
              {user?.hireDate && (
                <div className="flex items-center gap-3">
                  <CalendarDays className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Hired: {formatDate(user.hireDate)}
                  </span>
                </div>
              )}
              <Button
                variant="outline"
                className="w-full mt-2"
                onClick={() => {
                  setProfileForm({
                    phone: user?.phone || '',
                    emergencyContactName: user?.emergencyContactName || '',
                    emergencyContactPhone: user?.emergencyContactPhone || '',
                    address: user?.address || '',
                    preferredName: user?.preferredName || '',
                    birthday: user?.birthday || ''
                  });
                  setShowEditProfile(true);
                }}
              >
                <Edit className="w-4 h-4 mr-2" />
                Update My Info
              </Button>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {userGetsPto && (
                <Link to="/pto" className="block">
                  <Button variant="ghost" className="w-full justify-start">
                    <Calendar className="w-4 h-4 mr-3 text-blue-500" />
                    Request Time Off
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  </Button>
                </Link>
              )}
              <Link to="/documents" className="block">
                <Button variant="ghost" className="w-full justify-start">
                  <FileText className="w-4 h-4 mr-3 text-green-500" />
                  View Documents
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </Button>
              </Link>
              <Link to="/contracts" className="block">
                <Button variant="ghost" className="w-full justify-start">
                  <Award className="w-4 h-4 mr-3 text-purple-500" />
                  My Contracts
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </Button>
              </Link>
              <Link to="/attendance" className="block">
                <Button variant="ghost" className="w-full justify-start">
                  <Clock className="w-4 h-4 mr-3 text-orange-500" />
                  Check In
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Center Column - Activity & PTO */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="calendar" className="w-full">
            <TabsList className={`grid w-full ${userGetsPto ? 'grid-cols-6' : 'grid-cols-5'}`}>
              <TabsTrigger value="calendar">My Calendar</TabsTrigger>
              {userGetsPto && <TabsTrigger value="pto">My PTO</TabsTrigger>}
              <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
              <TabsTrigger value="pending">Pending Actions</TabsTrigger>
              <TabsTrigger value="activity">Recent Activity</TabsTrigger>
              <TabsTrigger value="orgchart">Org Chart</TabsTrigger>
            </TabsList>

            {/* Calendar Tab */}
            <TabsContent value="calendar" className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle>My Calendar</CardTitle>
                    <CardDescription>View your schedule, PTO, and events</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setEventToEdit(null);
                        setSelectedDateForNew(undefined);
                        setShowEventModal(true);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Event
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    >
                      &lt;
                    </Button>
                    <span className="text-sm font-medium min-w-[140px] text-center">
                      {format(currentMonth, 'MMMM yyyy')}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    >
                      &gt;
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Event Type Legend */}
                  <div className="flex flex-wrap gap-3 mb-4 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded bg-green-500" />
                      <span>Meetings</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded bg-blue-500" />
                      <span>Interviews</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded bg-red-500" />
                      <span>My PTO</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded bg-purple-500" />
                      <span>Team PTO</span>
                    </div>
                  </div>

                  {/* Calendar Grid */}
                  <div className="border rounded-lg overflow-hidden dark:border-gray-700">
                    {/* Day Headers */}
                    <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                        <div key={day} className="p-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* Calendar Days */}
                    <div className="grid grid-cols-7">
                      {calendarDays.map((day, idx) => {
                        const dayEvents = getEventsForDay(day);
                        const inCurrentMonth = isSameMonth(day, currentMonth);
                        const isCurrentDay = isToday(day);

                        return (
                          <div
                            key={idx}
                            onClick={(e) => {
                              // Only open create modal if clicking on the day cell itself, not on an event
                              if ((e.target as HTMLElement).closest('button')) return;
                              setEventToEdit(null);
                              setSelectedDateForNew(day);
                              setShowEventModal(true);
                            }}
                            className={`min-h-[80px] p-1 border-b border-r dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors ${
                              !inCurrentMonth ? 'bg-gray-50 dark:bg-gray-800/50' : ''
                            } ${isCurrentDay ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                          >
                            <div className={`text-xs mb-1 ${
                              !inCurrentMonth ? 'text-gray-400' :
                              isCurrentDay ? 'font-bold text-blue-600 dark:text-blue-400' :
                              'text-gray-700 dark:text-gray-300'
                            }`}>
                              {format(day, 'd')}
                            </div>
                            <div className="space-y-0.5">
                              {dayEvents.slice(0, 2).map((event) => {
                                const colors = eventTypeColors[event.type] || eventTypeColors.MEETING;
                                return (
                                  <button
                                    key={event.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedEvent(event);
                                    }}
                                    className={`w-full text-left px-1 py-0.5 text-xs rounded truncate ${colors.bg} ${colors.text} hover:opacity-80`}
                                  >
                                    {event.title}
                                  </button>
                                );
                              })}
                              {dayEvents.length > 2 && (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-xs text-blue-600 dark:text-blue-400 px-1 hover:underline cursor-pointer"
                                    >
                                      +{dayEvents.length - 2} more
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-64 p-2" align="start">
                                    <div className="text-sm font-medium mb-2 text-gray-900 dark:text-white">
                                      {format(day, 'MMMM d, yyyy')}
                                    </div>
                                    <div className="space-y-1 max-h-48 overflow-y-auto">
                                      {dayEvents.map((event) => {
                                        const colors = eventTypeColors[event.type] || eventTypeColors.MEETING;
                                        return (
                                          <button
                                            key={event.id}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedEvent(event);
                                            }}
                                            className={`w-full text-left px-2 py-1 text-xs rounded truncate ${colors.bg} ${colors.text} hover:opacity-80`}
                                          >
                                            {event.title}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Loading State */}
                  {calendarLoading && (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Event Detail Modal */}
              {selectedEvent && (
                <Card className="border-2 border-primary/20">
                  <CardHeader className="flex flex-row items-start justify-between pb-2">
                    <div>
                      <Badge className={`mb-2 ${eventTypeColors[selectedEvent.type]?.bg} ${eventTypeColors[selectedEvent.type]?.text}`}>
                        {selectedEvent.type}
                      </Badge>
                      <CardTitle className="text-lg">{selectedEvent.title}</CardTitle>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedEvent(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {format(new Date(selectedEvent.startDate), 'MMM d, yyyy')}
                        {selectedEvent.startDate !== selectedEvent.endDate && (
                          <> - {format(new Date(selectedEvent.endDate), 'MMM d, yyyy')}</>
                        )}
                      </span>
                    </div>
                    {selectedEvent.meetLink && (
                      <a
                        href={selectedEvent.meetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                      >
                        <Video className="w-4 h-4" />
                        Join Google Meet
                      </a>
                    )}
                    {selectedEvent.location && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <MapPin className="w-4 h-4" />
                        <span>{selectedEvent.location}</span>
                      </div>
                    )}
                    {selectedEvent.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        {selectedEvent.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">Source: {selectedEvent.source}</p>

                    {/* Edit/Delete buttons - only show for user's own events */}
                    {userOwnsEvent(selectedEvent) && (
                      <div className="flex gap-2 mt-4 pt-4 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEventToEdit(selectedEvent as any);
                            setShowEventModal(true);
                          }}
                        >
                          <Pencil className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setEventToDelete(selectedEvent);
                            setShowDeleteDialog(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* PTO Tab */}
            <TabsContent value="pto" className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>My PTO Requests</CardTitle>
                    <CardDescription>Track your time off requests</CardDescription>
                  </div>
                  <Link to="/pto">
                    <Button size="sm">
                      <Calendar className="w-4 h-4 mr-2" />
                      New Request
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {myPtoRequests.length > 0 ? (
                    <div className="space-y-3">
                      {myPtoRequests.slice(0, 5).map((request: any) => (
                        <div
                          key={request.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              request.status === 'APPROVED' ? 'bg-green-100 dark:bg-green-900' :
                              request.status === 'DENIED' ? 'bg-red-100 dark:bg-red-900' :
                              'bg-yellow-100 dark:bg-yellow-900'
                            }`}>
                              {request.status === 'APPROVED' ? (
                                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-300" />
                              ) : request.status === 'DENIED' ? (
                                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-300" />
                              ) : (
                                <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-300" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {formatDate(request.startDate)} - {formatDate(request.endDate)}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {request.days} day{request.days > 1 ? 's' : ''} • {request.reason || 'No reason provided'}
                              </p>
                            </div>
                          </div>
                          <Badge className={getStatusColor(request.status)}>
                            {request.status}
                          </Badge>
                        </div>
                      ))}
                      {myPtoRequests.length > 5 && (
                        <Link to="/pto" className="block text-center">
                          <Button variant="link">View all {myPtoRequests.length} requests</Button>
                        </Link>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Calendar className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                      <p className="text-gray-500 dark:text-gray-400 mb-4">No PTO requests yet</p>
                      <Link to="/pto">
                        <Button>Request Time Off</Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Onboarding Tab */}
            <TabsContent value="onboarding" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-5 h-5" />
                    <CardTitle>My Onboarding Checklist</CardTitle>
                  </div>
                  <CardDescription>Complete your onboarding tasks to get started</CardDescription>
                </CardHeader>
                <CardContent>
                  <OnboardingTaskList />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Pending Actions Tab */}
            <TabsContent value="pending" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Items Needing Your Attention</CardTitle>
                  <CardDescription>Documents to review, contracts to sign, and more</CardDescription>
                </CardHeader>
                <CardContent>
                  {pendingItems.length > 0 ? (
                    <div className="space-y-3">
                      {pendingItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900">
                              <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-300" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{item.title}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">{item.description}</p>
                            </div>
                          </div>
                          <Link to={item.link}>
                            <Button size="sm" variant="outline">{item.action}</Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 mx-auto text-green-300 dark:text-green-600 mb-3" />
                      <p className="text-gray-500 dark:text-gray-400">All caught up! No pending items.</p>
                    </div>
                  )}

                  {/* Documents needing acknowledgment */}
                  {documentsToAck.length > 0 && (
                    <div className="mt-6">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-3">Documents to Acknowledge</h4>
                      <div className="space-y-2">
                        {documentsToAck.map((doc: any) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-3 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20"
                          >
                            <div className="flex items-center gap-3">
                              <FileText className="w-4 h-4 text-orange-600" />
                              <span className="text-sm font-medium">{doc.title}</span>
                            </div>
                            <Button size="sm">Acknowledge</Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Unsigned contracts */}
                  {unsignedContracts.length > 0 && (
                    <div className="mt-6">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <ScrollText className="w-4 h-4" />
                        Contracts Awaiting Your Signature ({unsignedContracts.length})
                      </h4>
                      <div className="space-y-2">
                        {unsignedContracts.map((contract: any) => (
                          <div
                            key={contract.id}
                            className="flex items-center justify-between p-3 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20"
                          >
                            <div className="flex items-center gap-3">
                              <ScrollText className="w-4 h-4 text-purple-600" />
                              <div>
                                <span className="text-sm font-medium block">{contract.templateName || 'Contract'}</span>
                                <span className="text-xs text-gray-500">Sent {contract.sentAt ? format(new Date(contract.sentAt), 'MMM d, yyyy') : 'recently'}</span>
                              </div>
                            </div>
                            <Link to="/contracts">
                              <Button size="sm" className="bg-purple-600 hover:bg-purple-700">Sign Now</Button>
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Active onboarding tasks */}
                  {activeOnboarding.length > 0 && (
                    <div className="mt-6">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <ClipboardList className="w-4 h-4" />
                        Onboarding Checklist
                      </h4>
                      <div className="space-y-3">
                        {activeOnboarding.map((instance: any) => {
                          const progress = instance.progress || { completedSteps: 0, totalSteps: instance.totalSteps || 0, percentage: 0 };
                          const completedSteps = progress.completedSteps || instance.currentStep || 0;
                          const totalSteps = progress.totalSteps || instance.totalSteps || 10;
                          const percentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

                          return (
                            <div
                              key={instance.id}
                              className="p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <ClipboardList className="w-4 h-4 text-blue-600" />
                                  <span className="text-sm font-medium">{instance.notes || 'Onboarding Tasks'}</span>
                                </div>
                                <Badge variant="outline" className="text-blue-600 border-blue-300">
                                  {instance.status === 'NOT_STARTED' ? 'Not Started' : 'In Progress'}
                                </Badge>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                                  <span>{completedSteps} of {totalSteps} tasks completed</span>
                                  <span>{percentage}%</span>
                                </div>
                                <Progress value={percentage} className="h-2" />
                              </div>
                              <div className="mt-3 flex justify-end">
                                <Link to="/onboarding-templates">
                                  <Button size="sm" variant="outline">View Tasks</Button>
                                </Link>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Your recent actions and updates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {myPtoRequests.slice(0, 3).map((request: any) => (
                      <div key={request.id} className="flex items-start gap-3">
                        <div className={`mt-1 p-1.5 rounded-full ${
                          request.status === 'APPROVED' ? 'bg-green-100' :
                          request.status === 'DENIED' ? 'bg-red-100' :
                          'bg-yellow-100'
                        }`}>
                          <Calendar className={`w-3 h-3 ${
                            request.status === 'APPROVED' ? 'text-green-600' :
                            request.status === 'DENIED' ? 'text-red-600' :
                            'text-yellow-600'
                          }`} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            PTO Request {request.status.toLowerCase()}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDate(request.startDate)} - {formatDate(request.endDate)}
                          </p>
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(request.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                    {myPtoRequests.length === 0 && (
                      <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                        No recent activity to display
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Org Chart Tab */}
            <TabsContent value="orgchart" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-5 h-5" />
                    <CardTitle>Organization Chart</CardTitle>
                  </div>
                  <CardDescription>View the company structure and reporting relationships</CardDescription>
                </CardHeader>
                <CardContent>
                  <OrgChart readOnly={true} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Team Directory Teaser - if user has team members */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Team Directory</CardTitle>
                <CardDescription>Connect with your colleagues</CardDescription>
              </div>
              <Link to="/team-directory">
                <Button variant="outline" size="sm">
                  <Users className="w-4 h-4 mr-2" />
                  View All
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                View your team members and their contact information.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Event Create/Edit Modal */}
      <EventFormModal
        open={showEventModal}
        onClose={() => {
          setShowEventModal(false);
          setEventToEdit(null);
          setSelectedDateForNew(undefined);
          setSelectedEvent(null);
        }}
        event={eventToEdit ? {
          id: eventToEdit.id,
          type: eventToEdit.type === 'TEAM_PTO' ? 'PTO' : eventToEdit.type as 'MEETING' | 'PTO' | 'INTERVIEW' | 'OTHER',
          title: eventToEdit.title,
          description: eventToEdit.description,
          startDate: eventToEdit.startDate,
          endDate: eventToEdit.endDate,
          location: eventToEdit.location,
          allDay: eventToEdit.allDay,
          meetLink: eventToEdit.meetLink,
          ptoType: eventToEdit.ptoType,
        } : null}
        selectedDate={selectedDateForNew}
      />

      {/* Delete Event Confirmation Dialog */}
      <DeleteEventDialog
        open={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setEventToDelete(null);
          setSelectedEvent(null);
        }}
        event={eventToDelete ? {
          id: eventToDelete.id,
          title: eventToDelete.title,
          googleEventId: eventToDelete.googleEventId,
        } : null}
      />

      {/* Edit Profile Dialog */}
      <Dialog open={showEditProfile} onOpenChange={setShowEditProfile}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit My Profile</DialogTitle>
            <DialogDescription>
              Update your personal information
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="preferredName">Preferred Name / Nickname</Label>
              <Input
                id="preferredName"
                value={profileForm.preferredName}
                onChange={(e) => setProfileForm(prev => ({ ...prev, preferredName: e.target.value }))}
                placeholder="e.g., Danny"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={profileForm.phone}
                onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={profileForm.address}
                onChange={(e) => setProfileForm(prev => ({ ...prev, address: e.target.value }))}
                placeholder="123 Main St, City, State ZIP"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="birthday">Birthday</Label>
              <Input
                id="birthday"
                type="date"
                value={profileForm.birthday}
                onChange={(e) => setProfileForm(prev => ({ ...prev, birthday: e.target.value }))}
              />
            </div>
            <div className="border-t pt-4 mt-2">
              <h4 className="font-medium mb-3">Emergency Contact</h4>
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="emergencyContactName">Contact Name</Label>
                  <Input
                    id="emergencyContactName"
                    value={profileForm.emergencyContactName}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, emergencyContactName: e.target.value }))}
                    placeholder="Jane Doe"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="emergencyContactPhone">Contact Phone</Label>
                  <Input
                    id="emergencyContactPhone"
                    type="tel"
                    value={profileForm.emergencyContactPhone}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, emergencyContactPhone: e.target.value }))}
                    placeholder="(555) 987-6543"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditProfile(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => updateProfileMutation.mutate(profileForm)}
              disabled={updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default EmployeeDashboard;
