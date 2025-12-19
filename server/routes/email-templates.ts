import express from 'express';
import { storage } from '../storage';
import { z } from 'zod';

const router = express.Router();

// Middleware
function requireAuth(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function requireManager(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Ahmed always has manager access (super admin email fallback)
  if (req.user.email === 'ahmed.mahmoud@theroofdocs.com') {
    return next();
  }

  const managerRoles = [
    'SYSTEM_ADMIN', 'HR_ADMIN', 'GENERAL_MANAGER', 'TERRITORY_MANAGER', 'MANAGER',
    'TRUE_ADMIN', 'ADMIN', 'TERRITORY_SALES_MANAGER', 'HR'
  ];

  if (!managerRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Manager or HR access required' });
  }
  next();
}

// Schema for email templates
const createEmailTemplateSchema = z.object({
  name: z.string(),
  subject: z.string(),
  body: z.string(),
  category: z.enum(['INTERVIEW', 'OFFER', 'REJECTION', 'ONBOARDING', 'GENERAL', 'FOLLOW_UP']),
  variables: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
});

const updateEmailTemplateSchema = createEmailTemplateSchema.partial();

// Get all email templates
router.get('/api/email-templates', requireAuth, async (req, res) => {
  try {
    const templates = await storage.getAllEmailTemplates();
    res.json(templates);
  } catch (error) {
    console.error('Error fetching email templates:', error);
    res.status(500).json({ error: 'Failed to fetch email templates' });
  }
});

// Get template by ID
router.get('/api/email-templates/:id', requireAuth, async (req, res) => {
  try {
    const template = await storage.getEmailTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template);
  } catch (error) {
    console.error('Error fetching email template:', error);
    res.status(500).json({ error: 'Failed to fetch email template' });
  }
});

// Create new email template
router.post('/api/email-templates', requireManager, async (req, res) => {
  try {
    const user = req.user!;
    const data = createEmailTemplateSchema.parse(req.body);
    const template = await storage.createEmailTemplate({
      ...data,
      type: data.category || 'GENERAL', // Add type field for compatibility
      createdBy: user.id,
    });
    res.json(template);
  } catch (error) {
    console.error('Error creating email template:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid template data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create email template' });
  }
});

// Update email template
router.patch('/api/email-templates/:id', requireManager, async (req, res) => {
  try {
    const user = req.user!;
    const data = updateEmailTemplateSchema.parse(req.body);
    const template = await storage.updateEmailTemplate(req.params.id, {
      ...data,
      updatedBy: user.id,
      updatedAt: new Date().toISOString(),
    });
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template);
  } catch (error) {
    console.error('Error updating email template:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid template data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update email template' });
  }
});

// Delete email template
router.delete('/api/email-templates/:id', requireManager, async (req, res) => {
  try {
    await storage.deleteEmailTemplate(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting email template:', error);
    res.status(500).json({ error: 'Failed to delete email template' });
  }
});

// Preview template with variables
router.post('/api/email-templates/:id/preview', requireAuth, async (req, res) => {
  try {
    const template = await storage.getEmailTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const { variables } = req.body;
    let subject = template.subject;
    let body = template.body;

    // Replace variables in template
    if (variables) {
      Object.keys(variables).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        subject = subject.replace(regex, variables[key]);
        body = body.replace(regex, variables[key]);
      });
    }

    res.json({
      subject,
      body,
      originalTemplate: template.name,
    });
  } catch (error) {
    console.error('Error previewing email template:', error);
    res.status(500).json({ error: 'Failed to preview email template' });
  }
});

// Send email using template
router.post('/api/email-templates/:id/send', requireAuth, async (req, res) => {
  try {
    const { to, variables, cc, bcc } = req.body;
    
    if (!to) {
      return res.status(400).json({ error: 'Recipient email is required' });
    }

    const template = await storage.getEmailTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    let subject = template.subject;
    let body = template.body;

    // Replace variables
    if (variables) {
      Object.keys(variables).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        subject = subject.replace(regex, variables[key]);
        body = body.replace(regex, variables[key]);
      });
    }

    // Send email using email service
    const { emailService } = await import('../email-service');
    const success = await emailService.sendEmail({
      to,
      subject,
      html: body,
    });

    if (success) {
      // Log email sent
      const user = req.user!;
      await storage.createEmailLog({
        templateId: template.id,
        recipientEmail: to,
        subject,
        body,
        status: 'SENT',
        sentAt: new Date().toISOString(),
        sentBy: user.id,
      });

      res.json({
        success: true,
        message: 'Email sent successfully',
        details: {
          template: template.name,
          to,
          subject,
        },
      });
    } else {
      res.status(500).json({ error: 'Failed to send email' });
    }
  } catch (error) {
    console.error('Error sending email from template:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

export default router;