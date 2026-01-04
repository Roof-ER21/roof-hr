import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const router = Router();

// Manager roles that can see all candidates
const MANAGER_ROLES = ['SYSTEM_ADMIN', 'HR_ADMIN', 'GENERAL_MANAGER', 'TERRITORY_MANAGER', 'MANAGER', 'TRUE_ADMIN', 'ADMIN'];

// Validation schema for date range query parameters
const dateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  period: z.enum(['7d', '30d', '90d', 'year', 'all']).optional(),
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
    const { period, startDate, endDate } = dateRangeSchema.parse(req.query);
    const { start, end } = getDateRange(period, startDate, endDate);

    const allCandidates = await storage.getAllCandidates();
    const candidates = filterCandidatesForUser(allCandidates, req.user, req.isManager);

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
router.get('/pipeline', requireAuthOrAssignments(), async (req: any, res: any) => {
  try {
    const { period, startDate, endDate } = dateRangeSchema.parse(req.query);
    const { start, end } = getDateRange(period, startDate, endDate);

    const allCandidates = await storage.getAllCandidates();
    const candidates = filterCandidatesForUser(allCandidates, req.user, req.isManager);

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
router.get('/sources', requireAuthOrAssignments(), async (req: any, res: any) => {
  try {
    const { period, startDate, endDate } = dateRangeSchema.parse(req.query);
    const { start, end } = getDateRange(period, startDate, endDate);

    const allCandidates = await storage.getAllCandidates();
    const candidates = filterCandidatesForUser(allCandidates, req.user, req.isManager);

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
router.get('/time-to-hire', requireAuthOrAssignments(), async (req: any, res: any) => {
  try {
    const { period, startDate, endDate } = dateRangeSchema.parse(req.query);
    const { start, end } = getDateRange(period, startDate, endDate);

    const allCandidates = await storage.getAllCandidates();
    const candidates = filterCandidatesForUser(allCandidates, req.user, req.isManager);

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
router.get('/interviews', requireAuthOrAssignments(), async (req: any, res: any) => {
  try {
    const { period, startDate, endDate } = dateRangeSchema.parse(req.query);
    const { start, end } = getDateRange(period, startDate, endDate);

    // Get interviews and filter by assigned candidates for non-managers
    const allInterviews = await storage.getAllInterviews();
    let interviews = allInterviews;

    if (!req.isManager) {
      // Get IDs of assigned candidates
      const allCandidates = await storage.getAllCandidates();
      const assignedCandidateIds = allCandidates
        .filter((c: any) => c.assignedTo === req.user.id)
        .map((c: any) => c.id);
      // Filter interviews to only those for assigned candidates
      interviews = allInterviews.filter((i: any) => assignedCandidateIds.includes(i.candidateId));
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
// Recruiter performance: candidates per recruiter, hire rate, avg time to hire
router.get('/recruiters', requireAuthOrAssignments(), async (req: any, res: any) => {
  try {
    const { period, startDate, endDate } = dateRangeSchema.parse(req.query);
    const { start, end } = getDateRange(period, startDate, endDate);

    const allCandidates = await storage.getAllCandidates();
    const candidates = filterCandidatesForUser(allCandidates, req.user, req.isManager);
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

export default router;
