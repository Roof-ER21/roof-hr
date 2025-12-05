import express from 'express';
import { recruitmentBot } from '../services/recruitment-bot';
import { storage } from '../storage';

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
  
  if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Manager access required' });
  }
  
  next();
}

// Get bot status
router.get('/status', requireAuth, (req, res) => {
  try {
    const status = recruitmentBot.getBotStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting bot status:', error);
    res.status(500).json({ error: 'Failed to get bot status' });
  }
});

// Get notifications
router.get('/notifications', requireAuth, (req, res) => {
  try {
    const unacknowledgedOnly = req.query.unacknowledged === 'true';
    const notifications = recruitmentBot.getNotifications(unacknowledgedOnly);
    res.json(notifications);
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Acknowledge notification
router.post('/notifications/:id/acknowledge', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    if (req.user && req.user.email) {
      recruitmentBot.acknowledgeNotification(id, req.user.email);
      res.json({ success: true });
    } else {
      res.status(401).json({ error: 'User not authenticated' });
    }
  } catch (error) {
    console.error('Error acknowledging notification:', error);
    res.status(500).json({ error: 'Failed to acknowledge notification' });
  }
});

// Validate candidate
router.post('/validate-candidate/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { nextStage } = req.body;
    
    const candidate = await storage.getCandidateById(id);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const validation = await recruitmentBot.validateCandidate(candidate, nextStage);
    res.json(validation);
  } catch (error) {
    console.error('Error validating candidate:', error);
    res.status(500).json({ error: 'Failed to validate candidate' });
  }
});

// Get suggested next steps
router.get('/candidates/:id/next-steps', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const candidate = await storage.getCandidateById(id);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const suggestions = await recruitmentBot.getSuggestedNextSteps(candidate);
    res.json({ candidateId: id, suggestions });
  } catch (error) {
    console.error('Error getting next steps:', error);
    res.status(500).json({ error: 'Failed to get next steps' });
  }
});

// Run monitoring check on all candidates
router.post('/monitor', requireManager, async (req, res) => {
  try {
    const candidates = await storage.getAllCandidates();
    const notifications = await recruitmentBot.monitorCandidates(candidates);
    
    res.json({
      success: true,
      candidatesChecked: candidates.length,
      notificationsCreated: notifications.length,
      notifications
    });
  } catch (error) {
    console.error('Error monitoring candidates:', error);
    res.status(500).json({ error: 'Failed to monitor candidates' });
  }
});

// Update bot configuration
router.put('/configuration', requireManager, (req, res) => {
  try {
    recruitmentBot.updateConfiguration(req.body);
    res.json({ success: true, configuration: recruitmentBot.getBotStatus().configuration });
  } catch (error) {
    console.error('Error updating configuration:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

export default router;