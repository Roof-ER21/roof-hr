/**
 * API Metrics Middleware
 * Captures performance metrics on every API request for the Super Admin dashboard
 */

import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

// Endpoints to exclude from metrics tracking (to avoid infinite loops and noise)
const EXCLUDED_ENDPOINTS = [
  '/api/super-admin/api-metrics',
  '/api/super-admin/api-metrics/live',
  '/api/health',
  '/api/llm/status'
];

/**
 * Middleware to capture API metrics
 * Tracks: endpoint, method, status code, response time, user, IP
 */
export function apiMetricsMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip excluded endpoints
  if (EXCLUDED_ENDPOINTS.some(e => req.path.startsWith(e))) {
    return next();
  }

  // Skip non-API routes
  if (!req.path.startsWith('/api')) {
    return next();
  }

  const startTime = Date.now();

  // Capture the original res.json to get response details
  const originalJson = res.json.bind(res);
  let errorMessage: string | undefined;

  // Override res.json to capture error messages
  res.json = function(body: any) {
    if (res.statusCode >= 400 && body?.error) {
      errorMessage = body.error;
    }
    return originalJson(body);
  };

  // Listen for response finish
  res.on('finish', async () => {
    const responseTime = Date.now() - startTime;

    // Extract endpoint category (first two path segments)
    const pathParts = req.path.split('/').filter(Boolean);
    const endpoint = pathParts.length > 1
      ? `/${pathParts.slice(0, 2).join('/')}`
      : req.path;

    // Get user info if authenticated
    const user = req.user as any;

    try {
      // Store metric asynchronously (don't block response)
      await storage.createApiMetric({
        endpoint,
        method: req.method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        statusCode: res.statusCode,
        responseTime,
        userId: user?.id || null,
        userEmail: user?.email || null,
        ipAddress: req.ip || req.socket.remoteAddress || null,
        errorMessage: errorMessage || null,
        requestPath: req.path
      });
    } catch (error) {
      // Silently fail - we don't want metrics collection to affect the API
      console.error('[API Metrics] Failed to save metric:', error);
    }
  });

  next();
}

/**
 * Check API alerts against current metrics
 * Should be called periodically (e.g., every minute)
 */
export async function checkApiAlerts(): Promise<void> {
  try {
    const alerts = await storage.getActiveApiAlerts();

    for (const alert of alerts) {
      const summary = await storage.getApiMetricsSummary(alert.timeWindow);
      let shouldTrigger = false;

      switch (alert.alertType) {
        case 'ERROR_RATE':
          const errorRate = 100 - summary.successRate;
          if (alert.operator === 'GREATER_THAN' && errorRate > alert.threshold) {
            shouldTrigger = true;
          }
          break;

        case 'RESPONSE_TIME':
          if (alert.operator === 'GREATER_THAN' && summary.avgResponseTime > alert.threshold) {
            shouldTrigger = true;
          }
          break;

        case 'AVAILABILITY':
          // If no requests in the time window, consider unavailable
          if (summary.totalRequests === 0 && alert.threshold > 0) {
            shouldTrigger = true;
          }
          break;
      }

      if (shouldTrigger) {
        // Check if we should trigger (avoid spamming)
        const lastTriggered = alert.lastTriggered ? new Date(alert.lastTriggered).getTime() : 0;
        const cooldownMs = alert.timeWindow * 60 * 1000; // Don't trigger more than once per time window

        if (Date.now() - lastTriggered > cooldownMs) {
          await storage.triggerAlert(alert.id);

          // TODO: Send notification email if configured
          if (alert.notifyEmail) {
            console.log(`[API Alerts] Alert "${alert.alertName}" triggered! Would notify: ${alert.notifyEmail}`);
          }
        }
      }
    }
  } catch (error) {
    console.error('[API Alerts] Failed to check alerts:', error);
  }
}

/**
 * Cleanup old metrics (called daily)
 */
export async function cleanupOldMetrics(): Promise<void> {
  try {
    const deletedCount = await storage.cleanupOldApiMetrics(30); // Keep 30 days
    console.log(`[API Metrics] Cleaned up ${deletedCount} old metrics`);
  } catch (error) {
    console.error('[API Metrics] Failed to cleanup old metrics:', error);
  }
}
