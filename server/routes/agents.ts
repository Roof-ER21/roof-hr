import express from 'express';
import { agentManager } from '../agents/agent-manager';

const router = express.Router();

// Middleware to require admin access for agent management
function requireAdmin(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
}

// Get all agents status
router.get('/api/agents', requireAdmin, async (req, res) => {
  try {
    const agentsStatus = agentManager.getAllAgentsStatus();
    res.json(agentsStatus);
  } catch (error) {
    console.error('Error fetching agents status:', error);
    res.status(500).json({ error: 'Failed to fetch agents status' });
  }
});

// Get HR agents configuration (for Admin Control Hub)
router.get('/api/hr-agents', requireAdmin, async (req, res) => {
  try {
    const agentsStatus = agentManager.getAllAgentsStatus();
    // Transform to match the expected format for Admin Control Hub
    const hrAgents = agentsStatus.map((agent: any) => ({
      id: agent.name.replace(/\s+/g, '-').toLowerCase(),
      agentName: agent.name,
      isActive: agent.enabled,
      schedule: agent.schedule || 'MANUAL',
      description: agent.description || `Automated ${agent.name} process`,
      lastRun: agent.lastRun,
      nextRun: agent.nextRun,
      lastStatus: agent.lastStatus,
      lastError: agent.lastError,
      config: agent.config,
      createdAt: agent.createdAt || new Date().toISOString(),
      updatedAt: agent.updatedAt || new Date().toISOString()
    }));
    console.log('[HR-AGENTS] Returning agents:', hrAgents);
    res.json(hrAgents);
  } catch (error) {
    console.error('Error fetching HR agents:', error);
    res.status(500).json({ error: 'Failed to fetch HR agents' });
  }
});

// Get specific agent status
router.get('/api/agents/:name', requireAdmin, async (req, res) => {
  try {
    const agentStatus = agentManager.getAgentStatus(req.params.name);
    if (!agentStatus) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.json(agentStatus);
  } catch (error) {
    console.error('Error fetching agent status:', error);
    res.status(500).json({ error: 'Failed to fetch agent status' });
  }
});

// Run a specific agent manually
router.post('/api/agents/:name/run', requireAdmin, async (req: any, res) => {
  try {
    const agentId = req.params.name;
    const context = req.body.context || {};
    
    // Convert agent ID to agent name for the manager
    const agentNameMap: Record<string, string> = {
      'pto-expiration-reminder': 'PTO Expiration Reminder',
      'performance-review-automation': 'Performance Review Automation', 
      'document-expiration-monitor': 'Document Expiration Monitor',
      'onboarding-workflow': 'Onboarding Workflow',
      'coi-document-alert-agent': 'COI Document Alert Agent'
    };
    
    const agentName = agentNameMap[agentId] || agentId;
    
    // Add user context
    context.userId = req.user.id;
    
    const result = await agentManager.runAgent(agentName, context);
    
    res.json({
      success: true,
      agentName,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error running agent:', error);
    res.status(500).json({ 
      error: 'Failed to run agent',
      message: (error as Error).message 
    });
  }
});

// Run all agents manually
router.post('/api/agents/run-all', requireAdmin, async (req: any, res) => {
  try {
    const context = req.body.context || {};
    context.userId = req.user.id;
    
    const results = await agentManager.runAllAgents();
    
    res.json({
      success: true,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error running all agents:', error);
    res.status(500).json({ 
      error: 'Failed to run agents',
      message: (error as Error).message 
    });
  }
});

// Toggle agent enable/disable  
router.post('/api/agents/:name/toggle', requireAdmin, async (req, res) => {
  try {
    const agentId = req.params.name;
    const { isActive } = req.body;
    
    // Convert agent ID to agent name for the manager
    const agentNameMap: Record<string, string> = {
      'pto-expiration-reminder': 'PTO Expiration Reminder',
      'performance-review-automation': 'Performance Review Automation', 
      'document-expiration-monitor': 'Document Expiration Monitor',
      'onboarding-workflow': 'Onboarding Workflow',
      'coi-document-alert-agent': 'COI Document Alert Agent'
    };
    
    const agentName = agentNameMap[agentId] || agentId;
    
    const success = isActive ? 
      agentManager.enableAgent(agentName) : 
      agentManager.disableAgent(agentName);
    
    if (success) {
      res.json({ 
        success: true, 
        message: `Agent ${isActive ? 'enabled' : 'disabled'} successfully`,
        isActive 
      });
    } else {
      res.status(404).json({ error: 'Agent not found' });
    }
  } catch (error) {
    console.error('Error toggling agent:', error);
    res.status(500).json({ 
      error: 'Failed to toggle agent',
      message: (error as Error).message 
    });
  }
});

// Enable an agent
router.patch('/api/agents/:name/enable', requireAdmin, async (req, res) => {
  try {
    const success = agentManager.enableAgent(req.params.name);
    if (success) {
      res.json({ success: true, message: 'Agent enabled successfully' });
    } else {
      res.status(404).json({ error: 'Agent not found' });
    }
  } catch (error) {
    console.error('Error enabling agent:', error);
    res.status(500).json({ error: 'Failed to enable agent' });
  }
});

// Disable an agent
router.patch('/api/agents/:name/disable', requireAdmin, async (req, res) => {
  try {
    const success = agentManager.disableAgent(req.params.name);
    if (success) {
      res.json({ success: true, message: 'Agent disabled successfully' });
    } else {
      res.status(404).json({ error: 'Agent not found' });
    }
  } catch (error) {
    console.error('Error disabling agent:', error);
    res.status(500).json({ error: 'Failed to disable agent' });
  }
});

// Get execution history
router.get('/api/agents/execution-history', requireAdmin, async (req, res) => {
  try {
    const history = agentManager.getExecutionHistory();
    res.json(history);
  } catch (error) {
    console.error('Error fetching execution history:', error);
    res.status(500).json({ error: 'Failed to fetch execution history' });
  }
});

// Update HR agent configuration (for Admin Control Hub)
router.patch('/api/hr-agents/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    
    console.log('[HR-AGENTS] Update request for ID:', id, 'isActive:', isActive);
    
    // Map the numeric ID to agent name
    const agentIdMap: { [key: string]: string } = {
      '1': 'PTO Expiration Reminder',
      '2': 'Performance Review Automation',
      '3': 'Document Expiration Monitor',
      '4': 'Onboarding Workflow',
      'pto-expiration-reminder': 'PTO Expiration Reminder',
      'performance-review-automation': 'Performance Review Automation',
      'document-expiration-monitor': 'Document Expiration Monitor',
      'onboarding-workflow': 'Onboarding Workflow'
    };
    
    const agentName = agentIdMap[id] || agentIdMap[id.toLowerCase()];
    
    if (!agentName) {
      console.error('[HR-AGENTS] Agent not found for ID:', id);
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    // Enable or disable agent based on isActive flag
    let success = false;
    if (isActive) {
      success = agentManager.enableAgent(agentName);
    } else {
      success = agentManager.disableAgent(agentName);
    }
    
    if (success) {
      console.log('[HR-AGENTS] Successfully updated agent:', agentName, 'isActive:', isActive);
      res.json({ 
        success: true, 
        message: `Agent ${isActive ? 'enabled' : 'disabled'} successfully` 
      });
    } else {
      res.status(500).json({ error: 'Failed to update agent' });
    }
  } catch (error) {
    console.error('Error updating HR agent:', error);
    res.status(500).json({ error: 'Failed to update agent configuration' });
  }
});

// Test HR agent (for Admin Control Hub)
router.post('/api/hr-agents/:id/test', requireAdmin, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { agentName } = req.body;
    
    console.log('[HR-AGENTS] Test request for ID:', id, 'agentName:', agentName);
    
    // Map the ID to agent name
    const agentIdMap: { [key: string]: string } = {
      '1': 'PTO Expiration Reminder',
      '2': 'Performance Review Automation',
      '3': 'Document Expiration Monitor',
      '4': 'Onboarding Workflow',
      'pto-expiration-reminder': 'PTO Expiration Reminder',
      'performance-review-automation': 'Performance Review Automation',
      'document-expiration-monitor': 'Document Expiration Monitor',
      'onboarding-workflow': 'Onboarding Workflow'
    };
    
    const nameToUse = agentName || agentIdMap[id] || agentIdMap[id.toLowerCase()];
    
    if (!nameToUse) {
      console.error('[HR-AGENTS] Agent not found for test ID:', id);
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    const context = { userId: req.user.id, isTest: true };
    const result = await agentManager.runAgent(nameToUse, context);
    
    res.json({
      success: true,
      agentName: nameToUse,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error testing HR agent:', error);
    res.status(500).json({ 
      error: 'Failed to test agent',
      message: (error as Error).message 
    });
  }
});

// Get HR agent logs (for Admin Control Hub)
router.get('/api/hr-agents/logs', requireAdmin, async (req, res) => {
  try {
    const { agentName } = req.query;
    const history = agentManager.getExecutionHistory();
    
    // Filter by agent name if provided
    let logs = history;
    if (agentName && typeof agentName === 'string') {
      logs = history.filter((log: any) => log.agentName === agentName);
    }
    
    // Transform to match expected format
    const hrLogs = logs.map((log: any) => ({
      id: `${log.agentName}-${log.startTime}`.replace(/\s+/g, '-').toLowerCase(),
      agentName: log.agentName,
      status: log.status === 'completed' ? 'SUCCESS' : log.status === 'failed' ? 'FAILED' : 'RUNNING',
      message: log.result?.message || log.error || (log.status === 'completed' ? 'Agent executed successfully' : 'Agent execution failed'),
      affectedRecords: log.result?.affectedRecords || 0,
      executionTime: log.endTime && log.startTime ? 
        new Date(log.endTime).getTime() - new Date(log.startTime).getTime() : undefined,
      details: log.result?.details || log.error,
      createdAt: log.startTime
    }));
    
    res.json(hrLogs);
  } catch (error) {
    console.error('Error fetching HR agent logs:', error);
    res.status(500).json({ error: 'Failed to fetch HR agent logs' });
  }
});

// Start the agent scheduler
router.post('/api/agents/scheduler/start', requireAdmin, async (req, res) => {
  try {
    agentManager.startScheduler();
    res.json({ success: true, message: 'Agent scheduler started' });
  } catch (error) {
    console.error('Error starting scheduler:', error);
    res.status(500).json({ error: 'Failed to start scheduler' });
  }
});

// Stop the agent scheduler
router.post('/api/agents/scheduler/stop', requireAdmin, async (req, res) => {
  try {
    agentManager.stopScheduler();
    res.json({ success: true, message: 'Agent scheduler stopped' });
  } catch (error) {
    console.error('Error stopping scheduler:', error);
    res.status(500).json({ error: 'Failed to stop scheduler' });
  }
});

export default router;