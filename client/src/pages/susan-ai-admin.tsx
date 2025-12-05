/**
 * Susan AI Admin - Advanced AI Control Center
 * Combines Susan AI with Admin Control Hub and Analytics
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
  Loader2, ArrowUp, ArrowDown, Terminal
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

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

function SusanAIAdminContent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeTab, setActiveTab] = useState('command-center');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [analyticsTimeframe, setAnalyticsTimeframe] = useState('month');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

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

  // Chat with Susan (Admin Mode)
  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest('/api/susan/chat', {
        method: 'POST',
        body: JSON.stringify({ 
          message,
          mode: 'admin',
          context: {
            agents: agents.map(a => ({ id: a.id, name: a.agentName, isActive: a.isActive })),
            analytics: analytics ? {
              activeEmployees: analytics.activeEmployees,
              pendingPTO: analytics.pendingPTO
            } : null
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
      
      // Refetch agents if any agent-related action was performed
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
        description: `Agent ${agentId} has been triggered successfully`
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

  // Voice control placeholder
  const toggleListening = () => {
    setIsListening(!isListening);
    toast({
      title: isListening ? "Voice Control Stopped" : "Voice Control Active",
      description: isListening ? "Microphone deactivated" : "Listening for commands..."
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
        content: `🎯 Admin Control Center Active\n\nWelcome ${user?.firstName || 'Administrator'}! I'm Susan in Admin Mode with full control over:\n• HR Automation Agents\n• Analytics & Reporting\n• System Configuration\n• Real-time Monitoring\n\nUse natural language or commands to control the system.`,
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
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                <BrainCircuit className="w-7 h-7 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                Susan AI Admin Control
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Advanced AI Command Center & Analytics Hub
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="gap-1">
              <Shield className="w-3 h-3" />
              Admin Mode
            </Badge>
            <Badge variant={agentsLoading ? "secondary" : "default"} className="gap-1">
              <Activity className={cn("w-3 h-3", !agentsLoading && "animate-pulse")} />
              {agents.filter(a => a.isActive).length}/{agents.length} Active
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-6 mt-4 grid w-fit grid-cols-4">
          <TabsTrigger value="command-center" className="gap-2">
            <Terminal className="w-4 h-4" />
            Command Center
          </TabsTrigger>
          <TabsTrigger value="agents" className="gap-2">
            <Zap className="w-4 h-4" />
            HR Agents
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart className="w-4 h-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="system" className="gap-2">
            <Settings className="w-4 h-4" />
            System
          </TabsTrigger>
        </TabsList>

        {/* Command Center Tab */}
        <TabsContent value="command-center" className="flex-1 flex flex-col p-6">
          <div className="flex-1 grid grid-cols-3 gap-6">
            {/* Chat Interface */}
            <div className="col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg flex flex-col">
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
                            message.role === 'system' ? "bg-blue-500" : "bg-orange-500"
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
                            ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
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
                            {user?.firstName?.[0] || 'A'}
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
                        <AvatarFallback className="bg-orange-500 text-white">
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
                    placeholder="Enter admin command or question..."
                    className="flex-1 min-h-[60px] resize-none"
                    disabled={isTyping}
                  />
                  <div className="flex flex-col gap-2">
                    <Button
                      size="icon"
                      onClick={toggleListening}
                      variant={isListening ? "default" : "outline"}
                      disabled={isTyping}
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
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">System Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">AI Engine</span>
                    <Badge variant="default" className="gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Operational
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Agents Active</span>
                    <span className="font-medium">{agents.filter(a => a.isActive).length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Response Time</span>
                    <span className="text-sm text-green-600">~1.2s</span>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Memory Usage</span>
                      <span>42%</span>
                    </div>
                    <Progress value={42} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              {/* Quick Commands */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Quick Commands</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      setInput("Run all active HR agents now");
                      handleSend();
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
                      handleSend();
                    }}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Generate Report
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      setInput("Show agent performance metrics");
                      handleSend();
                    }}
                  >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Performance Metrics
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      setInput("Check system health");
                      handleSend();
                    }}
                  >
                    <Activity className="w-4 h-4 mr-2" />
                    System Health
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* HR Agents Tab */}
        <TabsContent value="agents" className="flex-1 p-6">
          <div className="grid grid-cols-3 gap-6 h-full">
            {/* Agents List */}
            <div className="col-span-2 space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">HR Automation Agents</h3>
                <div className="space-y-3">
                  {agents.map((agent) => (
                    <Card 
                      key={agent.id}
                      className={cn(
                        "cursor-pointer transition-all",
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
                <p className="text-sm text-gray-500">Select an agent to view logs</p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="flex-1 p-6">
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
                      <p className="text-xs text-green-600">+12% from last month</p>
                    </div>
                    <Users className="w-8 h-8 text-gray-400" />
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
                    <Calendar className="w-8 h-8 text-gray-400" />
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
                    <FileText className="w-8 h-8 text-gray-400" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Turnover Rate</p>
                      <p className="text-2xl font-bold">{analytics?.turnoverRate || 0}%</p>
                      <p className="text-xs text-red-600">-2% from last quarter</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-gray-400" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Analytics */}
            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Department Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] flex items-center justify-center">
                    <PieChart className="w-16 h-16 text-gray-400" />
                    <p className="ml-4 text-gray-500">Chart visualization here</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Recruitment Pipeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] flex items-center justify-center">
                    <BarChart className="w-16 h-16 text-gray-400" />
                    <p className="ml-4 text-gray-500">Pipeline visualization here</p>
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
              <Button>
                <Download className="w-4 h-4 mr-2" />
                Export Report
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* System Settings Tab */}
        <TabsContent value="system" className="flex-1 p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Susan AI Configuration</CardTitle>
                <CardDescription>
                  Configure Susan's behavior, integrations, and advanced settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Advanced AI Mode</Label>
                      <p className="text-sm text-gray-600">Enable advanced reasoning and complex task execution</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-Execute Agent Commands</Label>
                      <p className="text-sm text-gray-600">Automatically execute agent commands without confirmation</p>
                    </div>
                    <Switch />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Real-time Analytics</Label>
                      <p className="text-sm text-gray-600">Stream real-time data to Susan for instant insights</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Multi-Agent Coordination</Label>
                      <p className="text-sm text-gray-600">Allow Susan to coordinate multiple agents simultaneously</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>

                <div className="pt-4">
                  <h4 className="font-medium mb-3">API Integration Status</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Database className="w-5 h-5" />
                        <span>OpenAI GPT-4o</span>
                      </div>
                      <Badge variant="default">Connected</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex items-center gap-3">
                        <MessageSquare className="w-5 h-5" />
                        <span>Email Service</span>
                      </div>
                      <Badge variant="default">Active</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5" />
                        <span>Security Module</span>
                      </div>
                      <Badge variant="default">Enabled</Badge>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button 
                    variant="outline"
                    onClick={() => {
                      toast({
                        title: 'Configuration Reset',
                        description: 'Settings have been reset to default values',
                      });
                    }}
                  >
                    Reset to Defaults
                  </Button>
                  <Button 
                    onClick={() => {
                      toast({
                        title: 'Configuration Saved',
                        description: 'All settings have been saved successfully',
                      });
                    }}
                  >
                    Save Configuration
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SusanAIAdmin() {
  return (
    <ProtectedRoute requiredRole="ADMIN">
      <SusanAIAdminContent />
    </ProtectedRoute>
  );
}