import express, { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { insertCandidateSchema, insertCandidateSourceSchema } from '../../shared/schema';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Extend Request type to include user
interface AuthRequest extends Request {
  user?: Express.User;
}

// Middleware to check authentication
function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function requireManager(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Manager access required' });
  }

  next();
}

// Import candidates from external source
router.post('/api/candidates/import', requireManager, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { source, jobPostingId, candidates } = req.body;

    if (!source || !candidates || !Array.isArray(candidates)) {
      return res.status(400).json({ error: 'Invalid import data' });
    }

    const batchId = uuidv4();
    const importResults = {
      total: candidates.length,
      successful: 0,
      failed: 0,
      candidateIds: [] as string[],
    };

    // Create import log
    await storage.createJobImportLog({
      source: source as 'INDEED' | 'GOOGLE_JOBS' | 'LINKEDIN' | 'CSV' | 'MANUAL',
      jobTitle: jobPostingId || 'Imported Position',
      candidatesFound: candidates.length,
      candidatesImported: 0,
      status: 'PARTIAL' as const,
    });
    
    // Process each candidate
    for (const candidateData of candidates) {
      try {
        // Create the candidate
        const candidate = await storage.createCandidate({
          firstName: candidateData.firstName,
          lastName: candidateData.lastName,
          email: candidateData.email,
          phone: candidateData.phone || '',
          position: candidateData.position || jobPostingId || 'General',
          resumeUrl: candidateData.resumeUrl,
          status: 'SCREENING',
          stage: 'SCREENING',
          appliedDate: candidateData.appliedDate || new Date(),
          notes: candidateData.notes || null,
        });
        
        // Create source record
        await storage.createCandidateSource({
          candidateId: candidate.id,
          source: source as 'INDEED' | 'LINKEDIN' | 'GOOGLE_JOBS' | 'WEBSITE' | 'REFERRAL' | 'OTHER',
          sourceUrl: candidateData.sourceUrl,
          importBatchId: batchId,
        });
        
        importResults.successful++;
        importResults.candidateIds.push(candidate.id);
      } catch (error) {
        console.error(`Failed to import candidate ${candidateData.email}:`, error);
        importResults.failed++;
      }
    }
    
    // Update import log with results
    await storage.createJobImportLog({
      source: source as 'INDEED' | 'GOOGLE_JOBS' | 'LINKEDIN' | 'CSV' | 'MANUAL',
      jobTitle: jobPostingId || 'Imported Position',
      candidatesFound: candidates.length,
      candidatesImported: importResults.successful,
      status: importResults.failed === 0 ? 'SUCCESS' : importResults.successful === 0 ? 'FAILED' : 'PARTIAL',
    });

    res.json(importResults);
  } catch (error) {
    console.error('Error importing candidates:', error);
    res.status(500).json({ error: 'Failed to import candidates' });
  }
});

// Get import history
router.get('/api/candidates/import-history', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const logs = await storage.getJobImportLogs(50);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching import history:', error);
    res.status(500).json({ error: 'Failed to fetch import history' });
  }
});

// Get candidate sources
router.get('/api/candidates/:id/sources', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const sources = await storage.getCandidateSourcesByCandidateId(req.params.id);
    res.json(sources);
  } catch (error) {
    console.error('Error fetching candidate sources:', error);
    res.status(500).json({ error: 'Failed to fetch candidate sources' });
  }
});

// Simulate Indeed candidate import
router.post('/api/candidates/import-indeed', requireManager, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { jobPostingId } = req.body;

    if (!jobPostingId) {
      return res.status(400).json({ error: 'Job posting ID required' });
    }
    
    // TODO: Integrate with Indeed API
    // For now, we'll simulate importing some candidates
    const mockCandidates = [
      {
        firstName: 'John',
        lastName: 'Smith',
        email: `john.smith.${Date.now()}@example.com`,
        phone: '555-0101',
        position: 'Roofing Specialist',
        department: 'Operations',
        skills: ['Shingle Installation', 'Safety Compliance', 'Team Leadership'],
        experience: '5 years of commercial roofing experience',
        sourceUrl: 'https://indeed.com/resume/12345',
        appliedDate: new Date(),
      },
      {
        firstName: 'Sarah',
        lastName: 'Johnson',
        email: `sarah.johnson.${Date.now()}@example.com`,
        phone: '555-0102',
        position: 'Roofing Specialist',
        department: 'Operations',
        skills: ['Flat Roof Systems', 'Waterproofing', 'Project Management'],
        experience: '8 years in residential and commercial roofing',
        sourceUrl: 'https://indeed.com/resume/67890',
        appliedDate: new Date(),
      },
    ];
    
    // Import using the standard import endpoint logic
    const batchId = uuidv4();
    const importResults = {
      total: mockCandidates.length,
      successful: 0,
      failed: 0,
      candidateIds: [] as string[],
      message: 'Indeed import simulation completed',
    };
    
    for (const candidateData of mockCandidates) {
      try {
        const candidate = await storage.createCandidate({
          firstName: candidateData.firstName,
          lastName: candidateData.lastName,
          email: candidateData.email,
          phone: candidateData.phone,
          position: candidateData.position,
          status: 'SCREENING',
          stage: 'SCREENING',
          appliedDate: candidateData.appliedDate,
          notes: null,
        });

        await storage.createCandidateSource({
          candidateId: candidate.id,
          source: 'INDEED',
          sourceUrl: candidateData.sourceUrl,
          importBatchId: batchId,
        });
        
        importResults.successful++;
        importResults.candidateIds.push(candidate.id);
      } catch (error) {
        console.error('Failed to import mock candidate:', error);
        importResults.failed++;
      }
    }
    
    await storage.createJobImportLog({
      source: 'INDEED',
      jobTitle: jobPostingId || 'Indeed Import',
      candidatesFound: mockCandidates.length,
      candidatesImported: importResults.successful,
      status: importResults.failed === 0 ? 'SUCCESS' : importResults.successful === 0 ? 'FAILED' : 'PARTIAL',
    });

    res.json(importResults);
  } catch (error) {
    console.error('Error simulating Indeed import:', error);
    res.status(500).json({ error: 'Failed to simulate Indeed import' });
  }
});

export default router;