import { EventEmitter } from 'events';
import * as cron from 'node-cron';
import { CronExpressionParser } from 'cron-parser';
import * as fs from 'fs';
import * as path from 'path';
import { BaseAgent, AgentResult } from './base-agent';
import { 
  PTOExpirationAgent, 
  PerformanceReviewAgent, 
  DocumentExpirationAgent,
  OnboardingAgent 
} from './hr-agents';
import { CoiAlertAgent } from './coi-alert-agent';

export interface AgentManagerConfig {
  enabled: boolean;
  maxConcurrentAgents: number;
  defaultTimeout: number;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

export interface AgentExecution {
  id: string;
  agentName: string;
  startTime: Date;
  endTime?: Date;
  result?: AgentResult;
  status: 'running' | 'completed' | 'failed';
  error?: string;
}

export class AgentManager extends EventEmitter {
  private agents: Map<string, BaseAgent> = new Map();
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();
  private runningExecutions: Map<string, AgentExecution> = new Map();
  private executionHistory: AgentExecution[] = [];
  private agentLastRun: Map<string, any> = new Map();
  private agentStates: Map<string, { isActive: boolean, lastRun?: any, lastStatus?: string }> = new Map();
  private config: AgentManagerConfig;
  private stateFile: string = path.join(process.cwd(), 'agent-states.json');

  constructor(config: Partial<AgentManagerConfig> = {}) {
    super();
    
    this.config = {
      enabled: true,
      maxConcurrentAgents: 3,
      defaultTimeout: 300000, // 5 minutes
      logLevel: 'info',
      ...config
    };

    this.loadPersistedState();
    this.initializeAgents();
    this.setupEventListeners();
  }

  private loadPersistedState(): void {
    try {
      if (fs.existsSync(this.stateFile)) {
        const data = fs.readFileSync(this.stateFile, 'utf8');
        const savedStates = JSON.parse(data);
        
        for (const [agentId, state] of Object.entries(savedStates)) {
          this.agentStates.set(agentId, state as any);
        }
        
        this.log('info', `Loaded persisted state for ${this.agentStates.size} agents`);
      }
    } catch (error) {
      this.log('error', `Failed to load persisted state: ${error}`);
    }
  }

  private savePersistedState(): void {
    try {
      const stateData: Record<string, any> = {};

      for (const [agentId, state] of Array.from(this.agentStates.entries())) {
        stateData[agentId] = state;
      }

      fs.writeFileSync(this.stateFile, JSON.stringify(stateData, null, 2));
      this.log('debug', 'Persisted agent states to disk');
    } catch (error) {
      this.log('error', `Failed to save persisted state: ${error}`);
    }
  }

  private initializeAgents(): void {
    // Register all HR agents
    const agents = [
      new PTOExpirationAgent(),
      new PerformanceReviewAgent(),
      new DocumentExpirationAgent(),
      new OnboardingAgent(),
      new CoiAlertAgent()
    ];

    for (const agent of agents) {
      this.registerAgent(agent);
      
      // Get the agent's config to ensure we have the correct name
      const config = agent.getConfig();
      const agentName = config.name;
      
      // Apply persisted state if available
      const savedState = this.agentStates.get(agentName);
      if (savedState) {
        if (savedState.isActive) {
          agent.enable();
        } else {
          agent.disable();
        }
        if (savedState.lastRun) {
          this.agentLastRun.set(agentName, savedState.lastRun);
        }
      } else {
        // Save initial state
        this.agentStates.set(agentName, {
          isActive: agent.isEnabled(),
          lastStatus: undefined
        });
      }
    }

    this.savePersistedState();
    this.log('info', `Initialized ${agents.length} agents with persisted states`);
  }

  private setupEventListeners(): void {
    this.on('agentComplete', (execution: AgentExecution) => {
      this.log('info', `Agent ${execution.agentName} completed in ${
        execution.endTime && execution.startTime ? 
        execution.endTime.getTime() - execution.startTime.getTime() : 0
      }ms`);
      
      // Store in execution history
      this.executionHistory.push(execution);
      this.agentLastRun.set(execution.agentName, {
        timestamp: execution.endTime,
        status: 'SUCCESS',
        execution
      });
      
      // Limit history to last 100 executions
      if (this.executionHistory.length > 100) {
        this.executionHistory.shift();
      }
    });

    this.on('agentError', (execution: AgentExecution) => {
      this.log('error', `Agent ${execution.agentName} failed: ${execution.error}`);
      
      // Store in execution history
      this.executionHistory.push(execution);
      this.agentLastRun.set(execution.agentName, {
        timestamp: execution.endTime || new Date(),
        status: 'FAILED',
        error: execution.error,
        execution
      });
      
      // Limit history to last 100 executions
      if (this.executionHistory.length > 100) {
        this.executionHistory.shift();
      }
    });
  }

  registerAgent(agent: BaseAgent): void {
    const config = agent.getConfig();
    this.agents.set(config.name, agent);

    // Set up event listeners for the agent
    agent.on('start', (data) => {
      this.emit('agentStart', data);
    });

    agent.on('complete', (data) => {
      this.emit('agentComplete', data);
    });

    agent.on('error', (data) => {
      this.emit('agentError', data);
    });

    // Schedule the agent if it has a cron schedule
    if (config.schedule && this.config.enabled) {
      this.scheduleAgent(config.name, config.schedule);
    }

    this.log('info', `Registered agent: ${config.name}`);
  }

  private scheduleAgent(agentName: string, schedule: string): void {
    if (this.scheduledJobs.has(agentName)) {
      this.scheduledJobs.get(agentName)?.destroy();
    }

    const task = cron.schedule(schedule, async () => {
      await this.runAgent(agentName);
    });

    this.scheduledJobs.set(agentName, task);
    task.start();

    this.log('info', `Scheduled agent ${agentName} with cron: ${schedule}`);
  }

  async runAgent(agentName: string, context?: any): Promise<AgentResult> {
    const agent = this.agents.get(agentName);
    if (!agent) {
      throw new Error(`Agent not found: ${agentName}`);
    }

    if (!this.config.enabled) {
      return {
        success: false,
        message: 'Agent manager is disabled',
        errors: ['Agent manager is currently disabled']
      };
    }

    // Check concurrent execution limit
    if (this.runningExecutions.size >= this.config.maxConcurrentAgents) {
      return {
        success: false,
        message: 'Maximum concurrent agents reached',
        errors: [`Already running ${this.runningExecutions.size} agents`]
      };
    }

    const executionId = `${agentName}-${Date.now()}`;
    const execution: AgentExecution = {
      id: executionId,
      agentName,
      startTime: new Date(),
      status: 'running'
    };

    this.runningExecutions.set(executionId, execution);

    try {
      this.log('info', `Starting agent: ${agentName}`);
      
      // Update agent context if provided
      if (context) {
        (agent as any).context = { ...(agent as any).context, ...context };
      }

      const result = await agent.run();
      
      execution.endTime = new Date();
      execution.result = result;
      execution.status = result.success ? 'completed' : 'failed';
      
      // Update last run info and persist state
      this.agentLastRun.set(agentName, {
        timestamp: execution.endTime,
        status: execution.status,
        result: result
      });
      
      const state = this.agentStates.get(agentName) || { isActive: agent.isEnabled() };
      state.lastRun = {
        timestamp: execution.endTime,
        status: execution.status
      };
      state.lastStatus = execution.status;
      this.agentStates.set(agentName, state);
      this.savePersistedState();
      
      this.runningExecutions.delete(executionId);
      
      this.emit('agentComplete', execution);
      
      return result;

    } catch (error) {
      execution.endTime = new Date();
      execution.status = 'failed';
      execution.error = (error as Error).message;
      
      this.runningExecutions.delete(executionId);
      
      this.emit('agentError', execution);
      
      return {
        success: false,
        message: 'Agent execution failed',
        errors: [(error as Error).message]
      };
    }
  }

  async runAllAgents(): Promise<{ [agentName: string]: AgentResult }> {
    const results: { [agentName: string]: AgentResult } = {};

    for (const [agentName, agent] of Array.from(this.agents.entries())) {
      if (agent.isEnabled()) {
        try {
          results[agentName] = await this.runAgent(agentName);
        } catch (error) {
          results[agentName] = {
            success: false,
            message: 'Failed to run agent',
            errors: [(error as Error).message]
          };
        }
      }
    }

    return results;
  }

  getAgentStatus(agentName: string): any {
    const agent = this.agents.get(agentName);
    if (!agent) {
      return null;
    }

    const config = agent.getConfig();
    const isScheduled = this.scheduledJobs.has(agentName);
    const runningExecution = Array.from(this.runningExecutions.values())
      .find(exec => exec.agentName === agentName);
    const lastRun = this.agentLastRun.get(agentName);

    // Calculate next run time based on schedule
    let nextRun = null;
    if (config.schedule && config.enabled) {
      try {
        const interval = CronExpressionParser.parse(config.schedule);
        nextRun = interval.next().toISOString();
      } catch (err) {
        // If cron parsing fails, set nextRun to null
      }
    }

    return {
      name: config.name,
      description: config.description,
      enabled: config.enabled,
      schedule: config.schedule,
      priority: config.priority,
      isScheduled,
      isRunning: !!runningExecution,
      currentExecution: runningExecution,
      lastRun: lastRun?.timestamp instanceof Date ? lastRun.timestamp.toISOString() : lastRun?.timestamp,
      lastStatus: lastRun?.status,
      lastError: lastRun?.error,
      nextRun
    };
  }

  getAllAgentsStatus(): any[] {
    return Array.from(this.agents.keys()).map(name => this.getAgentStatus(name));
  }

  enableAgent(agentName: string): boolean {
    const agent = this.agents.get(agentName);
    if (!agent) {
      return false;
    }

    agent.enable();
    
    // Update persisted state
    const state = this.agentStates.get(agentName) || { isActive: true };
    state.isActive = true;
    this.agentStates.set(agentName, state);
    this.savePersistedState();
    
    // Reschedule if it has a cron schedule
    const config = agent.getConfig();
    if (config.schedule) {
      this.scheduleAgent(agentName, config.schedule);
    }

    this.log('info', `Enabled agent: ${agentName}`);
    return true;
  }

  disableAgent(agentName: string): boolean {
    const agent = this.agents.get(agentName);
    if (!agent) {
      return false;
    }

    agent.disable();
    
    // Update persisted state
    const state = this.agentStates.get(agentName) || { isActive: false };
    state.isActive = false;
    this.agentStates.set(agentName, state);
    this.savePersistedState();
    
    // Stop scheduled task
    const task = this.scheduledJobs.get(agentName);
    if (task) {
      task.stop();
    }

    this.log('info', `Disabled agent: ${agentName}`);
    return true;
  }

  startScheduler(): void {
    this.config.enabled = true;

    // Start all scheduled jobs
    for (const [agentName, task] of Array.from(this.scheduledJobs.entries())) {
      const agent = this.agents.get(agentName);
      if (agent?.isEnabled()) {
        task.start();
      }
    }

    this.log('info', 'Agent scheduler started');
  }

  stopScheduler(): void {
    this.config.enabled = false;

    // Stop all scheduled jobs
    for (const task of Array.from(this.scheduledJobs.values())) {
      task.stop();
    }

    this.log('info', 'Agent scheduler stopped');
  }

  getExecutionHistory(): AgentExecution[] {
    // Return the stored execution history
    return [...this.executionHistory];
  }

  private log(level: string, message: string, data?: any): void {
    if (this.shouldLog(level)) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [AGENT-MANAGER] [${level.toUpperCase()}] ${message}`, data || '');
    }
  }

  private shouldLog(level: string): boolean {
    const levels = ['error', 'warn', 'info', 'debug'];
    const currentLevelIndex = levels.indexOf(this.config.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  shutdown(): void {
    this.log('info', 'Shutting down agent manager');

    // Stop all scheduled jobs
    for (const [name, task] of Array.from(this.scheduledJobs.entries())) {
      task.destroy();
      this.log('info', `Stopped scheduled job for agent: ${name}`);
    }

    this.scheduledJobs.clear();
    this.agents.clear();
    this.runningExecutions.clear();

    this.removeAllListeners();

    this.log('info', 'Agent manager shutdown complete');
  }
}

// Singleton instance
export const agentManager = new AgentManager();