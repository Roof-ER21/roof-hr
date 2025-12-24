/**
 * System Control Component - Super Admin Dashboard
 * Feature toggles, scheduled jobs, and session management
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Settings,
  ToggleLeft,
  Clock,
  Users,
  Play,
  Pause,
  Plus,
  RefreshCw,
  Calendar,
  History
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FeatureToggle {
  id: string;
  featureName: string;
  featureKey: string;
  isEnabled: boolean;
  description: string | null;
  category: 'UI' | 'API' | 'AGENT' | 'WORKFLOW' | 'EMAIL' | 'INTEGRATION' | null;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

interface ScheduledJob {
  id: string;
  agentName: string;
  description: string;
  schedule: string;
  isActive: boolean;
  lastRun: string | null;
  nextRun: string | null;
  lastStatus: 'SUCCESS' | 'FAILED' | 'RUNNING' | null;
}

interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  resourceType: string;
  resourceName: string | null;
  createdAt: string;
}

export function SystemControl() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showToggleDialog, setShowToggleDialog] = useState(false);
  const [newToggle, setNewToggle] = useState({
    featureName: '',
    featureKey: '',
    description: '',
    category: 'UI' as const,
    isEnabled: true
  });

  // Fetch feature toggles
  const { data: toggles, isLoading: togglesLoading } = useQuery<FeatureToggle[]>({
    queryKey: ['/api/super-admin/feature-toggles'],
    queryFn: async () => {
      const res = await fetch('/api/super-admin/feature-toggles');
      if (!res.ok) throw new Error('Failed to fetch toggles');
      return res.json();
    }
  });

  // Fetch scheduled jobs
  const { data: jobs, isLoading: jobsLoading, refetch: refetchJobs } = useQuery<ScheduledJob[]>({
    queryKey: ['/api/super-admin/jobs'],
    queryFn: async () => {
      const res = await fetch('/api/super-admin/jobs');
      if (!res.ok) throw new Error('Failed to fetch jobs');
      return res.json();
    }
  });

  // Fetch audit logs
  const { data: auditLogs } = useQuery<AuditLog[]>({
    queryKey: ['/api/super-admin/audit-logs'],
    queryFn: async () => {
      const res = await fetch('/api/super-admin/audit-logs?limit=100');
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      return res.json();
    }
  });

  // Create feature toggle mutation
  const createToggleMutation = useMutation({
    mutationFn: async (data: typeof newToggle) => {
      const res = await fetch('/api/super-admin/feature-toggles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create toggle');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/feature-toggles'] });
      setShowToggleDialog(false);
      setNewToggle({
        featureName: '',
        featureKey: '',
        description: '',
        category: 'UI',
        isEnabled: true
      });
      toast({ title: 'Feature toggle created' });
    },
    onError: () => {
      toast({ title: 'Failed to create toggle', variant: 'destructive' });
    }
  });

  // Update feature toggle mutation
  const updateToggleMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      const res = await fetch(`/api/super-admin/feature-toggles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled })
      });
      if (!res.ok) throw new Error('Failed to update toggle');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/feature-toggles'] });
    }
  });

  // Run job mutation
  const runJobMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/super-admin/jobs/${id}/run`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Failed to run job');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/jobs'] });
      toast({ title: 'Job triggered successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to run job', variant: 'destructive' });
    }
  });

  // Update job mutation
  const updateJobMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/super-admin/jobs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive })
      });
      if (!res.ok) throw new Error('Failed to update job');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/jobs'] });
    }
  });

  // Group toggles by category
  const togglesByCategory = toggles?.reduce((acc, toggle) => {
    const cat = toggle.category || 'OTHER';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(toggle);
    return acc;
  }, {} as Record<string, FeatureToggle[]>) || {};

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'UI': return '🎨';
      case 'API': return '🔌';
      case 'AGENT': return '🤖';
      case 'WORKFLOW': return '⚙️';
      case 'EMAIL': return '📧';
      case 'INTEGRATION': return '🔗';
      default: return '📦';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6" />
            System Control
          </h2>
          <p className="text-muted-foreground">Manage features, jobs, and view audit logs</p>
        </div>
      </div>

      <Tabs defaultValue="toggles">
        <TabsList>
          <TabsTrigger value="toggles">
            <ToggleLeft className="w-4 h-4 mr-2" />
            Feature Toggles
          </TabsTrigger>
          <TabsTrigger value="jobs">
            <Clock className="w-4 h-4 mr-2" />
            Scheduled Jobs
          </TabsTrigger>
          <TabsTrigger value="audit">
            <History className="w-4 h-4 mr-2" />
            Audit Logs
          </TabsTrigger>
        </TabsList>

        {/* Feature Toggles Tab */}
        <TabsContent value="toggles">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Feature Toggles</CardTitle>
                <CardDescription>Enable or disable features across the application</CardDescription>
              </div>
              <Dialog open={showToggleDialog} onOpenChange={setShowToggleDialog}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Toggle
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Feature Toggle</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Feature Name</Label>
                      <Input
                        value={newToggle.featureName}
                        onChange={(e) => setNewToggle({ ...newToggle, featureName: e.target.value })}
                        placeholder="Dark Mode"
                      />
                    </div>
                    <div>
                      <Label>Feature Key (machine-readable)</Label>
                      <Input
                        value={newToggle.featureKey}
                        onChange={(e) => setNewToggle({ ...newToggle, featureKey: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                        placeholder="dark_mode"
                        className="font-mono"
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={newToggle.description}
                        onChange={(e) => setNewToggle({ ...newToggle, description: e.target.value })}
                        placeholder="Enable dark mode for the application"
                      />
                    </div>
                    <div>
                      <Label>Category</Label>
                      <Select
                        value={newToggle.category}
                        onValueChange={(v) => setNewToggle({ ...newToggle, category: v as any })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UI">UI</SelectItem>
                          <SelectItem value="API">API</SelectItem>
                          <SelectItem value="AGENT">Agent</SelectItem>
                          <SelectItem value="WORKFLOW">Workflow</SelectItem>
                          <SelectItem value="EMAIL">Email</SelectItem>
                          <SelectItem value="INTEGRATION">Integration</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Enabled by default</Label>
                      <Switch
                        checked={newToggle.isEnabled}
                        onCheckedChange={(checked) => setNewToggle({ ...newToggle, isEnabled: checked })}
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => createToggleMutation.mutate(newToggle)}
                      disabled={!newToggle.featureName || !newToggle.featureKey}
                    >
                      Create Toggle
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {Object.keys(togglesByCategory).length > 0 ? (
                <div className="space-y-6">
                  {Object.entries(togglesByCategory).map(([category, categoryToggles]) => (
                    <div key={category}>
                      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <span>{getCategoryIcon(category)}</span>
                        {category}
                      </h3>
                      <div className="space-y-2">
                        {categoryToggles.map((toggle) => (
                          <div
                            key={toggle.id}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div>
                              <div className="font-medium">{toggle.featureName}</div>
                              <div className="text-sm text-muted-foreground">
                                <code className="bg-muted px-1 rounded">{toggle.featureKey}</code>
                                {toggle.description && ` - ${toggle.description}`}
                              </div>
                            </div>
                            <Switch
                              checked={toggle.isEnabled}
                              onCheckedChange={(checked) =>
                                updateToggleMutation.mutate({ id: toggle.id, isEnabled: checked })
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No feature toggles configured. Create one to get started.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scheduled Jobs Tab */}
        <TabsContent value="jobs">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Scheduled Jobs</CardTitle>
                <CardDescription>HR automation agents and scheduled tasks</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetchJobs()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Last Run</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs?.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <div className="font-medium">{job.agentName}</div>
                        <div className="text-sm text-muted-foreground">{job.description}</div>
                      </TableCell>
                      <TableCell>
                        <code className="bg-muted px-2 py-1 rounded text-xs">
                          {job.schedule}
                        </code>
                      </TableCell>
                      <TableCell>
                        {job.lastRun ? (
                          <div className="text-sm">
                            {new Date(job.lastRun).toLocaleString()}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {job.lastStatus === 'SUCCESS' && (
                          <Badge className="bg-green-500">Success</Badge>
                        )}
                        {job.lastStatus === 'FAILED' && (
                          <Badge variant="destructive">Failed</Badge>
                        )}
                        {job.lastStatus === 'RUNNING' && (
                          <Badge className="bg-blue-500">Running</Badge>
                        )}
                        {!job.lastStatus && (
                          <Badge variant="outline">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={job.isActive}
                          onCheckedChange={(checked) =>
                            updateJobMutation.mutate({ id: job.id, isActive: checked })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => runJobMutation.mutate(job.id)}
                          disabled={runJobMutation.isPending}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Run Now
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!jobs || jobs.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No scheduled jobs found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Logs Tab */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Audit Logs</CardTitle>
              <CardDescription>Recent admin actions and system changes</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs?.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">{log.userEmail}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.action}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {log.resourceType}
                          {log.resourceName && `: ${log.resourceName}`}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!auditLogs || auditLogs.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No audit logs recorded
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default SystemControl;
