import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  CalendarClock, 
  Briefcase, 
  DollarSign,
  TrendingUp,
  Check,
  UserPlus,
  Calendar,
  UserCheck,
  QrCode,
  FileText
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { usePermissions } from '@/hooks/usePermissions';
import { employeeGetsPto } from '@shared/constants/roles';

function Dashboard() {
  const { user } = useAuth();
  const { isManager, canViewResource } = usePermissions();

  // Check if user is eligible for PTO
  const userGetsPto = employeeGetsPto({ department: user?.department, employmentType: user?.employmentType });

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['/api/dashboard/metrics'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/metrics', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch metrics');
      return response.json();
    }
  });

  const { data: ptoRequests, isLoading: ptoLoading } = useQuery({
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

  const { data: candidates, isLoading: candidatesLoading } = useQuery({
    queryKey: ['/api/candidates'],
    queryFn: async () => {
      const response = await fetch('/api/candidates', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch candidates');
      return response.json();
    },
    enabled: isManager() // Only fetch for managers and admins
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
    enabled: isManager() // Only fetch for managers and admins
  });

  const pendingPTO = ptoRequests?.filter((request: any) => request.status === 'PENDING') || [];
  const activeCandidates = candidates?.filter((candidate: any) => 
    candidate.status !== 'REJECTED' && candidate.status !== 'HIRED'
  ) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'APPROVED': return 'bg-green-100 text-green-800';
      case 'DENIED': return 'bg-red-100 text-red-800';
      case 'APPLIED': return 'bg-blue-100 text-blue-800';
      case 'INTERVIEW': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getUserById = (id: string) => {
    return users?.find((u: any) => u.id === id);
  };

  if (metricsLoading || ptoLoading || candidatesLoading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {/* Stats Grid - Role Based */}
      {isManager() ? (
        // Manager/Admin Stats
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5 mb-8">
          <Card className="animate-fade-in">
            <CardContent className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-secondary-500 truncate">
                      Active Employees
                    </dt>
                    <dd className="text-2xl font-semibold text-secondary-900 animate-count-up">
                      {metrics?.activeEmployees || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="animate-fade-in">
            <CardContent className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CalendarClock className="w-6 h-6 text-yellow-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-secondary-500 truncate">
                      Pending PTO
                    </dt>
                    <dd className="text-2xl font-semibold text-secondary-900 animate-count-up">
                      {metrics?.pendingPTO || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="animate-fade-in">
            <CardContent className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Briefcase className="w-6 h-6 text-blue-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-secondary-500 truncate">
                      Active Candidates
                    </dt>
                    <dd className="text-2xl font-semibold text-secondary-900 animate-count-up">
                      {metrics?.activeCandidates || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="animate-fade-in">
            <CardContent className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <DollarSign className="w-6 h-6 text-green-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-secondary-500 truncate">
                      Team Revenue
                    </dt>
                    <dd className="text-2xl font-semibold text-secondary-900 animate-count-up">
                      ${metrics?.teamRevenue?.toLocaleString() || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="animate-fade-in">
            <CardContent className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <TrendingUp className="w-6 h-6 text-blue-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-secondary-500 truncate">
                      Team Signups
                    </dt>
                    <dd className="text-2xl font-semibold text-secondary-900 animate-count-up">
                      {metrics?.teamSignups || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        // Employee Stats
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="animate-fade-in">
            <CardContent className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CalendarClock className="w-6 h-6 text-yellow-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-secondary-500 truncate">
                      My PTO Requests
                    </dt>
                    <dd className="text-2xl font-semibold text-secondary-900 animate-count-up">
                      {ptoRequests?.filter((r: any) => r.employeeId === user?.id).length || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="animate-fade-in">
            <CardContent className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Check className="w-6 h-6 text-green-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-secondary-500 truncate">
                      Approved PTO
                    </dt>
                    <dd className="text-2xl font-semibold text-secondary-900 animate-count-up">
                      {ptoRequests?.filter((r: any) => r.employeeId === user?.id && r.status === 'APPROVED').length || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="animate-fade-in">
            <CardContent className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Calendar className="w-6 h-6 text-blue-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-secondary-500 truncate">
                      Days Used
                    </dt>
                    <dd className="text-2xl font-semibold text-secondary-900 animate-count-up">
                      {ptoRequests?.filter((r: any) => r.employeeId === user?.id && r.status === 'APPROVED')
                        .reduce((sum: number, r: any) => sum + r.days, 0) || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="animate-fade-in">
            <CardContent className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FileText className="w-6 h-6 text-purple-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-secondary-500 truncate">
                      My Documents
                    </dt>
                    <dd className="text-2xl font-semibold text-secondary-900 animate-count-up">
                      {metrics?.myDocuments || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Content Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Recent Activities - Role Based */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isManager() ? (
                <>
                  {/* Manager view - Team activities */}
                  {pendingPTO.slice(0, 3).map((request: any) => {
                    const employee = getUserById(request.employeeId);
                    return (
                      <div key={request.id} className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                            <Calendar className="w-4 h-4 text-yellow-600" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-secondary-900">
                            {employee?.firstName} {employee?.lastName} requested PTO
                          </p>
                          <p className="text-sm text-secondary-500">
                            {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  
                  {activeCandidates.slice(0, 2).map((candidate: any) => (
                    <div key={candidate.id} className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <UserPlus className="w-4 h-4 text-blue-600" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-secondary-900">
                          New candidate {candidate.firstName} {candidate.lastName} applied
                        </p>
                        <p className="text-sm text-secondary-500">
                          {candidate.position}
                        </p>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {/* Employee view - Personal activities */}
                  {ptoRequests?.filter((r: any) => r.employeeId === user?.id)
                    .slice(0, 5)
                    .map((request: any) => (
                      <div key={request.id} className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            request.status === 'APPROVED' ? 'bg-green-100' :
                            request.status === 'DENIED' ? 'bg-red-100' :
                            'bg-yellow-100'
                          }`}>
                            <Calendar className={`w-4 h-4 ${
                              request.status === 'APPROVED' ? 'text-green-600' :
                              request.status === 'DENIED' ? 'text-red-600' :
                              'text-yellow-600'
                            }`} />
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-secondary-900">
                            PTO Request {request.status.toLowerCase()}
                          </p>
                          <p className="text-sm text-secondary-500">
                            {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  
                  {(!ptoRequests || ptoRequests.filter((r: any) => r.employeeId === user?.id).length === 0) && (
                    <p className="text-sm text-secondary-500">No recent activities</p>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions - Role Based */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {/* Employee Actions */}
              {!isManager() && (
                <>
                  {userGetsPto && (
                    <Button
                      variant="outline"
                      className="flex flex-col items-center p-4 h-auto"
                      onClick={() => window.location.href = '/pto'}
                    >
                      <Calendar className="w-8 h-8 text-primary mb-2" />
                      <span className="text-sm font-medium">Request PTO</span>
                    </Button>
                  )}

                  <Button 
                    variant="outline" 
                    className="flex flex-col items-center p-4 h-auto"
                    onClick={() => window.location.href = '/profile'}
                  >
                    <UserCheck className="w-8 h-8 text-primary mb-2" />
                    <span className="text-sm font-medium">My Profile</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="flex flex-col items-center p-4 h-auto"
                    onClick={() => window.location.href = '/documents'}
                  >
                    <FileText className="w-8 h-8 text-primary mb-2" />
                    <span className="text-sm font-medium">My Documents</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="flex flex-col items-center p-4 h-auto"
                    onClick={() => window.location.href = '/performance'}
                  >
                    <TrendingUp className="w-8 h-8 text-primary mb-2" />
                    <span className="text-sm font-medium">My Reviews</span>
                  </Button>
                </>
              )}
              
              {/* Manager/Admin Actions */}
              {isManager() && (
                <>
                  <Button 
                    variant="outline" 
                    className="flex flex-col items-center p-4 h-auto"
                    onClick={() => window.location.href = '/employees'}
                  >
                    <UserPlus className="w-8 h-8 text-primary mb-2" />
                    <span className="text-sm font-medium">Manage Team</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="flex flex-col items-center p-4 h-auto"
                    onClick={() => window.location.href = '/pto'}
                  >
                    <UserCheck className="w-8 h-8 text-primary mb-2" />
                    <span className="text-sm font-medium">Approve PTO</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="flex flex-col items-center p-4 h-auto"
                    onClick={() => window.location.href = '/performance'}
                  >
                    <TrendingUp className="w-8 h-8 text-primary mb-2" />
                    <span className="text-sm font-medium">Team Reviews</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="flex flex-col items-center p-4 h-auto"
                    onClick={() => window.location.href = '/recruiting'}
                  >
                    <Briefcase className="w-8 h-8 text-primary mb-2" />
                    <span className="text-sm font-medium">Recruitment</span>
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Tables - Role Based */}
      <div className="mt-8 grid grid-cols-1 gap-8">
        {/* Employee View - My PTO Requests */}
        {!isManager() && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>My PTO Requests</CardTitle>
              <Button variant="link" onClick={() => window.location.href = '/pto'}>
                View All
              </Button>
            </CardHeader>
            <CardContent>
              {ptoRequests?.filter((r: any) => r.employeeId === user?.id).length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Dates</th>
                        <th className="text-left py-2">Days</th>
                        <th className="text-left py-2">Reason</th>
                        <th className="text-left py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ptoRequests
                        ?.filter((r: any) => r.employeeId === user?.id)
                        .slice(0, 5)
                        .map((request: any) => (
                          <tr key={request.id} className="border-b">
                            <td className="py-2">
                              {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                            </td>
                            <td className="py-2">{request.days}</td>
                            <td className="py-2">{request.reason}</td>
                            <td className="py-2">
                              <Badge className={getStatusColor(request.status)}>
                                {request.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-secondary-500">No PTO requests found</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Manager View - Team PTO Requests */}
        {isManager() && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Pending PTO Requests</CardTitle>
                <Button variant="link" onClick={() => window.location.href = '/pto'}>
                  View All
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Employee</th>
                        <th className="text-left py-2">Dates</th>
                        <th className="text-left py-2">Days</th>
                        <th className="text-left py-2">Reason</th>
                        <th className="text-left py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingPTO.slice(0, 5).map((request: any) => {
                        const employee = getUserById(request.employeeId);
                        return (
                          <tr key={request.id} className="border-b">
                            <td className="py-2">
                              <div className="flex items-center">
                                <div className="w-8 h-8 bg-secondary-200 rounded-full flex items-center justify-center mr-3">
                                  <span className="text-xs font-medium">
                                    {employee?.firstName?.[0]}{employee?.lastName?.[0]}
                                  </span>
                                </div>
                                <div>
                                  <div className="font-medium">{employee?.firstName} {employee?.lastName}</div>
                                  <div className="text-sm text-secondary-500">{employee?.position}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-2">
                              {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                            </td>
                            <td className="py-2">{request.days}</td>
                            <td className="py-2">{request.reason}</td>
                            <td className="py-2">
                              <Badge className={getStatusColor(request.status)}>
                                {request.status}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Recruiting Pipeline - Only for Managers */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recruiting Pipeline</CardTitle>
                <Button variant="link" onClick={() => window.location.href = '/recruiting'}>
                  View All
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Candidate</th>
                        <th className="text-left py-2">Position</th>
                        <th className="text-left py-2">Stage</th>
                        <th className="text-left py-2">Applied</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeCandidates.slice(0, 5).map((candidate: any) => (
                        <tr key={candidate.id} className="border-b">
                          <td className="py-2">
                            <div className="flex items-center">
                              <div className="w-8 h-8 bg-secondary-200 rounded-full flex items-center justify-center mr-3">
                                <span className="text-xs font-medium">
                                  {candidate.firstName?.[0]}{candidate.lastName?.[0]}
                                </span>
                              </div>
                              <div>
                                <div className="font-medium">{candidate.firstName} {candidate.lastName}</div>
                                <div className="text-sm text-secondary-500">{candidate.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2">{candidate.position}</td>
                          <td className="py-2">
                            <Badge className={getStatusColor(candidate.status)}>
                              {candidate.status}
                            </Badge>
                          </td>
                          <td className="py-2">
                            {new Date(candidate.appliedDate).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
