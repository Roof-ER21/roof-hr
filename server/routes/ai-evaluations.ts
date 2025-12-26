import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { aiEvaluations, insertAiEvaluationsSchema } from '../../shared/schema';
import { eq, desc, and } from 'drizzle-orm';

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

// GET /api/ai-evaluations - List evaluations (filter by candidateId)
router.get('/api/ai-evaluations', requireAuth, async (req: any, res) => {
  try {
    const { candidateId, criteriaId } = req.query;

    let query = db.select().from(aiEvaluations);

    // Apply filters if provided
    if (candidateId) {
      query = query.where(eq(aiEvaluations.candidateId, candidateId as string)) as any;
    }

    if (criteriaId && candidateId) {
      query = query.where(
        and(
          eq(aiEvaluations.candidateId, candidateId as string),
          eq(aiEvaluations.criteriaId, criteriaId as string)
        )
      ) as any;
    } else if (criteriaId) {
      query = query.where(eq(aiEvaluations.criteriaId, criteriaId as string)) as any;
    }

    // Order by most recent first
    const evaluations = await (query as any).orderBy(desc(aiEvaluations.evaluatedAt));

    res.json(evaluations);
  } catch (error) {
    console.error('Error fetching AI evaluations:', error);
    res.status(500).json({ error: 'Failed to fetch AI evaluations' });
  }
});

// GET /api/ai-evaluations/:id - Get specific evaluation
router.get('/api/ai-evaluations/:id', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;

    const evaluation = await db
      .select()
      .from(aiEvaluations)
      .where(eq(aiEvaluations.id, id))
      .limit(1);

    if (evaluation.length === 0) {
      return res.status(404).json({ error: 'AI evaluation not found' });
    }

    res.json(evaluation[0]);
  } catch (error) {
    console.error('Error fetching AI evaluation:', error);
    res.status(500).json({ error: 'Failed to fetch AI evaluation' });
  }
});

// POST /api/ai-evaluations - Create new evaluation
router.post('/api/ai-evaluations', requireAuth, async (req: any, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate score is between 0-100 if provided
    if (req.body.score !== null && req.body.score !== undefined) {
      if (req.body.score < 0 || req.body.score > 100) {
        return res.status(400).json({ error: 'Score must be between 0 and 100' });
      }
    }

    // Validate recommendation enum if provided
    if (req.body.recommendation) {
      const validRecommendations = ['HIRE', 'REJECT', 'REVIEW'];
      if (!validRecommendations.includes(req.body.recommendation)) {
        return res.status(400).json({
          error: 'Invalid recommendation',
          message: 'Recommendation must be one of: HIRE, REJECT, REVIEW'
        });
      }
    }

    // Validate request body using schema
    const validatedData = insertAiEvaluationsSchema.parse(req.body);

    // Create the evaluation
    const created = await db
      .insert(aiEvaluations)
      .values({
        id: uuidv4(),
        candidateId: req.body.candidateId || null,
        criteriaId: req.body.criteriaId || null,
        score: req.body.score || null,
        feedback: req.body.feedback || null,
        strengths: req.body.strengths || null,
        weaknesses: req.body.weaknesses || null,
        recommendation: req.body.recommendation || null,
      })
      .returning();

    res.status(201).json(created[0]);
  } catch (error) {
    console.error('Error creating AI evaluation:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid evaluation data', details: error.message });
    }
    res.status(500).json({ error: 'Failed to create AI evaluation' });
  }
});

// DELETE /api/ai-evaluations/:id - Delete evaluation
router.delete('/api/ai-evaluations/:id', requireManager, async (req: any, res) => {
  try {
    const { id } = req.params;

    // Check if evaluation exists
    const existing = await db
      .select()
      .from(aiEvaluations)
      .where(eq(aiEvaluations.id, id))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'AI evaluation not found' });
    }

    // Delete the evaluation
    await db
      .delete(aiEvaluations)
      .where(eq(aiEvaluations.id, id));

    res.json({
      message: 'AI evaluation deleted successfully',
      deletedId: id
    });
  } catch (error) {
    console.error('Error deleting AI evaluation:', error);
    res.status(500).json({ error: 'Failed to delete AI evaluation' });
  }
});

// GET /api/ai-evaluations/candidate/:candidateId/summary - Get evaluation summary for a candidate
router.get('/api/ai-evaluations/candidate/:candidateId/summary', requireAuth, async (req: any, res) => {
  try {
    const { candidateId } = req.params;

    const evaluations = await db
      .select()
      .from(aiEvaluations)
      .where(eq(aiEvaluations.candidateId, candidateId))
      .orderBy(desc(aiEvaluations.evaluatedAt));

    if (evaluations.length === 0) {
      return res.json({
        candidateId,
        totalEvaluations: 0,
        averageScore: null,
        latestRecommendation: null,
        evaluations: [],
      });
    }

    // Calculate average score
    const scoresOnly = evaluations
      .filter(e => e.score !== null && e.score !== undefined)
      .map(e => e.score as number);

    const averageScore = scoresOnly.length > 0
      ? scoresOnly.reduce((sum, score) => sum + score, 0) / scoresOnly.length
      : null;

    // Get latest recommendation
    const latestWithRecommendation = evaluations.find(e => e.recommendation !== null);

    res.json({
      candidateId,
      totalEvaluations: evaluations.length,
      averageScore: averageScore ? Math.round(averageScore * 10) / 10 : null,
      latestRecommendation: latestWithRecommendation?.recommendation || null,
      latestEvaluationDate: evaluations[0]?.evaluatedAt || null,
      evaluations: evaluations,
    });
  } catch (error) {
    console.error('Error fetching candidate evaluation summary:', error);
    res.status(500).json({ error: 'Failed to fetch evaluation summary' });
  }
});

export default router;
