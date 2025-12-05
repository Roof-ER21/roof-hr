import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { MessageSquare, Send, Phone, AlertCircle, CheckCircle, Clock, Users, Settings } from 'lucide-react';
import { format } from 'date-fns';

interface SmsMessage {
  id: string;
  candidateId?: string;
  recipientPhone: string;
  message: string;
  type: 'REMINDER' | 'NOTIFICATION' | 'CAMPAIGN' | 'ALERT';
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED';
  twilioMessageSid?: string;
  errorMessage?: string;
  sentAt?: string;
  deliveredAt?: string;
  createdBy: string;
  createdAt: string;
}

interface CommunicationPreference {
  id: string;
  candidateId: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  preferredChannel: 'EMAIL' | 'SMS' | 'BOTH';
  unsubscribedEmail: boolean;
  unsubscribedSms: boolean;
  timezone: string;
  bestTimeToContact?: string;
}

export function SmsMessaging() {
  const { toast } = useToast();
  const [showComposeDialog, setShowComposeDialog] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [messageType, setMessageType] = useState<SmsMessage['type']>('NOTIFICATION');
  const [messageContent, setMessageContent] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');

  // Fetch SMS messages
  const { data: smsMessages = [], isLoading } = useQuery<SmsMessage[]>({
    queryKey: ['/api/sms-messages'],
  });

  // Fetch candidates
  const { data: candidates = [] } = useQuery({
    queryKey: ['/api/candidates'],
  });

  // Fetch communication preferences
  const { data: preferences = [] } = useQuery<CommunicationPreference[]>({
    queryKey: ['/api/communication-preferences'],
  });

  // Send SMS mutation
  const sendSmsMutation = useMutation({
    mutationFn: (data: {
      candidateId?: string;
      recipientPhone: string;
      message: string;
      type: SmsMessage['type'];
    }) =>
      apiRequest('/api/sms-messages', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sms-messages'] });
      setShowComposeDialog(false);
      setMessageContent('');
      setRecipientPhone('');
      toast({
        title: 'SMS Sent',
        description: 'Your message has been sent successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Send SMS',
        description: error.message || 'Please check Twilio configuration.',
        variant: 'destructive',
      });
    },
  });

  // Update communication preferences
  const updatePreferencesMutation = useMutation({
    mutationFn: ({ candidateId, data }: { candidateId: string; data: Partial<CommunicationPreference> }) =>
      apiRequest(`/api/communication-preferences/${candidateId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/communication-preferences'] });
      toast({
        title: 'Preferences Updated',
        description: 'Communication preferences have been updated.',
      });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'FAILED':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'SENT':
        return <Send className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      DELIVERED: 'bg-green-100 text-green-800',
      FAILED: 'bg-red-100 text-red-800',
      SENT: 'bg-blue-100 text-blue-800',
      PENDING: 'bg-gray-100 text-gray-800',
    };
    return colors[status as keyof typeof colors] || colors.PENDING;
  };

  const recentMessages = smsMessages.slice(0, 10);
  const totalSent = smsMessages.filter(m => m.status === 'SENT' || m.status === 'DELIVERED').length;
  const totalDelivered = smsMessages.filter(m => m.status === 'DELIVERED').length;
  const totalFailed = smsMessages.filter(m => m.status === 'FAILED').length;
  const smsEnabledCandidates = preferences.filter(p => p.smsEnabled).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">SMS Messaging</h2>
          <p className="text-muted-foreground">
            Send SMS notifications and manage communication preferences
          </p>
        </div>
        <Button onClick={() => setShowComposeDialog(true)}>
          <MessageSquare className="h-4 w-4 mr-2" />
          Compose SMS
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Send className="h-4 w-4 text-blue-500" />
              Messages Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSent}</div>
            <p className="text-xs text-muted-foreground">Total sent messages</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Delivered
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDelivered}</div>
            <p className="text-xs text-muted-foreground">Successfully delivered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalFailed}</div>
            <p className="text-xs text-muted-foreground">Failed to deliver</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-500" />
              SMS Enabled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{smsEnabledCandidates}</div>
            <p className="text-xs text-muted-foreground">Candidates opted-in</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="messages" className="space-y-4">
        <TabsList>
          <TabsTrigger value="messages">Recent Messages</TabsTrigger>
          <TabsTrigger value="preferences">Communication Preferences</TabsTrigger>
        </TabsList>

        {/* Recent Messages Tab */}
        <TabsContent value="messages">
          <Card>
            <CardHeader>
              <CardTitle>Recent SMS Messages</CardTitle>
              <CardDescription>
                View and track all sent SMS messages
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentMessages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No SMS messages sent yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {recentMessages.map((message) => {
                    const candidate = candidates.find((c: any) => c.id === message.candidateId);
                    return (
                      <div
                        key={message.id}
                        className="flex items-start justify-between p-4 border rounded-lg"
                      >
                        <div className="flex gap-3">
                          {getStatusIcon(message.status)}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {candidate
                                  ? `${candidate.firstName} ${candidate.lastName}`
                                  : message.recipientPhone}
                              </span>
                              <Badge className={getStatusBadge(message.status)}>
                                {message.status}
                              </Badge>
                              <Badge variant="outline">{message.type}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {message.message}
                            </p>
                            {message.errorMessage && (
                              <p className="text-sm text-red-600">
                                Error: {message.errorMessage}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {message.sentAt
                                ? `Sent: ${format(new Date(message.sentAt), 'PPp')}`
                                : `Created: ${format(new Date(message.createdAt), 'PPp')}`}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Communication Preferences Tab */}
        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>Candidate Communication Preferences</CardTitle>
              <CardDescription>
                Manage how candidates prefer to be contacted
              </CardDescription>
            </CardHeader>
            <CardContent>
              {candidates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No candidates found.
                </div>
              ) : (
                <div className="space-y-4">
                  {candidates.slice(0, 10).map((candidate: any) => {
                    const pref = preferences.find(p => p.candidateId === candidate.id);
                    return (
                      <div
                        key={candidate.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">
                            {candidate.firstName} {candidate.lastName}
                          </p>
                          <div className="flex gap-2 mt-1">
                            <Badge variant={pref?.emailEnabled ? 'default' : 'secondary'}>
                              Email: {pref?.emailEnabled ? 'Enabled' : 'Disabled'}
                            </Badge>
                            <Badge variant={pref?.smsEnabled ? 'default' : 'secondary'}>
                              SMS: {pref?.smsEnabled ? 'Enabled' : 'Disabled'}
                            </Badge>
                            {pref?.preferredChannel && (
                              <Badge variant="outline">
                                Prefers: {pref.preferredChannel}
                              </Badge>
                            )}
                          </div>
                          {pref?.bestTimeToContact && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Best time: {pref.bestTimeToContact}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            // Toggle SMS preference
                            updatePreferencesMutation.mutate({
                              candidateId: candidate.id,
                              data: {
                                smsEnabled: !pref?.smsEnabled,
                              },
                            });
                          }}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Compose SMS Dialog */}
      <Dialog open={showComposeDialog} onOpenChange={setShowComposeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compose SMS Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Recipient</Label>
              <Select
                value={selectedCandidate?.id || ''}
                onValueChange={(value) => {
                  const candidate = candidates.find((c: any) => c.id === value);
                  setSelectedCandidate(candidate);
                  if (candidate?.phone) {
                    setRecipientPhone(candidate.phone);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a candidate" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((candidate: any) => (
                    <SelectItem key={candidate.id} value={candidate.id}>
                      {candidate.firstName} {candidate.lastName}
                      {candidate.phone && ` - ${candidate.phone}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Phone Number</Label>
              <Input
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="+1234567890"
                required
              />
            </div>

            <div>
              <Label>Message Type</Label>
              <Select
                value={messageType}
                onValueChange={(value) => setMessageType(value as SmsMessage['type'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="REMINDER">Reminder</SelectItem>
                  <SelectItem value="NOTIFICATION">Notification</SelectItem>
                  <SelectItem value="CAMPAIGN">Campaign</SelectItem>
                  <SelectItem value="ALERT">Alert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Message</Label>
              <Textarea
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                placeholder="Type your message here..."
                rows={4}
                maxLength={160}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                {messageContent.length}/160 characters
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowComposeDialog(false);
                  setMessageContent('');
                  setRecipientPhone('');
                  setSelectedCandidate(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (recipientPhone && messageContent) {
                    sendSmsMutation.mutate({
                      candidateId: selectedCandidate?.id,
                      recipientPhone,
                      message: messageContent,
                      type: messageType,
                    });
                  }
                }}
                disabled={!recipientPhone || !messageContent || sendSmsMutation.isPending}
              >
                {sendSmsMutation.isPending ? 'Sending...' : 'Send SMS'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}