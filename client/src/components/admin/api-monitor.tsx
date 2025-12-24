/**
 * API Monitor Component - Super Admin Dashboard
 * Real-time API health monitoring, metrics, and alerting
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Mail,
  RefreshCw,
  Server,
  TrendingUp,
  XCircle,
  Bell,
  Plus,
  Trash2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ApiMetricsSummary {
  totalRequests: number;
  errorCount: number;
  avgResponseTime: number;
  successRate: number;
}

interface EndpointStats {
  endpoint: string;
  method: string;
  requestCount: number;
  errorCount: number;
  avgResponseTime: number;
}

interface ApiError {
  id: string;
  endpoint: string;
  method: string;
  statusCode: number;
  errorMessage: string;
  timestamp: string;
  userEmail: string;
}

interface ApiAlert {
  id: string;
  alertName: string;
  alertType: 'ERROR_RATE' | 'RESPONSE_TIME' | 'AVAILABILITY' | 'STATUS_CODE';
  endpoint: string | null;
  threshold: number;
  operator: 'GREATER_THAN' | 'LESS_THAN' | 'EQUALS';
  timeWindow: number;
  isActive: boolean;
  notifyEmail: string | null;
  lastTriggered: string | null;
  triggerCount: number;
}

interface SystemStatus {
  api: ApiMetricsSummary;
  alerts: { active: number; triggered: number };
  memory: { heapUsed: number; heapTotal: number; rss: number };
  uptime: number;
  timestamp: string;
}

export function ApiMonitor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [timeWindow, setTimeWindow] = useState('60');
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [newAlert, setNewAlert] = useState({
    alertName: '',
    alertType: 'ERROR_RATE' as const,
    endpoint: '',
    threshold: 5,
    operator: 'GREATER_THAN' as const,
    timeWindow: 5,
    notifyEmail: ''
  });

  // Fetch API metrics summary
  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery<ApiMetricsSummary>({
    queryKey: ['/api/super-admin/api-metrics', timeWindow],
    queryFn: async () => {
      const res = await fetch(`/api/super-admin/api-metrics?timeWindow=${timeWindow}`);
      if (!res.ok) throw new Error('Failed to fetch metrics');
      return res.json();
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch endpoint stats
  const { data: endpointStats } = useQuery<EndpointStats[]>({
    queryKey: ['/api/super-admin/api-metrics/endpoints', timeWindow],
    queryFn: async () => {
      const res = await fetch(`/api/super-admin/api-metrics/endpoints?timeWindow=${timeWindow}`);
      if (!res.ok) throw new Error('Failed to fetch endpoint stats');
      return res.json();
    },
    refetchInterval: 30000
  });

  // Fetch recent errors
  const { data: errors } = useQuery<ApiError[]>({
    queryKey: ['/api/super-admin/api-metrics/errors'],
    queryFn: async () => {
      const res = await fetch('/api/super-admin/api-metrics/errors?limit=50');
      if (!res.ok) throw new Error('Failed to fetch errors');
      return res.json();
    },
    refetchInterval: 30000
  });

  // Fetch system status
  const { data: systemStatus } = useQuery<SystemStatus>({
    queryKey: ['/api/super-admin/system-status'],
    queryFn: async () => {
      const res = await fetch('/api/super-admin/system-status');
      if (!res.ok) throw new Error('Failed to fetch system status');
      return res.json();
    },
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  // Fetch alerts
  const { data: alerts } = useQuery<ApiAlert[]>({
    queryKey: ['/api/super-admin/api-alerts'],
    queryFn: async () => {
      const res = await fetch('/api/super-admin/api-alerts');
      if (!res.ok) throw new Error('Failed to fetch alerts');
      return res.json();
    }
  });

  // Create alert mutation
  const createAlertMutation = useMutation({
    mutationFn: async (data: typeof newAlert) => {
      const res = await fetch('/api/super-admin/api-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create alert');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/api-alerts'] });
      setShowAlertDialog(false);
      setNewAlert({
        alertName: '',
        alertType: 'ERROR_RATE',
        endpoint: '',
        threshold: 5,
        operator: 'GREATER_THAN',
        timeWindow: 5,
        notifyEmail: ''
      });
      toast({ title: 'Alert created successfully' });
    }
  });

  // Toggle alert mutation
  const toggleAlertMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/super-admin/api-alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive })
      });
      if (!res.ok) throw new Error('Failed to update alert');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/api-alerts'] });
    }
  });

  // Delete alert mutation
  const deleteAlertMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/super-admin/api-alerts/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete alert');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/api-alerts'] });
      toast({ title: 'Alert deleted' });
    }
  });

  const getStatusColor = (successRate: number) => {
    if (successRate >= 99) return 'text-green-500';
    if (successRate >= 95) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getStatusBadge = (successRate: number) => {
    if (successRate >= 99) return <Badge className="bg-green-500">Healthy</Badge>;
    if (successRate >= 95) return <Badge className="bg-yellow-500">Warning</Badge>;
    return <Badge variant="destructive">Critical</Badge>;
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">API Monitor</h2>
          <p className="text-muted-foreground">Real-time API health and performance monitoring</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={timeWindow} onValueChange={setTimeWindow}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">Last 5 min</SelectItem>
              <SelectItem value="15">Last 15 min</SelectItem>
              <SelectItem value="60">Last hour</SelectItem>
              <SelectItem value="1440">Last 24h</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetchMetrics()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Success Rate */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${getStatusColor(metrics?.successRate || 100)}`}>
                {metrics?.successRate?.toFixed(1) || '100'}%
              </span>
              {getStatusBadge(metrics?.successRate || 100)}
            </div>
            <Progress
              value={metrics?.successRate || 100}
              className="mt-2"
            />
          </CardContent>
        </Card>

        {/* Total Requests */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Total Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {metrics?.totalRequests?.toLocaleString() || 0}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {metrics?.errorCount || 0} errors
            </p>
          </CardContent>
        </Card>

        {/* Avg Response Time */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Avg Response Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {metrics?.avgResponseTime?.toFixed(0) || 0}ms
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Target: &lt;200ms
            </p>
          </CardContent>
        </Card>

        {/* System Uptime */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Server className="w-4 h-4" />
              Uptime
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {systemStatus ? formatUptime(systemStatus.uptime) : '--'}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Memory: {systemStatus?.memory.heapUsed || 0}MB / {systemStatus?.memory.heapTotal || 0}MB
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="endpoints">
        <TabsList>
          <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
          <TabsTrigger value="errors">Errors ({errors?.length || 0})</TabsTrigger>
          <TabsTrigger value="alerts">Alerts ({alerts?.length || 0})</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
        </TabsList>

        {/* Endpoints Tab */}
        <TabsContent value="endpoints">
          <Card>
            <CardHeader>
              <CardTitle>Endpoint Performance</CardTitle>
              <CardDescription>Request counts and response times by endpoint</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                    <TableHead className="text-right">Errors</TableHead>
                    <TableHead className="text-right">Avg Time</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {endpointStats?.slice(0, 20).map((stat, i) => {
                    const errorRate = stat.requestCount > 0
                      ? (stat.errorCount / stat.requestCount) * 100
                      : 0;
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-sm">{stat.endpoint}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{stat.method}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{stat.requestCount}</TableCell>
                        <TableCell className="text-right">
                          <span className={stat.errorCount > 0 ? 'text-red-500' : ''}>
                            {stat.errorCount}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{stat.avgResponseTime.toFixed(0)}ms</TableCell>
                        <TableCell>
                          {errorRate === 0 ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : errorRate < 5 ? (
                            <AlertTriangle className="w-4 h-4 text-yellow-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!endpointStats || endpointStats.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No data available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Errors Tab */}
        <TabsContent value="errors">
          <Card>
            <CardHeader>
              <CardTitle>Recent Errors</CardTitle>
              <CardDescription>Last 50 API errors</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>User</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errors?.map((error) => (
                    <TableRow key={error.id}>
                      <TableCell className="text-sm">
                        {new Date(error.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        <Badge variant="outline" className="mr-2">{error.method}</Badge>
                        {error.endpoint}
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive">{error.statusCode}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {error.errorMessage || 'Unknown error'}
                      </TableCell>
                      <TableCell className="text-sm">{error.userEmail || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {(!errors || errors.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No errors recorded
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Alert Rules</CardTitle>
                <CardDescription>Configure alerts for API issues</CardDescription>
              </div>
              <Dialog open={showAlertDialog} onOpenChange={setShowAlertDialog}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Alert
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Alert Rule</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Alert Name</Label>
                      <Input
                        value={newAlert.alertName}
                        onChange={(e) => setNewAlert({ ...newAlert, alertName: e.target.value })}
                        placeholder="High Error Rate"
                      />
                    </div>
                    <div>
                      <Label>Alert Type</Label>
                      <Select
                        value={newAlert.alertType}
                        onValueChange={(v) => setNewAlert({ ...newAlert, alertType: v as any })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ERROR_RATE">Error Rate (%)</SelectItem>
                          <SelectItem value="RESPONSE_TIME">Response Time (ms)</SelectItem>
                          <SelectItem value="AVAILABILITY">Availability</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Threshold</Label>
                      <Input
                        type="number"
                        value={newAlert.threshold}
                        onChange={(e) => setNewAlert({ ...newAlert, threshold: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>Time Window (minutes)</Label>
                      <Input
                        type="number"
                        value={newAlert.timeWindow}
                        onChange={(e) => setNewAlert({ ...newAlert, timeWindow: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>Notify Email (optional)</Label>
                      <Input
                        value={newAlert.notifyEmail}
                        onChange={(e) => setNewAlert({ ...newAlert, notifyEmail: e.target.value })}
                        placeholder="ahmed.mahmoud@theroofdocs.com"
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => createAlertMutation.mutate(newAlert)}
                      disabled={!newAlert.alertName}
                    >
                      Create Alert
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Alert</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Threshold</TableHead>
                    <TableHead>Window</TableHead>
                    <TableHead>Triggers</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts?.map((alert) => (
                    <TableRow key={alert.id}>
                      <TableCell className="font-medium">{alert.alertName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{alert.alertType}</Badge>
                      </TableCell>
                      <TableCell>
                        {alert.operator === 'GREATER_THAN' ? '>' : '<'} {alert.threshold}
                        {alert.alertType === 'RESPONSE_TIME' ? 'ms' : '%'}
                      </TableCell>
                      <TableCell>{alert.timeWindow}m</TableCell>
                      <TableCell>
                        {alert.triggerCount}
                        {alert.lastTriggered && (
                          <span className="text-xs text-muted-foreground ml-2">
                            Last: {new Date(alert.lastTriggered).toLocaleDateString()}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={alert.isActive}
                          onCheckedChange={(checked) =>
                            toggleAlertMutation.mutate({ id: alert.id, isActive: checked })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteAlertMutation.mutate(alert.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!alerts || alerts.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No alerts configured
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Database
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Connected</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  PostgreSQL (Neon)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Email Service
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Active</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Gmail API (Service Account)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  LLM Providers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>OpenAI</span>
                    <Badge className="bg-green-500">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Groq</span>
                    <Badge className="bg-green-500">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Gemini</span>
                    <Badge className="bg-green-500">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Ollama</span>
                    <Badge variant="outline">Local</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="w-5 h-5" />
                  Google Services
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Gmail</span>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Calendar</span>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Drive</span>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Sheets</span>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ApiMonitor;
