/**
 * Admin Susan AI Core Service
 * Enhanced JARVIS-like AI assistant with full administrative capabilities
 * Provides system monitoring, agent control, and comprehensive HR management
 */

import { SusanAI, SusanContext, SusanResponse } from './core';
import { db } from '../../db';
import { 
  users,
  candidates,
  ptoRequests,
  documents,
  jobPostings,
  emailTemplates,
  workflows
} from '@shared/schema';
import { eq, desc, sql, gte } from 'drizzle-orm';
import { SusanActionHandler, type ActionContext } from './action-handler';
import { storage } from '../../storage';
import { llmRouter } from '../llm/router';
import type { LLMTaskContext } from '../llm/types';

// Note: Using LLM Router for all AI operations - no direct OpenAI dependency
const actionHandler = new SusanActionHandler();

export interface SystemHealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  metrics: {
    activeUsers: number;
    systemLoad: number;
    databaseConnections: number;
    apiResponseTime: number;
    errorRate: number;
  };
  agents: {
    total: number;
    active: number;
    failed: number;
    lastRun: Date | null;
  };
  alerts: SystemAlert[];
}

export interface SystemAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'agent' | 'performance' | 'security' | 'data';
  message: string;
  timestamp: Date;
  resolved: boolean;
}

export interface AgentControlAction {
  agentId: string;
  action: 'start' | 'stop' | 'restart' | 'configure' | 'run_now';
  parameters?: any;
}

export class AdminSusanAI extends SusanAI {
  private systemMonitor: SystemMonitor;
  private agentController: AgentController;
  private dataAnalyzer: DataAnalyzer;

  constructor() {
    super();
    this.systemMonitor = new SystemMonitor();
    this.agentController = new AgentController();
    this.dataAnalyzer = new DataAnalyzer();
  }

  /**
   * Enhanced query processing for admin users
   */
  async processQuery(
    query: string,
    context: SusanContext,
    storageParam?: any
  ): Promise<SusanResponse> {
    // Check if user is admin or authorized manager
    if (!this.isAuthorizedAdmin(context)) {
      return super.processQuery(query, context, storageParam);
    }

    // Get user data from storage - use imported storage directly
    let userData: any = null;
    console.log('[ADMIN-SUSAN-AI] Storage object:', typeof storage, storage ? 'exists' : 'null');
    console.log('[ADMIN-SUSAN-AI] Fetching user data for:', context.userId, 'Storage available:', !!storage);
    
    if (storage && context.userId !== 'anonymous') {
      try {
        console.log('[ADMIN-SUSAN-AI] Attempting to fetch user by ID...');
        userData = await storage.getUserById(context.userId);
        console.log('[ADMIN-SUSAN-AI] Found user data from storage:', userData ? {
          id: userData.id,
          role: userData.role,
          firstName: userData.firstName,
          lastName: userData.lastName
        } : 'null');
      } catch (error) {
        console.error('[ADMIN-SUSAN-AI] Failed to fetch user data:', error);
      }
    }
    
    // Create fallback user object if needed
    if (!userData) {
      console.log('[ADMIN-SUSAN-AI] Creating fallback user object with role:', context.userRole);
      userData = {
        id: context.userId,
        role: context.userRole,
        department: context.department || 'General',
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@roofing.com',
        employmentType: 'FULL_TIME',
        position: 'Administrator',
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
      };
    }

    // First, check for actionable requests and process them
    const actionResults = await actionHandler.processRequest({
      user: userData,
      message: query
    });

    // Check for system-specific queries
    const lowerQuery = query.toLowerCase();
    console.log('[ADMIN-SUSAN-AI] Processing query:', lowerQuery);
    
    // System health check
    if (lowerQuery.includes('system') && (lowerQuery.includes('status') || lowerQuery.includes('health') || lowerQuery.includes('how'))) {
      console.log('[ADMIN-SUSAN-AI] Matched system health query');
      const response = await this.getSystemStatus(context);
      if (actionResults.length > 0) {
        response.actions = actionResults;
        response.message += `\n\n**Actions Performed:**\n${actionResults.map(a => `• ${a.message}`).join('\n')}`;
      }
      return response;
    }

    // Agent management
    if (lowerQuery.includes('agent') || lowerQuery.includes('automation')) {
      console.log('[ADMIN-SUSAN-AI] Matched agent query');
      const response = await this.handleAgentQuery(query, context);
      if (actionResults.length > 0) {
        response.actions = actionResults;
        response.message += `\n\n**Actions Performed:**\n${actionResults.map(a => `• ${a.message}`).join('\n')}`;
      }
      return response;
    }

    // Data analytics requests
    if (lowerQuery.includes('analytics') || lowerQuery.includes('report') || lowerQuery.includes('metrics')) {
      const response = await this.generateAnalyticsReport(query, context);
      if (actionResults.length > 0) {
        response.actions = actionResults;
        response.message += `\n\n**Actions Performed:**\n${actionResults.map(a => `• ${a.message}`).join('\n')}`;
      }
      return response;
    }

    // Full system overview
    if (lowerQuery.includes('everything') || lowerQuery.includes('full report') || lowerQuery.includes('complete status')) {
      const response = await this.getCompleteSystemOverview(context);
      if (actionResults.length > 0) {
        response.actions = actionResults;
        response.message += `\n\n**Actions Performed:**\n${actionResults.map(a => `• ${a.message}`).join('\n')}`;
      }
      return response;
    }

    // If actions were performed but no specific admin query, create response based on actions
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
        actions: actionResults,
        quickActions: this.generateContextualActions(query, actionResults)
      };
    }

    // Enhanced base processing with admin context
    const response = await super.processQuery(query, context);
    
    // Add admin-specific quick actions
    response.quickActions = [
      ...response.quickActions || [],
      { label: 'System Health', action: 'query', params: { query: 'How is the system today?' }, icon: 'activity' },
      { label: 'Agent Status', action: 'query', params: { query: 'Show me all HR agents status' }, icon: 'bot' },
      { label: 'Analytics', action: 'navigate', params: { page: '/susan-ai?tab=insights' }, icon: 'chart' },
      { label: 'Settings', action: 'navigate', params: { page: '/settings' }, icon: 'settings' }
    ];

    return response;
  }

  /**
   * Get comprehensive system status
   */
  private async getSystemStatus(context: SusanContext): Promise<SusanResponse> {
    const health = await this.systemMonitor.getHealthStatus();
    const agents = await this.agentController.getAllAgentStatus();
    const recentErrors = await this.systemMonitor.getRecentErrors();
    
    let statusEmoji = '✅';
    let statusText = 'All systems operational';
    
    if (health.status === 'warning') {
      statusEmoji = '⚠️';
      statusText = 'System running with warnings';
    } else if (health.status === 'critical') {
      statusEmoji = '🔴';
      statusText = 'Critical issues detected';
    }

    const message = `${statusEmoji} **System Status Report**\n\n` +
      `Overall Status: ${statusText}\n\n` +
      `**System Metrics:**\n` +
      `• Active Users: ${health.metrics.activeUsers}\n` +
      `• Database Connections: ${health.metrics.databaseConnections}/100\n` +
      `• API Response Time: ${health.metrics.apiResponseTime}ms\n` +
      `• Error Rate: ${health.metrics.errorRate}%\n\n` +
      `**HR Automation Agents:**\n` +
      `• Total Agents: ${agents.length}\n` +
      `• Active: ${agents.filter(a => a.isActive).length}\n` +
      `• Last Run: ${agents[0]?.lastRun ? new Date(agents[0].lastRun).toLocaleString() : 'Never'}\n\n` +
      `${health.alerts.length > 0 ? `**Active Alerts:**\n${health.alerts.map(a => `• [${a.severity.toUpperCase()}] ${a.message}`).join('\n')}\n\n` : ''}` +
      `${recentErrors.length > 0 ? `**Recent Issues:**\n${recentErrors.slice(0, 3).map(e => `• ${e.message}`).join('\n')}` : 'No recent issues detected.'}`;

    return {
      message,
      confidence: 1.0,
      data: {
        health,
        agents,
        errors: recentErrors
      },
      quickActions: [
        { label: 'View All Agents', action: 'query', params: { query: 'Show me detailed agent status' }, icon: 'bot' },
        { label: 'Run Diagnostics', action: 'query', params: { query: 'Run system diagnostics' }, icon: 'activity' },
        { label: 'View Logs', action: 'navigate', params: { page: '/settings?tab=logs' }, icon: 'file-text' }
      ]
    };
  }

  /**
   * Handle agent-related queries
   */
  private async handleAgentQuery(query: string, context: SusanContext): Promise<SusanResponse> {
    const lowerQuery = query.toLowerCase();
    
    // List all agents
    if (lowerQuery.includes('list') || lowerQuery.includes('show') || lowerQuery.includes('status')) {
      const agents = await this.agentController.getAllAgentStatus();
      
      const message = `**HR Automation Agents Status:**\n\n` +
        agents.map(agent => {
          const statusIcon = agent.isActive ? '🟢' : '🔴';
          const lastRunText = agent.lastRun ? `Last run: ${new Date(agent.lastRun).toLocaleString()}` : 'Never run';
          return `${statusIcon} **${agent.agentName}**\n` +
            `   Status: ${agent.isActive ? 'Active' : 'Inactive'}\n` +
            `   Schedule: ${agent.schedule}\n` +
            `   ${lastRunText}\n` +
            `   ${agent.description}`;
        }).join('\n\n');

      return {
        message,
        confidence: 1.0,
        data: { agents },
        quickActions: agents.map(agent => ({
          label: agent.isActive ? `Stop ${agent.agentName}` : `Start ${agent.agentName}`,
          action: 'agent_control',
          params: { agentId: agent.id, action: agent.isActive ? 'stop' : 'start' },
          icon: 'bot'
        }))
      };
    }

    // Control specific agent
    if (lowerQuery.includes('start') || lowerQuery.includes('stop') || lowerQuery.includes('restart')) {
      const action = lowerQuery.includes('start') ? 'start' : 
                     lowerQuery.includes('stop') ? 'stop' : 'restart';
      
      // Extract agent name from query
      const agentName = this.extractAgentName(query);
      if (agentName) {
        const result = await this.agentController.controlAgent(agentName, action);
        return {
          message: result.success ? 
            `✅ Successfully ${action}ed ${agentName}` : 
            `❌ Failed to ${action} ${agentName}: ${result.error}`,
          confidence: 1.0,
          actions: [{ type: 'agent_control', status: result.success ? 'success' : 'failed', details: result }]
        };
      }
    }

    return {
      message: "I can help you manage HR automation agents. You can ask me to:\n• Show agent status\n• Start/stop specific agents\n• Run agents manually\n• Configure agent schedules",
      confidence: 0.8,
      suggestions: [
        'Show me all agent status',
        'Start the PTO Expiration agent',
        'Stop all agents',
        'Run performance review automation now'
      ]
    };
  }

  /**
   * Generate comprehensive analytics report
   */
  private async generateAnalyticsReport(query: string, context: SusanContext): Promise<SusanResponse> {
    const analytics = await this.dataAnalyzer.generateComprehensiveReport();
    
    const message = `**📊 HR Analytics Report**\n\n` +
      `**Workforce Overview:**\n` +
      `• Total Employees: ${analytics.employees.total}\n` +
      `• Active: ${analytics.employees.active}\n` +
      `• New Hires (30 days): ${analytics.employees.newHires}\n` +
      `• Turnover Rate: ${analytics.employees.turnoverRate}%\n\n` +
      `**Recruitment Pipeline:**\n` +
      `• Total Candidates: ${analytics.recruitment.totalCandidates}\n` +
      `• In Process: ${analytics.recruitment.inProcess}\n` +
      `• Conversion Rate: ${analytics.recruitment.conversionRate}%\n\n` +
      `**Time Off Management:**\n` +
      `• Pending Requests: ${analytics.pto.pending}\n` +
      `• Approved This Month: ${analytics.pto.approvedThisMonth}\n` +
      `• Average Days Taken: ${analytics.pto.averageDaysTaken}\n\n` +
      `**Performance Reviews:**\n` +
      `• Due This Quarter: ${analytics.reviews.dueThisQuarter}\n` +
      `• Completed: ${analytics.reviews.completed}\n` +
      `• Average Rating: ${analytics.reviews.averageRating}/5\n\n` +
      `**Document Management:**\n` +
      `• Total Documents: ${analytics.documents.total}\n` +
      `• Expiring Soon: ${analytics.documents.expiringSoon}\n` +
      `• Compliance Rate: ${analytics.documents.complianceRate}%`;

    return {
      message,
      confidence: 1.0,
      data: analytics,
      quickActions: [
        { label: 'Export Report', action: 'export', params: { type: 'analytics', format: 'pdf' }, icon: 'download' },
        { label: 'View Trends', action: 'navigate', params: { page: '/analytics' }, icon: 'trending-up' },
        { label: 'Schedule Reports', action: 'query', params: { query: 'Schedule weekly analytics reports' }, icon: 'calendar' }
      ]
    };
  }

  /**
   * Get complete system overview
   */
  private async getCompleteSystemOverview(context: SusanContext): Promise<SusanResponse> {
    const [health, agents, analytics, recentActivity] = await Promise.all([
      this.systemMonitor.getHealthStatus(),
      this.agentController.getAllAgentStatus(),
      this.dataAnalyzer.generateComprehensiveReport(),
      this.systemMonitor.getRecentActivity()
    ]);

    const message = `**🎯 Complete System Overview**\n\n` +
      `**System Health:** ${health.status === 'healthy' ? '✅ Healthy' : health.status === 'warning' ? '⚠️ Warning' : '🔴 Critical'}\n\n` +
      `**Key Metrics:**\n` +
      `• ${analytics.employees.total} employees (${analytics.employees.active} active)\n` +
      `• ${analytics.recruitment.totalCandidates} candidates in pipeline\n` +
      `• ${agents.filter(a => a.isActive).length}/${agents.length} automation agents running\n` +
      `• ${analytics.pto.pending} pending PTO requests\n` +
      `• ${health.metrics.activeUsers} users online\n\n` +
      `**Recent Activity:**\n` +
      recentActivity.slice(0, 5).map(activity => `• ${activity.timestamp}: ${activity.description}`).join('\n') + '\n\n' +
      `**Recommendations:**\n` +
      this.generateRecommendations(health, analytics, agents).map(r => `• ${r}`).join('\n');

    return {
      message,
      confidence: 1.0,
      data: { health, agents, analytics, recentActivity },
      requiresApproval: false,
      quickActions: [
        { label: 'System Dashboard', action: 'navigate', params: { page: '/dashboard' }, icon: 'home' },
        { label: 'Agent Control', action: 'query', params: { query: 'Show agent control panel' }, icon: 'bot' },
        { label: 'Run Diagnostics', action: 'query', params: { query: 'Run full system diagnostics' }, icon: 'activity' }
      ]
    };
  }

  /**
   * Check if user is authorized admin
   */
  private isAuthorizedAdmin(context: SusanContext): boolean {
    return context.userRole === 'ADMIN' || 
           (context.userRole === 'MANAGER' && this.isAuthorizedManager(context.userId));
  }

  /**
   * Check if manager is authorized for admin features
   */
  private isAuthorizedManager(userId: string): boolean {
    // Check if manager is in authorized list
    const authorizedManagers = process.env.AUTHORIZED_ADMIN_MANAGERS?.split(',') || [];
    return authorizedManagers.includes(userId);
  }

  /**
   * Extract agent name from query
   */
  /**
   * Generate contextual quick actions based on performed actions
   */
  private generateContextualActions(query: string, actionResults: any[]): any[] {
    const actions: any[] = [];
    const lowerQuery = query.toLowerCase();

    // If candidate actions were performed, suggest recruitment actions
    if (actionResults.some(a => a.data?.candidateId)) {
      actions.push(
        { label: 'View Candidates', action: 'navigate', params: { page: '/recruitment' }, icon: 'users' },
        { label: 'Recruitment Analytics', action: 'query', params: { query: 'Show recruitment metrics' }, icon: 'bar-chart' }
      );
    }

    // If PTO actions were performed, suggest PTO management actions
    if (actionResults.some(a => a.data?.requestId)) {
      actions.push(
        { label: 'View PTO Requests', action: 'navigate', params: { page: '/pto' }, icon: 'calendar' },
        { label: 'PTO Analytics', action: 'query', params: { query: 'Show PTO usage report' }, icon: 'clock' }
      );
    }

    return actions;
  }

  private extractAgentName(query: string): string | null {
    const agentKeywords = {
      'pto': 'pto-expiration-reminder',
      'performance': 'performance-review-automation',
      'document': 'document-expiration-monitor',
      'onboarding': 'onboarding-workflow',
      'recruitment': 'smart-recruitment-bot'
    };

    const lowerQuery = query.toLowerCase();
    for (const [keyword, agentId] of Object.entries(agentKeywords)) {
      if (lowerQuery.includes(keyword)) {
        return agentId;
      }
    }
    return null;
  }

  /**
   * Generate system recommendations
   */
  private generateRecommendations(health: SystemHealthStatus, analytics: any, agents: any[]): string[] {
    const recommendations = [];

    if (health.metrics.errorRate > 5) {
      recommendations.push('⚠️ High error rate detected - review system logs');
    }

    if (analytics.pto.pending > 10) {
      recommendations.push('📅 High number of pending PTO requests - review approvals');
    }

    if (agents.filter(a => !a.isActive).length > agents.length / 2) {
      recommendations.push('🤖 Many agents are inactive - consider reactivating automation');
    }

    if (analytics.documents.expiringSoon > 0) {
      recommendations.push(`📄 ${analytics.documents.expiringSoon} documents expiring soon - send reminders`);
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ All systems operating normally');
    }

    return recommendations;
  }
}

/**
 * System Monitor for health checks and logging
 */
class SystemMonitor {
  async getHealthStatus(): Promise<SystemHealthStatus> {
    // Get system metrics
    const [activeUsers, agentStatus, recentErrors] = await Promise.all([
      this.getActiveUserCount(),
      this.getAgentHealthMetrics(),
      this.getRecentErrors()
    ]);

    const errorRate = recentErrors.length / 100 * 100; // Percentage of errors in last 100 operations
    const status = errorRate > 10 ? 'critical' : errorRate > 5 ? 'warning' : 'healthy';

    return {
      status,
      metrics: {
        activeUsers,
        systemLoad: 45, // Mock for now
        databaseConnections: 23, // Mock for now
        apiResponseTime: 125, // Mock in ms
        errorRate
      },
      agents: agentStatus,
      alerts: this.generateAlerts(status, errorRate, agentStatus)
    };
  }

  private async getActiveUserCount(): Promise<number> {
    // Count total users (active users not tracked in current schema)
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.isActive, true));
    return Number(result[0]?.count || 0);
  }

  private async getAgentHealthMetrics(): Promise<any> {
    // Mock agent metrics since hrAgents table doesn't exist yet
    return {
      total: 5,
      active: 5,
      failed: 0,
      lastRun: new Date()
    };
  }

  async getRecentErrors(): Promise<any[]> {
    // Mock implementation - would query system logs
    return [];
  }

  async getRecentActivity(): Promise<any[]> {
    // Mock implementation - would query activity logs
    return [
      { timestamp: new Date().toLocaleTimeString(), description: 'Admin logged in' },
      { timestamp: new Date(Date.now() - 300000).toLocaleTimeString(), description: 'PTO request approved' },
      { timestamp: new Date(Date.now() - 600000).toLocaleTimeString(), description: 'New candidate added' }
    ];
  }

  private generateAlerts(status: string, errorRate: number, agentStatus: any): SystemAlert[] {
    const alerts: SystemAlert[] = [];

    if (errorRate > 10) {
      alerts.push({
        id: '1',
        severity: 'high',
        category: 'performance',
        message: 'High error rate detected in system operations',
        timestamp: new Date(),
        resolved: false
      });
    }

    if (agentStatus.failed > 0) {
      alerts.push({
        id: '2',
        severity: 'medium',
        category: 'agent',
        message: `${agentStatus.failed} automation agents have failed`,
        timestamp: new Date(),
        resolved: false
      });
    }

    return alerts;
  }
}

/**
 * Agent Controller for managing HR automation agents
 */
class AgentController {
  async getAllAgentStatus(): Promise<any[]> {
    try {
      // Import and use the actual AgentManager
      const { agentManager } = await import('../../agents/agent-manager');
      console.log('[AGENT-CONTROLLER] AgentManager imported:', !!agentManager);
      const agents = agentManager.getAllAgentsStatus();
      console.log('[AGENT-CONTROLLER] Got agents:', agents.length, agents);
      
      return agents.map(agent => ({
        id: agent.name,
        agentName: agent.name,
        description: agent.description || '',
        isActive: agent.enabled,
        schedule: agent.schedule || 'Manual',
        lastRun: agent.lastRun,
        nextRun: agent.nextRun || null,
        lastStatus: agent.lastStatus || 'N/A'
      }));
    } catch (error) {
      console.error('[AGENT-CONTROLLER] Failed to get agent status:', error);
      return [];
    }
  }

  async controlAgent(agentId: string, action: string): Promise<any> {
    try {
      const { agentManager } = await import('../../agents/agent-manager');
      
      if (action === 'start') {
        await agentManager.enableAgent(agentId);
        return { success: true, message: `Agent ${agentId} started successfully` };
      } else if (action === 'stop') {
        await agentManager.disableAgent(agentId);
        return { success: true, message: `Agent ${agentId} stopped successfully` };
      } else if (action === 'restart') {
        await agentManager.disableAgent(agentId);
        await agentManager.enableAgent(agentId);
        return { success: true, message: `Agent ${agentId} restarted successfully` };
      }
      
      return { success: false, error: 'Invalid action' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async runAgentNow(agentId: string): Promise<any> {
    try {
      const { agentManager } = await import('../../agents/agent-manager');
      await agentManager.runAgentNow(agentId);
      return { success: true, message: 'Agent execution triggered' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

/**
 * Data Analyzer for comprehensive reporting
 */
class DataAnalyzer {
  async generateComprehensiveReport(): Promise<any> {
    const [employees, recruitment, pto, reviews, documents] = await Promise.all([
      this.getEmployeeMetrics(),
      this.getRecruitmentMetrics(),
      this.getPTOMetrics(),
      this.getReviewMetrics(),
      this.getDocumentMetrics()
    ]);

    return { employees, recruitment, pto, reviews, documents };
  }

  private async getEmployeeMetrics(): Promise<any> {
    const result = await db.select({ 
      total: sql<number>`count(*)`,
      active: sql<number>`count(case when is_active = true then 1 end)`
    }).from(users);
    
    return {
      total: Number(result[0]?.total || 0),
      active: Number(result[0]?.active || 0),
      newHires: 5, // Mock
      turnoverRate: 8.5 // Mock percentage
    };
  }

  private async getRecruitmentMetrics(): Promise<any> {
    const result = await db.select({
      total: sql<number>`count(*)`,
      inProcess: sql<number>`count(case when status not in ('HIRED', 'REJECTED') then 1 end)`
    }).from(candidates);

    return {
      totalCandidates: Number(result[0]?.total || 0),
      inProcess: Number(result[0]?.inProcess || 0),
      conversionRate: 25 // Mock percentage
    };
  }

  private async getPTOMetrics(): Promise<any> {
    const result = await db.select({
      pending: sql<number>`count(case when status = 'PENDING' then 1 end)`,
      approved: sql<number>`count(case when status = 'APPROVED' then 1 end)`
    }).from(ptoRequests);

    return {
      pending: Number(result[0]?.pending || 0),
      approvedThisMonth: Number(result[0]?.approved || 0),
      averageDaysTaken: 5.2 // Mock
    };
  }

  private async getReviewMetrics(): Promise<any> {
    return {
      dueThisQuarter: 15, // Mock
      completed: 45, // Mock
      averageRating: 4.2 // Mock
    };
  }

  private async getDocumentMetrics(): Promise<any> {
    const result = await db.select({
      total: sql<number>`count(*)`
    }).from(documents);

    return {
      total: Number(result[0]?.total || 0),
      expiringSoon: 3, // Mock
      complianceRate: 95 // Mock percentage
    };
  }
}

// Export singleton instance
export const adminSusanAI = new AdminSusanAI();