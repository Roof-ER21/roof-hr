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
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  LabelList,
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
} from 'lucide-react';
import { CandidateDetailsDialog } from '@/components/recruiting/candidate-details-dialog';

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
  const [archiveSearch, setArchiveSearch] = useState('');
  const [archiveStatusFilter, setArchiveStatusFilter] = useState<string>('all');
  const [selectedArchivedIds, setSelectedArchivedIds] = useState<string[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [showCandidateDetails, setShowCandidateDetails] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch overview data
  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['recruiting-analytics', 'overview', period],
    queryFn: async () => {
      const response = await fetch(`/api/recruiting-analytics/overview?period=${period}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch overview');
      return response.json();
    },
  });

  // Fetch pipeline data
  const { data: pipeline, isLoading: loadingPipeline } = useQuery({
    queryKey: ['recruiting-analytics', 'pipeline', period],
    queryFn: async () => {
      const response = await fetch(`/api/recruiting-analytics/pipeline?period=${period}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch pipeline');
      return response.json();
    },
  });

  // Fetch sources data
  const { data: sources, isLoading: loadingSources } = useQuery({
    queryKey: ['recruiting-analytics', 'sources', period],
    queryFn: async () => {
      const response = await fetch(`/api/recruiting-analytics/sources?period=${period}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch sources');
      return response.json();
    },
  });

  // Fetch time-to-hire data
  const { data: timeToHire, isLoading: loadingTimeToHire } = useQuery({
    queryKey: ['recruiting-analytics', 'time-to-hire', period],
    queryFn: async () => {
      const response = await fetch(`/api/recruiting-analytics/time-to-hire?period=${period}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch time-to-hire');
      return response.json();
    },
  });

  // Fetch interviews data
  const { data: interviews, isLoading: loadingInterviews } = useQuery({
    queryKey: ['recruiting-analytics', 'interviews', period],
    queryFn: async () => {
      const response = await fetch(`/api/recruiting-analytics/interviews?period=${period}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch interviews');
      return response.json();
    },
  });

  // Fetch recruiters data
  const { data: recruiters, isLoading: loadingRecruiters } = useQuery({
    queryKey: ['recruiting-analytics', 'recruiters', period],
    queryFn: async () => {
      const response = await fetch(`/api/recruiting-analytics/recruiters?period=${period}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch recruiters');
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
  const pipelineChartData = pipeline?.stages
    ? [
        { stage: 'Applied', count: pipeline.stages.applied.count, fill: COLORS[0] },
        { stage: 'Screening', count: pipeline.stages.screening.count, fill: COLORS[1] },
        { stage: 'Interview', count: pipeline.stages.interview.count, fill: COLORS[2] },
        { stage: 'Offer', count: pipeline.stages.offer.count, fill: COLORS[3] },
        { stage: 'Hired', count: pipeline.stages.hired.count, fill: COLORS[4] },
      ]
    : [];

  // Transform sources data for pie chart
  const sourceChartData = sources?.sources?.map((s: any, idx: number) => ({
    name: s.source,
    value: s.count,
    percentage: s.percentage,
    fill: COLORS[idx % COLORS.length],
  })) || [];

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
              <div className="mt-4 flex items-center justify-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  Overall Conversion: <span className="font-semibold text-foreground">{pipeline.overallConversionRate}%</span>
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Source Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Source Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingSources ? (
              <div className="h-[300px] flex items-center justify-center">
                <Skeleton className="h-full w-full" />
              </div>
            ) : sourceChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={sourceChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name} (${percentage}%)`}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {sourceChartData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [value, 'Candidates']}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No source data available
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
        getNextStatus={() => ''}
        isAnalyzing={false}
        isUpdating={false}
      />
    </div>
  );
}
