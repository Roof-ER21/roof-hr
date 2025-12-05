/**
 * Susan AI Floating Orb Component
 * A beautiful, animated orange orb that provides quick access to Susan AI from any page
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Mic, MicOff, Sparkles, Bot } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: any[];
}

interface QuickAction {
  label: string;
  action: string;
  params?: any;
  icon?: string;
}

export function SusanFloatingOrb() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Load initial greeting and quick actions
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      loadInitialMessage();
    }
  }, [isOpen]);

  // Quick action mutation for site-wide Susan AI functions
  const quickActionMutation = useMutation({
    mutationFn: async ({ action, params }: { action: string; params?: any }) => {
      const response = await apiRequest('/api/susan-ai/quick-action', {
        method: 'POST',
        body: JSON.stringify({ action, params })
      });
      return await response.json();
    },
    onSuccess: (data) => {
      if (data.message) {
        const assistantMessage: Message = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role: 'assistant',
          content: data.message,
          timestamp: new Date(),
          actions: data.actions
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
      
      if (data.suggestions) {
        setQuickActions(data.suggestions.map((s: string) => ({
          label: s,
          action: 'quick_query',
          params: { query: s }
        })));
      }
    },
    onError: () => {
      const errorMessage: Message = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: "I encountered an error. Please try again or contact support.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  });

  // Chat with Susan AI
  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      // Use quick action endpoint for natural language queries
      return quickActionMutation.mutateAsync({
        action: 'quick_query',
        params: { query: message }
      });
    },
    onSuccess: (data) => {
      const assistantMessage: Message = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: data.message || 'I apologize, but I encountered an issue processing your request.',
        timestamp: new Date(),
        actions: data.actions
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
      
      // Update quick actions if provided
      if (data.quickActions) {
        setQuickActions(data.quickActions);
      }
    },
    onError: () => {
      setIsTyping(false);
      const errorMessage: Message = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: "I'm sorry, I encountered an error. Please try again or contact support if the issue persists.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  });

  const loadInitialMessage = async () => {
    try {
      const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';
      const greeting: Message = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: isAdmin
          ? `Hello ${user?.firstName || 'Administrator'}! I'm Admin Susan AI. I can help you control all system functions, manage HR agents, generate analytics, and perform administrative tasks. Ask me "how's the system today" for a full report or click the Susan AI tab for advanced features.`
          : `Hello ${user?.firstName || 'there'}! I'm Susan, your AI-powered HR assistant. I can help you with PTO requests, policies, and more. How can I assist you today?`,
        timestamp: new Date()
      };
      setMessages([greeting]);
      
      // Set role-appropriate quick actions
      if (isAdmin) {
        setQuickActions([
          { label: 'System Status', action: 'navigate', params: { page: '/susan-ai' }, icon: 'activity' },
          { label: 'HR Analytics', action: 'query', params: { query: 'Generate analytics report' }, icon: 'bar-chart' },
          { label: 'Agent Control', action: 'query', params: { query: 'Show agent status' }, icon: 'zap' }
        ]);
      } else {
        setQuickActions([
          { label: 'PTO Request', action: 'navigate', params: { page: '/pto' }, icon: 'calendar' },
          { label: 'Company Policies', action: 'query', params: { query: 'Show company policies' }, icon: 'file-text' }
        ]);
      }
    } catch (error) {
      const defaultGreeting: Message = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: `Hello! I'm Susan, your AI assistant. How can I help you today?`,
        timestamp: new Date()
      };
      setMessages([defaultGreeting]);
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);
    chatMutation.mutate(input);
  };

  const handleQuickAction = async (action: QuickAction) => {
    if (action.action === 'navigate') {
      navigate(action.params.page);
      setIsOpen(false);
    } else if (action.action === 'query' || action.action === 'quick_query') {
      // Send the query directly through quick action endpoint
      const userMessage: Message = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'user',
        content: action.params.query,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);
      setIsTyping(true);
      
      await quickActionMutation.mutateAsync({
        action: 'quick_query',
        params: { query: action.params.query }
      });
      setIsTyping(false);
    } else {
      // Handle other quick actions
      await quickActionMutation.mutateAsync({
        action: action.action,
        params: action.params
      });
    }
  };

  const toggleListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Speech recognition is not supported in your browser.');
      return;
    }
    setIsListening(!isListening);
    // Speech recognition implementation would go here
  };

  return (
    <>
      {/* Floating Orb Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 shadow-2xl hover:shadow-orange-500/50 transition-all duration-300 group overflow-hidden"
            style={{
              background: 'radial-gradient(circle at 30% 30%, #fb923c, #ea580c)',
              boxShadow: '0 0 40px rgba(251, 146, 60, 0.5), inset 0 0 20px rgba(255, 255, 255, 0.2)'
            }}
          >
            {/* Animated glow effect */}
            <div className="absolute inset-0 rounded-full animate-ping bg-orange-400 opacity-20" />
            <div className="absolute inset-0 rounded-full animate-pulse bg-gradient-to-br from-orange-300 to-orange-600 opacity-30" />
            
            {/* Inner orb with sparkle effect */}
            <div className="relative w-full h-full flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-white animate-pulse" />
              <div className="absolute top-2 right-2 w-3 h-3 bg-white rounded-full opacity-60" />
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-6 right-6 z-50 w-96 h-[600px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Susan AI</h3>
                  <p className="text-xs opacity-90">Your HR Assistant</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-white/20"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
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
                    {message.role === 'assistant' && (
                      <Avatar className="w-8 h-8 bg-orange-100">
                        <AvatarFallback className="bg-orange-100 text-orange-600">
                          S
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-4 py-2",
                        message.role === 'user'
                          ? "bg-orange-500 text-white"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      {message.actions && message.actions.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                          <p className="text-xs font-medium mb-1">Actions taken:</p>
                          {message.actions.map((action, idx) => (
                            <p key={`${message.id}-action-${idx}`} className="text-xs opacity-80">
                              • {action.message}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    {message.role === 'user' && (
                      <Avatar className="w-8 h-8">
                        <AvatarFallback>
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
                    <Avatar className="w-8 h-8 bg-orange-100">
                      <AvatarFallback className="bg-orange-100 text-orange-600">
                        S
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Quick Actions */}
            {quickActions.length > 0 && (
              <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex gap-2 overflow-x-auto">
                  {quickActions.map((action, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickAction(action)}
                      className="whitespace-nowrap text-xs"
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-2">
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
                  placeholder="Ask Susan anything..."
                  className="flex-1 min-h-[40px] max-h-[100px] resize-none"
                  disabled={isTyping}
                />
                <div className="flex flex-col gap-1">
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
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}