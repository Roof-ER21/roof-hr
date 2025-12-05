import { z } from 'zod';

// Bot notification types
export const BotNotificationType = z.enum([
  'IDLE_CANDIDATE',
  'CRITERIA_NOT_MET',
  'INCONSISTENCY_DETECTED',
  'NEXT_STEP_REMINDER',
  'STAGE_TRANSITION_WARNING',
  'LICENSE_MISMATCH',
  'EXPERIENCE_MISMATCH',
  'QUALIFICATION_ISSUE'
]);

// Bot action types
export const BotActionType = z.enum([
  'FLAG_CANDIDATE',
  'SEND_NOTIFICATION',
  'SUGGEST_NEXT_STEP',
  'REQUEST_REVIEW',
  'AUTO_ARCHIVE',
  'ESCALATE_TO_MANAGER'
]);

// Stage transition criteria
export const StageTransitionCriteria = z.object({
  stage: z.string(),
  requiredFields: z.array(z.string()),
  requiredDocuments: z.array(z.string()),
  minimumScore: z.number().optional(),
  customCriteria: z.array(z.object({
    field: z.string(),
    condition: z.enum(['equals', 'contains', 'greaterThan', 'lessThan', 'exists']),
    value: z.any()
  })).optional()
});

// Bot configuration
export const BotConfiguration = z.object({
  idleThresholdDays: z.number().default(7),
  autoArchiveAfterDays: z.number().default(30),
  enableAutoNotifications: z.boolean().default(true),
  enableInconsistencyChecks: z.boolean().default(true),
  notificationRecipients: z.array(z.enum(['ADMIN', 'MANAGER', 'RECRUITER'])).default(['ADMIN', 'MANAGER']),
  stageTransitionCriteria: z.array(StageTransitionCriteria).optional()
});

// Bot notification schema
export const BotNotification = z.object({
  id: z.string(),
  type: BotNotificationType,
  candidateId: z.string(),
  candidateName: z.string(),
  message: z.string(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  details: z.record(z.any()).optional(),
  suggestedActions: z.array(z.string()).optional(),
  createdAt: z.date(),
  acknowledgedAt: z.date().optional(),
  acknowledgedBy: z.string().optional(),
  resolved: z.boolean().default(false)
});

// Candidate validation result
export const CandidateValidation = z.object({
  candidateId: z.string(),
  isValid: z.boolean(),
  issues: z.array(z.object({
    field: z.string(),
    issue: z.string(),
    severity: z.enum(['WARNING', 'ERROR']),
    suggestion: z.string().optional()
  })),
  readyForNextStage: z.boolean(),
  missingRequirements: z.array(z.string()).optional()
});

export type BotNotificationType = z.infer<typeof BotNotificationType>;
export type BotActionType = z.infer<typeof BotActionType>;
export type StageTransitionCriteria = z.infer<typeof StageTransitionCriteria>;
export type BotConfiguration = z.infer<typeof BotConfiguration>;
export type BotNotification = z.infer<typeof BotNotification>;
export type CandidateValidation = z.infer<typeof CandidateValidation>;