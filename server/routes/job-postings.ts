import express from 'express';
import { storage } from '../storage';
import { insertJobPostingSchema } from '../../shared/schema';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Middleware to check authentication
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

// Get all job postings
router.get('/api/job-postings', requireAuth, async (req, res) => {
  try {
    const postings = await storage.getAllJobPostings();
    res.json(postings);
  } catch (error) {
    console.error('Error fetching job postings:', error);
    res.status(500).json({ error: 'Failed to fetch job postings' });
  }
});

// Get single job posting
router.get('/api/job-postings/:id', requireAuth, async (req, res) => {
  try {
    const posting = await storage.getJobPostingById(req.params.id);
    if (!posting) {
      return res.status(404).json({ error: 'Job posting not found' });
    }
    res.json(posting);
  } catch (error) {
    console.error('Error fetching job posting:', error);
    res.status(500).json({ error: 'Failed to fetch job posting' });
  }
});

// Create job posting
router.post('/api/job-postings', requireManager, async (req: any, res) => {
  try {
    const data = insertJobPostingSchema.parse(req.body);
    const posting = await storage.createJobPosting({
      ...data,
      createdBy: req.user.id,
    });
    res.json(posting);
  } catch (error) {
    console.error('Error creating job posting:', error);
    res.status(400).json({ error: 'Failed to create job posting' });
  }
});

// Update job posting
router.patch('/api/job-postings/:id', requireManager, async (req, res) => {
  try {
    const posting = await storage.updateJobPosting(req.params.id, req.body);
    res.json(posting);
  } catch (error) {
    console.error('Error updating job posting:', error);
    res.status(500).json({ error: 'Failed to update job posting' });
  }
});

// Delete job posting
router.delete('/api/job-postings/:id', requireManager, async (req, res) => {
  try {
    await storage.deleteJobPosting(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting job posting:', error);
    res.status(500).json({ error: 'Failed to delete job posting' });
  }
});

// Publish job posting to Indeed (mock for now)
router.post('/api/job-postings/:id/publish-indeed', requireManager, async (req, res) => {
  try {
    const posting = await storage.getJobPostingById(req.params.id);
    if (!posting) {
      return res.status(404).json({ error: 'Job posting not found' });
    }

    // TODO: Integrate with Indeed API
    // For now, we'll simulate the publishing
    const indeedJobId = `IND-${uuidv4().substring(0, 8)}`;
    
    await storage.updateJobPosting(req.params.id, {
      status: 'PUBLISHED',
      indeedJobId,
      publishedAt: new Date(),
    });

    res.json({ 
      success: true, 
      indeedJobId,
      message: 'Job posting published to Indeed (simulated)' 
    });
  } catch (error) {
    console.error('Error publishing to Indeed:', error);
    res.status(500).json({ error: 'Failed to publish to Indeed' });
  }
});

export default router;