import express from 'express';
import { storage } from '../storage';
import { insertTerritorySchema } from '../../shared/schema';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Import auth middleware from the main auth module
import { requireAuth as authMiddleware } from '../middleware/auth';

function requireAdmin(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (!['TRUE_ADMIN', 'ADMIN', 'GENERAL_MANAGER'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
}

function requireTerritoryManager(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Territory Sales Managers can manage their own territory
  if (req.user.role === 'TERRITORY_SALES_MANAGER') {
    // Check if they're managing their own territory
    const territoryId = req.params.id || req.body.territoryId;
    if (territoryId) {
      storage.getTerritoryBySalesManager(req.user.id).then(territory => {
        if (territory && territory.id === territoryId) {
          return next();
        }
        return res.status(403).json({ error: 'Can only manage your own territory' });
      });
      return;
    }
  }
  
  // Admins and General Managers can manage all territories
  if (['TRUE_ADMIN', 'ADMIN', 'GENERAL_MANAGER'].includes(req.user.role)) {
    return next();
  }
  
  return res.status(403).json({ error: 'Territory management access required' });
}

// Get all territories
router.get('/api/territories', authMiddleware, async (req, res) => {
  try {
    const territories = await storage.getAllTerritories();
    res.json(territories);
  } catch (error) {
    console.error('Error fetching territories:', error);
    res.status(500).json({ error: 'Failed to fetch territories' });
  }
});

// Get territory by ID
router.get('/api/territories/:id', authMiddleware, async (req, res) => {
  try {
    const territory = await storage.getTerritoryById(req.params.id);
    if (!territory) {
      return res.status(404).json({ error: 'Territory not found' });
    }
    res.json(territory);
  } catch (error) {
    console.error('Error fetching territory:', error);
    res.status(500).json({ error: 'Failed to fetch territory' });
  }
});

// Get territory by sales manager
router.get('/api/territories/manager/:managerId', authMiddleware, async (req, res) => {
  try {
    const territory = await storage.getTerritoryBySalesManager(req.params.managerId);
    if (!territory) {
      return res.status(404).json({ error: 'No territory found for this manager' });
    }
    res.json(territory);
  } catch (error) {
    console.error('Error fetching territory by manager:', error);
    res.status(500).json({ error: 'Failed to fetch territory' });
  }
});

// Create new territory
router.post('/api/territories', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const data = insertTerritorySchema.parse(req.body);
    const territory = await storage.createTerritory(data);
    res.json(territory);
  } catch (error: any) {
    console.error('Error creating territory:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid territory data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create territory' });
  }
});

// Update territory
router.patch('/api/territories/:id', authMiddleware, requireTerritoryManager, async (req, res) => {
  try {
    const territory = await storage.updateTerritory(req.params.id, req.body);
    res.json(territory);
  } catch (error) {
    console.error('Error updating territory:', error);
    res.status(500).json({ error: 'Failed to update territory' });
  }
});

// Delete territory
router.delete('/api/territories/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    await storage.deleteTerritory(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting territory:', error);
    res.status(500).json({ error: 'Failed to delete territory' });
  }
});

// Assign user to territory
router.post('/api/territories/:id/assign-user', authMiddleware, requireTerritoryManager, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }
    
    // Update user's territory assignment
    await storage.updateUser(userId, { territoryId: req.params.id });
    
    res.json({ success: true, message: 'User assigned to territory' });
  } catch (error) {
    console.error('Error assigning user to territory:', error);
    res.status(500).json({ error: 'Failed to assign user to territory' });
  }
});

// Remove user from territory
router.post('/api/territories/:id/remove-user', authMiddleware, requireTerritoryManager, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }
    
    // Remove user's territory assignment
    await storage.updateUser(userId, { territoryId: null });
    
    res.json({ success: true, message: 'User removed from territory' });
  } catch (error) {
    console.error('Error removing user from territory:', error);
    res.status(500).json({ error: 'Failed to remove user from territory' });
  }
});

export default router;