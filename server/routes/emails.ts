import { Router } from 'express';
import { z } from 'zod';
import { MailService } from '@sendgrid/mail';
import { gmailService } from '../services/gmail';

const router = Router();

// Initialize SendGrid (only if API key is available)
let mailService: MailService | null = null;
if (process.env.SENDGRID_API_KEY) {
  mailService = new MailService();
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
}

const sendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  templateType: z.string()
});

// Send email endpoint
router.post('/send', async (req, res) => {
  try {
    const { to, subject, body, templateType } = sendEmailSchema.parse(req.body);

    // Try Gmail first if configured
    if (gmailService.isConfigured()) {
      try {
        await gmailService.sendEmail({
          to,
          subject,
          body,
          html: body.replace(/\n/g, '<br>')
        });
        
        console.log('[GMAIL SENT] Successfully sent email to:', to);
        
        return res.json({ 
          success: true, 
          message: 'Email sent successfully via Gmail',
          emailId: `gmail_${Date.now()}`
        });
      } catch (gmailError) {
        console.error('[GMAIL ERROR] Failed to send via Gmail:', gmailError);
        // Fall through to try SendGrid
      }
    }

    // Try SendGrid if Gmail is not configured or failed
    if (mailService && process.env.SENDGRID_API_KEY) {
      const msg = {
        to,
        from: process.env.FROM_EMAIL || 'noreply@roof-er.com',
        subject,
        text: body,
        html: body.replace(/\n/g, '<br>')
      };

      await mailService.send(msg);

      console.log('[SENDGRID SENT] Successfully sent email to:', to);
      
      return res.json({ 
        success: true, 
        message: 'Email sent successfully via SendGrid',
        emailId: `sg_${Date.now()}`
      });
    }

    // If neither service is configured, return demo mode
    console.log('[EMAIL DEMO] Would send email:', {
      to,
      subject,
      templateType,
      bodyPreview: body.substring(0, 100) + '...'
    });
    
    res.json({ 
      success: true, 
      message: 'Email sent successfully (demo mode - configure Gmail or SendGrid for actual sending)',
      emailId: `demo_${Date.now()}`
    });

  } catch (error) {
    console.error('[EMAIL ERROR]', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid email data', 
        details: error.errors 
      });
    }

    res.status(500).json({ 
      error: 'Failed to send email',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get email templates
router.get('/templates', (req, res) => {
  const templates = [
    {
      type: 'application_received',
      name: 'Application Received',
      category: 'acknowledgment'
    },
    {
      type: 'screening_invitation',
      name: 'Phone Screening Invitation',
      category: 'interview'
    },
    {
      type: 'interview_invitation',
      name: 'Interview Invitation',
      category: 'interview'
    },
    {
      type: 'offer_letter',
      name: 'Job Offer',
      category: 'offer'
    },
    {
      type: 'rejection_letter',
      name: 'Application Update',
      category: 'rejection'
    },
    {
      type: 'follow_up',
      name: 'Follow-up Email',
      category: 'follow_up'
    }
  ];

  res.json(templates);
});

export default router;