import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  Download,
  MapPin,
  TrendingUp,
  Users,
  Clock,
  FileText,
  Search,
  Filter,
} from 'lucide-react';
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
} from 'recharts';

interface AttendanceAnalytics {
  totalSessions: number;
  totalAttendees: number;
  avgAttendancePerSession: number;
  locationBreakdown: Record<string, number>;
  sessions: AttendanceSession[];
}

interface AttendanceSession {
  id: string;
  name: string;
  location: 'RICHMOND' | 'PHILLY' | 'DMV';
  status: 'ACTIVE' | 'CLOSED';
  startsAt: string;
  expiresAt: string;
  notes: string | null;
  createdAt: string;
  checkIns?: AttendanceCheckIn[];
}

interface AttendanceCheckIn {
  id: string;
  name: string;
  email: string | null;
  checkedInAt: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function AttendanceAdminDashboard() {
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()).toISOString(),
    to: endOfMonth(new Date()).toISOString(),
  });
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch analytics data
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['/api/attendance/analytics', dateRange.from, dateRange.to, selectedLocation],
    queryFn: () => {
      const params = new URLSearchParams({
        from: dateRange.from,
        to: dateRange.to,
        ...(selectedLocation !== 'ALL' && { location: selectedLocation }),
      });
      return fetch(`/api/attendance/analytics?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      }).then(res => res.json());
    },
  });

  // Fetch all sessions for history
  const { data: allSessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['/api/attendance/sessions'],
  });

  // Export all data
  const handleExportAll = async () => {
    try {
      const params = new URLSearchParams({
        from: dateRange.from,
        to: dateRange.to,
        ...(selectedLocation !== 'ALL' && { location: selectedLocation }),
      });

      const response = await fetch(`/api/attendance/analytics?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const csvContent = generateCSV(data);
        downloadCSV(csvContent, `attendance_analytics_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        toast({
          title: 'Export Successful',
          description: 'Analytics data has been exported.',
        });
      }
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export analytics data.',
        variant: 'destructive',
      });
    }
  };

  const generateCSV = (data: AttendanceAnalytics) => {
    const headers = ['Session Name', 'Location', 'Date', 'Attendees', 'Status'];
    const rows = data.sessions.map(session => [
      session.name,
      session.location,
      format(new Date(session.startsAt), 'yyyy-MM-dd'),
      session.checkIns?.length || 0,
      session.status,
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // Filter sessions based on search
  const filteredSessions = allSessions.filter((session: AttendanceSession) => {
    const matchesSearch = session.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          session.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLocation = selectedLocation === 'ALL' || session.location === selectedLocation;
    return matchesSearch && matchesLocation;
  });

  // Prepare chart data
  const locationChartData = analytics?.locationBreakdown ? Object.entries(analytics.locationBreakdown).map(([location, count]) => ({
    name: location,
    value: count,
  })) : [];

  const attendanceTrendData = analytics?.sessions?.slice(-7).map((session: AttendanceSession) => ({
    date: format(new Date(session.startsAt), 'MMM dd'),
    attendees: session.checkIns?.length || 0,
  })) || [];

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Attendance Analytics</h1>
          <p className="text-muted-foreground mt-2">
            Comprehensive attendance tracking analytics and insights
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/attendance">
            <Button variant="outline" data-testid="button-back-dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <Button onClick={handleExportAll} data-testid="button-export-all">
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter analytics by date range and location</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="date-from">From Date</Label>
              <Input
                id="date-from"
                type="date"
                value={dateRange.from.split('T')[0]}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                data-testid="input-date-from"
              />
            </div>
            <div>
              <Label htmlFor="date-to">To Date</Label>
              <Input
                id="date-to"
                type="date"
                value={dateRange.to.split('T')[0]}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                data-testid="input-date-to"
              />
            </div>
            <div>
              <Label htmlFor="location-filter">Location</Label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger data-testid="select-location-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Locations</SelectItem>
                  <SelectItem value="RICHMOND">Richmond</SelectItem>
                  <SelectItem value="PHILLY">Philadelphia</SelectItem>
                  <SelectItem value="DMV">DMV</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search sessions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Calendar className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-sessions">
                  {analytics?.totalSessions || 0}
                </p>
                <p className="text-xs text-muted-foreground">Sessions held</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Attendees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-attendees">
                  {analytics?.totalAttendees || 0}
                </p>
                <p className="text-xs text-muted-foreground">Total check-ins</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold" data-testid="text-avg-attendance">
                  {analytics?.avgAttendancePerSession?.toFixed(1) || 0}
                </p>
                <p className="text-xs text-muted-foreground">Per session</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold" data-testid="text-active-sessions">
                  {allSessions.filter((s: AttendanceSession) => s.status === 'ACTIVE').length}
                </p>
                <p className="text-xs text-muted-foreground">Currently active</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Data */}
      <Tabs defaultValue="charts" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="charts" data-testid="tab-charts">
            <BarChart3 className="w-4 h-4 mr-2" />
            Charts
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <FileText className="w-4 h-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="charts" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Location Breakdown Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Attendance by Location</CardTitle>
                <CardDescription>Distribution of attendees across locations</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={locationChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {locationChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Attendance Trend Line Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Attendance Trend</CardTitle>
                <CardDescription>Recent session attendance numbers</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={attendanceTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="attendees" 
                      stroke="#8884d8" 
                      activeDot={{ r: 8 }}
                      name="Attendees"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Location Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Attendance Overview</CardTitle>
              <CardDescription>Attendance counts by location</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={locationChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8884d8" name="Attendees">
                    {locationChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Session History</CardTitle>
              <CardDescription>Complete history of all attendance sessions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Session Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="text-center">Attendees</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessionsLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center">
                          Loading sessions...
                        </TableCell>
                      </TableRow>
                    ) : filteredSessions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center">
                          No sessions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSessions.map((session: AttendanceSession) => (
                        <TableRow key={session.id} data-testid={`row-session-${session.id}`}>
                          <TableCell className="font-medium">
                            {session.name}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {session.location}
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(new Date(session.startsAt), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>
                            {format(new Date(session.startsAt), 'h:mm a')}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">
                              {session.checkIns?.length || 0}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={session.status === 'ACTIVE' ? 'default' : 'secondary'}>
                              {session.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                const response = await fetch(
                                  `/api/attendance/sessions/${session.id}/export.csv`,
                                  {
                                    headers: {
                                      Authorization: `Bearer ${localStorage.getItem('token')}`,
                                    },
                                  }
                                );
                                if (response.ok) {
                                  const blob = await response.blob();
                                  const url = window.URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `${session.name}_${format(new Date(session.startsAt), 'yyyy-MM-dd')}.csv`;
                                  document.body.appendChild(a);
                                  a.click();
                                  window.URL.revokeObjectURL(url);
                                  document.body.removeChild(a);
                                }
                              }}
                              data-testid={`button-export-${session.id}`}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}