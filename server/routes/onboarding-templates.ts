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

// Template schema (for creating reusable templates)
// Tasks can come as either an array or a JSON string (frontend sends string)
const createTemplateSchema = z.object({
  name: z.string().min(1),
  department: z.string().optional(),
  description: z.string().optional(),
  tasks: z.preprocess(
    (val) => {
      // If it's a string, parse it as JSON
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return [];
        }
      }
      return val;
    },
    z.array(z.object({
      title: z.string(),
      description: z.string().optional(),
      dueInDays: z.number().int().default(1),
    })).optional()
  ),
  isActive: z.boolean().default(true),
});

const updateTemplateSchema = createTemplateSchema.partial();

// Workflow/Instance schema (for assigning to employees)
const createOnboardingWorkflowSchema = z.object({
  employeeId: z.string(),
  templateId: z.string().optional(),
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

    // Get all templates
    const templates = await storage.getAllOnboardingTemplates();

    // Apply filters and parse tasks JSON
    let filtered = templates.map((t: any) => ({
      ...t,
      tasks: typeof t.tasks === 'string' ? JSON.parse(t.tasks) : t.tasks || [],
    }));

    if (department && department !== 'all') {
      filtered = filtered.filter((t: any) => t.department === department);
    }

    if (isActive !== undefined) {
      const activeFilter = isActive === 'true';
      filtered = filtered.filter((t: any) => t.isActive === activeFilter);
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
    const template = await storage.getOnboardingTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Onboarding template not found' });
    }

    res.json({
      ...template,
      tasks: typeof template.tasks === 'string' ? JSON.parse(template.tasks) : template.tasks || [],
    });
  } catch (error) {
    console.error('Error fetching onboarding template:', error);
    res.status(500).json({ error: 'Failed to fetch onboarding template' });
  }
});

// POST /api/onboarding-templates - Create template (manager only)
router.post('/api/onboarding-templates', requireManager, async (req, res) => {
  try {
    const data = createTemplateSchema.parse(req.body);

    // Generate unique ID
    const id = `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create template using onboarding templates table
    const template = await storage.createOnboardingTemplate({
      id,
      name: data.name,
      department: data.department || null,
      description: data.description || null,
      tasks: JSON.stringify(data.tasks || []),
      isActive: data.isActive ?? true,
      createdBy: req.user?.id || 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    res.json({
      ...template,
      tasks: data.tasks || [],
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
    const data = updateTemplateSchema.parse(req.body);

    const updateData: any = {
      ...data,
      updatedAt: new Date(),
    };

    // Convert tasks to JSON string if provided
    if (data.tasks) {
      updateData.tasks = JSON.stringify(data.tasks);
    }

    const template = await storage.updateOnboardingTemplate(req.params.id, updateData);

    if (!template) {
      return res.status(404).json({ error: 'Onboarding template not found' });
    }

    res.json({
      ...template,
      tasks: typeof template.tasks === 'string' ? JSON.parse(template.tasks) : template.tasks || [],
    });
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
    // Soft delete by setting isActive to false
    const template = await storage.updateOnboardingTemplate(req.params.id, {
      isActive: false,
      updatedAt: new Date(),
    });

    if (!template) {
      return res.status(404).json({ error: 'Onboarding template not found' });
    }

    res.json({ success: true, message: 'Template deactivated successfully' });
  } catch (error) {
    console.error('Error deactivating onboarding template:', error);
    res.status(500).json({ error: 'Failed to deactivate onboarding template' });
  }
});

// POST /api/onboarding-templates/:templateId/assign/:employeeId - Assign template to employee
router.post('/api/onboarding-templates/:templateId/assign/:employeeId', requireManager, async (req, res) => {
  try {
    const { templateId, employeeId } = req.params;

    // Get the template
    const template = await storage.getOnboardingTemplateById(templateId);
    if (!template) {
      return res.status(404).json({ error: 'Onboarding template not found' });
    }

    // Parse tasks from template
    const tasks = typeof template.tasks === 'string' ? JSON.parse(template.tasks) : template.tasks || [];

    // Generate unique ID for the instance
    const instanceId = `instance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create the onboarding instance - let DB defaults handle timestamps
    const instance = await storage.createOnboardingInstance({
      id: instanceId,
      templateId,
      employeeId,
      assignedBy: req.user?.id || 'system',
      status: 'in_progress',
      progress: JSON.stringify([]), // Empty array of completed task IDs
    });

    // Create onboarding steps from template tasks
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const stepId = `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Calculate due date based on dueInDays
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (task.dueInDays || 7));

      await storage.createOnboardingStep({
        id: stepId,
        workflowId: instanceId,
        stepNumber: i + 1,
        title: task.title,
        description: task.description || '',
        type: 'TASK',
        status: 'PENDING',
        isRequired: true,
        dueDate: dueDate.toISOString(),
      });
    }

    // Also create a workflow entry for backwards compatibility
    const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await storage.createOnboardingWorkflow({
      id: workflowId,
      employeeId,
      templateId,
      status: 'IN_PROGRESS',
      currentStep: 1,
      totalSteps: tasks.length,
      assignedTo: req.user?.id,
      notes: `Assigned from template: ${template.name}`,
      startedAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: 'Template assigned successfully',
      instance: {
        ...instance,
        template,
        tasksCount: tasks.length,
      },
      workflowId,
    });
  } catch (error) {
    console.error('Error assigning onboarding template:', error);
    res.status(500).json({ error: 'Failed to assign onboarding template' });
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
