import { storage } from '../storage';

// Centralized stats service - Single source of truth for all dashboard metrics
// Used by: /api/dashboard/metrics, Susan AI, and all pages needing consistent stats

export interface DashboardStats {
  employees: {
    total: number;
    active: number;
    inactive: number;
    byDepartment: Record<string, number>;
  };
  pto: {
    pending: number;
    approved: number;
    denied: number;
  };
  candidates: {
    total: number;
    active: number;
    byStatus: Record<string, number>;
    byStage: Record<string, number>;
  };
  documents: {
    total: number;
    pending: number;
    approved: number;
  };
  reviews: {
    pending: number;
    completed: number;
    overdue: number;
  };
  contracts: {
    total: number;
    active: number;
    pending: number;
  };
  tools: {
    total: number;
    assigned: number;
    available: number;
  };
}

// Active candidate statuses (not rejected, hired, or dead)
const ACTIVE_CANDIDATE_STATUSES = [
  'NEW',
  'SCREENING',
  'PHONE_SCREEN',
  'INTERVIEW',
  'INTERVIEW_SCHEDULED',
  'SECOND_INTERVIEW',
  'OFFER_PENDING',
  'OFFER_SENT',
  'REFERENCE_CHECK',
  'BACKGROUND_CHECK'
];

// Inactive/terminal candidate statuses
const INACTIVE_CANDIDATE_STATUSES = [
  'REJECTED',
  'HIRED',
  'DEAD_BY_US',
  'DEAD_BY_CANDIDATE',
  'WITHDRAWN',
  'OFFER_DECLINED'
];

export async function getDashboardStats(): Promise<DashboardStats> {
  // Fetch all data in parallel for efficiency
  const [
    users,
    ptoRequests,
    candidates,
    documents,
    reviews,
    contracts,
    tools
  ] = await Promise.all([
    storage.getAllUsers(),
    storage.getAllPtoRequests(),
    storage.getAllCandidates(),
    storage.getAllDocuments(),
    storage.getAllEmployeeReviews(),
    storage.getAllEmployeeContracts(),
    storage.getAllTools()
  ]);

  // Employee stats
  const activeEmployees = users.filter(u => u.isActive !== false);
  const inactiveEmployees = users.filter(u => u.isActive === false);
  const employeesByDept: Record<string, number> = {};
  activeEmployees.forEach(u => {
    const dept = u.department || 'Unassigned';
    employeesByDept[dept] = (employeesByDept[dept] || 0) + 1;
  });

  // PTO stats - current year only
  const currentYear = new Date().getFullYear();
  const yearStartDate = new Date(`${currentYear}-01-01`);
  const yearEndDate = new Date(`${currentYear}-12-31`);

  const currentYearPto = ptoRequests.filter(r =>
    r.createdAt && new Date(r.createdAt) >= yearStartDate && new Date(r.createdAt) <= yearEndDate
  );

  const pendingPto = currentYearPto.filter(r => r.status === 'PENDING');
  const approvedPto = currentYearPto.filter(r => r.status === 'APPROVED');
  const deniedPto = currentYearPto.filter(r => r.status === 'DENIED');

  // Candidate stats - use consistent status filter
  const activeCandidates = candidates.filter(c =>
    ACTIVE_CANDIDATE_STATUSES.includes(c.status || 'NEW')
  );

  const candidatesByStatus: Record<string, number> = {};
  const candidatesByStage: Record<string, number> = {};

  candidates.forEach(c => {
    const status = c.status || 'NEW';
    candidatesByStatus[status] = (candidatesByStatus[status] || 0) + 1;

    const stage = c.stage || 'Applied';
    candidatesByStage[stage] = (candidatesByStage[stage] || 0) + 1;
  });

  // Document stats (REVIEW = pending review, APPROVED = approved)
  const pendingDocs = documents.filter(d => d.status === 'REVIEW');
  const approvedDocs = documents.filter(d => d.status === 'APPROVED');

  // Review stats (ACKNOWLEDGED = completed, DRAFT/IN_PROGRESS/SUBMITTED = pending)
  const today = new Date();
  const pendingReviews = reviews.filter(r => r.status !== 'ACKNOWLEDGED');
  const completedReviews = reviews.filter(r => r.status === 'ACKNOWLEDGED');
  const overdueReviews = reviews.filter(r =>
    r.status !== 'ACKNOWLEDGED' &&
    r.dueDate &&
    new Date(r.dueDate) < today
  );

  // Contract stats (SIGNED = active, SENT/VIEWED = pending)
  const activeContracts = contracts.filter(c => c.status === 'SIGNED');
  const pendingContracts = contracts.filter(c =>
    c.status === 'SENT' || c.status === 'VIEWED'
  );

  // Tools stats (quantity-based: assigned = total - available)
  const assignedTools = tools.filter(t => t.availableQuantity < t.quantity);
  const availableTools = tools.filter(t => t.availableQuantity > 0 && t.isActive);

  return {
    employees: {
      total: users.length,
      active: activeEmployees.length,
      inactive: inactiveEmployees.length,
      byDepartment: employeesByDept
    },
    pto: {
      pending: pendingPto.length,
      approved: approvedPto.length,
      denied: deniedPto.length
    },
    candidates: {
      total: candidates.length,
      active: activeCandidates.length,
      byStatus: candidatesByStatus,
      byStage: candidatesByStage
    },
    documents: {
      total: documents.length,
      pending: pendingDocs.length,
      approved: approvedDocs.length
    },
    reviews: {
      pending: pendingReviews.length,
      completed: completedReviews.length,
      overdue: overdueReviews.length
    },
    contracts: {
      total: contracts.length,
      active: activeContracts.length,
      pending: pendingContracts.length
    },
    tools: {
      total: tools.length,
      assigned: assignedTools.length,
      available: availableTools.length
    }
  };
}

// Get specific stats for a particular area
export async function getEmployeeStats() {
  const stats = await getDashboardStats();
  return stats.employees;
}

export async function getPtoStats() {
  const stats = await getDashboardStats();
  return stats.pto;
}

export async function getCandidateStats() {
  const stats = await getDashboardStats();
  return stats.candidates;
}

export async function getDocumentStats() {
  const stats = await getDashboardStats();
  return stats.documents;
}

// Export constants for consistent filtering across the app
export const CANDIDATE_STATUS = {
  ACTIVE: ACTIVE_CANDIDATE_STATUSES,
  INACTIVE: INACTIVE_CANDIDATE_STATUSES
};
