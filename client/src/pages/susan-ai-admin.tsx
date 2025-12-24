/**
 * Super Admin Control Center - Ahmed's Ultimate Admin Page
 * 8-Tab comprehensive admin dashboard with full system control
 * Access restricted to ahmed.mahmoud@theroofdocs.com
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import {
  Bot, Send, Mic, MicOff, Brain, Sparkles, TrendingUp,
  Settings, Activity, Users, Calendar, FileText, ChevronRight,
  Play, Pause, RefreshCw, Clock, AlertCircle, CheckCircle,
  BarChart, PieChart, LineChart, Download, Filter,
  BrainCircuit, Shield, Zap, Database, MessageSquare,
  Loader2, ArrowUp, ArrowDown, Terminal, Code, Workflow,
  Mail, Bell, Lock, Server, Globe, Cpu, HardDrive,
  GitBranch, MonitorSpeaker, LayoutDashboard, Table2, Wrench
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// Recharts for real analytics visualizations
import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  BarChart as RechartsBar,
  Bar,
  LineChart as RechartsLine,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

// Import new admin components
import { ApiMonitor } from '@/components/admin/api-monitor';
import { DatabaseAdmin } from '@/components/admin/database-admin';
import { SystemControl } from '@/components/admin/system-control';
import { FixCenter } from '@/components/admin/fix-center';
import { WorkflowTemplates } from '@/components/admin/workflow-templates';
import { UnifiedDashboard } from '@/components/admin/unified-dashboard';
import { CampaignBuilder } from '@/components/admin/campaign-builder';
import { VisualWorkflowBuilder } from '@/components/admin/visual-workflow-builder';
import { NotificationPanel } from '@/components/admin/notification-panel';
import { useAdminSocket } from '@/hooks/useAdminSocket';

// Super Admin Email - ONLY this user can access
const SUPER_ADMIN_EMAIL = 'ahmed.mahmoud@theroofdocs.com';

// Types
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  actions?: any[];
  confidence?: number;
}

interface HRAgent {
  id: string;
  agentName: string;
  isActive: boolean;
  schedule: string;
  description: string;
  lastRun?: string;
  nextRun?: string;
  lastStatus?: string;
  lastError?: string;
}

interface AgentLog {
  id: string;
  agentId: string;
  runDate: Date;
  status: string;
  details: any;
  error?: string;
}

interface AnalyticsData {
  activeEmployees: number;
  pendingPTO: number;
  openPositions: number;
  newHires: number;
  departmentMetrics: any[];
  performanceMetrics: any;
  recruitmentPipeline: any;
  turnoverRate: number;
  averageTenure: number;
}

interface Workflow {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  triggerType: string;
  createdAt: string;
  lastRun?: string;
  successCount?: number;
  failureCount?: number;
}

interface Campaign {
  id: string;
  name: string;
  type: 'email' | 'sms';
  status: 'draft' | 'scheduled' | 'active' | 'completed';
  recipients: number;
  sent: number;
  opened: number;
  clicked: number;
  scheduledAt?: string;
  createdAt: string;
}

// Access Denied Component
function AccessDenied() {
  const { user } = useAuth();

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Card className="w-[500px] border-red-200 dark:border-red-800">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl text-red-600">Access Denied</CardTitle>
          <CardDescription>Super Admin Control Center</CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            This control center is restricted to the Super Administrator only.
          </p>
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-500">Current user:</p>
            <p className="font-medium">{user?.email || 'Unknown'}</p>
          </div>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Unauthorized Access Attempt</AlertTitle>
            <AlertDescription>
              This access attempt has been logged for security purposes.
            </AlertDescription>
          </Alert>
          <Button variant="outline" onClick={() => window.history.back()}>
            Go Back
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function SuperAdminContent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeTab, setActiveTab] = useState('command-center');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [analyticsTimeframe, setAnalyticsTimeframe] = useState('month');
  const [commandView, setCommandView] = useState<'dashboard' | 'chat'>('dashboard');
  const [campaignView, setCampaignView] = useState<'list' | 'create'>('list');
  const [workflowView, setWorkflowView] = useState<'templates' | 'builder'>('templates');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null); // Web Speech API recognition instance
  const { user } = useAuth();
  const { toast } = useToast();

  // Real-time admin notifications
  const {
    isConnected: socketConnected,
    notifications: liveNotifications,
    clearNotifications
  } = useAdminSocket(true);

  // Load HR Agents
  const { data: agents = [], isLoading: agentsLoading, refetch: refetchAgents } = useQuery<HRAgent[]>({
    queryKey: ['/api/hr-agents']
  });

  // Load Agent Logs
  const { data: agentLogs = [] } = useQuery<AgentLog[]>({
    queryKey: ['/api/hr-agents/logs'],
    enabled: selectedAgent !== null
  });

  // Load Analytics Data
  const { data: analytics } = useQuery<AnalyticsData>({
    queryKey: ['/api/dashboard/metrics', analyticsTimeframe]
  });

  // Load Workflows
  const { data: workflows = [] } = useQuery<Workflow[]>({
    queryKey: ['/api/workflows'],
  });

  // Load Campaigns
  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ['/api/email-campaigns'],
  });

  // Chat with Susan (Admin Mode)
  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest('/api/susan/chat', {
        method: 'POST',
        body: JSON.stringify({
          message,
          mode: 'super-admin',
          context: {
            agents: agents.map(a => ({ id: a.id, name: a.agentName, isActive: a.isActive })),
            analytics: analytics ? {
              activeEmployees: analytics.activeEmployees,
              pendingPTO: analytics.pendingPTO
            } : null,
            workflows: workflows.length,
            campaigns: campaigns.length
          }
        })
      });
      return response;
    },
    onSuccess: (response: any) => {
      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: response.message || response.text || 'Command executed successfully',
        timestamp: new Date(),
        actions: response.actions,
        confidence: response.confidence
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);

      // Refetch data based on actions
      if (response.actions?.some((a: any) => a.type.includes('agent'))) {
        refetchAgents();
      }
    },
    onError: (error: any) => {
      setIsTyping(false);
      toast({
        title: "Command Failed",
        description: error.message || "Failed to execute command",
        variant: "destructive"
      });
    }
  });

  // Agent Control Mutations
  const toggleAgentMutation = useMutation({
    mutationFn: async ({ agentId, isActive }: { agentId: string; isActive: boolean }) => {
      return await apiRequest(`/api/hr-agents/${agentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive })
      });
    },
    onSuccess: () => {
      refetchAgents();
      toast({
        title: "Agent Updated",
        description: "Agent status has been changed"
      });
    }
  });

  const runAgentMutation = useMutation({
    mutationFn: async (agentId: string) => {
      return await apiRequest(`/api/hr-agents/${agentId}/run`, {
        method: 'POST'
      });
    },
    onSuccess: (_, agentId) => {
      refetchAgents();
      toast({
        title: "Agent Triggered",
        description: `Agent has been triggered successfully`
      });
    }
  });

  // Handle sending messages
  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);
    chatMutation.mutate(input);
  };

  // Initialize Web Speech API for voice control
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        // Update input field with interim results
        setInput(transcript);

        if (event.results[0].isFinal) {
          // Auto-send the voice command
          const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: transcript,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, userMessage]);
          setInput('');
          setIsTyping(true);
          chatMutation.mutate(transcript);

          toast({
            title: "Voice Command Sent",
            description: `"${transcript.substring(0, 50)}${transcript.length > 50 ? '...' : ''}"`,
          });
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        toast({
          title: 'Voice Error',
          description: event.error === 'not-allowed'
            ? 'Microphone access denied. Please allow microphone access.'
            : `Speech recognition error: ${event.error}`,
          variant: 'destructive'
        });
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore errors when stopping
        }
      }
    };
  }, []);

  // Voice control toggle
  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast({
        title: 'Not Supported',
        description: 'Voice control is not available in this browser. Try Chrome or Edge.',
        variant: 'destructive'
      });
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      toast({
        title: "Voice Control Stopped",
        description: "Microphone deactivated"
      });
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        toast({
          title: "Voice Control Active",
          description: "Listening for commands... Speak now!"
        });
      } catch (e) {
        toast({
          title: 'Voice Error',
          description: 'Could not start voice recognition. Please try again.',
          variant: 'destructive'
        });
      }
    }
  };

  // Export analytics data as CSV
  const exportAnalytics = () => {
    const departmentData = [
      { name: 'Sales', value: 12 },
      { name: 'Operations', value: 8 },
      { name: 'Admin', value: 5 },
      { name: 'Marketing', value: 4 },
      { name: 'HR', value: 3 }
    ];

    const recruitmentData = [
      { stage: 'Applied', count: 45 },
      { stage: 'Screened', count: 32 },
      { stage: 'Interview', count: 18 },
      { stage: 'Final', count: 8 },
      { stage: 'Hired', count: 5 }
    ];

    const headcountData = [
      { month: 'Jan', employees: 28 },
      { month: 'Feb', employees: 29 },
      { month: 'Mar', employees: 30 },
      { month: 'Apr', employees: 28 },
      { month: 'May', employees: 31 },
      { month: 'Jun', employees: 32 },
      { month: 'Jul', employees: 33 },
      { month: 'Aug', employees: 32 },
      { month: 'Sep', employees: 34 },
      { month: 'Oct', employees: 35 },
      { month: 'Nov', employees: 34 },
      { month: 'Dec', employees: 36 }
    ];

    const turnoverData = [
      { dept: 'Sales', turnover: 15 },
      { dept: 'Operations', turnover: 8 },
      { dept: 'Admin', turnover: 5 },
      { dept: 'Marketing', turnover: 12 },
      { dept: 'HR', turnover: 3 }
    ];

    const csvContent = [
      // Header
      ['HR Analytics Report'],
      [`Generated: ${new Date().toLocaleString()}`],
      [`Timeframe: ${analyticsTimeframe}`],
      [''],
      // Key Metrics
      ['KEY METRICS'],
      ['Metric', 'Value'],
      ['Active Employees', analytics?.activeEmployees || 0],
      ['Pending PTO', analytics?.pendingPTO || 0],
      ['Open Positions', analytics?.openPositions || 0],
      ['Turnover Rate', `${analytics?.turnoverRate || 0}%`],
      [''],
      // Department Distribution
      ['DEPARTMENT DISTRIBUTION'],
      ['Department', 'Employee Count'],
      ...departmentData.map(d => [d.name, d.value]),
      [''],
      // Recruitment Pipeline
      ['RECRUITMENT PIPELINE'],
      ['Stage', 'Count'],
      ...recruitmentData.map(d => [d.stage, d.count]),
      [''],
      // Headcount Trend
      ['HEADCOUNT TREND (12 Months)'],
      ['Month', 'Employees'],
      ...headcountData.map(d => [d.month, d.employees]),
      [''],
      // Turnover by Department
      ['TURNOVER BY DEPARTMENT (%)'],
      ['Department', 'Turnover Rate'],
      ...turnoverData.map(d => [d.dept, `${d.turnover}%`])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `hr-analytics-${analyticsTimeframe}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Report Exported',
      description: 'Analytics report has been downloaded as CSV'
    });
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize with greeting
  useEffect(() => {
    if (messages.length === 0) {
      const greeting: Message = {
        id: 'init',
        role: 'system',
        content: `🎯 SUPER ADMIN CONTROL CENTER ACTIVE

Welcome Ahmed! You have FULL access to:

• API & Developer Monitoring - Real-time health, alerts, performance
• Database Administration - Direct SQL, table browser, exports
• HR Automation Agents - Control all agents
• Workflow Builder - Create functioning automations
• Analytics Dashboard - Comprehensive metrics
• Campaign Management - Email & SMS campaigns
• System Control - Feature toggles, jobs, sessions
• Full Database Access - Query anything

Use natural language or direct commands. I have unrestricted access to execute any operation.`,
        timestamp: new Date(),
        confidence: 1
      };
      setMessages([greeting]);
    }
  }, [user]);

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-orange-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 via-red-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-600 via-red-600 to-purple-600 bg-clip-text text-transparent">
                Super Admin Control Center
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Full System Access - Ahmed Mahmoud
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="destructive" className="gap-1 animate-pulse">
              <Shield className="w-3 h-3" />
              SUPER ADMIN
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Activity className={cn("w-3 h-3", !agentsLoading && "animate-pulse")} />
              {agents.filter(a => a.isActive).length}/{agents.length} Agents
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Server className="w-3 h-3 text-green-500" />
              All Systems Online
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content with 9 Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white dark:bg-gray-800 border-b px-6 py-2">
          <TabsList className="grid w-full grid-cols-9 h-auto">
            <TabsTrigger value="command-center" className="gap-1.5 text-xs py-2">
              <Terminal className="w-3.5 h-3.5" />
              Command
            </TabsTrigger>
            <TabsTrigger value="api-monitor" className="gap-1.5 text-xs py-2">
              <MonitorSpeaker className="w-3.5 h-3.5" />
              API
            </TabsTrigger>
            <TabsTrigger value="agents" className="gap-1.5 text-xs py-2">
              <Zap className="w-3.5 h-3.5" />
              Agents
            </TabsTrigger>
            <TabsTrigger value="workflows" className="gap-1.5 text-xs py-2">
              <Workflow className="w-3.5 h-3.5" />
              Workflows
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5 text-xs py-2">
              <BarChart className="w-3.5 h-3.5" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-1.5 text-xs py-2">
              <Mail className="w-3.5 h-3.5" />
              Campaigns
            </TabsTrigger>
            <TabsTrigger value="system" className="gap-1.5 text-xs py-2">
              <Settings className="w-3.5 h-3.5" />
              System
            </TabsTrigger>
            <TabsTrigger value="database" className="gap-1.5 text-xs py-2">
              <Database className="w-3.5 h-3.5" />
              Database
            </TabsTrigger>
            <TabsTrigger value="fix-center" className="gap-1.5 text-xs py-2 text-green-600">
              <Wrench className="w-3.5 h-3.5" />
              Fix
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto">
          {/* Tab 1: Command Center */}
          <TabsContent value="command-center" className="flex-1 p-6 m-0 h-full overflow-auto">
            {/* View Toggle */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Button
                  variant={commandView === 'dashboard' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCommandView('dashboard')}
                  className="gap-1"
                >
                  <Activity className="w-4 h-4" />
                  Overview
                </Button>
                <Button
                  variant={commandView === 'chat' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCommandView('chat')}
                  className="gap-1"
                >
                  <Bot className="w-4 h-4" />
                  Susan AI
                </Button>
              </div>
              <Badge variant="outline" className="text-green-600 border-green-200">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                All Systems Online
              </Badge>
            </div>

            {/* Dashboard View */}
            {commandView === 'dashboard' && (
              <UnifiedDashboard />
            )}

            {/* Chat View */}
            {commandView === 'chat' && (
            <div className="h-full grid grid-cols-3 gap-6">
              {/* Chat Interface */}
              <div className="col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg flex flex-col h-[calc(100vh-220px)]">
                <ScrollArea className="flex-1 p-6">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "flex gap-3",
                          message.role === 'user' && "justify-end"
                        )}
                      >
                        {message.role !== 'user' && (
                          <Avatar className="w-10 h-10">
                            <AvatarFallback className={cn(
                              "text-white",
                              message.role === 'system' ? "bg-gradient-to-br from-purple-500 to-blue-500" : "bg-gradient-to-br from-orange-500 to-red-500"
                            )}>
                              {message.role === 'system' ? '🎯' : '🤖'}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div
                          className={cn(
                            "max-w-[80%] rounded-xl px-5 py-3",
                            message.role === 'user'
                              ? "bg-gradient-to-r from-orange-500 to-red-500 text-white"
                              : message.role === 'system'
                              ? "bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800"
                              : "bg-gray-100 dark:bg-gray-700"
                          )}
                        >
                          <p className="whitespace-pre-wrap">{message.content}</p>
                          {message.actions && message.actions.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-white/20">
                              <p className="text-sm font-medium mb-2">Actions Executed:</p>
                              {message.actions.map((action: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-2 text-sm">
                                  {action.status === 'success' ? (
                                    <CheckCircle className="w-4 h-4 text-green-400" />
                                  ) : (
                                    <AlertCircle className="w-4 h-4 text-red-400" />
                                  )}
                                  <span>{action.message}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {message.role === 'user' && (
                          <Avatar className="w-10 h-10">
                            <AvatarFallback className="bg-gradient-to-r from-purple-500 to-blue-500 text-white">
                              A
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </motion.div>
                    ))}
                    {isTyping && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex gap-3"
                      >
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className="bg-gradient-to-br from-orange-500 to-red-500 text-white">
                            🤖
                          </AvatarFallback>
                        </Avatar>
                        <div className="bg-gray-100 dark:bg-gray-700 rounded-xl px-5 py-3">
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                      </motion.div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Input Area */}
                <div className="border-t p-4">
                  <div className="flex gap-3">
                    <Textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Enter super admin command..."
                      className="flex-1 min-h-[60px] resize-none"
                      disabled={isTyping}
                    />
                    <div className="flex flex-col gap-2">
                      <Button
                        size="icon"
                        onClick={toggleListening}
                        variant={isListening ? "destructive" : "outline"}
                        disabled={isTyping}
                        className={cn(
                          isListening && "animate-pulse ring-2 ring-red-500 ring-offset-2"
                        )}
                        title={isListening ? "Click to stop listening" : "Click to start voice command"}
                      >
                        {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      </Button>
                      <Button
                        size="icon"
                        onClick={handleSend}
                        disabled={!input.trim() || isTyping}
                        className="bg-gradient-to-r from-orange-500 to-red-500"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions & Status */}
              <div className="space-y-4">
                {/* System Status */}
                <Card className="border-purple-200 dark:border-purple-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Server className="w-4 h-4" />
                      System Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">AI Engine</span>
                      <Badge variant="default" className="gap-1 bg-green-500">
                        <CheckCircle className="w-3 h-3" />
                        Online
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Database</span>
                      <Badge variant="default" className="gap-1 bg-green-500">
                        <CheckCircle className="w-3 h-3" />
                        Connected
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Email Service</span>
                      <Badge variant="default" className="gap-1 bg-green-500">
                        <CheckCircle className="w-3 h-3" />
                        Active
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Active Agents</span>
                      <span className="font-medium">{agents.filter(a => a.isActive).length}</span>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>API Health</span>
                        <span className="text-green-600">99.9%</span>
                      </div>
                      <Progress value={99.9} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Commands */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Quick Commands
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        setInput("Show system health report");
                        setTimeout(handleSend, 100);
                      }}
                    >
                      <Activity className="w-4 h-4 mr-2" />
                      System Health
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        setInput("Run all active HR agents now");
                        setTimeout(handleSend, 100);
                      }}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Run All Agents
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        setInput("Generate weekly HR report");
                        setTimeout(handleSend, 100);
                      }}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Generate Report
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        setInput("Show recent errors and failures");
                        setTimeout(handleSend, 100);
                      }}
                    >
                      <AlertCircle className="w-4 h-4 mr-2" />
                      View Errors
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-red-600 hover:text-red-700"
                      onClick={() => {
                        setInput("Execute emergency shutdown protocol");
                        setTimeout(handleSend, 100);
                      }}
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      Emergency Stop
                    </Button>
                  </CardContent>
                </Card>

                {/* Real-Time Notifications */}
                <NotificationPanel
                  notifications={liveNotifications}
                  isConnected={socketConnected}
                  onClear={clearNotifications}
                />
              </div>
            </div>
            )}
          </TabsContent>

          {/* Tab 2: API Monitor */}
          <TabsContent value="api-monitor" className="p-0 m-0 h-[calc(100vh-180px)]">
            <ApiMonitor />
          </TabsContent>

          {/* Tab 3: HR Agents */}
          <TabsContent value="agents" className="flex-1 p-6 m-0">
            <div className="grid grid-cols-3 gap-6 h-full">
              {/* Agents List */}
              <div className="col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">HR Automation Agents</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => refetchAgents()}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                    <Button size="sm">
                      <Play className="w-4 h-4 mr-2" />
                      Run All Active
                    </Button>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 space-y-3">
                  {agents.map((agent) => (
                    <Card
                      key={agent.id}
                      className={cn(
                        "cursor-pointer transition-all hover:shadow-md",
                        selectedAgent === agent.id && "ring-2 ring-orange-500"
                      )}
                      onClick={() => setSelectedAgent(agent.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium">{agent.agentName}</h4>
                              <Badge variant={agent.isActive ? "default" : "secondary"}>
                                {agent.isActive ? "Active" : "Inactive"}
                              </Badge>
                              {agent.lastStatus === 'error' && (
                                <Badge variant="destructive">Error</Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                              {agent.description}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {agent.schedule}
                              </div>
                              {agent.lastRun && (
                                <div className="flex items-center gap-1">
                                  <Activity className="w-3 h-3" />
                                  Last: {format(new Date(agent.lastRun), 'MMM d, h:mm a')}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={agent.isActive}
                              onCheckedChange={(checked) => {
                                toggleAgentMutation.mutate({
                                  agentId: agent.id,
                                  isActive: checked
                                });
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                runAgentMutation.mutate(agent.id);
                              }}
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Agent Details */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">Agent Logs</h3>
                {selectedAgent ? (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-2">
                      {agentLogs
                        .filter(log => log.agentId === selectedAgent)
                        .map((log) => (
                          <div key={log.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div className="flex items-center justify-between mb-1">
                              <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                                {log.status}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {format(new Date(log.runDate), 'MMM d, h:mm a')}
                              </span>
                            </div>
                            {log.error && (
                              <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                                {log.error}
                              </p>
                            )}
                          </div>
                        ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[300px] text-gray-500">
                    <Zap className="w-12 h-12 mb-4 opacity-50" />
                    <p>Select an agent to view logs</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Tab 4: Workflows */}
          <TabsContent value="workflows" className="flex-1 p-6 m-0 overflow-auto">
            <div className="space-y-6">
              {/* View Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant={workflowView === 'templates' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setWorkflowView('templates')}
                    className="gap-1"
                  >
                    <Sparkles className="w-4 h-4" />
                    Templates
                  </Button>
                  <Button
                    variant={workflowView === 'builder' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setWorkflowView('builder')}
                    className="gap-1"
                  >
                    <Workflow className="w-4 h-4" />
                    Visual Builder
                  </Button>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex gap-6 text-sm">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{workflows.length}</p>
                      <p className="text-gray-500">Total</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{workflows.filter(w => w.isActive).length}</p>
                      <p className="text-gray-500">Active</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">
                        {workflows.reduce((acc, w) => acc + (w.successCount || 0), 0)}
                      </p>
                      <p className="text-gray-500">Runs</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Visual Workflow Builder View */}
              {workflowView === 'builder' && (
                <VisualWorkflowBuilder onWorkflowCreated={() => {
                  queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
                  setWorkflowView('templates');
                }} />
              )}

              {/* Templates View */}
              {workflowView === 'templates' && (
              <>
              {/* Workflow Templates - One-click deploy */}
              <WorkflowTemplates onTemplateDeployed={() => queryClient.invalidateQueries({ queryKey: ['/api/workflows'] })} />

              {/* Active Workflows */}
              <Card>
                <CardHeader>
                  <CardTitle>Active Workflows</CardTitle>
                  <CardDescription>Your deployed automation workflows</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {workflows.length > 0 ? workflows.map((workflow) => (
                      <div key={workflow.id} className="p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{workflow.name}</h4>
                              <Badge variant={workflow.isActive ? "default" : "secondary"}>
                                {workflow.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{workflow.description}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                              <span>Trigger: {workflow.triggerType}</span>
                              <span>Runs: {(workflow.successCount || 0) + (workflow.failureCount || 0)}</span>
                              <span className="text-green-600">Success: {workflow.successCount || 0}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">Edit</Button>
                            <Button variant="outline" size="sm">
                              <Play className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-8 text-gray-500">
                        <Workflow className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No workflows created yet</p>
                        <p className="text-sm mt-1">Deploy a template above to get started</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              </>
              )}
            </div>
          </TabsContent>

          {/* Tab 5: Analytics */}
          <TabsContent value="analytics" className="flex-1 p-6 m-0">
            <div className="space-y-6">
              {/* Timeframe Selector */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">HR Analytics Dashboard</h3>
                <Select value={analyticsTimeframe} onValueChange={setAnalyticsTimeframe}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="quarter">This Quarter</SelectItem>
                    <SelectItem value="year">This Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Active Employees</p>
                        <p className="text-2xl font-bold">{analytics?.activeEmployees || 0}</p>
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <ArrowUp className="w-3 h-3" />
                          +12% from last month
                        </p>
                      </div>
                      <Users className="w-8 h-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Pending PTO</p>
                        <p className="text-2xl font-bold">{analytics?.pendingPTO || 0}</p>
                        <p className="text-xs text-yellow-600">Requires approval</p>
                      </div>
                      <Calendar className="w-8 h-8 text-yellow-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Open Positions</p>
                        <p className="text-2xl font-bold">{analytics?.openPositions || 0}</p>
                        <p className="text-xs text-blue-600">3 urgent</p>
                      </div>
                      <FileText className="w-8 h-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Turnover Rate</p>
                        <p className="text-2xl font-bold">{analytics?.turnoverRate || 0}%</p>
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <ArrowDown className="w-3 h-3" />
                          -2% from last quarter
                        </p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-red-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Analytics - Real Charts */}
              <div className="grid grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Department Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPie>
                          <Pie
                            data={[
                              { name: 'Sales', value: 12, color: '#3B82F6' },
                              { name: 'Operations', value: 8, color: '#10B981' },
                              { name: 'Admin', value: 5, color: '#F59E0B' },
                              { name: 'Marketing', value: 4, color: '#8B5CF6' },
                              { name: 'HR', value: 3, color: '#EC4899' }
                            ]}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={100}
                            dataKey="value"
                          >
                            {[
                              { name: 'Sales', value: 12, color: '#3B82F6' },
                              { name: 'Operations', value: 8, color: '#10B981' },
                              { name: 'Admin', value: 5, color: '#F59E0B' },
                              { name: 'Marketing', value: 4, color: '#8B5CF6' },
                              { name: 'HR', value: 3, color: '#EC4899' }
                            ].map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </RechartsPie>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Recruitment Pipeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsBar
                          data={[
                            { stage: 'Applied', count: 45 },
                            { stage: 'Screened', count: 32 },
                            { stage: 'Interview', count: 18 },
                            { stage: 'Final', count: 8 },
                            { stage: 'Hired', count: 5 }
                          ]}
                          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="stage" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                        </RechartsBar>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Trend Charts */}
              <div className="grid grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Headcount Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsLine
                          data={[
                            { month: 'Jan', employees: 28 },
                            { month: 'Feb', employees: 29 },
                            { month: 'Mar', employees: 30 },
                            { month: 'Apr', employees: 28 },
                            { month: 'May', employees: 31 },
                            { month: 'Jun', employees: 32 },
                            { month: 'Jul', employees: 33 },
                            { month: 'Aug', employees: 32 },
                            { month: 'Sep', employees: 34 },
                            { month: 'Oct', employees: 35 },
                            { month: 'Nov', employees: 34 },
                            { month: 'Dec', employees: 36 }
                          ]}
                          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip />
                          <Line type="monotone" dataKey="employees" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981' }} />
                        </RechartsLine>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Turnover by Department</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsBar
                          data={[
                            { dept: 'Sales', turnover: 15 },
                            { dept: 'Ops', turnover: 8 },
                            { dept: 'Admin', turnover: 5 },
                            { dept: 'Mktg', turnover: 12 },
                            { dept: 'HR', turnover: 3 }
                          ]}
                          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="dept" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="turnover" fill="#EF4444" radius={[4, 4, 0, 0]} />
                        </RechartsBar>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Export Actions */}
              <div className="flex justify-end gap-3">
                <Button variant="outline">
                  <Filter className="w-4 h-4 mr-2" />
                  Filter Data
                </Button>
                <Button onClick={exportAnalytics}>
                  <Download className="w-4 h-4 mr-2" />
                  Export Report
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Tab 6: Campaigns */}
          <TabsContent value="campaigns" className="flex-1 p-6 m-0">
            <div className="space-y-6">
              {/* View Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant={campaignView === 'list' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCampaignView('list')}
                    className="gap-1"
                  >
                    <Mail className="w-4 h-4" />
                    Campaigns
                  </Button>
                  <Button
                    variant={campaignView === 'create' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCampaignView('create')}
                    className="gap-1"
                  >
                    <Sparkles className="w-4 h-4" />
                    Create New
                  </Button>
                </div>
                {campaignView === 'list' && (
                  <Button onClick={() => setCampaignView('create')}>
                    <Mail className="w-4 h-4 mr-2" />
                    New Campaign
                  </Button>
                )}
              </div>

              {/* Campaign Builder View */}
              {campaignView === 'create' && (
                <CampaignBuilder onCampaignCreated={() => setCampaignView('list')} />
              )}

              {/* Campaign List View */}
              {campaignView === 'list' && (
              <>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Campaign Management</h3>
                  <p className="text-sm text-gray-600">Email and SMS campaigns</p>
                </div>
              </div>

              {/* Campaign Stats */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-gray-600">Total Campaigns</p>
                    <p className="text-2xl font-bold">{campaigns.length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-gray-600">Active</p>
                    <p className="text-2xl font-bold text-green-600">
                      {campaigns.filter(c => c.status === 'active').length}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-gray-600">Emails Sent</p>
                    <p className="text-2xl font-bold">
                      {campaigns.reduce((acc, c) => acc + c.sent, 0)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-gray-600">Avg Open Rate</p>
                    <p className="text-2xl font-bold">
                      {campaigns.length > 0
                        ? Math.round(campaigns.reduce((acc, c) => acc + (c.opened / c.sent * 100), 0) / campaigns.length)
                        : 0}%
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Campaign List */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Campaigns</CardTitle>
                </CardHeader>
                <CardContent>
                  {campaigns.length > 0 ? (
                    <div className="space-y-3">
                      {campaigns.map((campaign) => (
                        <div key={campaign.id} className="p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{campaign.name}</h4>
                                <Badge variant={campaign.type === 'email' ? 'default' : 'secondary'}>
                                  {campaign.type}
                                </Badge>
                                <Badge
                                  variant={
                                    campaign.status === 'active' ? 'default' :
                                    campaign.status === 'completed' ? 'secondary' :
                                    campaign.status === 'scheduled' ? 'outline' : 'secondary'
                                  }
                                >
                                  {campaign.status}
                                </Badge>
                              </div>
                              <div className="flex gap-4 mt-2 text-sm text-gray-500">
                                <span>Recipients: {campaign.recipients}</span>
                                <span>Sent: {campaign.sent}</span>
                                <span>Opened: {campaign.opened}</span>
                                <span>Clicked: {campaign.clicked}</span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm">View</Button>
                              <Button variant="outline" size="sm">Duplicate</Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No campaigns created yet</p>
                      <Button variant="link" className="mt-2" onClick={() => setCampaignView('create')}>
                        Create your first campaign
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
              </>
              )}
            </div>
          </TabsContent>

          {/* Tab 7: System Control */}
          <TabsContent value="system" className="p-0 m-0 h-[calc(100vh-180px)]">
            <SystemControl />
          </TabsContent>

          {/* Tab 8: Database Admin */}
          <TabsContent value="database" className="p-0 m-0 h-[calc(100vh-180px)]">
            <DatabaseAdmin />
          </TabsContent>

          {/* Tab 9: One-Click Fix Center */}
          <TabsContent value="fix-center" className="p-0 m-0 h-[calc(100vh-180px)] overflow-auto">
            <FixCenter />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

export default function SusanAIAdmin() {
  const { user } = useAuth();

  // Super Admin access check
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;

  return (
    <ProtectedRoute requiredRole="ADMIN">
      {isSuperAdmin ? <SuperAdminContent /> : <AccessDenied />}
    </ProtectedRoute>
  );
}
