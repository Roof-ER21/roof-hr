/**
 * Unified Dashboard - Power User Overview
 * Aggregates key metrics from ALL systems in one view
 * Real-time alerts, activity feed, and quick actions
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Users, Calendar, Briefcase, TrendingUp, Activity, Database,
  Mail, Cloud, Server, Zap, AlertTriangle, CheckCircle, Clock,
  RefreshCw, ArrowUp, ArrowDown, Eye, Play, Bell
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip
} from 'recharts';

interface DashboardMetrics {
  activeEmployees: number;
  pendingPTO: number;
  openPositions: number;
  turnoverRate: number;
  activeWorkflows: number;
  activeCampaigns: number;
}

interface ServiceStatus {
  database: { status: string; message: string; latency?: number };
  email: { status: string; message: string };
  google: { status: string; message: string };
  agents: { status: string; message: string; activeCount?: number };
  cache: { status: string; message: string };
  api: { status: string; message: string; avgResponseTime?: number };
}

interface AuditLog {
  id: string;
  userEmail: string;
  action: string;
  resourceType: string;
  createdAt: string;
}

interface DetectedIssue {
  id: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
}

// Mini sparkline data for trends
const trendData = [
  { v: 28 }, { v: 29 }, { v: 30 }, { v: 28 }, { v: 31 },
  { v: 32 }, { v: 33 }, { v: 32 }, { v: 34 }, { v: 35 }
];

const statusColors = {
  healthy: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
  connected: 'bg-green-500',
  unknown: 'bg-gray-400'
};

export function UnifiedDashboard() {
  // Fetch all data sources
  const { data: metrics } = useQuery<DashboardMetrics>({
    queryKey: ['/api/dashboard/metrics'],
    refetchInterval: 30000
  });

  const { data: serviceStatus } = useQuery<ServiceStatus>({
    queryKey: ['/api/super-admin/services-status'],
    refetchInterval: 30000
  });

  const { data: issues = [] } = useQuery<DetectedIssue[]>({
    queryKey: ['/api/super-admin/detected-issues']
  });

  const { data: auditLogs = [] } = useQuery<AuditLog[]>({
    queryKey: ['/api/super-admin/audit-logs'],
    select: (data) => (data || []).slice(0, 8)
  });

  const { data: workflows = [] } = useQuery<any[]>({
    queryKey: ['/api/workflows']
  });

  const { data: agents = [] } = useQuery<any[]>({
    queryKey: ['/api/hr-agents']
  });

  // Count critical/warning issues
  const criticalIssues = issues.filter(i => i.severity === 'high').length;
  const warningIssues = issues.filter(i => i.severity === 'medium').length;

  // Calculate overall system health
  const services = serviceStatus ? Object.values(serviceStatus) : [];
  const healthyServices = services.filter(s => s.status === 'healthy' || s.status === 'connected').length;
  const totalServices = services.length || 1;
  const healthPercent = Math.round((healthyServices / totalServices) * 100);

  return (
    <div className="space-y-6">
      {/* Header with Overall Health */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5" />
            System Overview
          </h3>
          <p className="text-sm text-gray-600">Real-time status across all systems</p>
        </div>
        <div className="flex items-center gap-4">
          {criticalIssues > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="w-3 h-3" />
              {criticalIssues} Critical
            </Badge>
          )}
          {warningIssues > 0 && (
            <Badge variant="outline" className="text-yellow-600 border-yellow-300 gap-1">
              <AlertTriangle className="w-3 h-3" />
              {warningIssues} Warning
            </Badge>
          )}
          <div className="flex items-center gap-2">
            <div className="w-24">
              <Progress value={healthPercent} className="h-2" />
            </div>
            <span className="text-sm font-medium">{healthPercent}% Healthy</span>
          </div>
        </div>
      </div>

      {/* KPI Cards - Row 1: Business Metrics */}
      <div className="grid grid-cols-6 gap-4">
        <Card className="col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Users className="w-5 h-5 text-blue-500" />
              <div className="w-16 h-8">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <Line type="monotone" dataKey="v" stroke="#3B82F6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <p className="text-2xl font-bold mt-2">{metrics?.activeEmployees || 0}</p>
            <p className="text-xs text-gray-500">Active Employees</p>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Calendar className="w-5 h-5 text-yellow-500" />
              <Badge variant="secondary" className="text-xs">{metrics?.pendingPTO || 0} pending</Badge>
            </div>
            <p className="text-2xl font-bold mt-2">{metrics?.pendingPTO || 0}</p>
            <p className="text-xs text-gray-500">PTO Requests</p>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Briefcase className="w-5 h-5 text-green-500" />
              <span className="text-xs text-green-600 flex items-center">
                <ArrowUp className="w-3 h-3" />2
              </span>
            </div>
            <p className="text-2xl font-bold mt-2">{metrics?.openPositions || 0}</p>
            <p className="text-xs text-gray-500">Open Positions</p>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <TrendingUp className="w-5 h-5 text-red-500" />
              <span className="text-xs text-green-600 flex items-center">
                <ArrowDown className="w-3 h-3" />2%
              </span>
            </div>
            <p className="text-2xl font-bold mt-2">{metrics?.turnoverRate || 0}%</p>
            <p className="text-xs text-gray-500">Turnover Rate</p>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Zap className="w-5 h-5 text-purple-500" />
              <Badge variant="outline" className="text-xs">
                {workflows.filter((w: any) => w.isActive).length} active
              </Badge>
            </div>
            <p className="text-2xl font-bold mt-2">{workflows.length}</p>
            <p className="text-xs text-gray-500">Workflows</p>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Bell className="w-5 h-5 text-orange-500" />
              <Badge variant="outline" className="text-xs">
                {agents.filter((a: any) => a.isActive).length} running
              </Badge>
            </div>
            <p className="text-2xl font-bold mt-2">{agents.length}</p>
            <p className="text-xs text-gray-500">HR Agents</p>
          </CardContent>
        </Card>
      </div>

      {/* Service Status Row */}
      <div className="grid grid-cols-6 gap-4">
        {[
          { key: 'database', icon: Database, label: 'Database', data: serviceStatus?.database },
          { key: 'email', icon: Mail, label: 'Email', data: serviceStatus?.email },
          { key: 'google', icon: Cloud, label: 'Google', data: serviceStatus?.google },
          { key: 'agents', icon: Zap, label: 'Agents', data: serviceStatus?.agents },
          { key: 'cache', icon: Server, label: 'Cache', data: serviceStatus?.cache },
          { key: 'api', icon: Activity, label: 'API', data: serviceStatus?.api }
        ].map(({ key, icon: Icon, label, data }) => (
          <Card key={key} className="col-span-1">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  statusColors[data?.status as keyof typeof statusColors] || 'bg-gray-400'
                )} />
                <Icon className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium">{label}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1 truncate">
                {data?.message || 'Unknown'}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Activity & Alerts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {auditLogs.length > 0 ? auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <Activity className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{log.action}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{log.userEmail?.split('@')[0]}</span>
                        <span>-</span>
                        <span>{log.resourceType}</span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">
                      {format(new Date(log.createdAt), 'HH:mm')}
                    </span>
                  </div>
                )) : (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No recent activity
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Active Alerts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Active Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {issues.length > 0 ? issues.map((issue) => (
                  <div
                    key={issue.id}
                    className={cn(
                      'p-3 rounded-lg border',
                      issue.severity === 'high' && 'bg-red-50 border-red-200',
                      issue.severity === 'medium' && 'bg-yellow-50 border-yellow-200',
                      issue.severity === 'low' && 'bg-blue-50 border-blue-200'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className={cn(
                          'w-4 h-4',
                          issue.severity === 'high' && 'text-red-500',
                          issue.severity === 'medium' && 'text-yellow-500',
                          issue.severity === 'low' && 'text-blue-500'
                        )} />
                        <span className="text-sm font-medium">{issue.title}</span>
                      </div>
                      <Badge variant="outline" className={cn(
                        'text-xs',
                        issue.severity === 'high' && 'text-red-600 border-red-300',
                        issue.severity === 'medium' && 'text-yellow-600 border-yellow-300',
                        issue.severity === 'low' && 'text-blue-600 border-blue-300'
                      )}>
                        {issue.severity}
                      </Badge>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-2" />
                    <p className="text-sm text-gray-500">All systems healthy</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1">
              <RefreshCw className="w-3 h-3" />
              Refresh All
            </Button>
            <Button variant="outline" size="sm" className="gap-1">
              <Eye className="w-3 h-3" />
              View Logs
            </Button>
            <Button variant="outline" size="sm" className="gap-1">
              <Play className="w-3 h-3" />
              Run Health Check
            </Button>
            <Button variant="outline" size="sm" className="gap-1">
              <Mail className="w-3 h-3" />
              Test Email
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
