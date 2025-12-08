import express from 'express';
import { storage } from '../storage';
import { z } from 'zod';

const router = express.Router();

// Middleware
async function requireAuth(req: any, res: any, next: any) {
  // Check if user is already set by main auth middleware
  if (req.user) {
    return next();
  }

  // Check for Bearer token
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      const { storage } = await import('../storage');
      const session = await storage.getSessionByToken(token);
      if (session && new Date(session.expiresAt) > new Date()) {
        const user = await storage.getUserById(session.userId);
        if (user) {
          req.user = user;
          return next();
        }
      }
    } catch (error) {
      // Invalid token, continue to check session
    }
  }

  // For session-based auth, check if there's a user in the session
  // This would be set by the login route
  if (req.session && req.session.userId) {
    try {
      const { storage } = await import('../storage');
      const user = await storage.getUserById(req.session.userId);
      if (user) {
        req.user = user;
        return next();
      }
    } catch (error) {
      // Session user not found
    }
  }

  return res.status(401).json({ error: 'Authentication required' });
}

// Schema for creating workflows
const createWorkflowSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  type: z.enum(['RECRUITMENT', 'ONBOARDING', 'PERFORMANCE', 'DOCUMENT', 'CUSTOM']),
  trigger: z.enum(['MANUAL', 'SCHEDULED', 'EVENT', 'CONDITION']),
  triggerConfig: z.string().optional(),
});

const createWorkflowStepSchema = z.object({
  workflowId: z.string(),
  stepNumber: z.number(),
  name: z.string(),
  type: z.enum(['ACTION', 'CONDITION', 'DELAY', 'NOTIFICATION', 'APPROVAL', 'INTEGRATION']),
  actionType: z.string().optional(),
  config: z.string(),
  conditions: z.string().optional(),
  nextStepOnSuccess: z.string().optional(),
  nextStepOnFailure: z.string().optional(),
  retryAttempts: z.number().default(0),
  retryDelay: z.number().optional(),
});

// Workflow Routes
router.get('/api/workflows', requireAuth, async (req: any, res) => {
  try {
    const workflows = await storage.getAllWorkflows();
    res.json(workflows);
  } catch (error) {
    console.error('Error fetching workflows:', error);
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
});

router.post('/api/workflows', requireAuth, async (req: any, res) => {
  try {
    const data = createWorkflowSchema.parse(req.body);
    const workflow = await storage.createWorkflow({
      ...data,
      status: 'DRAFT',
      createdBy: req.user.id,
      executionCount: 0,
    });
    res.json(workflow);
  } catch (error) {
    console.error('Error creating workflow:', error);
    res.status(400).json({ error: error instanceof z.ZodError ? error.errors : 'Failed to create workflow' });
  }
});

router.get('/api/workflows/:id', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const workflow = await storage.getWorkflowById(id);
    
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    
    res.json(workflow);
  } catch (error) {
    console.error('Error fetching workflow:', error);
    res.status(500).json({ error: 'Failed to fetch workflow' });
  }
});

router.patch('/api/workflows/:id', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const workflow = await storage.updateWorkflow(id, req.body);
    res.json(workflow);
  } catch (error) {
    console.error('Error updating workflow:', error);
    res.status(500).json({ error: 'Failed to update workflow' });
  }
});

router.patch('/api/workflows/:id/status', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const workflow = await storage.updateWorkflow(id, { status });
    res.json(workflow);
  } catch (error) {
    console.error('Error updating workflow status:', error);
    res.status(500).json({ error: 'Failed to update workflow status' });
  }
});

// Workflow Steps Routes
router.get('/api/workflows/:id/steps', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const steps = await storage.getWorkflowStepsByWorkflowId(id);
    res.json(steps);
  } catch (error) {
    console.error('Error fetching workflow steps:', error);
    res.status(500).json({ error: 'Failed to fetch workflow steps' });
  }
});

router.post('/api/workflow-steps', requireAuth, async (req: any, res) => {
  try {
    const data = createWorkflowStepSchema.parse(req.body);
    const step = await storage.createWorkflowStep(data);
    res.json(step);
  } catch (error) {
    console.error('Error creating workflow step:', error);
    res.status(400).json({ error: error instanceof z.ZodError ? error.errors : 'Failed to create workflow step' });
  }
});

router.patch('/api/workflow-steps/:id', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const step = await storage.updateWorkflowStep(id, req.body);
    res.json(step);
  } catch (error) {
    console.error('Error updating workflow step:', error);
    res.status(500).json({ error: 'Failed to update workflow step' });
  }
});

router.delete('/api/workflow-steps/:id', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    await storage.deleteWorkflowStep(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting workflow step:', error);
    res.status(500).json({ error: 'Failed to delete workflow step' });
  }
});

// Workflow Execution Routes
router.post('/api/workflows/:id/execute', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { context } = req.body;
    
    // Get the workflow
    const workflow = await storage.getWorkflowById(id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    
    // Create execution record
    const execution = await storage.createWorkflowExecution({
      workflowId: id,
      status: 'RUNNING',
      triggeredBy: req.user.id,
      triggerSource: 'MANUAL',
      context: JSON.stringify(context || {}),
    });
    
    // Execute the workflow using the workflow executor
    const { workflowExecutor } = await import('../services/workflow-executor');
    
    // Run workflow execution in background
    workflowExecutor.executeWorkflow(id, {
      ...context,
      employeeId: req.user.id
    }).then(async () => {
      // Update execution status on completion
      await storage.updateWorkflowExecution(execution.id, {
        status: 'COMPLETED',
        completedAt: new Date()
      });
    }).catch(async (error) => {
      // Update execution status on failure
      console.error('Workflow execution failed:', error);
      await storage.updateWorkflowExecution(execution.id, {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: error.message
      });
    });
    
    res.json({ 
      success: true, 
      executionId: execution.id, 
      message: 'Workflow execution started in background' 
    });
  } catch (error) {
    console.error('Error executing workflow:', error);
    res.status(500).json({ error: 'Failed to execute workflow' });
  }
});

router.get('/api/workflows/:id/executions', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const executions = await storage.getWorkflowExecutions(id);
    res.json(executions);
  } catch (error) {
    console.error('Error fetching workflow executions:', error);
    res.status(500).json({ error: 'Failed to fetch workflow executions' });
  }
});

router.get('/api/workflow-executions/:id/logs', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const logs = await storage.getWorkflowStepLogs(id);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching workflow step logs:', error);
    res.status(500).json({ error: 'Failed to fetch workflow step logs' });
  }
});

// Workflow Templates Routes
router.get('/api/workflow-templates', requireAuth, async (req: any, res) => {
  try {
    const templates = await storage.getAllWorkflowTemplates();
    res.json(templates);
  } catch (error) {
    console.error('Error fetching workflow templates:', error);
    res.status(500).json({ error: 'Failed to fetch workflow templates' });
  }
});

router.post('/api/workflow-templates/:id/create-workflow', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    
    const template = await storage.getWorkflowTemplateById(id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    // Parse the template config
    const config = JSON.parse(template.config);
    
    // Create workflow from template
    const workflow = await storage.createWorkflow({
      name: name || template.name,
      description: description || template.description,
      type: config.type || 'CUSTOM',
      trigger: config.trigger || 'MANUAL',
      triggerConfig: config.triggerConfig,
      status: 'DRAFT',
      createdBy: req.user.id,
      executionCount: 0,
    });
    
    // Create steps from template
    if (config.steps) {
      for (const stepConfig of config.steps) {
        await storage.createWorkflowStep({
          workflowId: workflow.id,
          ...stepConfig,
        });
      }
    }
    
    res.json(workflow);
  } catch (error) {
    console.error('Error creating workflow from template:', error);
    res.status(500).json({ error: 'Failed to create workflow from template' });
  }
});

export default router;