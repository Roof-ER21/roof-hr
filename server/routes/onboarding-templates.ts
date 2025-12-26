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

// Validation schemas
const createOnboardingWorkflowSchema = z.object({
  employeeId: z.string(),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'PAUSED']).default('NOT_STARTED'),
  currentStep: z.number().int().default(1),
  totalSteps: z.number().int().default(10),
  assignedTo: z.string().optional(),
  notes: z.string().optional(),
});

const updateOnboardingWorkflowSchema = createOnboardingWorkflowSchema.partial();

const createOnboardingStepSchema = z.object({
  workflowId: z.string(),
  stepNumber: z.number().int(),
  title: z.string(),
  description: z.string(),
  type: z.enum(['DOCUMENT_UPLOAD', 'FORM_FILL', 'TRAINING', 'MEETING', 'TASK', 'REVIEW']),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED']).default('PENDING'),
  isRequired: z.boolean().default(true),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(), // ISO date string
  notes: z.string().optional(),
  documentIds: z.array(z.string()).optional(),
});

const updateOnboardingStepSchema = createOnboardingStepSchema.partial();

// ONBOARDING WORKFLOWS (Templates)

// GET /api/onboarding-templates - List templates (filter by department, isActive)
router.get('/api/onboarding-templates', requireAuth, async (req, res) => {
  try {
    const { department, isActive } = req.query;

    // Get all workflows
    const workflows = await storage.getAllOnboardingWorkflows();

    // Apply filters
    let filtered = workflows;

    if (department && department !== 'all') {
      filtered = filtered.filter((w: any) => w.department === department);
    }

    if (isActive !== undefined) {
      const activeFilter = isActive === 'true';
      filtered = filtered.filter((w: any) => w.isActive === activeFilter);
    }

    res.json(filtered);
  } catch (error) {
    console.error('Error fetching onboarding templates:', error);
    res.status(500).json({ error: 'Failed to fetch onboarding templates' });
  }
});

// GET /api/onboarding-templates/:id - Get specific template
router.get('/api/onboarding-templates/:id', requireAuth, async (req, res) => {
  try {
    const workflow = await storage.getOnboardingWorkflowById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Onboarding template not found' });
    }

    // Get steps for this workflow
    const steps = await storage.getOnboardingStepsByWorkflowId(req.params.id);

    res.json({
      ...workflow,
      steps,
    });
  } catch (error) {
    console.error('Error fetching onboarding template:', error);
    res.status(500).json({ error: 'Failed to fetch onboarding template' });
  }
});

// POST /api/onboarding-templates - Create template (manager only)
router.post('/api/onboarding-templates', requireManager, async (req, res) => {
  try {
    const data = createOnboardingWorkflowSchema.parse(req.body);
    const { steps, ...workflowData } = req.body;

    const workflow = await storage.createOnboardingWorkflow(workflowData);

    // Create steps if provided
    const createdSteps = [];
    if (steps && Array.isArray(steps)) {
      for (const step of steps) {
        const stepData = createOnboardingStepSchema.parse({
          ...step,
          workflowId: workflow.id,
        });
        const createdStep = await storage.createOnboardingStep(stepData);
        createdSteps.push(createdStep);
      }
    }

    res.json({
      ...workflow,
      steps: createdSteps,
    });
  } catch (error) {
    console.error('Error creating onboarding template:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid template data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create onboarding template' });
  }
});

// PUT /api/onboarding-templates/:id - Update template (manager only)
router.put('/api/onboarding-templates/:id', requireManager, async (req, res) => {
  try {
    const data = updateOnboardingWorkflowSchema.parse(req.body);
    const workflow = await storage.updateOnboardingWorkflow(req.params.id, {
      ...data,
      updatedAt: new Date().toISOString(),
    });

    if (!workflow) {
      return res.status(404).json({ error: 'Onboarding template not found' });
    }

    res.json(workflow);
  } catch (error) {
    console.error('Error updating onboarding template:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid template data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update onboarding template' });
  }
});

// DELETE /api/onboarding-templates/:id - Deactivate template (manager only)
router.delete('/api/onboarding-templates/:id', requireManager, async (req, res) => {
  try {
    // Soft delete by setting status to inactive
    const workflow = await storage.updateOnboardingWorkflow(req.params.id, {
      status: 'PAUSED',
      updatedAt: new Date().toISOString(),
    });

    if (!workflow) {
      return res.status(404).json({ error: 'Onboarding template not found' });
    }

    res.json({ success: true, message: 'Template deactivated successfully' });
  } catch (error) {
    console.error('Error deactivating onboarding template:', error);
    res.status(500).json({ error: 'Failed to deactivate onboarding template' });
  }
});

// ONBOARDING INSTANCES

// GET /api/onboarding-instances - List instances (filter by employeeId, status)
router.get('/api/onboarding-instances', requireAuth, async (req, res) => {
  try {
    const { employeeId, status } = req.query;

    const workflows = await storage.getAllOnboardingWorkflows();

    // Apply filters
    let filtered = workflows;

    if (employeeId) {
      filtered = filtered.filter((w: any) => w.employeeId === employeeId);
    }

    if (status) {
      filtered = filtered.filter((w: any) => w.status === status);
    }

    res.json(filtered);
  } catch (error) {
    console.error('Error fetching onboarding instances:', error);
    res.status(500).json({ error: 'Failed to fetch onboarding instances' });
  }
});

// GET /api/onboarding-instances/:id - Get specific instance with progress
router.get('/api/onboarding-instances/:id', requireAuth, async (req, res) => {
  try {
    const workflow = await storage.getOnboardingWorkflowById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Onboarding instance not found' });
    }

    // Get steps with completion status
    const steps = await storage.getOnboardingStepsByWorkflowId(req.params.id);

    // Calculate progress
    const completedSteps = steps.filter((s: any) => s.status === 'COMPLETED').length;
    const totalSteps = steps.length;
    const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    res.json({
      ...workflow,
      steps,
      progress: {
        completedSteps,
        totalSteps,
        percentage: progressPercentage,
      },
    });
  } catch (error) {
    console.error('Error fetching onboarding instance:', error);
    res.status(500).json({ error: 'Failed to fetch onboarding instance' });
  }
});

// POST /api/onboarding-instances - Assign template to employee
router.post('/api/onboarding-instances', requireManager, async (req, res) => {
  try {
    const data = createOnboardingWorkflowSchema.parse(req.body);
    const workflow = await storage.createOnboardingWorkflow({
      ...data,
      startedAt: new Date().toISOString(),
    });

    res.json(workflow);
  } catch (error) {
    console.error('Error creating onboarding instance:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid instance data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create onboarding instance' });
  }
});

// PUT /api/onboarding-instances/:id - Update progress (mark tasks complete)
router.put('/api/onboarding-instances/:id', requireAuth, async (req, res) => {
  try {
    const { stepId, stepStatus, ...workflowData } = req.body;

    // Update step if stepId provided
    if (stepId) {
      const step = await storage.updateOnboardingStep(stepId, {
        status: stepStatus || 'COMPLETED',
        completedAt: stepStatus === 'COMPLETED' ? new Date().toISOString() : undefined,
        updatedAt: new Date().toISOString(),
      });

      if (!step) {
        return res.status(404).json({ error: 'Onboarding step not found' });
      }
    }

    // Update workflow if data provided
    if (Object.keys(workflowData).length > 0) {
      const workflow = await storage.updateOnboardingWorkflow(req.params.id, {
        ...workflowData,
        updatedAt: new Date().toISOString(),
      });

      if (!workflow) {
        return res.status(404).json({ error: 'Onboarding instance not found' });
      }

      return res.json(workflow);
    }

    // Return updated instance with progress
    const workflow = await storage.getOnboardingWorkflowById(req.params.id);
    const steps = await storage.getOnboardingStepsByWorkflowId(req.params.id);

    const completedSteps = steps.filter((s: any) => s.status === 'COMPLETED').length;
    const totalSteps = steps.length;
    const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    res.json({
      ...workflow,
      steps,
      progress: {
        completedSteps,
        totalSteps,
        percentage: progressPercentage,
      },
    });
  } catch (error) {
    console.error('Error updating onboarding instance:', error);
    res.status(500).json({ error: 'Failed to update onboarding instance' });
  }
});

// POST /api/onboarding-instances/:id/complete - Mark onboarding complete
router.post('/api/onboarding-instances/:id/complete', requireAuth, async (req, res) => {
  try {
    const workflow = await storage.updateOnboardingWorkflow(req.params.id, {
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
      currentStep: 999, // Indicate completion
      updatedAt: new Date().toISOString(),
    });

    if (!workflow) {
      return res.status(404).json({ error: 'Onboarding instance not found' });
    }

    // Mark all remaining steps as completed
    const steps = await storage.getOnboardingStepsByWorkflowId(req.params.id);
    for (const step of steps) {
      if (step.status !== 'COMPLETED') {
        await storage.updateOnboardingStep(step.id, {
          status: 'COMPLETED',
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    res.json({
      success: true,
      message: 'Onboarding completed successfully',
      workflow,
    });
  } catch (error) {
    console.error('Error completing onboarding instance:', error);
    res.status(500).json({ error: 'Failed to complete onboarding instance' });
  }
});

export default router;
