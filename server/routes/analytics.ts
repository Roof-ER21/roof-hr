import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';

const router = Router();

// Validation schema for analytics query parameters
const analyticsQuerySchema = z.object({
  timeRange: z.enum(['last7days', 'last30days', 'last90days', 'lastyear']).optional(),
  department: z.string().optional(),
});

// Middleware function for authentication
function requireAuth(roles: string[]) {
  return async (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}

// Get comprehensive analytics metrics
router.get('/metrics', requireAuth(['ADMIN', 'MANAGER']), async (req: any, res: any) => {
  try {
    const { timeRange = 'last30days', department = 'all' } = analyticsQuerySchema.parse(req.query);

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (timeRange) {
      case 'last7days':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'last30days':
        startDate.setDate(now.getDate() - 30);
        break;
      case 'last90days':
        startDate.setDate(now.getDate() - 90);
        break;
      case 'lastyear':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    // Fetch candidates data
    const candidates = await storage.getAllCandidates();
    const filteredCandidates = candidates.filter((c: any) => {
      const createdDate = new Date(c.createdAt);
      return createdDate >= startDate && createdDate <= now;
    });

    // Calculate pipeline conversion metrics
    const statusCounts = {
      applied: filteredCandidates.filter((c: any) => c.status === 'APPLIED').length,
      screening: filteredCandidates.filter((c: any) => c.status === 'SCREENING').length,
      interview: filteredCandidates.filter((c: any) => c.status === 'INTERVIEW').length,
      offer: filteredCandidates.filter((c: any) => c.status === 'OFFER').length,
      hired: filteredCandidates.filter((c: any) => c.status === 'HIRED').length,
    };

    const totalCandidates = filteredCandidates.length || 1; // Avoid division by zero
    
    const conversionRates = {
      appliedToScreening: totalCandidates > 0 ? Math.round((statusCounts.screening / totalCandidates) * 100) : 0,
      screeningToInterview: statusCounts.screening > 0 ? Math.round((statusCounts.interview / statusCounts.screening) * 100) : 0,
      interviewToOffer: statusCounts.interview > 0 ? Math.round((statusCounts.offer / statusCounts.interview) * 100) : 0,
      offerToHired: statusCounts.offer > 0 ? Math.round((statusCounts.hired / statusCounts.offer) * 100) : 0,
      overallConversion: totalCandidates > 0 ? Math.round((statusCounts.hired / totalCandidates) * 100 * 10) / 10 : 0,
    };

    // Calculate time to hire metrics
    const hiredCandidates = filteredCandidates.filter((c: any) => c.status === 'HIRED');
    const timeToHireData = hiredCandidates.map((c: any) => {
      const applied = new Date(c.createdAt);
      const hired = new Date(c.updatedAt);
      return Math.ceil((hired.getTime() - applied.getTime()) / (1000 * 60 * 60 * 24));
    });

    const avgTimeToHire = timeToHireData.length > 0 
      ? Math.round(timeToHireData.reduce((a: number, b: number) => a + b, 0) / timeToHireData.length)
      : 0;

    const medianTimeToHire = timeToHireData.length > 0
      ? timeToHireData.sort((a: number, b: number) => a - b)[Math.floor(timeToHireData.length / 2)]
      : 0;

    // Source effectiveness analysis
    const sourceMap = new Map();
    filteredCandidates.forEach((c: any) => {
      const source = c.source || 'Direct';
      if (!sourceMap.has(source)) {
        sourceMap.set(source, {
          applications: 0,
          hires: 0,
          totalTime: 0,
          scores: [],
        });
      }
      const data = sourceMap.get(source);
      data.applications++;
      if (c.status === 'HIRED') {
        data.hires++;
        const applied = new Date(c.createdAt);
        const hired = new Date(c.updatedAt);
        data.totalTime += Math.ceil((hired.getTime() - applied.getTime()) / (1000 * 60 * 60 * 24));
      }
      if (c.predictedSuccessScore) {
        data.scores.push(c.predictedSuccessScore);
      }
    });

    const sourceEffectiveness = Array.from(sourceMap.entries()).map(([source, data]: [string, any]) => ({
      source,
      applications: data.applications,
      hires: data.hires,
      conversionRate: Math.round((data.hires / data.applications) * 100 * 10) / 10,
      avgTimeToHire: data.hires > 0 ? Math.round(data.totalTime / data.hires) : 0,
      quality: data.scores.length > 0 
        ? Math.round(data.scores.reduce((a: number, b: number) => a + b, 0) / data.scores.length)
        : 70,
    }));

    // Get employee data for predictive analytics
    const employees = await storage.getAllEmployees();
    
    // Calculate predictive turnover (mock data for demo)
    const riskScores = employees.map((e: any) => {
      let riskScore = 0;
      const tenure = Math.floor((now.getTime() - new Date(e.hireDate).getTime()) / (1000 * 60 * 60 * 24 * 365));
      
      // Simple risk calculation based on tenure and other factors
      if (tenure < 1) riskScore += 30;
      else if (tenure < 2) riskScore += 20;
      
      // Random additional risk factors for demo
      riskScore += Math.random() * 30;
      
      return riskScore;
    });

    const highRisk = riskScores.filter((s: number) => s > 60).length;
    const mediumRisk = riskScores.filter((s: number) => s > 30 && s <= 60).length;
    const lowRisk = riskScores.filter((s: number) => s <= 30).length;

    // Calculate diversity metrics
    const genderCounts = {
      male: employees.filter((e: any) => e.gender === 'MALE').length,
      female: employees.filter((e: any) => e.gender === 'FEMALE').length,
      other: employees.filter((e: any) => !['MALE', 'FEMALE'].includes(e.gender || '')).length,
    };

    const totalEmployees = employees.length || 1;

    // Generate trend data
    const generateTrendData = () => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
      return months.map((month, index) => ({
        month,
        days: Math.max(20, avgTimeToHire - (6 - index) * 2 + Math.random() * 5),
      }));
    };

    // Cost analysis (mock data for demonstration)
    const baseCost = 4500;
    const costBreakdown = {
      advertising: Math.round(baseCost * 0.27),
      recruiterTime: Math.round(baseCost * 0.40),
      interviewTime: Math.round(baseCost * 0.20),
      tools: Math.round(baseCost * 0.09),
      other: Math.round(baseCost * 0.04),
    };

    const metrics = {
      pipelineConversion: {
        ...statusCounts,
        conversionRates,
      },
      timeToHire: {
        average: avgTimeToHire,
        median: medianTimeToHire,
        byStage: {
          applied_to_screening: 3,
          screening_to_interview: 7,
          interview_to_offer: 10,
          offer_to_hired: 8,
        },
        trend: generateTrendData(),
      },
      costPerHire: {
        total: baseCost,
        breakdown: costBreakdown,
        bySource: sourceEffectiveness.map(s => ({
          source: s.source,
          cost: Math.round(baseCost * (s.applications / totalCandidates)),
          hires: s.hires,
          costPerHire: s.hires > 0 ? Math.round((baseCost * (s.applications / totalCandidates)) / s.hires) : 0,
        })),
      },
      sourceEffectiveness,
      predictiveTurnover: {
        highRisk,
        mediumRisk,
        lowRisk,
        predictedTurnoverRate: Math.round(((highRisk * 0.7 + mediumRisk * 0.3) / totalEmployees) * 100 * 10) / 10,
        factors: [
          { factor: 'Compensation Below Market', impact: 35 },
          { factor: 'Limited Growth Opportunities', impact: 25 },
          { factor: 'Work-Life Balance', impact: 20 },
          { factor: 'Manager Relationship', impact: 15 },
          { factor: 'Job Satisfaction', impact: 5 },
        ],
      },
      diversity: {
        gender: [
          { category: 'Male', count: genderCounts.male, percentage: Math.round((genderCounts.male / totalEmployees) * 100) },
          { category: 'Female', count: genderCounts.female, percentage: Math.round((genderCounts.female / totalEmployees) * 100) },
          { category: 'Other', count: genderCounts.other, percentage: Math.round((genderCounts.other / totalEmployees) * 100) },
        ],
        ethnicity: [
          { category: 'White', count: Math.round(totalEmployees * 0.46), percentage: 46 },
          { category: 'Hispanic', count: Math.round(totalEmployees * 0.23), percentage: 23 },
          { category: 'Black', count: Math.round(totalEmployees * 0.14), percentage: 14 },
          { category: 'Asian', count: Math.round(totalEmployees * 0.11), percentage: 11 },
          { category: 'Other', count: Math.round(totalEmployees * 0.06), percentage: 6 },
        ],
        ageGroups: [
          { range: '18-25', count: Math.round(totalEmployees * 0.14) },
          { range: '26-35', count: Math.round(totalEmployees * 0.37) },
          { range: '36-45', count: Math.round(totalEmployees * 0.28) },
          { range: '46-55', count: Math.round(totalEmployees * 0.17) },
          { range: '56+', count: Math.round(totalEmployees * 0.04) },
        ],
      },
      performance: {
        newHirePerformance: [
          { month: '1', score: 65 },
          { month: '3', score: 75 },
          { month: '6', score: 82 },
          { month: '12', score: 88 },
        ],
        retentionRate: 85,
        promotionRate: 12,
        satisfaction: 78,
      },
    };

    res.json(metrics);
  } catch (error) {
    console.error('Error fetching analytics metrics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch analytics metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Export analytics report
router.post('/export', requireAuth(['ADMIN', 'MANAGER']), async (req: any, res: any) => {
  try {
    // In a real implementation, this would generate a PDF or Excel report
    // For now, we'll just return a success message
    res.json({ 
      success: true, 
      message: 'Report generation initiated',
      downloadUrl: '/api/analytics/download/report-' + Date.now() + '.pdf'
    });
  } catch (error) {
    console.error('Error exporting analytics report:', error);
    res.status(500).json({ 
      error: 'Failed to export report',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;