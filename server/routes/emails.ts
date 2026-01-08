import { Router } from 'express';
import { z } from 'zod';
import { MailService } from '@sendgrid/mail';
import { gmailService } from '../services/gmail-service';
import { EmailService } from '../email-service';
import { contractPdfService } from '../services/contractPdfService';
import fs from 'fs/promises';
import path from 'path';

const router = Router();

// Initialize Gmail service on first use
let gmailInitialized = false;
async function ensureGmailInitialized() {
  if (!gmailInitialized && gmailService.isConfigured()) {
    try {
      await gmailService.initialize();
      gmailInitialized = true;
    } catch (error) {
      console.error('[Gmail] Failed to initialize:', error);
    }
  }
}

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

const sendEmailWithAttachmentsSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  templateType: z.string().optional(),
  attachments: z.array(z.object({
    filename: z.string().min(1),
    contentBase64: z.string().min(1),
    contentType: z.string().optional()
  })).min(1),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional()
});

const sendContractTestSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  cc: z.array(z.string().email()).optional(),
  contractorName: z.string().optional(),
  effectiveDate: z.string().optional(),
  signatureName: z.string().optional(),
  signatureDate: z.string().optional(),
  templates: z.array(z.object({
    label: z.string().min(1),
    fileName: z.string().min(1),
  })).optional(),
});

// Send email endpoint
router.post('/send', async (req, res) => {
  try {
    const { to, subject, body, templateType } = sendEmailSchema.parse(req.body);

    // Try Gmail first if configured (using service account with impersonation)
    await ensureGmailInitialized();
    if (gmailInitialized) {
      try {
        await gmailService.sendEmail({
          to,
          subject,
          text: body,
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

// Send email with attachments (uses EmailService for reliable attachments)
router.post('/send-with-attachments', async (req, res) => {
  try {
    const { to, subject, body, attachments, cc } = sendEmailWithAttachmentsSchema.parse(req.body);

    const emailService = new EmailService();
    await emailService.initialize();

    const normalizedAttachments = attachments.map((attachment) => ({
      filename: attachment.filename,
      content: Buffer.from(attachment.contentBase64, 'base64'),
      contentType: attachment.contentType || 'application/octet-stream'
    }));

    await emailService.sendEmail({
      to,
      cc,
      subject,
      html: body.replace(/\n/g, '<br>'),
      attachments: normalizedAttachments
    });

    res.json({
      success: true,
      message: 'Email sent successfully with attachments'
    });
  } catch (error) {
    console.error('[EMAIL ATTACHMENTS ERROR]', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid email data',
        details: error.errors
      });
    }

    res.status(500).json({
      error: 'Failed to send email with attachments',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Send contract test email with generated PDF attachments
router.post('/send-contract-test', async (req, res) => {
  try {
    const data = sendContractTestSchema.parse(req.body);
    const emailService = new EmailService();
    await emailService.initialize();

    const templateDir = contractPdfService.getTemplatesDir();
    const today = new Date().toLocaleDateString();
    const contractValues: Record<string, string> = {
      contractorName: data.contractorName || 'Test Candidate',
      effectiveDate: data.effectiveDate || today,
      signatureDate: data.signatureDate || today,
    };
    if (data.signatureName) {
      contractValues.signatureName = data.signatureName;
    }

    const templates = data.templates?.length
      ? data.templates
      : [
          { label: 'Richmond', fileName: 'richmond_contract_with_commission_addendum.pdf' },
          { label: 'DMV', fileName: 'dmv_contract_with_commission_addendum.pdf' },
          { label: 'PA', fileName: 'pa_contract_with_commission_addendum.pdf' },
        ];

    const attachments = [];
    for (const template of templates) {
      const outputFileName = `test_${template.label.toLowerCase()}_${Date.now()}.pdf`;
      await contractPdfService.generateContract(
        template.fileName,
        contractValues,
        outputFileName
      );
      const outputPath = path.join(templateDir, outputFileName);
      const content = await fs.readFile(outputPath);
      attachments.push({
        filename: `${template.label} Contractor Agreement.pdf`,
        content,
        contentType: 'application/pdf',
      });
    }

    await emailService.sendEmail({
      to: data.to,
      cc: data.cc,
      subject: data.subject,
      html: data.body.replace(/\n/g, '<br>'),
      attachments,
    });

    res.json({ success: true, message: 'Contract test email sent successfully' });
  } catch (error) {
    console.error('[CONTRACT TEST EMAIL ERROR]', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid email data',
        details: error.errors
      });
    }

    res.status(500).json({
      error: 'Failed to send contract test email',
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
