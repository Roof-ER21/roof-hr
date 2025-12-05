import express from 'express';
import { z } from 'zod';
import { llmRouter } from '../services/llm/router';
import type { LLMTaskContext } from '../services/llm/types';

const router = express.Router();

// Middleware for authentication
function requireAuth(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Schema for AI generation request
const aiGenerateSchema = z.object({
  category: z.enum(['INTERVIEW', 'OFFER', 'REJECTION', 'ONBOARDING', 'GENERAL', 'FOLLOW_UP']),
  name: z.string(),
  subject: z.string().optional(),
  context: z.string().optional(),
});

// Generate email content with AI
router.post('/api/email-templates/ai-generate', requireAuth, async (req, res) => {
  try {
    const data = aiGenerateSchema.parse(req.body);

    // Create a contextual prompt based on category
    const prompt = `You are an HR professional writing an email template for a roofing company called ROOF-ER.
    Create a professional email template for the following:

    Category: ${data.category}
    Template Name: ${data.name}
    ${data.subject ? `Current Subject: ${data.subject}` : ''}
    ${data.context ? `Additional Context: ${data.context}` : ''}

    Please provide:
    1. A compelling subject line
    2. A professional email body

    Use {{variableName}} syntax for any dynamic content that should be personalized.
    Common variables to consider: {{candidateName}}, {{position}}, {{companyName}}, {{startDate}}, {{managerName}}, {{interviewDate}}, {{interviewTime}}, {{location}}

    The tone should be professional yet friendly, reflecting ROOF-ER's company culture.

    Return the response in JSON format:
    {
      "subject": "email subject line",
      "body": "email body content with HTML formatting"
    }`;

    const taskContext: LLMTaskContext = {
      taskType: 'generation',
      priority: 'medium',
      requiresPrivacy: false,
      expectedResponseTime: 'normal'
    };

    const { data: result, provider } = await llmRouter.generateJSON(prompt, taskContext);

    console.log(`[Email AI] Generated email template using ${provider}`);

    res.json({
      subject: result.subject || '',
      body: result.body || '',
    });
  } catch (error) {
    console.error('Error generating email with AI:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    res.status(500).json({
      error: 'Failed to generate email content',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Improve email content with AI
router.post('/api/email-templates/ai-improve', requireAuth, async (req, res) => {
  try {
    const { subject, body, category } = req.body;

    const prompt = `You are an HR professional. Please improve the following email template to make it more professional, engaging, and effective:

    Category: ${category}
    Current Subject: ${subject}
    Current Body: ${body}

    Improve the email by:
    1. Making the subject line more compelling
    2. Enhancing the body content for better engagement
    3. Ensuring proper formatting and structure
    4. Maintaining any {{variable}} placeholders

    Return the improved version in JSON format:
    {
      "subject": "improved subject line",
      "body": "improved body content with HTML formatting"
    }`;

    const taskContext: LLMTaskContext = {
      taskType: 'generation',
      priority: 'medium',
      requiresPrivacy: false,
      expectedResponseTime: 'normal'
    };

    const { data: result, provider } = await llmRouter.generateJSON(prompt, taskContext);

    console.log(`[Email AI] Improved email template using ${provider}`);

    res.json({
      subject: result.subject || subject,
      body: result.body || body,
    });
  } catch (error) {
    console.error('Error improving email with AI:', error);
    res.status(500).json({
      error: 'Failed to improve email content',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Generate email variations
router.post('/api/email-templates/ai-variations', requireAuth, async (req, res) => {
  try {
    const { subject, body, category, count = 3 } = req.body;

    const prompt = `You are an HR professional. Create ${count} variations of the following email template:

    Category: ${category}
    Original Subject: ${subject}
    Original Body: ${body}

    Create ${count} different versions with varying tones and approaches while maintaining professionalism.
    Keep any {{variable}} placeholders intact.

    Return the variations in JSON format:
    {
      "variations": [
        {
          "subject": "variation 1 subject",
          "body": "variation 1 body",
          "tone": "description of tone/approach"
        }
      ]
    }`;

    const taskContext: LLMTaskContext = {
      taskType: 'generation',
      priority: 'medium',
      requiresPrivacy: false,
      expectedResponseTime: 'normal'
    };

    const { data: result, provider } = await llmRouter.generateJSON(prompt, taskContext);

    console.log(`[Email AI] Generated ${count} email variations using ${provider}`);

    res.json(result);
  } catch (error) {
    console.error('Error generating variations with AI:', error);
    res.status(500).json({
      error: 'Failed to generate email variations',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
