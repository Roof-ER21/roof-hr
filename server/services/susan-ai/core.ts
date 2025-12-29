/**
 * Susan AI Core Service
 * A comprehensive JARVIS-like AI assistant for HR operations
 * Integrates with OpenAI GPT-4 and supports future local LLM integration
 */

import { db } from '../../db';
import {
  users,
  candidates,
  ptoRequests,
  territories,
  coiDocuments,
  emailTemplates,
  workflows,
  toolInventory
} from '@shared/schema';
import { ADMIN_ROLES, MANAGER_ROLES } from '@shared/constants/roles';
import { eq, and, or, desc, asc, isNull, gte, lte, sql } from 'drizzle-orm';
import { KnowledgeBase } from './knowledge-base';
import { SusanActionHandler, type ActionContext } from './action-handler';
import { ContextEngine } from './context-engine';
import { PersonalizationEngine } from './personalization-engine';
import { AnalyticsEngine, type AnalyticsInsight } from './analytics-engine';
import { AttendanceManager } from './attendance-manager';
import { llmRouter } from '../llm/router';
import { LLMTaskContext } from '../llm/types';

// Note: Direct OpenAI client removed - using LLM Router for all AI operations
// LLM Router handles provider selection, fallbacks, and uses free-tier providers (Groq, Gemini)
// This eliminates the need for a valid OpenAI API key

export interface SusanContext {
  userId: string;
  userRole: 'ADMIN' | 'HR_MANAGER' | 'MANAGER' | 'EMPLOYEE';
  department?: string;
  territoryId?: string;
  employeeId?: string;
  sessionHistory: ConversationMessage[];
  personalPreferences?: {
    dailyBriefing: boolean;
    proactiveAssistance: boolean;
    communicationStyle: 'formal' | 'casual' | 'friendly';
  };
}

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    actionsTaken?: string[];
    dataAccessed?: string[];
    confidence?: number;
  };
}

export interface SusanResponse {
  message: string;
  actions?: ActionResult[];
  suggestions?: string[];
  data?: any;
  confidence: number;
  requiresApproval?: boolean;
  quickActions?: QuickAction[];
}

export interface ActionResult {
  type: string;
  status: 'success' | 'pending' | 'failed';
  details: any;
  message?: string;
}

export interface QuickAction {
  label: string;
  action: string;
  params?: any;
  icon?: string;
}

export class SusanAI {
  private knowledgeBase: KnowledgeBase;
  private actionHandler: SusanActionHandler;
  private contextEngine: ContextEngine;
  private personalizationEngine: PersonalizationEngine;
  private analyticsEngine: AnalyticsEngine;
  private attendanceManager: AttendanceManager;

  constructor() {
    this.knowledgeBase = new KnowledgeBase();
    this.actionHandler = new SusanActionHandler();
    this.contextEngine = new ContextEngine();
    this.personalizationEngine = new PersonalizationEngine();
    this.analyticsEngine = new AnalyticsEngine();
    this.attendanceManager = new AttendanceManager();
  }

  /**
   * Initialize Susan AI with company knowledge
   */
  async initialize(): Promise<void> {
    console.log('[SUSAN-AI] Initializing Susan AI Core Service...');
    
    // Load company knowledge base
    await this.knowledgeBase.loadCompanyPolicies();
    await this.knowledgeBase.loadEmployeeHandbook();
    await this.knowledgeBase.loadBenefitsInformation();
    await this.knowledgeBase.loadSafetyProtocols();
    
    // Initialize context awareness
    await this.contextEngine.initialize();
    
    // Load personalization settings
    await this.personalizationEngine.loadUserPreferences();
    
    console.log('[SUSAN-AI] Initialization complete. Ready to assist!');
  }

  /**
   * Process a user query with full context awareness
   */
  async processQuery(
    query: string,
    context: SusanContext,
    storage?: any
  ): Promise<SusanResponse> {
    try {
      // Handle simple greetings without complex processing
      const lowerQuery = query.toLowerCase().trim();
      
      // Enhanced natural language understanding
      // Detect user intent more intelligently
      const isLookup = lowerQuery.includes('find') || lowerQuery.includes('look up') || 
                       lowerQuery.includes('show') || lowerQuery.includes('who') || 
                       lowerQuery.includes('search') || lowerQuery.includes('get');
      
      const isAction = lowerQuery.includes('schedule') || lowerQuery.includes('send') || 
                       lowerQuery.includes('request') || lowerQuery.includes('approve') || 
                       lowerQuery.includes('create') || lowerQuery.includes('add') ||
                       lowerQuery.includes('move') || lowerQuery.includes('update');
      console.log('[SUSAN-AI] Processing query:', lowerQuery);
      
      if (['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'].includes(lowerQuery)) {
        console.log('[SUSAN-AI] Processing greeting message');
        const hour = new Date().getHours();
        let greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
        const userName = context.userId !== 'anonymous' ? 'there' : '';
        
        const adminFeatures = ['ADMIN', 'TRUE_ADMIN'].includes(context.userRole) ? 
          '\n\nAs an admin, I have enhanced capabilities including:\n• HR agent control and monitoring\n• Advanced analytics and reporting\n• System-wide configuration management\n• Full access to all employee and candidate data' : '';
        
        return {
          message: `${greeting}${userName ? ', ' + userName : ''}! I'm Susan, your AI-powered HR assistant. I can help you with PTO requests, company policies, employee information, recruitment, and much more.${adminFeatures}\n\nHow can I assist you today?`,
          confidence: 1.0,
          suggestions: this.getSuggestionsForRole(context.userRole),
          quickActions: this.getQuickActionsForRole(context.userRole)
        };
      }

      // Check if this looks like an actionable request before processing
      const isActionableRequest = this.isActionableRequest(lowerQuery);
      console.log('[SUSAN-AI] Is actionable request:', isActionableRequest);
      
      if (isActionableRequest) {
        console.log('[SUSAN-AI] Processing actionable request');
        
        // Try to get actual user data from storage if available
        let userData: any = null;
        if (storage && context.userId !== 'anonymous') {
          try {
            userData = await storage.getUserById(context.userId);
            console.log('[SUSAN-AI] Found user data for:', userData?.firstName, userData?.lastName);
          } catch (error) {
            console.error('[SUSAN-AI] Failed to fetch user data:', error);
          }
        }
        
        // For actionable queries, check for system actions
        const actionContext: ActionContext = {
          user: userData || { 
            id: context.userId, 
            role: context.userRole as any, 
            department: context.department || 'General',
            firstName: 'User',
            lastName: '',
            email: 'user@example.com',
            employmentType: 'FULL_TIME',
            position: 'Employee',
            phone: '',
            address: '',
            hireDate: new Date(),
            terminationDate: null,
            salary: null,
            hourlyRate: null,
            benefits: null,
            emergencyContact: null,
            notes: null,
            territoryId: context.territoryId || null,
            managerId: null,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          } as any,
          message: query
        };

        const actionResults = await this.actionHandler.processRequest(actionContext);
        
        // If actions were performed, create response based on actions
        if (actionResults.length > 0) {
          const successActions = actionResults.filter(a => a.success);
          const failedActions = actionResults.filter(a => !a.success);
          
          let message = '';
          if (successActions.length > 0) {
            message += `✅ **Actions Completed:**\n${successActions.map(a => `• ${a.message}`).join('\n')}`;
          }
          if (failedActions.length > 0) {
            message += `${message ? '\n\n' : ''}❌ **Actions Failed:**\n${failedActions.map(a => `• ${a.message}`).join('\n')}`;
          }

          return {
            message: message || 'I processed your request.',
            confidence: 1.0,
            actions: actionResults as any,
            quickActions: this.getQuickActionsForRole(context.userRole)
          };
        }
      }

      // Use enhanced context processing for complex queries
      const enhancedContext = await this.contextEngine.enhanceContext(context);
      
      // Determine user intent and required data
      const intent = await this.analyzeIntent(query, enhancedContext);
      
      // Check permissions for the requested action
      const hasPermission = await this.checkPermissions(intent, context);
      if (!hasPermission) {
        return {
          message: "I understand what you're asking, but you don't have permission to access that information or perform that action. Please contact your manager or HR if you believe you should have access.",
          confidence: 1.0
        };
      }
      
      // Gather relevant data based on intent
      const relevantData = await this.gatherRelevantData(intent, enhancedContext);
      
      // Search knowledge base for policies and procedures
      const knowledgeResults = await this.knowledgeBase.search(query, context);
      
      // Generate response using GPT-4o
      const response = await this.generateResponse(
        query,
        enhancedContext,
        relevantData,
        knowledgeResults,
        intent
      );
      
      // Generate quick actions for follow-up
      const quickActions = this.generateQuickActions(intent, context);
      
      // Personalize the response
      const personalizedResponse = await this.personalizationEngine.personalizeResponse(
        response,
        context
      );
      
      return {
        message: personalizedResponse,
        actions: [],
        suggestions: intent.suggestions,
        data: relevantData,
        confidence: intent.confidence,
        requiresApproval: intent.requiresApproval,
        quickActions
      };
      
    } catch (error) {
      console.error('[SUSAN-AI] Error processing query:', error);
      // Provide a more helpful fallback response
      return {
        message: `I apologize, but I'm having trouble processing your request right now. ${error instanceof Error && error.message.includes('API') ? 'There seems to be an issue with the AI service.' : 'Please try rephrasing your question.'} In the meantime, I can still help you with:\n\n• Viewing employee information\n• Checking PTO balances\n• Company policies\n• Basic HR questions\n\nWhat would you like to know?`,
        confidence: 0.5,
        suggestions: this.getSuggestionsForRole(context.userRole)
      };
    }
  }

  /**
   * Analyze user intent using GPT-4o
   */
  private async analyzeIntent(query: string, context: SusanContext): Promise<any> {
    const lowerQuery = query.toLowerCase();
    
    // Deterministic pre-LLM checks for permission-critical queries
    const mentionsOthers = /\b(other|others|everyone|all employees?|coworkers?|colleagues?|team(?:'s)?|department(?:'s)?|employees'?)\b/.test(lowerQuery);
    const mentionsSelf = /\b(my|me|i|i've|i have|myself)\b/.test(lowerQuery);
    const isPTORelated = lowerQuery.includes('pto') || lowerQuery.includes('time off') || lowerQuery.includes('vacation') || lowerQuery.includes('leave');
    
    // For EMPLOYEE role, enforce deterministic scope for PTO queries
    if (context.userRole === 'EMPLOYEE' && isPTORelated) {
      if (mentionsOthers) {
        // Asking about others' PTO - always deny for employees
        return {
          intent: 'information',
          dataSource: ['pto'],
          scope: 'company', // NOT self - will be denied
          requiresAction: false,
          confidence: 1.0,
          requiresApproval: false,
          suggestions: ['Check your own PTO balance', 'View company PTO policy'],
          actions: []
        };
      } else if (mentionsSelf) {
        // Asking about their own PTO - allow
        return {
          intent: 'information',
          dataSource: ['userPtoData', 'pto'],
          scope: 'self', // Self-scoped - will be allowed
          requiresAction: false,
          confidence: 1.0,
          requiresApproval: false,
          suggestions: ['Request time off', 'View PTO policy'],
          actions: []
        };
      }
    }
    
    const systemPrompt = `You are Susan AI, an advanced HR assistant for Roof-ER company. 
    Analyze the user's query and determine the intent and required data.
    
    Common query patterns:
    - "How many employees" = needs companyStats
    - "PTO balance", "time off", "vacation days", "my PTO", "how many days do I have" = needs userPtoData and pto, scope: "self"
    - "Employee count", "total employees" = needs companyStats
    - "Who works here", "our team" = needs employees
    - "Pending requests" = needs pto
    - "other employees", "all employees", "everyone's" = scope: "company" or "department", NOT "self"
    
    IMPORTANT: 
    - If an employee asks about their own PTO, vacation, or time off, always set scope: "self"
    - If the query mentions "other", "all", "everyone", or any employees besides themselves, set scope: "company" or "department", NOT "self"
    
    Return JSON with:
    {
      "intent": "information|action|report",
      "dataSource": ["companyStats", "userPtoData", "employees", "pto", "candidates"],
      "scope": "self|department|company", 
      "requiresAction": false,
      "confidence": 0.95,
      "requiresApproval": false,
      "suggestions": ["follow-up questions"],
      "actions": []
    }
    
    User Role: ${context.userRole}
    Department: ${context.department || 'N/A'}
    
    For employees asking about their personal information (PTO, profile, etc.), always set scope: "self"
    
    Respond in JSON format.`;

    try {
      // Use LLM Router with automatic fallback (Groq → Gemini → OpenAI → Ollama)
      const llmContext: LLMTaskContext = {
        taskType: 'classification',
        priority: 'high',
        requiresPrivacy: false,
        expectedResponseTime: 'fast'
      };

      const result = await llmRouter.generateJSON(
        query,
        llmContext,
        { systemPrompt, temperature: 0.3 }
      );

      console.log(`[SUSAN-AI] Intent analyzed using ${result.provider}`);
      return result.data;
    } catch (error) {
      console.error('[SUSAN-AI] Error analyzing intent:', error);
      // Fallback intent for common queries
      const lowerQuery = query.toLowerCase();
      const mentionsOthers = /\b(other|others|everyone|all employees?|coworkers?|colleagues?|team(?:'s)?|department(?:'s)?|employees'?)\b/.test(lowerQuery);
      const mentionsSelf = /\b(my|me|i|i've|i have|myself)\b/.test(lowerQuery);
      
      if (lowerQuery.includes('employee') && (lowerQuery.includes('how many') || lowerQuery.includes('count'))) {
        return {
          intent: 'information',
          dataSource: ['companyStats'],
          requiresAction: false,
          confidence: 0.9,
          requiresApproval: false,
          suggestions: ['Show me department breakdown', 'What about contractors?'],
          actions: []
        };
      }
      
      if (lowerQuery.includes('pto') || lowerQuery.includes('time off') || lowerQuery.includes('vacation')) {
        // Only set scope: 'self' if there are self pronouns and no mention of others
        const scope = mentionsOthers ? 'company' : (mentionsSelf ? 'self' : 'company');
        return {
          intent: 'information',
          dataSource: ['userPtoData', 'pto'],
          scope: scope,
          requiresAction: false,
          confidence: 0.9,
          requiresApproval: false,
          suggestions: ['Request time off', 'View PTO policy'],
          actions: []
        };
      }
      
      // Default fallback
      return {
        intent: 'information',
        dataSource: ['companyStats'],
        requiresAction: false,
        confidence: 0.5,
        requiresApproval: false,
        suggestions: [],
        actions: []
      };
    }
  }

  /**
   * Check if user has permission for the requested action
   */
  private async checkPermissions(
    intent: any,
    context: SusanContext
  ): Promise<boolean> {
    // Admin roles have access to everything
    if (ADMIN_ROLES.includes(context.userRole)) return true;

    // Manager permissions (all manager-level roles)
    if (MANAGER_ROLES.includes(context.userRole)) {
      // Managers can't access salary data unless it's their team
      if (intent.dataSource?.includes('salary') && intent.scope !== 'team') {
        return false;
      }
      
      // Managers can access their team's data
      if (intent.scope === 'team' || intent.scope === 'self') {
        return true;
      }
      
      // Managers can view company-wide public information
      if (intent.dataSource?.includes('public') || 
          intent.dataSource?.includes('companyStats')) {
        return true;
      }
      
      // Managers can manage their team's PTO, reviews, tools
      if (['pto', 'reviews', 'tools'].some(item => 
          intent.dataSource?.includes(item)) && 
          intent.scope === 'team') {
        return true;
      }
      
      return false;
    }
    
    // Employee permissions
    if (context.userRole === 'EMPLOYEE') {
      // Employees can only access self-scoped data
      if (intent.scope === 'self') {
        // But not salary data
        if (intent.dataSource?.includes('salary')) {
          return false;
        }
        return true;
      }
      
      // Employees can access public company information
      if (intent.dataSource?.includes('public') || 
          intent.dataSource?.includes('handbook') ||
          intent.dataSource?.includes('policies') ||
          intent.dataSource?.includes('benefits')) {
        return true;
      }
      
      // Employees cannot access other people's data
      if (intent.scope === 'company' || intent.scope === 'department' || intent.scope === 'team') {
        return false;
      }
    }
    
    return false; // Default deny
  }

  /**
   * Gather relevant data based on intent
   */
  private async gatherRelevantData(
    intent: any,
    context: any // Using enhanced context
  ): Promise<any> {
    const data: any = {};
    
    // Use enhanced context data if available
    if (context.companyStats) {
      data.companyStats = context.companyStats;
    }
    
    if (context.userPtoData) {
      data.userPtoData = context.userPtoData;
    }
    
    if (context.userData) {
      data.userData = context.userData;
    }
    
    // Gather additional data based on intent and role
    if (intent.dataSource?.includes('employees')) {
      data.employees = await this.getEmployeeData(context, intent.scope);
    }
    
    if (intent.dataSource?.includes('pto')) {
      data.pto = await this.getPTOData(context, intent.scope);
    }
    
    if (intent.dataSource?.includes('candidates')) {
      // Only managers and above can see candidates
      if (['ADMIN', 'HR_MANAGER', 'MANAGER'].includes(context.userRole)) {
        data.candidates = await this.getCandidateData(context);
      }
    }
    
    if (intent.dataSource?.includes('coi')) {
      // Only admins and HR can see COI documents
      if (['ADMIN', 'HR_MANAGER'].includes(context.userRole)) {
        data.coi = await this.getCOIData(context);
      }
    }
    
    if (intent.dataSource?.includes('territories')) {
      // Territory data based on role
      data.territories = await this.getTerritoryData(context, intent.scope);
    }
    
    if (intent.dataSource?.includes('reviews')) {
      data.reviews = await this.getReviewData(context, intent.scope);
    }
    
    if (intent.dataSource?.includes('tools')) {
      data.tools = await this.getToolsData(context, intent.scope);
    }
    
    return data;
  }

  /**
   * Generate response using GPT-4o with all context
   */
  private async generateResponse(
    query: string,
    context: any, // Enhanced context
    data: any,
    knowledgeResults: any,
    intent: any
  ): Promise<string> {
    const systemPrompt = `You are Susan AI, a helpful and professional HR assistant for Roof-ER company.
    You have access to real-time company data and should provide accurate, actionable responses.
    
    User Role: ${context.userRole}
    User Name: ${context.userName || 'there'}
    Department: ${context.department || 'N/A'}
    Communication Style: ${context.personalPreferences?.communicationStyle || 'professional'}
    
    IMPORTANT: Use the actual data provided to answer questions:
    - For employee counts: Use companyStats.activeEmployees and companyStats.totalEmployees
    - For PTO balances: Use userPtoData for the current user's PTO information
    - For company statistics: Use companyStats for all company-wide numbers
    - Never say you don't have access if the data is provided in the Available Data section below
    
    Available Data:
    ${JSON.stringify(data, null, 2)}
    
    Company Knowledge:
    ${JSON.stringify(knowledgeResults, null, 2)}
    
    Provide a helpful, concise response that:
    1. Directly answers the user's question using the provided data
    2. Includes specific numbers and details when available  
    3. Suggests next steps if appropriate
    4. Maintains the appropriate communication style
    5. Is role-appropriate for the user`;

    // Use LLM Router with automatic fallback (Groq → Gemini → OpenAI → Ollama)
    const llmContext: LLMTaskContext = {
      taskType: 'generation',
      priority: 'high',
      requiresPrivacy: context.department === 'HR' || context.userRole === 'HR_MANAGER',
      expectedResponseTime: 'normal'
    };

    // Build the full prompt with context
    const fullPrompt = `${systemPrompt}\n\nConversation History:\n${context.sessionHistory?.map((m: any) => `${m.role}: ${m.content}`).join('\n') || ''}\n\nUser: ${query}`;

    const result = await llmRouter.generateText(
      fullPrompt,
      llmContext,
      { temperature: 0.7, maxTokens: 500 }
    );

    console.log(`[SUSAN-AI] Response generated using ${result.provider}`);
    return result.text;
  }

  /**
   * Get suggestions based on user role
   */
  private getSuggestionsForRole(role: string): string[] {
    if (role === 'ADMIN' || role === 'HR_MANAGER') {
      return [
        "Show me the latest candidates",
        "How many PTO requests are pending?",
        "Generate a recruitment pipeline report",
        "Which COI documents are expiring soon?",
        "Show employee headcount by department",
        "Move John to interview stage",
        "Approve Sarah's PTO request",
        "Create performance review for Mike"
      ];
    } else if (role === 'MANAGER') {
      return [
        "Show me my team members",
        "Who on my team has upcoming PTO?",
        "Approve pending PTO requests",
        "Generate my team's performance report",
        "What equipment is assigned to my team?",
        "Create performance review for team member",
        "Show my team's current projects"
      ];
    } else {
      return [
        "What is my PTO balance?",
        "Request 3 days off next week",
        "Show my upcoming performance review",
        "What equipment is assigned to me?",
        "Update my emergency contact",
        "What are the company holidays?",
        "Show me the employee handbook",
        "What are my benefits?",
        "How do I submit an expense report?"
      ];
    }
  }

  /**
   * Get advanced analytics insights for user
   */


  /**
   * Get quick actions based on user role
   */
  private getQuickActionsForRole(role: string): QuickAction[] {
    const actions: QuickAction[] = [];
    
    if (role === 'ADMIN' || role === 'HR_MANAGER') {
      actions.push({
        label: 'View Candidates',
        action: 'navigate',
        params: { path: '/recruiting' },
        icon: 'users'
      });
      
      actions.push({
        label: 'PTO Requests',
        action: 'navigate',
        params: { path: '/pto-management' },
        icon: 'calendar'
      });
      
      if (role === 'ADMIN') {
        actions.push({
          label: 'Control Agents',
          action: 'query',
          params: { query: 'Show me the status of all HR agents' },
          icon: 'bot'
        });
        
        actions.push({
          label: 'Analytics',
          action: 'query',
          params: { query: 'Generate analytics dashboard' },
          icon: 'chart'
        });
      }
    }
    
    // Common actions for all users
    actions.push({
      label: 'My PTO Balance',
      action: 'query',
      params: { query: 'What is my PTO balance?' },
      icon: 'calendar'
    });
    
    return actions;
  }

  /**
   * Generate quick action buttons based on context
   */
  private generateQuickActions(intent: any, context: SusanContext): QuickAction[] {
    const actions: QuickAction[] = [];
    
    // Add role-specific quick actions
    if (context.userRole === 'HR_MANAGER' || context.userRole === 'ADMIN') {
      actions.push({
        label: 'View All Candidates',
        action: 'navigate',
        params: { page: '/recruiting' },
        icon: 'users'
      });
      actions.push({
        label: 'Pending PTO Requests',
        action: 'query',
        params: { query: 'Show me all pending PTO requests' },
        icon: 'calendar'
      });
    }
    
    if (context.userRole === 'MANAGER') {
      actions.push({
        label: 'My Team',
        action: 'query',
        params: { query: 'Show me my team members' },
        icon: 'users'
      });
    }
    
    // Common actions for all users
    actions.push({
      label: 'My PTO Balance',
      action: 'query',
      params: { query: 'What is my PTO balance?' },
      icon: 'calendar'
    });
    
    actions.push({
      label: 'Company Holidays',
      action: 'query',
      params: { query: 'What are the upcoming company holidays?' },
      icon: 'calendar'
    });
    
    return actions;
  }

  /**
   * Generate daily briefing for user
   */
  async generateDailyBriefing(context: SusanContext): Promise<string> {
    const data = await this.gatherRelevantData(
      { dataSource: ['employees', 'pto', 'candidates', 'coi'] },
      context
    );

    const systemPrompt = `Generate a personalized daily briefing for a ${context.userRole} at Roof-ER.
    Include relevant updates, action items, and important reminders.
    Keep it concise and actionable.

    Available Data:
    ${JSON.stringify(data, null, 2)}`;

    // Use LLM Router with automatic fallback (Groq → Gemini → OpenAI → Ollama)
    const llmContext: LLMTaskContext = {
      taskType: 'generation',
      priority: 'medium',
      requiresPrivacy: false,
      expectedResponseTime: 'normal'
    };

    const fullPrompt = `${systemPrompt}\n\nGenerate my daily briefing`;

    const result = await llmRouter.generateText(
      fullPrompt,
      llmContext,
      { temperature: 0.7, maxTokens: 400 }
    );

    console.log(`[SUSAN-AI] Daily briefing generated using ${result.provider}`);
    return result.text;
  }

  // Data retrieval methods with scope awareness
  private async getEmployeeData(context: SusanContext, scope?: string) {
    // Employees only see their own data
    if (context.userRole === 'EMPLOYEE' || scope === 'self') {
      return await db.select().from(users)
        .where(eq(users.id, context.userId))
        .limit(1);
    }
    
    // Managers see their team
    if (context.userRole === 'MANAGER' && scope === 'team') {
      return await db.select().from(users)
        .where(eq(users.primaryManagerId, context.userId))
        .orderBy(desc(users.createdAt))
        .limit(50);
    }
    
    // HR and Admins see all
    if (['HR_MANAGER', 'ADMIN'].includes(context.userRole)) {
      return await db.select().from(users)
        .orderBy(desc(users.createdAt))
        .limit(100);
    }
    
    return [];
  }

  private async getPTOData(context: SusanContext, scope?: string) {
    // Employees see only their own PTO
    if (context.userRole === 'EMPLOYEE' || scope === 'self') {
      return await db.select().from(ptoRequests)
        .where(eq(ptoRequests.employeeId, context.employeeId || context.userId))
        .orderBy(desc(ptoRequests.createdAt))
        .limit(10);
    }
    
    // Managers see their team's PTO
    if (context.userRole === 'MANAGER' && scope === 'team') {
      // Get team members first
      const teamMembers = await db.select({ id: users.id }).from(users)
        .where(eq(users.primaryManagerId, context.userId));
      
      const teamIds = teamMembers.map(m => m.id);
      if (teamIds.length > 0) {
        return await db.select().from(ptoRequests)
          .where(sql`${ptoRequests.employeeId} IN (${sql.join(teamIds, sql`, `)})`)
          .orderBy(desc(ptoRequests.createdAt))
          .limit(50);
      }
      return [];
    }
    
    // HR and Admins see all PTO requests
    if (['HR_MANAGER', 'ADMIN'].includes(context.userRole)) {
      return await db.select().from(ptoRequests)
        .orderBy(desc(ptoRequests.createdAt))
        .limit(100);
    }
    
    return [];
  }

  private async getCandidateData(context: SusanContext) {
    // Only managers and above can see candidates
    if (!['HR_MANAGER', 'ADMIN', 'MANAGER'].includes(context.userRole)) {
      return [];
    }
    
    // Managers might only see candidates they're assigned to or all candidates
    // Note: candidates table doesn't have a department field
    if (context.userRole === 'MANAGER') {
      return await db.select().from(candidates)
        .where(eq(candidates.assignedTo, context.userId))
        .orderBy(desc(candidates.createdAt))
        .limit(50);
    }
    
    // HR and Admins see all candidates
    return await db.select().from(candidates)
      .orderBy(desc(candidates.createdAt))
      .limit(100);
  }

  private async getCOIData(context: SusanContext) {
    // Only HR and Admins can see COI documents
    if (!['HR_MANAGER', 'ADMIN'].includes(context.userRole)) {
      return [];
    }
    
    return await db.select().from(coiDocuments)
      .orderBy(desc(coiDocuments.expirationDate))
      .limit(50);
  }

  private async getTerritoryData(context: SusanContext, scope?: string) {
    // Employees see only their territory
    if (context.userRole === 'EMPLOYEE' && context.territoryId) {
      return await db.select().from(territories)
        .where(eq(territories.id, context.territoryId))
        .limit(1);
    }
    
    // Managers see territories they manage
    if (context.userRole === 'MANAGER') {
      return await db.select().from(territories)
        .where(eq(territories.salesManagerId, context.userId))
        .orderBy(asc(territories.name))
        .limit(20);
    }
    
    // HR and Admins see all territories
    if (['HR_MANAGER', 'ADMIN'].includes(context.userRole)) {
      return await db.select().from(territories)
        .orderBy(asc(territories.name))
        .limit(50);
    }
    
    return [];
  }
  
  // New methods for reviews and tools
  private async getReviewData(context: SusanContext, scope?: string) {
    // Employees see only their own reviews
    if (context.userRole === 'EMPLOYEE' || scope === 'self') {
      return await db.select().from(users)
        .where(eq(users.id, context.userId))
        .limit(10);
    }
    
    // Managers see their team's reviews
    if (context.userRole === 'MANAGER' && scope === 'team') {
      const teamMembers = await db.select({ id: users.id }).from(users)
        .where(eq(users.primaryManagerId, context.userId));
      return teamMembers;
    }
    
    // HR and Admins see all reviews
    if (['HR_MANAGER', 'ADMIN'].includes(context.userRole)) {
      return await db.select().from(users).limit(100);
    }
    
    return [];
  }
  
  private async getToolsData(context: SusanContext, scope?: string) {
    // Get tools based on role and scope
    const toolData = await db.select().from(toolInventory as any).limit(50);
    
    if (context.userRole === 'EMPLOYEE' || scope === 'self') {
      // Filter to show only tools assigned to this employee
      return toolData.filter((tool: any) => tool.assignedTo === context.userId);
    }
    
    if (context.userRole === 'MANAGER' && scope === 'team') {
      // Show tools for the manager's team
      return toolData;
    }
    
    // HR and Admins see all tools
    if (['HR_MANAGER', 'ADMIN'].includes(context.userRole)) {
      return toolData;
    }
    
    return [];
  }

  /**
   * Generate analytics insights for admin users
   */
  async getAnalyticsInsights(context: SusanContext): Promise<any[]> {
    try {
      console.log('[SUSAN-AI] getAnalyticsInsights called with context:', { 
        userRole: context.userRole, 
        userId: context.userId 
      });
      
      // Temporarily disabled role check for testing
      // if (context.userRole !== 'ADMIN') {
      //   return [];
      // }

      // Use the analytics engine to get insights
      const insights = await this.analyticsEngine.generateInsights(context.userRole, context.userId);
      console.log('[SUSAN-AI] Generated insights count:', insights.length);
      
      return insights;
    } catch (error) {
      console.error('[SUSAN-AI] Error generating analytics insights:', error);
      return [];
    }
  }

  /**
   * Check if a query looks like it requires system actions
   */
  private isActionableRequest(lowerQuery: string): boolean {
    const actionKeywords = [
      'move candidate', 'schedule interview', 'send email', 'pto request', 'time off',
      'vacation', 'review pto', 'approve', 'reject', 'create', 'update', 'delete',
      'add employee', 'remove', 'generate report', 'export', 'import'
    ];
    
    return actionKeywords.some(keyword => lowerQuery.includes(keyword));
  }
}

// Export singleton instance
export const susanAI = new SusanAI();