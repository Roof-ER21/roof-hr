import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { candidateImportLogs, insertCandidateImportLogsSchema } from '../../shared/schema';
import { eq, desc } from 'drizzle-orm';

const router = express.Router();

// Middleware for auth
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

// GET /api/candidate-import-logs - List all import logs (with pagination)
router.get('/api/candidate-import-logs', requireAuth, async (req: any, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    // Fetch logs with pagination, ordered by most recent first
    const logs = await db
      .select()
      .from(candidateImportLogs)
      .orderBy(desc(candidateImportLogs.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination metadata
    const totalCount = await db
      .select()
      .from(candidateImportLogs);

    res.json({
      data: logs,
      pagination: {
        page,
        limit,
        total: totalCount.length,
        totalPages: Math.ceil(totalCount.length / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching candidate import logs:', error);
    res.status(500).json({ error: 'Failed to fetch candidate import logs' });
  }
});

// GET /api/candidate-import-logs/:id - Get specific import log
router.get('/api/candidate-import-logs/:id', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;

    const log = await db
      .select()
      .from(candidateImportLogs)
      .where(eq(candidateImportLogs.id, id))
      .limit(1);

    if (log.length === 0) {
      return res.status(404).json({ error: 'Import log not found' });
    }

    res.json(log[0]);
  } catch (error) {
    console.error('Error fetching import log:', error);
    res.status(500).json({ error: 'Failed to fetch import log' });
  }
});

// POST /api/candidate-import-logs - Create new import log
router.post('/api/candidate-import-logs', requireManager, async (req: any, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Prepare data with user ID
    const requestData = {
      ...req.body,
      importedBy: req.user.id,
    };

    // Validate request body
    const validatedData = insertCandidateImportLogsSchema.parse(requestData);

    // Create the import log
    const created = await db
      .insert(candidateImportLogs)
      .values({
        id: uuidv4(),
        importType: req.body.importType,
        fileName: req.body.fileName || null,
        totalRecords: req.body.totalRecords || 0,
        successCount: req.body.successCount || 0,
        errorCount: req.body.errorCount || 0,
        errors: req.body.errors || null,
        importedBy: req.user.id,
      })
      .returning();

    res.status(201).json(created[0]);
  } catch (error) {
    console.error('Error creating candidate import log:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid import log data', details: error.message });
    }
    res.status(500).json({ error: 'Failed to create candidate import log' });
  }
});

// GET /api/candidate-import-logs/stats/summary - Get import statistics summary
router.get('/api/candidate-import-logs/stats/summary', requireAuth, async (req: any, res) => {
  try {
    const logs = await db.select().from(candidateImportLogs);

    const summary = {
      totalImports: logs.length,
      totalRecordsProcessed: logs.reduce((sum, log) => sum + (log.totalRecords || 0), 0),
      totalSuccessful: logs.reduce((sum, log) => sum + (log.successCount || 0), 0),
      totalErrors: logs.reduce((sum, log) => sum + (log.errorCount || 0), 0),
      byImportType: {} as Record<string, number>,
    };

    // Count by import type
    logs.forEach(log => {
      const type = log.importType || 'UNKNOWN';
      summary.byImportType[type] = (summary.byImportType[type] || 0) + 1;
    });

    res.json(summary);
  } catch (error) {
    console.error('Error fetching import statistics:', error);
    res.status(500).json({ error: 'Failed to fetch import statistics' });
  }
});

export default router;
