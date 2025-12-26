import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit2, Trash2, Calendar, Play, Clock, FileText, Mail, History } from 'lucide-react';
import type { ScheduledReport, ReportExecution } from '@/../../shared/schema';

type ScheduleFrequency = 'daily' | 'weekly' | 'monthly';

interface ScheduleConfig {
  frequency: ScheduleFrequency;
  time: string; // HH:mm format
  dayOfWeek?: string; // For weekly: MON, TUE, etc.
  dayOfMonth?: string; // For monthly: 1-31
}

interface FormData {
  name: string;
  reportType: string;
  format: string;
  recipients: string;
  filters: string;
  scheduleFrequency: ScheduleFrequency;
  scheduleTime: string;
  scheduleDayOfWeek: string;
  scheduleDayOfMonth: string;
  isActive: boolean;
}

const REPORT_TYPES = [
  { value: 'RECRUITING', label: 'Recruiting' },
  { value: 'PTO', label: 'PTO' },
  { value: 'ATTENDANCE', label: 'Attendance' },
  { value: 'PERFORMANCE', label: 'Performance' },
  { value: 'EMPLOYEES', label: 'Employees' },
];

const FORMATS = [
  { value: 'PDF', label: 'PDF' },
  { value: 'CSV', label: 'CSV' },
  { value: 'EXCEL', label: 'Excel' },
];

const DAYS_OF_WEEK = [
  { value: 'MON', label: 'Monday' },
  { value: 'TUE', label: 'Tuesday' },
  { value: 'WED', label: 'Wednesday' },
  { value: 'THU', label: 'Thursday' },
  { value: 'FRI', label: 'Friday' },
  { value: 'SAT', label: 'Saturday' },
  { value: 'SUN', label: 'Sunday' },
];

// Convert simplified schedule to cron expression
function buildCronExpression(config: ScheduleConfig): string {
  const [hour, minute] = config.time.split(':');

  switch (config.frequency) {
    case 'daily':
      return `${minute} ${hour} * * *`;
    case 'weekly':
      return `${minute} ${hour} * * ${config.dayOfWeek || 'MON'}`;
    case 'monthly':
      return `${minute} ${hour} ${config.dayOfMonth || '1'} * *`;
    default:
      return `${minute} ${hour} * * *`;
  }
}

// Parse cron expression to simplified schedule
function parseCronExpression(cron: string): ScheduleConfig {
  const parts = cron.split(' ');
  const [minute, hour, dayOfMonth, , dayOfWeek] = parts;

  const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;

  if (dayOfWeek !== '*') {
    return {
      frequency: 'weekly',
      time,
      dayOfWeek,
    };
  }

  if (dayOfMonth !== '*') {
    return {
      frequency: 'monthly',
      time,
      dayOfMonth,
    };
  }

  return {
    frequency: 'daily',
    time,
  };
}

// Format schedule for display
function formatSchedule(cron: string): string {
  const config = parseCronExpression(cron);

  switch (config.frequency) {
    case 'daily':
      return `Daily at ${config.time}`;
    case 'weekly':
      const dayLabel = DAYS_OF_WEEK.find(d => d.value === config.dayOfWeek)?.label || config.dayOfWeek;
      return `Weekly on ${dayLabel} at ${config.time}`;
    case 'monthly':
      return `Monthly on day ${config.dayOfMonth} at ${config.time}`;
    default:
      return cron;
  }
}

export default function ScheduledReports() {
  const { toast } = useToast();
  const [selectedReport, setSelectedReport] = useState<ScheduledReport | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    reportType: 'RECRUITING',
    format: 'PDF',
    recipients: '',
    filters: '{}',
    scheduleFrequency: 'daily',
    scheduleTime: '09:00',
    scheduleDayOfWeek: 'MON',
    scheduleDayOfMonth: '1',
    isActive: true,
  });

  // Fetch scheduled reports
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['/api/scheduled-reports'],
    queryFn: async () => {
      const response = await fetch('/api/scheduled-reports', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch scheduled reports');
      return response.json();
    }
  });

  // Fetch execution history for selected report
  const { data: executions = [] } = useQuery({
    queryKey: ['/api/scheduled-reports', selectedReport?.id, 'executions'],
    queryFn: async () => {
      if (!selectedReport) return [];
      const response = await fetch(`/api/scheduled-reports/${selectedReport.id}/executions`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch execution history');
      return response.json();
    },
    enabled: !!selectedReport && isHistoryDialogOpen,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: FormData) => {
      const cronSchedule = buildCronExpression({
        frequency: data.scheduleFrequency,
        time: data.scheduleTime,
        dayOfWeek: data.scheduleDayOfWeek,
        dayOfMonth: data.scheduleDayOfMonth,
      });

      return apiRequest('/api/scheduled-reports', {
        method: 'POST',
        body: JSON.stringify({
          name: data.name,
          reportType: data.reportType,
          format: data.format,
          recipients: data.recipients,
          filters: data.filters,
          schedule: cronSchedule,
          isActive: data.isActive,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-reports'] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: 'Success',
        description: 'Scheduled report created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create scheduled report',
        variant: 'destructive',
      });
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: { id: string; updates: FormData }) => {
      const cronSchedule = buildCronExpression({
        frequency: data.updates.scheduleFrequency,
        time: data.updates.scheduleTime,
        dayOfWeek: data.updates.scheduleDayOfWeek,
        dayOfMonth: data.updates.scheduleDayOfMonth,
      });

      return apiRequest(`/api/scheduled-reports/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: data.updates.name,
          reportType: data.updates.reportType,
          format: data.updates.format,
          recipients: data.updates.recipients,
          filters: data.updates.filters,
          schedule: cronSchedule,
          isActive: data.updates.isActive,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-reports'] });
      setIsEditDialogOpen(false);
      setSelectedReport(null);
      resetForm();
      toast({
        title: 'Success',
        description: 'Scheduled report updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update scheduled report',
        variant: 'destructive',
      });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/scheduled-reports/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-reports'] });
      toast({
        title: 'Success',
        description: 'Scheduled report deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete scheduled report',
        variant: 'destructive',
      });
    }
  });

  // Run now mutation
  const runNowMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/scheduled-reports/${id}/run`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-reports'] });
      toast({
        title: 'Success',
        description: 'Report execution started',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to run report',
        variant: 'destructive',
      });
    }
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: (data: { id: string; isActive: boolean }) =>
      apiRequest(`/api/scheduled-reports/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: data.isActive }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-reports'] });
      toast({
        title: 'Success',
        description: 'Report status updated',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update report status',
        variant: 'destructive',
      });
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      reportType: 'RECRUITING',
      format: 'PDF',
      recipients: '',
      filters: '{}',
      scheduleFrequency: 'daily',
      scheduleTime: '09:00',
      scheduleDayOfWeek: 'MON',
      scheduleDayOfMonth: '1',
      isActive: true,
    });
  };

  const openEditDialog = (report: ScheduledReport) => {
    setSelectedReport(report);
    const scheduleConfig = parseCronExpression(report.schedule);

    setFormData({
      name: report.name,
      reportType: report.reportType,
      format: report.format,
      recipients: report.recipients,
      filters: report.filters || '{}',
      scheduleFrequency: scheduleConfig.frequency,
      scheduleTime: scheduleConfig.time,
      scheduleDayOfWeek: scheduleConfig.dayOfWeek || 'MON',
      scheduleDayOfMonth: scheduleConfig.dayOfMonth || '1',
      isActive: report.isActive,
    });
    setIsEditDialogOpen(true);
  };

  const openHistoryDialog = (report: ScheduledReport) => {
    setSelectedReport(report);
    setIsHistoryDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this scheduled report?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleRunNow = (id: string) => {
    runNowMutation.mutate(id);
  };

  const handleToggleActive = (id: string, isActive: boolean) => {
    toggleActiveMutation.mutate({ id, isActive });
  };

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedReport) {
      updateMutation.mutate({
        id: selectedReport.id,
        updates: formData,
      });
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading scheduled reports...</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Scheduled Reports</h1>
          <p className="text-muted-foreground mt-2">Automate report generation and delivery</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Scheduled Report
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.length > 0 ? (
          reports.map((report: ScheduledReport) => (
            <Card key={report.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {report.name}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      {REPORT_TYPES.find(t => t.value === report.reportType)?.label || report.reportType}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={report.isActive}
                      onCheckedChange={(checked) => handleToggleActive(report.id, checked)}
                    />
                    <Badge variant={report.isActive ? 'default' : 'secondary'}>
                      {report.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{formatSchedule(report.schedule)}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>Format: {report.format}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{report.recipients.split(',').length} recipient(s)</span>
                  </div>

                  {report.lastRunAt && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Last run: {new Date(report.lastRunAt).toLocaleString()}</span>
                    </div>
                  )}

                  {report.nextRunAt && report.isActive && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Next run: {new Date(report.nextRunAt).toLocaleString()}</span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditDialog(report)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRunNow(report.id)}
                      disabled={runNowMutation.isPending}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openHistoryDialog(report)}
                    >
                      <History className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(report.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center text-muted-foreground py-12">
            No scheduled reports found. Create your first automated report!
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Scheduled Report</DialogTitle>
            <DialogDescription>
              Configure a new automated report schedule
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitCreate} className="space-y-4">
            <div>
              <Label htmlFor="name">Report Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Weekly Recruiting Summary"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="reportType">Report Type</Label>
                <Select
                  value={formData.reportType}
                  onValueChange={(value) => setFormData({ ...formData, reportType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="format">Format</Label>
                <Select
                  value={formData.format}
                  onValueChange={(value) => setFormData({ ...formData, format: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((format) => (
                      <SelectItem key={format.value} value={format.value}>
                        {format.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="recipients">Recipients (comma-separated emails)</Label>
              <Input
                id="recipients"
                value={formData.recipients}
                onChange={(e) => setFormData({ ...formData, recipients: e.target.value })}
                placeholder="john@example.com, jane@example.com"
                required
              />
            </div>

            <div>
              <Label>Schedule Frequency</Label>
              <Select
                value={formData.scheduleFrequency}
                onValueChange={(value: ScheduleFrequency) =>
                  setFormData({ ...formData, scheduleFrequency: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="scheduleTime">Time</Label>
                <Input
                  id="scheduleTime"
                  type="time"
                  value={formData.scheduleTime}
                  onChange={(e) => setFormData({ ...formData, scheduleTime: e.target.value })}
                  required
                />
              </div>

              {formData.scheduleFrequency === 'weekly' && (
                <div>
                  <Label htmlFor="scheduleDayOfWeek">Day of Week</Label>
                  <Select
                    value={formData.scheduleDayOfWeek}
                    onValueChange={(value) => setFormData({ ...formData, scheduleDayOfWeek: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map((day) => (
                        <SelectItem key={day.value} value={day.value}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.scheduleFrequency === 'monthly' && (
                <div>
                  <Label htmlFor="scheduleDayOfMonth">Day of Month</Label>
                  <Input
                    id="scheduleDayOfMonth"
                    type="number"
                    min="1"
                    max="31"
                    value={formData.scheduleDayOfMonth}
                    onChange={(e) => setFormData({ ...formData, scheduleDayOfMonth: e.target.value })}
                    required
                  />
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="filters">Filters (JSON)</Label>
              <Textarea
                id="filters"
                value={formData.filters}
                onChange={(e) => setFormData({ ...formData, filters: e.target.value })}
                placeholder='{"status": "active", "department": "Sales"}'
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Optional JSON configuration for report filters
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">Active</Label>
                <p className="text-sm text-muted-foreground">
                  Enable this scheduled report
                </p>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Report'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Scheduled Report</DialogTitle>
            <DialogDescription>
              Update report configuration
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitEdit} className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Report Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-reportType">Report Type</Label>
                <Select
                  value={formData.reportType}
                  onValueChange={(value) => setFormData({ ...formData, reportType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-format">Format</Label>
                <Select
                  value={formData.format}
                  onValueChange={(value) => setFormData({ ...formData, format: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((format) => (
                      <SelectItem key={format.value} value={format.value}>
                        {format.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="edit-recipients">Recipients (comma-separated emails)</Label>
              <Input
                id="edit-recipients"
                value={formData.recipients}
                onChange={(e) => setFormData({ ...formData, recipients: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>Schedule Frequency</Label>
              <Select
                value={formData.scheduleFrequency}
                onValueChange={(value: ScheduleFrequency) =>
                  setFormData({ ...formData, scheduleFrequency: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-scheduleTime">Time</Label>
                <Input
                  id="edit-scheduleTime"
                  type="time"
                  value={formData.scheduleTime}
                  onChange={(e) => setFormData({ ...formData, scheduleTime: e.target.value })}
                  required
                />
              </div>

              {formData.scheduleFrequency === 'weekly' && (
                <div>
                  <Label htmlFor="edit-scheduleDayOfWeek">Day of Week</Label>
                  <Select
                    value={formData.scheduleDayOfWeek}
                    onValueChange={(value) => setFormData({ ...formData, scheduleDayOfWeek: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map((day) => (
                        <SelectItem key={day.value} value={day.value}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.scheduleFrequency === 'monthly' && (
                <div>
                  <Label htmlFor="edit-scheduleDayOfMonth">Day of Month</Label>
                  <Input
                    id="edit-scheduleDayOfMonth"
                    type="number"
                    min="1"
                    max="31"
                    value={formData.scheduleDayOfMonth}
                    onChange={(e) => setFormData({ ...formData, scheduleDayOfMonth: e.target.value })}
                    required
                  />
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="edit-filters">Filters (JSON)</Label>
              <Textarea
                id="edit-filters"
                value={formData.filters}
                onChange={(e) => setFormData({ ...formData, filters: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">Active</Label>
                <p className="text-sm text-muted-foreground">
                  Enable this scheduled report
                </p>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Updating...' : 'Update Report'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Execution History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Execution History</DialogTitle>
            <DialogDescription>
              {selectedReport?.name} - Recent executions
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto max-h-[500px]">
            {executions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Executed At</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Completed At</TableHead>
                    <TableHead>File</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {executions.map((execution: ReportExecution) => (
                    <TableRow key={execution.id}>
                      <TableCell className="text-sm">
                        {new Date(execution.executedAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            execution.status === 'completed' ? 'default' :
                            execution.status === 'failed' ? 'destructive' :
                            execution.status === 'running' ? 'secondary' :
                            'outline'
                          }
                        >
                          {execution.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {execution.completedAt
                          ? new Date(execution.completedAt).toLocaleString()
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        {execution.fileUrl ? (
                          <a
                            href={execution.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-sm"
                          >
                            Download
                          </a>
                        ) : execution.error ? (
                          <span className="text-sm text-destructive" title={execution.error}>
                            Error
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No execution history available
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
