/**
 * Real-Time Notification Panel
 * Displays live notifications from WebSocket connection
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bell, BellRing, Trash2, X, CheckCircle, AlertTriangle,
  Info, Zap, Clock, Wifi, WifiOff
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  type: 'alert' | 'info' | 'success' | 'warning';
  title: string;
  message: string;
  timestamp: Date;
  data?: any;
}

interface NotificationPanelProps {
  notifications: Notification[];
  isConnected: boolean;
  onClear: () => void;
}

const typeConfig = {
  alert: {
    icon: AlertTriangle,
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    iconColor: 'text-red-500'
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    iconColor: 'text-yellow-500'
  },
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
    iconColor: 'text-green-500'
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    iconColor: 'text-blue-500'
  }
};

export function NotificationPanel({
  notifications,
  isConnected,
  onClear
}: NotificationPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const unreadCount = notifications.length;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            {unreadCount > 0 ? (
              <BellRing className="w-4 h-4 text-orange-500 animate-pulse" />
            ) : (
              <Bell className="w-4 h-4" />
            )}
            Live Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "text-xs",
                isConnected
                  ? "text-green-600 border-green-200"
                  : "text-red-600 border-red-200"
              )}
            >
              {isConnected ? (
                <>
                  <Wifi className="w-3 h-3 mr-1" />
                  Live
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 mr-1" />
                  Offline
                </>
              )}
            </Badge>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onClear}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[250px]">
          {notifications.length > 0 ? (
            <div className="space-y-2">
              {notifications.map((notification) => {
                const config = typeConfig[notification.type];
                const Icon = config.icon;
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "p-3 rounded-lg border transition-all",
                      config.bgColor,
                      config.borderColor
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <Icon className={cn("w-4 h-4 mt-0.5", config.iconColor)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">{notification.title}</p>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                          {notification.message}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[200px] text-gray-400">
              <Zap className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm font-medium">No notifications</p>
              <p className="text-xs">Real-time updates will appear here</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
