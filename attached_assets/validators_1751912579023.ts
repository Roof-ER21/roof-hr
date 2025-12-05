import { z } from 'zod';
import { UserRole, EmploymentType, PTOStatus, DocumentType, CandidateStage } from '@prisma/client';

// Authentication schemas
export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  firstName: z.string().min(2, 'First name must be at least 2 characters').max(50, 'First name too long'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters').max(50, 'Last name too long'),
  role: z.nativeEnum(UserRole),
  employmentType: z.nativeEnum(EmploymentType),
});

export const signinSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// User profile schemas
export const updateProfileSchema = z.object({
  firstName: z.string().min(2).max(50).optional(),
  lastName: z.string().min(2).max(50).optional(),
  phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone number').optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(50).optional(),
  state: z.string().max(2).optional(),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code').optional(),
  emergencyContactName: z.string().max(100).optional(),
  emergencyContactPhone: z.string().regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone number').optional(),
  emergencyContactRelation: z.string().max(50).optional(),
});

// PTO request schemas
export const ptoRequestSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  reason: z.string().max(500).optional(),
}).refine(data => new Date(data.endDate) >= new Date(data.startDate), {
  message: 'End date must be after start date',
  path: ['endDate'],
});

export const updatePTOStatusSchema = z.object({
  status: z.nativeEnum(PTOStatus),
  deniedReason: z.string().max(500).optional(),
});

// Meeting schemas
export const createMeetingSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  location: z.string().max(200).optional(),
  isVirtual: z.boolean().optional(),
  meetingLink: z.string().url().optional(),
  attendeeId: z.string().cuid(),
}).refine(data => new Date(data.endTime) > new Date(data.startTime), {
  message: 'End time must be after start time',
  path: ['endTime'],
});

// Document schemas
export const uploadDocumentSchema = z.object({
  type: z.nativeEnum(DocumentType),
  customType: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  isRequired: z.boolean().optional(),
});

// Safety incident schemas
export const safetyIncidentSchema = z.object({
  incidentDate: z.string().datetime(),
  location: z.string().min(1, 'Location is required').max(200),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  injuryType: z.string().max(100).optional(),
  bodyPart: z.string().max(100).optional(),
  treatmentRequired: z.boolean().optional(),
  workersCompClaim: z.boolean().optional(),
});

// Recruiting schemas
export const createJobPositionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  department: z.string().min(1, 'Department is required').max(100),
  description: z.string().max(5000).optional(),
  requirements: z.string().max(5000).optional(),
  salaryMin: z.number().positive().optional(),
  salaryMax: z.number().positive().optional(),
  employmentType: z.nativeEnum(EmploymentType),
  location: z.string().max(200).optional(),
  closingDate: z.string().datetime().optional(),
}).refine(data => !data.salaryMax || !data.salaryMin || data.salaryMax >= data.salaryMin, {
  message: 'Maximum salary must be greater than or equal to minimum salary',
  path: ['salaryMax'],
});

export const createCandidateSchema = z.object({
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  email: z.string().email(),
  phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone number').optional(),
  positionId: z.string().cuid(),
  source: z.string().max(100).optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(50).optional(),
  state: z.string().max(2).optional(),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code').optional(),
  desiredSalary: z.number().positive().optional(),
  availableStartDate: z.string().datetime().optional(),
});

export const updateCandidateStageSchema = z.object({
  stage: z.nativeEnum(CandidateStage),
  rejectionReason: z.string().max(500).optional(),
});

// GPS check-in schemas
export const gpsCheckInSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  location: z.string().max(200).optional(),
  jobSite: z.string().max(200).optional(),
});

export const gpsCheckOutSchema = z.object({
  checkInId: z.string().cuid(),
});

// Admin schemas
export const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  role: z.nativeEnum(UserRole),
  employmentType: z.nativeEnum(EmploymentType),
  department: z.string().max(100).optional(),
  position: z.string().max(100).optional(),
  hourlyRate: z.number().positive().optional(),
  hireDate: z.string().datetime().optional(),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(2).max(50).optional(),
  lastName: z.string().min(2).max(50).optional(),
  email: z.string().email().optional(),
  role: z.nativeEnum(UserRole).optional(),
  employmentType: z.nativeEnum(EmploymentType).optional(),
  isActive: z.boolean().optional(),
  department: z.string().max(100).optional(),
  position: z.string().max(100).optional(),
  hourlyRate: z.number().positive().optional(),
  ptoBalance: z.number().min(0).optional(),
});

// Generic ID validation
export const idSchema = z.string().cuid('Invalid ID format');

// Pagination schema
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// Date range schema
export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
}).refine(data => !data.startDate || !data.endDate || new Date(data.endDate) >= new Date(data.startDate), {
  message: 'End date must be after start date',
  path: ['endDate'],
});

// Helper function to validate request body
export function validateRequestBody<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(result.error.errors.map(e => e.message).join(', '));
  }
  return result.data;
}

// Helper function to validate query parameters
export function validateQueryParams<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid query parameters: ${result.error.errors.map(e => e.message).join(', ')}`);
  }
  return result.data;
}