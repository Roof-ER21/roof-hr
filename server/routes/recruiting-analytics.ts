import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { db } from '../db';
import { sql, eq } from 'drizzle-orm';
import { candidateStatusHistory } from '@shared/schema';

const router = Router();

// Manager roles that can see all candidates
const MANAGER_ROLES = ['SYSTEM_ADMIN', 'HR_ADMIN', 'GENERAL_MANAGER', 'TERRITORY_MANAGER', 'MANAGER', 'TRUE_ADMIN', 'ADMIN'];

// Validation schema for date range query parameters
const dateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  period: z.enum(['7d', '30d', '90d', 'year', 'all']).optional(),
  assigneeId: z.string().optional(), // Filter by specific assignee
});

// Middleware function for authentication - allows managers OR users with assigned candidates
function requireAuthOrAssignments() {
  return async (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Ahmed always has access (super admin email fallback)
    if (req.user.email === 'ahmed.mahmoud@theroofdocs.com') {
      req.isManager = true;
      return next();
    }

    // Managers have full access
    if (MANAGER_ROLES.includes(req.user.role)) {
      req.isManager = true;
      return next();
    }

    // Check if non-manager has any candidate assignments
    const candidates = await storage.getAllCandidates();
    const hasAssignments = candidates.some((c: any) => c.assignedTo === req.user.id);

    if (hasAssignments) {
      req.isManager = false; // Flag for filtering later
      return next();
    }

    return res.status(403).json({ error: 'Insufficient permissions' });
  };
}

// Helper to filter candidates based on user permissions
function filterCandidatesForUser(candidates: any[], user: any, isManager: boolean) {
  if (isManager) {
    return candidates; // Managers see all
  }
  // Non-managers only see their assigned candidates
  return candidates.filter((c: any) => c.assignedTo === user.id);
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
router.get('/overview', requireAuthOrAssignments(), async (req: any, res: any) => {
  try {
    const { period, startDate, endDate, assigneeId } = dateRangeSchema.parse(req.query);
    const { start, end } = getDateRange(period, startDate, endDate);

    const allCandidates = await storage.getAllCandidates();
    // Exclude archived candidates from analytics
    const nonArchived = allCandidates.filter((c: any) => !c.isArchived);
    let candidates = filterCandidatesForUser(nonArchived, req.user, req.isManager);

    // Filter by specific assignee if provided
    if (assigneeId) {
      if (assigneeId === 'unassigned') {
        candidates = candidates.filter((c: any) => !c.assignedTo);
      } else {
        candidates = candidates.filter((c: any) => c.assignedTo?.toString() === assigneeId);
      }
    }

    // Filter by date range
    const filteredCandidates = candidates.filter((c: any) => {
      const appliedDate = new Date(c.appliedDate || c.createdAt);
      return appliedDate >= start && appliedDate <= end;
    });

    // Calculate metrics
    const totalCandidates = filteredCandidates.length;
    // Active pipeline excludes all terminal statuses
    const activePipeline = filteredCandidates.filter((c: any) =>
      !['HIRED', 'DEAD_BY_US', 'DEAD_BY_CANDIDATE', 'REJECTED', 'NO_SHOW'].includes(c.status)
    ).length;

    // Hired this month
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);

    const lastMonthStart = new Date(thisMonthStart);
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);

    // Get status history for HIRED transitions to find actual hire dates
    const allStatusHistory = await db.select().from(candidateStatusHistory)
      .where(eq(candidateStatusHistory.newStatus, 'HIRED'));
    const hireDateMap = new Map<string, Date>();
    allStatusHistory.forEach((h: any) => {
      const existing = hireDateMap.get(h.candidateId);
      const hDate = new Date(h.createdAt);
      // Use the latest HIRED transition date
      if (!existing || hDate > existing) {
        hireDateMap.set(h.candidateId, hDate);
      }
    });

    // Helper to get actual hire date for a candidate
    const getHireDate = (c: any): Date => {
      return hireDateMap.get(c.id) || new Date(c.updatedAt || c.createdAt);
    };

    const hiredThisMonth = filteredCandidates.filter((c: any) => {
      return c.status === 'HIRED' && getHireDate(c) >= thisMonthStart;
    }).length;

    const hiredLastMonth = filteredCandidates.filter((c: any) => {
      const hireDate = getHireDate(c);
      return c.status === 'HIRED' && hireDate >= lastMonthStart && hireDate < thisMonthStart;
    }).length;

    // Calculate average days to hire using actual status history dates
    const hiredCandidates = filteredCandidates.filter((c: any) => c.status === 'HIRED');
    let avgDaysToHire = 0;
    let avgDaysToHireLastMonth = 0;

    if (hiredCandidates.length > 0) {
      const totalDays = hiredCandidates.reduce((sum: number, c: any) => {
        const applied = new Date(c.appliedDate || c.createdAt);
        const hired = getHireDate(c);
        return sum + Math.max(1, Math.ceil((hired.getTime() - applied.getTime()) / (1000 * 60 * 60 * 24)));
      }, 0);
      avgDaysToHire = Math.round(totalDays / hiredCandidates.length);
    }

    // Calculate last month's avg days to hire for comparison
    const hiredLastMonthCandidates = candidates.filter((c: any) => {
      const hireDate = getHireDate(c);
      return c.status === 'HIRED' && hireDate >= lastMonthStart && hireDate < thisMonthStart;
    });

    if (hiredLastMonthCandidates.length > 0) {
      const totalDaysLast = hiredLastMonthCandidates.reduce((sum: number, c: any) => {
        const applied = new Date(c.appliedDate || c.createdAt);
        const hired = getHireDate(c);
        return sum + Math.max(1, Math.ceil((hired.getTime() - applied.getTime()) / (1000 * 60 * 60 * 24)));
      }, 0);
      avgDaysToHireLastMonth = Math.round(totalDaysLast / hiredLastMonthCandidates.length);
    }

    // Calculate drop-off: where candidates die in the pipeline
    const deadCandidates = filteredCandidates.filter((c: any) =>
      ['DEAD_BY_US', 'DEAD_BY_CANDIDATE', 'REJECTED', 'NO_SHOW'].includes(c.status)
    );
    const dropOffByStage: Record<string, number> = {};
    // Use status history to find what stage they died from
    for (const dead of deadCandidates) {
      const history = allStatusHistory.length > 0 ? [] : []; // We need full history
      // Use the candidate's stage field or last known active status
      const lastActiveStage = dead.stage || 'APPLIED';
      dropOffByStage[lastActiveStage] = (dropOffByStage[lastActiveStage] || 0) + 1;
    }

    res.json({
      totalCandidates,
      activePipeline,
      hiredThisMonth,
      hiredLastMonth,
      avgDaysToHire,
      avgDaysToHireLastMonth,
      deadTotal: deadCandidates.length,
      dropOffByStage,
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
router.get('/pipeline', requireAuthOrAssignments(), async (req: any, res: any) => {
  try {
    const { period, startDate, endDate, assigneeId } = dateRangeSchema.parse(req.query);
    const { start, end } = getDateRange(period, startDate, endDate);

    const allCandidates = await storage.getAllCandidates();
    const nonArchived = allCandidates.filter((c: any) => !c.isArchived);
    let candidates = filterCandidatesForUser(nonArchived, req.user, req.isManager);

    // Filter by specific assignee if provided
    if (assigneeId) {
      if (assigneeId === 'unassigned') {
        candidates = candidates.filter((c: any) => !c.assignedTo);
      } else {
        candidates = candidates.filter((c: any) => c.assignedTo?.toString() === assigneeId);
      }
    }

    // Filter by date range
    const filteredCandidates = candidates.filter((c: any) => {
      const appliedDate = new Date(c.appliedDate || c.createdAt);
      return appliedDate >= start && appliedDate <= end;
    });

    const total = filteredCandidates.length || 1;

    // Count by current status
    const screening = filteredCandidates.filter((c: any) => c.status === 'SCREENING').length;
    const applied = filteredCandidates.filter((c: any) => c.status === 'APPLIED').length;
    const interview = filteredCandidates.filter((c: any) => c.status === 'INTERVIEW').length;
    const offer = filteredCandidates.filter((c: any) => c.status === 'OFFER').length;
    const hired = filteredCandidates.filter((c: any) => c.status === 'HIRED').length;
    const deadByUs = filteredCandidates.filter((c: any) => c.status === 'DEAD_BY_US' || c.status === 'REJECTED').length;
    const deadByCandidate = filteredCandidates.filter((c: any) => c.status === 'DEAD_BY_CANDIDATE').length;
    const noShow = filteredCandidates.filter((c: any) => c.status === 'NO_SHOW').length;

    // Business flow: SCREENING (Phone Screening) → APPLIED (Called) → INTERVIEW → OFFER → HIRED
    // Use status history to calculate cumulative progression (how many ever reached each stage)
    const allHistory = await db.select().from(candidateStatusHistory);
    const candidateIds = new Set(filteredCandidates.map((c: any) => c.id));
    const relevantHistory = allHistory.filter((h: any) => candidateIds.has(h.candidateId));

    // Track which candidates ever reached each stage
    const everReached: Record<string, Set<string>> = {
      SCREENING: new Set<string>(),
      APPLIED: new Set<string>(),
      INTERVIEW: new Set<string>(),
      OFFER: new Set<string>(),
      HIRED: new Set<string>(),
    };

    // All candidates start by entering the system (count them as reaching their current + past stages)
    filteredCandidates.forEach((c: any) => {
      const stageOrder = ['SCREENING', 'APPLIED', 'INTERVIEW', 'OFFER', 'HIRED'];
      const currentIdx = stageOrder.indexOf(c.status);
      // Count current stage and all prior stages
      if (currentIdx >= 0) {
        for (let i = 0; i <= currentIdx; i++) {
          everReached[stageOrder[i]]?.add(c.id);
        }
      }
      // Also count from history
      relevantHistory
        .filter((h: any) => h.candidateId === c.id)
        .forEach((h: any) => {
          if (everReached[h.newStatus]) {
            everReached[h.newStatus].add(c.id);
          }
        });
      // Dead candidates also reached stages before dying
      if (['DEAD_BY_US', 'DEAD_BY_CANDIDATE', 'REJECTED', 'NO_SHOW'].includes(c.status)) {
        relevantHistory
          .filter((h: any) => h.candidateId === c.id && !['DEAD_BY_US', 'DEAD_BY_CANDIDATE', 'REJECTED', 'NO_SHOW'].includes(h.newStatus))
          .forEach((h: any) => {
            if (everReached[h.newStatus]) {
              everReached[h.newStatus].add(c.id);
            }
          });
      }
    });

    // Cumulative counts (how many ever reached this stage)
    const cumulativeScreening = everReached.SCREENING.size || screening;
    const cumulativeApplied = everReached.APPLIED.size || applied;
    const cumulativeInterview = everReached.INTERVIEW.size || interview;
    const cumulativeOffer = everReached.OFFER.size || offer;
    const cumulativeHired = everReached.HIRED.size || hired;

    // Drop-off between stages (cumulative)
    const dropOff = {
      screeningToApplied: cumulativeScreening > 0 ? cumulativeScreening - cumulativeApplied : 0,
      appliedToInterview: cumulativeApplied > 0 ? cumulativeApplied - cumulativeInterview : 0,
      interviewToOffer: cumulativeInterview > 0 ? cumulativeInterview - cumulativeOffer : 0,
      offerToHired: cumulativeOffer > 0 ? cumulativeOffer - cumulativeHired : 0,
    };

    const overallConversion = total > 0 ? Math.round((hired / total) * 100 * 10) / 10 : 0;

    res.json({
      stages: {
        screening: { count: screening, percentage: Math.round((screening / total) * 100), cumulative: cumulativeScreening },
        applied: { count: applied, percentage: Math.round((applied / total) * 100), cumulative: cumulativeApplied },
        interview: { count: interview, percentage: Math.round((interview / total) * 100), cumulative: cumulativeInterview },
        offer: { count: offer, percentage: Math.round((offer / total) * 100), cumulative: cumulativeOffer },
        hired: { count: hired, percentage: Math.round((hired / total) * 100), cumulative: cumulativeHired },
        dead: { count: deadByUs + deadByCandidate + noShow, deadByUs, deadByCandidate, noShow },
      },
      dropOff,
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
router.get('/sources', requireAuthOrAssignments(), async (req: any, res: any) => {
  try {
    const { period, startDate, endDate, assigneeId } = dateRangeSchema.parse(req.query);
    const { start, end } = getDateRange(period, startDate, endDate);

    const allCandidates = await storage.getAllCandidates();
    const nonArchived = allCandidates.filter((c: any) => !c.isArchived);
    let candidates = filterCandidatesForUser(nonArchived, req.user, req.isManager);

    // Filter by specific assignee if provided
    if (assigneeId) {
      if (assigneeId === 'unassigned') {
        candidates = candidates.filter((c: any) => !c.assignedTo);
      } else {
        candidates = candidates.filter((c: any) => c.assignedTo?.toString() === assigneeId);
      }
    }

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

// GET /api/recruiting-analytics/dropoff
// Where candidates are being lost in the pipeline
router.get('/dropoff', requireAuthOrAssignments(), async (req: any, res: any) => {
  try {
    const { period, startDate, endDate, assigneeId } = dateRangeSchema.parse(req.query);
    const { start, end } = getDateRange(period, startDate, endDate);

    const allCandidates = await storage.getAllCandidates();
    const nonArchived = allCandidates.filter((c: any) => !c.isArchived);
    let candidates = filterCandidatesForUser(nonArchived, req.user, req.isManager);

    if (assigneeId) {
      if (assigneeId === 'unassigned') {
        candidates = candidates.filter((c: any) => !c.assignedTo);
      } else {
        candidates = candidates.filter((c: any) => c.assignedTo?.toString() === assigneeId);
      }
    }

    const filteredCandidates = candidates.filter((c: any) => {
      const appliedDate = new Date(c.appliedDate || c.createdAt);
      return appliedDate >= start && appliedDate <= end;
    });

    // Get all status history for these candidates
    const allHistory = await db.select().from(candidateStatusHistory);
    const candidateIds = new Set(filteredCandidates.map((c: any) => c.id));

    // For dead candidates, find what stage they died from (previous status before terminal)
    const deadStatuses = ['DEAD_BY_US', 'DEAD_BY_CANDIDATE', 'REJECTED', 'NO_SHOW'];
    const deadCandidates = filteredCandidates.filter((c: any) => deadStatuses.includes(c.status));

    // Business flow stages for display
    const stageLabels: Record<string, string> = {
      'SCREENING': 'Phone Screening',
      'APPLIED': 'Called',
      'INTERVIEW': 'Interview Scheduled',
      'OFFER': 'Decision Pending',
    };

    const dropOffData: Record<string, { deadByUs: number; deadByCandidate: number; noShow: number; rejected: number; total: number }> = {};
    Object.keys(stageLabels).forEach(stage => {
      dropOffData[stage] = { deadByUs: 0, deadByCandidate: 0, noShow: 0, rejected: 0, total: 0 };
    });

    deadCandidates.forEach((c: any) => {
      // Find the last active stage before death from history
      const history = allHistory
        .filter((h: any) => h.candidateId === c.id && deadStatuses.includes(h.newStatus))
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      let lastActiveStage = 'APPLIED'; // Default
      if (history.length > 0) {
        lastActiveStage = history[0].previousStatus;
      } else {
        // Fall back to stage field
        lastActiveStage = c.stage || 'APPLIED';
      }

      // Normalize to known stages
      if (!dropOffData[lastActiveStage]) {
        lastActiveStage = 'APPLIED';
      }

      const bucket = dropOffData[lastActiveStage];
      if (bucket) {
        bucket.total++;
        if (c.status === 'DEAD_BY_US') bucket.deadByUs++;
        else if (c.status === 'DEAD_BY_CANDIDATE') bucket.deadByCandidate++;
        else if (c.status === 'NO_SHOW') bucket.noShow++;
        else if (c.status === 'REJECTED') bucket.rejected++;
      }
    });

    // Calculate stale candidates (stuck in stage too long)
    const now = new Date();
    const staleDays = 14; // Candidates not updated in 14+ days
    const staleCandidates = filteredCandidates
      .filter((c: any) => !deadStatuses.includes(c.status) && c.status !== 'HIRED')
      .filter((c: any) => {
        const lastUpdate = new Date(c.updatedAt || c.createdAt);
        return (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24) > staleDays;
      })
      .map((c: any) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        status: c.status,
        position: c.position,
        daysSinceUpdate: Math.floor((now.getTime() - new Date(c.updatedAt || c.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
        assignedTo: c.assignedTo,
      }));

    res.json({
      dropOffByStage: Object.entries(dropOffData).map(([stage, data]) => ({
        stage,
        label: stageLabels[stage] || stage,
        ...data,
      })),
      totalDead: deadCandidates.length,
      totalActive: filteredCandidates.filter((c: any) => !deadStatuses.includes(c.status) && c.status !== 'HIRED').length,
      staleCandidates: staleCandidates.slice(0, 20), // Top 20 stale
      staleCount: staleCandidates.length,
    });
  } catch (error) {
    console.error('Error fetching dropoff analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch dropoff analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/recruiting-analytics/time-to-hire
// Time to hire trend data
router.get('/time-to-hire', requireAuthOrAssignments(), async (req: any, res: any) => {
  try {
    const { period, startDate, endDate, assigneeId } = dateRangeSchema.parse(req.query);
    const { start, end } = getDateRange(period, startDate, endDate);

    const allCandidates = await storage.getAllCandidates();
    const nonArchived = allCandidates.filter((c: any) => !c.isArchived);
    let candidates = filterCandidatesForUser(nonArchived, req.user, req.isManager);

    // Filter by specific assignee if provided
    if (assigneeId) {
      if (assigneeId === 'unassigned') {
        candidates = candidates.filter((c: any) => !c.assignedTo);
      } else {
        candidates = candidates.filter((c: any) => c.assignedTo?.toString() === assigneeId);
      }
    }

    // Get status history for HIRED transitions to find actual hire dates
    const allHiredHistory = await db.select().from(candidateStatusHistory)
      .where(eq(candidateStatusHistory.newStatus, 'HIRED'));
    const hireDateMap = new Map<string, Date>();
    allHiredHistory.forEach((h: any) => {
      const existing = hireDateMap.get(h.candidateId);
      const hDate = new Date(h.createdAt);
      if (!existing || hDate > existing) {
        hireDateMap.set(h.candidateId, hDate);
      }
    });

    const getHireDate = (c: any): Date => {
      return hireDateMap.get(c.id) || new Date(c.updatedAt || c.createdAt);
    };

    // Filter hired candidates within date range using actual hire date
    const hiredCandidates = candidates.filter((c: any) => {
      const hiredDate = getHireDate(c);
      return c.status === 'HIRED' && hiredDate >= start && hiredDate <= end;
    });

    // Calculate current period average
    let current = 0;
    if (hiredCandidates.length > 0) {
      const totalDays = hiredCandidates.reduce((sum: number, c: any) => {
        const applied = new Date(c.appliedDate || c.createdAt);
        const hired = getHireDate(c);
        return sum + Math.max(1, Math.ceil((hired.getTime() - applied.getTime()) / (1000 * 60 * 60 * 24)));
      }, 0);
      current = Math.round(totalDays / hiredCandidates.length);
    }

    // Calculate previous period for comparison
    const periodMs = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - periodMs);
    const prevEnd = start;

    const prevHiredCandidates = candidates.filter((c: any) => {
      const hiredDate = getHireDate(c);
      return c.status === 'HIRED' && hiredDate >= prevStart && hiredDate < prevEnd;
    });

    let previous = 0;
    if (prevHiredCandidates.length > 0) {
      const totalDays = prevHiredCandidates.reduce((sum: number, c: any) => {
        const applied = new Date(c.appliedDate || c.createdAt);
        const hired = getHireDate(c);
        return sum + Math.max(1, Math.ceil((hired.getTime() - applied.getTime()) / (1000 * 60 * 60 * 24)));
      }, 0);
      previous = Math.round(totalDays / prevHiredCandidates.length);
    }

    // Generate trend data (group by week or month based on period)
    const trendMap = new Map<string, { totalDays: number; count: number }>();

    hiredCandidates.forEach((c: any) => {
      const hiredDate = getHireDate(c);
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
router.get('/interviews', requireAuthOrAssignments(), async (req: any, res: any) => {
  try {
    const { period, startDate, endDate, assigneeId } = dateRangeSchema.parse(req.query);
    const { start, end } = getDateRange(period, startDate, endDate);

    // Get interviews and filter by assigned candidates for non-managers
    const allInterviews = await storage.getAllInterviews();
    const allCandidates = (await storage.getAllCandidates()).filter((c: any) => !c.isArchived);
    let interviews = allInterviews;

    // Build candidate IDs to filter by
    let candidateIdsToFilter: string[] | null = null;

    if (!req.isManager) {
      // Non-managers only see their assigned candidates' interviews
      candidateIdsToFilter = allCandidates
        .filter((c: any) => c.assignedTo === req.user.id)
        .map((c: any) => c.id);
    } else if (assigneeId) {
      // Managers filtering by specific assignee
      if (assigneeId === 'unassigned') {
        candidateIdsToFilter = allCandidates
          .filter((c: any) => !c.assignedTo)
          .map((c: any) => c.id);
      } else {
        candidateIdsToFilter = allCandidates
          .filter((c: any) => c.assignedTo?.toString() === assigneeId)
          .map((c: any) => c.id);
      }
    }

    // Apply candidate filter if needed
    if (candidateIdsToFilter) {
      interviews = allInterviews.filter((i: any) => candidateIdsToFilter!.includes(i.candidateId));
    }

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
// Team performance: candidates per assignee (including sourcers and unassigned)
router.get('/recruiters', requireAuthOrAssignments(), async (req: any, res: any) => {
  try {
    const { period, startDate, endDate, assigneeId } = dateRangeSchema.parse(req.query);
    const { start, end } = getDateRange(period, startDate, endDate);

    const allCandidates = await storage.getAllCandidates();
    const nonArchived = allCandidates.filter((c: any) => !c.isArchived);
    let candidates = filterCandidatesForUser(nonArchived, req.user, req.isManager);
    const users = await storage.getAllUsers();

    // Filter by specific assignee if provided
    if (assigneeId) {
      if (assigneeId === 'unassigned') {
        candidates = candidates.filter((c: any) => !c.assignedTo);
      } else {
        candidates = candidates.filter((c: any) => c.assignedTo?.toString() === assigneeId);
      }
    }

    // Filter candidates by date range
    const filteredCandidates = candidates.filter((c: any) => {
      const appliedDate = new Date(c.appliedDate || c.createdAt);
      return appliedDate >= start && appliedDate <= end;
    });

    // Build assignee map from candidates (including null for unassigned)
    const assigneeMap = new Map<string | null, {
      assigned: number;
      hired: number;
      totalDays: number;
      hiredCandidates: Array<{ id: string; name: string; position: string; hiredDate: string }>;
    }>();

    // Get status history for HIRED transitions
    const allHiredHistory = await db.select().from(candidateStatusHistory)
      .where(eq(candidateStatusHistory.newStatus, 'HIRED'));
    const hireDateMap = new Map<string, Date>();
    allHiredHistory.forEach((h: any) => {
      const existing = hireDateMap.get(h.candidateId);
      const hDate = new Date(h.createdAt);
      if (!existing || hDate > existing) {
        hireDateMap.set(h.candidateId, hDate);
      }
    });
    const getHireDate = (c: any): Date => hireDateMap.get(c.id) || new Date(c.updatedAt || c.createdAt);

    // Count candidates by assignee (including unassigned)
    filteredCandidates.forEach((c: any) => {
      const assigneeId = c.assignedTo?.toString() || null;

      if (!assigneeMap.has(assigneeId)) {
        assigneeMap.set(assigneeId, { assigned: 0, hired: 0, totalDays: 0, hiredCandidates: [] });
      }

      const data = assigneeMap.get(assigneeId)!;
      data.assigned++;

      if (c.status === 'HIRED') {
        data.hired++;
        const applied = new Date(c.appliedDate || c.createdAt);
        const hired = getHireDate(c);
        data.totalDays += Math.max(1, Math.ceil((hired.getTime() - applied.getTime()) / (1000 * 60 * 60 * 24)));
        // Track hired candidate details
        data.hiredCandidates.push({
          id: c.id,
          name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email,
          position: c.position || 'Unknown Position',
          hiredDate: hired.toISOString(),
        });
      }
    });

    // Build response with user lookup
    const recruiters: Array<{
      id: string;
      name: string;
      email: string;
      role: string;
      candidatesAssigned: number;
      hiredCount: number;
      hireRate: number;
      avgDaysToHire: number;
      hiredCandidates: Array<{ id: string; name: string; position: string; hiredDate: string }>;
    }> = [];

    for (const [assigneeId, data] of assigneeMap.entries()) {
      if (assigneeId === null) {
        // Unassigned category
        recruiters.push({
          id: 'unassigned',
          name: 'Unassigned',
          email: '',
          role: '',
          candidatesAssigned: data.assigned,
          hiredCount: data.hired,
          hireRate: data.assigned > 0 ? Math.round((data.hired / data.assigned) * 100 * 10) / 10 : 0,
          avgDaysToHire: data.hired > 0 ? Math.round(data.totalDays / data.hired) : 0,
          hiredCandidates: data.hiredCandidates.sort((a, b) => new Date(b.hiredDate).getTime() - new Date(a.hiredDate).getTime()),
        });
      } else {
        // Find user info
        const user = users.find((u: any) => u.id.toString() === assigneeId);
        if (user) {
          recruiters.push({
            id: assigneeId,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
            email: user.email,
            role: user.role || '',
            candidatesAssigned: data.assigned,
            hiredCount: data.hired,
            hireRate: data.assigned > 0 ? Math.round((data.hired / data.assigned) * 100 * 10) / 10 : 0,
            avgDaysToHire: data.hired > 0 ? Math.round(data.totalDays / data.hired) : 0,
            hiredCandidates: data.hiredCandidates.sort((a, b) => new Date(b.hiredDate).getTime() - new Date(a.hiredDate).getTime()),
          });
        } else {
          // User not found - still show their data
          recruiters.push({
            id: assigneeId,
            name: 'Unknown User',
            email: '',
            role: '',
            candidatesAssigned: data.assigned,
            hiredCount: data.hired,
            hireRate: data.assigned > 0 ? Math.round((data.hired / data.assigned) * 100 * 10) / 10 : 0,
            avgDaysToHire: data.hired > 0 ? Math.round(data.totalDays / data.hired) : 0,
            hiredCandidates: data.hiredCandidates.sort((a, b) => new Date(b.hiredDate).getTime() - new Date(a.hiredDate).getTime()),
          });
        }
      }
    }

    // Sort: Unassigned at bottom, then by candidates assigned descending
    recruiters.sort((a, b) => {
      if (a.id === 'unassigned') return 1;
      if (b.id === 'unassigned') return -1;
      return b.candidatesAssigned - a.candidatesAssigned;
    });

    // Calculate totals
    const totals = {
      totalCandidates: filteredCandidates.length,
      totalHired: recruiters.reduce((sum, r) => sum + r.hiredCount, 0),
    };

    res.json({ recruiters, totals });
  } catch (error) {
    console.error('Error fetching recruiter analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch recruiter analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper function to generate CSV from candidates
function generateCandidateCSV(candidates: any[]): string {
  const headers = [
    'Name', 'Email', 'Phone', 'Position', 'Status', 'Stage', 'Applied Date',
    'Match Score', 'Potential Score', 'Culture Fit', 'Technical Fit',
    'Is Archived', 'Archived Date', 'Notes'
  ];

  const rows = candidates.map(c => [
    `${c.firstName || ''} ${c.lastName || ''}`.trim(),
    c.email || '',
    c.phone || '',
    c.position || '',
    c.status || '',
    c.stage || '',
    c.appliedDate ? new Date(c.appliedDate).toLocaleDateString('en-US', { timeZone: 'America/New_York' }) : '',
    c.matchScore?.toString() || '',
    c.potentialScore?.toString() || '',
    c.cultureFitScore?.toString() || '',
    c.technicalFitScore?.toString() || '',
    c.isArchived ? 'Yes' : 'No',
    c.archivedAt ? new Date(c.archivedAt).toLocaleDateString('en-US', { timeZone: 'America/New_York' }) : '',
    (c.notes || '').replace(/"/g, '""').replace(/\n/g, ' ') // Escape quotes and newlines
  ]);

  return [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
}

// Helper function to generate PDF report content
function generatePDFReport(candidates: any[], type: string): string {
  // Generate an HTML report that can be displayed/printed
  const now = new Date();
  const typeLabel = type === 'archived' ? 'Archived' : type === 'current' ? 'Current' : 'All';

  // Calculate stats
  const statusCounts: Record<string, number> = {};
  const positionCounts: Record<string, number> = {};
  let totalMatchScore = 0;
  let matchScoreCount = 0;

  candidates.forEach(c => {
    statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
    positionCounts[c.position] = (positionCounts[c.position] || 0) + 1;
    if (c.matchScore) {
      totalMatchScore += c.matchScore;
      matchScoreCount++;
    }
  });

  const avgMatchScore = matchScoreCount > 0 ? Math.round(totalMatchScore / matchScoreCount) : 0;

  // Sort by match score for top candidates
  const topCandidates = [...candidates]
    .filter(c => c.matchScore)
    .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
    .slice(0, 10);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Roof HR - ${typeLabel} Candidates Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
    h1 { color: #1a365d; border-bottom: 2px solid #3182ce; padding-bottom: 10px; }
    h2 { color: #2d3748; margin-top: 30px; }
    .header { margin-bottom: 30px; }
    .meta { color: #718096; font-size: 14px; }
    .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0; }
    .stat-box { background: #f7fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
    .stat-value { font-size: 28px; font-weight: bold; color: #2d3748; }
    .stat-label { color: #718096; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid #e2e8f0; }
    th { background: #f7fafc; font-weight: 600; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
    .badge-blue { background: #ebf8ff; color: #2b6cb0; }
    .badge-green { background: #f0fff4; color: #276749; }
    .badge-red { background: #fff5f5; color: #c53030; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #718096; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Roof HR - Candidate Report</h1>
    <p class="meta">Generated: ${now.toLocaleDateString('en-US', { timeZone: 'America/New_York' })} at ${now.toLocaleTimeString('en-US', { timeZone: 'America/New_York' })}</p>
    <p class="meta">Report Type: <strong>${typeLabel} Candidates</strong></p>
  </div>

  <h2>Summary</h2>
  <div class="summary-grid">
    <div class="stat-box">
      <div class="stat-value">${candidates.length}</div>
      <div class="stat-label">Total Candidates</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${avgMatchScore}%</div>
      <div class="stat-label">Average Match Score</div>
    </div>
  </div>

  <h2>By Status</h2>
  <table>
    <tr><th>Status</th><th>Count</th><th>Percentage</th></tr>
    ${Object.entries(statusCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([status, count]) => `
        <tr>
          <td>${status.replace(/_/g, ' ')}</td>
          <td>${count}</td>
          <td>${Math.round((count / candidates.length) * 100)}%</td>
        </tr>
      `).join('')}
  </table>

  <h2>By Position</h2>
  <table>
    <tr><th>Position</th><th>Count</th><th>Percentage</th></tr>
    ${Object.entries(positionCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([position, count]) => `
        <tr>
          <td>${position}</td>
          <td>${count}</td>
          <td>${Math.round((count / candidates.length) * 100)}%</td>
        </tr>
      `).join('')}
  </table>

  ${topCandidates.length > 0 ? `
  <h2>Top Candidates by Match Score</h2>
  <table>
    <tr><th>#</th><th>Name</th><th>Position</th><th>Status</th><th>Match Score</th></tr>
    ${topCandidates.map((c, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${c.firstName} ${c.lastName}</td>
        <td>${c.position}</td>
        <td>${c.status}</td>
        <td><strong>${c.matchScore}%</strong></td>
      </tr>
    `).join('')}
  </table>
  ` : ''}

  <div class="footer">
    <p>This report was generated by Roof HR. For questions, contact your HR administrator.</p>
  </div>
</body>
</html>`;

  return html;
}

// GET /api/recruiting-analytics/export/csv
// Export candidates as CSV file
router.get('/export/csv', requireAuthOrAssignments(), async (req: any, res: any) => {
  try {
    const type = (req.query.type as string) || 'all'; // 'archived' | 'current' | 'all'

    const allCandidates = await storage.getAllCandidates();
    const candidates = filterCandidatesForUser(allCandidates, req.user, req.isManager);

    let filtered = candidates;
    if (type === 'archived') {
      filtered = candidates.filter((c: any) => c.isArchived);
    } else if (type === 'current') {
      filtered = candidates.filter((c: any) => !c.isArchived);
    }

    const csv = generateCandidateCSV(filtered);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=candidates-${type}-${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({
      error: 'Failed to export CSV',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/recruiting-analytics/export/pdf
// Export candidates as PDF report (returns HTML that can be printed to PDF)
router.get('/export/pdf', requireAuthOrAssignments(), async (req: any, res: any) => {
  try {
    const type = (req.query.type as string) || 'all'; // 'archived' | 'current' | 'all'

    const allCandidates = await storage.getAllCandidates();
    const candidates = filterCandidatesForUser(allCandidates, req.user, req.isManager);

    let filtered = candidates;
    if (type === 'archived') {
      filtered = candidates.filter((c: any) => c.isArchived);
    } else if (type === 'current') {
      filtered = candidates.filter((c: any) => !c.isArchived);
    }

    const html = generatePDFReport(filtered, type);

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Error exporting PDF:', error);
    res.status(500).json({
      error: 'Failed to export PDF',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/recruiting-analytics/export/analytics-report
// Full analytics report with all metrics (printable HTML)
// Supports token via query param for window.open() calls
router.get('/export/analytics-report', async (req: any, res: any, next: any) => {
  // Check for token in query param (for window.open calls)
  if (!req.user && req.query.token) {
    try {
      const session = await storage.getSessionByToken(req.query.token);
      if (session && new Date(session.expiresAt) > new Date()) {
        const user = await storage.getUserById(session.userId);
        if (user) {
          req.user = user;
          req.isManager = MANAGER_ROLES.includes(user.role) || user.email === 'ahmed.mahmoud@theroofdocs.com';
        }
      }
    } catch (e) {
      console.error('Token auth error:', e);
    }
  }
  next();
}, requireAuthOrAssignments(), async (req: any, res: any) => {
  try {
    const { period, assigneeId } = dateRangeSchema.parse(req.query);
    const { start, end } = getDateRange(period || '30d');
    const now = new Date();

    // Get all data
    const allCandidates = await storage.getAllCandidates();
    let candidates = filterCandidatesForUser(allCandidates, req.user, req.isManager);
    const users = await storage.getAllUsers();
    const allInterviews = await storage.getAllInterviews();

    // Filter by assignee if specified
    if (assigneeId && assigneeId !== 'all') {
      if (assigneeId === 'unassigned') {
        candidates = candidates.filter((c: any) => !c.assignedTo);
      } else {
        candidates = candidates.filter((c: any) => c.assignedTo?.toString() === assigneeId);
      }
    }

    // Get employee name for header
    let employeeName = 'All Employees';
    if (assigneeId && assigneeId !== 'all' && assigneeId !== 'unassigned') {
      const user = users.find((u: any) => u.id.toString() === assigneeId);
      employeeName = user ? `${user.firstName} ${user.lastName}` : 'Unknown Employee';
    } else if (assigneeId === 'unassigned') {
      employeeName = 'Unassigned Candidates';
    }

    // Filter by date range
    const filteredCandidates = candidates.filter((c: any) => {
      const appliedDate = new Date(c.appliedDate || c.createdAt);
      return appliedDate >= start && appliedDate <= end;
    });

    // Calculate OVERVIEW metrics
    const totalCandidates = filteredCandidates.length;
    // Active pipeline excludes all terminal statuses
    const activePipeline = filteredCandidates.filter((c: any) =>
      !['HIRED', 'DEAD_BY_US', 'DEAD_BY_CANDIDATE', 'REJECTED', 'NO_SHOW'].includes(c.status)
    ).length;

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const hiredThisMonth = filteredCandidates.filter((c: any) =>
      c.status === 'HIRED' && new Date(c.updatedAt || c.createdAt) >= monthStart
    ).length;
    const hiredLastMonth = filteredCandidates.filter((c: any) =>
      c.status === 'HIRED' &&
      new Date(c.updatedAt || c.createdAt) >= lastMonthStart &&
      new Date(c.updatedAt || c.createdAt) < monthStart
    ).length;

    // Calculate avg days to hire
    const hiredCandidates = filteredCandidates.filter((c: any) => c.status === 'HIRED');
    let avgDaysToHire = 0;
    if (hiredCandidates.length > 0) {
      const totalDays = hiredCandidates.reduce((sum: number, c: any) => {
        const applied = new Date(c.appliedDate || c.createdAt);
        const hired = new Date(c.updatedAt || c.createdAt);
        return sum + Math.max(1, Math.ceil((hired.getTime() - applied.getTime()) / (1000 * 60 * 60 * 24)));
      }, 0);
      avgDaysToHire = Math.round(totalDays / hiredCandidates.length);
    }

    // Calculate PIPELINE data
    // Note: Only using statuses that exist in the database schema:
    // 'APPLIED' | 'SCREENING' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED' | 'DEAD_BY_US' | 'DEAD_BY_CANDIDATE' | 'NO_SHOW'
    const stages = {
      applied: filteredCandidates.filter((c: any) => c.status === 'APPLIED').length,
      screening: filteredCandidates.filter((c: any) => c.status === 'SCREENING').length,
      interview: filteredCandidates.filter((c: any) => c.status === 'INTERVIEW').length,
      offer: filteredCandidates.filter((c: any) => c.status === 'OFFER').length,
      hired: filteredCandidates.filter((c: any) => c.status === 'HIRED').length,
    };
    const conversionRate = totalCandidates > 0 ? Math.round((stages.hired / totalCandidates) * 100) : 0;

    // Calculate INTERVIEW metrics
    let interviews = allInterviews;
    if (assigneeId && assigneeId !== 'all') {
      const candidateIds = candidates.map((c: any) => c.id);
      interviews = allInterviews.filter((i: any) => candidateIds.includes(i.candidateId));
    }
    const filteredInterviews = interviews.filter((i: any) => {
      const scheduledDate = new Date(i.scheduledDate || i.createdAt);
      return scheduledDate >= start && scheduledDate <= end;
    });
    const interviewStats = {
      total: filteredInterviews.length,
      completed: filteredInterviews.filter((i: any) => i.status === 'COMPLETED').length,
      scheduled: filteredInterviews.filter((i: any) => i.status === 'SCHEDULED').length,
      cancelled: filteredInterviews.filter((i: any) => i.status === 'CANCELLED').length,
      noShow: filteredInterviews.filter((i: any) => i.status === 'NO_SHOW').length,
    };

    // Calculate TEAM PERFORMANCE (assignee breakdown)
    const assigneeMap = new Map<string | null, { assigned: number; hired: number }>();
    filteredCandidates.forEach((c: any) => {
      const aid = c.assignedTo?.toString() || null;
      if (!assigneeMap.has(aid)) {
        assigneeMap.set(aid, { assigned: 0, hired: 0 });
      }
      const data = assigneeMap.get(aid)!;
      data.assigned++;
      if (c.status === 'HIRED') data.hired++;
    });

    const teamPerformance: any[] = [];
    for (const [aid, data] of assigneeMap.entries()) {
      if (aid === null) {
        teamPerformance.push({
          name: 'Unassigned',
          email: '',
          candidatesAssigned: data.assigned,
          hiredCount: data.hired,
          hireRate: data.assigned > 0 ? Math.round((data.hired / data.assigned) * 100) : 0,
        });
      } else {
        const user = users.find((u: any) => u.id.toString() === aid);
        teamPerformance.push({
          name: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
          email: user?.email || '',
          candidatesAssigned: data.assigned,
          hiredCount: data.hired,
          hireRate: data.assigned > 0 ? Math.round((data.hired / data.assigned) * 100) : 0,
        });
      }
    }
    teamPerformance.sort((a, b) => b.candidatesAssigned - a.candidatesAssigned);

    // Format period label
    const periodLabels: Record<string, string> = {
      '7d': 'Last 7 Days',
      '30d': 'Last 30 Days',
      '90d': 'Last 90 Days',
      'year': 'Last Year',
      'all': 'All Time',
    };
    const periodLabel = periodLabels[period || '30d'] || 'Last 30 Days';

    // Generate HTML report
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Recruiting Analytics Report - ${employeeName}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; color: #1a202c; background: #fff; }
    @media print {
      body { padding: 20px; }
      .no-break { page-break-inside: avoid; }
      .page-break { page-break-before: always; }
    }
    .header { background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: white; padding: 30px; margin: -40px -40px 30px -40px; }
    @media print { .header { margin: -20px -20px 20px -20px; } }
    .header h1 { margin: 0 0 8px 0; font-size: 28px; font-weight: 700; }
    .header .subtitle { opacity: 0.9; font-size: 16px; }
    .header .meta { margin-top: 15px; font-size: 13px; opacity: 0.8; }

    .section { margin-bottom: 30px; }
    .section-title { font-size: 18px; font-weight: 600; color: #2d3748; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }

    .metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    @media print { .metrics-grid { grid-template-columns: repeat(4, 1fr); } }
    .metric-card { background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; text-align: center; }
    .metric-value { font-size: 32px; font-weight: 700; color: #2d3748; }
    .metric-label { font-size: 13px; color: #718096; margin-top: 4px; }
    .metric-change { font-size: 12px; margin-top: 6px; }
    .metric-change.positive { color: #38a169; }
    .metric-change.negative { color: #e53e3e; }

    .pipeline-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
    .pipeline-stage { background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center; }
    .pipeline-stage .count { font-size: 28px; font-weight: 700; color: #2d3748; }
    .pipeline-stage .label { font-size: 12px; color: #718096; margin-top: 4px; }
    .pipeline-stage.applied { border-top: 4px solid #3b82f6; }
    .pipeline-stage.screening { border-top: 4px solid #10b981; }
    .pipeline-stage.interview { border-top: 4px solid #f59e0b; }
    .pipeline-stage.offer { border-top: 4px solid #8b5cf6; }
    .pipeline-stage.hired { border-top: 4px solid #22c55e; }

    .interview-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .interview-stat { background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center; }
    .interview-stat .count { font-size: 24px; font-weight: 700; }
    .interview-stat .label { font-size: 12px; color: #718096; margin-top: 4px; }
    .interview-stat.completed .count { color: #22c55e; }
    .interview-stat.scheduled .count { color: #3b82f6; }
    .interview-stat.cancelled .count { color: #f59e0b; }
    .interview-stat.noshow .count { color: #ef4444; }

    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid #e2e8f0; }
    th { background: #f7fafc; font-weight: 600; font-size: 13px; color: #4a5568; }
    td { font-size: 14px; }
    tr:hover { background: #f7fafc; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; }
    .badge-green { background: #d1fae5; color: #065f46; }
    .badge-blue { background: #dbeafe; color: #1e40af; }

    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #718096; font-size: 12px; text-align: center; }

    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
    @media print { .two-col { grid-template-columns: 1fr 1fr; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Recruiting Analytics Report</h1>
    <div class="subtitle">${employeeName} • ${periodLabel}</div>
    <div class="meta">Generated on ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' })} at ${now.toLocaleTimeString('en-US', { timeZone: 'America/New_York' })}</div>
  </div>

  <div class="section no-break">
    <div class="section-title">Summary Metrics</div>
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-value">${totalCandidates}</div>
        <div class="metric-label">Total Candidates</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${activePipeline}</div>
        <div class="metric-label">Active Pipeline</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${hiredThisMonth}</div>
        <div class="metric-label">Hired This Month</div>
        ${hiredLastMonth > 0 ? `<div class="metric-change ${hiredThisMonth >= hiredLastMonth ? 'positive' : 'negative'}">vs ${hiredLastMonth} last month</div>` : ''}
      </div>
      <div class="metric-card">
        <div class="metric-value">${avgDaysToHire}</div>
        <div class="metric-label">Avg Days to Hire</div>
      </div>
    </div>
  </div>

  <div class="section no-break">
    <div class="section-title">Pipeline Funnel</div>
    <div class="pipeline-grid">
      <div class="pipeline-stage applied">
        <div class="count">${stages.applied}</div>
        <div class="label">Applied</div>
      </div>
      <div class="pipeline-stage screening">
        <div class="count">${stages.screening}</div>
        <div class="label">Screening</div>
      </div>
      <div class="pipeline-stage interview">
        <div class="count">${stages.interview}</div>
        <div class="label">Interview</div>
      </div>
      <div class="pipeline-stage offer">
        <div class="count">${stages.offer}</div>
        <div class="label">Offer</div>
      </div>
      <div class="pipeline-stage hired">
        <div class="count">${stages.hired}</div>
        <div class="label">Hired</div>
      </div>
    </div>
    <div style="text-align: center; margin-top: 12px; color: #718096; font-size: 14px;">
      Overall Conversion Rate: <strong style="color: #2d3748;">${conversionRate}%</strong>
    </div>
  </div>

  <div class="section no-break">
    <div class="section-title">Interview Metrics</div>
    <div class="interview-grid">
      <div class="interview-stat completed">
        <div class="count">${interviewStats.completed}</div>
        <div class="label">Completed</div>
      </div>
      <div class="interview-stat scheduled">
        <div class="count">${interviewStats.scheduled}</div>
        <div class="label">Scheduled</div>
      </div>
      <div class="interview-stat cancelled">
        <div class="count">${interviewStats.cancelled}</div>
        <div class="label">Cancelled</div>
      </div>
      <div class="interview-stat noshow">
        <div class="count">${interviewStats.noShow}</div>
        <div class="label">No Show</div>
      </div>
    </div>
    <div style="text-align: center; margin-top: 12px; color: #718096; font-size: 14px;">
      Total Interviews: <strong style="color: #2d3748;">${interviewStats.total}</strong>
    </div>
  </div>

  <div class="section no-break">
    <div class="section-title">Team Performance</div>
    <table>
      <thead>
        <tr>
          <th>Team Member</th>
          <th class="text-center">Candidates</th>
          <th class="text-center">Hired</th>
          <th class="text-center">Hire Rate</th>
        </tr>
      </thead>
      <tbody>
        ${teamPerformance.map(member => `
          <tr>
            <td>
              <div style="font-weight: 500;">${member.name}</div>
              ${member.email ? `<div style="font-size: 12px; color: #718096;">${member.email}</div>` : ''}
            </td>
            <td class="text-center">${member.candidatesAssigned}</td>
            <td class="text-center"><span class="badge badge-green">${member.hiredCount}</span></td>
            <td class="text-center"><span class="badge badge-blue">${member.hireRate}%</span></td>
          </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr style="font-weight: 600; background: #f7fafc;">
          <td>Total</td>
          <td class="text-center">${totalCandidates}</td>
          <td class="text-center">${stages.hired}</td>
          <td class="text-center">${conversionRate}%</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <div class="footer">
    <p>This report was generated by Roof HR. For questions, contact your HR administrator.</p>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Error exporting analytics report:', error);
    res.status(500).json({
      error: 'Failed to export analytics report',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
