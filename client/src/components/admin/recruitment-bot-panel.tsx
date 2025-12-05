import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Bot, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Bell, 
  UserCheck,
  UserX,
  FileWarning,
  RefreshCw,
  Settings,
  Activity,
  ExternalLink,
  User
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface BotNotification {
  id: string;
  type: string;
  candidateId: string;
  candidateName: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details?: any;
  createdAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolved: boolean;
}

interface BotStatus {
  isActive: boolean;
  configuration: {
    idleThresholdDays: number;
    autoArchiveAfterDays: number;
    enableAutoNotifications: boolean;
    enableInconsistencyChecks: boolean;
    notificationRecipients: string[];
  };
  statistics: {
    totalNotifications: number;
    unacknowledgedNotifications: number;
    criticalNotifications: number;
    highPriorityNotifications: number;
  };
  lastCheck: string;
}

export function RecruitmentBotPanel() {
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [notifications, setNotifications] = useState<BotNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Calculate notification statistics
  const activeNotifications = notifications.filter(n => !n.acknowledgedAt);
  const acknowledgedNotifications = notifications.filter(n => n.acknowledgedAt);
  
  const handleViewCandidate = (candidateId: string) => {
    // Navigate to the recruiting page with the candidate selected
    console.log('Navigating to candidate:', candidateId);
    if (candidateId) {
      // Use React Router navigation to preserve app state
      const targetUrl = `/recruiting?candidateId=${candidateId}`;
      console.log('Navigating to URL:', targetUrl);
      navigate(targetUrl);
    } else {
      toast({
        title: 'Error',
        description: 'Candidate ID not found',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchBotStatus();
    fetchNotifications();
  }, []);

  const fetchBotStatus = async () => {
    try {
      const response = await fetch('/api/recruitment-bot/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setBotStatus(data);
      }
    } catch (error) {
      console.error('Error fetching bot status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/recruitment-bot/notifications', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const runMonitoring = async () => {
    setIsMonitoring(true);
    try {
      const response = await fetch('/api/recruitment-bot/monitor', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Monitoring Complete',
          description: `Checked ${result.candidatesChecked} candidates. Created ${result.notificationsCreated} notifications.`,
        });
        fetchNotifications();
        fetchBotStatus();
      }
    } catch (error) {
      toast({
        title: 'Monitoring Failed',
        description: 'Failed to run candidate monitoring',
        variant: 'destructive',
      });
    } finally {
      setIsMonitoring(false);
    }
  };

  const acknowledgeNotification = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/recruitment-bot/notifications/${notificationId}/acknowledge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (response.ok) {
        toast({
          title: 'Notification Acknowledged',
        });
        fetchNotifications();
      }
    } catch (error) {
      toast({
        title: 'Failed to acknowledge',
        variant: 'destructive',
      });
    }
  };

  const updateBotConfig = async (config: Partial<BotStatus['configuration']>) => {
    try {
      const response = await fetch('/api/recruitment-bot/configuration', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      
      if (response.ok) {
        toast({
          title: 'Configuration Updated',
        });
        fetchBotStatus();
      }
    } catch (error) {
      toast({
        title: 'Failed to update configuration',
        variant: 'destructive',
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'destructive';
      case 'HIGH': return 'destructive';
      case 'MEDIUM': return 'default';
      case 'LOW': return 'secondary';
      default: return 'secondary';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'IDLE_CANDIDATE': return <Clock className="h-4 w-4" />;
      case 'LICENSE_MISMATCH': return <FileWarning className="h-4 w-4" />;
      case 'INCONSISTENCY_DETECTED': return <AlertCircle className="h-4 w-4" />;
      case 'CRITERIA_NOT_MET': return <UserX className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bot Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Recruitment Assistant Bot
            </div>
            <Badge variant={botStatus?.isActive ? 'default' : 'secondary'}>
              {botStatus?.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </CardTitle>
          <CardDescription>
            AI-powered assistant helping recruiters manage candidates efficiently
          </CardDescription>
        </CardHeader>
        <CardContent>
          {botStatus && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">Total Notifications</span>
                <span className="text-2xl font-bold">{botStatus.statistics.totalNotifications}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">Unacknowledged</span>
                <span className="text-2xl font-bold text-orange-600">
                  {botStatus.statistics.unacknowledgedNotifications}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">Critical Issues</span>
                <span className="text-2xl font-bold text-red-600">
                  {botStatus.statistics.criticalNotifications}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">High Priority</span>
                <span className="text-2xl font-bold text-yellow-600">
                  {botStatus.statistics.highPriorityNotifications}
                </span>
              </div>
            </div>
          )}
          
          <div className="mt-4">
            <Button 
              onClick={runMonitoring} 
              disabled={isMonitoring}
              className="w-full"
            >
              {isMonitoring ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Running Monitoring...
                </>
              ) : (
                <>
                  <Activity className="h-4 w-4 mr-2" />
                  Run Candidate Monitoring
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Notifications and Settings */}
      <Tabs defaultValue="notifications" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="notifications">
            Notifications ({notifications.filter(n => !n.acknowledgedAt).length} active)
          </TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Active Notifications</CardTitle>
                  <CardDescription>
                    Issues and alerts that require attention
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Show Acknowledged</Label>
                  <Switch
                    checked={showAcknowledged}
                    onCheckedChange={setShowAcknowledged}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {/* Summary Statistics */}
                  {notifications.length > 0 && (
                    <div className="flex gap-4 p-3 bg-muted rounded-lg mb-4">
                      <div className="flex-1 text-center">
                        <div className="text-2xl font-bold text-orange-600">{activeNotifications.length}</div>
                        <div className="text-xs text-muted-foreground">Active</div>
                      </div>
                      <div className="flex-1 text-center">
                        <div className="text-2xl font-bold text-green-600">{acknowledgedNotifications.length}</div>
                        <div className="text-xs text-muted-foreground">Resolved</div>
                      </div>
                      <div className="flex-1 text-center">
                        <div className="text-2xl font-bold">{notifications.length}</div>
                        <div className="text-xs text-muted-foreground">Total</div>
                      </div>
                    </div>
                  )}
                  
                  {(() => {
                    // Filter notifications based on toggle
                    const displayNotifications = showAcknowledged 
                      ? notifications 
                      : notifications.filter(n => !n.acknowledgedAt);
                    
                    if (notifications.length === 0) {
                      return (
                        <div className="text-center py-8 text-muted-foreground">
                          No notifications at this time
                        </div>
                      );
                    }
                    
                    if (displayNotifications.length === 0) {
                      return (
                        <div className="text-center py-8 text-muted-foreground">
                          {showAcknowledged 
                            ? "No notifications to display" 
                            : "All notifications have been resolved. Toggle 'Show Acknowledged' to view them."}
                        </div>
                      );
                    }
                    
                    return displayNotifications
                      .sort((a, b) => {
                        // Sort unacknowledged first, then by date
                        if (!a.acknowledgedAt && b.acknowledgedAt) return -1;
                        if (a.acknowledgedAt && !b.acknowledgedAt) return 1;
                        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                      })
                      .map((notification) => (
                      <Alert 
                        key={notification.id} 
                        className={`relative ${notification.acknowledgedAt ? 'opacity-60' : ''}`}
                      >
                        <div className="flex items-start gap-2">
                          {getNotificationIcon(notification.type)}
                          <div className="flex-1">
                            <AlertTitle className="flex items-center gap-2">
                              {notification.candidateName}
                              <Badge variant={getSeverityColor(notification.severity)}>
                                {notification.severity}
                              </Badge>
                              {notification.acknowledgedAt && (
                                <Badge variant="outline" className="bg-green-50">
                                  ✓ Acknowledged
                                </Badge>
                              )}
                            </AlertTitle>
                            <AlertDescription className="mt-2">
                              {notification.message}
                              {notification.details && (
                                <div className="mt-2 p-2 bg-muted rounded text-xs">
                                  <div>Stage: {notification.details.currentStage}</div>
                                  {notification.details.daysSinceUpdate && (
                                    <div>Days idle: {notification.details.daysSinceUpdate}</div>
                                  )}
                                  {notification.details.discrepancy && (
                                    <div>Issue: {notification.details.discrepancy}</div>
                                  )}
                                </div>
                              )}
                              <div className="mt-2 text-xs text-muted-foreground">
                                Created: {new Date(notification.createdAt).toLocaleString()}
                                {notification.acknowledgedAt && (
                                  <div>
                                    Acknowledged: {new Date(notification.acknowledgedAt).toLocaleString()}
                                    {notification.acknowledgedBy && ` by ${notification.acknowledgedBy}`}
                                  </div>
                                )}
                              </div>
                            </AlertDescription>
                            <div className="flex gap-2 mt-3">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewCandidate(notification.candidateId)}
                              >
                                <User className="h-3 w-3 mr-1" />
                                View Candidate
                              </Button>
                              {!notification.acknowledgedAt && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => acknowledgeNotification(notification.id)}
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Acknowledge & Resolve
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </Alert>
                    ));
                  })()}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bot Configuration</CardTitle>
              <CardDescription>
                Customize how the recruitment bot monitors and alerts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Test Button for debugging */}
              <div className="mb-4 p-4 border rounded bg-muted">
                <h4 className="font-semibold mb-2">Debug Test</h4>
                <Button 
                  onClick={() => {
                    const testCandidateId = '91c728ed-3205-4f39-9684-601cd8b3ee56';
                    console.log('Testing navigation with candidate ID:', testCandidateId);
                    handleViewCandidate(testCandidateId);
                  }}
                  variant="outline"
                >
                  Test View Candidate (Sarah Johnson)
                </Button>
              </div>
              
              {botStatus && (
                <>
                  <div className="space-y-2">
                    <Label>Idle Threshold (Days)</Label>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[botStatus.configuration.idleThresholdDays]}
                        onValueChange={(value) => 
                          updateBotConfig({ idleThresholdDays: value[0] })
                        }
                        min={1}
                        max={30}
                        step={1}
                        className="flex-1"
                      />
                      <span className="w-12 text-right">
                        {botStatus.configuration.idleThresholdDays}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Alert when candidates are idle for this many days
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Auto-Archive After (Days)</Label>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[botStatus.configuration.autoArchiveAfterDays]}
                        onValueChange={(value) => 
                          updateBotConfig({ autoArchiveAfterDays: value[0] })
                        }
                        min={7}
                        max={90}
                        step={1}
                        className="flex-1"
                      />
                      <span className="w-12 text-right">
                        {botStatus.configuration.autoArchiveAfterDays}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Suggest archiving candidates idle for this long
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Auto Notifications</Label>
                      <p className="text-xs text-muted-foreground">
                        Automatically send notifications for issues
                      </p>
                    </div>
                    <Switch
                      checked={botStatus.configuration.enableAutoNotifications}
                      onCheckedChange={(checked) => 
                        updateBotConfig({ enableAutoNotifications: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Inconsistency Checks</Label>
                      <p className="text-xs text-muted-foreground">
                        Check for data inconsistencies (license, experience)
                      </p>
                    </div>
                    <Switch
                      checked={botStatus.configuration.enableInconsistencyChecks}
                      onCheckedChange={(checked) => 
                        updateBotConfig({ enableInconsistencyChecks: checked })
                      }
                    />
                  </div>

                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Last monitoring check: {new Date(botStatus.lastCheck).toLocaleString()}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}