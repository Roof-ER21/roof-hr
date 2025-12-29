/**
 * Susan AI API Routes
 * Endpoints for Susan AI interactions
 */

import express from 'express';
import { susanAI, SusanContext } from '../services/susan-ai/core';
import { adminSusanAI } from '../services/susan-ai/admin-core';
import { SusanConfirmationHandler } from '../services/susan-ai/confirmation-handler';
import { z } from 'zod';
import { storage } from '../storage';
import { db } from '../db';
import { ADMIN_ROLES, MANAGER_ROLES } from '@shared/constants/roles';

const router = express.Router();

// Middleware to build Susan context from request
async function buildSusanContext(req: any): Promise<SusanContext> {
  let user = req.user as any;
  
  // If no user in req.user (no auth middleware), try to get from session token
  if (!user && req.headers.authorization) {
    const token = req.headers.authorization.replace('Bearer ', '');
    try {
      const storage = req.app.locals.storage;
      const session = await storage.getSessionByToken(token);
      if (session && new Date(session.expiresAt) >= new Date()) {
        user = await storage.getUserById(session.userId);
      }
    } catch (error) {
      console.error('[SUSAN-AI] Failed to get user from token:', error);
    }
  }
  
  // Log for debugging
  console.log('[SUSAN-AI] Building context for user:', user ? { id: user.id, role: user.role, name: `${user.firstName} ${user.lastName}` } : 'anonymous');
  
  return {
    userId: user?.id || 'anonymous',
    userRole: user?.role || 'EMPLOYEE',
    department: user?.department,
    territoryId: user?.territoryId,
    employeeId: user?.id,
    sessionHistory: (req.session as any)?.susanHistory || [],
    personalPreferences: user?.susanPreferences || {
      dailyBriefing: true,
      proactiveAssistance: true,
      communicationStyle: 'friendly'
    }
  };
}

// Initialize Susan AI on server start
susanAI.initialize().catch(console.error);

/**
 * Chat with Susan AI
 */
const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  context: z.object({
    userId: z.string().optional(),
    userRole: z.string().optional(),
    sessionHistory: z.array(z.any()).optional()
  }).optional()
});

router.post('/chat', async (req, res) => {
  console.log('[SUSAN-AI] Chat endpoint hit with body:', req.body);
  try {
    const { message, context: providedContext } = chatSchema.parse(req.body);
    
    // Use provided context for testing, or build from session for authenticated users
    const context = providedContext && providedContext.userId && providedContext.userRole ? {
      userId: providedContext.userId,
      userRole: providedContext.userRole as 'ADMIN' | 'HR_MANAGER' | 'MANAGER' | 'EMPLOYEE',
      department: undefined,
      territoryId: undefined,
      employeeId: providedContext.userId,
      sessionHistory: providedContext.sessionHistory || [],
      personalPreferences: {
        dailyBriefing: true,
        proactiveAssistance: true,
        communicationStyle: 'friendly' as const
      }
    } : await buildSusanContext(req);
    
    // Add user message to session history
    context.sessionHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date()
    });
    
    // Keep only last 10 messages in history
    if (context.sessionHistory.length > 10) {
      context.sessionHistory = context.sessionHistory.slice(-10);
    }
    
    // Use Admin Susan AI for admins and authorized managers
    const isAdmin = ADMIN_ROLES.includes(context.userRole) ||
                   (MANAGER_ROLES.includes(context.userRole) && isAuthorizedManager(context.userId));
    console.log('[SUSAN-AI] Selecting AI instance - isAdmin:', isAdmin, 'userRole:', context.userRole, 'userId:', context.userId);
    const aiInstance = isAdmin ? adminSusanAI : susanAI;
    
    // Process query with appropriate AI instance, passing storage for user lookup
    console.log('[SUSAN-AI] Processing query with:', isAdmin ? 'Admin Susan AI' : 'Regular Susan AI');
    const response = await aiInstance.processQuery(message, context, storage);
    
    // Add assistant response to session history
    context.sessionHistory.push({
      role: 'assistant',
      content: response.message,
      timestamp: new Date()
    });
    
    // Save history to session
    if (req.session) {
      (req.session as any).susanHistory = context.sessionHistory;
    }
    
    res.json(response);
  } catch (error) {
    console.error('[SUSAN-AI] Chat error:', error);
    res.status(500).json({ 
      error: 'Failed to process your request',
      message: 'I apologize, but I encountered an error. Please try again.'
    });
  }
});

// Helper function to check if manager is authorized for admin features
function isAuthorizedManager(userId: string): boolean {
  const authorizedManagers = process.env.AUTHORIZED_ADMIN_MANAGERS?.split(',') || [];
  return authorizedManagers.includes(userId);
}

/**
 * Get personalized greeting
 */
router.get('/greeting', async (req, res) => {
  try {
    const context = await buildSusanContext(req);
    const hour = new Date().getHours();
    let greeting = '';
    
    if (hour < 12) {
      greeting = 'Good morning';
    } else if (hour < 17) {
      greeting = 'Good afternoon';
    } else {
      greeting = 'Good evening';
    }
    
    const user = req.user as any;
    const userName = user?.firstName || 'there';
    const role = user?.role || 'Employee';
    
    const message = `${greeting}, ${userName}! I'm Susan, your AI-powered HR assistant. As a${role === 'ADMIN' ? 'n' : ''} ${role.toLowerCase().replace('_', ' ')}, I can help you with:
    
${role === 'HR_MANAGER' || role === 'ADMIN' ? 
`• Managing candidates and recruitment pipeline
• Reviewing and approving PTO requests
• Generating HR reports and analytics
• Employee onboarding and offboarding
• Company policy questions` :
role === 'MANAGER' ?
`• Managing your team's PTO requests
• Performance reviews for your team
• Team analytics and reports
• Recruitment for your department
• Company policies and procedures` :
`• Checking your PTO balance
• Requesting time off
• Company policies and benefits
• Holiday schedules
• HR questions and support`}

How can I assist you today?`;

    // Generate quick actions based on role
    const quickActions = [];
    
    if (role === 'HR_MANAGER' || role === 'ADMIN') {
      quickActions.push(
        { label: 'View Candidates', action: 'navigate', params: { page: '/recruiting' }, icon: 'users' },
        { label: 'Pending PTO', action: 'query', params: { query: 'Show pending PTO requests' }, icon: 'calendar' }
      );
    } else if (role === 'MANAGER') {
      quickActions.push(
        { label: 'My Team', action: 'query', params: { query: 'Show my team members' }, icon: 'users' }
      );
    }
    
    quickActions.push(
      { label: 'My PTO Balance', action: 'query', params: { query: 'What is my PTO balance?' }, icon: 'calendar' },
      { label: 'Company Holidays', action: 'query', params: { query: 'Show upcoming holidays' }, icon: 'calendar' }
    );
    
    res.json({ message, quickActions });
  } catch (error) {
    console.error('[SUSAN-AI] Greeting error:', error);
    res.json({ 
      message: "Hello! I'm Susan, your AI assistant. How can I help you today?",
      quickActions: []
    });
  }
});

/**
 * Quick action endpoint - accessible from anywhere on the site
 * This enables Susan AI's extended HR functions from any page
 */
router.post('/quick-action', async (req, res) => {
  console.log('[SUSAN-AI] Quick action endpoint hit');
  try {
    const { action, params } = req.body;
    const context = await buildSusanContext(req);
    
    // Use appropriate AI instance based on user role
    const isAdmin = context.userRole === 'ADMIN' || 
                   (context.userRole === 'MANAGER' && isAuthorizedManager(context.userId));
    const aiInstance = isAdmin ? adminSusanAI : susanAI;
    
    // Process quick actions
    let response;
    switch (action) {
      case 'check_pto':
        response = await aiInstance.processQuery('What is my PTO balance?', context, storage);
        break;
      
      case 'request_pto':
        const { startDate, endDate } = params || {};
        const query = `I need to request PTO from ${startDate} to ${endDate}`;
        response = await aiInstance.processQuery(query, context, storage);
        break;
      
      case 'view_candidates':
        response = await aiInstance.processQuery('Show me current candidates', context, storage);
        break;
      
      case 'manage_agents':
        response = await aiInstance.processQuery('Show HR agent status', context, storage);
        break;
      
      case 'get_help':
        response = await aiInstance.processQuery(params.query || 'How can you help me?', context, storage);
        break;
      
      case 'quick_query':
        // Direct natural language query from anywhere
        response = await aiInstance.processQuery(params.query || '', context, storage);
        break;
      
      default:
        response = {
          message: "I'm here to help! What would you like to know or do?",
          confidence: 1.0,
          suggestions: [
            'Check PTO balance',
            'Request time off',
            'View company policies',
            'Contact HR'
          ]
        };
    }
    
    res.json(response);
  } catch (error) {
    console.error('[SUSAN-AI] Quick action error:', error);
    res.status(500).json({ 
      error: 'Failed to process quick action',
      message: 'I encountered an error. Please try again or contact support.'
    });
  }
});

/**
 * Get daily briefing
 */
router.get('/briefing', async (req, res) => {
  try {
    const context = await buildSusanContext(req);
    const briefing = await susanAI.generateDailyBriefing(context);
    
    // Get metrics based on role
    const metrics: any = {};
    
    if (context.userRole === 'HR_MANAGER' || context.userRole === 'ADMIN') {
      // Get pending PTO count
      const ptoRequests = await req.app.locals.storage.getPtoRequests();
      metrics.pendingPTO = ptoRequests.filter((r: any) => r.status === 'PENDING').length;
      
      // Get new candidates count (last 7 days)
      const candidates = await req.app.locals.storage.getCandidates();
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      metrics.newCandidates = candidates.filter((c: any) => 
        new Date(c.createdAt) > weekAgo
      ).length;
      
      // Get expiring COI documents
      const coiDocs = await req.app.locals.storage.getCoiDocuments();
      const thirtyDays = new Date();
      thirtyDays.setDate(thirtyDays.getDate() + 30);
      metrics.expiringSoon = coiDocs.filter((d: any) => 
        new Date(d.expirationDate) < thirtyDays
      ).length;
    }
    
    // Get user's PTO balance
    if (context.employeeId) {
      const employee = await req.app.locals.storage.getEmployee(context.employeeId);
      if (employee) {
        metrics.ptoBalance = employee.ptoBalance || 0;
      }
    }
    
    // Get tasks (sample data for now)
    const tasks = [
      {
        id: 'task-1',
        title: 'Complete quarterly review',
        priority: 'high',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
    
    // Get upcoming events
    const events = [
      {
        id: 'event-1',
        title: "President's Day Holiday",
        date: '2025-02-17',
        type: 'holiday'
      }
    ];
    
    res.json({
      content: briefing,
      metrics,
      tasks,
      events
    });
  } catch (error) {
    console.error('[SUSAN-AI] Briefing error:', error);
    res.status(500).json({ error: 'Failed to generate briefing' });
  }
});

/**
 * Get suggested questions based on role
 */
router.get('/suggestions', async (req, res) => {
  try {
    const user = req.user as any;
    const role = user?.role || 'EMPLOYEE';
    let questions = [];
    
    if (role === 'HR_MANAGER' || role === 'ADMIN') {
      questions = [
        "Show me the latest candidates",
        "How many PTO requests are pending?",
        "Generate a recruitment pipeline report",
        "Which COI documents are expiring soon?",
        "Show employee headcount by department",
        "What's the average time to hire?"
      ];
    } else if (role === 'MANAGER') {
      questions = [
        "Show me my team members",
        "Who on my team has upcoming PTO?",
        "Generate my team's performance report",
        "What are the open positions in my department?",
        "Show my team's attendance this month"
      ];
    } else {
      questions = [
        "What is my PTO balance?",
        "How do I request time off?",
        "What are the company holidays?",
        "Show me the employee handbook",
        "What are my benefits?",
        "How do I update my contact information?"
      ];
    }
    
    res.json({ questions });
  } catch (error) {
    console.error('[SUSAN-AI] Suggestions error:', error);
    res.json({ questions: [] });
  }
});

/**
 * Update user preferences
 */
const preferencesSchema = z.object({
  dailyBriefing: z.boolean().optional(),
  proactiveAssistance: z.boolean().optional(),
  communicationStyle: z.enum(['formal', 'casual', 'friendly']).optional(),
  notifications: z.enum(['realtime', 'hourly', 'daily', 'off']).optional()
});

router.put('/preferences', async (req, res) => {
  try {
    const preferences = preferencesSchema.parse(req.body);
    
    // Save preferences to user profile
    const user = req.user as any;
    if (user) {
      await req.app.locals.storage.updateUser(user.id, {
        susanPreferences: preferences
      });
    }
    
    res.json({ success: true, preferences });
  } catch (error) {
    console.error('[SUSAN-AI] Preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

/**
 * Execute an action (for advanced users)
 */
const actionSchema = z.object({
  type: z.string(),
  params: z.any()
});

router.post('/action', async (req, res) => {
  try {
    const action = actionSchema.parse(req.body);
    const context = await buildSusanContext(req);
    
    // Check permissions based on action type
    const user = req.user as any;
    if (action.type === 'approve_pto' || action.type === 'deny_pto') {
      // Check if user is Ford Barsi or Ahmed Admin
      const isFordBarsi = user?.email?.toLowerCase().includes('ford') && 
                          user?.email?.toLowerCase().includes('barsi');
      const isAhmedAdmin = user?.email === 'ahmed.mahmoud@roof-hr.com';
      
      if (!isFordBarsi && !isAhmedAdmin && user?.role !== 'ADMIN') {
        return res.status(403).json({ 
          error: 'Only Ford Barsi or Ahmed Admin can approve/deny PTO requests' 
        });
      }
    }
    
    // Process action through Susan AI
    const response = await susanAI.processQuery(
      `Execute action: ${action.type}`,
      context,
      storage
    );
    
    res.json(response);
  } catch (error) {
    console.error('[SUSAN-AI] Action error:', error);
    res.status(500).json({ error: 'Failed to execute action' });
  }
});

/**
 * Get analytics insights for admin users - Returns real-time data from database
 */
router.get('/analytics', async (req, res) => {
  try {
    console.log('[SUSAN-AI] Analytics request received');
    const user = req.user as any;
    const timeframe = req.query.timeframe as string || 'month';
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Only admins and managers can view analytics
    if (!ADMIN_ROLES.includes(user.role) && !MANAGER_ROLES.includes(user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Get real data from database
    const { count, eq, and, gte, sql } = await import('drizzle-orm');
    const { users, ptoRequests, candidates } = await import('@shared/schema');
    
    // Calculate date range based on timeframe
    const now = new Date();
    let startDate = new Date();
    switch (timeframe) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }
    
    // Keep startDate as Date object for database comparison
    // Drizzle timestamp columns expect Date objects, not strings
    
    // Get active employees count
    const [activeEmployeesResult] = await db.select({ count: count() })
      .from(users)
      .where(eq(users.isActive, true));
    
    // Get pending PTO requests
    const [pendingPTOResult] = await db.select({ count: count() })
      .from(ptoRequests)
      .where(eq(ptoRequests.status, 'PENDING'));
    
    // Get open positions (candidates in early stages)
    const [openPositionsResult] = await db.select({ count: count() })
      .from(candidates)
      .where(
        sql`${candidates.status} IN ('APPLIED', 'SCREENING', 'INTERVIEW')`
      );
    
    // Calculate turnover rate (simplified)
    const [inactiveInPeriod] = await db.select({ count: count() })
      .from(users)
      .where(
        and(
          eq(users.isActive, false),
          gte(users.updatedAt, startDate)
        )
      );
    
    const [totalEmployees] = await db.select({ count: count() })
      .from(users);
    
    const turnoverRate = totalEmployees.count > 0 
      ? Math.round((inactiveInPeriod.count / totalEmployees.count) * 100)
      : 0;
    
    // Build response with real data
    const analytics = {
      activeEmployees: activeEmployeesResult?.count || 0,
      pendingPTO: pendingPTOResult?.count || 0,
      openPositions: openPositionsResult?.count || 0,
      turnoverRate: turnoverRate,
      timeframe: timeframe,
      lastUpdated: new Date().toISOString()
    };
    
    // Also generate insights if needed
    const context = await buildSusanContext(req);
    let insights = [];
    try {
      insights = await susanAI.getAnalyticsInsights(context);
    } catch (insightError) {
      console.error('[SUSAN-AI] Error generating insights:', insightError);
      // Continue with empty insights array rather than failing the entire request
    }
    
    // Ensure all data is JSON-serializable
    const response = JSON.parse(JSON.stringify({ 
      ...analytics,
      insights 
    }));
    
    res.json(response);
  } catch (error) {
    console.error('[SUSAN-AI] Analytics error:', error);
    res.status(500).json({ error: 'Failed to generate analytics' });
  }
});

/**
 * Confirm and execute a Susan AI action
 * This endpoint is called when user confirms an action from the confirmation dialog
 */
const confirmActionSchema = z.object({
  confirmationType: z.string(),
  confirmationData: z.object({
    action: z.string(),
  }).passthrough() // Allow additional fields
});

router.post('/confirm-action', async (req, res) => {
  try {
    console.log('[SUSAN-AI] Confirm action endpoint hit');
    const { confirmationType, confirmationData } = confirmActionSchema.parse(req.body);

    const context = await buildSusanContext(req);

    // Get user from context
    const user = await storage.getUserById(context.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
        message: 'Authentication required to execute this action'
      });
    }

    // Check permissions for sensitive actions
    const sensitiveActions = ['confirm_pto_approve', 'confirm_pto_deny', 'confirm_employee_create'];
    if (sensitiveActions.includes(confirmationType)) {
      if (!ADMIN_ROLES.includes(user.role) && !MANAGER_ROLES.includes(user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Permission denied',
          message: 'You do not have permission to execute this action'
        });
      }
    }

    // Execute the confirmed action
    const confirmationHandler = new SusanConfirmationHandler();
    const result = await confirmationHandler.executeConfirmedAction(
      confirmationType,
      confirmationData,
      user
    );

    console.log('[SUSAN-AI] Confirmation result:', result.success ? 'success' : 'failed');

    res.json(result);
  } catch (error: any) {
    console.error('[SUSAN-AI] Confirm action error:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        message: 'The confirmation data was not in the expected format'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to execute action',
      message: error.message || 'An unexpected error occurred'
    });
  }
});

/**
 * Chat Sessions - Persistent conversation history
 */

// Get all chat sessions for current user
router.get('/sessions', async (req, res) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const sessions = await storage.getSusanChatSessionsByUserId(user.id);
    res.json(sessions.map(s => ({
      ...s,
      messages: JSON.parse(s.messages || '[]')
    })));
  } catch (error) {
    console.error('[SUSAN-AI] Get sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch chat sessions' });
  }
});

// Get or create active session for current user
router.get('/sessions/active', async (req, res) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let session = await storage.getActiveSusanChatSession(user.id);

    // Create new session if none exists
    if (!session) {
      session = await storage.createSusanChatSession(user.id, 'New Conversation');
    }

    res.json({
      ...session,
      messages: JSON.parse(session.messages || '[]')
    });
  } catch (error) {
    console.error('[SUSAN-AI] Get active session error:', error);
    res.status(500).json({ error: 'Failed to get active session' });
  }
});

// Create new chat session
router.post('/sessions', async (req, res) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { title } = req.body;

    // Deactivate all existing sessions
    await storage.deactivateAllSusanChatSessions(user.id);

    // Create new session
    const session = await storage.createSusanChatSession(user.id, title || 'New Conversation');

    res.json({
      ...session,
      messages: []
    });
  } catch (error) {
    console.error('[SUSAN-AI] Create session error:', error);
    res.status(500).json({ error: 'Failed to create chat session' });
  }
});

// Get specific session
router.get('/sessions/:id', async (req, res) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const session = await storage.getSusanChatSessionById(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check ownership
    if (session.userId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      ...session,
      messages: JSON.parse(session.messages || '[]')
    });
  } catch (error) {
    console.error('[SUSAN-AI] Get session error:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// Switch to a different session
router.post('/sessions/:id/activate', async (req, res) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const session = await storage.getSusanChatSessionById(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.userId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Deactivate all other sessions
    await storage.deactivateAllSusanChatSessions(user.id);

    // Activate this session
    const updated = await storage.updateSusanChatSession(req.params.id, { isActive: true });

    res.json({
      ...updated,
      messages: JSON.parse(updated?.messages || '[]')
    });
  } catch (error) {
    console.error('[SUSAN-AI] Activate session error:', error);
    res.status(500).json({ error: 'Failed to activate session' });
  }
});

// Delete a session
router.delete('/sessions/:id', async (req, res) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const session = await storage.getSusanChatSessionById(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.userId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await storage.deleteSusanChatSession(req.params.id);

    res.json({ success: true });
  } catch (error) {
    console.error('[SUSAN-AI] Delete session error:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// Chat with session persistence
router.post('/chat/session', async (req, res) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { message, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get or create session
    let session;
    if (sessionId) {
      session = await storage.getSusanChatSessionById(sessionId);
      if (!session || session.userId !== user.id) {
        return res.status(404).json({ error: 'Session not found' });
      }
    } else {
      session = await storage.getActiveSusanChatSession(user.id);
      if (!session) {
        session = await storage.createSusanChatSession(user.id, 'New Conversation');
      }
    }

    // Parse existing messages
    const messages = JSON.parse(session.messages || '[]');

    // Build context
    const context = await buildSusanContext(req);
    context.sessionHistory = messages;

    // Add user message
    const userMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    messages.push(userMessage);

    // Use appropriate AI instance
    const isAdmin = context.userRole === 'ADMIN' ||
                   (context.userRole === 'MANAGER' && isAuthorizedManager(context.userId));
    const aiInstance = isAdmin ? adminSusanAI : susanAI;

    // Process query
    const response = await aiInstance.processQuery(message, context, storage);

    // Add assistant response
    const assistantMessage = {
      role: 'assistant',
      content: response.message,
      timestamp: new Date().toISOString()
    };
    messages.push(assistantMessage);

    // Keep only last 50 messages per session
    const trimmedMessages = messages.slice(-50);

    // Update title based on first message if it's a new conversation
    let newTitle = session.title;
    if (messages.length <= 2 && message.length > 0) {
      // Use first 50 chars of user's first message as title
      newTitle = message.slice(0, 50) + (message.length > 50 ? '...' : '');
    }

    // Persist to database
    await storage.updateSusanChatSession(session.id, {
      messages: JSON.stringify(trimmedMessages),
      title: newTitle ?? undefined
    });

    res.json({
      ...response,
      sessionId: session.id
    });
  } catch (error) {
    console.error('[SUSAN-AI] Session chat error:', error);
    res.status(500).json({
      error: 'Failed to process your request',
      message: 'I apologize, but I encountered an error. Please try again.'
    });
  }
});

export default router;