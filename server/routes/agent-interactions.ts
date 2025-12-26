import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { agentInteractions, insertAgentInteractionsSchema } from '../../shared/schema';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';

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
    'TRUE_ADMIN', 'ADMIN', 'TERRITORY_SALES_MANAGER'
  ];

  if (!managerRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Manager access required' });
  }

  next();
}

// GET /api/agent-interactions - List all agent interactions
router.get('/api/agent-interactions', requireAuth, requireManager, async (req, res) => {
  try {
    const { agentId, userId, startDate, endDate, status, limit = '100' } = req.query;

    let query = db.select().from(agentInteractions);

    // Apply filters
    const conditions = [];
    if (agentId && typeof agentId === 'string') {
      conditions.push(eq(agentInteractions.agentId, agentId));
    }
    if (userId && typeof userId === 'string') {
      conditions.push(eq(agentInteractions.userId, userId));
    }
    if (status && typeof status === 'string') {
      conditions.push(eq(agentInteractions.status, status));
    }
    if (startDate && typeof startDate === 'string') {
      conditions.push(gte(agentInteractions.createdAt, new Date(startDate)));
    }
    if (endDate && typeof endDate === 'string') {
      conditions.push(lte(agentInteractions.createdAt, new Date(endDate)));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const interactions = await query
      .orderBy(desc(agentInteractions.createdAt))
      .limit(parseInt(limit as string));

    res.json(interactions);
  } catch (error) {
    console.error('Error fetching agent interactions:', error);
    res.status(500).json({ error: 'Failed to fetch agent interactions' });
  }
});

// GET /api/agent-interactions/:id - Get specific interaction
router.get('/api/agent-interactions/:id', requireAuth, requireManager, async (req, res) => {
  try {
    const { id } = req.params;

    const [interaction] = await db.select()
      .from(agentInteractions)
      .where(eq(agentInteractions.id, id));

    if (!interaction) {
      return res.status(404).json({ error: 'Interaction not found' });
    }

    res.json(interaction);
  } catch (error) {
    console.error('Error fetching agent interaction:', error);
    res.status(500).json({ error: 'Failed to fetch interaction' });
  }
});

// POST /api/agent-interactions - Log new interaction
router.post('/api/agent-interactions', requireAuth, async (req, res) => {
  try {
    const parsedData = insertAgentInteractionsSchema.parse(req.body);

    const newInteraction = {
      id: uuidv4(),
      agentId: parsedData.agentId || null,
      userId: parsedData.userId || null,
      action: parsedData.action,
      input: parsedData.input || null,
      output: parsedData.output || null,
      status: parsedData.status || 'completed',
      duration: parsedData.duration || null,
    };

    const [created] = await db.insert(agentInteractions)
      .values(newInteraction)
      .returning();

    console.log(`Agent interaction logged: ${created.id} - ${created.action}`);
    res.status(201).json(created);
  } catch (error: any) {
    console.error('Error logging agent interaction:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid interaction data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to log interaction' });
  }
});

// GET /api/agent-interactions/stats - Get interaction statistics
router.get('/api/agent-interactions/stats', requireAuth, requireManager, async (req, res) => {
  try {
    const { agentId, userId, startDate, endDate } = req.query;

    // Build WHERE conditions for filtering
    const conditions = [];
    if (agentId && typeof agentId === 'string') {
      conditions.push(eq(agentInteractions.agentId, agentId));
    }
    if (userId && typeof userId === 'string') {
      conditions.push(eq(agentInteractions.userId, userId));
    }
    if (startDate && typeof startDate === 'string') {
      conditions.push(gte(agentInteractions.createdAt, new Date(startDate)));
    }
    if (endDate && typeof endDate === 'string') {
      conditions.push(lte(agentInteractions.createdAt, new Date(endDate)));
    }

    // Get total count
    let countQuery = db.select({ count: sql<number>`count(*)::int` }).from(agentInteractions);
    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions)) as any;
    }
    const [{ count: totalInteractions }] = await countQuery;

    // Get count by status
    let statusQuery = db.select({
      status: agentInteractions.status,
      count: sql<number>`count(*)::int`
    })
      .from(agentInteractions)
      .groupBy(agentInteractions.status);

    if (conditions.length > 0) {
      statusQuery = statusQuery.where(and(...conditions)) as any;
    }
    const statusCounts = await statusQuery;

    // Get count by agent
    let agentQuery = db.select({
      agentId: agentInteractions.agentId,
      count: sql<number>`count(*)::int`
    })
      .from(agentInteractions)
      .groupBy(agentInteractions.agentId);

    if (conditions.length > 0) {
      agentQuery = agentQuery.where(and(...conditions)) as any;
    }
    const agentCounts = await agentQuery;

    // Get average duration
    let avgQuery = db.select({
      avgDuration: sql<number>`avg(duration)::int`
    }).from(agentInteractions);

    if (conditions.length > 0) {
      avgQuery = avgQuery.where(and(...conditions)) as any;
    }
    const [{ avgDuration }] = await avgQuery;

    // Get recent interactions
    let recentQuery = db.select().from(agentInteractions);
    if (conditions.length > 0) {
      recentQuery = recentQuery.where(and(...conditions)) as any;
    }
    const recentInteractions = await recentQuery
      .orderBy(desc(agentInteractions.createdAt))
      .limit(10);

    const stats = {
      totalInteractions,
      statusCounts: statusCounts.reduce((acc, { status, count }) => {
        acc[status || 'unknown'] = count;
        return acc;
      }, {} as Record<string, number>),
      agentCounts: agentCounts.reduce((acc, { agentId, count }) => {
        acc[agentId || 'unknown'] = count;
        return acc;
      }, {} as Record<string, number>),
      averageDuration: avgDuration || 0,
      recentInteractions,
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching agent interaction stats:', error);
    res.status(500).json({ error: 'Failed to fetch interaction statistics' });
  }
});

export default router;
