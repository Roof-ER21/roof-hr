import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, RadarChart, 
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import {
  TrendingUp, TrendingDown, Clock, DollarSign, Users, Target,
  ArrowLeft, Calendar, Activity, Briefcase, Award, AlertTriangle,
  RefreshCw, Download, Filter, ChevronUp, ChevronDown
} from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

interface AnalyticsMetrics {
  pipelineConversion: {
    applied: number;
    screening: number;
    interview: number;
    offer: number;
    hired: number;
    conversionRates: {
      appliedToScreening: number;
      screeningToInterview: number;
      interviewToOffer: number;
      offerToHired: number;
      overallConversion: number;
    };
  };
  timeToHire: {
    average: number;
    median: number;
    byStage: {
      applied_to_screening: number;
      screening_to_interview: number;
      interview_to_offer: number;
      offer_to_hired: number;
    };
    trend: Array<{ month: string; days: number }>;
  };
  costPerHire: {
    total: number;
    breakdown: {
      advertising: number;
      recruiterTime: number;
      interviewTime: number;
      tools: number;
      other: number;
    };
    bySource: Array<{ source: string; cost: number; hires: number; costPerHire: number }>;
  };
  sourceEffectiveness: Array<{
    source: string;
    applications: number;
    hires: number;
    conversionRate: number;
    avgTimeToHire: number;
    quality: number;
  }>;
  predictiveTurnover: {
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
    predictedTurnoverRate: number;
    factors: Array<{ factor: string; impact: number }>;
  };
  diversity: {
    gender: Array<{ category: string; count: number; percentage: number }>;
    ethnicity: Array<{ category: string; count: number; percentage: number }>;
    ageGroups: Array<{ range: string; count: number }>;
  };
  performance: {
    newHirePerformance: Array<{ month: string; score: number }>;
    retentionRate: number;
    promotionRate: number;
    satisfaction: number;
  };
}

export default function EnterpriseAnalytics() {
  const [timeRange, setTimeRange] = useState('last30days');
  const [department, setDepartment] = useState('all');
  const [isExporting, setIsExporting] = useState(false);

  // Fetch analytics data
  const { data: metrics, isLoading, refetch } = useQuery<AnalyticsMetrics>({
    queryKey: ['/api/analytics/metrics', timeRange, department],
    queryFn: async () => {
      // Mock data for demonstration
      return {
        pipelineConversion: {
          applied: 450,
          screening: 225,
          interview: 90,
          offer: 30,
          hired: 24,
          conversionRates: {
            appliedToScreening: 50,
            screeningToInterview: 40,
            interviewToOffer: 33,
            offerToHired: 80,
            overallConversion: 5.3,
          },
        },
        timeToHire: {
          average: 28,
          median: 25,
          byStage: {
            applied_to_screening: 3,
            screening_to_interview: 7,
            interview_to_offer: 10,
            offer_to_hired: 8,
          },
          trend: [
            { month: 'Jan', days: 32 },
            { month: 'Feb', days: 30 },
            { month: 'Mar', days: 28 },
            { month: 'Apr', days: 26 },
            { month: 'May', days: 27 },
            { month: 'Jun', days: 25 },
          ],
        },
        costPerHire: {
          total: 4500,
          breakdown: {
            advertising: 1200,
            recruiterTime: 1800,
            interviewTime: 900,
            tools: 400,
            other: 200,
          },
          bySource: [
            { source: 'Indeed', cost: 1500, hires: 8, costPerHire: 187.5 },
            { source: 'LinkedIn', cost: 2000, hires: 10, costPerHire: 200 },
            { source: 'Referrals', cost: 500, hires: 4, costPerHire: 125 },
            { source: 'Direct', cost: 500, hires: 2, costPerHire: 250 },
          ],
        },
        sourceEffectiveness: [
          { source: 'LinkedIn', applications: 120, hires: 10, conversionRate: 8.3, avgTimeToHire: 24, quality: 85 },
          { source: 'Indeed', applications: 200, hires: 8, conversionRate: 4.0, avgTimeToHire: 30, quality: 75 },
          { source: 'Referrals', applications: 50, hires: 4, conversionRate: 8.0, avgTimeToHire: 20, quality: 90 },
          { source: 'Direct', applications: 80, hires: 2, conversionRate: 2.5, avgTimeToHire: 35, quality: 70 },
        ],
        predictiveTurnover: {
          highRisk: 5,
          mediumRisk: 12,
          lowRisk: 91,
          predictedTurnoverRate: 15.7,
          factors: [
            { factor: 'Compensation Below Market', impact: 35 },
            { factor: 'Limited Growth Opportunities', impact: 25 },
            { factor: 'Work-Life Balance', impact: 20 },
            { factor: 'Manager Relationship', impact: 15 },
            { factor: 'Job Satisfaction', impact: 5 },
          ],
        },
        diversity: {
          gender: [
            { category: 'Male', count: 65, percentage: 60 },
            { category: 'Female', count: 40, percentage: 37 },
            { category: 'Non-binary', count: 3, percentage: 3 },
          ],
          ethnicity: [
            { category: 'White', count: 50, percentage: 46 },
            { category: 'Hispanic', count: 25, percentage: 23 },
            { category: 'Black', count: 15, percentage: 14 },
            { category: 'Asian', count: 12, percentage: 11 },
            { category: 'Other', count: 6, percentage: 6 },
          ],
          ageGroups: [
            { range: '18-25', count: 15 },
            { range: '26-35', count: 40 },
            { range: '36-45', count: 30 },
            { range: '46-55', count: 18 },
            { range: '56+', count: 5 },
          ],
        },
        performance: {
          newHirePerformance: [
            { month: '1', score: 65 },
            { month: '3', score: 75 },
            { month: '6', score: 82 },
            { month: '12', score: 88 },
          ],
          retentionRate: 85,
          promotionRate: 12,
          satisfaction: 78,
        },
      };
    },
  });

  const exportReport = async () => {
    setIsExporting(true);
    // Simulate export
    setTimeout(() => {
      setIsExporting(false);
      // In real implementation, trigger download
      console.log('Report exported');
    }, 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="mb-6">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Enterprise Analytics</h1>
        <p className="text-muted-foreground">
          Comprehensive recruitment analytics and predictive insights
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-6">
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="last7days">Last 7 Days</SelectItem>
            <SelectItem value="last30days">Last 30 Days</SelectItem>
            <SelectItem value="last90days">Last 90 Days</SelectItem>
            <SelectItem value="lastyear">Last Year</SelectItem>
          </SelectContent>
        </Select>

        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            <SelectItem value="field">Field Operations</SelectItem>
            <SelectItem value="sales">Sales</SelectItem>
            <SelectItem value="admin">Administration</SelectItem>
            <SelectItem value="management">Management</SelectItem>
          </SelectContent>
        </Select>

        <Button 
          variant="outline" 
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>

        <Button 
          onClick={exportReport}
          disabled={isExporting}
        >
          <Download className="h-4 w-4 mr-2" />
          {isExporting ? 'Exporting...' : 'Export Report'}
        </Button>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Avg. Time to Hire</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.timeToHire.average} days</div>
            <div className="flex items-center mt-2 text-sm">
              <TrendingDown className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-green-500">-12%</span>
              <span className="text-muted-foreground ml-1">vs last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Cost per Hire</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics?.costPerHire.total.toLocaleString()}</div>
            <div className="flex items-center mt-2 text-sm">
              <TrendingUp className="h-4 w-4 text-red-500 mr-1" />
              <span className="text-red-500">+5%</span>
              <span className="text-muted-foreground ml-1">vs last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pipeline Conversion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.pipelineConversion.conversionRates.overallConversion}%</div>
            <div className="flex items-center mt-2 text-sm">
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-green-500">+2.1%</span>
              <span className="text-muted-foreground ml-1">vs last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Retention Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.performance.retentionRate}%</div>
            <div className="flex items-center mt-2 text-sm">
              <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
              <span className="text-red-500">-3%</span>
              <span className="text-muted-foreground ml-1">vs last period</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="time">Time Metrics</TabsTrigger>
          <TabsTrigger value="cost">Cost Analysis</TabsTrigger>
          <TabsTrigger value="predictive">Predictive</TabsTrigger>
        </TabsList>

        {/* Pipeline Analytics */}
        <TabsContent value="pipeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recruitment Pipeline Conversion</CardTitle>
              <CardDescription>
                Track conversion rates through each stage of the recruitment process
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { stage: 'Applied', count: metrics?.pipelineConversion.applied, rate: 100 },
                      { stage: 'Screening', count: metrics?.pipelineConversion.screening, rate: metrics?.pipelineConversion.conversionRates.appliedToScreening },
                      { stage: 'Interview', count: metrics?.pipelineConversion.interview, rate: metrics?.pipelineConversion.conversionRates.screeningToInterview },
                      { stage: 'Offer', count: metrics?.pipelineConversion.offer, rate: metrics?.pipelineConversion.conversionRates.interviewToOffer },
                      { stage: 'Hired', count: metrics?.pipelineConversion.hired, rate: metrics?.pipelineConversion.conversionRates.offerToHired },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="stage" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="count" fill="#8884d8" name="Candidates" />
                    <Bar yAxisId="right" dataKey="rate" fill="#82ca9d" name="Conversion %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Applied → Screening</div>
                  <div className="text-xl font-bold">{metrics?.pipelineConversion.conversionRates.appliedToScreening}%</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Screening → Interview</div>
                  <div className="text-xl font-bold">{metrics?.pipelineConversion.conversionRates.screeningToInterview}%</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Interview → Offer</div>
                  <div className="text-xl font-bold">{metrics?.pipelineConversion.conversionRates.interviewToOffer}%</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Offer → Hired</div>
                  <div className="text-xl font-bold">{metrics?.pipelineConversion.conversionRates.offerToHired}%</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Source Effectiveness</CardTitle>
              <CardDescription>
                Performance metrics by recruitment source
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics?.sourceEffectiveness.map((source) => (
                  <div key={source.source} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-semibold">{source.source}</h4>
                        <p className="text-sm text-muted-foreground">
                          {source.applications} applications → {source.hires} hires
                        </p>
                      </div>
                      <Badge variant={source.quality >= 80 ? 'default' : 'secondary'}>
                        Quality: {source.quality}%
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Conversion:</span>
                        <span className="ml-2 font-medium">{source.conversionRate}%</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Avg. Time:</span>
                        <span className="ml-2 font-medium">{source.avgTimeToHire} days</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Quality Score:</span>
                        <span className="ml-2 font-medium">{source.quality}/100</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Time Metrics */}
        <TabsContent value="time" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Time to Hire Trend</CardTitle>
              <CardDescription>
                Average days to hire over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics?.timeToHire.trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="days" 
                      stroke="#8884d8" 
                      name="Days to Hire"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Time by Stage</CardTitle>
              <CardDescription>
                Average days spent in each recruitment stage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Applied → Screening</span>
                    <span className="text-sm font-bold">{metrics?.timeToHire.byStage.applied_to_screening} days</span>
                  </div>
                  <Progress value={30} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Screening → Interview</span>
                    <span className="text-sm font-bold">{metrics?.timeToHire.byStage.screening_to_interview} days</span>
                  </div>
                  <Progress value={50} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Interview → Offer</span>
                    <span className="text-sm font-bold">{metrics?.timeToHire.byStage.interview_to_offer} days</span>
                  </div>
                  <Progress value={70} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Offer → Hired</span>
                    <span className="text-sm font-bold">{metrics?.timeToHire.byStage.offer_to_hired} days</span>
                  </div>
                  <Progress value={60} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cost Analysis */}
        <TabsContent value="cost" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cost Breakdown</CardTitle>
              <CardDescription>
                Detailed breakdown of recruitment costs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Advertising', value: metrics?.costPerHire.breakdown.advertising },
                        { name: 'Recruiter Time', value: metrics?.costPerHire.breakdown.recruiterTime },
                        { name: 'Interview Time', value: metrics?.costPerHire.breakdown.interviewTime },
                        { name: 'Tools', value: metrics?.costPerHire.breakdown.tools },
                        { name: 'Other', value: metrics?.costPerHire.breakdown.other },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {COLORS.map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cost per Hire by Source</CardTitle>
              <CardDescription>
                Efficiency comparison across recruitment channels
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics?.costPerHire.bySource.map((source) => (
                  <div key={source.source} className="flex justify-between items-center p-3 border rounded">
                    <div>
                      <div className="font-medium">{source.source}</div>
                      <div className="text-sm text-muted-foreground">
                        {source.hires} hires from ${source.cost.toLocaleString()} investment
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold">${source.costPerHire.toFixed(0)}</div>
                      <div className="text-sm text-muted-foreground">per hire</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Predictive Analytics */}
        <TabsContent value="predictive" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Turnover Risk Analysis</CardTitle>
              <CardDescription>
                Predictive analysis of employee turnover risk
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded">
                  <div className="text-3xl font-bold text-red-600">{metrics?.predictiveTurnover.highRisk}</div>
                  <div className="text-sm text-muted-foreground">High Risk</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                  <div className="text-3xl font-bold text-yellow-600">{metrics?.predictiveTurnover.mediumRisk}</div>
                  <div className="text-sm text-muted-foreground">Medium Risk</div>
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded">
                  <div className="text-3xl font-bold text-green-600">{metrics?.predictiveTurnover.lowRisk}</div>
                  <div className="text-sm text-muted-foreground">Low Risk</div>
                </div>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Predicted turnover rate for next quarter: <strong>{metrics?.predictiveTurnover.predictedTurnoverRate}%</strong>
                </AlertDescription>
              </Alert>

              <div className="mt-6">
                <h4 className="font-semibold mb-3">Risk Factors</h4>
                <div className="space-y-3">
                  {metrics?.predictiveTurnover.factors.map((factor) => (
                    <div key={factor.factor}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">{factor.factor}</span>
                        <span className="text-sm font-bold">{factor.impact}%</span>
                      </div>
                      <Progress value={factor.impact} className="h-2" />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>New Hire Performance Trajectory</CardTitle>
              <CardDescription>
                Expected performance improvement over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics?.performance.newHirePerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" label={{ value: 'Months', position: 'insideBottom', offset: -5 }} />
                    <YAxis label={{ value: 'Performance Score', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="score" 
                      stroke="#8884d8" 
                      fill="#8884d8" 
                      fillOpacity={0.6}
                      name="Performance Score"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>


      </Tabs>
    </div>
  );
}