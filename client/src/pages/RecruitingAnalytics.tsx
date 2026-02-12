import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  LabelList,
  Cell,
} from 'recharts';
import {
  Users,
  TrendingUp,
  TrendingDown,
  Clock,
  UserCheck,
  Target,
  Calendar,
  BarChart as BarChartIcon,
  Archive,
  Download,
  RotateCcw,
  FileText,
  Search,
  Eye,
  Printer,
} from 'lucide-react';
import { CandidateDetailsDialog } from '@/components/recruiting/candidate-details-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

type Period = '7d' | '30d' | '90d' | 'year' | 'all';

interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  position: string;
  status: string;
  stage?: string;
  appliedDate?: string;
  matchScore?: number;
  isArchived?: boolean;
  archivedAt?: string;
  notes?: string;
}

export default function RecruitingAnalytics() {
  const [period, setPeriod] = useState<Period>('30d');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('all');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [archiveSearch, setArchiveSearch] = useState('');
  const [archiveStatusFilter, setArchiveStatusFilter] = useState<string>('all');
  const [selectedArchivedIds, setSelectedArchivedIds] = useState<string[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [showCandidateDetails, setShowCandidateDetails] = useState(false);
  const [showHiredDialog, setShowHiredDialog] = useState(false);
  const [selectedTeamMember, setSelectedTeamMember] = useState<{
    name: string;
    hiredCandidates: Array<{ id: string; name: string; position: string; hiredDate: string }>;
  } | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch overview data
  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['recruiting-analytics', 'overview', period, selectedAssigneeId],
    queryFn: async () => {
      const params = new URLSearchParams({ period });
      if (selectedAssigneeId !== 'all') params.append('assigneeId', selectedAssigneeId);
      const response = await fetch(`/api/recruiting-analytics/overview?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch overview');
      return response.json();
    },
  });

  // Fetch pipeline data
  const { data: pipeline, isLoading: loadingPipeline } = useQuery({
    queryKey: ['recruiting-analytics', 'pipeline', period, selectedAssigneeId],
    queryFn: async () => {
      const params = new URLSearchParams({ period });
      if (selectedAssigneeId !== 'all') params.append('assigneeId', selectedAssigneeId);
      const response = await fetch(`/api/recruiting-analytics/pipeline?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch pipeline');
      return response.json();
    },
  });

  // Fetch assignee breakdown data
  const { data: assignees, isLoading: loadingAssignees } = useQuery({
    queryKey: ['recruiting-analytics', 'recruiters', period, selectedAssigneeId],
    queryFn: async () => {
      const params = new URLSearchParams({ period });
      if (selectedAssigneeId !== 'all') params.append('assigneeId', selectedAssigneeId);
      const response = await fetch(`/api/recruiting-analytics/recruiters?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch assignees');
      return response.json();
    },
  });

  // Fetch time-to-hire data
  const { data: timeToHire, isLoading: loadingTimeToHire } = useQuery({
    queryKey: ['recruiting-analytics', 'time-to-hire', period, selectedAssigneeId],
    queryFn: async () => {
      const params = new URLSearchParams({ period });
      if (selectedAssigneeId !== 'all') params.append('assigneeId', selectedAssigneeId);
      const response = await fetch(`/api/recruiting-analytics/time-to-hire?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch time-to-hire');
      return response.json();
    },
  });

  // Fetch interviews data
  const { data: interviews, isLoading: loadingInterviews } = useQuery({
    queryKey: ['recruiting-analytics', 'interviews', period, selectedAssigneeId],
    queryFn: async () => {
      const params = new URLSearchParams({ period });
      if (selectedAssigneeId !== 'all') params.append('assigneeId', selectedAssigneeId);
      const response = await fetch(`/api/recruiting-analytics/interviews?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch interviews');
      return response.json();
    },
  });

  // Fetch recruiters data
  const { data: recruiters, isLoading: loadingRecruiters } = useQuery({
    queryKey: ['recruiting-analytics', 'recruiters-table', period, selectedAssigneeId],
    queryFn: async () => {
      const params = new URLSearchParams({ period });
      if (selectedAssigneeId !== 'all') params.append('assigneeId', selectedAssigneeId);
      const response = await fetch(`/api/recruiting-analytics/recruiters?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch recruiters');
      return response.json();
    },
  });

  // Fetch drop-off data
  const { data: dropoff, isLoading: loadingDropoff } = useQuery({
    queryKey: ['recruiting-analytics', 'dropoff', period, selectedAssigneeId],
    queryFn: async () => {
      const params = new URLSearchParams({ period });
      if (selectedAssigneeId !== 'all') params.append('assigneeId', selectedAssigneeId);
      const response = await fetch(`/api/recruiting-analytics/dropoff?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch dropoff');
      return response.json();
    },
  });

  // Fetch all candidates (including archived) for archive management
  const { data: allCandidates = [], isLoading: loadingCandidates } = useQuery<Candidate[]>({
    queryKey: ['candidates', 'includeArchived'],
    queryFn: async () => {
      const response = await fetch('/api/candidates?includeArchived=true', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch candidates');
      return response.json();
    },
  });

  // Fetch employees for candidate details dialog
  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await fetch('/api/users', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
  });

  // Get archived candidates only
  const archivedCandidates = allCandidates.filter(c => c.isArchived);

  // Filter archived candidates based on search and status filter
  const filteredArchivedCandidates = archivedCandidates.filter(c => {
    const matchesSearch = `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(archiveSearch.toLowerCase());
    const matchesStatus = archiveStatusFilter === 'all' || c.status === archiveStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => {
      const response = await fetch(`/api/candidates/${id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ archive }),
      });
      if (!response.ok) throw new Error('Failed to archive candidate');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      toast({ title: 'Success', description: 'Candidate updated successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update candidate', variant: 'destructive' });
    },
  });

  // Bulk archive mutation
  const bulkArchiveMutation = useMutation({
    mutationFn: async ({ candidateIds, archive }: { candidateIds: string[]; archive: boolean }) => {
      const response = await fetch('/api/candidates/bulk-archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ candidateIds, archive }),
      });
      if (!response.ok) throw new Error('Failed to bulk archive');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      setSelectedArchivedIds([]);
      toast({ title: 'Success', description: `Updated ${data.count} candidates` });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update candidates', variant: 'destructive' });
    },
  });

  // Auto-archive mutation
  const autoArchiveMutation = useMutation({
    mutationFn: async (daysOld: number = 30) => {
      const response = await fetch('/api/candidates/auto-archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ daysOld }),
      });
      if (!response.ok) throw new Error('Failed to auto-archive');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      toast({ title: 'Success', description: `Archived ${data.archivedCount} dead candidates older than 30 days` });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to auto-archive candidates', variant: 'destructive' });
    },
  });

  // Export handlers
  const handleExportCSV = (type: 'current' | 'archived' | 'all') => {
    window.open(`/api/recruiting-analytics/export/csv?type=${type}`, '_blank');
  };

  const handleExportPDF = (type: 'current' | 'archived' | 'all') => {
    window.open(`/api/recruiting-analytics/export/pdf?type=${type}`, '_blank');
  };

  // Toggle selection for bulk actions
  const toggleArchivedSelection = (id: string, checked: boolean) => {
    setSelectedArchivedIds(prev =>
      checked ? [...prev, id] : prev.filter(i => i !== id)
    );
  };

  // Select all filtered archived candidates
  const toggleSelectAllArchived = (checked: boolean) => {
    setSelectedArchivedIds(checked ? filteredArchivedCandidates.map(c => c.id) : []);
  };

  // Format date helper - use Eastern Time
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', { timeZone: 'America/New_York' });
  };

  // Get status badge color
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'DEAD_BY_US': return 'destructive';
      case 'DEAD_BY_CANDIDATE': return 'secondary';
      case 'NO_SHOW': return 'outline';
      default: return 'default';
    }
  };

  // Transform pipeline data for chart
  // Order: Phone Screening → Called → Interview Scheduled → Decision Pending → Hired
  const pipelineChartData = pipeline?.stages
    ? [
        { stage: 'Phone Screening', count: pipeline.stages.screening.count, fill: COLORS[0] },
        { stage: 'Called', count: pipeline.stages.applied.count, fill: COLORS[1] },
        { stage: 'Interview Scheduled', count: pipeline.stages.interview.count, fill: COLORS[2] },
        { stage: 'Decision Pending', count: pipeline.stages.offer.count, fill: COLORS[3] },
        { stage: 'Hired', count: pipeline.stages.hired.count, fill: COLORS[4] },
      ]
    : [];


  const MetricCard = ({
    title,
    value,
    subtitle,
    icon: Icon,
    trend,
    trendValue,
    loading,
  }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: any;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
    loading?: boolean;
  }) => (
    <Card>
      <CardContent className="pt-6">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="text-3xl font-bold">{value}</p>
              {trend && trendValue && (
                <Badge variant={trend === 'up' ? 'default' : trend === 'down' ? 'destructive' : 'secondary'} className="text-xs">
                  {trend === 'up' ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                  {trendValue}
                </Badge>
              )}
            </div>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recruitment Analytics</h1>
          <p className="text-muted-foreground">Track your hiring pipeline and recruitment performance</p>
        </div>
        <div className="flex gap-3">
          {/* Employee Filter */}
          <Select value={selectedAssigneeId} onValueChange={(v) => { setSelectedAssigneeId(v); setEmployeeSearch(''); }}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="All Employees" />
            </SelectTrigger>
            <SelectContent>
              {/* Search Input */}
              <div className="px-2 pb-2">
                <Input
                  placeholder="Search employees..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="h-8"
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
              <SelectItem value="all">All Employees</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {(() => {
                // Get employee IDs who have candidates assigned
                const assigneeIds = new Set(
                  recruiters?.recruiters
                    ?.filter((r: any) => r.id !== 'unassigned' && r.candidatesAssigned > 0)
                    ?.map((r: any) => r.id) || []
                );

                // Get candidate counts by assignee
                const assigneeCounts: Record<string, number> = {};
                recruiters?.recruiters?.forEach((r: any) => {
                  if (r.id !== 'unassigned') {
                    assigneeCounts[r.id] = r.candidatesAssigned || 0;
                  }
                });

                // Filter and sort employees
                const filteredEmployees = employees
                  .filter((e: any) => e.isActive !== false)
                  .filter((e: any) =>
                    `${e.firstName} ${e.lastName}`.toLowerCase().includes(employeeSearch.toLowerCase())
                  )
                  .sort((a: any, b: any) => {
                    const aHasCandidates = assigneeIds.has(a.id);
                    const bHasCandidates = assigneeIds.has(b.id);
                    // Assignees first
                    if (aHasCandidates && !bHasCandidates) return -1;
                    if (!aHasCandidates && bHasCandidates) return 1;
                    // Then by candidate count (descending)
                    const aCount = assigneeCounts[a.id] || 0;
                    const bCount = assigneeCounts[b.id] || 0;
                    if (aCount !== bCount) return bCount - aCount;
                    // Then alphabetically
                    return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
                  });

                // Only show employees with candidates, unless searching
                const displayEmployees = employeeSearch
                  ? filteredEmployees
                  : filteredEmployees.filter((e: any) => assigneeIds.has(e.id));

                return displayEmployees.map((e: any) => {
                  const count = assigneeCounts[e.id] || 0;
                  return (
                    <SelectItem key={e.id} value={e.id}>
                      {e.firstName} {e.lastName}
                      {count > 0 && <span className="ml-2 text-muted-foreground">({count})</span>}
                    </SelectItem>
                  );
                });
              })()}
            </SelectContent>
          </Select>

          {/* Period Filter */}
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="year">Last year</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>

          {/* Print Report Button */}
          <Button
            variant="outline"
            size="default"
            onClick={() => {
              const token = localStorage.getItem('token');
              const params = new URLSearchParams({ period });
              if (selectedAssigneeId !== 'all') params.append('assigneeId', selectedAssigneeId);
              if (token) params.append('token', token);
              window.open(`/api/recruiting-analytics/export/analytics-report?${params}`, '_blank');
            }}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print Report
          </Button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Candidates"
          value={overview?.totalCandidates || 0}
          subtitle="In selected period"
          icon={Users}
          loading={loadingOverview}
        />
        <MetricCard
          title="Active Pipeline"
          value={overview?.activePipeline || 0}
          subtitle="Currently in process"
          icon={Target}
          loading={loadingOverview}
        />
        <MetricCard
          title="Hired This Month"
          value={overview?.hiredThisMonth || 0}
          subtitle={`vs ${overview?.hiredLastMonth || 0} last month`}
          icon={UserCheck}
          trend={overview?.hiredThisMonth > overview?.hiredLastMonth ? 'up' : 'down'}
          trendValue={overview?.hiredLastMonth > 0
            ? `${Math.round(((overview?.hiredThisMonth - overview?.hiredLastMonth) / overview?.hiredLastMonth) * 100)}%`
            : undefined}
          loading={loadingOverview}
        />
        <MetricCard
          title="Avg Days to Hire"
          value={overview?.avgDaysToHire || 0}
          subtitle={overview?.avgDaysToHireLastMonth ? `vs ${overview?.avgDaysToHireLastMonth} days last month` : 'days average'}
          icon={Clock}
          trend={overview?.avgDaysToHire < overview?.avgDaysToHireLastMonth ? 'up' : 'down'}
          trendValue={overview?.avgDaysToHireLastMonth > 0
            ? `${Math.abs(overview?.avgDaysToHire - overview?.avgDaysToHireLastMonth)} days`
            : undefined}
          loading={loadingOverview}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pipeline Funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChartIcon className="h-5 w-5" />
              Pipeline Funnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPipeline ? (
              <div className="h-[300px] flex items-center justify-center">
                <Skeleton className="h-full w-full" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={pipelineChartData} layout="vertical" margin={{ left: 20, right: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="stage" type="category" width={80} />
                  <Tooltip
                    formatter={(value: number) => [value, 'Candidates']}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {pipelineChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                    <LabelList dataKey="count" position="right" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            {pipeline && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-center gap-4 text-sm">
                  <span className="text-muted-foreground">
                    Overall Conversion: <span className="font-semibold text-foreground">{pipeline.overallConversionRate}%</span>
                  </span>
                </div>
                {pipeline.stages?.dead?.count > 0 && (
                  <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                    <span>Dead: {pipeline.stages.dead.count}</span>
                    {pipeline.stages.dead.noShow > 0 && (
                      <span className="text-red-500">No Show: {pipeline.stages.dead.noShow}</span>
                    )}
                    {pipeline.stages.dead.deadByUs > 0 && (
                      <span>Dead by Us: {pipeline.stages.dead.deadByUs}</span>
                    )}
                    {pipeline.stages.dead.deadByCandidate > 0 && (
                      <span>Dead by Candidate: {pipeline.stages.dead.deadByCandidate}</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Hires - Shows hired candidates per team member */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Team Hires
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingAssignees ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : recruiters?.recruiters?.length > 0 ? (
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {recruiters.recruiters
                  .filter((r: any) => r.hiredCount > 0)
                  .map((recruiter: any) => (
                    <div
                      key={recruiter.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedTeamMember({
                          name: recruiter.name,
                          hiredCandidates: recruiter.hiredCandidates || [],
                        });
                        setShowHiredDialog(true);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                          <span className="text-green-700 font-bold text-lg">{recruiter.hiredCount}</span>
                        </div>
                        <div>
                          <p className="font-medium">{recruiter.name}</p>
                          {recruiter.role && (
                            <p className="text-xs text-muted-foreground">{recruiter.role.replace(/_/g, ' ')}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {recruiter.hireRate}% rate
                        </Badge>
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                {recruiters.recruiters.filter((r: any) => r.hiredCount > 0).length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">
                    <UserCheck className="mx-auto h-10 w-10 mb-3 opacity-50" />
                    <p>No hires in this period</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No team data available
              </div>
            )}
            {/* Total Hires Summary */}
            {recruiters?.totals?.totalHired > 0 && (
              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Hires</span>
                <span className="text-2xl font-bold text-green-600">{recruiters.totals.totalHired}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Time to Hire Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Time to Hire Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTimeToHire ? (
              <div className="h-[300px] flex items-center justify-center">
                <Skeleton className="h-full w-full" />
              </div>
            ) : timeToHire?.trend?.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timeToHire.trend} margin={{ left: 10, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis label={{ value: 'Days', angle: -90, position: 'insideLeft' }} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      name === 'avgDays' ? `${value} days` : value,
                      name === 'avgDays' ? 'Avg Days to Hire' : 'Hires',
                    ]}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="avgDays" name="Avg Days" stroke="#3b82f6" strokeWidth={2} />
                  <Line type="monotone" dataKey="hireCount" name="Hires" stroke="#10b981" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No trend data available
              </div>
            )}
            {timeToHire && (
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Current Period: <span className="font-semibold text-foreground">{timeToHire.current} days</span>
                </span>
                <span className="text-muted-foreground">
                  Previous Period: <span className="font-semibold text-foreground">{timeToHire.previous} days</span>
                </span>
                {timeToHire.change !== 0 && (
                  <Badge variant={timeToHire.change < 0 ? 'default' : 'destructive'}>
                    {timeToHire.change < 0 ? <TrendingDown className="h-3 w-3 mr-1" /> : <TrendingUp className="h-3 w-3 mr-1" />}
                    {Math.abs(timeToHire.change)}% {timeToHire.change < 0 ? 'faster' : 'slower'}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Interview Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Interview Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingInterviews ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : interviews ? (
              <div className="space-y-6">
                {/* Status breakdown */}
                <div>
                  <h4 className="text-sm font-medium mb-3">By Status</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{interviews.byStatus?.completed || 0}</p>
                      <p className="text-xs text-muted-foreground">Completed</p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{interviews.byStatus?.scheduled || 0}</p>
                      <p className="text-xs text-muted-foreground">Scheduled</p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-2xl font-bold text-yellow-600">{interviews.byStatus?.cancelled || 0}</p>
                      <p className="text-xs text-muted-foreground">Cancelled</p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-2xl font-bold text-red-600">{interviews.byStatus?.noShow || 0}</p>
                      <p className="text-xs text-muted-foreground">No Show</p>
                    </div>
                  </div>
                </div>

                {/* Type breakdown */}
                <div>
                  <h4 className="text-sm font-medium mb-3">By Type</h4>
                  <div className="flex flex-wrap gap-2">
                    {interviews.byType?.phone > 0 && (
                      <Badge variant="outline">Phone: {interviews.byType.phone}</Badge>
                    )}
                    {interviews.byType?.video > 0 && (
                      <Badge variant="outline">Video: {interviews.byType.video}</Badge>
                    )}
                    {interviews.byType?.inPerson > 0 && (
                      <Badge variant="outline">In Person: {interviews.byType.inPerson}</Badge>
                    )}
                    {interviews.byType?.technical > 0 && (
                      <Badge variant="outline">Technical: {interviews.byType.technical}</Badge>
                    )}
                    {interviews.byType?.panel > 0 && (
                      <Badge variant="outline">Panel: {interviews.byType.panel}</Badge>
                    )}
                  </div>
                </div>

                {/* Summary stats */}
                <div className="flex items-center justify-between pt-3 border-t">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Interviews</p>
                    <p className="text-xl font-bold">{interviews.total}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Completion Rate</p>
                    <p className="text-xl font-bold">{interviews.completionRate}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Rating</p>
                    <p className="text-xl font-bold">{interviews.avgRating || '-'}/5</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No interview data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Drop-off Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-500" />
            Pipeline Drop-off Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingDropoff ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : dropoff ? (
            <div className="space-y-6">
              {/* No-show alert */}
              {interviews?.byStatus?.noShow > 10 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="flex items-center gap-2 text-red-800 font-semibold mb-1">
                    <TrendingDown className="h-4 w-4" />
                    High No-Show Rate Alert
                  </div>
                  <p className="text-sm text-red-700">
                    {interviews.byStatus.noShow} interview no-shows detected ({interviews.total > 0 ? Math.round((interviews.byStatus.noShow / interviews.total) * 100) : 0}% of all interviews).
                    This is a major source of candidate loss.
                  </p>
                </div>
              )}

              {/* Drop-off by stage */}
              <div>
                <h4 className="text-sm font-medium mb-3">Where Candidates Are Lost</h4>
                <div className="space-y-3">
                  {dropoff.dropOffByStage?.map((stage: any) => (
                    <div key={stage.stage} className="flex items-center gap-4">
                      <div className="w-40 text-sm font-medium">{stage.label}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden flex">
                            {stage.deadByUs > 0 && (
                              <div
                                className="h-full bg-red-500"
                                style={{ width: `${dropoff.totalDead > 0 ? (stage.deadByUs / dropoff.totalDead) * 100 : 0}%` }}
                                title={`Dead by Us: ${stage.deadByUs}`}
                              />
                            )}
                            {stage.deadByCandidate > 0 && (
                              <div
                                className="h-full bg-orange-400"
                                style={{ width: `${dropoff.totalDead > 0 ? (stage.deadByCandidate / dropoff.totalDead) * 100 : 0}%` }}
                                title={`Dead by Candidate: ${stage.deadByCandidate}`}
                              />
                            )}
                            {stage.noShow > 0 && (
                              <div
                                className="h-full bg-yellow-500"
                                style={{ width: `${dropoff.totalDead > 0 ? (stage.noShow / dropoff.totalDead) * 100 : 0}%` }}
                                title={`No Show: ${stage.noShow}`}
                              />
                            )}
                          </div>
                          <span className="text-sm font-semibold w-8 text-right">{stage.total}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-4 mt-3 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-red-500" />
                    <span>Dead by Us</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-orange-400" />
                    <span>Dead by Candidate</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-yellow-500" />
                    <span>No Show</span>
                  </div>
                </div>
              </div>

              {/* Summary stats */}
              <div className="flex items-center justify-between pt-3 border-t">
                <div>
                  <p className="text-sm text-muted-foreground">Total Lost</p>
                  <p className="text-xl font-bold text-red-600">{dropoff.totalDead}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Still Active</p>
                  <p className="text-xl font-bold text-green-600">{dropoff.totalActive}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Stale ({'>'}14 days)</p>
                  <p className="text-xl font-bold text-yellow-600">{dropoff.staleCount}</p>
                </div>
              </div>

              {/* Stale candidates alert */}
              {dropoff.staleCount > 0 && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                  <div className="flex items-center gap-2 text-yellow-800 font-semibold mb-2">
                    <Clock className="h-4 w-4" />
                    {dropoff.staleCount} Stale Candidates Need Attention
                  </div>
                  <div className="space-y-1">
                    {dropoff.staleCandidates?.slice(0, 5).map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between text-sm">
                        <span className="text-yellow-800">{c.name} - {c.position}</span>
                        <Badge variant="outline" className="text-xs">
                          {c.daysSinceUpdate} days idle
                        </Badge>
                      </div>
                    ))}
                    {dropoff.staleCount > 5 && (
                      <p className="text-xs text-yellow-700 pt-1">+{dropoff.staleCount - 5} more stale candidates</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No drop-off data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRecruiters ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : recruiters?.recruiters?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Team Member</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Role</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground">Candidates</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground">Hired</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground">Hire Rate</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground">Avg Days to Hire</th>
                  </tr>
                </thead>
                <tbody>
                  {recruiters.recruiters.map((recruiter: any) => (
                    <tr
                      key={recruiter.id}
                      className={`border-b hover:bg-muted/50 ${recruiter.id === 'unassigned' ? 'bg-muted/30 italic' : ''}`}
                    >
                      <td className="py-3 px-4">
                        <div>
                          <p className={`font-medium ${recruiter.id === 'unassigned' ? 'text-muted-foreground' : ''}`}>
                            {recruiter.name}
                          </p>
                          {recruiter.email && (
                            <p className="text-xs text-muted-foreground">{recruiter.email}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {recruiter.role ? (
                          <Badge variant="outline" className="text-xs">
                            {recruiter.role.replace(/_/g, ' ')}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="text-center py-3 px-4">{recruiter.candidatesAssigned}</td>
                      <td className="text-center py-3 px-4">
                        <span className="font-semibold text-green-600">{recruiter.hiredCount}</span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <Badge variant={recruiter.hireRate >= 15 ? 'default' : recruiter.hireRate >= 10 ? 'secondary' : 'outline'}>
                          {recruiter.hireRate}%
                        </Badge>
                      </td>
                      <td className="text-center py-3 px-4">
                        {recruiter.avgDaysToHire > 0 ? `${recruiter.avgDaysToHire} days` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Totals Row */}
                {recruiters.totals && (
                  <tfoot>
                    <tr className="border-t-2 bg-muted/50 font-semibold">
                      <td className="py-3 px-4">Total</td>
                      <td className="py-3 px-4"></td>
                      <td className="text-center py-3 px-4">{recruiters.totals.totalCandidates}</td>
                      <td className="text-center py-3 px-4">
                        <span className="text-green-600">{recruiters.totals.totalHired}</span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <Badge variant="default">
                          {recruiters.totals.totalCandidates > 0
                            ? Math.round((recruiters.totals.totalHired / recruiters.totals.totalCandidates) * 100 * 10) / 10
                            : 0}%
                        </Badge>
                      </td>
                      <td className="text-center py-3 px-4">-</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No team data available for this period
            </div>
          )}
        </CardContent>
      </Card>

      {/* Archive Management Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Archive Management
          </CardTitle>
          <div className="flex gap-2">
            {/* Auto-Archive Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => autoArchiveMutation.mutate(30)}
              disabled={autoArchiveMutation.isPending}
            >
              <Archive className="mr-2 h-4 w-4" />
              {autoArchiveMutation.isPending ? 'Archiving...' : 'Archive Dead 30+ Days'}
            </Button>

            {/* Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExportCSV('current')}>
                  <FileText className="mr-2 h-4 w-4" />
                  Current Candidates (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportCSV('archived')}>
                  <FileText className="mr-2 h-4 w-4" />
                  Archived Candidates (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportCSV('all')}>
                  <FileText className="mr-2 h-4 w-4" />
                  All Candidates (CSV)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleExportPDF('current')}>
                  <FileText className="mr-2 h-4 w-4" />
                  Current Report (PDF)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportPDF('archived')}>
                  <FileText className="mr-2 h-4 w-4" />
                  Archived Report (PDF)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search and Filters */}
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search archived candidates..."
                  value={archiveSearch}
                  onChange={(e) => setArchiveSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={archiveStatusFilter} onValueChange={setArchiveStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="DEAD_BY_US">Dead by Us</SelectItem>
                  <SelectItem value="DEAD_BY_CANDIDATE">Dead by Candidate</SelectItem>
                  <SelectItem value="NO_SHOW">No Show</SelectItem>
                </SelectContent>
              </Select>

              {selectedArchivedIds.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => bulkArchiveMutation.mutate({ candidateIds: selectedArchivedIds, archive: false })}
                  disabled={bulkArchiveMutation.isPending}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Unarchive ({selectedArchivedIds.length})
                </Button>
              )}
            </div>

            {/* Archived Candidates Table */}
            {loadingCandidates ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : filteredArchivedCandidates.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedArchivedIds.length === filteredArchivedCandidates.length && filteredArchivedCandidates.length > 0}
                          onCheckedChange={(checked) => toggleSelectAllArchived(checked === true)}
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Archived Date</TableHead>
                      <TableHead className="text-center">Match Score</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredArchivedCandidates.map((candidate) => (
                      <TableRow key={candidate.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedArchivedIds.includes(candidate.id)}
                            onCheckedChange={(checked) => toggleArchivedSelection(candidate.id, checked === true)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{candidate.firstName} {candidate.lastName}</p>
                            <p className="text-xs text-muted-foreground">{candidate.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{candidate.position}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(candidate.status)}>
                            {candidate.status.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(candidate.archivedAt)}</TableCell>
                        <TableCell className="text-center">
                          {candidate.matchScore ? `${candidate.matchScore}%` : '-'}
                        </TableCell>
                        <TableCell className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedCandidate(candidate);
                              setShowCandidateDetails(true);
                            }}
                            title="View Profile"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => archiveMutation.mutate({ id: candidate.id, archive: false })}
                            disabled={archiveMutation.isPending}
                            title="Unarchive"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <Archive className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">No archived candidates</p>
                <p className="text-sm">Archived candidates will appear here</p>
              </div>
            )}

            {/* Summary */}
            {archivedCandidates.length > 0 && (
              <div className="text-sm text-muted-foreground">
                Showing {filteredArchivedCandidates.length} of {archivedCandidates.length} archived candidates
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Candidate Details Dialog */}
      <CandidateDetailsDialog
        isOpen={showCandidateDetails}
        onOpenChange={setShowCandidateDetails}
        candidate={selectedCandidate}
        availableEmployees={employees}
        onEditCandidate={() => {}}
        onScheduleInterview={() => {}}
        onSendEmail={() => {}}
        onRunAIAnalysis={() => {}}
        onMoveToNextStage={() => {}}
        getNextStatus={() => ''}
        isAnalyzing={false}
        isUpdating={false}
      />

      {/* Hired Candidates Dialog */}
      <Dialog open={showHiredDialog} onOpenChange={setShowHiredDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-green-600" />
              Hired by {selectedTeamMember?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {selectedTeamMember?.hiredCandidates && selectedTeamMember.hiredCandidates.length > 0 ? (
              selectedTeamMember.hiredCandidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                >
                  <div>
                    <p className="font-medium">{candidate.name}</p>
                    <p className="text-sm text-muted-foreground">{candidate.position}</p>
                    {(candidate as any).recruitedBy && (
                      <p className="text-xs text-muted-foreground">Hired by {(candidate as any).recruitedBy}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <Badge variant="default" className="bg-green-600">Hired</Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(candidate.hiredDate).toLocaleDateString('en-US', { timeZone: 'America/New_York' })}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                No hired candidates found
              </div>
            )}
          </div>
          {selectedTeamMember?.hiredCandidates && selectedTeamMember.hiredCandidates.length > 0 && (
            <div className="pt-4 border-t text-center">
              <p className="text-sm text-muted-foreground">
                Total: <span className="font-bold text-green-600">{selectedTeamMember.hiredCandidates.length}</span> hired
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
