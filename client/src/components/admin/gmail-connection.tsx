import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Calendar, CheckCircle, XCircle, ExternalLink, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function GmailConnection() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      const response = await fetch('/api/google/status');
      const data = await response.json();
      setIsConnected(data.gmail);
    } catch (error) {
      console.error('Failed to check Gmail connection:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch('/api/google/auth');
      const data = await response.json();
      
      if (data.authUrl) {
        // Open Google OAuth in a new window
        window.open(data.authUrl, '_blank', 'width=600,height=700');
        
        toast({
          title: 'Authorization Required',
          description: 'Please complete the Google authorization in the new window, then refresh this page.',
        });
        
        // Poll for connection status
        const checkInterval = setInterval(async () => {
          await checkConnectionStatus();
          if (isConnected) {
            clearInterval(checkInterval);
            toast({
              title: 'Success!',
              description: 'Gmail and Google Calendar connected successfully.',
            });
          }
        }, 3000);
        
        // Stop polling after 2 minutes
        setTimeout(() => clearInterval(checkInterval), 120000);
      }
    } catch (error) {
      console.error('Failed to initiate Gmail connection:', error);
      toast({
        title: 'Connection Failed',
        description: 'Failed to connect to Gmail. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email & Calendar Integration
        </CardTitle>
        <CardDescription>
          Connect your Gmail account to send emails and schedule interviews with Google Calendar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Gmail</span>
          </div>
          <Badge variant={isConnected ? 'default' : 'secondary'}>
            {isConnected ? (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3 mr-1" />
                Not Connected
              </>
            )}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Google Calendar</span>
          </div>
          <Badge variant={isConnected ? 'default' : 'secondary'}>
            {isConnected ? (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3 mr-1" />
                Not Connected
              </>
            )}
          </Badge>
        </div>

        {!isConnected && (
          <>
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="mb-2">Connecting Gmail will enable:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Send recruitment emails directly from the system</li>
                <li>Automatic interview scheduling in Google Calendar</li>
                <li>Email reminders for interviews and deadlines</li>
                <li>Sync calendar events with interview schedules</li>
              </ul>
            </div>

            <Button 
              onClick={handleConnect} 
              className="w-full"
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Connect Gmail Account
                </>
              )}
            </Button>
          </>
        )}

        {isConnected && (
          <div className="rounded-lg bg-green-50 dark:bg-green-950 p-3 text-sm text-green-700 dark:text-green-300">
            ✓ Your Gmail account is connected and ready to send emails and schedule interviews.
          </div>
        )}
      </CardContent>
    </Card>
  );
}