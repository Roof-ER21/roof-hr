import { BaseAgent, AgentConfig, AgentResult, AgentContext } from './base-agent';
import { coiAlertService } from '../services/coi-alert-service';

export class CoiAlertAgent extends BaseAgent {
  constructor(context: AgentContext = {}) {
    const config: AgentConfig = {
      name: 'COI Document Alert Agent',
      description: 'Sends daily alerts for expiring and expired COI documents',
      enabled: true,
      schedule: '0 8 * * *', // Every day at 8 AM
      priority: 'high',
      retryAttempts: 3,
      timeout: 60000 // 1 minute
    };
    super(config, context);
  }

  async execute(): Promise<AgentResult> {
    try {
      // Run the COI alert service
      await coiAlertService.checkAndSendAlerts();
      
      // Get summary for reporting
      const summary = await coiAlertService.getAlertSummary();
      
      const message = `COI alerts processed successfully. 
        Expired: ${summary.expired}, 
        Expiring Today: ${summary.expiringToday}, 
        Expiring This Week: ${summary.expiringThisWeek}, 
        Expiring This Month: ${summary.expiringThisMonth}`;
      
      // Log summary
      console.log('[COI Alert Agent]', message);
      
      return {
        success: true,
        message,
        data: summary,
        warnings: summary.expired > 0 ? [`${summary.expired} COI documents are expired`] : []
      };
    } catch (error) {
      console.error('[COI Alert Agent] Error:', error);
      return {
        success: false,
        message: 'Failed to process COI alerts',
        errors: [(error as Error).message]
      };
    }
  }
}