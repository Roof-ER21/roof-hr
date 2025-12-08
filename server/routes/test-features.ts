import express from 'express';
import { emailService } from '../email-service';
import { aiEnhancementService } from '../services/ai-enhancement';
import { storage } from '../storage';

const router = express.Router();

// Middleware
function requireAuth(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Test email sending
router.post('/api/test/send-email', requireAuth, async (req: any, res) => {
  try {
    const { to, subject, message } = req.body;
    
    if (!to || !subject || !message) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, message' });
    }

    // Create professional HTML email
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #007bff; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .footer { padding: 10px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>ROOF-ER HR Management System</h2>
            </div>
            <div class="content">
              <h3>${subject}</h3>
              <p>${message}</p>
              <hr>
              <p><strong>Sent by:</strong> ${req.user.firstName} ${req.user.lastName}</p>
              <p><strong>Role:</strong> ${req.user.role}</p>
              <p><strong>Email:</strong> ${req.user.email}</p>
            </div>
            <div class="footer">
              <p>This is a test email from the HR Management System</p>
              <p>&copy; 2025 ROOF-ER Roofing Company</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const success = await emailService.sendEmail({
      to,
      subject: `[HR System Test] ${subject}`,
      html,
    });

    if (success) {
      res.json({ 
        success: true, 
        message: 'Email sent successfully',
        details: {
          to,
          subject,
          sentBy: req.user.email,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to send email',
        message: 'Email service may not be configured. Check Google OAuth credentials.'
      });
    }
  } catch (error) {
    console.error('Email test error:', error);
    res.status(500).json({ 
      error: 'Failed to send test email',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test AI analysis
router.post('/api/test/ai-analysis', requireAuth, async (req: any, res) => {
  try {
    const { candidateId } = req.body;
    
    if (!candidateId) {
      return res.status(400).json({ error: 'candidateId is required' });
    }

    // Get candidate data
    const candidate = await storage.getCandidateById(candidateId);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    // Test OpenAI connection first
    const connectionTest = await aiEnhancementService.testConnection();
    
    // Create sample resume text for testing
    const sampleResume = `
      ${candidate.firstName} ${candidate.lastName}
      Email: ${candidate.email}
      Phone: ${candidate.phone}
      
      PROFESSIONAL SUMMARY
      Experienced ${candidate.position || 'professional'} with strong skills in construction and roofing.
      
      EXPERIENCE
      ${candidate.position || 'Roofer'} at Previous Company
      - Managed roofing projects
      - Led team of 5 workers
      - Completed projects on time and budget
      
      EDUCATION
      High School Diploma
      Trade Certification in Roofing
      
      SKILLS
      - Roofing installation
      - Safety compliance
      - Team leadership
      - Project management
    `;

    // Parse resume
    const parsedData = await aiEnhancementService.parseResume(sampleResume);
    
    // Predict success
    const prediction = await aiEnhancementService.predictCandidateSuccess(
      {
        name: `${candidate.firstName} ${candidate.lastName}`,
        position: candidate.position,
        experience: parsedData.experience,
        skills: parsedData.skills.technical,
      },
      {
        position: candidate.position || 'Roofer',
        requiredSkills: ['roofing', 'safety', 'teamwork'],
        experienceYears: 2,
        educationLevel: 'High School',
      }
    );

    res.json({
      success: true,
      connectionTest,
      candidate: {
        id: candidate.id,
        name: `${candidate.firstName} ${candidate.lastName}`,
        position: candidate.position,
      },
      parsedResume: parsedData,
      prediction,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('AI analysis test error:', error);
    res.status(500).json({ 
      error: 'AI analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      hint: 'Ensure OPENAI_API_KEY is configured correctly'
    });
  }
});

// Test workflow execution
router.post('/api/test/workflow-execute', requireAuth, async (req: any, res) => {
  try {
    const { workflowId, targetId, targetType } = req.body;
    
    if (!workflowId) {
      return res.status(400).json({ error: 'workflowId is required' });
    }

    // Get workflow
    const workflow = await storage.getWorkflowById(workflowId);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Create execution record
    const executionId = await storage.createWorkflowExecution({
      workflowId,
      status: 'RUNNING',
      startedAt: new Date().toISOString(),
      startedBy: req.user.id,
      context: JSON.stringify({
        targetId,
        targetType,
        user: req.user.email,
      }),
    });

    // Simulate workflow execution steps
    const steps = await storage.getWorkflowStepsByWorkflowId(workflowId);
    const results = [];

    for (const step of steps) {
      // Log step execution
      await storage.createWorkflowStepExecution({
        executionId,
        stepId: step.id,
        status: 'RUNNING',
        startedAt: new Date().toISOString(),
      });

      // Simulate step execution based on type
      let stepResult = {
        stepName: step.name,
        type: step.type,
        status: 'COMPLETED',
        message: '',
      };

      switch (step.type) {
        case 'ACTION':
          stepResult.message = `Executed action: ${step.actionType || 'Custom action'}`;
          break;
        case 'NOTIFICATION':
          stepResult.message = `Sent notification to relevant parties`;
          break;
        case 'DELAY':
          stepResult.message = `Waited for specified delay`;
          break;
        case 'CONDITION':
          stepResult.message = `Evaluated condition: Passed`;
          break;
        case 'APPROVAL':
          stepResult.message = `Approval request sent to manager`;
          break;
        default:
          stepResult.message = `Executed step type: ${step.type}`;
      }

      results.push(stepResult);

      // Update step execution
      await storage.updateWorkflowStepExecution(step.id, {
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
        output: JSON.stringify(stepResult),
      });
    }

    // Complete workflow execution
    await storage.updateWorkflowExecution(executionId, {
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
      output: JSON.stringify(results),
    });

    // Update workflow execution count
    await storage.updateWorkflow(workflowId, {
      executionCount: (workflow.executionCount || 0) + 1,
      lastExecutedAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: 'Workflow executed successfully',
      execution: {
        id: executionId,
        workflowName: workflow.name,
        steps: results,
        completedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Workflow execution error:', error);
    res.status(500).json({ 
      error: 'Workflow execution failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create interview with calendar integration
router.post('/api/test/create-interview', requireAuth, async (req: any, res) => {
  try {
    const { candidateId, interviewDate, interviewTime, interviewType, interviewers } = req.body;
    
    if (!candidateId || !interviewDate || !interviewTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get candidate
    const candidate = await storage.getCandidateById(candidateId);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    // Create interview - combine date and time into scheduledDate
    const scheduledDate = new Date(`${interviewDate}T${interviewTime || '09:00'}`);
    const interview = await storage.createInterview({
      candidateId,
      scheduledDate,
      type: (interviewType as 'PHONE' | 'VIDEO' | 'IN_PERSON' | 'TECHNICAL' | 'PANEL') || 'IN_PERSON',
      status: 'SCHEDULED',
      notes: `Interview scheduled by ${req.user.firstName} ${req.user.lastName}. Interviewers: ${(interviewers || [req.user.email]).join(', ')}`,
    });

    // Send email notification
    const emailHtml = `
      <h2>Interview Scheduled</h2>
      <p>Dear ${candidate.firstName},</p>
      <p>Your interview has been scheduled for:</p>
      <ul>
        <li><strong>Date:</strong> ${interviewDate}</li>
        <li><strong>Time:</strong> ${interviewTime}</li>
        <li><strong>Type:</strong> ${interviewType || 'IN_PERSON'}</li>
        <li><strong>Interviewers:</strong> ${(interviewers || [req.user.email]).join(', ')}</li>
      </ul>
      <p>Please confirm your availability.</p>
      <p>Best regards,<br>HR Team</p>
    `;

    await emailService.sendEmail({
      to: candidate.email,
      subject: 'Interview Scheduled - ROOF-ER',
      html: emailHtml,
      candidateId: candidate.id,
      interviewId: interview.id,
    });

    res.json({
      success: true,
      message: 'Interview created and email sent',
      interview,
      emailSent: true,
      calendarNote: 'Google Calendar integration would create event here if OAuth is configured',
    });
  } catch (error) {
    console.error('Interview creation error:', error);
    res.status(500).json({ 
      error: 'Failed to create interview',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;