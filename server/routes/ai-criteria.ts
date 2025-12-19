import express from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { insertAiCriteriaSchema } from '../../shared/schema';

const router = express.Router();

// Middleware for auth (reuse existing pattern)
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
    'TRUE_ADMIN', 'ADMIN', 'TERRITORY_SALES_MANAGER'
  ];

  if (!managerRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Manager access required' });
  }

  next();
}

/**
 * Get all AI criteria
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const criteria = await storage.getAllAiCriteria();
    res.json(criteria);
  } catch (error) {
    console.error('Failed to fetch AI criteria:', error);
    res.status(500).json({ 
      error: 'Failed to fetch AI criteria',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get AI criteria by ID
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const criteria = await storage.getAiCriteriaById(id);
    
    if (!criteria) {
      return res.status(404).json({ error: 'AI criteria not found' });
    }
    
    res.json(criteria);
  } catch (error) {
    console.error('Failed to fetch AI criteria:', error);
    res.status(500).json({ 
      error: 'Failed to fetch AI criteria',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Create new AI criteria
 */
router.post('/', requireManager, async (req, res) => {
  try {
    // Ensure user is authenticated (TypeScript check)
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Transform the array criteria to JSON string if needed
    const requestData = {
      ...req.body,
      criteria: Array.isArray(req.body.criteria)
        ? JSON.stringify(req.body.criteria)
        : req.body.criteria,
      createdBy: req.user.id // Add the user ID from session
    };

    // Validate the request body using the insert schema
    const validatedData = insertAiCriteriaSchema.parse(requestData);

    const criteria = await storage.createAiCriteria(validatedData);
    res.status(201).json(criteria);
  } catch (error) {
    console.error('Failed to create AI criteria:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }

    res.status(500).json({
      error: 'Failed to create AI criteria',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Update AI criteria
 */
router.put('/:id', requireManager, async (req, res) => {
  try {
    // Ensure user is authenticated (TypeScript check)
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;

    // Check if criteria exists
    const existingCriteria = await storage.getAiCriteriaById(id);
    if (!existingCriteria) {
      return res.status(404).json({ error: 'AI criteria not found' });
    }

    // Transform the array criteria to JSON string if needed
    const requestData = {
      ...req.body,
      criteria: req.body.criteria !== undefined
        ? (Array.isArray(req.body.criteria)
          ? JSON.stringify(req.body.criteria)
          : req.body.criteria)
        : undefined,
      createdBy: req.user.id // Keep the createdBy field updated
    };

    // Validate the request body
    const validatedData = insertAiCriteriaSchema.partial().parse(requestData);

    const updatedCriteria = await storage.updateAiCriteria(id, validatedData);
    res.json(updatedCriteria);
  } catch (error) {
    console.error('Failed to update AI criteria:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }

    res.status(500).json({
      error: 'Failed to update AI criteria',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Delete AI criteria
 */
router.delete('/:id', requireManager, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if criteria exists
    const existingCriteria = await storage.getAiCriteriaById(id);
    if (!existingCriteria) {
      return res.status(404).json({ error: 'AI criteria not found' });
    }
    
    await storage.deleteAiCriteria(id);
    res.status(204).send();
  } catch (error) {
    console.error('Failed to delete AI criteria:', error);
    res.status(500).json({ 
      error: 'Failed to delete AI criteria',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;