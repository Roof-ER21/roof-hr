/**
 * One-Click Fix Center
 * User-friendly control panel for fixing issues without technical knowledge
 * Simple buttons, plain English, color-coded status indicators
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Database, RefreshCw, Trash2, Play, Clock, Mail, Cloud,
  CheckCircle, XCircle, AlertTriangle, Loader2, Zap,
  Server, Wifi, HardDrive, Activity, Shield, Wrench,
  RotateCcw, Send, TestTube, Heart, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface HealthStatus {
  database: { status: 'healthy' | 'warning' | 'error'; message: string; latency?: number };
  email: { status: 'healthy' | 'warning' | 'error'; message: string };
  google: { status: 'healthy' | 'warning' | 'error'; message: string };
  agents: { status: 'healthy' | 'warning' | 'error'; message: string; activeCount?: number };
  cache: { status: 'healthy' | 'warning' | 'error'; message: string };
  api: { status: 'healthy' | 'warning' | 'error'; message: string; avgResponseTime?: number };
}

interface DetectedIssue {
  id: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  fixAction: string;
  autoFixable: boolean;
}

const StatusIcon = ({ status }: { status: 'healthy' | 'warning' | 'error' }) => {
  if (status === 'healthy') return <CheckCircle className="w-5 h-5 text-green-500" />;
  if (status === 'warning') return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
  return <XCircle className="w-5 h-5 text-red-500" />;
};

const StatusBadge = ({ status }: { status: 'healthy' | 'warning' | 'error' }) => {
  const variants = {
    healthy: 'bg-green-100 text-green-700 border-green-200',
    warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    error: 'bg-red-100 text-red-700 border-red-200'
  };
  const labels = {
    healthy: 'All Good',
    warning: 'Needs Attention',
    error: 'Problem Detected'
  };
  return (
    <Badge variant="outline" className={cn('font-medium', variants[status])}>
      {labels[status]}
    </Badge>
  );
};

export function FixCenter() {
  const { toast } = useToast();
  const [isRunningHealthCheck, setIsRunningHealthCheck] = useState(false);
  const [fixingIssues, setFixingIssues] = useState<Set<string>>(new Set());

  // Fetch health status
  const { data: healthStatus, isLoading: healthLoading, refetch: refetchHealth } = useQuery<HealthStatus>({
    queryKey: ['/api/super-admin/services-status'],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch detected issues
  const { data: issues = [], refetch: refetchIssues } = useQuery<DetectedIssue[]>({
    queryKey: ['/api/super-admin/detected-issues']
  });

  // Fix mutations
  const refreshDatabaseMutation = useMutation({
    mutationFn: () => apiRequest('/api/super-admin/fix/database-reconnect', { method: 'POST' }),
    onSuccess: () => {
      toast({ title: '✅ Database Refreshed', description: 'Connection has been re-established' });
      refetchHealth();
    },
    onError: () => toast({ title: '❌ Failed', description: 'Could not refresh database', variant: 'destructive' })
  });

  const clearCacheMutation = useMutation({
    mutationFn: () => apiRequest('/api/super-admin/fix/clear-cache', { method: 'POST' }),
    onSuccess: () => {
      toast({ title: '✅ Cache Cleared', description: 'All caches have been cleared' });
      refetchHealth();
    },
    onError: () => toast({ title: '❌ Failed', description: 'Could not clear cache', variant: 'destructive' })
  });

  const restartJobsMutation = useMutation({
    mutationFn: () => apiRequest('/api/super-admin/fix/restart-jobs', { method: 'POST' }),
    onSuccess: () => {
      toast({ title: '✅ Jobs Restarted', description: 'All background jobs have been restarted' });
      refetchHealth();
    },
    onError: () => toast({ title: '❌ Failed', description: 'Could not restart jobs', variant: 'destructive' })
  });

  const resetRateLimitsMutation = useMutation({
    mutationFn: () => apiRequest('/api/super-admin/fix/reset-rate-limits', { method: 'POST' }),
    onSuccess: () => {
      toast({ title: '✅ Rate Limits Reset', description: 'All rate limits have been cleared' });
      refetchHealth();
    },
    onError: () => toast({ title: '❌ Failed', description: 'Could not reset rate limits', variant: 'destructive' })
  });

  const triggerGoogleSyncMutation = useMutation({
    mutationFn: () => apiRequest('/api/super-admin/fix/google-sync', { method: 'POST' }),
    onSuccess: () => {
      toast({ title: '✅ Google Sync Started', description: 'Syncing with Google services...' });
      refetchHealth();
    },
    onError: () => toast({ title: '❌ Failed', description: 'Could not start Google sync', variant: 'destructive' })
  });

  const sendTestEmailMutation = useMutation({
    mutationFn: () => apiRequest('/api/super-admin/fix/send-test-email', { method: 'POST' }),
    onSuccess: () => {
      toast({ title: '✅ Test Email Sent', description: 'Check your inbox for the test email' });
    },
    onError: () => toast({ title: '❌ Failed', description: 'Could not send test email', variant: 'destructive' })
  });

  const runHealthCheckMutation = useMutation({
    mutationFn: () => apiRequest('/api/super-admin/fix/health-check', { method: 'POST' }),
    onMutate: () => setIsRunningHealthCheck(true),
    onSuccess: () => {
      toast({ title: '✅ Health Check Complete', description: 'All systems have been checked' });
      refetchHealth();
      refetchIssues();
    },
    onError: () => toast({ title: '❌ Failed', description: 'Health check failed', variant: 'destructive' }),
    onSettled: () => setIsRunningHealthCheck(false)
  });

  const fixIssueMutation = useMutation({
    mutationFn: (issueId: string) => apiRequest(`/api/super-admin/fix/issue/${issueId}`, { method: 'POST' }),
    onMutate: (issueId) => {
      setFixingIssues(prev => new Set(prev).add(issueId));
    },
    onSuccess: (_, issueId) => {
      toast({ title: '✅ Issue Fixed', description: 'The problem has been resolved' });
      setFixingIssues(prev => {
        const next = new Set(prev);
        next.delete(issueId);
        return next;
      });
      refetchIssues();
      refetchHealth();
    },
    onError: (_, issueId) => {
      toast({ title: '❌ Fix Failed', description: 'Could not fix this issue automatically', variant: 'destructive' });
      setFixingIssues(prev => {
        const next = new Set(prev);
        next.delete(issueId);
        return next;
      });
    }
  });

  const fixAllMutation = useMutation({
    mutationFn: () => apiRequest('/api/super-admin/fix/fix-all', { method: 'POST' }),
    onSuccess: () => {
      toast({ title: '✅ All Issues Fixed', description: 'All auto-fixable issues have been resolved' });
      refetchIssues();
      refetchHealth();
    },
    onError: () => toast({ title: '❌ Failed', description: 'Could not fix all issues', variant: 'destructive' })
  });

  // Default health status - always provide fallback for each property
  const defaultHealth: HealthStatus = {
    database: { status: 'healthy', message: 'Connected' },
    email: { status: 'healthy', message: 'Ready' },
    google: { status: 'healthy', message: 'Synced' },
    agents: { status: 'healthy', message: '5 active', activeCount: 5 },
    cache: { status: 'healthy', message: 'Operational' },
    api: { status: 'healthy', message: 'Fast', avgResponseTime: 120 }
  };

  // Merge with defaults to ensure all properties exist
  const health: HealthStatus = {
    database: healthStatus?.database || defaultHealth.database,
    email: healthStatus?.email || defaultHealth.email,
    google: healthStatus?.google || defaultHealth.google,
    agents: healthStatus?.agents || defaultHealth.agents,
    cache: healthStatus?.cache || defaultHealth.cache,
    api: healthStatus?.api || defaultHealth.api
  };

  const overallStatus = Object.values(health).some(s => s.status === 'error') ? 'error' :
    Object.values(health).some(s => s.status === 'warning') ? 'warning' : 'healthy';

  const autoFixableIssues = issues.filter(i => i.autoFixable);

  return (
    <div className="p-6 space-y-6">
      {/* Header with Overall Status */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Wrench className="w-6 h-6" />
            One-Click Fix Center
          </h2>
          <p className="text-gray-600 mt-1">Fix issues with a single click - no technical knowledge needed</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={overallStatus} />
          <Button
            onClick={() => runHealthCheckMutation.mutate()}
            disabled={isRunningHealthCheck}
            variant="outline"
          >
            {isRunningHealthCheck ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Heart className="w-4 h-4 mr-2" />
            )}
            Run Health Check
          </Button>
          {autoFixableIssues.length > 0 && (
            <Button
              onClick={() => fixAllMutation.mutate()}
              disabled={fixAllMutation.isPending}
              className="bg-gradient-to-r from-green-500 to-emerald-500"
            >
              {fixAllMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              Fix All Issues ({autoFixableIssues.length})
            </Button>
          )}
        </div>
      </div>

      {/* Health Status Cards */}
      <div className="grid grid-cols-3 gap-4">
        {/* Database */}
        <Card className={cn(
          'border-2',
          health.database.status === 'healthy' && 'border-green-200 bg-green-50/50',
          health.database.status === 'warning' && 'border-yellow-200 bg-yellow-50/50',
          health.database.status === 'error' && 'border-red-200 bg-red-50/50'
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                <span className="font-semibold">Database</span>
              </div>
              <StatusIcon status={health.database.status} />
            </div>
            <p className="text-sm text-gray-600 mb-3">{health.database.message}</p>
            {health.database.latency && (
              <p className="text-xs text-gray-500 mb-3">Latency: {health.database.latency}ms</p>
            )}
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => refreshDatabaseMutation.mutate()}
              disabled={refreshDatabaseMutation.isPending}
            >
              {refreshDatabaseMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Refresh Connection
            </Button>
          </CardContent>
        </Card>

        {/* Email Service */}
        <Card className={cn(
          'border-2',
          health.email.status === 'healthy' && 'border-green-200 bg-green-50/50',
          health.email.status === 'warning' && 'border-yellow-200 bg-yellow-50/50',
          health.email.status === 'error' && 'border-red-200 bg-red-50/50'
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                <span className="font-semibold">Email Service</span>
              </div>
              <StatusIcon status={health.email.status} />
            </div>
            <p className="text-sm text-gray-600 mb-3">{health.email.message}</p>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => sendTestEmailMutation.mutate()}
              disabled={sendTestEmailMutation.isPending}
            >
              {sendTestEmailMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send Test Email
            </Button>
          </CardContent>
        </Card>

        {/* Google Services */}
        <Card className={cn(
          'border-2',
          health.google.status === 'healthy' && 'border-green-200 bg-green-50/50',
          health.google.status === 'warning' && 'border-yellow-200 bg-yellow-50/50',
          health.google.status === 'error' && 'border-red-200 bg-red-50/50'
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Cloud className="w-5 h-5" />
                <span className="font-semibold">Google Services</span>
              </div>
              <StatusIcon status={health.google.status} />
            </div>
            <p className="text-sm text-gray-600 mb-3">{health.google.message}</p>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => triggerGoogleSyncMutation.mutate()}
              disabled={triggerGoogleSyncMutation.isPending}
            >
              {triggerGoogleSyncMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Sync Now
            </Button>
          </CardContent>
        </Card>

        {/* Background Jobs */}
        <Card className={cn(
          'border-2',
          health.agents.status === 'healthy' && 'border-green-200 bg-green-50/50',
          health.agents.status === 'warning' && 'border-yellow-200 bg-yellow-50/50',
          health.agents.status === 'error' && 'border-red-200 bg-red-50/50'
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                <span className="font-semibold">Background Jobs</span>
              </div>
              <StatusIcon status={health.agents.status} />
            </div>
            <p className="text-sm text-gray-600 mb-3">{health.agents.message}</p>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => restartJobsMutation.mutate()}
              disabled={restartJobsMutation.isPending}
            >
              {restartJobsMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4 mr-2" />
              )}
              Restart Jobs
            </Button>
          </CardContent>
        </Card>

        {/* Cache */}
        <Card className={cn(
          'border-2',
          health.cache.status === 'healthy' && 'border-green-200 bg-green-50/50',
          health.cache.status === 'warning' && 'border-yellow-200 bg-yellow-50/50',
          health.cache.status === 'error' && 'border-red-200 bg-red-50/50'
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <HardDrive className="w-5 h-5" />
                <span className="font-semibold">Cache</span>
              </div>
              <StatusIcon status={health.cache.status} />
            </div>
            <p className="text-sm text-gray-600 mb-3">{health.cache.message}</p>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => clearCacheMutation.mutate()}
              disabled={clearCacheMutation.isPending}
            >
              {clearCacheMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Clear Cache
            </Button>
          </CardContent>
        </Card>

        {/* API / Rate Limits */}
        <Card className={cn(
          'border-2',
          health.api.status === 'healthy' && 'border-green-200 bg-green-50/50',
          health.api.status === 'warning' && 'border-yellow-200 bg-yellow-50/50',
          health.api.status === 'error' && 'border-red-200 bg-red-50/50'
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                <span className="font-semibold">API & Rate Limits</span>
              </div>
              <StatusIcon status={health.api.status} />
            </div>
            <p className="text-sm text-gray-600 mb-3">{health.api.message}</p>
            {health.api.avgResponseTime && (
              <p className="text-xs text-gray-500 mb-3">Avg response: {health.api.avgResponseTime}ms</p>
            )}
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => resetRateLimitsMutation.mutate()}
              disabled={resetRateLimitsMutation.isPending}
            >
              {resetRateLimitsMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Shield className="w-4 h-4 mr-2" />
              )}
              Reset Rate Limits
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Detected Issues */}
      {issues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Detected Issues ({issues.length})
            </CardTitle>
            <CardDescription>
              Issues found during system scan. Click "Fix Now" to resolve automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {issues.map((issue) => (
                  <Alert
                    key={issue.id}
                    variant={issue.severity === 'high' ? 'destructive' : 'default'}
                    className={cn(
                      issue.severity === 'low' && 'border-blue-200 bg-blue-50',
                      issue.severity === 'medium' && 'border-yellow-200 bg-yellow-50',
                      issue.severity === 'high' && 'border-red-200 bg-red-50'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <AlertTitle className="flex items-center gap-2">
                          {issue.severity === 'high' && <XCircle className="w-4 h-4" />}
                          {issue.severity === 'medium' && <AlertTriangle className="w-4 h-4" />}
                          {issue.severity === 'low' && <Activity className="w-4 h-4" />}
                          {issue.title}
                        </AlertTitle>
                        <AlertDescription className="mt-1">
                          {issue.description}
                        </AlertDescription>
                      </div>
                      {issue.autoFixable && (
                        <Button
                          size="sm"
                          variant={issue.severity === 'high' ? 'destructive' : 'default'}
                          onClick={() => fixIssueMutation.mutate(issue.id)}
                          disabled={fixingIssues.has(issue.id)}
                        >
                          {fixingIssues.has(issue.id) ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Wrench className="w-4 h-4 mr-2" />
                          )}
                          Fix Now
                        </Button>
                      )}
                    </div>
                  </Alert>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Quick Actions
          </CardTitle>
          <CardDescription>
            Common maintenance tasks - just click and go
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <Button
              variant="outline"
              className="h-20 flex-col gap-2"
              onClick={() => {
                refreshDatabaseMutation.mutate();
                clearCacheMutation.mutate();
                restartJobsMutation.mutate();
              }}
            >
              <RotateCcw className="w-6 h-6" />
              <span className="text-sm">Restart Everything</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col gap-2"
              onClick={() => runHealthCheckMutation.mutate()}
              disabled={isRunningHealthCheck}
            >
              <TestTube className="w-6 h-6" />
              <span className="text-sm">Full Diagnostic</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col gap-2"
              onClick={() => triggerGoogleSyncMutation.mutate()}
            >
              <Cloud className="w-6 h-6" />
              <span className="text-sm">Sync All Data</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col gap-2"
              onClick={() => {
                clearCacheMutation.mutate();
                resetRateLimitsMutation.mutate();
              }}
            >
              <Trash2 className="w-6 h-6" />
              <span className="text-sm">Clear Everything</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
