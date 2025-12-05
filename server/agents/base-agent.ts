import { EventEmitter } from 'events';
import { storage } from '../storage';

export interface AgentConfig {
  name: string;
  description: string;
  enabled: boolean;
  schedule?: string; // cron expression
  priority: 'low' | 'medium' | 'high';
  retryAttempts: number;
  timeout: number; // milliseconds
}

export interface AgentContext {
  userId?: string;
  companyId?: string;
  metadata?: Record<string, any>;
}

export interface AgentResult {
  success: boolean;
  message: string;
  data?: any;
  errors?: string[];
  warnings?: string[];
}

export abstract class BaseAgent extends EventEmitter {
  protected config: AgentConfig;
  protected context: AgentContext;
  protected isRunning = false;
  protected startTime?: Date;

  constructor(config: AgentConfig, context: AgentContext = {}) {
    super();
    this.config = config;
    this.context = context;
  }

  abstract execute(): Promise<AgentResult>;

  async run(): Promise<AgentResult> {
    if (this.isRunning) {
      return {
        success: false,
        message: 'Agent is already running',
        errors: ['Agent execution already in progress']
      };
    }

    if (!this.config.enabled) {
      return {
        success: false,
        message: 'Agent is disabled',
        errors: ['Agent is currently disabled in configuration']
      };
    }

    this.isRunning = true;
    this.startTime = new Date();
    this.emit('start', { agent: this.config.name, timestamp: this.startTime });

    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < this.config.retryAttempts) {
      try {
        const result = await Promise.race([
          this.execute(),
          this.createTimeoutPromise()
        ]);

        this.isRunning = false;
        const duration = Date.now() - (this.startTime?.getTime() || 0);
        
        this.emit('complete', { 
          agent: this.config.name, 
          result, 
          duration,
          attempts: attempts + 1 
        });

        await this.logExecution(result, duration, attempts + 1);
        return result;

      } catch (error) {
        attempts++;
        lastError = error as Error;
        
        this.emit('error', { 
          agent: this.config.name, 
          error: lastError, 
          attempt: attempts 
        });

        if (attempts < this.config.retryAttempts) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempts - 1), 30000);
          await this.sleep(delay);
        }
      }
    }

    this.isRunning = false;
    const result: AgentResult = {
      success: false,
      message: `Agent failed after ${attempts} attempts`,
      errors: [lastError?.message || 'Unknown error occurred']
    };

    await this.logExecution(result, Date.now() - (this.startTime?.getTime() || 0), attempts);
    return result;
  }

  private createTimeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Agent execution timed out after ${this.config.timeout}ms`));
      }, this.config.timeout);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async logExecution(result: AgentResult, duration: number, attempts: number): Promise<void> {
    try {
      // Log to system logs - in a real implementation, you might want to store this in the database
      console.log(`Agent Execution Log:`, {
        agent: this.config.name,
        success: result.success,
        duration,
        attempts,
        message: result.message,
        timestamp: new Date().toISOString(),
        context: this.context
      });
    } catch (error) {
      console.error('Failed to log agent execution:', error);
    }
  }

  // Utility methods for agents
  protected async getUser(userId: string) {
    return await storage.getUserById(userId);
  }

  protected async getAllUsers() {
    return await storage.getAllUsers();
  }

  protected async createTask(taskData: any) {
    return await storage.createTask(taskData);
  }

  protected async sendNotification(userId: string, message: string, type: 'info' | 'warning' | 'error' = 'info') {
    // In a real implementation, this would send emails, push notifications, etc.
    console.log(`Notification to ${userId} (${type}): ${message}`);
  }

  // Configuration methods
  updateConfig(newConfig: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): AgentConfig {
    return { ...this.config };
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  enable(): void {
    this.config.enabled = true;
  }

  disable(): void {
    this.config.enabled = false;
  }
}