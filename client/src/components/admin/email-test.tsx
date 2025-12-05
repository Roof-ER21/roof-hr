import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Mail, Send, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function EmailTest() {
  const [testEmail, setTestEmail] = useState('');
  const [subject, setSubject] = useState('Test Email from ROOF-ER HR System');
  const [body, setBody] = useState('This is a test email to verify Gmail integration is working correctly.\n\nBest regards,\nROOF-ER HR Team');
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const handleSendTest = async () => {
    if (!testEmail.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an email address',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch('/api/emails/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: testEmail,
          subject: subject,
          body: body,
          templateType: 'test'
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: 'Success!',
          description: result.message || 'Test email sent successfully',
        });
        
        // Clear form
        setTestEmail('');
      } else {
        throw new Error(result.error || 'Failed to send email');
      }
    } catch (error) {
      console.error('Failed to send test email:', error);
      toast({
        title: 'Failed to Send',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Test
        </CardTitle>
        <CardDescription>
          Send a test email to verify Gmail integration is working
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="test-email">Recipient Email</Label>
          <Input
            id="test-email"
            type="email"
            placeholder="Enter email address to test"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="test-subject">Subject</Label>
          <Input
            id="test-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="test-body">Email Body</Label>
          <Textarea
            id="test-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
          />
        </div>

        <Button 
          onClick={handleSendTest} 
          disabled={isSending || !testEmail.trim()}
          className="w-full"
        >
          {isSending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Send Test Email
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}