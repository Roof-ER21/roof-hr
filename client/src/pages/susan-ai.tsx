import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { ADMIN_ROLES, MANAGER_ROLES } from '@shared/constants/roles';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  Brain,
  MessageCircle,
  Send,
  Mic,
  MicOff,
  Loader2,
  CheckCircle,
  AlertCircle,
  Terminal,
  Zap,
  BarChart,
  Settings,
  Users,
  Calendar,
  FileText,
  TrendingUp,
  Activity,
  Clock,
  Play,
  Filter,
  Download,
  PieChart,
  Shield,
  AlertTriangle
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  confidence?: number;
  actions?: Array<{
    type: string;
    status: 'success' | 'error' | 'pending';
    message: string;
  }>;
}

interface Agent {
  id: string;
  agentName: string;
  isActive: boolean;
  schedule: string;
  description: string;
  lastRun?: string;
  nextRun?: string;
  lastStatus?: string;
  createdAt: string;
  updatedAt: string;
}

interface AgentLog {
  id: string;
  agentId: string;
  status: 'success' | 'error';
  runDate: string;
  error?: string;
}

interface Analytics {
  activeEmployees: number;
  pendingPTO: number;
  openPositions: number;
  turnoverRate: number;
}

interface PendingConfirmation {
  confirmationType: string;
  confirmationData: any;
  confirmationMessage: string;
}

export default function SusanAI() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeTab, setActiveTab] = useState('command-center');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [analyticsTimeframe, setAnalyticsTimeframe] = useState('month');
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Check if user is admin/manager for Admin Susan AI
  const isAdmin = ADMIN_ROLES.includes(user?.role || '') || MANAGER_ROLES.includes(user?.role || '');
  const isAdminSusan = isAdmin;
  
  // Check if user is super admin (Ahmed Mahmoud only)
  const isSuperAdmin = user?.email === 'ahmed.mahmoud@theroofdocs.com' || 
                       user?.email === 'ahmed.mahmoud21@gmail.com';

  // Fetch agents data
  const { data: agents = [], isLoading: agentsLoading, error: agentsError } = useQuery<Agent[]>({
    queryKey: ['/api/hr-agents'],
    enabled: isAdmin,
    queryFn: async () => {
      return await apiRequest<Agent[]>('/api/hr-agents', {
        method: 'GET'
      });
    }
  });

  // Fetch agent logs
  const { data: agentLogs = [] } = useQuery<AgentLog[]>({
    queryKey: ['/api/agents/logs'],
    enabled: isAdmin
  });

  // Fetch analytics with live data
  const { data: analytics } = useQuery<Analytics>({
    queryKey: ['/api/susan-ai/analytics', analyticsTimeframe],
    enabled: isAdmin,
    queryFn: async () => {
      return await apiRequest<Analytics>(`/api/susan-ai/analytics?timeframe=${analyticsTimeframe}`, {
        method: 'GET'
      });
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: async ({ message }: { message: string }) => {
      return await apiRequest<any>('/api/susan-ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message })
      });
    },
    onSuccess: (data) => {
      // Check if this requires user confirmation
      if (data.requiresConfirmation) {
        setPendingConfirmation({
          confirmationType: data.confirmationType,
          confirmationData: data.confirmationData,
          confirmationMessage: data.confirmationMessage || data.message
        });
        setConfirmationDialogOpen(true);
        // Also show the message in chat
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: data.message + '\n\n⚠️ Please confirm this action in the dialog.',
          timestamp: new Date(),
          confidence: data.confidence,
          actions: data.actions
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: data.message,
          timestamp: new Date(),
          confidence: data.confidence,
          actions: data.actions
        }]);
      }
      setIsTyping(false);
    },
    onError: (error) => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again.',
        timestamp: new Date(),
        confidence: 0
      }]);
      setIsTyping(false);
    }
  });

  // Confirmation mutation - executes the confirmed action
  const confirmActionMutation = useMutation({
    mutationFn: async ({ confirmationType, confirmationData }: { confirmationType: string; confirmationData: any }) => {
      return await apiRequest<any>('/api/susan/confirm-action', {
        method: 'POST',
        body: JSON.stringify({ confirmationType, confirmationData })
      });
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `✅ Action completed successfully!\n\n${data.message || 'The requested action has been executed.'}`,
        timestamp: new Date(),
        confidence: 1,
        actions: data.actions || [{ type: 'confirmation', status: 'success', message: 'Action executed' }]
      }]);
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pto-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/interviews'] });
    },
    onError: (error: any) => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `❌ Action failed: ${error.message || 'An error occurred while executing the action.'}`,
        timestamp: new Date(),
        confidence: 0,
        actions: [{ type: 'confirmation', status: 'error', message: error.message }]
      }]);
    },
    onSettled: () => {
      setPendingConfirmation(null);
      setConfirmationDialogOpen(false);
    }
  });

  const handleConfirmAction = () => {
    if (pendingConfirmation) {
      confirmActionMutation.mutate({
        confirmationType: pendingConfirmation.confirmationType,
        confirmationData: pendingConfirmation.confirmationData
      });
    }
  };

  const handleCancelConfirmation = () => {
    setPendingConfirmation(null);
    setConfirmationDialogOpen(false);
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      content: '❌ Action cancelled. Let me know if you need anything else.',
      timestamp: new Date(),
      confidence: 1
    }]);
  };

  // Agent control mutations
  const toggleAgentMutation = useMutation({
    mutationFn: async ({ agentId, isActive }: { agentId: string; isActive: boolean }) => {
      return await apiRequest<any>(`/api/agents/${agentId}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ isActive })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hr-agents'] });
    }
  });

  const runAgentMutation = useMutation({
    mutationFn: async (agentId: string) => {
      return await apiRequest<any>(`/api/agents/${agentId}/run`, {
        method: 'POST',
        body: JSON.stringify({})
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hr-agents'] });
    }
  });

  // Load initial greeting
  useEffect(() => {
    if (messages.length === 0) {
      const greeting: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: isAdminSusan 
          ? `Hello ${user?.firstName || 'Administrator'}! I'm Admin Susan AI, your advanced HR system controller. I have full access to all system functions including HR agent management, analytics, employee data, recruitment pipeline, and system administration. You can ask me to perform any administrative task, generate comprehensive reports, or provide detailed system insights. Try asking "how's the system today" for a full status report. How can I help you manage the system?`
          : `Hello ${user?.firstName || 'there'}! I'm Susan, your AI-powered HR assistant. I can help you with PTO requests, company policies, recruitment, and much more. How can I assist you today?`,
        timestamp: new Date(),
        confidence: 1
      };

      setMessages([greeting]);
    }
  }, [user, isAdminSusan, messages.length]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);
    setInput('');

    // Execute chat mutation
    chatMutation.mutate({ message: input });
  };

  const toggleListening = () => {
    setIsListening(!isListening);
    // Voice recognition would be implemented here
  };

  // For non-admin users, show regular Susan AI
  if (!isAdminSusan) {
    return (
      <div className="flex flex-col h-full bg-gradient-to-br from-orange-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Susan AI</h1>
              <p className="text-gray-600 dark:text-gray-400">Your HR Assistant</p>
            </div>
          </div>
        </div>

        {/* Chat Interface */}
        <div className="flex-1 flex flex-col p-6">
          <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-lg flex flex-col">
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
                        <AvatarFallback className="bg-orange-500 text-white">
                          🤖
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={cn(
                        "max-w-[80%] rounded-xl px-5 py-3",
                        message.role === 'user'
                          ? "bg-gradient-to-r from-orange-500 to-red-500 text-white"
                          : "bg-gray-100 dark:bg-gray-700"
                      )}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                    {message.role === 'user' && (
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-gradient-to-r from-purple-500 to-blue-500 text-white">
                          {user?.firstName?.[0] || 'U'}
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
                  placeholder="Ask Susan anything about HR..."
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
        </div>
      </div>
    );
  }

  // Admin Susan AI Interface
  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-orange-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Admin Header */}
      <div className="bg-white dark:bg-gray-800 border-b p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Admin Susan AI</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Advanced HR System Controller & Analytics Hub
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="default" className="gap-2">
              <Shield className="w-3 h-3" />
              Administrator Mode
            </Badge>
            <Badge variant="secondary" className="gap-2">
              <Activity className="w-3 h-3" />
              System Operational
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className={cn(
          "mx-6 mt-4 grid w-fit",
          isSuperAdmin ? "grid-cols-4" : "grid-cols-2"
        )}>
          <TabsTrigger value="command-center" className="gap-2">
            <Terminal className="w-4 h-4" />
            Command Center
          </TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="agents" className="gap-2">
              <Zap className="w-4 h-4" />
              HR Agents
            </TabsTrigger>
          )}
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart className="w-4 h-4" />
            Analytics
          </TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="system" className="gap-2">
              <Settings className="w-4 h-4" />
              System Control
            </TabsTrigger>
          )}
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
                      setInput("How's the system today?");
                      handleSend();
                    }}
                  >
                    <Activity className="w-4 h-4 mr-2" />
                    System Status Report
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
                    Generate HR Report
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      setInput("Show candidate pipeline status");
                      handleSend();
                    }}
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Recruitment Status
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      setInput("Review pending PTO requests");
                      handleSend();
                    }}
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    PTO Management
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* HR Agents Tab - Super Admin Only */}
        {isSuperAdmin && (
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
        )}

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
                  <CardDescription>Employees by department</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Operations</span>
                      <div className="flex items-center gap-2">
                        <Progress value={45} className="w-24" />
                        <span className="text-sm font-medium">45</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Sales</span>
                      <div className="flex items-center gap-2">
                        <Progress value={30} className="w-24" />
                        <span className="text-sm font-medium">30</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Customer Service</span>
                      <div className="flex items-center gap-2">
                        <Progress value={25} className="w-24" />
                        <span className="text-sm font-medium">25</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Management</span>
                      <div className="flex items-center gap-2">
                        <Progress value={14} className="w-24" />
                        <span className="text-sm font-medium">14</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Recruitment Pipeline</CardTitle>
                  <CardDescription>Candidates by stage</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Applied</span>
                      <div className="flex items-center gap-2">
                        <Progress value={100} className="w-24" />
                        <span className="text-sm font-medium">28</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Screening</span>
                      <div className="flex items-center gap-2">
                        <Progress value={60} className="w-24" />
                        <span className="text-sm font-medium">17</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Interview</span>
                      <div className="flex items-center gap-2">
                        <Progress value={35} className="w-24" />
                        <span className="text-sm font-medium">10</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Offer</span>
                      <div className="flex items-center gap-2">
                        <Progress value={10} className="w-24" />
                        <span className="text-sm font-medium">3</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Territory & Performance Analytics */}
            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Territory Performance</CardTitle>
                  <CardDescription>Sales by territory</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">North Region</span>
                      <Badge variant="default">$2.4M</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">South Region</span>
                      <Badge variant="secondary">$1.8M</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">East Region</span>
                      <Badge variant="secondary">$1.5M</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">West Region</span>
                      <Badge variant="outline">$900K</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Document Status</CardTitle>
                  <CardDescription>Compliance tracking</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Up to Date</span>
                      <span className="text-sm text-green-600 font-medium">87%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Expiring Soon</span>
                      <span className="text-sm text-yellow-600 font-medium">8%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Expired</span>
                      <span className="text-sm text-red-600 font-medium">5%</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Total Documents</span>
                      <span className="text-sm font-medium">342</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* HR Agent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>HR Agent Activity</CardTitle>
                <CardDescription>Automated task performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">94%</p>
                    <p className="text-sm text-gray-600">Success Rate</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">1,247</p>
                    <p className="text-sm text-gray-600">Tasks Completed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">42min</p>
                    <p className="text-sm text-gray-600">Avg. Processing Time</p>
                  </div>
                </div>
              </CardContent>
            </Card>

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

        {/* System Control Tab - Super Admin Only */}
        {isSuperAdmin && (
          <TabsContent value="system" className="flex-1 p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Admin Susan AI Configuration</CardTitle>
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
              </CardContent>
            </Card>

            {/* Example Commands */}
            <Card>
              <CardHeader>
                <CardTitle>Natural Language Commands</CardTitle>
                <CardDescription>
                  Try these example commands to see Admin Susan AI in action
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    className="justify-start p-4 h-auto flex-col items-start gap-2"
                    onClick={() => {
                      setActiveTab('command-center');
                      setInput("How's the system today?");
                    }}
                  >
                    <span className="font-medium">"How's the system today?"</span>
                    <span className="text-xs text-gray-500">Get comprehensive system status report</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start p-4 h-auto flex-col items-start gap-2"
                    onClick={() => {
                      setActiveTab('command-center');
                      setInput("Show me the recruitment pipeline");
                    }}
                  >
                    <span className="font-medium">"Show me the recruitment pipeline"</span>
                    <span className="text-xs text-gray-500">Analyze candidates and hiring progress</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start p-4 h-auto flex-col items-start gap-2"
                    onClick={() => {
                      setActiveTab('command-center');
                      setInput("Run all HR agents");
                    }}
                  >
                    <span className="font-medium">"Run all HR agents"</span>
                    <span className="text-xs text-gray-500">Execute all automation agents immediately</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start p-4 h-auto flex-col items-start gap-2"
                    onClick={() => {
                      setActiveTab('command-center');
                      setInput("Generate employee analytics report");
                    }}
                  >
                    <span className="font-medium">"Generate employee analytics report"</span>
                    <span className="text-xs text-gray-500">Create detailed workforce analysis</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Confirmation Dialog */}
      <Dialog open={confirmationDialogOpen} onOpenChange={setConfirmationDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Confirm Action
            </DialogTitle>
            <DialogDescription className="pt-2">
              Susan AI wants to perform the following action. Please confirm to proceed.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <p className="text-sm whitespace-pre-wrap">
                {pendingConfirmation?.confirmationMessage}
              </p>
              {pendingConfirmation?.confirmationData && (
                <div className="mt-3 pt-3 border-t border-orange-200 dark:border-orange-800">
                  <p className="text-xs font-medium text-orange-700 dark:text-orange-300 mb-2">
                    Action Details:
                  </p>
                  <div className="text-xs space-y-1 text-orange-600 dark:text-orange-400">
                    {Object.entries(pendingConfirmation.confirmationData)
                      .filter(([key]) => !key.startsWith('_'))
                      .slice(0, 5)
                      .map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                          <span className="font-medium">
                            {typeof value === 'object' ? JSON.stringify(value).slice(0, 30) : String(value).slice(0, 30)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleCancelConfirmation}
              disabled={confirmActionMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmAction}
              disabled={confirmActionMutation.isPending}
              className="bg-gradient-to-r from-orange-500 to-red-500"
            >
              {confirmActionMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirm & Execute
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}