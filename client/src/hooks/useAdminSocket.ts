/**
 * Admin Socket Hook
 * Real-time WebSocket connection for admin notifications
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useToast } from '@/hooks/use-toast';

interface AdminNotification {
  id: string;
  type: 'alert' | 'info' | 'success' | 'warning';
  title: string;
  message: string;
  timestamp: Date;
  data?: any;
}

interface AdminSocketEvents {
  // Events from server
  'admin:alert': (data: { title: string; message: string; severity: 'low' | 'medium' | 'high' }) => void;
  'admin:metric-update': (data: { metric: string; value: number; change: number }) => void;
  'admin:issue-detected': (data: { id: string; title: string; severity: string }) => void;
  'admin:job-complete': (data: { jobName: string; status: 'success' | 'failed'; message: string }) => void;
  'admin:activity': (data: { action: string; user: string; resource: string }) => void;
}

export function useAdminSocket(enabled: boolean = true) {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const [lastActivity, setLastActivity] = useState<Date | null>(null);

  const addNotification = useCallback((notification: Omit<AdminNotification, 'id' | 'timestamp'>) => {
    const newNotification: AdminNotification = {
      ...notification,
      id: `notif-${Date.now()}`,
      timestamp: new Date()
    };
    setNotifications(prev => [newNotification, ...prev].slice(0, 50)); // Keep last 50
    setLastActivity(new Date());
    return newNotification;
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Connect to admin namespace
    const socket = io(window.location.origin, {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      autoConnect: true
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('[AdminSocket] Connected:', socket.id);

      // Subscribe to admin events
      socket.emit('admin:subscribe');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('[AdminSocket] Disconnected');
    });

    // Handle admin alerts
    socket.on('admin:alert', (data) => {
      const notification = addNotification({
        type: data.severity === 'high' ? 'alert' : 'warning',
        title: data.title,
        message: data.message,
        data
      });

      toast({
        title: data.title,
        description: data.message,
        variant: data.severity === 'high' ? 'destructive' : 'default'
      });
    });

    // Handle metric updates
    socket.on('admin:metric-update', (data) => {
      addNotification({
        type: 'info',
        title: 'Metric Update',
        message: `${data.metric}: ${data.value} (${data.change >= 0 ? '+' : ''}${data.change})`,
        data
      });
    });

    // Handle issue detection
    socket.on('admin:issue-detected', (data) => {
      addNotification({
        type: data.severity === 'high' ? 'alert' : 'warning',
        title: 'Issue Detected',
        message: data.title,
        data
      });

      toast({
        title: 'Issue Detected',
        description: data.title,
        variant: data.severity === 'high' ? 'destructive' : 'default'
      });
    });

    // Handle job completion
    socket.on('admin:job-complete', (data) => {
      addNotification({
        type: data.status === 'success' ? 'success' : 'alert',
        title: `Job ${data.status === 'success' ? 'Complete' : 'Failed'}`,
        message: `${data.jobName}: ${data.message}`,
        data
      });

      toast({
        title: `${data.jobName} ${data.status === 'success' ? 'Complete' : 'Failed'}`,
        description: data.message,
        variant: data.status === 'success' ? 'default' : 'destructive'
      });
    });

    // Handle activity feed
    socket.on('admin:activity', (data) => {
      addNotification({
        type: 'info',
        title: 'Activity',
        message: `${data.user}: ${data.action} on ${data.resource}`,
        data
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, addNotification, toast]);

  // Emit custom events
  const emit = useCallback((event: string, data?: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  return {
    isConnected,
    notifications,
    lastActivity,
    clearNotifications,
    emit,
    socket: socketRef.current
  };
}
