import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  Database, 
  HardDrive,
  Users,
  FileText,
  Bot,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface SystemMetrics {
  database: {
    connected: boolean;
    responseTime: number;
    activeConnections: number;
  };
  api: {
    uptime: number;
    requestsPerMinute: number;
    errorRate: number;
  };
  agents: {
    active: number;
    total: number;
    lastRun: string;
  };
  storage: {
    documents: number;
    totalSize: string;
    remaining: string;
  };
  users: {
    total: number;
    active: number;
    admins: number;
  };
}

export function SystemHealthDashboard() {
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const { data: metrics, isLoading, refetch } = useQuery<SystemMetrics>({
    queryKey: ['/api/system/health'],
    queryFn: async () => {
      const res = await fetch('/api/system/health', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch system health');
      return res.json();
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const getHealthStatus = () => {
    if (!metrics) return 'unknown';
    
    const issues = [];
    if (!metrics.database.connected) issues.push('Database disconnected');
    if (metrics.database.responseTime > 1000) issues.push('Slow database');
    if (metrics.api.errorRate > 5) issues.push('High error rate');
    
    if (issues.length === 0) return 'healthy';
    if (issues.length === 1) return 'warning';
    return 'critical';
  };

  const healthStatus = getHealthStatus();

  const handleRefresh = () => {
    refetch();
    setLastRefresh(new Date());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">System Health Dashboard</h2>
          <p className="text-muted-foreground">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <Badge 
            variant={
              healthStatus === 'healthy' ? 'default' : 
              healthStatus === 'warning' ? 'secondary' : 
              'destructive'
            }
            className="px-3 py-1"
          >
            {healthStatus === 'healthy' && <CheckCircle className="h-4 w-4 mr-1" />}
            {healthStatus === 'warning' && <AlertCircle className="h-4 w-4 mr-1" />}
            {healthStatus === 'critical' && <Activity className="h-4 w-4 mr-1" />}
            System {healthStatus.charAt(0).toUpperCase() + healthStatus.slice(1)}
          </Badge>
          
          <Button onClick={handleRefresh} size="sm" variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Critical Alerts */}
      {healthStatus !== 'healthy' && metrics && (
        <Alert variant={healthStatus === 'critical' ? 'destructive' : 'default'}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {!metrics.database.connected && 'Database connection lost. '}
            {metrics.database.responseTime > 1000 && `Slow database response (${metrics.database.responseTime}ms). `}
            {metrics.api.errorRate > 5 && `High API error rate (${metrics.api.errorRate}%). `}
          </AlertDescription>
        </Alert>
      )}

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Database Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.database.connected ? 'Connected' : 'Disconnected'}
            </div>
            <p className="text-xs text-muted-foreground">
              Response time: {metrics?.database.responseTime || 0}ms
            </p>
            <p className="text-xs text-muted-foreground">
              Active connections: {metrics?.database.activeConnections || 0}
            </p>
          </CardContent>
        </Card>

        {/* API Performance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Performance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.api.requestsPerMinute || 0} req/min
            </div>
            <p className="text-xs text-muted-foreground">
              Error rate: {metrics?.api.errorRate || 0}%
            </p>
            <p className="text-xs text-muted-foreground">
              Uptime: {Math.floor((metrics?.api.uptime || 0) / 3600)}h
            </p>
          </CardContent>
        </Card>

        {/* HR Agents */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">HR Agents</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.agents.active || 0}/{metrics?.agents.total || 0} Active
            </div>
            <Progress 
              value={(metrics?.agents.active || 0) / (metrics?.agents.total || 1) * 100} 
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Last run: {metrics?.agents.lastRun || 'Never'}
            </p>
          </CardContent>
        </Card>

        {/* Users */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.users.total || 0} Total
            </div>
            <p className="text-xs text-muted-foreground">
              Active today: {metrics?.users.active || 0}
            </p>
            <p className="text-xs text-muted-foreground">
              Admins: {metrics?.users.admins || 0}
            </p>
          </CardContent>
        </Card>

        {/* Storage */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Storage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.storage.documents || 0} Documents
            </div>
            <p className="text-xs text-muted-foreground">
              Used: {metrics?.storage.totalSize || '0 MB'}
            </p>
            <p className="text-xs text-muted-foreground">
              Available: {metrics?.storage.remaining || 'Unknown'}
            </p>
          </CardContent>
        </Card>

        {/* System Info */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Info</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Version:</span>
                <span className="font-medium">2.1.0</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Environment:</span>
                <span className="font-medium">
                  {process.env.NODE_ENV || 'development'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">AI Features:</span>
                <span className="font-medium">
                  {process.env.VITE_OPENAI_API_KEY ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common administrative tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm">
              Clear Cache
            </Button>
            <Button variant="outline" size="sm">
              Run Backup
            </Button>
            <Button variant="outline" size="sm">
              Test Email
            </Button>
            <Button variant="outline" size="sm">
              Export Logs
            </Button>
            <Button variant="outline" size="sm">
              Restart Agents
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}