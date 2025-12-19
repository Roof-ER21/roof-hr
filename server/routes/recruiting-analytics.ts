import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const router = Router();

// Validation schema for date range query parameters
const dateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  period: z.enum(['7d', '30d', '90d', 'year', 'all']).optional(),
});

// Middleware function for authentication
function requireAuth(roles: string[]) {
  return async (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Ahmed always has access (super admin email fallback)
    if (req.user.email === 'ahmed.mahmoud@theroofdocs.com') {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

// Helper to calculate date range
function getDateRange(period?: string, startDate?: string, endDate?: string) {
  const now = new Date();
  let start = new Date();
  const end = endDate ? new Date(endDate) : now;

  if (startDate) {
    start = new Date(startDate);
  } else {
    switch (period) {
      case '7d':
        start.setDate(now.getDate() - 7);
        break;
      case '30d':
        start.setDate(now.getDate() - 30);
        break;
      case '90d':
        start.setDate(now.getDate() - 90);
        break;
      case 'year':
        start.setFullYear(now.getFullYear() - 1);
        break;
      case 'all':
        start = new Date('2020-01-01');
        break;
      default:
        start.setDate(now.getDate() - 30); // Default to 30 days
    }
  }

  return { start, end };
}

// GET /api/recruiting-analytics/overview
// Summary metrics: totalCandidates, activePipeline, hiredThisMonth, avgDaysToHire
router.get('/overview', requireAuth(['SYSTEM_ADMIN', 'HR_ADMIN', 'GENERAL_MANAGER', 'TERRITORY_MANAGER', 'MANAGER', 'TRUE_ADMIN', 'ADMIN']), async (req: any, res: any) => {
  try {
    const { period, startDate, endDate } = dateRangeSchema.parse(req.query);
    const { start, end } = getDateRange(period, startDate, endDate);

    const candidates = await storage.getAllCandidates();

    // Filter by date range
    const filteredCandidates = candidates.filter((c: any) => {
      const appliedDate = new Date(c.appliedDate || c.createdAt);
      return appliedDate >= start && appliedDate <= end;
    });

    // Calculate metrics
    const totalCandidates = filteredCandidates.length;
    const activePipeline = filteredCandidates.filter((c: any) =>
      !['HIRED', 'DEAD_BY_US', 'DEAD_BY_CANDIDATE', 'REJECTED'].includes(c.status)
    ).length;

    // Hired this month
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);

    const lastMonthStart = new Date(thisMonthStart);
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);

    const hiredThisMonth = filteredCandidates.filter((c: any) => {
      const updatedDate = new Date(c.updatedAt || c.createdAt);
      return c.status === 'HIRED' && updatedDate >= thisMonthStart;
    }).length;

    const hiredLastMonth = filteredCandidates.filter((c: any) => {
      const updatedDate = new Date(c.updatedAt || c.createdAt);
      return c.status === 'HIRED' && updatedDate >= lastMonthStart && updatedDate < thisMonthStart;
    }).length;

    // Calculate average days to hire
    const hiredCandidates = filteredCandidates.filter((c: any) => c.status === 'HIRED');
    let avgDaysToHire = 0;
    let avgDaysToHireLastMonth = 0;

    if (hiredCandidates.length > 0) {
      const totalDays = hiredCandidates.reduce((sum: number, c: any) => {
        const applied = new Date(c.appliedDate || c.createdAt);
        const hired = new Date(c.updatedAt || c.createdAt);
        return sum + Math.ceil((hired.getTime() - applied.getTime()) / (1000 * 60 * 60 * 24));
      }, 0);
      avgDaysToHire = Math.round(totalDays / hiredCandidates.length);
    }

    // Calculate last month's avg days to hire for comparison
    const hiredLastMonthCandidates = candidates.filter((c: any) => {
      const updatedDate = new Date(c.updatedAt || c.createdAt);
      return c.status === 'HIRED' && updatedDate >= lastMonthStart && updatedDate < thisMonthStart;
    });

    if (hiredLastMonthCandidates.length > 0) {
      const totalDaysLast = hiredLastMonthCandidates.reduce((sum: number, c: any) => {
        const applied = new Date(c.appliedDate || c.createdAt);
        const hired = new Date(c.updatedAt || c.createdAt);
        return sum + Math.ceil((hired.getTime() - applied.getTime()) / (1000 * 60 * 60 * 24));
      }, 0);
      avgDaysToHireLastMonth = Math.round(totalDaysLast / hiredLastMonthCandidates.length);
    }

    res.json({
      totalCandidates,
      activePipeline,
      hiredThisMonth,
      hiredLastMonth,
      avgDaysToHire,
      avgDaysToHireLastMonth,
      period: period || '30d',
    });
  } catch (error) {
    console.error('Error fetching recruiting overview:', error);
    res.status(500).json({
      error: 'Failed to fetch recruiting overview',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/recruiting-analytics/pipeline
// Pipeline funnel data with counts and conversion rates
router.get('/pipeline', requireAuth(['SYSTEM_ADMIN', 'HR_ADMIN', 'GENERAL_MANAGER', 'TERRITORY_MANAGER', 'MANAGER', 'TRUE_ADMIN', 'ADMIN']), async (req: any, res: any) => {
  try {
    const { period, startDate, endDate } = dateRangeSchema.parse(req.query);
    const { start, end } = getDateRange(period, startDate, endDate);

    const candidates = await storage.getAllCandidates();

    // Filter by date range
    const filteredCandidates = candidates.filter((c: any) => {
      const appliedDate = new Date(c.appliedDate || c.createdAt);
      return appliedDate >= start && appliedDate <= end;
    });

    const total = filteredCandidates.length || 1;

    // Count by status
    const applied = filteredCandidates.filter((c: any) => c.status === 'APPLIED').length;
    const screening = filteredCandidates.filter((c: any) => c.status === 'SCREENING').length;
    const interview = filteredCandidates.filter((c: any) => c.status === 'INTERVIEW').length;
    const offer = filteredCandidates.filter((c: any) => c.status === 'OFFER').length;
    const hired = filteredCandidates.filter((c: any) => c.status === 'HIRED').length;
    const deadByUs = filteredCandidates.filter((c: any) => c.status === 'DEAD_BY_US' || c.status === 'REJECTED').length;
    const deadByCandidate = filteredCandidates.filter((c: any) => c.status === 'DEAD_BY_CANDIDATE' || c.status === 'WITHDRAWN').length;

    // Calculate conversion rates
    const screeningConversion = applied > 0 ? Math.round((screening / applied) * 100) : 0;
    const interviewConversion = screening > 0 ? Math.round((interview / screening) * 100) : 0;
    const offerConversion = interview > 0 ? Math.round((offer / interview) * 100) : 0;
    const hiredConversion = offer > 0 ? Math.round((hired / offer) * 100) : 0;
    const overallConversion = total > 0 ? Math.round((hired / total) * 100 * 10) / 10 : 0;

    res.json({
      stages: {
        applied: { count: applied, percentage: Math.round((applied / total) * 100) },
        screening: { count: screening, percentage: Math.round((screening / total) * 100), conversionRate: screeningConversion },
        interview: { count: interview, percentage: Math.round((interview / total) * 100), conversionRate: interviewConversion },
        offer: { count: offer, percentage: Math.round((offer / total) * 100), conversionRate: offerConversion },
        hired: { count: hired, percentage: Math.round((hired / total) * 100), conversionRate: hiredConversion },
        dead: { count: deadByUs + deadByCandidate, deadByUs, deadByCandidate },
      },
      overallConversionRate: overallConversion,
      total: filteredCandidates.length,
    });
  } catch (error) {
    console.error('Error fetching pipeline analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch pipeline analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/recruiting-analytics/sources
// Source effectiveness: candidates by source, hire rate by source
router.get('/sources', requireAuth(['SYSTEM_ADMIN', 'HR_ADMIN', 'GENERAL_MANAGER', 'TERRITORY_MANAGER', 'MANAGER', 'TRUE_ADMIN', 'ADMIN']), async (req: any, res: any) => {
  try {
    const { period, startDate, endDate } = dateRangeSchema.parse(req.query);
    const { start, end } = getDateRange(period, startDate, endDate);

    const candidates = await storage.getAllCandidates();

    // Filter by date range
    const filteredCandidates = candidates.filter((c: any) => {
      const appliedDate = new Date(c.appliedDate || c.createdAt);
      return appliedDate >= start && appliedDate <= end;
    });

    // Group by source
    const sourceMap = new Map<string, { count: number; hired: number; avgScore: number; totalScore: number }>();

    filteredCandidates.forEach((c: any) => {
      const source = c.source || 'Direct';
      if (!sourceMap.has(source)) {
        sourceMap.set(source, { count: 0, hired: 0, avgScore: 0, totalScore: 0 });
      }
      const data = sourceMap.get(source)!;
      data.count++;
      if (c.status === 'HIRED') {
        data.hired++;
      }
      if (c.predictedSuccessScore) {
        data.totalScore += c.predictedSuccessScore;
      }
    });

    const total = filteredCandidates.length || 1;

    const sources = Array.from(sourceMap.entries()).map(([source, data]) => ({
      source,
      count: data.count,
      percentage: Math.round((data.count / total) * 100),
      hiredCount: data.hired,
      hireRate: data.count > 0 ? Math.round((data.hired / data.count) * 100 * 10) / 10 : 0,
      avgQualityScore: data.count > 0 ? Math.round(data.totalScore / data.count) : 0,
    })).sort((a, b) => b.count - a.count);

    res.json({ sources });
  } catch (error) {
    console.error('Error fetching source analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch source analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/recruiting-analytics/time-to-hire
// Time to hire trend data
router.get('/time-to-hire', requireAuth(['SYSTEM_ADMIN', 'HR_ADMIN', 'GENERAL_MANAGER', 'TERRITORY_MANAGER', 'MANAGER', 'TRUE_ADMIN', 'ADMIN']), async (req: any, res: any) => {
  try {
    const { period, startDate, endDate } = dateRangeSchema.parse(req.query);
    const { start, end } = getDateRange(period, startDate, endDate);

    const candidates = await storage.getAllCandidates();

    // Filter hired candidates within date range
    const hiredCandidates = candidates.filter((c: any) => {
      const hiredDate = new Date(c.updatedAt || c.createdAt);
      return c.status === 'HIRED' && hiredDate >= start && hiredDate <= end;
    });

    // Calculate current period average
    let current = 0;
    if (hiredCandidates.length > 0) {
      const totalDays = hiredCandidates.reduce((sum: number, c: any) => {
        const applied = new Date(c.appliedDate || c.createdAt);
        const hired = new Date(c.updatedAt || c.createdAt);
        return sum + Math.max(1, Math.ceil((hired.getTime() - applied.getTime()) / (1000 * 60 * 60 * 24)));
      }, 0);
      current = Math.round(totalDays / hiredCandidates.length);
    }

    // Calculate previous period for comparison
    const periodMs = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - periodMs);
    const prevEnd = start;

    const prevHiredCandidates = candidates.filter((c: any) => {
      const hiredDate = new Date(c.updatedAt || c.createdAt);
      return c.status === 'HIRED' && hiredDate >= prevStart && hiredDate < prevEnd;
    });

    let previous = 0;
    if (prevHiredCandidates.length > 0) {
      const totalDays = prevHiredCandidates.reduce((sum: number, c: any) => {
        const applied = new Date(c.appliedDate || c.createdAt);
        const hired = new Date(c.updatedAt || c.createdAt);
        return sum + Math.max(1, Math.ceil((hired.getTime() - applied.getTime()) / (1000 * 60 * 60 * 24)));
      }, 0);
      previous = Math.round(totalDays / prevHiredCandidates.length);
    }

    // Generate trend data (group by week or month based on period)
    const trendMap = new Map<string, { totalDays: number; count: number }>();

    hiredCandidates.forEach((c: any) => {
      const hiredDate = new Date(c.updatedAt || c.createdAt);
      const applied = new Date(c.appliedDate || c.createdAt);
      const days = Math.max(1, Math.ceil((hiredDate.getTime() - applied.getTime()) / (1000 * 60 * 60 * 24)));

      // Group by month for longer periods, week for shorter
      let key: string;
      if (period === 'year' || period === 'all') {
        key = `${hiredDate.getFullYear()}-${String(hiredDate.getMonth() + 1).padStart(2, '0')}`;
      } else {
        // Week number
        const weekStart = new Date(hiredDate);
        weekStart.setDate(hiredDate.getDate() - hiredDate.getDay());
        key = weekStart.toISOString().split('T')[0];
      }

      if (!trendMap.has(key)) {
        trendMap.set(key, { totalDays: 0, count: 0 });
      }
      const data = trendMap.get(key)!;
      data.totalDays += days;
      data.count++;
    });

    const trend = Array.from(trendMap.entries())
      .map(([date, data]) => ({
        date,
        avgDays: Math.round(data.totalDays / data.count),
        hireCount: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      current,
      previous,
      change: previous > 0 ? Math.round(((current - previous) / previous) * 100) : 0,
      trend,
    });
  } catch (error) {
    console.error('Error fetching time-to-hire analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch time-to-hire analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/recruiting-analytics/interviews
// Interview metrics: total, by status, by type, avg ratings
router.get('/interviews', requireAuth(['SYSTEM_ADMIN', 'HR_ADMIN', 'GENERAL_MANAGER', 'TERRITORY_MANAGER', 'MANAGER', 'TRUE_ADMIN', 'ADMIN']), async (req: any, res: any) => {
  try {
    const { period, startDate, endDate } = dateRangeSchema.parse(req.query);
    const { start, end } = getDateRange(period, startDate, endDate);

    const interviews = await storage.getAllInterviews();

    // Filter by date range
    const filteredInterviews = interviews.filter((i: any) => {
      const scheduledDate = new Date(i.scheduledDate || i.createdAt);
      return scheduledDate >= start && scheduledDate <= end;
    });

    const total = filteredInterviews.length;

    // Count by status
    const byStatus = {
      scheduled: filteredInterviews.filter((i: any) => i.status === 'SCHEDULED').length,
      completed: filteredInterviews.filter((i: any) => i.status === 'COMPLETED').length,
      cancelled: filteredInterviews.filter((i: any) => i.status === 'CANCELLED').length,
      noShow: filteredInterviews.filter((i: any) => i.status === 'NO_SHOW').length,
    };

    // Count by type
    const byType = {
      phone: filteredInterviews.filter((i: any) => i.type === 'PHONE').length,
      video: filteredInterviews.filter((i: any) => i.type === 'VIDEO').length,
      inPerson: filteredInterviews.filter((i: any) => i.type === 'IN_PERSON').length,
      technical: filteredInterviews.filter((i: any) => i.type === 'TECHNICAL').length,
      panel: filteredInterviews.filter((i: any) => i.type === 'PANEL').length,
    };

    // Calculate average rating from completed interviews
    const completedWithRating = filteredInterviews.filter((i: any) =>
      i.status === 'COMPLETED' && i.rating
    );

    const avgRating = completedWithRating.length > 0
      ? Math.round((completedWithRating.reduce((sum: number, i: any) => sum + (i.rating || 0), 0) / completedWithRating.length) * 10) / 10
      : 0;

    // Try to get feedback breakdown if available
    let ratingBreakdown = {
      technicalSkills: 0,
      communication: 0,
      problemSolving: 0,
      culturalFit: 0,
    };

    // Use ratings from interviews if feedback not available
    if (avgRating > 0) {
      ratingBreakdown = {
        technicalSkills: avgRating,
        communication: avgRating,
        problemSolving: avgRating,
        culturalFit: avgRating,
      };
    }

    res.json({
      total,
      byStatus,
      byType,
      avgRating,
      ratingBreakdown,
      completionRate: total > 0 ? Math.round((byStatus.completed / total) * 100) : 0,
    });
  } catch (error) {
    console.error('Error fetching interview analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch interview analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/recruiting-analytics/recruiters
// Recruiter performance: candidates per recruiter, hire rate, avg time to hire
router.get('/recruiters', requireAuth(['SYSTEM_ADMIN', 'HR_ADMIN', 'GENERAL_MANAGER', 'TERRITORY_MANAGER', 'MANAGER', 'TRUE_ADMIN', 'ADMIN']), async (req: any, res: any) => {
  try {
    const { period, startDate, endDate } = dateRangeSchema.parse(req.query);
    const { start, end } = getDateRange(period, startDate, endDate);

    const candidates = await storage.getAllCandidates();
    const users = await storage.getAllUsers();

    // Filter candidates by date range
    const filteredCandidates = candidates.filter((c: any) => {
      const appliedDate = new Date(c.appliedDate || c.createdAt);
      return appliedDate >= start && appliedDate <= end;
    });

    // Build recruiter map (users who have candidates assigned)
    const recruiterMap = new Map<string, {
      id: string;
      name: string;
      email: string;
      assigned: number;
      hired: number;
      totalDays: number;
    }>();

    // Initialize with all managers/recruiters
    users.filter((u: any) =>
      ['SYSTEM_ADMIN', 'HR_ADMIN', 'GENERAL_MANAGER', 'TERRITORY_MANAGER', 'MANAGER', 'TRUE_ADMIN', 'ADMIN'].includes(u.role)
    ).forEach((u: any) => {
      recruiterMap.set(u.id.toString(), {
        id: u.id.toString(),
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
        email: u.email,
        assigned: 0,
        hired: 0,
        totalDays: 0,
      });
    });

    // Count candidates by assigned recruiter
    filteredCandidates.forEach((c: any) => {
      const recruiterId = c.assignedTo?.toString() || c.recruiterId?.toString();
      if (recruiterId && recruiterMap.has(recruiterId)) {
        const data = recruiterMap.get(recruiterId)!;
        data.assigned++;
        if (c.status === 'HIRED') {
          data.hired++;
          const applied = new Date(c.appliedDate || c.createdAt);
          const hired = new Date(c.updatedAt || c.createdAt);
          data.totalDays += Math.max(1, Math.ceil((hired.getTime() - applied.getTime()) / (1000 * 60 * 60 * 24)));
        }
      }
    });

    // Convert to array and calculate rates
    const recruiters = Array.from(recruiterMap.values())
      .filter(r => r.assigned > 0) // Only show recruiters with activity
      .map(r => ({
        id: r.id,
        name: r.name,
        email: r.email,
        candidatesAssigned: r.assigned,
        hiredCount: r.hired,
        hireRate: r.assigned > 0 ? Math.round((r.hired / r.assigned) * 100 * 10) / 10 : 0,
        avgDaysToHire: r.hired > 0 ? Math.round(r.totalDays / r.hired) : 0,
      }))
      .sort((a, b) => b.candidatesAssigned - a.candidatesAssigned);

    res.json({ recruiters });
  } catch (error) {
    console.error('Error fetching recruiter analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch recruiter analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
