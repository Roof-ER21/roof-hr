import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Send, Calendar, FileSpreadsheet, HardDrive, FileText, Loader2 } from 'lucide-react';

interface GoogleIntegrationContentProps {
  embedded?: boolean;
}

function GoogleIntegrationContent({ embedded = false }: GoogleIntegrationContentProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [connectionStatus, setConnectionStatus] = useState<Record<string, boolean>>({});
  const [emailData, setEmailData] = useState({
    to: '',
    subject: '',
    body: ''
  });
  const [eventData, setEventData] = useState({
    summary: '',
    description: '',
    startDateTime: '',
    endDateTime: '',
    attendees: ''
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('GET', '/api/google/test-connection');
    },
    onSuccess: (data: any) => {
      setConnectionStatus(data.status || {});
      toast({
        title: 'Connection Test Successful',
        description: 'All Google services are connected and ready!'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Connection Test Failed',
        description: error.message || 'Failed to connect to Google services',
        variant: 'destructive'
      });
    }
  });

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/google/gmail/send', {
        to: emailData.to,
        subject: emailData.subject,
        html: `<p>${emailData.body}</p>`
      });
    },
    onSuccess: () => {
      toast({
        title: 'Email Sent',
        description: 'Your email has been sent successfully via Gmail!'
      });
      setEmailData({ to: '', subject: '', body: '' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Send Email',
        description: error.message || 'An error occurred while sending the email',
        variant: 'destructive'
      });
    }
  });

  // Create calendar event mutation
  const createEventMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/google/calendar/events', {
        summary: eventData.summary,
        description: eventData.description,
        startDateTime: new Date(eventData.startDateTime),
        endDateTime: new Date(eventData.endDateTime),
        attendees: eventData.attendees.split(',').map(email => email.trim()).filter(Boolean)
      });
    },
    onSuccess: () => {
      toast({
        title: 'Event Created',
        description: 'Calendar event has been created successfully!'
      });
      setEventData({ summary: '', description: '', startDateTime: '', endDateTime: '', attendees: '' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Create Event',
        description: error.message || 'An error occurred while creating the event',
        variant: 'destructive'
      });
    }
  });

  // Export tools to Sheets mutation
  const exportToolsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/google/sheets/export-tools');
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Tools Exported',
        description: 'Tools inventory has been exported to Google Sheets!'
      });
      if (data?.spreadsheetUrl) {
        window.open(data.spreadsheetUrl, '_blank');
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Export Failed',
        description: error.message || 'Failed to export tools to Google Sheets',
        variant: 'destructive'
      });
    }
  });

  // Setup HR structure in Drive mutation
  const setupDriveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/google/drive/setup-hr-structure');
    },
    onSuccess: () => {
      toast({
        title: 'Drive Structure Created',
        description: 'HR folder structure has been set up in Google Drive!'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Setup Failed',
        description: error.message || 'Failed to set up Drive structure',
        variant: 'destructive'
      });
    }
  });

  const content = (
    <>
      <Card>
        <CardHeader>
          <CardTitle className={embedded ? "text-xl" : "text-2xl"}>Google Services Integration</CardTitle>
          <CardDescription>
            Test and manage all integrated Google services for the HR system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button 
                onClick={() => testConnectionMutation.mutate()}
                disabled={testConnectionMutation.isPending}
              >
                {testConnectionMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing Connection...
                  </>
                ) : (
                  'Test All Services'
                )}
              </Button>
            </div>

            {Object.keys(connectionStatus).length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                {Object.entries(connectionStatus).map(([service, status]) => (
                  <Badge key={service} variant={status ? 'default' : 'destructive'}>
                    {status ? (
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                    ) : (
                      <XCircle className="mr-1 h-3 w-3" />
                    )}
                    {service.charAt(0).toUpperCase() + service.slice(1)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="gmail" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="gmail">
            <Send className="mr-2 h-4 w-4" />
            Gmail
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <Calendar className="mr-2 h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="sheets">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Sheets
          </TabsTrigger>
          <TabsTrigger value="drive">
            <HardDrive className="mr-2 h-4 w-4" />
            Drive
          </TabsTrigger>
          <TabsTrigger value="docs">
            <FileText className="mr-2 h-4 w-4" />
            Docs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gmail">
          <Card>
            <CardHeader>
              <CardTitle>Send Email via Gmail</CardTitle>
              <CardDescription>
                Send emails using theroofdocs.com domain through Gmail
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="to">To</Label>
                <Input
                  id="to"
                  placeholder="recipient@example.com"
                  value={emailData.to}
                  onChange={(e) => setEmailData({ ...emailData, to: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  placeholder="Email subject"
                  value={emailData.subject}
                  onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="body">Body</Label>
                <Textarea
                  id="body"
                  placeholder="Email content"
                  value={emailData.body}
                  onChange={(e) => setEmailData({ ...emailData, body: e.target.value })}
                  rows={5}
                />
              </div>
              <Button 
                onClick={() => sendEmailMutation.mutate()}
                disabled={sendEmailMutation.isPending || !emailData.to || !emailData.subject}
              >
                {sendEmailMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Email'
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <CardTitle>Create Calendar Event</CardTitle>
              <CardDescription>
                Schedule interviews and meetings in Google Calendar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="summary">Event Title</Label>
                <Input
                  id="summary"
                  placeholder="Interview with John Doe"
                  value={eventData.summary}
                  onChange={(e) => setEventData({ ...eventData, summary: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Event details"
                  value={eventData.description}
                  onChange={(e) => setEventData({ ...eventData, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start">Start Date/Time</Label>
                  <Input
                    id="start"
                    type="datetime-local"
                    value={eventData.startDateTime}
                    onChange={(e) => setEventData({ ...eventData, startDateTime: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="end">End Date/Time</Label>
                  <Input
                    id="end"
                    type="datetime-local"
                    value={eventData.endDateTime}
                    onChange={(e) => setEventData({ ...eventData, endDateTime: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="attendees">Attendees (comma-separated emails)</Label>
                <Input
                  id="attendees"
                  placeholder="john@example.com, jane@example.com"
                  value={eventData.attendees}
                  onChange={(e) => setEventData({ ...eventData, attendees: e.target.value })}
                />
              </div>
              <Button 
                onClick={() => createEventMutation.mutate()}
                disabled={createEventMutation.isPending || !eventData.summary || !eventData.startDateTime || !eventData.endDateTime}
              >
                {createEventMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Event'
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sheets">
          <Card>
            <CardHeader>
              <CardTitle>Google Sheets Integration</CardTitle>
              <CardDescription>
                Export and sync tools inventory with Google Sheets
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => exportToolsMutation.mutate()}
                disabled={exportToolsMutation.isPending}
              >
                {exportToolsMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  'Export Tools Inventory to Sheets'
                )}
              </Button>
              <p className="text-sm text-muted-foreground">
                This will create a new Google Sheet with all tools inventory data
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drive">
          <Card>
            <CardHeader>
              <CardTitle>Google Drive Setup</CardTitle>
              <CardDescription>
                Organize HR documents in Google Drive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => setupDriveMutation.mutate()}
                disabled={setupDriveMutation.isPending}
              >
                {setupDriveMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  'Setup HR Folder Structure'
                )}
              </Button>
              <p className="text-sm text-muted-foreground">
                This will create organized folders for employee files, contracts, policies, and more
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docs">
          <Card>
            <CardHeader>
              <CardTitle>Google Docs Integration</CardTitle>
              <CardDescription>
                Generate contracts and performance reviews in Google Docs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Contract and document generation is available through employee profiles and the recruitment system.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );

  if (embedded) {
    return <div className="space-y-6">{content}</div>;
  }

  return <div className="container mx-auto py-6 space-y-6">{content}</div>;
}

export default function GoogleIntegration({ embedded = false }: { embedded?: boolean }) {
  if (embedded) {
    return <GoogleIntegrationContent embedded />;
  }
  return (
    <ProtectedRoute requiredRole="ADMIN">
      <GoogleIntegrationContent />
    </ProtectedRoute>
  );
}