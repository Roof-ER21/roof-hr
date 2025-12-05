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

// Schema for creating email campaigns
const createEmailCampaignSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  type: z.enum(['ONBOARDING', 'NURTURE', 'FOLLOW_UP', 'REJECTION', 'OFFER', 'GENERAL']),
  targetAudience: z.enum(['ALL_CANDIDATES', 'SPECIFIC_STAGE', 'CUSTOM']),
  stageFilter: z.string().optional(),
});

// Email Campaigns Routes
router.get('/api/email-campaigns', requireAuth, async (req: any, res) => {
  try {
    const campaigns = await storage.getAllEmailCampaigns();
    res.json(campaigns);
  } catch (error) {
    console.error('Error fetching email campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch email campaigns' });
  }
});

router.post('/api/email-campaigns', requireAuth, async (req: any, res) => {
  try {
    const data = createEmailCampaignSchema.parse(req.body);
    const campaign = await storage.createEmailCampaign({
      ...data,
      status: 'DRAFT',
      totalRecipients: 0,
      sentCount: 0,
      openCount: 0,
      clickCount: 0,
      responseCount: 0,
      createdBy: req.user.id,
    });
    res.json(campaign);
  } catch (error) {
    console.error('Error creating email campaign:', error);
    res.status(400).json({ error: error instanceof z.ZodError ? error.errors : 'Failed to create email campaign' });
  }
});

router.patch('/api/email-campaigns/:id/status', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const campaign = await storage.updateEmailCampaign(id, { status });
    res.json(campaign);
  } catch (error) {
    console.error('Error updating campaign status:', error);
    res.status(500).json({ error: 'Failed to update campaign status' });
  }
});

router.get('/api/email-campaigns/:id/steps', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const steps = await storage.getCampaignStepsByCampaignId(id);
    res.json(steps);
  } catch (error) {
    console.error('Error fetching campaign steps:', error);
    res.status(500).json({ error: 'Failed to fetch campaign steps' });
  }
});

// SMS Messages Routes
router.get('/api/sms-messages', requireAuth, async (req: any, res) => {
  try {
    const messages = await storage.getAllSmsMessages();
    res.json(messages);
  } catch (error) {
    console.error('Error fetching SMS messages:', error);
    res.status(500).json({ error: 'Failed to fetch SMS messages' });
  }
});

router.post('/api/sms-messages', requireAuth, async (req: any, res) => {
  try {
    const { candidateId, recipientPhone, message, type } = req.body;
    
    if (!recipientPhone || !message || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const smsMessage = await storage.createSmsMessage({
      candidateId,
      recipientPhone,
      message,
      type,
      status: 'PENDING',
      createdBy: req.user.id,
    });
    
    // TODO: Integrate with Twilio to actually send the SMS
    // For now, just mark it as sent
    await storage.updateSmsMessage(smsMessage.id, {
      status: 'SENT',
      sentAt: new Date(),
    });
    
    res.json(smsMessage);
  } catch (error) {
    console.error('Error sending SMS:', error);
    res.status(500).json({ error: 'Failed to send SMS' });
  }
});

// Communication Preferences Routes
router.get('/api/communication-preferences', requireAuth, async (req: any, res) => {
  try {
    const preferences = await storage.getAllCommunicationPreferences();
    res.json(preferences);
  } catch (error) {
    console.error('Error fetching communication preferences:', error);
    res.status(500).json({ error: 'Failed to fetch communication preferences' });
  }
});

router.patch('/api/communication-preferences/:candidateId', requireAuth, async (req: any, res) => {
  try {
    const { candidateId } = req.params;
    const data = req.body;
    
    // Check if preference exists
    let preference = await storage.getCommunicationPreferenceByCandidateId(candidateId);
    
    if (preference) {
      preference = await storage.updateCommunicationPreference(preference.id, data);
    } else {
      preference = await storage.createCommunicationPreference({
        candidateId,
        emailEnabled: data.emailEnabled ?? true,
        smsEnabled: data.smsEnabled ?? false,
        preferredChannel: data.preferredChannel ?? 'EMAIL',
        unsubscribedEmail: false,
        unsubscribedSms: false,
        timezone: data.timezone ?? 'America/New_York',
        bestTimeToContact: data.bestTimeToContact,
      });
    }
    
    res.json(preference);
  } catch (error) {
    console.error('Error updating communication preferences:', error);
    res.status(500).json({ error: 'Failed to update communication preferences' });
  }
});

// AI Email Generation
router.post('/api/ai/generate-email', requireAuth, async (req: any, res) => {
  try {
    const { prompt, candidateId } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    // TODO: Integrate with OpenAI to generate email content
    // For now, return a mock response
    const generatedContent = {
      subject: 'Follow-up on Your Application',
      content: `Dear Candidate,\n\nThank you for your interest in our position. ${prompt}\n\nBest regards,\nThe Recruitment Team`,
    };
    
    // Save the generation
    const generation = await storage.createAiEmailGeneration({
      candidateId,
      templateType: 'FOLLOW_UP',
      prompt,
      generatedSubject: generatedContent.subject,
      generatedContent: generatedContent.content,
      model: 'gpt-4',
      approved: false,
      usedInCampaign: false,
      createdBy: req.user.id,
    });
    
    res.json({
      ...generation,
      subject: generatedContent.subject,
      content: generatedContent.content,
    });
  } catch (error) {
    console.error('Error generating AI email:', error);
    res.status(500).json({ error: 'Failed to generate AI email' });
  }
});

export default router;