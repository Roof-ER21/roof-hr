import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { recruitmentBotConversations, insertRecruitmentBotConversationsSchema } from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';

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
    'TRUE_ADMIN', 'ADMIN', 'TERRITORY_SALES_MANAGER', 'SOURCER'
  ];

  if (!managerRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Manager access required' });
  }

  next();
}

// GET /api/recruitment-bot/conversations - List all conversations
router.get('/api/recruitment-bot/conversations', requireAuth, requireManager, async (req, res) => {
  try {
    const { candidateId, status } = req.query;

    let query = db.select().from(recruitmentBotConversations);

    // Apply filters
    const conditions = [];
    if (candidateId && typeof candidateId === 'string') {
      conditions.push(eq(recruitmentBotConversations.candidateId, candidateId));
    }
    if (status && typeof status === 'string') {
      conditions.push(eq(recruitmentBotConversations.status, status));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const conversations = await query.orderBy(desc(recruitmentBotConversations.createdAt));

    res.json(conversations);
  } catch (error) {
    console.error('Error fetching recruitment bot conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// GET /api/recruitment-bot/conversations/:id - Get specific conversation
router.get('/api/recruitment-bot/conversations/:id', requireAuth, requireManager, async (req, res) => {
  try {
    const { id } = req.params;

    const [conversation] = await db.select()
      .from(recruitmentBotConversations)
      .where(eq(recruitmentBotConversations.id, id));

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(conversation);
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// POST /api/recruitment-bot/conversations - Create new conversation
router.post('/api/recruitment-bot/conversations', requireAuth, async (req, res) => {
  try {
    const parsedData = insertRecruitmentBotConversationsSchema.parse(req.body);

    const newConversation = {
      id: uuidv4(),
      candidateId: parsedData.candidateId || null,
      messages: parsedData.messages,
      status: parsedData.status || 'active',
      context: parsedData.context || null,
    };

    const [created] = await db.insert(recruitmentBotConversations)
      .values(newConversation)
      .returning();

    console.log(`Recruitment bot conversation created: ${created.id}`);
    res.status(201).json(created);
  } catch (error: any) {
    console.error('Error creating recruitment bot conversation:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid conversation data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// PUT /api/recruitment-bot/conversations/:id - Update conversation (add messages, change status)
router.put('/api/recruitment-bot/conversations/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData: any = {};

    // Check if conversation exists
    const [existing] = await db.select()
      .from(recruitmentBotConversations)
      .where(eq(recruitmentBotConversations.id, id));

    if (!existing) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Update allowed fields
    if (req.body.messages !== undefined) {
      updateData.messages = req.body.messages;
    }
    if (req.body.status !== undefined) {
      updateData.status = req.body.status;
    }
    if (req.body.context !== undefined) {
      updateData.context = req.body.context;
    }
    if (req.body.candidateId !== undefined) {
      updateData.candidateId = req.body.candidateId;
    }

    updateData.updatedAt = new Date();

    const [updated] = await db.update(recruitmentBotConversations)
      .set(updateData)
      .where(eq(recruitmentBotConversations.id, id))
      .returning();

    console.log(`Recruitment bot conversation updated: ${id}`);
    res.json(updated);
  } catch (error) {
    console.error('Error updating recruitment bot conversation:', error);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

// DELETE /api/recruitment-bot/conversations/:id - Delete conversation
router.delete('/api/recruitment-bot/conversations/:id', requireAuth, requireManager, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if conversation exists
    const [existing] = await db.select()
      .from(recruitmentBotConversations)
      .where(eq(recruitmentBotConversations.id, id));

    if (!existing) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    await db.delete(recruitmentBotConversations)
      .where(eq(recruitmentBotConversations.id, id));

    console.log(`Recruitment bot conversation deleted: ${id}`);
    res.json({ success: true, message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error('Error deleting recruitment bot conversation:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

export default router;
