import express from 'express';
import { storage } from '../storage';
import { z } from 'zod';
import {
  sendOnboardingAssignedNotification,
  checkOverdueTasks
} from '../services/onboarding-notifications';

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
  type: z.enum(['DOCUMENT_UPLOAD', 'FORM_FILL', 'TRAINING', 'MEETING', 'TASK', 'REVIEW', 'DOCUMENT_READ', 'EQUIPMENT']),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED']).default('PENDING'),
  isRequired: z.boolean().default(true),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(), // ISO date string
  notes: z.string().optional(),
  documentIds: z.array(z.string()).optional(),
  // New fields for document and equipment integration
  documentId: z.string().optional(), // Single required document
  documentRequired: z.boolean().optional(),
  equipmentBundleId: z.string().optional(), // Equipment bundle to assign on completion
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
    console.log(`[Onboarding] Creating ${tasks.length} steps for instance ${instanceId}`);
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const stepId = `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Calculate due date based on dueInDays
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (task.dueInDays || 7));

      try {
        const createdStep = await storage.createOnboardingStep({
          workflowId: instanceId,
          stepNumber: i + 1,
          title: task.title,
          description: task.description || '',
          type: 'TASK',
          status: 'PENDING',
          isRequired: true,
          dueDate: dueDate,
        });
        console.log(`[Onboarding] Created step ${i + 1}: ${task.title} (ID: ${createdStep.id})`);
      } catch (stepError) {
        console.error(`[Onboarding] Error creating step ${i + 1}:`, stepError);
      }
    }

    // Verify steps were created
    const createdSteps = await storage.getOnboardingStepsByWorkflowId(instanceId);
    console.log(`[Onboarding] Verified ${createdSteps.length} steps created for instance ${instanceId}`);

    // Also create a workflow entry for backwards compatibility
    const workflow = await storage.createOnboardingWorkflow({
      employeeId,
      status: 'IN_PROGRESS',
      currentStep: 1,
      totalSteps: tasks.length,
      assignedTo: req.user?.id,
      notes: `Assigned from template: ${template.name} (templateId: ${templateId})`,
      startedAt: new Date(),
    });

    // Send notification to the employee
    const manager = await storage.getUserById(req.user?.id || 'system');
    const managerName = manager ? `${manager.firstName || ''} ${manager.lastName || ''}`.trim() || 'Your manager' : 'Your manager';

    await sendOnboardingAssignedNotification(
      employeeId,
      instanceId,
      template.name,
      managerName
    );

    res.json({
      success: true,
      message: 'Template assigned successfully',
      instance: {
        ...instance,
        template,
        tasksCount: tasks.length,
      },
      workflowId: workflow.id,
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
    let workflow = null;
    let instance = null;
    let stepsLookupId = req.params.id;

    // Try instance table first if ID looks like an instance ID
    if (req.params.id.startsWith('instance-')) {
      instance = await storage.getOnboardingInstanceById(req.params.id);
      if (instance) {
        stepsLookupId = instance.id; // Steps are linked to instance ID
        // Also try to find associated workflow for additional data
        const workflows = await storage.getAllOnboardingWorkflows();
        workflow = workflows.find((w: any) =>
          w.employeeId === instance!.employeeId &&
          w.templateId === instance!.templateId
        );
      }
    }

    // Fall back to workflow table if not found or ID is a workflow ID
    if (!instance) {
      workflow = await storage.getOnboardingWorkflowById(req.params.id);
      if (workflow) {
        // Find the associated instance to get steps (steps are linked to instance ID)
        const instances = await storage.getOnboardingInstancesByEmployeeId(workflow.employeeId);
        instance = instances.find((i: any) => i.templateId === workflow!.templateId);
        if (instance) {
          stepsLookupId = instance.id;
        }
      }
    }

    if (!instance && !workflow) {
      return res.status(404).json({ error: 'Onboarding instance not found' });
    }

    // Get steps with completion status using the correct lookup ID
    const steps = await storage.getOnboardingStepsByWorkflowId(stepsLookupId);

    // Calculate progress
    const completedSteps = steps.filter((s: any) => s.status === 'COMPLETED').length;
    const totalSteps = steps.length;
    const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    // Merge data from both tables
    const responseData = instance || workflow;
    res.json({
      ...responseData,
      ...(workflow && { workflowId: workflow.id }),
      ...(instance && { instanceId: instance.id }),
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

// GET /api/onboarding-instances/:id/steps - Get steps for an instance
router.get('/api/onboarding-instances/:id/steps', requireAuth, async (req, res) => {
  try {
    let stepsLookupId = req.params.id;

    // If this is a workflow ID, find the associated instance ID for step lookup
    if (req.params.id.startsWith('workflow-')) {
      const workflow = await storage.getOnboardingWorkflowById(req.params.id);
      if (workflow) {
        const instances = await storage.getOnboardingInstancesByEmployeeId(workflow.employeeId);
        const instance = instances.find((i: any) => workflow.notes?.includes(`templateId: ${i.id}`));
        if (instance) {
          stepsLookupId = instance.id;
        }
      }
    }

    const steps = await storage.getOnboardingStepsByWorkflowId(stepsLookupId);
    res.json(steps);
  } catch (error) {
    console.error('Error fetching onboarding steps:', error);
    res.status(500).json({ error: 'Failed to fetch onboarding steps' });
  }
});

// POST /api/onboarding-instances - Assign template to employee
router.post('/api/onboarding-instances', requireManager, async (req, res) => {
  try {
    const data = createOnboardingWorkflowSchema.parse(req.body);
    const workflow = await storage.createOnboardingWorkflow({
      ...data,
      startedAt: new Date(),
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
        completedAt: stepStatus === 'COMPLETED' ? new Date() : undefined,
        updatedAt: new Date(),
      });

      if (!step) {
        return res.status(404).json({ error: 'Onboarding step not found' });
      }
    }

    // Update workflow if data provided
    if (Object.keys(workflowData).length > 0) {
      const workflow = await storage.updateOnboardingWorkflow(req.params.id, {
        ...workflowData,
        updatedAt: new Date(),
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
      completedAt: new Date(),
      currentStep: 999, // Indicate completion
      updatedAt: new Date(),
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
          completedAt: new Date(),
          updatedAt: new Date(),
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

// PUT /api/onboarding-instances/:id/progress - Update progress (FIX 404 ERROR)
router.put('/api/onboarding-instances/:id/progress', requireAuth, async (req, res) => {
  try {
    const { completedTasks } = req.body;
    const requestId = req.params.id;

    let workflow = null;
    let instance = null;
    let stepsLookupId = requestId;

    // Try instance table first if ID looks like an instance ID
    if (requestId.startsWith('instance-')) {
      instance = await storage.getOnboardingInstanceById(requestId);
      if (instance) {
        stepsLookupId = instance.id;
        // Find associated workflow
        const workflows = await storage.getAllOnboardingWorkflows();
        workflow = workflows.find((w: any) =>
          w.employeeId === instance!.employeeId &&
          w.templateId === instance!.templateId
        );
      }
    }

    // Fall back to workflow table
    if (!instance && !workflow) {
      workflow = await storage.getOnboardingWorkflowById(requestId);
      if (workflow) {
        // Find associated instance for step lookup
        const instances = await storage.getOnboardingInstancesByEmployeeId(workflow.employeeId);
        instance = instances.find((i: any) => i.templateId === workflow!.templateId);
        if (instance) {
          stepsLookupId = instance.id;
        }
      }
    }

    if (!workflow && !instance) {
      return res.status(404).json({ error: 'Onboarding instance not found' });
    }

    // Get all steps using correct lookup ID
    const steps = await storage.getOnboardingStepsByWorkflowId(stepsLookupId);

    // Mark steps as completed based on completedTasks count
    for (let i = 0; i < steps.length; i++) {
      const status = i < completedTasks ? 'COMPLETED' : 'PENDING';
      if (steps[i].status !== status) {
        await storage.updateOnboardingStep(steps[i].id, {
          status,
          completedAt: status === 'COMPLETED' ? new Date() : undefined,
          updatedAt: new Date(),
        });
      }
    }

    // Update workflow if it exists
    if (workflow) {
      await storage.updateOnboardingWorkflow(workflow.id, {
        currentStep: Math.min(completedTasks + 1, steps.length),
        status: completedTasks >= steps.length ? 'COMPLETED' : 'IN_PROGRESS',
        completedAt: completedTasks >= steps.length ? new Date() : undefined,
        updatedAt: new Date(),
      });
    }

    // Update instance if it exists
    if (instance) {
      await storage.updateOnboardingInstance(instance.id, {
        status: completedTasks >= steps.length ? 'completed' : 'in_progress',
        completedAt: completedTasks >= steps.length ? new Date() : undefined,
      });
    }

    // Calculate and return progress
    const completedSteps = Math.min(completedTasks, steps.length);
    const totalSteps = steps.length;
    const responseData = instance || workflow;

    res.json({
      ...responseData,
      progress: {
        completedSteps,
        totalSteps,
        percentage: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
      },
    });
  } catch (error) {
    console.error('Error updating onboarding progress:', error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// PUT /api/onboarding-templates/:id/tasks/reorder - Reorder template tasks for drag-drop
router.put('/api/onboarding-templates/:id/tasks/reorder', requireManager, async (req, res) => {
  try {
    const { tasks } = req.body;

    if (!Array.isArray(tasks)) {
      return res.status(400).json({ error: 'Tasks must be an array' });
    }

    const template = await storage.updateOnboardingTemplate(req.params.id, {
      tasks: JSON.stringify(tasks),
      updatedAt: new Date(),
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({
      ...template,
      tasks: tasks,
    });
  } catch (error) {
    console.error('Error reordering tasks:', error);
    res.status(500).json({ error: 'Failed to reorder tasks' });
  }
});

// ============================================================
// EMPLOYEE SELF-SERVICE ENDPOINTS
// ============================================================

// GET /api/employee-portal/onboarding - Get employee's own onboarding tasks
router.get('/api/employee-portal/onboarding', requireAuth, async (req: any, res) => {
  try {
    const employeeId = req.user.id;

    // Get all onboarding workflows/instances for this employee
    const workflows = await storage.getAllOnboardingWorkflows();
    const employeeWorkflows = workflows.filter((w: any) => w.employeeId === employeeId);

    // Also get onboarding instances
    const instances = await storage.getOnboardingInstancesByEmployeeId(employeeId);

    // Combine and enrich with steps and template info
    const enrichedOnboarding = await Promise.all([
      ...employeeWorkflows.map(async (workflow: any) => {
        const steps = await storage.getOnboardingStepsByWorkflowId(workflow.id);
        const sortedSteps = steps.sort((a: any, b: any) => a.stepNumber - b.stepNumber);

        const completedCount = sortedSteps.filter((s: any) => s.status === 'COMPLETED').length;
        const now = new Date();

        return {
          id: workflow.id,
          type: 'workflow',
          status: workflow.status,
          startDate: workflow.startedAt || workflow.createdAt,
          steps: sortedSteps.map((step: any) => ({
            ...step,
            isOverdue: step.dueDate && new Date(step.dueDate) < now && step.status !== 'COMPLETED',
          })),
          progress: {
            completed: completedCount,
            total: sortedSteps.length,
            percentage: sortedSteps.length > 0 ? Math.round((completedCount / sortedSteps.length) * 100) : 0,
          },
        };
      }),
      ...instances.map(async (instance: any) => {
        const steps = await storage.getOnboardingStepsByWorkflowId(instance.id);
        const sortedSteps = steps.sort((a: any, b: any) => a.stepNumber - b.stepNumber);
        const template = await storage.getOnboardingTemplateById(instance.templateId);

        const completedCount = sortedSteps.filter((s: any) => s.status === 'COMPLETED').length;
        const now = new Date();

        return {
          id: instance.id,
          type: 'instance',
          templateId: instance.templateId,
          template: template ? { name: template.name, department: template.department } : null,
          status: instance.status,
          startDate: instance.startDate,
          completedAt: instance.completedAt,
          steps: sortedSteps.map((step: any) => ({
            ...step,
            isOverdue: step.dueDate && new Date(step.dueDate) < now && step.status !== 'COMPLETED',
          })),
          progress: {
            completed: completedCount,
            total: sortedSteps.length,
            percentage: sortedSteps.length > 0 ? Math.round((completedCount / sortedSteps.length) * 100) : 0,
          },
        };
      }),
    ]);

    // Filter out any that have no steps or are already completed
    const activeOnboarding = enrichedOnboarding.filter(
      (o) => o.steps.length > 0 && o.status !== 'COMPLETED' && o.status !== 'completed'
    );

    res.json(activeOnboarding);
  } catch (error) {
    console.error('Error fetching employee onboarding:', error);
    res.status(500).json({ error: 'Failed to fetch onboarding tasks' });
  }
});

// PUT /api/onboarding-steps/:stepId/complete - Complete an individual onboarding step
router.put('/api/onboarding-steps/:stepId/complete', requireAuth, async (req: any, res) => {
  try {
    const { stepId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    const userEmail = req.user.email;

    // Get the step
    const step = await storage.getOnboardingStepById(stepId);
    if (!step) {
      return res.status(404).json({ error: 'Step not found' });
    }

    // Get the workflow/instance to check permissions
    const workflow = await storage.getOnboardingWorkflowById(step.workflowId);
    const instance = await storage.getOnboardingInstanceById(step.workflowId);
    const workflowOrInstance = workflow || instance;

    if (!workflowOrInstance) {
      return res.status(404).json({ error: 'Onboarding workflow not found' });
    }

    // Check if user is the employee OR a manager
    const isEmployee = workflowOrInstance.employeeId === userId;
    const managerRoles = ['SYSTEM_ADMIN', 'HR_ADMIN', 'GENERAL_MANAGER', 'TERRITORY_MANAGER', 'MANAGER', 'TRUE_ADMIN', 'ADMIN', 'TERRITORY_SALES_MANAGER', 'HR'];
    const isManager = managerRoles.includes(userRole) || userEmail === 'ahmed.mahmoud@theroofdocs.com';

    if (!isEmployee && !isManager) {
      return res.status(403).json({ error: 'Not authorized to complete this task' });
    }

    // If document is required, check if it's been viewed
    if (step.documentRequired && !step.documentViewed) {
      return res.status(400).json({
        error: 'Document must be viewed before completing this task',
        requiresDocument: true,
        documentId: step.documentId,
      });
    }

    // Update the step
    const updatedStep = await storage.updateOnboardingStep(stepId, {
      status: 'COMPLETED',
      completedAt: new Date(),
      completedBy: userId,
      completedByRole: isEmployee ? 'EMPLOYEE' : 'MANAGER',
      updatedAt: new Date(),
    });

    // If this is an equipment task, trigger bundle assignment
    if (step.equipmentBundleId && (step.type === 'EQUIPMENT' || step.equipmentBundleId)) {
      try {
        // Create bundle assignment
        const bundleId = step.equipmentBundleId;
        const employeeId = workflowOrInstance.employeeId;

        // Check if bundle assignment methods exist
        if (typeof (storage as any).createBundleAssignment === 'function') {
          await (storage as any).createBundleAssignment({
            bundleId,
            employeeId,
            assignedBy: userId,
            status: 'PENDING',
            assignedDate: new Date(),
          });
        }

        // Mark equipment as assigned on the step
        await storage.updateOnboardingStep(stepId, {
          equipmentAssigned: true,
          equipmentAssignedAt: new Date(),
        });
      } catch (equipmentError) {
        console.error('Failed to assign equipment bundle:', equipmentError);
        // Don't fail the step completion if equipment assignment fails
      }
    }

    // Check if all steps are completed and update workflow/instance status
    const allSteps = await storage.getOnboardingStepsByWorkflowId(step.workflowId);
    const completedCount = allSteps.filter((s: any) => s.status === 'COMPLETED').length;
    const allCompleted = completedCount === allSteps.length;

    if (allCompleted) {
      if (workflow) {
        await storage.updateOnboardingWorkflow(step.workflowId, {
          status: 'COMPLETED',
          completedAt: new Date(),
        });
      }
      if (instance) {
        await storage.updateOnboardingInstance(step.workflowId, {
          status: 'completed',
          completedAt: new Date(),
        });
      }
    } else {
      // Update progress
      if (workflow) {
        await storage.updateOnboardingWorkflow(step.workflowId, {
          currentStep: completedCount + 1,
          status: 'IN_PROGRESS',
        });
      }
    }

    res.json({
      success: true,
      step: updatedStep,
      progress: {
        completed: completedCount,
        total: allSteps.length,
        percentage: Math.round((completedCount / allSteps.length) * 100),
        allCompleted,
      },
    });
  } catch (error) {
    console.error('Error completing onboarding step:', error);
    res.status(500).json({ error: 'Failed to complete step' });
  }
});

// POST /api/onboarding-steps/:stepId/mark-document-viewed - Mark document as viewed
router.post('/api/onboarding-steps/:stepId/mark-document-viewed', requireAuth, async (req: any, res) => {
  try {
    const { stepId } = req.params;
    const userId = req.user.id;

    // Get the step
    const step = await storage.getOnboardingStepById(stepId);
    if (!step) {
      return res.status(404).json({ error: 'Step not found' });
    }

    if (!step.documentId) {
      return res.status(400).json({ error: 'This step does not have a required document' });
    }

    // Get the workflow/instance to check permissions
    const workflow = await storage.getOnboardingWorkflowById(step.workflowId);
    const instance = await storage.getOnboardingInstanceById(step.workflowId);
    const workflowOrInstance = workflow || instance;

    if (!workflowOrInstance) {
      return res.status(404).json({ error: 'Onboarding workflow not found' });
    }

    // Check if user is the employee
    if (workflowOrInstance.employeeId !== userId) {
      return res.status(403).json({ error: 'Not authorized to view this document' });
    }

    // Update the step to mark document as viewed
    const updatedStep = await storage.updateOnboardingStep(stepId, {
      documentViewed: true,
      documentViewedAt: new Date(),
      updatedAt: new Date(),
    });

    // Log document access if the method exists
    try {
      if (typeof (storage as any).createDocumentAccessLog === 'function') {
        await (storage as any).createDocumentAccessLog({
          documentId: step.documentId,
          userId,
          action: 'VIEW',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        });
      }
    } catch (logError) {
      console.error('Failed to log document access:', logError);
    }

    res.json({
      success: true,
      step: updatedStep,
    });
  } catch (error) {
    console.error('Error marking document as viewed:', error);
    res.status(500).json({ error: 'Failed to mark document as viewed' });
  }
});

// GET /api/notifications - Get user's notifications
router.get('/api/notifications', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const notifications = await storage.getNotificationsByUserId(userId);
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PATCH /api/notifications/:id/read - Mark notification as read
router.patch('/api/notifications/:id/read', requireAuth, async (req: any, res) => {
  try {
    await storage.markNotificationAsRead(req.params.id);
    res.json({ success: true, id: req.params.id });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// PATCH /api/notifications/read-all - Mark all notifications as read
router.patch('/api/notifications/read-all', requireAuth, async (req: any, res) => {
  try {
    await storage.markAllNotificationsAsRead(req.user.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

// DELETE /api/notifications/clear - Delete all notifications for user
router.delete('/api/notifications/clear', requireAuth, async (req: any, res) => {
  try {
    await storage.deleteAllNotifications(req.user.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

// POST /api/onboarding/check-overdue - Manual trigger for checking overdue tasks (manager only)
router.post('/api/onboarding/check-overdue', requireManager, async (req: any, res) => {
  try {
    console.log(`[Onboarding] Manual overdue check triggered by ${req.user?.email || 'unknown'}`);

    // Run the overdue check asynchronously
    checkOverdueTasks()
      .then(() => {
        console.log('[Onboarding] Manual overdue check completed');
      })
      .catch((error) => {
        console.error('[Onboarding] Error in manual overdue check:', error);
      });

    // Return immediately so the user doesn't have to wait
    res.json({
      success: true,
      message: 'Overdue tasks check initiated. Notifications will be sent to employees with overdue tasks.',
    });
  } catch (error) {
    console.error('Error triggering overdue check:', error);
    res.status(500).json({ error: 'Failed to trigger overdue tasks check' });
  }
});

export default router;
