import { z } from 'zod';
import { pgTable, text, boolean, integer, timestamp, real, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';

// User and Authentication
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  role: text('role').$type<'SYSTEM_ADMIN' | 'HR_ADMIN' | 'GENERAL_MANAGER' | 'TERRITORY_MANAGER' | 'MANAGER' | 'TEAM_LEAD' | 'EMPLOYEE' | 'FIELD_TECH' | 'SALES_REP' | 'CONTRACTOR' | 'TRUE_ADMIN' | 'ADMIN' | 'TERRITORY_SALES_MANAGER' | 'SOURCER'>().notNull(),
  employmentType: text('employment_type').$type<'W2' | '1099' | 'CONTRACTOR' | 'SUB_CONTRACTOR'>().notNull(),
  department: text('department').notNull(),
  position: text('position').notNull(),
  hireDate: text('hire_date').notNull(),
  terminationDate: text('termination_date'), // New field for tracking terminations
  territoryId: text('territory_id'), // New field for territory assignment
  primaryManagerId: text('primary_manager_id'), // New field for primary assignment
  isActive: boolean('is_active').notNull().default(true),
  phone: text('phone'),
  address: text('address'),
  emergencyContact: text('emergency_contact'),
  emergencyPhone: text('emergency_phone'),
  shirtSize: text('shirt_size').$type<'S' | 'M' | 'L' | 'XL' | 'XXL' | '3X'>(), // New field for shirt size
  timezone: text('timezone').notNull().default('America/New_York'), // User's timezone for interviews and calendar events
  passwordHash: text('password_hash').notNull(),
  mustChangePassword: boolean('must_change_password').notNull().default(true),
  lastPasswordChange: timestamp('last_password_change'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const userSchema = createInsertSchema(users);
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

export const sessionSchema = createInsertSchema(sessions);
export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
});

// Territory Management - NEW
export const territories = pgTable('territories', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  region: text('region').notNull(),
  salesManagerId: text('sales_manager_id'), // Territory Sales Manager
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const territorySchema = createInsertSchema(territories);
export const insertTerritorySchema = createInsertSchema(territories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Company-wide PTO Policy - NEW
export const companyPtoPolicy = pgTable('company_pto_policy', {
  id: text('id').primaryKey(),
  vacationDays: integer('vacation_days').notNull().default(10),
  sickDays: integer('sick_days').notNull().default(5),
  personalDays: integer('personal_days').notNull().default(3),
  totalDays: integer('total_days').notNull().default(18),
  rolloverAllowed: boolean('rollover_allowed').notNull().default(false),
  maxRolloverDays: integer('max_rollover_days').default(0),
  blackoutDates: text('blackout_dates'), // JSON array of date ranges
  holidaySchedule: text('holiday_schedule'), // JSON array of company holidays
  policyNotes: text('policy_notes'),
  lastUpdatedBy: text('last_updated_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const companyPtoPolicySchema = createInsertSchema(companyPtoPolicy);
export const insertCompanyPtoPolicySchema = createInsertSchema(companyPtoPolicy).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Individual Employee PTO Policy Management - NEW
export const ptoPolicies = pgTable('pto_policies', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull().unique(),
  policyLevel: text('policy_level').$type<'COMPANY' | 'DEPARTMENT' | 'INDIVIDUAL'>().notNull().default('COMPANY'),
  vacationDays: integer('vacation_days').notNull().default(10), // Vacation days
  sickDays: integer('sick_days').notNull().default(5), // Sick days
  personalDays: integer('personal_days').notNull().default(3), // Personal days
  baseDays: integer('base_days').notNull(), // Base allocation from company/department
  additionalDays: integer('additional_days').notNull().default(0), // Manager customization
  totalDays: integer('total_days').notNull(), // Total available days
  usedDays: integer('used_days').notNull().default(0),
  remainingDays: integer('remaining_days').notNull(),
  customizedBy: text('customized_by'), // Manager who customized
  customizationDate: timestamp('customization_date'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const ptoPolicySchema = createInsertSchema(ptoPolicies);
export const insertPtoPolicySchema = createInsertSchema(ptoPolicies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Department PTO Settings - NEW
export const departmentPtoSettings = pgTable('department_pto_settings', {
  id: text('id').primaryKey(),
  department: text('department').notNull().unique(),
  vacationDays: integer('vacation_days').notNull(),
  sickDays: integer('sick_days').notNull(),
  personalDays: integer('personal_days').notNull(),
  totalDays: integer('total_days').notNull(),
  inheritFromCompany: boolean('inherit_from_company').notNull().default(true),
  customNotes: text('custom_notes'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const departmentPtoSettingSchema = createInsertSchema(departmentPtoSettings);
export const insertDepartmentPtoSettingSchema = createInsertSchema(departmentPtoSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// PTO Management
export const ptoRequests = pgTable('pto_requests', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  days: real('days').notNull(), // Changed from integer to real to support half-days (0.5)
  type: text('type').$type<'VACATION' | 'SICK' | 'PERSONAL'>().notNull().default('VACATION'),
  reason: text('reason').notNull(),
  status: text('status').$type<'PENDING' | 'APPROVED' | 'DENIED'>().notNull().default('PENDING'),
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at'),
  reviewNotes: text('review_notes'),
  departmentOverlapWarning: boolean('department_overlap_warning').default(false), // NEW
  overlappingEmployees: text('overlapping_employees').array(), // NEW - track who else has PTO
  googleEventId: text('google_event_id'), // Google Calendar event ID for employee's calendar
  hrCalendarEventId: text('hr_calendar_event_id'), // Google Calendar event ID for HR shared calendar
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const ptoRequestSchema = createInsertSchema(ptoRequests);
export const insertPtoRequestSchema = createInsertSchema(ptoRequests).omit({
  id: true,
  employeeId: true,  // This will be set from authenticated user
  status: true,      // Always starts as PENDING
  reviewedBy: true,
  reviewedAt: true,
  reviewNotes: true,
  createdAt: true,
  updatedAt: true,
});



// AI Custom Criteria
export const aiCriteria = pgTable('ai_criteria', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  criteria: text('criteria').notNull(), // JSON array of criteria strings
  weight: integer('weight').notNull().default(1), // 1-5 importance weight
  isActive: boolean('is_active').notNull().default(true),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const aiCriteriaSchema = createInsertSchema(aiCriteria);
export const insertAiCriteriaSchema = createInsertSchema(aiCriteria).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// COI (Certificate of Insurance) Tracking - NEW
export const coiDocuments = pgTable('coi_documents', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id'), // Nullable - can be null for external contractors not in system
  externalName: text('external_name'), // Name extracted from COI when no employee match (for subcontractors, etc.)
  parsedInsuredName: text('parsed_insured_name'), // Raw name extracted from document for reference
  type: text('type').$type<'WORKERS_COMP' | 'GENERAL_LIABILITY'>().notNull(),
  documentUrl: text('document_url').notNull(),
  issueDate: text('issue_date').notNull(),
  expirationDate: text('expiration_date').notNull(),
  uploadedBy: text('uploaded_by').notNull(),
  status: text('status').$type<'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED'>().notNull().default('ACTIVE'),
  lastAlertSent: timestamp('last_alert_sent'),
  alertFrequency: text('alert_frequency').$type<'MONTH_BEFORE' | 'TWO_WEEKS' | 'ONE_WEEK' | 'DAILY'>(),
  notes: text('notes'),
  googleDriveId: text('google_drive_id'), // For deduplication during sync
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const coiDocumentSchema = createInsertSchema(coiDocuments);
export const insertCoiDocumentSchema = createInsertSchema(coiDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Employee Assignments - NEW
export const employeeAssignments = pgTable('employee_assignments', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull(),
  assignedToId: text('assigned_to_id').notNull(), // HR or Manager assigned
  assignmentType: text('assignment_type').$type<'PRIMARY' | 'SECONDARY'>().notNull().default('PRIMARY'),
  responsibilities: text('responsibilities').array(), // Array of responsibilities like 'COI_TRACKING'
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const employeeAssignmentSchema = createInsertSchema(employeeAssignments);
export const insertEmployeeAssignmentSchema = createInsertSchema(employeeAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Contract Templates and Management - NEW
export const contractTemplates = pgTable('contract_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').$type<'EMPLOYMENT' | 'NDA' | 'CONTRACTOR' | 'OTHER'>().notNull(),
  territory: text('territory'), // Optional territory-specific template
  content: text('content').notNull(), // HTML or markdown content
  fileUrl: text('file_url'), // URL to PDF file attachment
  fileName: text('file_name'), // Original file name for reference
  variables: text('variables').array(), // Array of variable placeholders like {{name}}, {{position}}
  isActive: boolean('is_active').notNull().default(true),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const contractTemplateSchema = createInsertSchema(contractTemplates);
export const insertContractTemplateSchema = createInsertSchema(contractTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Employee Contracts - NEW
export const employeeContracts = pgTable('employee_contracts', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id'), // Made optional to support candidates
  candidateId: text('candidate_id'), // NEW - For new hires from recruiting
  recipientType: text('recipient_type').$type<'EMPLOYEE' | 'CANDIDATE'>().notNull().default('EMPLOYEE'),
  recipientEmail: text('recipient_email').notNull(), // Store email for both types
  recipientName: text('recipient_name').notNull(), // Store name for both types
  templateId: text('template_id'),
  title: text('title').notNull(),
  content: text('content').notNull(), // Final contract content
  fileUrl: text('file_url'), // URL to attached PDF file
  fileName: text('file_name'), // Original file name for reference
  status: text('status').$type<'DRAFT' | 'SENT' | 'VIEWED' | 'SIGNED' | 'REJECTED'>().notNull().default('DRAFT'),
  sentDate: timestamp('sent_date'),
  viewedDate: timestamp('viewed_date'),
  signedDate: timestamp('signed_date'),
  signature: text('signature'), // Base64 encoded signature or signature URL
  signatureIp: text('signature_ip'), // IP address when signed
  rejectionReason: text('rejection_reason'),
  notifiedManagers: text('notified_managers').array(), // Track which managers have been notified
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const employeeContractSchema = createInsertSchema(employeeContracts);
export const insertEmployeeContractSchema = createInsertSchema(employeeContracts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Recruiting
export const candidates = pgTable('candidates', {
  id: text('id').primaryKey(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  position: text('position').notNull(),
  resumeUrl: text('resume_url'),
  status: text('status').$type<'APPLIED' | 'SCREENING' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED' | 'DEAD_BY_US' | 'DEAD_BY_CANDIDATE'>().notNull().default('APPLIED'),
  stage: text('stage').notNull(),
  appliedDate: timestamp('applied_date').notNull(),
  notes: text('notes'),
  assignedTo: text('assigned_to'),
  recruiterId: text('recruiter_id'), // NEW - Track primary recruiter
  // AI Match Score fields
  matchScore: integer('match_score'), // 0-100 score
  potentialScore: integer('potential_score'), // 0-100 score
  aiInsights: text('ai_insights'), // JSON string with detailed analysis
  lastAnalyzed: timestamp('last_analyzed'),
  // Questionnaire fields
  hasDriversLicense: boolean('has_drivers_license'),
  hasReliableVehicle: boolean('has_reliable_vehicle'),
  canGetOnRoof: boolean('can_get_on_roof'),
  isOutgoing: boolean('is_outgoing'),
  availability: text('availability'),
  customTags: text('custom_tags').array(),
  questionnaireCompleted: boolean('questionnaire_completed').default(false),
  questionnaireCompletedBy: text('questionnaire_completed_by'),
  questionnaireCompletedAt: timestamp('questionnaire_completed_at'),
  // Phase 5: AI-Powered Enhancement fields
  parsedResumeData: text('parsed_resume_data'), // JSON with structured resume data
  predictedSuccessScore: real('predicted_success_score'), // 0-100 ML prediction
  predictedTenure: integer('predicted_tenure'), // Predicted months of employment
  salaryBenchmark: text('salary_benchmark'), // JSON with market salary data
  cultureFitScore: real('culture_fit_score'), // 0-100 based on assessment
  technicalFitScore: real('technical_fit_score'), // 0-100 based on skills match
  interviewQuestions: text('interview_questions'), // JSON array of AI-generated questions
  skillsGapAnalysis: text('skills_gap_analysis'), // JSON with missing skills
  competitorAnalysis: text('competitor_analysis'), // JSON with competitor offer data
  riskFactors: text('risk_factors'), // JSON array of identified risks
  // Interview screening fields (for in-person interviews)
  interviewScreeningData: text('interview_screening_data'), // JSON: { driversLicense: boolean, reliableVehicle: boolean, communication: boolean }
  interviewScreeningDate: timestamp('interview_screening_date'),
  interviewScreeningNotes: text('interview_screening_notes'),
  interviewScreeningBy: text('interview_screening_by'), // User ID who conducted screening
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const candidateSchema = createInsertSchema(candidates);
export const insertCandidateSchema = createInsertSchema(candidates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Candidate Notes History
export const candidateNotes = pgTable('candidate_notes', {
  id: text('id').primaryKey(),
  candidateId: text('candidate_id').notNull(),
  authorId: text('author_id').notNull(),
  content: text('content').notNull(),
  type: text('type').$type<'GENERAL' | 'INTERVIEW' | 'REFERENCE' | 'INTERNAL'>().notNull().default('GENERAL'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const candidateNoteSchema = createInsertSchema(candidateNotes);
export const insertCandidateNoteSchema = createInsertSchema(candidateNotes).omit({
  id: true,
  createdAt: true,
});

// Employee Notes (for HR/manager notes on employees)
export const employeeNotes = pgTable('employee_notes', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull(),
  authorId: text('author_id').notNull(),
  content: text('content').notNull(),
  type: text('type').$type<'GENERAL' | 'PERFORMANCE' | 'DISCIPLINARY' | 'RECOGNITION' | 'AI_GENERATED'>().notNull().default('GENERAL'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const employeeNoteSchema = createInsertSchema(employeeNotes);
export const insertEmployeeNoteSchema = createInsertSchema(employeeNotes).omit({
  id: true,
  createdAt: true,
});

export const interviews = pgTable('interviews', {
  id: text('id').primaryKey(),
  candidateId: text('candidate_id').notNull(),
  interviewerId: text('interviewer_id'), // nullable when using custom interviewer
  customInterviewerName: text('custom_interviewer_name'), // for interviewers not in system
  scheduledDate: timestamp('scheduled_date').notNull(),
  duration: integer('duration').notNull().default(60), // minutes
  type: text('type').$type<'PHONE' | 'VIDEO' | 'IN_PERSON' | 'TECHNICAL' | 'PANEL'>().notNull(),
  status: text('status').$type<'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED' | 'NO_SHOW'>().notNull().default('SCHEDULED'),
  location: text('location'), // for in-person interviews
  meetingLink: text('meeting_link'), // for video interviews
  notes: text('notes'),
  rating: integer('rating'),
  reminderSent: boolean('reminder_sent').notNull().default(false),
  reminderHours: integer('reminder_hours').notNull().default(24),
  googleEventId: text('google_event_id'), // Google Calendar integration
  zoomMeetingId: text('zoom_meeting_id'), // Zoom integration
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const interviewSchema = createInsertSchema(interviews);
export const insertInterviewSchema = createInsertSchema(interviews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Interview feedback table
export const interviewFeedback = pgTable('interview_feedback', {
  id: text('id').primaryKey(),
  interviewId: text('interview_id').notNull(),
  interviewerId: text('interviewer_id').notNull(),
  technicalSkills: integer('technical_skills').notNull(), // 1-5
  communication: integer('communication').notNull(), // 1-5
  problemSolving: integer('problem_solving').notNull(), // 1-5
  culturalFit: integer('cultural_fit').notNull(), // 1-5
  overallRating: integer('overall_rating').notNull(), // 1-5
  strengths: text('strengths').notNull(),
  concerns: text('concerns').notNull(),
  recommendation: text('recommendation').$type<'HIRE' | 'NO_HIRE' | 'UNDECIDED'>().notNull(),
  additionalNotes: text('additional_notes'),
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
});

export const interviewFeedbackSchema = createInsertSchema(interviewFeedback);
export const insertInterviewFeedbackSchema = createInsertSchema(interviewFeedback).omit({
  id: true,
  submittedAt: true,
});

// Interview reminders tracking
export const interviewReminders = pgTable('interview_reminders', {
  id: text('id').primaryKey(),
  interviewId: text('interview_id').notNull(),
  reminderType: text('reminder_type').$type<'CANDIDATE' | 'INTERVIEWER' | 'BOTH'>().notNull(),
  scheduledAt: timestamp('scheduled_at').notNull(),
  sentAt: timestamp('sent_at'),
  status: text('status').$type<'PENDING' | 'SENT' | 'FAILED'>().notNull().default('PENDING'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const insertInterviewReminderSchema = createInsertSchema(interviewReminders).omit({
  id: true,
  createdAt: true,
});

// Interview Availability Slots for automated scheduling
export const interviewAvailability = pgTable('interview_availability', {
  id: text('id').primaryKey(),
  interviewerId: text('interviewer_id').notNull(),
  dayOfWeek: integer('day_of_week').notNull(), // 0-6 (Sunday-Saturday)
  startTime: text('start_time').notNull(), // HH:MM format
  endTime: text('end_time').notNull(), // HH:MM format
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const interviewAvailabilitySchema = createInsertSchema(interviewAvailability);
export const insertInterviewAvailabilitySchema = createInsertSchema(interviewAvailability).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Interview Panel Members for panel interviews
export const interviewPanelMembers = pgTable('interview_panel_members', {
  id: text('id').primaryKey(),
  interviewId: text('interview_id').notNull(),
  userId: text('user_id').notNull(),
  role: text('role').$type<'LEAD' | 'PARTICIPANT' | 'OBSERVER'>().notNull().default('PARTICIPANT'),
  hasProvidedFeedback: boolean('has_provided_feedback').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const interviewPanelMemberSchema = createInsertSchema(interviewPanelMembers);
export const insertInterviewPanelMemberSchema = createInsertSchema(interviewPanelMembers).omit({
  id: true,
  createdAt: true,
});

// Calendar Events - User-created events that sync to Google Calendar
export const calendarEvents = pgTable('calendar_events', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(), // Owner of the event
  googleEventId: text('google_event_id'), // ID from Google Calendar after sync
  type: text('type').$type<'MEETING' | 'PTO' | 'INTERVIEW' | 'OTHER'>().notNull(),
  title: text('title').notNull(),
  description: text('description'),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  location: text('location'),
  meetLink: text('meet_link'),
  allDay: boolean('all_day').notNull().default(false),
  // For PTO type events
  ptoType: text('pto_type').$type<'VACATION' | 'SICK' | 'PERSONAL'>(),
  ptoRequestId: text('pto_request_id'), // Link to PTO request if applicable
  // For Interview type events
  candidateId: text('candidate_id'), // Link to candidate for interviews
  interviewId: text('interview_id'), // Link to interview record
  // Attendees for meetings/events
  attendees: text('attendees').array(), // Array of email addresses
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const calendarEventSchema = createInsertSchema(calendarEvents);
export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Calendar Event Attendees - Track individual RSVP status
export const calendarEventAttendees = pgTable('calendar_event_attendees', {
  id: text('id').primaryKey(),
  eventId: text('event_id').notNull().references(() => calendarEvents.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  status: text('status').$type<'PENDING' | 'ACCEPTED' | 'MAYBE' | 'DECLINED'>().notNull().default('PENDING'),
  rsvpToken: text('rsvp_token').notNull(), // Unique token for email links
  respondedAt: timestamp('responded_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const calendarEventAttendeeSchema = createInsertSchema(calendarEventAttendees);

// Email Templates
export const emailTemplates = pgTable('email_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  type: text('type').$type<'INTERVIEW_SCHEDULED' | 'INTERVIEW_REMINDER' | 'STATUS_UPDATE' | 'REJECTION' | 'OFFER'>().notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const emailTemplateSchema = createInsertSchema(emailTemplates);
export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Email Logs
export const emailLogs = pgTable('email_logs', {
  id: text('id').primaryKey(),
  candidateId: text('candidate_id'),
  interviewId: text('interview_id'),
  recipientEmail: text('recipient_email').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  status: text('status').$type<'SENT' | 'FAILED' | 'PENDING'>().notNull().default('PENDING'),
  errorMessage: text('error_message'),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const emailLogSchema = createInsertSchema(emailLogs);
export const insertEmailLogSchema = createInsertSchema(emailLogs).omit({
  id: true,
  createdAt: true,
});

// Phase 3: Enhanced Communication Tables

// Email Campaigns
export const emailCampaigns = pgTable('email_campaigns', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').$type<'ONBOARDING' | 'NURTURE' | 'FOLLOW_UP' | 'REJECTION' | 'OFFER' | 'GENERAL'>().notNull(),
  status: text('status').$type<'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED'>().notNull().default('DRAFT'),
  targetAudience: text('target_audience').$type<'ALL_CANDIDATES' | 'SPECIFIC_STAGE' | 'CUSTOM'>().notNull(),
  stageFilter: text('stage_filter'), // If targeting specific stage
  totalRecipients: integer('total_recipients').notNull().default(0),
  sentCount: integer('sent_count').notNull().default(0),
  openCount: integer('open_count').notNull().default(0),
  clickCount: integer('click_count').notNull().default(0),
  responseCount: integer('response_count').notNull().default(0),
  createdBy: text('created_by').notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Campaign Steps (for multi-step campaigns)
export const campaignSteps = pgTable('campaign_steps', {
  id: text('id').primaryKey(),
  campaignId: text('campaign_id').notNull(),
  stepNumber: integer('step_number').notNull(),
  name: text('name').notNull(),
  subject: text('subject').notNull(),
  content: text('content').notNull(),
  delayDays: integer('delay_days').notNull().default(0), // Days to wait after previous step
  conditionType: text('condition_type').$type<'ALWAYS' | 'IF_OPENED' | 'IF_NOT_OPENED' | 'IF_CLICKED' | 'IF_NOT_CLICKED'>().notNull().default('ALWAYS'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Campaign Recipients
export const campaignRecipients = pgTable('campaign_recipients', {
  id: text('id').primaryKey(),
  campaignId: text('campaign_id').notNull(),
  candidateId: text('candidate_id').notNull(),
  email: text('email').notNull(),
  currentStep: integer('current_step').notNull().default(0),
  status: text('status').$type<'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'UNSUBSCRIBED' | 'FAILED'>().notNull().default('PENDING'),
  lastSentAt: timestamp('last_sent_at'),
  nextSendAt: timestamp('next_send_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Enhanced Email Tracking
export const emailTracking = pgTable('email_tracking', {
  id: text('id').primaryKey(),
  emailLogId: text('email_log_id').notNull(),
  campaignId: text('campaign_id'),
  recipientId: text('recipient_id').notNull(),
  messageId: text('message_id').unique(), // For tracking opens/clicks
  openCount: integer('open_count').notNull().default(0),
  firstOpenedAt: timestamp('first_opened_at'),
  lastOpenedAt: timestamp('last_opened_at'),
  clickCount: integer('click_count').notNull().default(0),
  firstClickedAt: timestamp('first_clicked_at'),
  lastClickedAt: timestamp('last_clicked_at'),
  unsubscribedAt: timestamp('unsubscribed_at'),
  bouncedAt: timestamp('bounced_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// SMS Messages
export const smsMessages = pgTable('sms_messages', {
  id: text('id').primaryKey(),
  candidateId: text('candidate_id'),
  recipientPhone: text('recipient_phone').notNull(),
  message: text('message').notNull(),
  type: text('type').$type<'REMINDER' | 'NOTIFICATION' | 'CAMPAIGN' | 'ALERT'>().notNull(),
  status: text('status').$type<'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED'>().notNull().default('PENDING'),
  twilioMessageSid: text('twilio_message_sid'),
  errorMessage: text('error_message'),
  sentAt: timestamp('sent_at'),
  deliveredAt: timestamp('delivered_at'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Communication Preferences
export const communicationPreferences = pgTable('communication_preferences', {
  id: text('id').primaryKey(),
  candidateId: text('candidate_id').notNull().unique(),
  emailEnabled: boolean('email_enabled').notNull().default(true),
  smsEnabled: boolean('sms_enabled').notNull().default(false),
  preferredChannel: text('preferred_channel').$type<'EMAIL' | 'SMS' | 'BOTH'>().notNull().default('EMAIL'),
  unsubscribedEmail: boolean('unsubscribed_email').notNull().default(false),
  unsubscribedSms: boolean('unsubscribed_sms').notNull().default(false),
  timezone: text('timezone').notNull().default('America/New_York'),
  bestTimeToContact: text('best_time_to_contact'), // e.g., "9AM-5PM"
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// AI Email Generation Logs
export const aiEmailGenerations = pgTable('ai_email_generations', {
  id: text('id').primaryKey(),
  candidateId: text('candidate_id'),
  templateType: text('template_type').notNull(),
  prompt: text('prompt').notNull(),
  generatedSubject: text('generated_subject').notNull(),
  generatedContent: text('generated_content').notNull(),
  tokensUsed: integer('tokens_used'),
  model: text('model').notNull().default('gpt-4'),
  approved: boolean('approved').notNull().default(false),
  usedInCampaign: boolean('used_in_campaign').notNull().default(false),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Export schemas for Phase 3 tables
export const emailCampaignSchema = createInsertSchema(emailCampaigns);
export const insertEmailCampaignSchema = createInsertSchema(emailCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const campaignStepSchema = createInsertSchema(campaignSteps);
export const insertCampaignStepSchema = createInsertSchema(campaignSteps).omit({
  id: true,
  createdAt: true,
});

export const campaignRecipientSchema = createInsertSchema(campaignRecipients);
export const insertCampaignRecipientSchema = createInsertSchema(campaignRecipients).omit({
  id: true,
  createdAt: true,
});

export const emailTrackingSchema = createInsertSchema(emailTracking);
export const insertEmailTrackingSchema = createInsertSchema(emailTracking).omit({
  id: true,
  createdAt: true,
});

export const smsMessageSchema = createInsertSchema(smsMessages);
export const insertSmsMessageSchema = createInsertSchema(smsMessages).omit({
  id: true,
  createdAt: true,
});

export const communicationPreferenceSchema = createInsertSchema(communicationPreferences);
export const insertCommunicationPreferenceSchema = createInsertSchema(communicationPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const aiEmailGenerationSchema = createInsertSchema(aiEmailGenerations);
export const insertAiEmailGenerationSchema = createInsertSchema(aiEmailGenerations).omit({
  id: true,
  createdAt: true,
});

// Job Import Logs
export const jobImportLogs = pgTable('job_import_logs', {
  id: text('id').primaryKey(),
  source: text('source').$type<'INDEED' | 'GOOGLE_JOBS' | 'LINKEDIN' | 'CSV' | 'MANUAL'>().notNull(),
  jobTitle: text('job_title').notNull(),
  candidatesFound: integer('candidates_found').notNull().default(0),
  candidatesImported: integer('candidates_imported').notNull().default(0),
  status: text('status').$type<'SUCCESS' | 'FAILED' | 'PARTIAL'>().notNull(),
  errorMessage: text('error_message'),
  importedAt: timestamp('imported_at').defaultNow().notNull(),
});

// Job Postings
export const jobPostings = pgTable('job_postings', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  requirements: text('requirements').notNull(),
  location: text('location').notNull(),
  salary: text('salary'),
  type: text('type').$type<'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP'>().notNull(),
  department: text('department').notNull(),
  status: text('status').$type<'DRAFT' | 'PUBLISHED' | 'CLOSED'>().notNull().default('DRAFT'),
  indeedJobId: text('indeed_job_id'),
  linkedinJobId: text('linkedin_job_id'),
  publishedAt: timestamp('published_at'),
  closedAt: timestamp('closed_at'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Candidate Sources - track where candidates came from
export const candidateSources = pgTable('candidate_sources', {
  id: text('id').primaryKey(),
  candidateId: text('candidate_id').notNull(),
  source: text('source').$type<'INDEED' | 'LINKEDIN' | 'GOOGLE_JOBS' | 'WEBSITE' | 'REFERRAL' | 'OTHER'>().notNull(),
  sourceJobId: text('source_job_id'), // External job ID from Indeed/LinkedIn
  sourceUrl: text('source_url'),
  importBatchId: text('import_batch_id'), // For bulk imports
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Export schemas for new tables
export const jobPostingSchema = createInsertSchema(jobPostings);
export const insertJobPostingSchema = createInsertSchema(jobPostings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const candidateSourceSchema = createInsertSchema(candidateSources);
export const insertCandidateSourceSchema = createInsertSchema(candidateSources).omit({
  id: true,
  createdAt: true,
});

export const jobImportLogSchema = createInsertSchema(jobImportLogs);
export const insertJobImportLogSchema = createInsertSchema(jobImportLogs).omit({
  id: true,
  importedAt: true,
});

// Type exports
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = typeof insertEmailTemplateSchema._type;

export type EmailLog = typeof emailLogs.$inferSelect;
export type InsertEmailLog = typeof insertEmailLogSchema._type;

export type JobImportLog = typeof jobImportLogs.$inferSelect;
export type InterviewFeedback = typeof interviewFeedback.$inferSelect;
export type InsertInterviewFeedback = z.infer<typeof insertInterviewFeedbackSchema>;
export type InterviewReminder = typeof interviewReminders.$inferSelect;
export type InsertInterviewReminder = z.infer<typeof insertInterviewReminderSchema>;
export type InsertJobImportLog = typeof insertJobImportLogSchema._type;

// Document Management System
export const documents = pgTable('documents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  originalName: text('original_name').notNull(),
  description: text('description'),
  category: text('category').$type<'POLICY' | 'FORM' | 'HANDBOOK' | 'PROCEDURE' | 'TEMPLATE' | 'LEGAL' | 'TRAINING' | 'OTHER'>().notNull(),
  type: text('type').$type<'PDF' | 'DOC' | 'DOCX' | 'XLS' | 'XLSX' | 'TXT' | 'IMAGE' | 'OTHER'>().notNull(),
  fileUrl: text('file_url').notNull(),
  fileSize: integer('file_size').notNull(), // in bytes
  version: text('version').notNull().default('1.0'),
  status: text('status').$type<'DRAFT' | 'REVIEW' | 'APPROVED' | 'ARCHIVED'>().notNull().default('DRAFT'),
  visibility: text('visibility').$type<'PUBLIC' | 'EMPLOYEE' | 'MANAGER' | 'ADMIN'>().notNull().default('EMPLOYEE'),
  tags: text('tags').array(), // searchable tags
  createdBy: text('created_by').notNull(),
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at'),
  expiresAt: timestamp('expires_at'), // for policies that need renewal
  downloadCount: integer('download_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const documentSchema = createInsertSchema(documents);
export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  downloadCount: true,
});

// Document versions for tracking changes
export const documentVersions = pgTable('document_versions', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull(),
  version: text('version').notNull(),
  fileUrl: text('file_url').notNull(),
  changeLog: text('change_log').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const documentVersionSchema = createInsertSchema(documentVersions);
export const insertDocumentVersionSchema = createInsertSchema(documentVersions).omit({
  id: true,
  createdAt: true,
});

// Document access logs for audit trails
export const documentAccessLogs = pgTable('document_access_logs', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull(),
  userId: text('user_id').notNull(),
  action: text('action').$type<'VIEW' | 'DOWNLOAD' | 'SHARE' | 'DELETE'>().notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  accessedAt: timestamp('accessed_at').defaultNow().notNull(),
});

export const documentAccessLogSchema = createInsertSchema(documentAccessLogs);
export const insertDocumentAccessLogSchema = createInsertSchema(documentAccessLogs).omit({
  id: true,
  accessedAt: true,
});

// Employee document acknowledgments
export const documentAcknowledgments = pgTable('document_acknowledgments', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull(),
  employeeId: text('employee_id').notNull(),
  acknowledgedAt: timestamp('acknowledged_at').defaultNow().notNull(),
  signature: text('signature'), // digital signature or name
  notes: text('notes'),
});

export const documentAcknowledgmentSchema = createInsertSchema(documentAcknowledgments);
export const insertDocumentAcknowledgmentSchema = createInsertSchema(documentAcknowledgments).omit({
  id: true,
  acknowledgedAt: true,
});

// Document type exports (moved to main type exports section below)

// Old Document Management (keeping for compatibility)
export const employeeDocuments = pgTable('employee_documents', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull(),
  title: text('title').notNull(),
  type: text('type').$type<'ID' | 'LICENSE' | 'CERTIFICATION' | 'CONTRACT' | 'HANDBOOK' | 'OTHER'>().notNull(),
  url: text('url').notNull(),
  uploadedBy: text('uploaded_by').notNull(),
  status: text('status').$type<'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED'>().notNull().default('PENDING'),
  expirationDate: timestamp('expiration_date'),
  isRequired: boolean('is_required').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const employeeDocumentSchema = createInsertSchema(employeeDocuments);
export const insertEmployeeDocumentSchema = createInsertSchema(employeeDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Employee Reviews
export const employeeReviews = pgTable('employee_reviews', {
  id: text('id').primaryKey(),
  revieweeId: text('reviewee_id').notNull(),
  reviewerId: text('reviewer_id').notNull(),
  reviewPeriod: text('review_period').notNull(), // e.g., "Q1 2024", "Annual 2024"
  reviewType: text('review_type').$type<'QUARTERLY' | 'ANNUAL' | 'PROBATION' | 'PROJECT' | 'IMPROVEMENT'>().notNull(),
  status: text('status').$type<'DRAFT' | 'IN_PROGRESS' | 'SUBMITTED' | 'ACKNOWLEDGED'>().notNull().default('DRAFT'),
  overallRating: integer('overall_rating'), // 1-5 scale
  performanceScore: integer('performance_score'), // 1-5 scale
  teamworkScore: integer('teamwork_score'), // 1-5 scale
  communicationScore: integer('communication_score'), // 1-5 scale
  technicalScore: integer('technical_score'), // 1-5 scale
  strengths: text('strengths'),
  areasForImprovement: text('areas_for_improvement'),
  goals: text('goals'),
  comments: text('comments'),
  revieweeComments: text('reviewee_comments'),
  acknowledgedAt: timestamp('acknowledged_at', { mode: 'date' }),
  submittedAt: timestamp('submitted_at', { mode: 'date' }),
  dueDate: timestamp('due_date', { mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

export const employeeReviewSchema = createInsertSchema(employeeReviews);
export const insertEmployeeReviewSchema = createInsertSchema(employeeReviews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Task Management
export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  assignedTo: text('assigned_to').notNull(),
  assignedBy: text('assigned_by').notNull(),
  priority: text('priority').$type<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>().notNull().default('MEDIUM'),
  status: text('status').$type<'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'>().notNull().default('TODO'),
  dueDate: timestamp('due_date'),
  category: text('category').notNull(),
  tags: text('tags').array().notNull(),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const taskSchema = createInsertSchema(tasks);
export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Sales Metrics History
export const salesMetrics = pgTable('sales_metrics', {
  id: text('id').primaryKey(),
  repId: text('rep_id').notNull(),
  month: integer('month').notNull(),
  year: integer('year').notNull(),
  signups: integer('signups').notNull().default(0),
  revenue: integer('revenue').notNull().default(0),
  bonusTier: integer('bonus_tier').notNull().default(0),
  bonusAmount: integer('bonus_amount').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

export const salesMetricSchema = createInsertSchema(salesMetrics);
export const insertSalesMetricSchema = createInsertSchema(salesMetrics).omit({
  id: true,
  createdAt: true,
});

// Bonus Configuration
export const bonusConfig = pgTable('bonus_config', {
  id: text('id').primaryKey(),
  tier: integer('tier').notNull().unique(),
  signupThreshold: integer('signup_threshold').notNull(),
  bonusAmount: integer('bonus_amount').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

export const bonusConfigSchema = createInsertSchema(bonusConfig);
export const insertBonusConfigSchema = createInsertSchema(bonusConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Employee Onboarding Workflow
export const onboardingWorkflows = pgTable('onboarding_workflows', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull(),
  status: text('status').$type<'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED'>().notNull().default('NOT_STARTED'),
  currentStep: integer('current_step').notNull().default(1),
  totalSteps: integer('total_steps').notNull().default(10),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  assignedTo: text('assigned_to'), // HR representative
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const onboardingWorkflowSchema = createInsertSchema(onboardingWorkflows);
export const insertOnboardingWorkflowSchema = createInsertSchema(onboardingWorkflows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const onboardingSteps = pgTable('onboarding_steps', {
  id: text('id').primaryKey(),
  workflowId: text('workflow_id').notNull(),
  stepNumber: integer('step_number').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  type: text('type').$type<'DOCUMENT_UPLOAD' | 'FORM_FILL' | 'TRAINING' | 'MEETING' | 'TASK' | 'REVIEW'>().notNull(),
  status: text('status').$type<'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED'>().notNull().default('PENDING'),
  isRequired: boolean('is_required').notNull().default(true),
  assignedTo: text('assigned_to'),
  dueDate: timestamp('due_date'),
  completedAt: timestamp('completed_at'),
  notes: text('notes'),
  documentIds: text('document_ids').array(), // Related documents
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const onboardingStepSchema = createInsertSchema(onboardingSteps);
export const insertOnboardingStepSchema = createInsertSchema(onboardingSteps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Performance Review Automation
export const performanceTemplates = pgTable('performance_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').$type<'QUARTERLY' | 'ANNUAL' | 'PROBATION' | 'PROJECT' | 'IMPROVEMENT'>().notNull(),
  description: text('description'),
  questions: text('questions').array().notNull(), // JSON array of questions
  isActive: boolean('is_active').notNull().default(true),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const performanceTemplateSchema = createInsertSchema(performanceTemplates);
export const insertPerformanceTemplateSchema = createInsertSchema(performanceTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const automatedReviews = pgTable('automated_reviews', {
  id: text('id').primaryKey(),
  templateId: text('template_id').notNull(),
  employeeId: text('employee_id').notNull(),
  reviewerId: text('reviewer_id').notNull(),
  scheduledDate: timestamp('scheduled_date').notNull(),
  status: text('status').$type<'SCHEDULED' | 'GENERATED' | 'SENT' | 'COMPLETED' | 'CANCELLED'>().notNull().default('SCHEDULED'),
  remindersSent: integer('reminders_sent').notNull().default(0),
  generatedReviewId: text('generated_review_id'), // Links to employeeReviews
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const automatedReviewSchema = createInsertSchema(automatedReviews);
export const insertAutomatedReviewSchema = createInsertSchema(automatedReviews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Advanced Analytics and Reporting
export const analyticsReports = pgTable('analytics_reports', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').$type<'EMPLOYEE_PERFORMANCE' | 'PTO_ANALYSIS' | 'SALES_REPORT' | 'RECRUITMENT_METRICS' | 'CUSTOM'>().notNull(),
  description: text('description'),
  config: text('config').notNull(), // JSON configuration
  filters: text('filters'), // JSON filters
  schedule: text('schedule'), // cron expression for automated reports
  isActive: boolean('is_active').notNull().default(true),
  createdBy: text('created_by').notNull(),
  lastGenerated: timestamp('last_generated'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const analyticsReportSchema = createInsertSchema(analyticsReports);
export const insertAnalyticsReportSchema = createInsertSchema(analyticsReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const reportHistory = pgTable('report_history', {
  id: text('id').primaryKey(),
  reportId: text('report_id').notNull(),
  generatedBy: text('generated_by'),
  data: text('data').notNull(), // JSON data
  fileUrl: text('file_url'), // URL to exported file
  status: text('status').$type<'GENERATING' | 'COMPLETED' | 'FAILED'>().notNull().default('GENERATING'),
  errorMessage: text('error_message'),
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
});

export const reportHistorySchema = createInsertSchema(reportHistory);
export const insertReportHistorySchema = createInsertSchema(reportHistory).omit({
  id: true,
  generatedAt: true,
});

// HR Agent Configuration
export const hrAgentConfigs = pgTable('hr_agent_configs', {
  id: text('id').primaryKey(),
  agentName: text('agent_name').notNull().unique(),
  isActive: boolean('is_active').notNull().default(false),
  schedule: text('schedule').notNull(), // Cron expression
  description: text('description').notNull(),
  lastRun: timestamp('last_run'),
  nextRun: timestamp('next_run'),
  lastStatus: text('last_status').$type<'SUCCESS' | 'FAILED' | 'RUNNING' | 'PENDING'>(),
  lastError: text('last_error'),
  config: text('config'), // JSON configuration specific to each agent
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const hrAgentConfigSchema = createInsertSchema(hrAgentConfigs);
export const insertHrAgentConfigSchema = createInsertSchema(hrAgentConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// HR Agent Execution Logs
export const hrAgentLogs = pgTable('hr_agent_logs', {
  id: text('id').primaryKey(),
  agentName: text('agent_name').notNull(),
  status: text('status').$type<'SUCCESS' | 'FAILED' | 'RUNNING'>().notNull(),
  message: text('message').notNull(),
  affectedRecords: integer('affected_records').notNull().default(0),
  executionTime: integer('execution_time'), // in milliseconds
  details: text('details'), // JSON with detailed results
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const hrAgentLogSchema = createInsertSchema(hrAgentLogs);
export const insertHrAgentLogSchema = createInsertSchema(hrAgentLogs).omit({
  id: true,
  createdAt: true,
});

// AI Model Performance Tracking
export const aiModelPerformance = pgTable('ai_model_performance', {
  id: text('id').primaryKey(),
  modelName: text('model_name').notNull(),
  modelVersion: text('model_version').notNull(),
  metricType: text('metric_type').$type<'PREDICTION_ACCURACY' | 'RESUME_PARSING' | 'QUESTION_GENERATION' | 'SALARY_BENCHMARK'>().notNull(),
  accuracy: real('accuracy'), // 0-100 percentage
  precision: real('precision'), // 0-100 percentage
  recall: real('recall'), // 0-100 percentage
  f1Score: real('f1_score'), // 0-100 percentage
  samplesCount: integer('samples_count').notNull(),
  evaluatedAt: timestamp('evaluated_at').defaultNow().notNull(),
  notes: text('notes'),
});

export const insertAiModelPerformanceSchema = createInsertSchema(aiModelPerformance).omit({
  id: true,
  evaluatedAt: true,
});

// Salary Benchmark Data
export const salaryBenchmarks = pgTable('salary_benchmarks', {
  id: text('id').primaryKey(),
  position: text('position').notNull(),
  location: text('location').notNull(),
  experienceLevel: text('experience_level').$type<'ENTRY' | 'MID' | 'SENIOR' | 'EXPERT'>().notNull(),
  minSalary: integer('min_salary').notNull(),
  maxSalary: integer('max_salary').notNull(),
  medianSalary: integer('median_salary').notNull(),
  currency: text('currency').notNull().default('USD'),
  dataSource: text('data_source').notNull(),
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
  sampleSize: integer('sample_size'),
  competitorData: text('competitor_data'), // JSON with competitor offers
});

export const insertSalaryBenchmarkSchema = createInsertSchema(salaryBenchmarks).omit({
  id: true,
  lastUpdated: true,
});

// Dynamic Interview Question Bank
export const interviewQuestionBank = pgTable('interview_question_bank', {
  id: text('id').primaryKey(),
  position: text('position').notNull(),
  category: text('category').$type<'TECHNICAL' | 'BEHAVIORAL' | 'SITUATIONAL' | 'CULTURE_FIT' | 'PROBLEM_SOLVING'>().notNull(),
  experienceLevel: text('experience_level').$type<'ENTRY' | 'MID' | 'SENIOR' | 'EXPERT'>().notNull(),
  question: text('question').notNull(),
  expectedAnswer: text('expected_answer'),
  evaluationCriteria: text('evaluation_criteria'), // JSON array
  difficulty: integer('difficulty').notNull(), // 1-5
  usageCount: integer('usage_count').notNull().default(0),
  successRate: real('success_rate'), // 0-100 based on hire outcomes
  createdBy: text('created_by').notNull(),
  isAiGenerated: boolean('is_ai_generated').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const insertInterviewQuestionBankSchema = createInsertSchema(interviewQuestionBank).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Tools and Equipment Management
export const toolInventory = pgTable('tool_inventory', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').$type<'LAPTOP' | 'LADDER' | 'IPAD' | 'BOOTS' | 'POLO' | 'CAR' | 'OTHER'>().notNull(),
  description: text('description'),
  serialNumber: text('serial_number'),
  model: text('model'),
  quantity: integer('quantity').notNull().default(1),
  availableQuantity: integer('available_quantity').notNull().default(1),
  condition: text('condition').$type<'NEW' | 'GOOD' | 'FAIR' | 'POOR'>().notNull().default('GOOD'),
  purchaseDate: timestamp('purchase_date'),
  purchasePrice: integer('purchase_price'),
  location: text('location'),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const toolInventorySchema = createInsertSchema(toolInventory);
export const insertToolInventorySchema = createInsertSchema(toolInventory).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
});

export const toolAssignments = pgTable('tool_assignments', {
  id: text('id').primaryKey(),
  toolId: text('tool_id').notNull(),
  employeeId: text('employee_id').notNull(),
  assignedBy: text('assigned_by').notNull(),
  assignedDate: timestamp('assigned_date').defaultNow().notNull(),
  returnDate: timestamp('return_date'),
  status: text('status').$type<'ASSIGNED' | 'RETURNED' | 'LOST' | 'DAMAGED'>().notNull().default('ASSIGNED'),
  condition: text('condition').$type<'NEW' | 'GOOD' | 'FAIR' | 'POOR'>().notNull(),
  notes: text('notes'),
  signatureRequired: boolean('signature_required').notNull().default(true),
  signatureReceived: boolean('signature_received').notNull().default(false),
  signatureDate: timestamp('signature_date'),
  signatureToken: text('signature_token'), // Unique token for signature confirmation
  emailSent: boolean('email_sent').notNull().default(false),
  emailSentDate: timestamp('email_sent_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const toolAssignmentSchema = createInsertSchema(toolAssignments);
export const insertToolAssignmentSchema = createInsertSchema(toolAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const toolSignatures = pgTable('tool_signatures', {
  id: text('id').primaryKey(),
  assignmentId: text('assignment_id').notNull(),
  employeeId: text('employee_id').notNull(),
  signatureData: text('signature_data').notNull(), // Base64 encoded signature image or text
  signatureType: text('signature_type').$type<'IMAGE' | 'TEXT' | 'DIGITAL'>().notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  acknowledgedTerms: boolean('acknowledged_terms').notNull().default(true),
  signedAt: timestamp('signed_at').defaultNow().notNull(),
});

export const toolSignatureSchema = createInsertSchema(toolSignatures);
export const insertToolSignatureSchema = createInsertSchema(toolSignatures).omit({
  id: true,
  signedAt: true,
});

// Equipment Receipts - comprehensive document for new hire tool acknowledgment
export const equipmentReceipts = pgTable('equipment_receipts', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull(),
  employeeName: text('employee_name').notNull(),
  position: text('position').notNull(),
  startDate: timestamp('start_date'),
  items: jsonb('items').notNull().$type<Array<{ toolId: string; toolName: string; quantity: number }>>(),
  issuedDate: timestamp('issued_date').notNull().defaultNow(),
  signatureDate: timestamp('signature_date'),
  signatureData: text('signature_data'), // Base64 signature image
  signatureIp: text('signature_ip'),
  status: text('status').$type<'PENDING' | 'SIGNED'>().default('PENDING').notNull(),
  trainingUrl: text('training_url').default('https://a21.up.railway.app/'),
  trainingAcknowledged: boolean('training_acknowledged').default(false),
  notes: text('notes'),
  pdfUrl: text('pdf_url'), // URL to generated PDF after signing
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const equipmentReceiptSchema = createInsertSchema(equipmentReceipts);
export const insertEquipmentReceiptSchema = createInsertSchema(equipmentReceipts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type EquipmentReceipt = typeof equipmentReceipts.$inferSelect;
export type InsertEquipmentReceipt = typeof equipmentReceipts.$inferInsert;

// Inventory Alert Thresholds
export const inventoryAlerts = pgTable('inventory_alerts', {
  id: text('id').primaryKey(),
  toolId: text('tool_id').notNull(),
  thresholdQuantity: integer('threshold_quantity').notNull(),
  alertEnabled: boolean('alert_enabled').notNull().default(true),
  alertRecipients: text('alert_recipients').array(), // Array of user IDs to notify
  lastAlertSent: timestamp('last_alert_sent'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const inventoryAlertSchema = createInsertSchema(inventoryAlerts);
export const insertInventoryAlertSchema = createInsertSchema(inventoryAlerts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Welcome Pack Bundles
export const welcomePackBundles = pgTable('welcome_pack_bundles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const welcomePackBundleSchema = createInsertSchema(welcomePackBundles);
export const insertWelcomePackBundleSchema = createInsertSchema(welcomePackBundles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Welcome Pack Bundle Items
export const bundleItems = pgTable('bundle_items', {
  id: text('id').primaryKey(),
  bundleId: text('bundle_id').notNull(),
  itemName: text('item_name').notNull(),
  itemCategory: text('item_category').$type<'LAPTOP' | 'LADDER' | 'IPAD' | 'BOOTS' | 'POLO' | 'QUARTER_ZIP' | 'FLASHLIGHT' | 'KEYBOARD' | 'CHARGER' | 'CLOTHING' | 'TECHNOLOGY' | 'TOOLS' | 'OTHER'>().notNull(),
  quantity: integer('quantity').notNull().default(1),
  requiresSize: boolean('requires_size').notNull().default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const bundleItemSchema = createInsertSchema(bundleItems);
export const insertBundleItemSchema = createInsertSchema(bundleItems).omit({
  id: true,
  createdAt: true,
});

// Bundle Assignments (When a bundle is assigned to an employee)
export const bundleAssignments = pgTable('bundle_assignments', {
  id: text('id').primaryKey(),
  bundleId: text('bundle_id').notNull(),
  employeeId: text('employee_id').notNull(),
  assignedBy: text('assigned_by').notNull(),
  assignedDate: timestamp('assigned_date').defaultNow().notNull(),
  status: text('status').$type<'PENDING' | 'PARTIALLY_FULFILLED' | 'FULFILLED' | 'CANCELLED'>().notNull().default('PENDING'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const bundleAssignmentSchema = createInsertSchema(bundleAssignments);
export const insertBundleAssignmentSchema = createInsertSchema(bundleAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Bundle Assignment Items (Track individual items in a bundle assignment with sizes)
export const bundleAssignmentItems = pgTable('bundle_assignment_items', {
  id: text('id').primaryKey(),
  assignmentId: text('assignment_id').notNull(),
  bundleItemId: text('bundle_item_id').notNull(),
  toolId: text('tool_id'), // Link to actual inventory item
  size: text('size').$type<'S' | 'M' | 'L' | 'XL' | 'XXL' | '3X'>(), // For clothing items
  quantity: integer('quantity').notNull(),
  status: text('status').$type<'PENDING' | 'ASSIGNED' | 'UNAVAILABLE'>().notNull().default('PENDING'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const bundleAssignmentItemSchema = createInsertSchema(bundleAssignmentItems);
export const insertBundleAssignmentItemSchema = createInsertSchema(bundleAssignmentItems).omit({
  id: true,
  createdAt: true,
});

// Company Settings
export const companySettings = pgTable('company_settings', {
  id: text('id').primaryKey(),
  companyName: text('company_name').notNull(),
  address: text('address').notNull(),
  phone: text('phone').notNull(),
  email: text('email').notNull(),
  website: text('website'),
  ptoPolicy: text('pto_policy').notNull(), // JSON string
  ptoPolicySummary: text('pto_policy_summary'), // Admin/Manager editable summary
  businessHours: text('business_hours').notNull(), // JSON string
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const companySettingsSchema = createInsertSchema(companySettings);
export const insertCompanySettingsSchema = createInsertSchema(companySettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============================================
// Equipment Checklists (Public Form for New Hires & Terminations)
// ============================================
export const equipmentChecklists = pgTable('equipment_checklists', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').references(() => users.id),
  employeeName: text('employee_name').notNull(),
  employeeEmail: text('employee_email').notNull(),

  // Token for public access (no login required)
  accessToken: text('access_token').notNull().unique(),
  tokenExpiry: timestamp('token_expiry'),

  // Type: ISSUED (new hire) or RETURNED (termination)
  type: text('type').$type<'ISSUED' | 'RETURNED'>().notNull(),

  // Clothing received (checkboxes)
  grayPoloReceived: boolean('gray_polo_received').default(false),
  blackPoloReceived: boolean('black_polo_received').default(false),
  grayZipReceived: boolean('gray_zip_received').default(false),
  blackZipReceived: boolean('black_zip_received').default(false),
  clothingOther: text('clothing_other'),
  clothingNone: boolean('clothing_none').default(false),

  // Materials received (checkboxes)
  ipadWithKeyboardReceived: boolean('ipad_with_keyboard_received').default(false),
  flashlightSetReceived: boolean('flashlight_set_received').default(false),
  ladderReceived: boolean('ladder_received').default(false),
  ipadOnlyReceived: boolean('ipad_only_received').default(false),
  keyboardOnlyReceived: boolean('keyboard_only_received').default(false),
  flashlightOnlyReceived: boolean('flashlight_only_received').default(false),
  materialsOther: text('materials_other'),
  materialsNone: boolean('materials_none').default(false),

  // Signature
  signatureData: text('signature_data'),  // Base64 PNG
  signedAt: timestamp('signed_at'),
  signatureIp: text('signature_ip'),

  // Return section (for RETURNED type)
  itemsNotReturned: text('items_not_returned'),

  // Scheduling fields (for RETURNED type - equipment return dropoff)
  scheduledDate: timestamp('scheduled_date'),
  scheduledTime: text('scheduled_time'), // e.g., "10:00 AM - 11:00 AM"
  schedulingNotes: text('scheduling_notes'),

  // Status
  status: text('status').$type<'PENDING' | 'SIGNED'>().default('PENDING'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const equipmentChecklistSchema = createInsertSchema(equipmentChecklists);
export const insertEquipmentChecklistSchema = createInsertSchema(equipmentChecklists).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Termination reminders tracking for equipment return
export const terminationReminders = pgTable('termination_reminders', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').references(() => users.id).notNull(),
  employeeName: text('employee_name').notNull(),
  employeeEmail: text('employee_email').notNull(),
  terminationDate: timestamp('termination_date').notNull(),
  equipmentChecklistId: text('equipment_checklist_id').references(() => equipmentChecklists.id),  // Link to the equipment return checklist
  formSentAt: timestamp('form_sent_at'),
  reminderSentAt: timestamp('reminder_sent_at'),
  alertSentAt: timestamp('alert_sent_at'),  // 15-day alert sent
  weekReminderSentAt: timestamp('week_reminder_sent_at'),  // 7-day no-schedule reminder
  thirtyDayReminderSentAt: timestamp('thirty_day_reminder_sent_at'),  // 30-day no-return reminder
  itemsReturned: boolean('items_returned').default(false),
  resolvedAt: timestamp('resolved_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const terminationReminderSchema = createInsertSchema(terminationReminders);
export const insertTerminationReminderSchema = createInsertSchema(terminationReminders).omit({
  id: true,
  createdAt: true,
});

// Equipment Checklist Relations
export const equipmentChecklistsRelations = relations(equipmentChecklists, ({ one }) => ({
  employee: one(users, {
    fields: [equipmentChecklists.employeeId],
    references: [users.id]
  })
}));

export const terminationRemindersRelations = relations(terminationReminders, ({ one }) => ({
  employee: one(users, {
    fields: [terminationReminders.employeeId],
    references: [users.id]
  })
}));

// ============================================
// Equipment Agreements (Onboarding - New Hire Equipment Sign-off)
// ============================================
export const equipmentAgreements = pgTable('equipment_agreements', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').references(() => users.id),
  employeeName: text('employee_name').notNull(),
  employeeEmail: text('employee_email').notNull(),
  employeeRole: text('employee_role'),

  // Start date for locking (employee can view but not sign until this date)
  employeeStartDate: text('employee_start_date'),  // Format: YYYY-MM-DD

  // Public form access (no login required)
  accessToken: text('access_token').notNull().unique(),
  tokenExpiry: timestamp('token_expiry'),

  // Equipment items (JSON array - HR can customize per role)
  // Format: [{name: string, quantity: number, received: boolean}]
  items: text('items').notNull(),

  // Signature
  signatureData: text('signature_data'),  // Base64 PNG
  signedAt: timestamp('signed_at'),
  signatureIp: text('signature_ip'),

  // Status
  status: text('status').$type<'PENDING' | 'SIGNED'>().default('PENDING'),

  // Tracking
  sentBy: text('sent_by').references(() => users.id),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const equipmentAgreementSchema = createInsertSchema(equipmentAgreements);
export const insertEquipmentAgreementSchema = createInsertSchema(equipmentAgreements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const equipmentAgreementsRelations = relations(equipmentAgreements, ({ one }) => ({
  employee: one(users, {
    fields: [equipmentAgreements.employeeId],
    references: [users.id]
  }),
  sentByUser: one(users, {
    fields: [equipmentAgreements.sentBy],
    references: [users.id]
  })
}));

// ============================================
// Role Equipment Defaults (Default equipment list per role)
// ============================================
export const roleEquipmentDefaults = pgTable('role_equipment_defaults', {
  id: text('id').primaryKey(),
  role: text('role').notNull().unique(), // SALES_REP, FIELD_TECH, EMPLOYEE, etc.
  // Format: [{name: string, quantity: number}]
  items: text('items').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const roleEquipmentDefaultsSchema = createInsertSchema(roleEquipmentDefaults);
export const insertRoleEquipmentDefaultsSchema = createInsertSchema(roleEquipmentDefaults).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Insert types


// Create types
export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type PtoRequest = typeof ptoRequests.$inferSelect;

export type Candidate = typeof candidates.$inferSelect;
export type CandidateNote = typeof candidateNotes.$inferSelect;
export type EmployeeNote = typeof employeeNotes.$inferSelect;
export type Interview = typeof interviews.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type EmployeeReview = typeof employeeReviews.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type CompanySettings = typeof companySettings.$inferSelect;
export type HrAgentConfig = typeof hrAgentConfigs.$inferSelect;
export type HrAgentLog = typeof hrAgentLogs.$inferSelect;
export type JobPosting = typeof jobPostings.$inferSelect;
export type CandidateSource = typeof candidateSources.$inferSelect;
export type InterviewAvailability = typeof interviewAvailability.$inferSelect;
export type InterviewPanelMember = typeof interviewPanelMembers.$inferSelect;

// Advanced feature types
export type OnboardingWorkflow = typeof onboardingWorkflows.$inferSelect;
export type OnboardingStep = typeof onboardingSteps.$inferSelect;
export type PerformanceTemplate = typeof performanceTemplates.$inferSelect;
export type AutomatedReview = typeof automatedReviews.$inferSelect;
export type AnalyticsReport = typeof analyticsReports.$inferSelect;
export type ReportHistory = typeof reportHistory.$inferSelect;

// Document management types
export type DocumentVersion = typeof documentVersions.$inferSelect;
export type DocumentAccessLog = typeof documentAccessLogs.$inferSelect;
export type DocumentAcknowledgment = typeof documentAcknowledgments.$inferSelect;

// Phase 3 Enhanced Communication types
export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type CampaignStep = typeof campaignSteps.$inferSelect;
export type CampaignRecipient = typeof campaignRecipients.$inferSelect;
export type EmailTracking = typeof emailTracking.$inferSelect;
export type SmsMessage = typeof smsMessages.$inferSelect;
export type CommunicationPreference = typeof communicationPreferences.$inferSelect;
export type AiEmailGeneration = typeof aiEmailGenerations.$inferSelect;

// Phase 5 AI Enhancement types
export type AiModelPerformance = typeof aiModelPerformance.$inferSelect;
export type SalaryBenchmark = typeof salaryBenchmarks.$inferSelect;
export type InterviewQuestionBank = typeof interviewQuestionBank.$inferSelect;

// Tools Management types
export type ToolInventory = typeof toolInventory.$inferSelect;
export type ToolAssignment = typeof toolAssignments.$inferSelect;
export type ToolSignature = typeof toolSignatures.$inferSelect;
export type InventoryAlert = typeof inventoryAlerts.$inferSelect;
export type WelcomePackBundle = typeof welcomePackBundles.$inferSelect;
export type BundleItem = typeof bundleItems.$inferSelect;
export type BundleAssignment = typeof bundleAssignments.$inferSelect;
export type BundleAssignmentItem = typeof bundleAssignmentItems.$inferSelect;

// Equipment Checklist types
export type EquipmentChecklist = typeof equipmentChecklists.$inferSelect;
export type TerminationReminder = typeof terminationReminders.$inferSelect;
export type EquipmentAgreement = typeof equipmentAgreements.$inferSelect;
export type RoleEquipmentDefault = typeof roleEquipmentDefaults.$inferSelect;


export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type InsertPtoRequest = z.infer<typeof insertPtoRequestSchema>;

export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type InsertCandidateNote = z.infer<typeof insertCandidateNoteSchema>;
export type InsertEmployeeNote = z.infer<typeof insertEmployeeNoteSchema>;
export type InsertInterview = z.infer<typeof insertInterviewSchema>;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type InsertEmployeeReview = z.infer<typeof insertEmployeeReviewSchema>;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;
export type InsertHrAgentConfig = z.infer<typeof insertHrAgentConfigSchema>;
export type InsertHrAgentLog = z.infer<typeof insertHrAgentLogSchema>;
export type InsertJobPosting = z.infer<typeof insertJobPostingSchema>;
export type InsertCandidateSource = z.infer<typeof insertCandidateSourceSchema>;
export type InsertInterviewAvailability = z.infer<typeof insertInterviewAvailabilitySchema>;
export type InsertInterviewPanelMember = z.infer<typeof insertInterviewPanelMemberSchema>;

// Advanced feature insert types
export type InsertOnboardingWorkflow = z.infer<typeof insertOnboardingWorkflowSchema>;
export type InsertOnboardingStep = z.infer<typeof insertOnboardingStepSchema>;
export type InsertPerformanceTemplate = z.infer<typeof insertPerformanceTemplateSchema>;
export type InsertAutomatedReview = z.infer<typeof insertAutomatedReviewSchema>;
export type InsertAnalyticsReport = z.infer<typeof insertAnalyticsReportSchema>;
export type InsertReportHistory = z.infer<typeof insertReportHistorySchema>;

// Document management insert types
export type InsertDocumentVersion = z.infer<typeof insertDocumentVersionSchema>;
export type InsertDocumentAccessLog = z.infer<typeof insertDocumentAccessLogSchema>;
export type InsertDocumentAcknowledgment = z.infer<typeof insertDocumentAcknowledgmentSchema>;

// Phase 3 Enhanced Communication insert types
export type InsertEmailCampaign = z.infer<typeof insertEmailCampaignSchema>;
export type InsertCampaignStep = z.infer<typeof insertCampaignStepSchema>;
export type InsertCampaignRecipient = z.infer<typeof insertCampaignRecipientSchema>;
export type InsertEmailTracking = z.infer<typeof insertEmailTrackingSchema>;
export type InsertSmsMessage = z.infer<typeof insertSmsMessageSchema>;
export type InsertCommunicationPreference = z.infer<typeof insertCommunicationPreferenceSchema>;
export type InsertAiEmailGeneration = z.infer<typeof insertAiEmailGenerationSchema>;

// Tools Management insert types
export type InsertToolInventory = z.infer<typeof insertToolInventorySchema>;
export type InsertToolAssignment = z.infer<typeof insertToolAssignmentSchema>;
export type InsertToolSignature = z.infer<typeof insertToolSignatureSchema>;
export type InsertInventoryAlert = z.infer<typeof insertInventoryAlertSchema>;
export type InsertWelcomePackBundle = z.infer<typeof insertWelcomePackBundleSchema>;
export type InsertBundleItem = z.infer<typeof insertBundleItemSchema>;
export type InsertBundleAssignment = z.infer<typeof insertBundleAssignmentSchema>;
export type InsertBundleAssignmentItem = z.infer<typeof insertBundleAssignmentItemSchema>;

// Equipment Checklist insert types
export type InsertEquipmentChecklist = z.infer<typeof insertEquipmentChecklistSchema>;
export type InsertTerminationReminder = z.infer<typeof insertTerminationReminderSchema>;
export type InsertEquipmentAgreement = z.infer<typeof insertEquipmentAgreementSchema>;
export type InsertRoleEquipmentDefault = z.infer<typeof insertRoleEquipmentDefaultsSchema>;

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['TRUE_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'TERRITORY_SALES_MANAGER', 'MANAGER', 'EMPLOYEE', 'CONTRACTOR', 'SALES_REP', 'FIELD_TECH', 'SOURCER']),
  employmentType: z.enum(['W2', '1099', 'CONTRACTOR', 'SUB_CONTRACTOR']),
  department: z.string().min(1),
  position: z.string().min(1),
  hireDate: z.string(),
  phone: z.string().optional(),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  shirtSize: z.enum(['S', 'M', 'L', 'XL', 'XXL', '3X']).optional(),
});

export type LoginData = z.infer<typeof loginSchema>;
export type RegisterData = z.infer<typeof registerSchema>;

// Database Relations
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  ptoRequests: many(ptoRequests),
  assignedTasks: many(tasks, { relationName: 'assignedTasks' }),
  createdTasks: many(tasks, { relationName: 'createdTasks' }),
  employeeReviews: many(employeeReviews, { relationName: 'employeeReviews' }),
  reviewerReviews: many(employeeReviews, { relationName: 'reviewerReviews' }),
  candidateNotes: many(candidateNotes),
  interviews: many(interviews),
  documents: many(documents),
  onboardingWorkflows: many(onboardingWorkflows),
  automatedReviews: many(automatedReviews),
  performanceTemplates: many(performanceTemplates),
  toolAssignments: many(toolAssignments, { relationName: 'employeeAssignments' }),
  assignedTools: many(toolAssignments, { relationName: 'assignerAssignments' }),
  toolSignatures: many(toolSignatures)
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id]
  })
}));

export const ptoRequestsRelations = relations(ptoRequests, ({ one }) => ({
  employee: one(users, {
    fields: [ptoRequests.employeeId],
    references: [users.id]
  }),
  reviewer: one(users, {
    fields: [ptoRequests.reviewedBy],
    references: [users.id]
  })
}));

export const candidatesRelations = relations(candidates, ({ many, one }) => ({
  notes: many(candidateNotes),
  interviews: many(interviews),
  assignedToUser: one(users, {
    fields: [candidates.assignedTo],
    references: [users.id]
  })
}));

export const candidateNotesRelations = relations(candidateNotes, ({ one }) => ({
  candidate: one(candidates, {
    fields: [candidateNotes.candidateId],
    references: [candidates.id]
  }),
  author: one(users, {
    fields: [candidateNotes.authorId],
    references: [users.id]
  })
}));

export const interviewsRelations = relations(interviews, ({ one, many }) => ({
  candidate: one(candidates, {
    fields: [interviews.candidateId],
    references: [candidates.id]
  }),
  interviewer: one(users, {
    fields: [interviews.interviewerId],
    references: [users.id]
  }),
  feedback: many(interviewFeedback),
  reminders: many(interviewReminders)
}));

export const interviewFeedbackRelations = relations(interviewFeedback, ({ one }) => ({
  interview: one(interviews, {
    fields: [interviewFeedback.interviewId],
    references: [interviews.id]
  }),
  interviewer: one(users, {
    fields: [interviewFeedback.interviewerId],
    references: [users.id]
  })
}));

export const interviewRemindersRelations = relations(interviewReminders, ({ one }) => ({
  interview: one(interviews, {
    fields: [interviewReminders.interviewId],
    references: [interviews.id]
  })
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [documents.createdBy],
    references: [users.id]
  }),
  approvedBy: one(users, {
    fields: [documents.approvedBy],
    references: [users.id]
  }),
  versions: many(documentVersions),
  accessLogs: many(documentAccessLogs),
  acknowledgments: many(documentAcknowledgments)
}));

export const documentVersionsRelations = relations(documentVersions, ({ one }) => ({
  document: one(documents, {
    fields: [documentVersions.documentId],
    references: [documents.id]
  }),
  createdBy: one(users, {
    fields: [documentVersions.createdBy],
    references: [users.id]
  })
}));

export const documentAccessLogsRelations = relations(documentAccessLogs, ({ one }) => ({
  document: one(documents, {
    fields: [documentAccessLogs.documentId],
    references: [documents.id]
  }),
  user: one(users, {
    fields: [documentAccessLogs.userId],
    references: [users.id]
  })
}));

export const documentAcknowledgmentsRelations = relations(documentAcknowledgments, ({ one }) => ({
  document: one(documents, {
    fields: [documentAcknowledgments.documentId],
    references: [documents.id]
  }),
  employee: one(users, {
    fields: [documentAcknowledgments.employeeId],
    references: [users.id]
  })
}));

export const employeeReviewsRelations = relations(employeeReviews, ({ one }) => ({
  reviewee: one(users, {
    fields: [employeeReviews.revieweeId],
    references: [users.id],
    relationName: 'employeeReviews'
  }),
  reviewer: one(users, {
    fields: [employeeReviews.reviewerId],
    references: [users.id],
    relationName: 'reviewerReviews'
  })
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  assignedToUser: one(users, {
    fields: [tasks.assignedTo],
    references: [users.id],
    relationName: 'assignedTasks'
  }),
  assignedByUser: one(users, {
    fields: [tasks.assignedBy],
    references: [users.id],
    relationName: 'createdTasks'
  })
}));

export const onboardingWorkflowsRelations = relations(onboardingWorkflows, ({ one, many }) => ({
  employee: one(users, {
    fields: [onboardingWorkflows.employeeId],
    references: [users.id]
  }),
  assignedToUser: one(users, {
    fields: [onboardingWorkflows.assignedTo],
    references: [users.id]
  }),
  steps: many(onboardingSteps)
}));

export const onboardingStepsRelations = relations(onboardingSteps, ({ one }) => ({
  workflow: one(onboardingWorkflows, {
    fields: [onboardingSteps.workflowId],
    references: [onboardingWorkflows.id]
  }),
  assignedToUser: one(users, {
    fields: [onboardingSteps.assignedTo],
    references: [users.id]
  })
}));

export const performanceTemplatesRelations = relations(performanceTemplates, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [performanceTemplates.createdBy],
    references: [users.id]
  }),
  automatedReviews: many(automatedReviews)
}));

export const automatedReviewsRelations = relations(automatedReviews, ({ one }) => ({
  template: one(performanceTemplates, {
    fields: [automatedReviews.templateId],
    references: [performanceTemplates.id]
  }),
  employee: one(users, {
    fields: [automatedReviews.employeeId],
    references: [users.id]
  }),
  reviewer: one(users, {
    fields: [automatedReviews.reviewerId],
    references: [users.id]
  }),
  generatedReview: one(employeeReviews, {
    fields: [automatedReviews.generatedReviewId],
    references: [employeeReviews.id]
  })
}));

export const analyticsReportsRelations = relations(analyticsReports, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [analyticsReports.createdBy],
    references: [users.id]
  }),
  history: many(reportHistory)
}));

export const reportHistoryRelations = relations(reportHistory, ({ one }) => ({
  report: one(analyticsReports, {
    fields: [reportHistory.reportId],
    references: [analyticsReports.id]
  }),
  generatedBy: one(users, {
    fields: [reportHistory.generatedBy],
    references: [users.id]
  })
}));

export const emailLogsRelations = relations(emailLogs, ({ one }) => ({
  candidate: one(candidates, {
    fields: [emailLogs.candidateId],
    references: [candidates.id]
  }),
  interview: one(interviews, {
    fields: [emailLogs.interviewId],
    references: [interviews.id]
  })
}));

// Tools Management Relations
export const toolInventoryRelations = relations(toolInventory, ({ many, one }) => ({
  assignments: many(toolAssignments),
  createdByUser: one(users, {
    fields: [toolInventory.createdBy],
    references: [users.id]
  })
}));

export const toolAssignmentsRelations = relations(toolAssignments, ({ one, many }) => ({
  tool: one(toolInventory, {
    fields: [toolAssignments.toolId],
    references: [toolInventory.id]
  }),
  employee: one(users, {
    fields: [toolAssignments.employeeId],
    references: [users.id],
    relationName: 'employeeAssignments'
  }),
  assignedByUser: one(users, {
    fields: [toolAssignments.assignedBy],
    references: [users.id],
    relationName: 'assignerAssignments'
  }),
  signatures: many(toolSignatures)
}));

export const toolSignaturesRelations = relations(toolSignatures, ({ one }) => ({
  assignment: one(toolAssignments, {
    fields: [toolSignatures.assignmentId],
    references: [toolAssignments.id]
  }),
  employee: one(users, {
    fields: [toolSignatures.employeeId],
    references: [users.id]
  })
}));

// Workflow Automation Tables (Phase 4)
export const workflows = pgTable('workflows', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').$type<'RECRUITMENT' | 'ONBOARDING' | 'PERFORMANCE' | 'DOCUMENT' | 'CUSTOM'>().notNull(),
  trigger: text('trigger').$type<'MANUAL' | 'SCHEDULED' | 'EVENT' | 'CONDITION'>().notNull(),
  triggerConfig: text('trigger_config'), // JSON configuration for trigger
  status: text('status').$type<'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED'>().notNull().default('DRAFT'),
  isTemplate: boolean('is_template').notNull().default(false),
  createdBy: text('created_by').notNull(),
  lastExecuted: timestamp('last_executed'),
  executionCount: integer('execution_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const workflowSchema = createInsertSchema(workflows);
export const insertWorkflowSchema = createInsertSchema(workflows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const workflowSteps = pgTable('workflow_steps', {
  id: text('id').primaryKey(),
  workflowId: text('workflow_id').notNull(),
  stepNumber: integer('step_number').notNull(),
  name: text('name').notNull(),
  type: text('type').$type<'ACTION' | 'CONDITION' | 'DELAY' | 'NOTIFICATION' | 'APPROVAL' | 'INTEGRATION'>().notNull(),
  actionType: text('action_type'), // Specific action like 'SEND_EMAIL', 'UPDATE_STATUS', etc.
  config: text('config').notNull(), // JSON configuration for the step
  conditions: text('conditions'), // JSON array of conditions
  nextStepOnSuccess: text('next_step_on_success'),
  nextStepOnFailure: text('next_step_on_failure'),
  retryAttempts: integer('retry_attempts').notNull().default(0),
  retryDelay: integer('retry_delay'), // in seconds
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const workflowStepSchema = createInsertSchema(workflowSteps);
export const insertWorkflowStepSchema = createInsertSchema(workflowSteps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const workflowExecutions = pgTable('workflow_executions', {
  id: text('id').primaryKey(),
  workflowId: text('workflow_id').notNull(),
  status: text('status').$type<'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'>().notNull(),
  triggeredBy: text('triggered_by'), // User ID or 'SYSTEM'
  triggerSource: text('trigger_source'), // What triggered this execution
  currentStep: text('current_step'),
  context: text('context'), // JSON context data for the execution
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  duration: integer('duration'), // in milliseconds
});

export const workflowExecutionSchema = createInsertSchema(workflowExecutions);
export const insertWorkflowExecutionSchema = createInsertSchema(workflowExecutions).omit({
  id: true,
  startedAt: true,
});

export const workflowStepLogs = pgTable('workflow_step_logs', {
  id: text('id').primaryKey(),
  executionId: text('execution_id').notNull(),
  stepId: text('step_id').notNull(),
  status: text('status').$type<'STARTED' | 'COMPLETED' | 'FAILED' | 'SKIPPED'>().notNull(),
  input: text('input'), // JSON input data
  output: text('output'), // JSON output data
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').notNull().default(0),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  duration: integer('duration'), // in milliseconds
});

export const workflowStepLogSchema = createInsertSchema(workflowStepLogs);
export const insertWorkflowStepLogSchema = createInsertSchema(workflowStepLogs).omit({
  id: true,
  startedAt: true,
});

// Workflow Templates for common HR processes
export const workflowTemplates = pgTable('workflow_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').$type<'RECRUITMENT' | 'ONBOARDING' | 'OFFBOARDING' | 'PERFORMANCE' | 'COMPLIANCE'>().notNull(),
  description: text('description').notNull(),
  thumbnail: text('thumbnail'), // URL to template preview image
  config: text('config').notNull(), // JSON template configuration
  isActive: boolean('is_active').notNull().default(true),
  usageCount: integer('usage_count').notNull().default(0),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const workflowTemplateSchema = createInsertSchema(workflowTemplates);
export const insertWorkflowTemplateSchema = createInsertSchema(workflowTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// HR Assignments - Track who is responsible for candidates and employees
export const hrAssignments = pgTable('hr_assignments', {
  id: text('id').primaryKey(),
  type: text('type').$type<'CANDIDATE' | 'EMPLOYEE'>().notNull(),
  assigneeId: text('assignee_id').notNull(), // The person being assigned (candidate or employee)
  hrMemberId: text('hr_member_id').notNull(), // The HR member responsible
  assignedBy: text('assigned_by').notNull(), // Manager/Admin who made the assignment
  role: text('role').$type<'PRIMARY' | 'SECONDARY' | 'BACKUP'>().notNull().default('PRIMARY'),
  status: text('status').$type<'ACTIVE' | 'PAUSED' | 'COMPLETED'>().notNull().default('ACTIVE'),
  startDate: timestamp('start_date').defaultNow().notNull(),
  endDate: timestamp('end_date'),
  notes: text('notes'),
  // Performance tracking
  responseTime: integer('response_time'), // Average response time in hours
  tasksCompleted: integer('tasks_completed').default(0),
  satisfactionScore: real('satisfaction_score'), // 0-5 rating
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const hrAssignmentSchema = createInsertSchema(hrAssignments);
export const insertHrAssignmentSchema = createInsertSchema(hrAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// HR Assignment Performance Metrics
export const hrPerformanceMetrics = pgTable('hr_performance_metrics', {
  id: text('id').primaryKey(),
  hrMemberId: text('hr_member_id').notNull(),
  period: text('period').notNull(), // e.g., "2025-Q1"
  candidatesAssigned: integer('candidates_assigned').default(0),
  candidatesHired: integer('candidates_hired').default(0),
  avgTimeToHire: integer('avg_time_to_hire'), // in days
  avgTimeToRespond: integer('avg_time_to_respond'), // in hours
  employeesManaged: integer('employees_managed').default(0),
  onboardingCompleted: integer('onboarding_completed').default(0),
  avgOnboardingTime: integer('avg_onboarding_time'), // in days
  satisfactionScore: real('satisfaction_score'), // Average rating
  weakPoints: text('weak_points'), // JSON array of identified weak points
  strengths: text('strengths'), // JSON array of identified strengths
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const hrPerformanceMetricSchema = createInsertSchema(hrPerformanceMetrics);
export const insertHrPerformanceMetricSchema = createInsertSchema(hrPerformanceMetrics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Workflow Relations
export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [workflows.createdBy],
    references: [users.id]
  }),
  steps: many(workflowSteps),
  executions: many(workflowExecutions)
}));

export const workflowStepsRelations = relations(workflowSteps, ({ one, many }) => ({
  workflow: one(workflows, {
    fields: [workflowSteps.workflowId],
    references: [workflows.id]
  }),
  logs: many(workflowStepLogs)
}));

export const workflowExecutionsRelations = relations(workflowExecutions, ({ one, many }) => ({
  workflow: one(workflows, {
    fields: [workflowExecutions.workflowId],
    references: [workflows.id]
  }),
  triggeredByUser: one(users, {
    fields: [workflowExecutions.triggeredBy],
    references: [users.id]
  }),
  stepLogs: many(workflowStepLogs)
}));

export const workflowStepLogsRelations = relations(workflowStepLogs, ({ one }) => ({
  execution: one(workflowExecutions, {
    fields: [workflowStepLogs.executionId],
    references: [workflowExecutions.id]
  }),
  step: one(workflowSteps, {
    fields: [workflowStepLogs.stepId],
    references: [workflowSteps.id]
  })
}));

export const workflowTemplatesRelations = relations(workflowTemplates, ({ one }) => ({
  createdByUser: one(users, {
    fields: [workflowTemplates.createdBy],
    references: [users.id]
  })
}));

// Attendance Tracking - NEW
export const attendanceSessions = pgTable('attendance_sessions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdByUserId: text('created_by_user_id').notNull(),
  location: text('location').$type<'RICHMOND' | 'PHILLY' | 'DMV'>().notNull(),
  status: text('status').$type<'ACTIVE' | 'CLOSED'>().notNull().default('ACTIVE'),
  qrToken: text('qr_token').notNull().unique(),
  startsAt: timestamp('starts_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const attendanceSessionSchema = createInsertSchema(attendanceSessions);
export const insertAttendanceSessionSchema = createInsertSchema(attendanceSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const attendanceCheckIns = pgTable('attendance_check_ins', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  userId: text('user_id'), // nullable for guests
  name: text('name').notNull(), // for display
  email: text('email'), // optional email
  location: text('location').$type<'RICHMOND' | 'PHILLY' | 'DMV'>().notNull(),
  checkedInAt: timestamp('checked_in_at').defaultNow().notNull(),
  userAgent: text('user_agent'),
  ipHash: text('ip_hash'), // hashed for privacy
  latLng: text('lat_lng'), // optional geolocation
});

export const attendanceCheckInSchema = createInsertSchema(attendanceCheckIns);
export const insertAttendanceCheckInSchema = createInsertSchema(attendanceCheckIns).omit({
  id: true,
  checkedInAt: true,
});

// Attendance Relations
export const attendanceSessionsRelations = relations(attendanceSessions, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [attendanceSessions.createdByUserId],
    references: [users.id]
  }),
  checkIns: many(attendanceCheckIns)
}));

export const attendanceCheckInsRelations = relations(attendanceCheckIns, ({ one }) => ({
  session: one(attendanceSessions, {
    fields: [attendanceCheckIns.sessionId],
    references: [attendanceSessions.id]
  }),
  user: one(users, {
    fields: [attendanceCheckIns.userId],
    references: [users.id]
  })
}));

// Susan AI Chat Sessions - for persisting conversation history
export const susanChatSessions = pgTable('susan_chat_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  messages: text('messages').notNull().default('[]'), // JSON array of messages
  title: text('title'), // Optional title for the conversation
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const susanChatSessionSchema = createInsertSchema(susanChatSessions);
export const insertSusanChatSessionSchema = createInsertSchema(susanChatSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Export Workflow types
export type Workflow = typeof workflows.$inferSelect;
export type WorkflowStep = typeof workflowSteps.$inferSelect;
export type WorkflowExecution = typeof workflowExecutions.$inferSelect;
export type WorkflowStepLog = typeof workflowStepLogs.$inferSelect;
export type WorkflowTemplate = typeof workflowTemplates.$inferSelect;

// Export new table types
export type Territory = typeof territories.$inferSelect;
export type InsertTerritory = typeof territories.$inferInsert;
export type CompanyPtoPolicy = typeof companyPtoPolicy.$inferSelect;
export type InsertCompanyPtoPolicy = typeof companyPtoPolicy.$inferInsert;
export type PtoPolicy = typeof ptoPolicies.$inferSelect;
export type InsertPtoPolicy = z.infer<typeof insertPtoPolicySchema>;
export type DepartmentPtoSetting = typeof departmentPtoSettings.$inferSelect;
export type InsertDepartmentPtoSetting = z.infer<typeof insertDepartmentPtoSettingSchema>;
export type CoiDocument = typeof coiDocuments.$inferSelect;
export type InsertCoiDocument = typeof coiDocuments.$inferInsert;
export type EmployeeAssignment = typeof employeeAssignments.$inferSelect;
export type InsertEmployeeAssignment = typeof employeeAssignments.$inferInsert;
export type ContractTemplate = typeof contractTemplates.$inferSelect;
export type InsertContractTemplate = typeof contractTemplates.$inferInsert;
export type EmployeeContract = typeof employeeContracts.$inferSelect;
export type InsertEmployeeContract = typeof employeeContracts.$inferInsert;
export type AttendanceSession = typeof attendanceSessions.$inferSelect;
export type InsertAttendanceSession = typeof attendanceSessions.$inferInsert;
export type AttendanceCheckIn = typeof attendanceCheckIns.$inferSelect;
export type InsertAttendanceCheckIn = typeof attendanceCheckIns.$inferInsert;
export type SusanChatSession = typeof susanChatSessions.$inferSelect;
export type InsertSusanChatSession = z.infer<typeof insertSusanChatSessionSchema>;
