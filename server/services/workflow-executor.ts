import { storage } from '../storage';
import { gmailService } from './gmail-service';
import { googleCalendarService } from './google-calendar-service';
import OpenAI from 'openai';
import { logger } from '../utils/logger';

// Initialize services on first use
let servicesInitialized = false;
async function ensureServicesInitialized() {
  if (!servicesInitialized) {
    try {
      await gmailService.initialize();
      await googleCalendarService.initialize();
      servicesInitialized = true;
    } catch (error) {
      logger.error('[WorkflowExecutor] Failed to initialize Google services:', error);
    }
  }
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface WorkflowContext {
  candidateId?: string;
  employeeId?: string;
  stage?: string;
  previousStage?: string;
  data?: Record<string, any>;
}

export class WorkflowExecutor {
  async executeWorkflow(workflowId: string, context: WorkflowContext) {
    try {
      const workflow = await storage.getWorkflowById(workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      if (workflow.status !== 'ACTIVE') {
        logger.info(`Workflow ${workflowId} is not active, skipping execution`);
        return;
      }

      logger.info(`Starting workflow execution: ${workflow.name}`, { workflowId, context });

      // Get workflow steps
      const steps = await storage.getWorkflowStepsByWorkflowId(workflowId);

      // Execute steps in sequence
      for (const step of steps.sort((a: any, b: any) => a.stepNumber - b.stepNumber)) {
        logger.info(`Executing step ${step.stepNumber}: ${step.name}`);
        
        try {
          await this.executeStep(step, context);
          logger.info(`Step ${step.stepNumber} completed successfully`);
        } catch (error) {
          logger.error(`Step ${step.stepNumber} failed:`, error);
          
          if (step.retryAttempts > 0) {
            logger.info(`Retrying step ${step.stepNumber} (${step.retryAttempts} attempts remaining)`);
            // Implement retry logic here
          } else {
            throw error;
          }
        }
      }

      // Update workflow execution count
      await storage.updateWorkflowExecutionCount(workflowId);
      
      logger.info(`Workflow ${workflow.name} completed successfully`);
    } catch (error) {
      logger.error(`Workflow execution failed:`, error);
      throw error;
    }
  }

  private async executeStep(step: any, context: WorkflowContext) {
    const config = JSON.parse(step.config || '{}');
    
    switch (step.type) {
      case 'NOTIFICATION':
        await this.executeNotification(step, config, context);
        break;
      case 'ACTION':
        await this.executeAction(step, config, context);
        break;
      case 'CONDITION':
        await this.evaluateCondition(step, config, context);
        break;
      case 'DELAY':
        await this.executeDelay(config);
        break;
      case 'APPROVAL':
        await this.requestApproval(step, config, context);
        break;
      case 'INTEGRATION':
        await this.executeIntegration(step, config, context);
        break;
      default:
        logger.warn(`Unknown step type: ${step.type}`);
    }
  }

  private async executeNotification(step: any, config: any, context: WorkflowContext) {
    // Ensure services are initialized before sending
    await ensureServicesInitialized();

    if (step.actionType === 'SEND_EMAIL' && servicesInitialized) {
      // Get candidate or employee data
      let recipient = '';
      let subject = '';
      let body = '';

      if (context.candidateId) {
        const candidate = await storage.getCandidateById(context.candidateId);
        if (candidate) {
          recipient = candidate.email;
          const candidateName = `${candidate.firstName} ${candidate.lastName}`;
          subject = this.replaceVariables(config.subject || 'Notification', { candidate: { ...candidate, name: candidateName }, ...context });
          body = this.replaceVariables(config.body || 'You have a new notification.', { candidate: { ...candidate, name: candidateName }, ...context });
        }
      }

      if (recipient) {
        await gmailService.sendEmail({
          to: recipient,
          subject,
          text: body,
          html: body.replace(/\n/g, '<br>')
        });
        logger.info(`Email sent to ${recipient}`);
      }
    }
  }

  private async executeAction(step: any, config: any, context: WorkflowContext) {
    switch (step.actionType) {
      case 'AI_SCREEN':
        await this.performAIScreening(context);
        break;
      case 'SCHEDULE_INTERVIEW':
        await this.scheduleInterview(config, context);
        break;
      case 'UPDATE_STATUS':
        await this.updateCandidateStatus(config, context);
        break;
      case 'CREATE_TASK':
        logger.info('Creating task:', config);
        // Implement task creation logic
        break;
      default:
        logger.warn(`Unknown action type: ${step.actionType}`);
    }
  }

  private async performAIScreening(context: WorkflowContext) {
    if (!context.candidateId) return;
    
    const candidate = await storage.getCandidateById(context.candidateId);
    if (!candidate) return;

    try {
      const candidateName = `${candidate.firstName} ${candidate.lastName}`;
      const candidateNotes = candidate.notes || 'No additional notes';
      const parsedData = candidate.parsedResumeData ? JSON.parse(candidate.parsedResumeData) : {};

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an HR assistant evaluating candidates for roofing positions. Score the candidate from 0-100 based on their qualifications."
          },
          {
            role: "user",
            content: `Evaluate this candidate:
              Name: ${candidateName}
              Position: ${candidate.position}
              Experience: ${parsedData.experience || candidateNotes}
              Skills: ${parsedData.skills || 'Not provided'}
              Resume: ${candidate.resumeUrl || 'Not provided'}`
          }
        ],
        temperature: 0.3,
      });

      const response = completion.choices[0].message.content;
      logger.info(`AI screening result for ${candidateName}: ${response}`);

      // Update candidate with AI insights
      const scoreMatch = response?.match(/\d+/);
      if (scoreMatch) {
        const score = parseInt(scoreMatch[0]);
        await storage.updateCandidate(context.candidateId, {
          matchScore: score,
          aiInsights: response
        });
      }
    } catch (error) {
      logger.error('AI screening failed:', error);
    }
  }

  private async scheduleInterview(config: any, context: WorkflowContext) {
    if (!context.candidateId) return;

    // Ensure services are initialized
    await ensureServicesInitialized();
    if (!servicesInitialized) return;

    const candidate = await storage.getCandidateById(context.candidateId);
    if (!candidate) return;

    const candidateName = `${candidate.firstName} ${candidate.lastName}`;

    // Create calendar event with correct API format
    const startDateTime = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hour duration

    try {
      const createdEvent = await googleCalendarService.createEvent({
        summary: `Interview with ${candidateName}`,
        description: `Interview for ${candidate.position} position`,
        startDateTime,
        endDateTime,
        attendees: candidate.email ? [candidate.email] : [],
        sendNotifications: true,
      });
      logger.info(`Interview scheduled for ${candidateName}:`, createdEvent);
    } catch (error) {
      logger.error('Failed to schedule interview:', error);
    }
  }

  private async updateCandidateStatus(config: any, context: WorkflowContext) {
    if (!context.candidateId) return;
    
    const newStatus = config.status || context.stage;
    if (newStatus) {
      await storage.updateCandidate(context.candidateId, { status: newStatus });
      logger.info(`Updated candidate status to ${newStatus}`);
    }
  }

  private async evaluateCondition(step: any, config: any, context: WorkflowContext) {
    // Implement condition evaluation logic
    logger.info('Evaluating condition:', config);
  }

  private async executeDelay(config: any) {
    const duration = config.duration || 1;
    const unit = config.unit || 'seconds';
    
    let milliseconds = duration * 1000;
    if (unit === 'minutes') milliseconds *= 60;
    if (unit === 'hours') milliseconds *= 60 * 60;
    if (unit === 'days') milliseconds *= 24 * 60 * 60;
    
    logger.info(`Delaying for ${duration} ${unit}`);
    await new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  private async requestApproval(step: any, config: any, context: WorkflowContext) {
    // Implement approval request logic
    logger.info('Requesting approval:', config);
  }

  private async executeIntegration(step: any, config: any, context: WorkflowContext) {
    // Implement external integration logic
    logger.info('Executing integration:', config);
  }

  private replaceVariables(text: string, variables: Record<string, any>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] || match;
    });
  }

  // Trigger workflow when candidate stage changes
  async onCandidateStageChange(candidateId: string, newStage: string, previousStage: string) {
    // Find workflows that should be triggered
    const workflows = await storage.getActiveWorkflowsByType('RECRUITMENT');
    
    for (const workflow of workflows) {
      if (workflow.trigger === 'EVENT') {
        const triggerConfig = JSON.parse(workflow.triggerConfig || '{}');
        
        // Check if this stage transition should trigger the workflow
        if (triggerConfig.event === 'candidate_stage_change' || 
            triggerConfig.event === 'candidate_applied' && newStage === 'APPLIED' ||
            triggerConfig.fromStage === previousStage ||
            triggerConfig.toStage === newStage) {
          
          logger.info(`Triggering workflow ${workflow.name} for candidate stage change`);
          await this.executeWorkflow(workflow.id, {
            candidateId,
            stage: newStage,
            previousStage
          });
        }
      }
    }
  }
}

export const workflowExecutor = new WorkflowExecutor();