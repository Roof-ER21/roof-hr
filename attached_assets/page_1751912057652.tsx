
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Users,
  UserCheck,
  Clock,
  FileText,
  Shield,
  BarChart3,
  Settings,
  AlertTriangle,
  CheckCircle,
  UserPlus,
  Briefcase,
  TrendingUp,
  Building
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MainLayout } from '@/components/layout/main-layout';
import { USER_ROLES } from '@/lib/constants';

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  pendingOnboarding: number;
  pendingPTO: number;
  expiredDocuments: number;
  safetyIncidents: number;
}

interface RecruitingStats {
  totalCandidates: number;
  newApplicants: number;
  acceptedCandidates: number;
  openPositions: number;
  interviewsThisWeek: number;
  candidatesByStage: Record<string, number>;
  recentCandidates: Array<{
    id: string;
    name: string;
    email: string;
    stage: string;
    position: string;
    department: string;
    appliedDate: string;
  }>;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  employmentType: string;
  onboardingStatus: string;
  isActive: boolean;
  hireDate: string;
}

interface PTORequest {
  id: string;
  user: {
    name: string;
    employeeId: string;
  };
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  status: string;
  createdAt: string;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    activeUsers: 0,
    pendingOnboarding: 0,
    pendingPTO: 0,
    expiredDocuments: 0,
    safetyIncidents: 0
  });
  const [recruitingStats, setRecruitingStats] = useState<RecruitingStats>({
    totalCandidates: 0,
    newApplicants: 0,
    acceptedCandidates: 0,
    openPositions: 0,
    interviewsThisWeek: 0,
    candidatesByStage: {},
    recentCandidates: []
  });
  const [users, setUsers] = useState<User[]>([]);
  const [ptoRequests, setPtoRequests] = useState<PTORequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (session?.user?.onboardingStatus === 'PENDING') {
      router.push('/onboarding');
      return;
    }

    // Check if user has admin access
    if (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'OWNER') {
      router.push('/dashboard');
      return;
    }

    fetchAdminData();
  }, [session, status, router]);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      
      // Fetch admin stats
      const statsResponse = await fetch('/api/admin/stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.stats);
      }

      // Fetch recruiting stats
      const recruitingResponse = await fetch('/api/admin/recruiting-stats');
      if (recruitingResponse.ok) {
        const recruitingData = await recruitingResponse.json();
        setRecruitingStats(recruitingData.stats);
      }

      // Fetch users
      const usersResponse = await fetch('/api/admin/users');
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUsers(usersData.users);
      }

      // Fetch pending PTO requests
      const ptoResponse = await fetch('/api/admin/pto-requests');
      if (ptoResponse.ok) {
        const ptoData = await ptoResponse.json();
        setPtoRequests(ptoData.requests);
      }

    } catch (error) {
      console.error('Error fetching admin data:', error);
      setError('Failed to load admin data. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const handlePTOApproval = async (requestId: string, action: 'approve' | 'deny') => {
    try {
      const response = await fetch(`/api/admin/pto-requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      if (!response.ok) throw new Error('Failed to update PTO request');

      // Refresh data
      await fetchAdminData();
    } catch (error) {
      console.error('Error updating PTO request:', error);
      setError('Failed to update PTO request');
    }
  };

  if (status === 'loading' || loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="spinner border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'OWNER')) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-secondary-950 mb-2">Access Denied</h2>
          <p className="text-secondary-600">You don't have permission to access the admin panel.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-secondary-950">Admin Dashboard</h1>
            <p className="text-secondary-600 mt-1">
              Manage users, approve requests, and oversee compliance
            </p>
          </div>
          <Button className="btn-primary flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Add New User
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Admin Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          <Card className="roof-er-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary animate-count-up">
                {stats.totalUsers}
              </div>
            </CardContent>
          </Card>

          <Card className="roof-er-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <UserCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 animate-count-up">
                {stats.activeUsers}
              </div>
            </CardContent>
          </Card>

          <Card className="roof-er-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Onboarding</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600 animate-count-up">
                {stats.pendingOnboarding}
              </div>
            </CardContent>
          </Card>

          <Card className="roof-er-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending PTO</CardTitle>
              <Clock className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600 animate-count-up">
                {stats.pendingPTO}
              </div>
            </CardContent>
          </Card>

          <Card className="roof-er-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expired Docs</CardTitle>
              <FileText className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 animate-count-up">
                {stats.expiredDocuments}
              </div>
            </CardContent>
          </Card>

          <Card className="roof-er-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Safety Incidents</CardTitle>
              <Shield className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600 animate-count-up">
                {stats.safetyIncidents}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recruiting Overview */}
        <Card className="roof-er-shadow border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <UserPlus className="h-5 w-5" />
              Recruiting Overview
            </CardTitle>
            <CardDescription className="text-blue-700">
              Track hiring progress and candidate pipeline
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-600 animate-count-up">
                      {recruitingStats.newApplicants}
                    </p>
                    <p className="text-sm text-blue-700">New Applicants (30d)</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600 animate-count-up">
                      {recruitingStats.acceptedCandidates}
                    </p>
                    <p className="text-sm text-blue-700">Candidates Accepted</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <Briefcase className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-purple-600 animate-count-up">
                      {recruitingStats.openPositions}
                    </p>
                    <p className="text-sm text-blue-700">Open Positions</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                    <Users className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-orange-600 animate-count-up">
                      {recruitingStats.interviewsThisWeek}
                    </p>
                    <p className="text-sm text-blue-700">Interviews This Week</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h4 className="font-medium text-blue-900 mb-1">Pipeline Status</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(recruitingStats.candidatesByStage).map(([stage, count]) => (
                    <Badge key={stage} variant="outline" className="text-blue-700 border-blue-300">
                      {stage.replace('_', ' ')}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button 
                onClick={() => router.push('/recruiting')}
                className="btn-primary"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Manage Recruiting
              </Button>
            </div>

            {recruitingStats.recentCandidates.length > 0 && (
              <div className="mt-6 pt-6 border-t border-blue-200">
                <h4 className="font-medium text-blue-900 mb-3">Recent Candidates</h4>
                <div className="space-y-2">
                  {recruitingStats.recentCandidates.slice(0, 3).map((candidate) => (
                    <div key={candidate.id} className="flex items-center justify-between p-3 bg-white rounded border border-blue-200">
                      <div>
                        <p className="font-medium text-blue-900">{candidate.name}</p>
                        <p className="text-sm text-blue-700">
                          {candidate.position} • {candidate.stage.replace('_', ' ')} • Applied {new Date(candidate.appliedDate).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge 
                        variant={candidate.stage === 'ACCEPTED' ? 'default' : 'outline'}
                        className={candidate.stage === 'ACCEPTED' ? 'bg-green-100 text-green-800' : 'text-blue-700 border-blue-300'}
                      >
                        {candidate.stage.replace('_', ' ')}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="pto">PTO Approvals</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          {/* User Management Tab */}
          <TabsContent value="users" className="space-y-6">
            <Card className="roof-er-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  User Management
                </CardTitle>
                <CardDescription>
                  Manage employee accounts and permissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {users.length === 0 ? (
                    <div className="text-center py-8 text-secondary-500">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No users found</p>
                    </div>
                  ) : (
                    users.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-medium text-secondary-950">{user.name}</h4>
                            <Badge variant={user.isActive ? 'default' : 'secondary'}>
                              {user.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            {user.onboardingStatus !== 'COMPLETED' && (
                              <Badge variant="outline" className="text-yellow-700 border-yellow-300">
                                {user.onboardingStatus}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-secondary-600 space-y-1">
                            <p>Email: {user.email}</p>
                            <p>Role: {USER_ROLES[user.role as keyof typeof USER_ROLES] || user.role}</p>
                            <p>Type: {user.employmentType === 'W2' ? 'W-2 Employee' : '1099 Contractor'}</p>
                            <p>Hired: {new Date(user.hireDate).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm">
                            Edit
                          </Button>
                          <Button variant="outline" size="sm">
                            View Profile
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PTO Approvals Tab */}
          <TabsContent value="pto" className="space-y-6">
            <Card className="roof-er-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  PTO Approval Queue
                </CardTitle>
                <CardDescription>
                  Review and approve time off requests
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {ptoRequests.filter(r => r.status === 'PENDING').length === 0 ? (
                    <div className="text-center py-8 text-secondary-500">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-500" />
                      <p className="text-green-600 font-medium">All requests reviewed!</p>
                      <p className="text-sm">No pending PTO requests</p>
                    </div>
                  ) : (
                    ptoRequests.filter(r => r.status === 'PENDING').map((request) => (
                      <div key={request.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-medium text-secondary-950">
                              {request.user.name} ({request.user.employeeId})
                            </h4>
                            <p className="text-sm text-secondary-600">
                              {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge variant="secondary">Pending</Badge>
                        </div>
                        <div className="text-sm text-secondary-600 mb-4">
                          <p><strong>Duration:</strong> {request.days} day{request.days !== 1 ? 's' : ''}</p>
                          {request.reason && (
                            <p><strong>Reason:</strong> {request.reason}</p>
                          )}
                          <p><strong>Requested:</strong> {new Date(request.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            onClick={() => handlePTOApproval(request.id, 'approve')}
                            className="btn-primary"
                            size="sm"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button 
                            onClick={() => handlePTOApproval(request.id, 'deny')}
                            variant="outline" 
                            size="sm"
                            className="text-red-600 border-red-300 hover:bg-red-50"
                          >
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            Deny
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-6">
            <Card className="roof-er-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Document Compliance
                </CardTitle>
                <CardDescription>
                  Monitor document requirements and compliance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-secondary-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Document compliance tracking</p>
                  <p className="text-sm">Feature coming soon</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6">
            <Card className="roof-er-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Analytics & Reports
                </CardTitle>
                <CardDescription>
                  Generate compliance and HR reports
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-secondary-500">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Analytics dashboard</p>
                  <p className="text-sm">Feature coming soon</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
