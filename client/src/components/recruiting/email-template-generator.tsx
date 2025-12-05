import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Mail,
  Copy,
  Send,
  Eye,
  FileText,
  User,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Briefcase
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Available CC recipients
const CC_OPTIONS = [
  { value: 'careers@theroofdocs.com', label: 'Careers' },
  { value: 'support@theroofdocs.com', label: 'Support' },
  { value: 'info@theroofdocs.com', label: 'Info' },
];

interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position: string;
}

interface EmailTemplateGeneratorProps {
  candidate?: Candidate;
  onSendEmail?: (emailData: {
    to: string;
    cc?: string[];
    subject: string;
    body: string;
    templateType: string;
  }) => void;
}

interface EmailTemplate {
  type: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  icon: any;
  color: string;
}

export function EmailTemplateGenerator({ candidate, onSendEmail }: EmailTemplateGeneratorProps) {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [customSubject, setCustomSubject] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [recipientEmail, setRecipientEmail] = useState(candidate?.email || '');
  const [recipientName, setRecipientName] = useState(candidate ? `${candidate.firstName} ${candidate.lastName}` : '');
  const [position, setPosition] = useState(candidate?.position || '');
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewTime, setInterviewTime] = useState('');
  const [companyName, setCompanyName] = useState('ROOF-ER');
  const [recruiterName, setRecruiterName] = useState('Hiring Team');
  const [ccRecipients, setCcRecipients] = useState<string[]>([]);

  const emailTemplates: EmailTemplate[] = [
    {
      type: 'application_received',
      name: 'Application Received',
      subject: 'Thank you for your application - {position} at {company}',
      body: `Dear {candidateName},

Thank you for your interest in the {position} position at {company}. We have received your application and are currently reviewing it.

Our hiring team will carefully evaluate your qualifications and experience. If your background aligns with our requirements, we will contact you within 5-7 business days to discuss the next steps.

We appreciate the time you took to apply and look forward to potentially working with you.

Best regards,
{recruiterName}
{company} Hiring Team`,
      variables: ['candidateName', 'position', 'company', 'recruiterName'],
      icon: FileText,
      color: 'bg-blue-100 text-blue-800'
    },
    {
      type: 'screening_invitation',
      name: 'Phone Screening Invitation',
      subject: 'Next Steps: Phone Screening for {position} Position',
      body: `Dear {candidateName},

Thank you for your application for the {position} position at {company}. We were impressed with your background and would like to move forward with a phone screening interview.

Please let us know your availability for a 30-minute phone call during the following times:
- Option 1: [Date and Time]
- Option 2: [Date and Time]
- Option 3: [Date and Time]

During this call, we'll discuss your experience, the role requirements, and answer any questions you may have about {company} and the position.

Please reply with your preferred time slot, and we'll send you a calendar invitation with the call details.

Looking forward to speaking with you!

Best regards,
{recruiterName}
{company} Hiring Team`,
      variables: ['candidateName', 'position', 'company', 'recruiterName'],
      icon: User,
      color: 'bg-yellow-100 text-yellow-800'
    },
    {
      type: 'interview_invitation',
      name: 'Interview Invitation',
      subject: 'Interview Invitation - {position} at {company}',
      body: `Dear {candidateName},

We were impressed with our initial conversation and would like to invite you for an in-person interview for the {position} position at {company}.

Interview Details:
📅 Date: {interviewDate}
🕐 Time: {interviewTime}
📍 Location: ROOF-ER Office, [Address]
⏱️ Duration: Approximately 60 minutes

During the interview, you'll meet with our hiring manager and team members. We'll discuss your experience in detail, share more about the role and our company culture, and answer any questions you have.

Please bring:
- A copy of your resume
- Any relevant work samples or certifications
- A list of references

If you need to reschedule or have any questions, please don't hesitate to reach out.

We look forward to meeting you in person!

Best regards,
{recruiterName}
{company} Hiring Team`,
      variables: ['candidateName', 'position', 'company', 'recruiterName', 'interviewDate', 'interviewTime'],
      icon: Calendar,
      color: 'bg-purple-100 text-purple-800'
    },
    {
      type: 'offer_letter',
      name: 'Job Offer',
      subject: 'Job Offer - {position} at {company}',
      body: `Dear {candidateName},

Congratulations! We are pleased to extend an offer for the {position} position at {company}.

After careful consideration of your qualifications, experience, and our conversations during the interview process, we believe you would be an excellent addition to our team.

This offer includes:
• Competitive salary and benefits package
• Comprehensive health insurance
• Paid time off and holidays
• Professional development opportunities
• Supportive team environment

We will send the detailed offer letter with compensation details via separate email for your review.

Please let us know if you accept this offer by [Date]. We're excited about the possibility of you joining our team and contributing to our continued success.

If you have any questions about the offer or need clarification on any details, please don't hesitate to reach out.

Welcome to the {company} family!

Best regards,
{recruiterName}
{company} Hiring Team`,
      variables: ['candidateName', 'position', 'company', 'recruiterName'],
      icon: CheckCircle,
      color: 'bg-green-100 text-green-800'
    },
    {
      type: 'rejection_letter',
      name: 'Application Update',
      subject: 'Update on your application - {position} at {company}',
      body: `Dear {candidateName},

Thank you for your interest in the {position} position at {company} and for taking the time to interview with our team.

We were impressed with your qualifications and enjoyed learning about your experience. After careful consideration, we have decided to move forward with another candidate whose background more closely aligns with our current needs.

This was a difficult decision, as we had many qualified applicants. We encourage you to apply for future opportunities that match your skills and interests, as we would welcome the chance to consider you again.

We appreciate the time and effort you invested in our interview process and wish you all the best in your job search.

Best regards,
{recruiterName}
{company} Hiring Team`,
      variables: ['candidateName', 'position', 'company', 'recruiterName'],
      icon: XCircle,
      color: 'bg-red-100 text-red-800'
    },
    {
      type: 'follow_up',
      name: 'Follow-up Email',
      subject: 'Following up on your application - {position}',
      body: `Dear {candidateName},

I hope this email finds you well. I wanted to follow up on your application for the {position} position at {company}.

We are still in the process of reviewing applications and conducting interviews. Your background and experience caught our attention, and we want to ensure we give all candidates fair consideration.

We expect to make a decision within the next [timeframe] and will keep you updated on our progress. In the meantime, please feel free to reach out if you have any questions about the role or our company.

Thank you for your patience and continued interest in {company}.

Best regards,
{recruiterName}
{company} Hiring Team`,
      variables: ['candidateName', 'position', 'company', 'recruiterName'],
      icon: Clock,
      color: 'bg-gray-100 text-gray-800'
    }
  ];

  const generateEmail = (template: EmailTemplate) => {
    let subject = template.subject;
    let body = template.body;

    // Replace variables with actual values
    const replacements = {
      candidateName: recipientName,
      position: position,
      company: companyName,
      recruiterName: recruiterName,
      interviewDate: interviewDate,
      interviewTime: interviewTime
    };

    Object.entries(replacements).forEach(([variable, value]) => {
      const regex = new RegExp(`{${variable}}`, 'g');
      subject = subject.replace(regex, value);
      body = body.replace(regex, value);
    });

    setCustomSubject(subject);
    setCustomBody(body);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Email content copied to clipboard',
    });
  };

  const sendEmail = () => {
    if (!recipientEmail || !customSubject || !customBody) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    if (onSendEmail) {
      onSendEmail({
        to: recipientEmail,
        cc: ccRecipients.length > 0 ? ccRecipients : undefined,
        subject: customSubject,
        body: customBody,
        templateType: selectedTemplate
      });
    }

    toast({
      title: 'Email Sent',
      description: `Email sent successfully to ${recipientEmail}${ccRecipients.length > 0 ? ` (CC: ${ccRecipients.length} recipients)` : ''}`,
    });
  };

  const toggleCcRecipient = (email: string) => {
    setCcRecipients(prev =>
      prev.includes(email)
        ? prev.filter(e => e !== email)
        : [...prev, email]
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Template Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Recipient Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="recipientEmail">Recipient Email *</Label>
              <Input
                id="recipientEmail"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="candidate@example.com"
              />
            </div>
            <div>
              <Label htmlFor="recipientName">Candidate Name *</Label>
              <Input
                id="recipientName"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label htmlFor="position">Position *</Label>
              <Input
                id="position"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="Field Worker"
              />
            </div>
            <div>
              <Label htmlFor="recruiterName">Your Name</Label>
              <Input
                id="recruiterName"
                value={recruiterName}
                onChange={(e) => setRecruiterName(e.target.value)}
                placeholder="Hiring Team"
              />
            </div>
          </div>

          {/* CC Recipients */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <Label className="text-sm font-medium mb-2 block">CC Recipients (Optional)</Label>
            <div className="flex flex-wrap gap-4">
              {CC_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={ccRecipients.includes(option.value)}
                    onCheckedChange={() => toggleCcRecipient(option.value)}
                  />
                  <span className="text-sm">{option.label}</span>
                  <span className="text-xs text-gray-500">({option.value})</span>
                </label>
              ))}
            </div>
            {ccRecipients.length > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                Selected: {ccRecipients.join(', ')}
              </p>
            )}
          </div>

          {/* Interview Details (for interview templates) */}
          {selectedTemplate === 'interview_invitation' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-purple-50 rounded-lg">
              <div>
                <Label htmlFor="interviewDate">Interview Date</Label>
                <Input
                  id="interviewDate"
                  type="date"
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="interviewTime">Interview Time</Label>
                <Input
                  id="interviewTime"
                  type="time"
                  value={interviewTime}
                  onChange={(e) => setInterviewTime(e.target.value)}
                />
              </div>
            </div>
          )}

          <Separator />

          {/* Template Selection */}
          <div>
            <Label className="text-base font-medium mb-3 block">Select Email Template</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {emailTemplates.map((template) => {
                const IconComponent = template.icon;
                return (
                  <Card
                    key={template.type}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedTemplate === template.type ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                    }`}
                    onClick={() => {
                      setSelectedTemplate(template.type);
                      generateEmail(template);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${template.color}`}>
                          <IconComponent className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="font-medium text-sm">{template.name}</h3>
                          <p className="text-xs text-gray-600 mt-1">
                            {template.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Email Composition */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="subject">Email Subject</Label>
              <Input
                id="subject"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                placeholder="Email subject line"
              />
            </div>
            
            <div>
              <Label htmlFor="body">Email Body</Label>
              <Textarea
                id="body"
                value={customBody}
                onChange={(e) => setCustomBody(e.target.value)}
                placeholder="Email content"
                className="min-h-[300px]"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => copyToClipboard(`Subject: ${customSubject}\n\n${customBody}`)}
              disabled={!customSubject || !customBody}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
            <Button
              onClick={sendEmail}
              disabled={!recipientEmail || !customSubject || !customBody}
            >
              <Send className="h-4 w-4 mr-2" />
              Send Email
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}