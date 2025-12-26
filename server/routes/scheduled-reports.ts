import express from 'express';
import { storage } from '../storage';
import { z } from 'zod';

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
    'TRUE_ADMIN', 'ADMIN', 'TERRITORY_SALES_MANAGER', 'HR'
  ];

  if (!managerRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Manager or HR access required' });
  }
  next();
}

// Validation schemas
const createScheduledReportSchema = z.object({
  name: z.string(),
  type: z.enum(['EMPLOYEE_PERFORMANCE', 'PTO_ANALYSIS', 'SALES_REPORT', 'RECRUITMENT_METRICS', 'CUSTOM']),
  description: z.string().optional(),
  config: z.string(), // JSON configuration
  filters: z.string().optional(), // JSON filters
  schedule: z.string().optional(), // cron expression
  isActive: z.boolean().default(true),
});

const updateScheduledReportSchema = createScheduledReportSchema.partial();

const createReportExecutionSchema = z.object({
  reportId: z.string(),
  generatedBy: z.string().optional(),
  data: z.string(), // JSON data
  fileUrl: z.string().optional(),
  status: z.enum(['GENERATING', 'COMPLETED', 'FAILED']).default('GENERATING'),
  errorMessage: z.string().optional(),
});

// SCHEDULED REPORTS

// GET /api/scheduled-reports - List scheduled reports (filter by reportType, isActive)
router.get('/api/scheduled-reports', requireAuth, async (req, res) => {
  try {
    const { reportType, isActive } = req.query;

    const reports = await storage.getAllAnalyticsReports();

    // Apply filters
    let filtered = reports;

    if (reportType) {
      filtered = filtered.filter((r: any) => r.type === reportType);
    }

    if (isActive !== undefined) {
      const activeFilter = isActive === 'true';
      filtered = filtered.filter((r: any) => r.isActive === activeFilter);
    }

    res.json(filtered);
  } catch (error) {
    console.error('Error fetching scheduled reports:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled reports' });
  }
});

// GET /api/scheduled-reports/:id - Get specific report with execution history
router.get('/api/scheduled-reports/:id', requireAuth, async (req, res) => {
  try {
    const report = await storage.getAnalyticsReportById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Scheduled report not found' });
    }

    // Get execution history
    const history = await storage.getReportHistoryByReportId(req.params.id);

    // Sort history by most recent first
    const sortedHistory = history.sort((a: any, b: any) =>
      new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    );

    res.json({
      ...report,
      executionHistory: sortedHistory,
      totalExecutions: sortedHistory.length,
      lastExecution: sortedHistory[0] || null,
    });
  } catch (error) {
    console.error('Error fetching scheduled report:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled report' });
  }
});

// POST /api/scheduled-reports - Create scheduled report (manager only)
router.post('/api/scheduled-reports', requireManager, async (req, res) => {
  try {
    const user = req.user!;
    const data = createScheduledReportSchema.parse(req.body);

    const report = await storage.createAnalyticsReport({
      ...data,
      createdBy: user.id,
    });

    res.json(report);
  } catch (error) {
    console.error('Error creating scheduled report:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid report data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create scheduled report' });
  }
});

// PUT /api/scheduled-reports/:id - Update report schedule (manager only)
router.put('/api/scheduled-reports/:id', requireManager, async (req, res) => {
  try {
    const data = updateScheduledReportSchema.parse(req.body);
    const report = await storage.updateAnalyticsReport(req.params.id, {
      ...data,
      updatedAt: new Date().toISOString(),
    });

    if (!report) {
      return res.status(404).json({ error: 'Scheduled report not found' });
    }

    res.json(report);
  } catch (error) {
    console.error('Error updating scheduled report:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid report data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update scheduled report' });
  }
});

// DELETE /api/scheduled-reports/:id - Deactivate report (manager only)
router.delete('/api/scheduled-reports/:id', requireManager, async (req, res) => {
  try {
    const report = await storage.updateAnalyticsReport(req.params.id, {
      isActive: false,
      updatedAt: new Date().toISOString(),
    });

    if (!report) {
      return res.status(404).json({ error: 'Scheduled report not found' });
    }

    res.json({ success: true, message: 'Report deactivated successfully' });
  } catch (error) {
    console.error('Error deactivating scheduled report:', error);
    res.status(500).json({ error: 'Failed to deactivate scheduled report' });
  }
});

// POST /api/scheduled-reports/:id/run-now - Trigger immediate execution (manager only)
router.post('/api/scheduled-reports/:id/run-now', requireManager, async (req, res) => {
  try {
    const user = req.user!;
    const report = await storage.getAnalyticsReportById(req.params.id);

    if (!report) {
      return res.status(404).json({ error: 'Scheduled report not found' });
    }

    // Create execution record
    const execution = await storage.createReportHistory({
      reportId: report.id,
      generatedBy: user.id,
      status: 'GENERATING',
      data: JSON.stringify({}), // Will be populated by report generation
    });

    // Trigger async report generation
    generateReport(report, execution.id, user.id)
      .then(async (result) => {
        await storage.updateReportHistory(execution.id, {
          status: 'COMPLETED',
          data: JSON.stringify(result.data),
          fileUrl: result.fileUrl,
        });

        // Update last generated timestamp
        await storage.updateAnalyticsReport(report.id, {
          lastGenerated: new Date().toISOString(),
        });
      })
      .catch(async (error) => {
        console.error('Report generation failed:', error);
        await storage.updateReportHistory(execution.id, {
          status: 'FAILED',
          errorMessage: error.message,
        });
      });

    res.json({
      success: true,
      message: 'Report generation started',
      executionId: execution.id,
      status: 'GENERATING',
    });
  } catch (error) {
    console.error('Error triggering report execution:', error);
    res.status(500).json({ error: 'Failed to trigger report execution' });
  }
});

// REPORT EXECUTIONS

// GET /api/report-executions - List execution history (filter by scheduledReportId)
router.get('/api/report-executions', requireAuth, async (req, res) => {
  try {
    const { scheduledReportId, status } = req.query;

    let executions;

    if (scheduledReportId) {
      executions = await storage.getReportHistoryByReportId(scheduledReportId as string);
    } else {
      executions = await storage.getAllReportHistory();
    }

    // Apply status filter
    if (status) {
      executions = executions.filter((e: any) => e.status === status);
    }

    // Sort by most recent first
    executions.sort((a: any, b: any) =>
      new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    );

    res.json(executions);
  } catch (error) {
    console.error('Error fetching report executions:', error);
    res.status(500).json({ error: 'Failed to fetch report executions' });
  }
});

// GET /api/report-executions/:id - Get specific execution with file URL
router.get('/api/report-executions/:id', requireAuth, async (req, res) => {
  try {
    const execution = await storage.getReportHistoryById(req.params.id);
    if (!execution) {
      return res.status(404).json({ error: 'Report execution not found' });
    }

    // Get associated report details
    const report = await storage.getAnalyticsReportById(execution.reportId);

    res.json({
      ...execution,
      report: report ? {
        id: report.id,
        name: report.name,
        type: report.type,
      } : null,
    });
  } catch (error) {
    console.error('Error fetching report execution:', error);
    res.status(500).json({ error: 'Failed to fetch report execution' });
  }
});

// Helper function to generate report data
async function generateReport(report: any, executionId: string, userId: string) {
  // Simulate report generation
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Parse configuration
  const config = JSON.parse(report.config || '{}');
  const filters = JSON.parse(report.filters || '{}');

  // Generate mock data based on report type
  let data: any = {};

  switch (report.type) {
    case 'EMPLOYEE_PERFORMANCE':
      data = {
        totalEmployees: 150,
        avgPerformanceScore: 85,
        topPerformers: 12,
        needsImprovement: 8,
        departments: [
          { name: 'Sales', avgScore: 88 },
          { name: 'Operations', avgScore: 82 },
          { name: 'Support', avgScore: 87 },
        ],
      };
      break;

    case 'PTO_ANALYSIS':
      data = {
        totalPTORequests: 245,
        approvedRequests: 230,
        pendingRequests: 10,
        deniedRequests: 5,
        avgPTODays: 12.5,
        departments: [
          { name: 'Sales', totalDays: 380 },
          { name: 'Operations', totalDays: 450 },
          { name: 'Support', totalDays: 280 },
        ],
      };
      break;

    case 'SALES_REPORT':
      data = {
        totalRevenue: 1250000,
        totalDeals: 45,
        avgDealSize: 27778,
        topSalespeople: [
          { name: 'John Doe', revenue: 250000 },
          { name: 'Jane Smith', revenue: 220000 },
          { name: 'Bob Johnson', revenue: 195000 },
        ],
      };
      break;

    case 'RECRUITMENT_METRICS':
      data = {
        totalCandidates: 320,
        interviewed: 85,
        hired: 18,
        avgTimeToHire: 28,
        sourceEffectiveness: [
          { source: 'LinkedIn', hires: 8, conversionRate: 5.2 },
          { source: 'Indeed', hires: 6, conversionRate: 3.8 },
          { source: 'Referral', hires: 4, conversionRate: 12.5 },
        ],
      };
      break;

    default:
      data = {
        message: 'Custom report data',
        generatedAt: new Date().toISOString(),
        config,
        filters,
      };
  }

  // In a real implementation, generate PDF/Excel file and upload to storage
  const fileUrl = `/reports/${report.type.toLowerCase()}-${executionId}.pdf`;

  return {
    data,
    fileUrl,
  };
}

export default router;
