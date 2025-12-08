// Centralized recruiting constants for Roof HR
// Use these throughout the app for consistent candidate filtering

// Active candidate statuses (still in the pipeline)
export const ACTIVE_CANDIDATE_STATUSES = [
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
] as const;

// Inactive/terminal candidate statuses
export const INACTIVE_CANDIDATE_STATUSES = [
  'REJECTED',
  'HIRED',
  'DEAD_BY_US',
  'DEAD_BY_CANDIDATE',
  'WITHDRAWN',
  'OFFER_DECLINED'
] as const;

// All candidate statuses
export const ALL_CANDIDATE_STATUSES = [
  ...ACTIVE_CANDIDATE_STATUSES,
  ...INACTIVE_CANDIDATE_STATUSES
] as const;

export type CandidateStatus = typeof ALL_CANDIDATE_STATUSES[number];
export type ActiveCandidateStatus = typeof ACTIVE_CANDIDATE_STATUSES[number];
export type InactiveCandidateStatus = typeof INACTIVE_CANDIDATE_STATUSES[number];

// Pipeline stages (display order)
export const CANDIDATE_PIPELINE_STAGES = [
  'Applied',
  'Screening',
  'Phone Screen',
  'Interview',
  'Second Interview',
  'Offer',
  'Hired'
] as const;

export type CandidatePipelineStage = typeof CANDIDATE_PIPELINE_STAGES[number];

// Status to stage mapping
export const STATUS_TO_STAGE: Record<string, CandidatePipelineStage> = {
  'NEW': 'Applied',
  'SCREENING': 'Screening',
  'PHONE_SCREEN': 'Phone Screen',
  'INTERVIEW': 'Interview',
  'INTERVIEW_SCHEDULED': 'Interview',
  'SECOND_INTERVIEW': 'Second Interview',
  'REFERENCE_CHECK': 'Second Interview',
  'BACKGROUND_CHECK': 'Second Interview',
  'OFFER_PENDING': 'Offer',
  'OFFER_SENT': 'Offer',
  'HIRED': 'Hired',
  'REJECTED': 'Screening',
  'DEAD_BY_US': 'Screening',
  'DEAD_BY_CANDIDATE': 'Screening',
  'WITHDRAWN': 'Screening',
  'OFFER_DECLINED': 'Offer'
};

// Helper functions
export function isActiveCandidate(status: string | undefined | null): boolean {
  if (!status) return true; // Default to active if no status
  return ACTIVE_CANDIDATE_STATUSES.includes(status as ActiveCandidateStatus);
}

export function isInactiveCandidate(status: string | undefined | null): boolean {
  if (!status) return false;
  return INACTIVE_CANDIDATE_STATUSES.includes(status as InactiveCandidateStatus);
}

export function getCandidateStage(status: string | undefined | null): CandidatePipelineStage {
  if (!status) return 'Applied';
  return STATUS_TO_STAGE[status] || 'Applied';
}

// Screening criteria for auto-screening
export interface ScreeningCriteria {
  minimumExperience?: number;
  requiredSkills?: string[];
  maxSalaryExpectation?: number;
  requiredEducation?: string[];
  preferredLocation?: string[];
}

// Default screening weights
export const DEFAULT_SCREENING_WEIGHTS = {
  experience: 0.3,
  skills: 0.3,
  salary: 0.2,
  education: 0.1,
  location: 0.1
};
