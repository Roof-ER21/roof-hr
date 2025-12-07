import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, Play, Clock, Calendar, CheckCircle, XCircle, Settings, Activity } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { GmailConnection } from '@/components/admin/gmail-connection';
import { EmailTest } from '@/components/admin/email-test';
import { RecruitmentBotPanel } from '@/components/admin/recruitment-bot-panel';

interface HrAgentConfig {
  id: string;
  agentName: string;
  isActive: boolean;
  schedule: string;
  description: string;
  lastRun?: string;
  nextRun?: string;
  lastStatus?: 'SUCCESS' | 'FAILED' | 'RUNNING' | 'PENDING';
  lastError?: string;
  config?: string;
  createdAt: string;
  updatedAt: string;
}

interface HrAgentLog {
  id: string;
  agentName: string;
  status: 'SUCCESS' | 'FAILED' | 'RUNNING';
  message: string;
  affectedRecords: number;
  executionTime?: number;
  details?: string;
  createdAt: string;
}

interface CompanySettings {
  id: string;
  companyName: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  ptoPolicy: string;
  businessHours: string;
}

function AdminControlHubContent() {
  const { toast } = useToast();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  // Fetch HR agent configurations
  const { data: agents, isLoading: agentsLoading, refetch: refetchAgents } = useQuery<HrAgentConfig[]>({
    queryKey: ['/api/hr-agents'],
    queryFn: async () => {
      const res = await fetch('/api/hr-agents', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch agents');
      const data = await res.json();
      console.log('[AdminControlHub] HR Agents data:', data);
      return data;
    },
    staleTime: 0, // Always consider data stale for immediate updates
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });

  // Fetch HR agent logs
  const { data: logs, isLoading: logsLoading } = useQuery<HrAgentLog[]>({
    queryKey: ['/api/hr-agents/logs', selectedAgent],
    queryFn: async () => {
      const url = selectedAgent 
        ? `/api/hr-agents/logs?agentName=${encodeURIComponent(selectedAgent)}`
        : '/api/hr-agents/logs';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch logs');
      return res.json();
    }
  });

  // Fetch company settings
  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ['/api/settings']
  });

  // Update agent configuration
  const updateAgent = useMutation({
    mutationFn: async ({ id, ...data }: Partial<HrAgentConfig> & { id: string }) => {
      return await apiRequest('PATCH', `/api/hr-agents/${id}`, data);
    },
    onSuccess: (data) => {
      console.log('[UpdateAgent Success]', data);
      queryClient.invalidateQueries({ queryKey: ['/api/hr-agents'] });
      // Force immediate refetch
      refetchAgents();
      toast({
        title: 'Success',
        description: 'Agent configuration updated successfully'
      });
    },
    onError: (error: Error) => {
      console.error('[UpdateAgent Error]', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update agent configuration',
        variant: 'destructive'
      });
    }
  });

  // Test agent
  const testAgent = useMutation({
    mutationFn: async ({ id, agentName }: { id: string; agentName: string }) => {
      return await apiRequest('POST', `/api/hr-agents/${id}/test`, { agentName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hr-agents/logs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/hr-agents'] });
      toast({
        title: 'Success',
        description: 'Agent test completed successfully'
      });
    },
    onError: (error: Error) => {
      console.error('[TestAgent Error]', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to test agent',
        variant: 'destructive'
      });
    }
  });



  const getStatusBadge = (status?: 'SUCCESS' | 'FAILED' | 'RUNNING' | 'PENDING') => {
    switch (status) {
      case 'SUCCESS':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Success</Badge>;
      case 'FAILED':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'RUNNING':
        return <Badge className="bg-blue-500"><Activity className="h-3 w-3 mr-1" />Running</Badge>;
      case 'PENDING':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">Never Run</Badge>;
    }
  };

  const formatSchedule = (schedule: string) => {
    if (schedule === 'MANUAL') return 'Manual Trigger';
    // Parse cron expression for display
    const parts = schedule.split(' ');
    if (parts.length === 5) {
      const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
      if (dayOfWeek === 'MON') return `Every Monday at ${hour}:${minute.padStart(2, '0')}`;
      if (dayOfWeek === 'MON,WED,FRI') return `Mon/Wed/Fri at ${hour}:${minute.padStart(2, '0')}`;
      if (month === '*/3') return `Quarterly on day ${dayOfMonth} at ${hour}:${minute.padStart(2, '0')}`;
    }
    return schedule;
  };

  if (agentsLoading) {
    return <div className="flex items-center justify-center h-96">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Control Hub</h1>
          <p className="text-muted-foreground mt-1">Manage HR automation agents and system settings</p>
        </div>
      </div>

      <Tabs defaultValue="agents" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="agents">HR Agents</TabsTrigger>
          <TabsTrigger value="recruitment-bot">Recruitment Bot</TabsTrigger>
          <TabsTrigger value="logs">Activity Logs</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="space-y-4">
          <div className="grid gap-4">
            {!agents || agents.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">No HR agents configured</p>
                </CardContent>
              </Card>
            ) : (
              agents.map((agent) => (
                <Card key={agent.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <CardTitle>{agent.agentName}</CardTitle>
                      <CardDescription>{agent.description}</CardDescription>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={agent.isActive}
                          onCheckedChange={(checked) => {
                            updateAgent.mutate({ id: agent.id, isActive: checked });
                          }}
                        />
                        <Label>{agent.isActive ? 'Active' : 'Inactive'}</Label>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testAgent.mutate({ id: agent.id, agentName: agent.agentName })}
                        disabled={testAgent.isPending}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Test Run
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Schedule</p>
                      <p className="text-sm flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatSchedule(agent.schedule)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Last Run</p>
                      <p className="text-sm">
                        {agent.lastRun ? format(new Date(agent.lastRun), 'MMM dd, yyyy HH:mm') : 'Never'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Status</p>
                      {getStatusBadge(agent.lastStatus)}
                    </div>
                  </div>
                  {agent.lastError && (
                    <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                      <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Last Error: {agent.lastError}
                      </p>
                    </div>
                  )}
                  {agent.nextRun && (
                    <div className="text-sm text-muted-foreground">
                      Next scheduled run: {format(new Date(agent.nextRun), 'MMM dd, yyyy HH:mm')}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
            )}
          </div>
        </TabsContent>



        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Agent Activity Logs</CardTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={!selectedAgent ? 'default' : 'outline'}
                    onClick={() => {
                      setSelectedAgent(null);
                      queryClient.invalidateQueries({ queryKey: ['/api/hr-agents/logs'] });
                    }}
                  >
                    All Agents
                  </Button>
                  {agents?.map((agent) => (
                    <Button
                      key={agent.id}
                      size="sm"
                      variant={selectedAgent === agent.agentName ? 'default' : 'outline'}
                      onClick={() => {
                        setSelectedAgent(agent.agentName);
                        queryClient.invalidateQueries({ queryKey: ['/api/hr-agents/logs'] });
                      }}
                    >
                      {agent.agentName.split(' ')[0]}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {logsLoading ? (
                    <p className="text-center text-muted-foreground py-8">Loading logs...</p>
                  ) : logs && logs.length > 0 ? (
                    logs.map((log) => (
                      <div key={log.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{log.agentName}</span>
                            {log.status === 'SUCCESS' ? (
                              <Badge className="bg-green-500 text-xs">Success</Badge>
                            ) : log.status === 'FAILED' ? (
                              <Badge variant="destructive" className="text-xs">Failed</Badge>
                            ) : (
                              <Badge className="bg-blue-500 text-xs">Running</Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(log.createdAt), 'MMM dd, HH:mm:ss')}
                          </span>
                        </div>
                        <p className="text-sm">{log.message}</p>
                        {log.affectedRecords > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Affected records: {log.affectedRecords}
                          </p>
                        )}
                        {log.executionTime && (
                          <p className="text-xs text-muted-foreground">
                            Execution time: {log.executionTime}ms
                          </p>
                        )}
                        {log.details && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                              View details
                            </summary>
                            <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                              {log.details}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No logs available</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recruitment-bot" className="space-y-4">
          <RecruitmentBotPanel />
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <div className="grid gap-6">
            <GmailConnection />
            <EmailTest />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AdminControlHub() {
  return (
    <ProtectedRoute requiredRole="ADMIN">
      <AdminControlHubContent />
    </ProtectedRoute>
  );
}