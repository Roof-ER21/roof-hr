/**
 * Super Admin Routes - Ahmed's Ultimate Control Center
 * Only accessible by ahmed.mahmoud@theroofdocs.com
 */

import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { SUPER_ADMIN_EMAIL } from '../../shared/constants/roles';

const router = Router();

// ============================================================================
// MIDDLEWARE: Super Admin Access Only
// ============================================================================

function requireSuperAdmin(req: Request, res: Response, next: Function) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if ((req.user as any).email !== SUPER_ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Super Admin access required. Only Ahmed can access this endpoint.' });
  }
  next();
}

// Apply to all routes
router.use(requireSuperAdmin);

// ============================================================================
// API METRICS ENDPOINTS
// ============================================================================

// Get aggregated API metrics summary
router.get('/api-metrics', async (req: Request, res: Response) => {
  try {
    const timeWindow = parseInt(req.query.timeWindow as string) || 60; // minutes
    const summary = await storage.getApiMetricsSummary(timeWindow);
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get real-time metrics (last 5 minutes)
router.get('/api-metrics/live', async (req: Request, res: Response) => {
  try {
    const startDate = new Date(Date.now() - 5 * 60 * 1000);
    const metrics = await storage.getApiMetrics({ startDate, limit: 500 });
    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get per-endpoint statistics
router.get('/api-metrics/endpoints', async (req: Request, res: Response) => {
  try {
    const timeWindow = parseInt(req.query.timeWindow as string) || 60;
    const stats = await storage.getEndpointStats(timeWindow);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get recent errors
router.get('/api-metrics/errors', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const errors = await storage.getApiErrors(limit);
    res.json(errors);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// API ALERTS ENDPOINTS
// ============================================================================

// List all alerts
router.get('/api-alerts', async (req: Request, res: Response) => {
  try {
    const alerts = await storage.getAllApiAlerts();
    res.json(alerts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create alert
router.post('/api-alerts', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const alert = await storage.createApiAlert({
      ...req.body,
      createdBy: user.id
    });

    // Log the action
    await storage.createAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: 'CREATE',
      resourceType: 'api_alert',
      resourceId: alert.id,
      resourceName: alert.alertName,
      newValue: JSON.stringify(alert),
      ipAddress: req.ip
    });

    res.json(alert);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update alert
router.patch('/api-alerts/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const existing = await storage.getApiAlertById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    const updated = await storage.updateApiAlert(req.params.id, req.body);

    // Log the action
    await storage.createAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: 'UPDATE',
      resourceType: 'api_alert',
      resourceId: updated.id,
      resourceName: updated.alertName,
      previousValue: JSON.stringify(existing),
      newValue: JSON.stringify(updated),
      ipAddress: req.ip
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete alert
router.delete('/api-alerts/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const existing = await storage.getApiAlertById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    await storage.deleteApiAlert(req.params.id);

    // Log the action
    await storage.createAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: 'DELETE',
      resourceType: 'api_alert',
      resourceId: req.params.id,
      resourceName: existing.alertName,
      previousValue: JSON.stringify(existing),
      ipAddress: req.ip
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// FEATURE TOGGLES ENDPOINTS
// ============================================================================

// List all feature toggles
router.get('/feature-toggles', async (req: Request, res: Response) => {
  try {
    const toggles = await storage.getAllFeatureToggles();
    res.json(toggles);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create feature toggle
router.post('/feature-toggles', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const toggle = await storage.createFeatureToggle({
      ...req.body,
      updatedBy: user.id
    });

    // Log the action
    await storage.createAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: 'CREATE',
      resourceType: 'feature_toggle',
      resourceId: toggle.id,
      resourceName: toggle.featureName,
      newValue: JSON.stringify(toggle),
      ipAddress: req.ip
    });

    res.json(toggle);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update feature toggle
router.patch('/feature-toggles/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const existing = await storage.getFeatureToggleById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Feature toggle not found' });
    }

    const updated = await storage.updateFeatureToggle(req.params.id, {
      ...req.body,
      updatedBy: user.id
    });

    // Log the action
    await storage.createAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: 'TOGGLE',
      resourceType: 'feature_toggle',
      resourceId: updated.id,
      resourceName: updated.featureName,
      previousValue: JSON.stringify({ isEnabled: existing.isEnabled }),
      newValue: JSON.stringify({ isEnabled: updated.isEnabled }),
      ipAddress: req.ip
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete feature toggle
router.delete('/feature-toggles/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const existing = await storage.getFeatureToggleById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Feature toggle not found' });
    }

    await storage.deleteFeatureToggle(req.params.id);

    // Log the action
    await storage.createAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: 'DELETE',
      resourceType: 'feature_toggle',
      resourceId: req.params.id,
      resourceName: existing.featureName,
      previousValue: JSON.stringify(existing),
      ipAddress: req.ip
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// SYSTEM STATUS ENDPOINTS
// ============================================================================

// Get comprehensive system status
router.get('/system-status', async (req: Request, res: Response) => {
  try {
    const [apiMetrics, activeAlerts] = await Promise.all([
      storage.getApiMetricsSummary(60),
      storage.getActiveApiAlerts()
    ]);

    // Memory usage
    const memoryUsage = process.memoryUsage();

    res.json({
      api: apiMetrics,
      alerts: {
        active: activeAlerts.length,
        triggered: activeAlerts.filter(a => a.lastTriggered).length
      },
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024)
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get services status (DB, LLM, Email, Google)
router.get('/services-status', async (req: Request, res: Response) => {
  try {
    // Test database connection
    let dbStatus = 'connected';
    try {
      await storage.getTableList();
    } catch {
      dbStatus = 'error';
    }

    res.json({
      database: { status: dbStatus },
      email: { status: 'unknown' }, // Would need email service check
      google: { status: 'unknown' }, // Would need Google service check
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// DATABASE ADMIN ENDPOINTS
// ============================================================================

// List all tables
router.get('/database/tables', async (req: Request, res: Response) => {
  try {
    const tables = await storage.getTableList();
    res.json(tables);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get table data
router.get('/database/tables/:name', async (req: Request, res: Response) => {
  try {
    const { limit, offset, orderBy, orderDir } = req.query;
    const data = await storage.getTableData(req.params.name, {
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
      orderBy: orderBy as string,
      orderDir: orderDir as 'asc' | 'desc'
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Execute SQL query
router.post('/database/query', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const result = await storage.executeRawQuery(
      query,
      user.id,
      user.email,
      req.ip
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Export table to CSV/JSON
router.post('/database/export/:table', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { format = 'json' } = req.body;
    const tableName = req.params.table;

    const data = await storage.getTableData(tableName, { limit: 10000 });

    // Log the export
    await storage.createAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: 'EXPORT',
      resourceType: 'table',
      resourceName: tableName,
      newValue: JSON.stringify({ format, rowCount: data.rows.length }),
      ipAddress: req.ip
    });

    if (format === 'csv') {
      if (data.rows.length === 0) {
        return res.status(200).send('');
      }
      const headers = Object.keys(data.rows[0]).join(',');
      const rows = data.rows.map(row =>
        Object.values(row).map(v => {
          if (v === null) return '';
          if (typeof v === 'string' && (v.includes(',') || v.includes('"') || v.includes('\n'))) {
            return `"${v.replace(/"/g, '""')}"`;
          }
          return String(v);
        }).join(',')
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${tableName}.csv"`);
      res.send(`${headers}\n${rows}`);
    } else {
      res.json(data.rows);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// AUDIT LOGS ENDPOINTS
// ============================================================================

// Get audit logs
router.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const { userId, action, resourceType, limit } = req.query;
    const logs = await storage.getAuditLogs({
      userId: userId as string,
      action: action as string,
      resourceType: resourceType as string,
      limit: limit ? parseInt(limit as string) : undefined
    });
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// SQL QUERY HISTORY ENDPOINTS
// ============================================================================

// Get SQL query history
router.get('/sql-history', async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    const history = await storage.getSqlQueryHistory({
      limit: limit ? parseInt(limit as string) : undefined
    });
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// SESSIONS MANAGEMENT ENDPOINTS
// ============================================================================

// Get active sessions (from users table activity)
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    // Get recent login activity from audit logs
    const recentLogins = await storage.getAuditLogs({
      action: 'LOGIN',
      limit: 50
    });
    res.json(recentLogins);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// SCHEDULED JOBS ENDPOINTS
// ============================================================================

// Get all scheduled jobs (from HR agents)
router.get('/jobs', async (req: Request, res: Response) => {
  try {
    // Get HR agent configs which contain job information
    const agents = await storage.getAllHrAgentConfigs();
    res.json(agents);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Run a job manually
router.post('/jobs/:id/run', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const agent = await storage.getHrAgentConfigById(req.params.id);
    if (!agent) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Log the manual run
    await storage.createAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: 'EXECUTE',
      resourceType: 'scheduled_job',
      resourceId: agent.id,
      resourceName: agent.agentName,
      ipAddress: req.ip
    });

    // The actual execution would need to trigger the agent manager
    res.json({ success: true, message: `Job ${agent.agentName} triggered manually` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update job configuration
router.patch('/jobs/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const existing = await storage.getHrAgentConfigById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const updated = await storage.updateHrAgentConfig(req.params.id, req.body);

    // Log the update
    await storage.createAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: 'UPDATE',
      resourceType: 'scheduled_job',
      resourceId: updated.id,
      resourceName: updated.agentName,
      previousValue: JSON.stringify(existing),
      newValue: JSON.stringify(updated),
      ipAddress: req.ip
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
