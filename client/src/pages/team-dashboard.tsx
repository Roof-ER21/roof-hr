import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { DashboardSkeleton, StatsCardSkeleton } from '@/components/ui/skeleton-patterns';
import { NoPtoRequestsState, NoEmployeesState } from '@/components/ui/empty-state';
import {
  Calendar,
  Clock,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  UserCheck,
  CalendarDays,
  ClipboardList,
  ChevronRight,
  Eye
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position?: string;
  department?: string;
  avatar?: string;
  isActive: boolean;
}

interface PtoRequest {
  id: string;
  employeeId: string;
  employeeName?: string;
  startDate: string;
  endDate: string;
  type: string;
  reason?: string;
  status: string;
  days: number;
  createdAt: string;
}

function TeamDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Check if user is a manager - Ahmed always has access via email fallback
  const isManager = user?.email === 'ahmed.mahmoud@theroofdocs.com' ||
    (user?.role && ['SYSTEM_ADMIN', 'HR_ADMIN', 'GENERAL_MANAGER', 'TERRITORY_MANAGER', 'MANAGER', 'TRUE_ADMIN', 'ADMIN', 'TERRITORY_SALES_MANAGER'].includes(user.role));

  // Fetch team members (direct reports or department)
  const { data: teamMembers = [], isLoading: teamLoading } = useQuery<TeamMember[]>({
    queryKey: ['/api/employee-portal/team'],
    queryFn: async () => {
      const response = await fetch('/api/employee-portal/team', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: isManager
  });

  // Fetch pending PTO requests with employee names
  const { data: pendingPtoRequests = [], isLoading: ptoLoading } = useQuery<PtoRequest[]>({
    queryKey: ['/api/employee-portal/manager/pto-requests', 'pending'],
    queryFn: async () => {
      const response = await fetch('/api/employee-portal/manager/pto-requests', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) return [];
      const data = await response.json();
      return data.filter((r: PtoRequest) => r.status === 'PENDING');
    },
    enabled: isManager
  });

  // Fetch pending reviews count
  const { data: pendingReviewsData } = useQuery<{ reviews: any[]; count: number }>({
    queryKey: ['/api/employee-portal/manager/pending-reviews'],
    queryFn: async () => {
      const response = await fetch('/api/employee-portal/manager/pending-reviews', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) return { reviews: [], count: 0 };
      return response.json();
    },
    enabled: isManager
  });

  // Mutation to approve/deny PTO
  const ptoMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'APPROVED' | 'DENIED' }) => {
      const response = await fetch(`/api/pto/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status })
      });
      if (!response.ok) throw new Error('Failed to update PTO request');
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/pto'] });
      toast({
        title: variables.status === 'APPROVED' ? 'PTO Approved' : 'PTO Denied',
        description: `The PTO request has been ${variables.status.toLowerCase()}.`,
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update PTO request. Please try again.',
        variant: 'destructive'
      });
    }
  });

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  // Calculate stats
  const activeTeamMembers = teamMembers.filter(m => m.isActive !== false).length;
  const sameDeptMembers = teamMembers.filter(m => m.department === user?.department).length;

  if (!isManager) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs />
        <Card className="mt-6">
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Manager Access Required
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              This dashboard is only available to managers and administrators.
            </p>
            <Link to="/my-portal" className="mt-4 inline-block">
              <Button>Go to My Portal</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (teamLoading || ptoLoading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs />
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <Breadcrumbs />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Team Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage your team, approve requests, and track performance
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/employees">
            <Button variant="outline" size="sm">
              <Users className="w-4 h-4 mr-2" />
              All Employees
            </Button>
          </Link>
          <Link to="/pto">
            <Button size="sm">
              <Calendar className="w-4 h-4 mr-2" />
              PTO Calendar
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-300" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeTeamMembers}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Active Team Members</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-300" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{pendingPtoRequests.length}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Pending PTO Requests</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <UserCheck className="w-5 h-5 text-green-600 dark:text-green-300" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{sameDeptMembers}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">In Your Department</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-300" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{pendingReviewsData?.count || 0}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Pending Reviews</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending PTO Requests - Takes 2 columns */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Pending PTO Requests</CardTitle>
                <CardDescription>Review and approve time off requests</CardDescription>
              </div>
              {pendingPtoRequests.length > 0 && (
                <Badge variant="secondary">{pendingPtoRequests.length} pending</Badge>
              )}
            </CardHeader>
            <CardContent>
              {pendingPtoRequests.length > 0 ? (
                <div className="space-y-4">
                  {pendingPtoRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary text-white text-sm">
                            {request.employeeName ? getInitials(request.employeeName.split(' ')[0], request.employeeName.split(' ')[1] || '') : '??'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {request.employeeName || 'Unknown Employee'}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <CalendarDays className="w-3 h-3" />
                            <span>
                              {formatDate(request.startDate)} - {formatDate(request.endDate)}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {request.type}
                            </Badge>
                          </div>
                          {request.reason && (
                            <p className="text-sm text-gray-500 mt-1">{request.reason}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-900/20"
                          onClick={() => ptoMutation.mutate({ id: request.id, status: 'APPROVED' })}
                          disabled={ptoMutation.isPending}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => ptoMutation.mutate({ id: request.id, status: 'DENIED' })}
                          disabled={ptoMutation.isPending}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Deny
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <NoPtoRequestsState />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions - 1 column */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to="/pto" className="block">
                <Button variant="ghost" className="w-full justify-start">
                  <Calendar className="w-4 h-4 mr-3 text-blue-500" />
                  View PTO Calendar
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </Button>
              </Link>
              <Link to="/reviews" className="block">
                <Button variant="ghost" className="w-full justify-start">
                  <ClipboardList className="w-4 h-4 mr-3 text-purple-500" />
                  Performance Reviews
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </Button>
              </Link>
              <Link to="/team-directory" className="block">
                <Button variant="ghost" className="w-full justify-start">
                  <Users className="w-4 h-4 mr-3 text-green-500" />
                  Team Directory
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </Button>
              </Link>
              <Link to="/attendance" className="block">
                <Button variant="ghost" className="w-full justify-start">
                  <Clock className="w-4 h-4 mr-3 text-orange-500" />
                  Attendance Records
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Team Members Preview */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Your Team</CardTitle>
              <Link to="/team-directory">
                <Button variant="ghost" size="sm">
                  <Eye className="w-4 h-4 mr-1" />
                  View All
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {teamMembers.length > 0 ? (
                <div className="space-y-3">
                  {teamMembers.slice(0, 5).map((member) => (
                    <div key={member.id} className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.avatar} alt={`${member.firstName} ${member.lastName}`} />
                        <AvatarFallback className="text-xs bg-gray-200 dark:bg-gray-700">
                          {getInitials(member.firstName, member.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {member.firstName} {member.lastName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {member.position || 'No Position'}
                        </p>
                      </div>
                    </div>
                  ))}
                  {teamMembers.length > 5 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2">
                      +{teamMembers.length - 5} more team members
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  No team members found
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default TeamDashboard;
