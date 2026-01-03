import {
  User, Session, PtoRequest,
  Candidate, CandidateNote, EmployeeNote, Interview, Document, EmployeeReview, Task, CompanySettings,
  OnboardingWorkflow, OnboardingStep,
  PerformanceTemplate, AutomatedReview, AnalyticsReport, ReportHistory,
  EmailTemplate, EmailLog, JobImportLog,
  HrAgentConfig, HrAgentLog,
  JobPosting, CandidateSource,
  InterviewAvailability, InterviewPanelMember,
  InsertUser, InsertSession, InsertPtoRequest,
  InsertCandidate, InsertCandidateNote, InsertEmployeeNote, InsertInterview,
  InsertDocument, InsertEmployeeReview, InsertTask, InsertCompanySettings,
  InsertOnboardingWorkflow, InsertOnboardingStep,
  InsertPerformanceTemplate, InsertAutomatedReview, InsertAnalyticsReport, InsertReportHistory,
  InsertEmailTemplate, InsertEmailLog, InsertJobImportLog,
  InsertHrAgentConfig, InsertHrAgentLog,
  InsertJobPosting, InsertCandidateSource,
  InsertInterviewAvailability, InsertInterviewPanelMember,
  InterviewFeedback, InsertInterviewFeedback,
  InterviewReminder, InsertInterviewReminder,
  DocumentVersion, DocumentAccessLog, DocumentAcknowledgment,
  InsertDocumentVersion, InsertDocumentAccessLog, InsertDocumentAcknowledgment,
  EmailCampaign, CampaignStep, CampaignRecipient, EmailTracking,
  SmsMessage, CommunicationPreference, AiEmailGeneration,
  InsertEmailCampaign, InsertCampaignStep, InsertCampaignRecipient,
  InsertEmailTracking, InsertSmsMessage, InsertCommunicationPreference,
  InsertAiEmailGeneration,
  AiModelPerformance, SalaryBenchmark, InterviewQuestionBank,
  insertAiModelPerformanceSchema, insertSalaryBenchmarkSchema, insertInterviewQuestionBankSchema,
  aiModelPerformance, salaryBenchmarks, interviewQuestionBank,
  users, sessions, ptoRequests,
  candidates, candidateNotes, employeeNotes, interviews, documents, employeeReviews, tasks, companySettings,
  onboardingWorkflows, onboardingSteps,
  performanceTemplates, automatedReviews, analyticsReports, reportHistory,
  emailTemplates, emailLogs, jobImportLogs, aiCriteria, interviewFeedback, interviewReminders,
  aiCriteriaSchema, insertAiCriteriaSchema,
  documentVersions, documentAccessLogs, documentAcknowledgments,
  hrAgentConfigs, hrAgentLogs,
  jobPostings, candidateSources,
  interviewAvailability, interviewPanelMembers,
  emailCampaigns, campaignSteps, campaignRecipients, emailTracking,
  smsMessages, communicationPreferences, aiEmailGenerations,
  workflows, workflowSteps, workflowExecutions, workflowStepLogs, workflowTemplates,
  // New imports
  Territory, InsertTerritory, territories,
  PtoPolicy, InsertPtoPolicy, ptoPolicies,
  DepartmentPtoSetting, InsertDepartmentPtoSetting, departmentPtoSettings,
  CompanyPtoPolicy, InsertCompanyPtoPolicy, companyPtoPolicy,
  CoiDocument, InsertCoiDocument, coiDocuments,
  EmployeeAssignment, InsertEmployeeAssignment, employeeAssignments,
  ContractTemplate, InsertContractTemplate, contractTemplates,
  EmployeeContract, InsertEmployeeContract, employeeContracts,
  // Tools and inventory management
  ToolInventory, InsertToolInventory, toolInventory,
  ToolAssignment, InsertToolAssignment, toolAssignments,
  InventoryAlert, InsertInventoryAlert, inventoryAlerts,
  WelcomePackBundle, InsertWelcomePackBundle, welcomePackBundles,
  BundleItem, InsertBundleItem, bundleItems,
  BundleAssignment, InsertBundleAssignment, bundleAssignments,
  BundleAssignmentItem, InsertBundleAssignmentItem, bundleAssignmentItems,
  EquipmentReceipt, InsertEquipmentReceipt, equipmentReceipts,
  EquipmentReceiptToken, InsertEquipmentReceiptToken, equipmentReceiptTokens,
  // Attendance tracking
  AttendanceSession, InsertAttendanceSession, attendanceSessions,
  AttendanceCheckIn, InsertAttendanceCheckIn, attendanceCheckIns,
  // Equipment Checklist and Termination
  equipmentChecklists, terminationReminders,
  InsertEquipmentChecklist, InsertTerminationReminder,
  // Equipment Agreements
  equipmentAgreements, roleEquipmentDefaults,
  EquipmentAgreement, RoleEquipmentDefault,
  InsertEquipmentAgreement, InsertRoleEquipmentDefault,
  // Susan AI Chat Sessions
  SusanChatSession, InsertSusanChatSession, susanChatSessions,
  // HR Assignments and Performance Metrics
  hrAssignments, hrPerformanceMetrics,
  hrAssignmentSchema, insertHrAssignmentSchema,
  hrPerformanceMetricSchema, insertHrPerformanceMetricSchema,
  // Super Admin Control Center
  ApiMetric, InsertApiMetric, apiMetrics,
  FeatureToggle, InsertFeatureToggle, featureToggles,
  SystemAuditLog, InsertSystemAuditLog, systemAuditLogs,
  ApiAlert, InsertApiAlert, apiAlerts,
  SqlQueryHistoryEntry, InsertSqlQueryHistory, sqlQueryHistory,
  // Onboarding Templates
  OnboardingTemplate, InsertOnboardingTemplate, onboardingTemplates,
  OnboardingInstance, InsertOnboardingInstance, onboardingInstances,
  // Notifications
  Notification, InsertNotification, notifications
} from '@shared/schema';
import { db } from './db';
import { eq, and, lt, inArray, or, sql, gte, lte, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// Type definitions for AI Criteria
type AiCriteria = typeof aiCriteria.$inferSelect;
type InsertAiCriteria = typeof aiCriteria.$inferInsert;

// Type definitions for HR Assignments
type HrAssignment = typeof hrAssignments.$inferSelect;
type InsertHrAssignment = typeof hrAssignments.$inferInsert;

// Type definitions for HR Performance Metrics
type HrPerformanceMetric = typeof hrPerformanceMetrics.$inferSelect;
type InsertHrPerformanceMetric = typeof hrPerformanceMetrics.$inferInsert;

export interface IStorage {
  // User management
  createUser(data: InsertUser): Promise<User>;
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  getUser(id: string): Promise<User | null>; // Alias for getUserById for backward compatibility
  updateUser(id: string, data: Partial<InsertUser>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  getUsersByRoles(roles: string[]): Promise<User[]>;

  // Session management
  createSession(data: InsertSession): Promise<Session>;
  getSessionByToken(token: string): Promise<Session | null>;
  deleteSession(id: string): Promise<void>;
  deleteExpiredSessions(): Promise<void>;

  // PTO Management
  createPtoRequest(data: InsertPtoRequest & { employeeId: string }): Promise<PtoRequest>;
  getPtoRequestById(id: string): Promise<PtoRequest | null>;
  getAllPtoRequests(): Promise<PtoRequest[]>;
  getPtoRequestsByEmployee(employeeId: string): Promise<PtoRequest[]>;
  getPendingPtoRequests(): Promise<PtoRequest[]>;
  updatePtoRequest(id: string, data: Partial<Omit<PtoRequest, 'id' | 'createdAt' | 'updatedAt'>>): Promise<PtoRequest>;
  deletePtoRequest(id: string): Promise<void>;

  // Candidate Management
  createCandidate(data: InsertCandidate): Promise<Candidate>;
  getCandidateById(id: string): Promise<Candidate | null>;
  getAllCandidates(): Promise<Candidate[]>;
  searchCandidatesByName(query: string): Promise<Candidate[]>;
  getRecentCandidates(limit?: number): Promise<Candidate[]>;
  updateCandidate(id: string, data: Partial<InsertCandidate>): Promise<Candidate>;
  deleteCandidate(id: string): Promise<void>;
  
  // Candidate Notes
  createCandidateNote(data: InsertCandidateNote): Promise<CandidateNote>;
  getCandidateNotesByCandidateId(candidateId: string): Promise<CandidateNote[]>;
  deleteCandidateNote(id: string): Promise<void>;

  // Employee Notes
  createEmployeeNote(data: InsertEmployeeNote): Promise<EmployeeNote>;
  getEmployeeNotesByEmployeeId(employeeId: string): Promise<EmployeeNote[]>;
  deleteEmployeeNote(id: string): Promise<void>;

  // Interview Management
  createInterview(data: InsertInterview): Promise<Interview>;
  getInterviewById(id: string): Promise<Interview | null>;
  getAllInterviews(): Promise<Interview[]>;
  getInterviewsByCandidate(candidateId: string): Promise<Interview[]>;
  getInterviewsByInterviewer(interviewerId: string): Promise<Interview[]>;
  updateInterview(id: string, data: Partial<InsertInterview>): Promise<Interview>;
  deleteInterview(id: string): Promise<void>;

  // Document Management
  createDocument(data: InsertDocument): Promise<Document>;
  getDocumentById(id: string): Promise<Document | null>;
  getAllDocuments(): Promise<Document[]>;
  updateDocument(id: string, data: Partial<InsertDocument>): Promise<Document>;
  deleteDocument(id: string): Promise<void>;

  // Document Acknowledgments
  createDocumentAcknowledgment(data: Omit<InsertDocumentAcknowledgment, 'id'>): Promise<DocumentAcknowledgment>;
  getDocumentAcknowledgment(documentId: string, employeeId: string): Promise<DocumentAcknowledgment | null>;
  getDocumentAcknowledgments(documentId: string): Promise<DocumentAcknowledgment[]>;
  getEmployeeAcknowledgments(employeeId: string): Promise<DocumentAcknowledgment[]>;

  // Employee Review Management
  createEmployeeReview(data: InsertEmployeeReview): Promise<EmployeeReview>;
  getEmployeeReviewById(id: string): Promise<EmployeeReview | null>;
  getAllEmployeeReviews(): Promise<EmployeeReview[]>;
  getEmployeeReviewsByEmployeeId(employeeId: string): Promise<EmployeeReview[]>;
  updateEmployeeReview(id: string, data: Partial<InsertEmployeeReview>): Promise<EmployeeReview>;
  deleteEmployeeReview(id: string): Promise<void>;

  // Task Management
  createTask(data: InsertTask): Promise<Task>;
  createOnboardingTask(data: {
    employeeId: string;
    title: string;
    description?: string;
    dueDate?: Date | string;
    status?: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'PENDING';
  }): Promise<Task>;
  getTaskById(id: string): Promise<Task | null>;
  getAllTasks(): Promise<Task[]>;
  getTasksByAssignee(assigneeId: string): Promise<Task[]>;
  updateTask(id: string, data: Partial<InsertTask>): Promise<Task>;
  deleteTask(id: string): Promise<void>;

  // Company Settings
  getCompanySettings(): Promise<CompanySettings | null>;
  updateCompanySettings(data: Partial<InsertCompanySettings>): Promise<CompanySettings>;

  // Get by employee helper
  getPtoRequestsByEmployeeId(employeeId: string): Promise<PtoRequest[]>;

  // HR Agent Management
  createHrAgentConfig(data: InsertHrAgentConfig): Promise<HrAgentConfig>;
  getHrAgentConfigById(id: string): Promise<HrAgentConfig | null>;
  getHrAgentConfigByName(name: string): Promise<HrAgentConfig | null>;
  getAllHrAgentConfigs(): Promise<HrAgentConfig[]>;
  updateHrAgentConfig(id: string, data: Partial<InsertHrAgentConfig>): Promise<HrAgentConfig>;
  
  // HR Agent Logs
  createHrAgentLog(data: InsertHrAgentLog): Promise<HrAgentLog>;
  getHrAgentLogsByAgent(agentName: string, limit?: number): Promise<HrAgentLog[]>;
  getAllHrAgentLogs(limit?: number): Promise<HrAgentLog[]>;
  
  // Job Postings
  createJobPosting(data: InsertJobPosting): Promise<JobPosting>;
  getJobPostingById(id: string): Promise<JobPosting | null>;
  getAllJobPostings(): Promise<JobPosting[]>;
  updateJobPosting(id: string, data: Partial<InsertJobPosting>): Promise<JobPosting>;
  deleteJobPosting(id: string): Promise<void>;
  
  // Candidate Sources
  createCandidateSource(data: InsertCandidateSource): Promise<CandidateSource>;
  getCandidateSourcesByCandidateId(candidateId: string): Promise<CandidateSource[]>;
  getCandidateSourcesByBatchId(batchId: string): Promise<CandidateSource[]>;
  
  // Job Import Logs
  createJobImportLog(data: InsertJobImportLog): Promise<JobImportLog>;
  getJobImportLogs(limit?: number): Promise<JobImportLog[]>;
  
  // Interview Availability
  createInterviewAvailability(data: InsertInterviewAvailability): Promise<InterviewAvailability>;
  getInterviewAvailabilityByInterviewer(interviewerId: string): Promise<InterviewAvailability[]>;
  updateInterviewAvailability(id: string, data: Partial<InsertInterviewAvailability>): Promise<InterviewAvailability>;
  deleteInterviewAvailability(id: string): Promise<void>;
  
  // Interview Panel Members
  createInterviewPanelMember(data: InsertInterviewPanelMember): Promise<InterviewPanelMember>;
  getInterviewPanelMembersByInterview(interviewId: string): Promise<InterviewPanelMember[]>;
  updateInterviewPanelMember(id: string, data: Partial<InsertInterviewPanelMember>): Promise<InterviewPanelMember>;
  deleteInterviewPanelMember(id: string): Promise<void>;
  
  // Phase 3: Email Campaign Management
  createEmailCampaign(data: InsertEmailCampaign): Promise<EmailCampaign>;
  getEmailCampaignById(id: string): Promise<EmailCampaign | null>;
  getAllEmailCampaigns(): Promise<EmailCampaign[]>;
  updateEmailCampaign(id: string, data: Partial<InsertEmailCampaign>): Promise<EmailCampaign>;
  deleteEmailCampaign(id: string): Promise<void>;
  
  // Campaign Steps
  createCampaignStep(data: InsertCampaignStep): Promise<CampaignStep>;
  getCampaignStepsByCampaignId(campaignId: string): Promise<CampaignStep[]>;
  updateCampaignStep(id: string, data: Partial<InsertCampaignStep>): Promise<CampaignStep>;
  deleteCampaignStep(id: string): Promise<void>;
  
  // Campaign Recipients
  createCampaignRecipient(data: InsertCampaignRecipient): Promise<CampaignRecipient>;
  getCampaignRecipientsByCampaignId(campaignId: string): Promise<CampaignRecipient[]>;
  updateCampaignRecipient(id: string, data: Partial<InsertCampaignRecipient>): Promise<CampaignRecipient>;
  
  // Email Tracking
  createEmailTracking(data: InsertEmailTracking): Promise<EmailTracking>;
  getEmailTrackingByMessageId(messageId: string): Promise<EmailTracking | null>;
  updateEmailTracking(id: string, data: Partial<InsertEmailTracking>): Promise<EmailTracking>;
  
  // SMS Messages
  createSmsMessage(data: InsertSmsMessage): Promise<SmsMessage>;
  getSmsMessageById(id: string): Promise<SmsMessage | null>;
  getAllSmsMessages(): Promise<SmsMessage[]>;
  updateSmsMessage(id: string, data: Partial<InsertSmsMessage>): Promise<SmsMessage>;
  
  // Communication Preferences
  createCommunicationPreference(data: InsertCommunicationPreference): Promise<CommunicationPreference>;
  getCommunicationPreferenceByCandidateId(candidateId: string): Promise<CommunicationPreference | null>;
  getAllCommunicationPreferences(): Promise<CommunicationPreference[]>;
  updateCommunicationPreference(id: string, data: Partial<InsertCommunicationPreference>): Promise<CommunicationPreference>;
  
  // AI Email Generations
  createAiEmailGeneration(data: InsertAiEmailGeneration): Promise<AiEmailGeneration>;
  getAiEmailGenerationsByCandidate(candidateId: string): Promise<AiEmailGeneration[]>;
  updateAiEmailGeneration(id: string, data: Partial<InsertAiEmailGeneration>): Promise<AiEmailGeneration>;
  
  // Phase 5: AI Enhancement Methods
  // AI Model Performance
  createAiModelPerformance(data: any): Promise<AiModelPerformance>;
  getAiModelPerformance(metricType: string): Promise<AiModelPerformance[]>;
  
  // Salary Benchmarks
  createSalaryBenchmark(data: any): Promise<SalaryBenchmark>;
  getSalaryBenchmarkByPosition(position: string, location: string): Promise<SalaryBenchmark | null>;
  getAllSalaryBenchmarks(): Promise<SalaryBenchmark[]>;
  updateSalaryBenchmark(id: string, data: any): Promise<SalaryBenchmark>;
  
  // Interview Question Bank
  createInterviewQuestion(data: any): Promise<InterviewQuestionBank>;
  getInterviewQuestionsByPosition(position: string, category?: string): Promise<InterviewQuestionBank[]>;
  updateInterviewQuestionUsage(id: string): Promise<void>;
  getAllInterviewQuestions(): Promise<InterviewQuestionBank[]>;
  
  // AI Criteria
  createAiCriteria(data: Omit<InsertAiCriteria, 'id' | 'createdAt' | 'updatedAt'>): Promise<AiCriteria>;
  getAiCriteriaById(id: string): Promise<AiCriteria | null>;
  getAllAiCriteria(): Promise<AiCriteria[]>;
  updateAiCriteria(id: string, data: Partial<Omit<InsertAiCriteria, 'id' | 'createdAt' | 'updatedAt'>>): Promise<AiCriteria>;
  deleteAiCriteria(id: string): Promise<void>;
  
  // Email Templates
  createEmailTemplate(data: any): Promise<EmailTemplate>;
  getEmailTemplateById(id: string): Promise<EmailTemplate | null>;
  getAllEmailTemplates(): Promise<EmailTemplate[]>;
  updateEmailTemplate(id: string, data: any): Promise<EmailTemplate | null>;
  deleteEmailTemplate(id: string): Promise<void>;
  
  // Email Logs
  createEmailLog(data: any): Promise<EmailLog>;
  getEmailLogsByCandidateId(candidateId: string): Promise<EmailLog[]>;
  
  // Workflows
  createWorkflow(data: any): Promise<any>;
  getWorkflowById(id: string): Promise<any | null>;
  getAllWorkflows(): Promise<any[]>;
  updateWorkflow(id: string, data: any): Promise<any>;
  deleteWorkflow(id: string): Promise<void>;
  
  // Workflow Steps
  createWorkflowStep(data: any): Promise<any>;
  getWorkflowStepsByWorkflowId(workflowId: string): Promise<any[]>;
  updateWorkflowStep(id: string, data: any): Promise<any>;
  deleteWorkflowStep(id: string): Promise<void>;
  
  // Workflow Executions
  createWorkflowExecution(data: any): Promise<string>;
  getWorkflowExecutionById(id: string): Promise<any | null>;
  updateWorkflowExecution(id: string, data: any): Promise<void>;
  
  // Workflow Step Executions
  createWorkflowStepExecution(data: any): Promise<void>;
  updateWorkflowStepExecution(stepId: string, data: any): Promise<void>;
  
  // Territory Management - NEW
  createTerritory(data: InsertTerritory): Promise<Territory>;
  getTerritoryById(id: string): Promise<Territory | null>;
  getAllTerritories(): Promise<Territory[]>;
  updateTerritory(id: string, data: Partial<InsertTerritory>): Promise<Territory>;
  deleteTerritory(id: string): Promise<void>;

  // Company PTO Policy Management - NEW
  getCompanyPtoPolicy(): Promise<CompanyPtoPolicy | null>;
  createCompanyPtoPolicy(data: InsertCompanyPtoPolicy): Promise<CompanyPtoPolicy>;
  updateCompanyPtoPolicy(data: Partial<InsertCompanyPtoPolicy>): Promise<CompanyPtoPolicy>;

  // Department PTO Settings Management - NEW
  getDepartmentPtoSettings(): Promise<DepartmentPtoSetting[]>;
  getAllDepartmentPtoSettings(): Promise<DepartmentPtoSetting[]>;
  getDepartmentPtoSettingByDepartment(department: string): Promise<DepartmentPtoSetting | null>;
  createDepartmentPtoSetting(data: InsertDepartmentPtoSetting): Promise<DepartmentPtoSetting>;
  updateDepartmentPtoSetting(id: string, data: Partial<InsertDepartmentPtoSetting>): Promise<DepartmentPtoSetting>;
  deleteDepartmentPtoSetting(id: string): Promise<void>;

  // Individual PTO Policy Management - NEW
  createPtoPolicy(data: InsertPtoPolicy): Promise<PtoPolicy>;
  getPtoPolicyByEmployee(employeeId: string): Promise<PtoPolicy | null>;
  getPtoPolicyByEmployeeId(employeeId: string): Promise<PtoPolicy | null>;
  getAllPtoPolicies(): Promise<PtoPolicy[]>;
  updatePtoPolicy(id: string, data: Partial<InsertPtoPolicy>): Promise<PtoPolicy>;
  deletePtoPolicy(id: string): Promise<void>;
  getTerritoryBySalesManager(managerId: string): Promise<Territory | null>;
  
  // COI Document Management - NEW
  createCoiDocument(data: Omit<InsertCoiDocument, 'id'>): Promise<CoiDocument>;
  getCoiDocumentById(id: string): Promise<CoiDocument | null>;
  getCoiDocumentsByEmployeeId(employeeId: string): Promise<CoiDocument[]>;
  getAllCoiDocuments(): Promise<CoiDocument[]>;
  getExpiringCoiDocuments(daysBeforeExpiration: number): Promise<CoiDocument[]>;
  updateCoiDocument(id: string, data: Partial<InsertCoiDocument>): Promise<CoiDocument>;
  deleteCoiDocument(id: string): Promise<void>;
  clearAllCoiDocuments(): Promise<number>;
  clearAllToolAssignments(): Promise<number>;

  // Employee Assignment Management - NEW
  createEmployeeAssignment(data: Omit<InsertEmployeeAssignment, 'id' | 'createdAt' | 'updatedAt'>): Promise<EmployeeAssignment>;
  getEmployeeAssignmentById(id: string): Promise<EmployeeAssignment | null>;
  getEmployeeAssignmentsByEmployeeId(employeeId: string): Promise<EmployeeAssignment[]>;
  getEmployeeAssignmentsByAssignedToId(assignedToId: string): Promise<EmployeeAssignment[]>;
  updateEmployeeAssignment(id: string, data: Partial<InsertEmployeeAssignment>): Promise<EmployeeAssignment>;
  deleteEmployeeAssignment(id: string): Promise<void>;

  // HR Assignment Management (Sourcer Assignments) - NEW
  createHrAssignment(data: Omit<InsertHrAssignment, 'id' | 'createdAt' | 'updatedAt'>): Promise<HrAssignment>;
  getHrAssignmentById(id: string): Promise<HrAssignment | null>;
  getHrAssignmentsByCandidateId(candidateId: string): Promise<HrAssignment[]>;
  getActiveAssignmentsByHrMemberId(hrMemberId: string): Promise<HrAssignment[]>;
  getAllHrAssignments(): Promise<HrAssignment[]>;
  updateHrAssignment(id: string, data: Partial<InsertHrAssignment>): Promise<HrAssignment>;
  deleteHrAssignment(id: string): Promise<void>;

  // HR Performance Metrics - NEW
  createHrPerformanceMetric(data: Omit<InsertHrPerformanceMetric, 'id' | 'createdAt' | 'updatedAt'>): Promise<HrPerformanceMetric>;
  getHrPerformanceMetricById(id: string): Promise<HrPerformanceMetric | null>;
  getHrPerformanceMetricsByHrMemberId(hrMemberId: string): Promise<HrPerformanceMetric[]>;
  updateHrPerformanceMetric(id: string, data: Partial<InsertHrPerformanceMetric>): Promise<HrPerformanceMetric>;

  // Contract Template Management - NEW
  createContractTemplate(data: InsertContractTemplate): Promise<ContractTemplate>;
  getContractTemplateById(id: string): Promise<ContractTemplate | null>;
  getAllContractTemplates(): Promise<ContractTemplate[]>;
  getContractTemplatesByTerritory(territory: string): Promise<ContractTemplate[]>;
  updateContractTemplate(id: string, data: Partial<InsertContractTemplate>): Promise<ContractTemplate>;
  deleteContractTemplate(id: string): Promise<void>;
  
  // Employee Contract Management - NEW
  createEmployeeContract(data: InsertEmployeeContract): Promise<EmployeeContract>;
  getEmployeeContractById(id: string): Promise<EmployeeContract | null>;
  getEmployeeContractsByEmployeeId(employeeId: string): Promise<EmployeeContract[]>;
  getAllEmployeeContracts(): Promise<EmployeeContract[]>;
  updateEmployeeContract(id: string, data: Partial<InsertEmployeeContract>): Promise<EmployeeContract>;
  deleteEmployeeContract(id: string): Promise<void>;

  // Action handler methods for Susan AI
  getCandidateByName(name: string): Promise<Candidate | null>;
  scheduleInterview(candidateId: string, interviewData: Partial<InsertInterview>): Promise<Interview>;
  sendEmailNotification(to: string, subject: string, message: string): Promise<boolean>;
  checkPtoBalance(employeeId: string): Promise<{ available: number; used: number; total: number }>;
  createPtoRequestForEmployee(employeeId: string, requestData: Partial<InsertPtoRequest>): Promise<PtoRequest>;
  
  // Notifications
  getNotifications(userId: string): Promise<any[]>;
  markNotificationAsRead(id: string, userId: string): Promise<void>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  clearNotifications(userId: string): Promise<void>;
  createNotification(data: Omit<InsertNotification, 'id'> & { id?: string }): Promise<Notification>;
  
  // Search
  search(query: string, userRole: string): Promise<any[]>;

  // Additional helper methods
  getAllPerformanceReviews(): Promise<EmployeeReview[]>;
  updatePTORequest(id: string, data: Partial<PtoRequest>): Promise<PtoRequest>;
  getAllCOIDocuments(): Promise<any[]>;
  updateCOIDocument(id: string, data: Partial<CoiDocument>): Promise<CoiDocument>;
  getAllTools(): Promise<ToolInventory[]>;
  createTool(data: Partial<ToolInventory>): Promise<ToolInventory>;
  updateTool(id: string, data: Partial<ToolInventory>): Promise<ToolInventory>;
  updateToolInventory(id: string, data: any): Promise<ToolInventory>;
  createCOIDocument(data: any): Promise<any>;

  // Attendance Management
  createAttendanceSession(data: InsertAttendanceSession): Promise<AttendanceSession>;
  getAttendanceSessionById(id: string): Promise<AttendanceSession | null>;
  getAttendanceSessionByToken(token: string): Promise<AttendanceSession | null>;
  getAllAttendanceSessions(): Promise<AttendanceSession[]>;
  getActiveAttendanceSessions(): Promise<AttendanceSession[]>;
  updateAttendanceSession(id: string, data: Partial<InsertAttendanceSession>): Promise<AttendanceSession>;
  closeAttendanceSession(id: string): Promise<AttendanceSession>;
  rotateSessionToken(id: string): Promise<AttendanceSession>;
  
  createAttendanceCheckIn(data: InsertAttendanceCheckIn): Promise<AttendanceCheckIn>;
  getAttendanceCheckInById(id: string): Promise<AttendanceCheckIn | null>;
  getCheckInsBySessionId(sessionId: string): Promise<AttendanceCheckIn[]>;
  getCheckInsByUserId(userId: string): Promise<AttendanceCheckIn[]>;
  hasUserCheckedIn(sessionId: string, userId: string | null, name: string): Promise<boolean>;
  exportSessionAttendance(sessionId: string): Promise<AttendanceCheckIn[]>;

  // Susan AI - Inventory Alert Management
  getActiveAlerts(): Promise<InventoryAlert[]>;
  updateAlert(id: string, data: Partial<InsertInventoryAlert>): Promise<InventoryAlert | null>;
  createAlert(data: InsertInventoryAlert): Promise<InventoryAlert>;

  // Susan AI - Tool Assignment Management
  createToolAssignment(data: InsertToolAssignment): Promise<ToolAssignment>;
  getToolAssignmentsByTool(toolId: string): Promise<ToolAssignment[]>;
  updateToolAssignment(id: string, data: Partial<InsertToolAssignment>): Promise<ToolAssignment | null>;

  // Susan AI - Message Management
  getUnreadMessages(userId: string): Promise<SmsMessage[]>;
  createMessage(data: InsertSmsMessage): Promise<SmsMessage>;
}

class DrizzleStorage implements IStorage {
  // User methods
  async createUser(data: InsertUser): Promise<User> {
    const id = uuidv4();
    const [user] = await db.insert(users).values({ 
      id,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role as 'ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'CONTRACTOR',
      employmentType: data.employmentType as 'W2' | 'CONTRACTOR',
      department: data.department,
      position: data.position,
      hireDate: data.hireDate,
      passwordHash: data.passwordHash,
      isActive: data.isActive ?? true,
      phone: data.phone,
      address: data.address,
      emergencyContact: data.emergencyContact,
      emergencyPhone: data.emergencyPhone,
      mustChangePassword: data.mustChangePassword ?? true,
      lastPasswordChange: data.lastPasswordChange
    }).returning();
    return user;
  }

  async getUserById(id: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || null;
  }

  async getUser(id: string): Promise<User | null> {
    // Alias for getUserById for backward compatibility
    return this.getUserById(id);
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User> {
    const updateData: any = { ...data };
    if (data.role) {
      updateData.role = data.role as 'ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'CONTRACTOR';
    }
    if (data.employmentType) {
      updateData.employmentType = data.employmentType as 'W2' | 'CONTRACTOR';
    }
    const [user] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUsersByRoles(roles: string[]): Promise<User[]> {
    const roleValues = roles as ('ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'CONTRACTOR' | 'TRUE_ADMIN')[];
    return await db.select().from(users).where(inArray(users.role, roleValues));
  }

  // Session methods
  async createSession(data: InsertSession): Promise<Session> {
    const id = uuidv4();
    const [session] = await db.insert(sessions).values({ ...data, id }).returning();
    return session;
  }

  async getSessionByToken(token: string): Promise<Session | null> {
    const [session] = await db.select().from(sessions).where(eq(sessions.token, token));
    return session || null;
  }

  async deleteSession(id: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.id, id));
  }

  async deleteExpiredSessions(): Promise<void> {
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  }

  // PTO methods
  async createPtoRequest(data: InsertPtoRequest & { employeeId: string }): Promise<PtoRequest> {
    const id = uuidv4();
    const [ptoRequest] = await db.insert(ptoRequests).values({ 
      id,
      employeeId: data.employeeId,
      startDate: data.startDate,
      endDate: data.endDate,
      days: data.days,
      reason: data.reason,
      status: 'PENDING' as 'PENDING' | 'APPROVED' | 'DENIED',
      departmentOverlapWarning: data.departmentOverlapWarning,
      overlappingEmployees: data.overlappingEmployees,
      googleEventId: data.googleEventId
    }).returning();
    return ptoRequest;
  }

  async getPtoRequestById(id: string): Promise<PtoRequest | null> {
    const [ptoRequest] = await db.select().from(ptoRequests).where(eq(ptoRequests.id, id));
    return ptoRequest || null;
  }

  async getAllPtoRequests(): Promise<PtoRequest[]> {
    return await db.select().from(ptoRequests);
  }

  async getPtoRequestsByEmployee(employeeId: string): Promise<PtoRequest[]> {
    return await db.select().from(ptoRequests).where(eq(ptoRequests.employeeId, employeeId));
  }

  async getPtoRequestsByEmployeeId(employeeId: string): Promise<PtoRequest[]> {
    return await db.select().from(ptoRequests).where(eq(ptoRequests.employeeId, employeeId));
  }


  async getPendingPtoRequests(): Promise<PtoRequest[]> {
    return await db.select().from(ptoRequests).where(eq(ptoRequests.status, 'PENDING'));
  }

  async updatePtoRequest(id: string, data: Partial<Omit<PtoRequest, 'id' | 'createdAt' | 'updatedAt'>>): Promise<PtoRequest> {
    const updateData: any = { 
      ...data,
      updatedAt: new Date()
    };
    if (data.status) {
      updateData.status = data.status as 'PENDING' | 'APPROVED' | 'DENIED';
    }
    const [ptoRequest] = await db.update(ptoRequests).set(updateData).where(eq(ptoRequests.id, id)).returning();
    return ptoRequest;
  }

  async deletePtoRequest(id: string): Promise<void> {
    await db.delete(ptoRequests).where(eq(ptoRequests.id, id));
  }

  // Candidate methods
  async createCandidate(data: InsertCandidate): Promise<Candidate> {
    const id = uuidv4();
    const insertData: any = { 
      id,
      ...data
    };
    if (data.status) {
      insertData.status = data.status as 'APPLIED' | 'SCREENING' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED' | 'DEAD_BY_US' | 'DEAD_BY_CANDIDATE';
    }
    const [candidate] = await db.insert(candidates).values(insertData).returning();
    return candidate;
  }

  async getCandidateById(id: string): Promise<Candidate | null> {
    const [candidate] = await db.select().from(candidates).where(eq(candidates.id, id));
    return candidate || null;
  }

  async getAllCandidates(): Promise<Candidate[]> {
    return await db.select().from(candidates);
  }

  async searchCandidatesByName(query: string): Promise<Candidate[]> {
    const { or, ilike } = await import('drizzle-orm');
    const searchTerm = `%${query}%`;
    
    return await db.select().from(candidates).where(
      or(
        ilike(candidates.firstName, searchTerm),
        ilike(candidates.lastName, searchTerm),
        ilike(candidates.email, searchTerm)
      )
    );
  }

  async getRecentCandidates(limit: number = 5): Promise<Candidate[]> {
    const { desc } = await import('drizzle-orm');
    return await db.select()
      .from(candidates)
      .orderBy(desc(candidates.createdAt))
      .limit(limit);
  }

  async updateCandidate(id: string, data: Partial<InsertCandidate>): Promise<Candidate> {
    const updateData: any = { ...data };
    if (data.status) {
      updateData.status = data.status as 'APPLIED' | 'SCREENING' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED' | 'DEAD_BY_US' | 'DEAD_BY_CANDIDATE';
    }
    const [candidate] = await db.update(candidates).set(updateData).where(eq(candidates.id, id)).returning();
    return candidate;
  }

  async deleteCandidate(id: string): Promise<void> {
    await db.delete(candidates).where(eq(candidates.id, id));
  }
  
  // Candidate Notes methods
  async createCandidateNote(data: InsertCandidateNote): Promise<CandidateNote> {
    const id = uuidv4();
    const insertData: any = {
      id,
      candidateId: data.candidateId,
      authorId: data.authorId,
      content: data.content,
      type: (data.type || 'GENERAL') as 'GENERAL' | 'INTERVIEW' | 'REFERENCE' | 'INTERNAL'
    };
    const [note] = await db.insert(candidateNotes).values(insertData).returning();
    return note;
  }
  
  async getCandidateNotesByCandidateId(candidateId: string): Promise<CandidateNote[]> {
    return await db.select().from(candidateNotes).where(eq(candidateNotes.candidateId, candidateId));
  }
  
  async deleteCandidateNote(id: string): Promise<void> {
    await db.delete(candidateNotes).where(eq(candidateNotes.id, id));
  }

  // Employee Notes methods
  async createEmployeeNote(data: InsertEmployeeNote): Promise<EmployeeNote> {
    const id = uuidv4();
    const insertData: any = {
      id,
      employeeId: data.employeeId,
      authorId: data.authorId,
      content: data.content,
      type: (data.type || 'GENERAL') as 'GENERAL' | 'PERFORMANCE' | 'DISCIPLINARY' | 'RECOGNITION' | 'AI_GENERATED'
    };
    const [note] = await db.insert(employeeNotes).values(insertData).returning();
    return note;
  }

  async getEmployeeNotesByEmployeeId(employeeId: string): Promise<EmployeeNote[]> {
    return await db.select().from(employeeNotes).where(eq(employeeNotes.employeeId, employeeId));
  }

  async deleteEmployeeNote(id: string): Promise<void> {
    await db.delete(employeeNotes).where(eq(employeeNotes.id, id));
  }

  // Interview methods
  async createInterview(data: InsertInterview): Promise<Interview> {
    const id = uuidv4();
    const insertData: any = {
      id,
      candidateId: data.candidateId,
      interviewerId: data.interviewerId,
      scheduledDate: data.scheduledDate,
      duration: data.duration || 60,
      type: data.type as 'PHONE' | 'VIDEO' | 'IN_PERSON',
      status: (data.status || 'SCHEDULED') as 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED',
      location: data.location,
      meetingLink: data.meetingLink,
      notes: data.notes,
      rating: data.rating,
      reminderSent: data.reminderSent ?? false,
      reminderHours: data.reminderHours || 24
    };
    const [interview] = await db.insert(interviews).values(insertData).returning();
    return interview;
  }

  async getInterviewById(id: string): Promise<Interview | null> {
    const [interview] = await db.select().from(interviews).where(eq(interviews.id, id));
    return interview || null;
  }

  async getAllInterviews(): Promise<Interview[]> {
    return await db.select().from(interviews);
  }

  async getInterviewsByCandidate(candidateId: string): Promise<Interview[]> {
    return await db.select().from(interviews).where(eq(interviews.candidateId, candidateId));
  }

  async getInterviewsByInterviewer(interviewerId: string): Promise<Interview[]> {
    return await db.select().from(interviews).where(eq(interviews.interviewerId, interviewerId));
  }

  async updateInterview(id: string, data: Partial<InsertInterview>): Promise<Interview> {
    const updateData: any = { ...data };
    if (data.type) {
      updateData.type = data.type as 'PHONE' | 'VIDEO' | 'IN_PERSON';
    }
    if (data.status) {
      updateData.status = data.status as 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';
    }
    const [interview] = await db.update(interviews).set(updateData).where(eq(interviews.id, id)).returning();
    return interview;
  }

  async deleteInterview(id: string): Promise<void> {
    await db.delete(interviews).where(eq(interviews.id, id));
  }

  // Interview Feedback methods
  async createInterviewFeedback(data: InsertInterviewFeedback): Promise<InterviewFeedback> {
    const id = uuidv4();
    const [feedback] = await db.insert(interviewFeedback).values({ ...data, id } as any).returning();
    return feedback;
  }

  async getInterviewFeedback(interviewId: string): Promise<InterviewFeedback[]> {
    return await db.select().from(interviewFeedback).where(eq(interviewFeedback.interviewId, interviewId));
  }

  // Interview Reminder methods
  async createInterviewReminder(data: InsertInterviewReminder): Promise<InterviewReminder> {
    const id = uuidv4();
    const [reminder] = await db.insert(interviewReminders).values({ ...data, id } as any).returning();
    return reminder;
  }

  // Document methods
  async createDocument(data: InsertDocument): Promise<Document> {
    const id = uuidv4();
    const insertData: any = {
      id,
      name: data.name,
      originalName: data.originalName,
      description: data.description,
      category: data.category as 'POLICY' | 'FORM' | 'HANDBOOK' | 'PROCEDURE' | 'TEMPLATE' | 'LEGAL' | 'TRAINING' | 'OTHER',
      type: data.type as 'PDF' | 'DOC' | 'DOCX' | 'XLS' | 'XLSX' | 'TXT' | 'IMAGE' | 'OTHER',
      fileUrl: data.fileUrl,
      fileSize: data.fileSize,
      version: data.version || '1.0',
      status: (data.status || 'DRAFT') as 'DRAFT' | 'REVIEW' | 'APPROVED' | 'ARCHIVED',
      visibility: (data.visibility || 'EMPLOYEE') as 'PUBLIC' | 'EMPLOYEE' | 'MANAGER' | 'ADMIN',
      tags: data.tags,
      createdBy: data.createdBy,
      approvedBy: data.approvedBy,
      approvedAt: data.approvedAt,
      expiresAt: data.expiresAt
    };
    const [document] = await db.insert(documents).values(insertData).returning();
    return document;
  }

  async getDocumentById(id: string): Promise<Document | null> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document || null;
  }

  async getAllDocuments(): Promise<Document[]> {
    return await db.select().from(documents);
  }

  async updateDocument(id: string, data: Partial<InsertDocument>): Promise<Document> {
    const updateData: any = { ...data };
    if (data.category) {
      updateData.category = data.category as 'POLICY' | 'FORM' | 'HANDBOOK' | 'PROCEDURE' | 'TEMPLATE' | 'LEGAL' | 'TRAINING' | 'OTHER';
    }
    if (data.type) {
      updateData.type = data.type as 'PDF' | 'DOC' | 'DOCX' | 'XLS' | 'XLSX' | 'TXT' | 'IMAGE' | 'OTHER';
    }
    if (data.status) {
      updateData.status = data.status as 'DRAFT' | 'REVIEW' | 'APPROVED' | 'ARCHIVED';
    }
    if (data.visibility) {
      updateData.visibility = data.visibility as 'PUBLIC' | 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
    }
    const [document] = await db.update(documents).set(updateData).where(eq(documents.id, id)).returning();
    return document;
  }

  async deleteDocument(id: string): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  async incrementDocumentDownloadCount(id: string): Promise<Document | null> {
    const doc = await this.getDocumentById(id);
    if (!doc) return null;

    const [updated] = await db.update(documents)
      .set({ downloadCount: (doc.downloadCount || 0) + 1 })
      .where(eq(documents.id, id))
      .returning();
    return updated || null;
  }

  // Document Acknowledgment Methods
  async createDocumentAcknowledgment(data: Omit<InsertDocumentAcknowledgment, 'id'>): Promise<DocumentAcknowledgment> {
    const id = uuidv4();
    const [acknowledgment] = await db.insert(documentAcknowledgments).values({
      ...data,
      id
    }).returning();
    return acknowledgment;
  }

  async getDocumentAcknowledgment(documentId: string, employeeId: string): Promise<DocumentAcknowledgment | null> {
    const [ack] = await db.select()
      .from(documentAcknowledgments)
      .where(and(
        eq(documentAcknowledgments.documentId, documentId),
        eq(documentAcknowledgments.employeeId, employeeId)
      ))
      .limit(1);
    return ack || null;
  }

  async getDocumentAcknowledgments(documentId: string): Promise<DocumentAcknowledgment[]> {
    return await db.select()
      .from(documentAcknowledgments)
      .where(eq(documentAcknowledgments.documentId, documentId));
  }

  async getEmployeeAcknowledgments(employeeId: string): Promise<DocumentAcknowledgment[]> {
    return await db.select()
      .from(documentAcknowledgments)
      .where(eq(documentAcknowledgments.employeeId, employeeId));
  }

  // Susan AI Chat Session methods
  async createSusanChatSession(userId: string, title?: string): Promise<SusanChatSession> {
    const id = uuidv4();
    const [session] = await db.insert(susanChatSessions).values({
      id,
      userId,
      messages: '[]',
      title: title || 'New Chat',
      isActive: true
    }).returning();
    return session;
  }

  async getSusanChatSessionById(id: string): Promise<SusanChatSession | null> {
    const [session] = await db.select().from(susanChatSessions).where(eq(susanChatSessions.id, id));
    return session || null;
  }

  async getSusanChatSessionsByUserId(userId: string): Promise<SusanChatSession[]> {
    return await db.select().from(susanChatSessions)
      .where(eq(susanChatSessions.userId, userId))
      .orderBy(sql`${susanChatSessions.updatedAt} DESC`);
  }

  async getActiveSusanChatSession(userId: string): Promise<SusanChatSession | null> {
    const [session] = await db.select().from(susanChatSessions)
      .where(and(
        eq(susanChatSessions.userId, userId),
        eq(susanChatSessions.isActive, true)
      ))
      .orderBy(sql`${susanChatSessions.updatedAt} DESC`);
    return session || null;
  }

  async updateSusanChatSession(id: string, data: { messages?: string; title?: string; isActive?: boolean }): Promise<SusanChatSession | null> {
    const [session] = await db.update(susanChatSessions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(susanChatSessions.id, id))
      .returning();
    return session || null;
  }

  async deleteSusanChatSession(id: string): Promise<void> {
    await db.delete(susanChatSessions).where(eq(susanChatSessions.id, id));
  }

  async deactivateAllSusanChatSessions(userId: string): Promise<void> {
    await db.update(susanChatSessions)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(susanChatSessions.userId, userId));
  }

  // Employee Review methods
  async createEmployeeReview(data: InsertEmployeeReview): Promise<EmployeeReview> {
    const id = uuidv4();
    const insertData: any = {
      id,
      revieweeId: data.revieweeId,
      reviewerId: data.reviewerId,
      reviewPeriod: data.reviewPeriod,
      reviewType: data.reviewType as 'QUARTERLY' | 'ANNUAL' | 'PROBATION' | 'PROJECT' | 'IMPROVEMENT',
      dueDate: data.dueDate,
      status: (data.status || 'DRAFT') as 'DRAFT' | 'IN_PROGRESS' | 'SUBMITTED' | 'ACKNOWLEDGED',
      overallRating: data.overallRating,
      performanceScore: data.performanceScore,
      teamworkScore: data.teamworkScore,
      communicationScore: data.communicationScore,
      technicalScore: data.technicalScore,
      strengths: data.strengths,
      areasForImprovement: data.areasForImprovement,
      goals: data.goals,
      comments: data.comments,
      revieweeComments: data.revieweeComments,
      acknowledgedAt: data.acknowledgedAt,
      submittedAt: data.submittedAt
    };
    const [review] = await db.insert(employeeReviews).values(insertData).returning();
    return review;
  }

  async getEmployeeReviewById(id: string): Promise<EmployeeReview | null> {
    const [review] = await db.select().from(employeeReviews).where(eq(employeeReviews.id, id));
    return review || null;
  }

  async getAllEmployeeReviews(): Promise<EmployeeReview[]> {
    return await db.select().from(employeeReviews);
  }

  async getEmployeeReviewsByEmployeeId(employeeId: string): Promise<EmployeeReview[]> {
    return await db.select().from(employeeReviews).where(eq(employeeReviews.revieweeId, employeeId));
  }

  async updateEmployeeReview(id: string, data: Partial<InsertEmployeeReview>): Promise<EmployeeReview> {
    const updateData: any = { ...data };
    if (data.reviewType) {
      updateData.reviewType = data.reviewType as 'QUARTERLY' | 'ANNUAL' | 'PROBATION' | 'PROJECT' | 'IMPROVEMENT';
    }
    if (data.status) {
      updateData.status = data.status as 'DRAFT' | 'IN_PROGRESS' | 'SUBMITTED' | 'ACKNOWLEDGED';
    }
    const [review] = await db.update(employeeReviews).set(updateData).where(eq(employeeReviews.id, id)).returning();
    return review;
  }

  async deleteEmployeeReview(id: string): Promise<void> {
    await db.delete(employeeReviews).where(eq(employeeReviews.id, id));
  }

  // Task methods
  async createTask(data: InsertTask): Promise<Task> {
    const id = uuidv4();
    const insertData: any = {
      id,
      title: data.title,
      description: data.description,
      assignedTo: data.assignedTo,
      assignedBy: data.assignedBy,
      priority: (data.priority || 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
      status: (data.status || 'TODO') as 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED',
      dueDate: data.dueDate,
      category: data.category,
      tags: data.tags || [],
      completedAt: data.completedAt
    };
    const [task] = await db.insert(tasks).values(insertData).returning();
    return task;
  }

  async createOnboardingTask(data: {
    employeeId: string;
    title: string;
    description?: string;
    dueDate?: Date | string;
    status?: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'PENDING';
  }): Promise<Task> {
    const normalizedStatus = (data.status === 'PENDING' ? 'TODO' : data.status) || 'TODO';
    const dueDateValue = data.dueDate ? new Date(data.dueDate) : undefined;

    return this.createTask({
      title: data.title,
      description: data.description || '',
      assignedTo: data.employeeId,
      assignedBy: data.employeeId,
      priority: 'MEDIUM',
      status: normalizedStatus as 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED',
      dueDate: dueDateValue,
      category: 'ONBOARDING',
      tags: ['onboarding'],
      completedAt: undefined
    });
  }

  async getTaskById(id: string): Promise<Task | null> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task || null;
  }

  async getAllTasks(): Promise<Task[]> {
    return await db.select().from(tasks);
  }

  async getTasksByAssignee(assigneeId: string): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.assignedTo, assigneeId));
  }

  async updateTask(id: string, data: Partial<InsertTask>): Promise<Task> {
    const updateData: any = { ...data };
    if (data.priority) {
      updateData.priority = data.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    }
    if (data.status) {
      updateData.status = data.status as 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    }
    const [task] = await db.update(tasks).set(updateData).where(eq(tasks.id, id)).returning();
    return task;
  }

  async deleteTask(id: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  // Company Settings methods
  async getCompanySettings(): Promise<CompanySettings | null> {
    const [settings] = await db.select().from(companySettings).limit(1);
    return settings || null;
  }

  async updateCompanySettings(data: Partial<InsertCompanySettings>): Promise<CompanySettings> {
    // Try to update existing settings first
    const existingSettings = await this.getCompanySettings();
    
    if (existingSettings) {
      const [settings] = await db.update(companySettings)
        .set(data)
        .where(eq(companySettings.id, existingSettings.id))
        .returning();
      return settings;
    } else {
      // Create new settings if none exist
      const id = uuidv4();
      const [settings] = await db.insert(companySettings).values({ 
        id,
        companyName: data.companyName || 'Roof HR',
        address: data.address || '123 Main St',
        phone: data.phone || '555-0100',
        email: data.email || 'info@roof-hr.com',
        website: data.website,
        ptoPolicy: data.ptoPolicy || '{}',
        businessHours: data.businessHours || '{}'
      }).returning();
      return settings;
    }
  }

  // HR Agent Management methods
  async createHrAgentConfig(data: InsertHrAgentConfig): Promise<HrAgentConfig> {
    const id = uuidv4();
    const [config] = await db.insert(hrAgentConfigs).values({ ...data, id } as any).returning();
    return config;
  }

  async getHrAgentConfigById(id: string): Promise<HrAgentConfig | null> {
    const [config] = await db.select().from(hrAgentConfigs).where(eq(hrAgentConfigs.id, id));
    return config || null;
  }

  async getHrAgentConfigByName(name: string): Promise<HrAgentConfig | null> {
    const [config] = await db.select().from(hrAgentConfigs).where(eq(hrAgentConfigs.agentName, name));
    return config || null;
  }

  async getAllHrAgentConfigs(): Promise<HrAgentConfig[]> {
    return await db.select().from(hrAgentConfigs);
  }

  async updateHrAgentConfig(id: string, data: Partial<InsertHrAgentConfig>): Promise<HrAgentConfig> {
    const [config] = await db.update(hrAgentConfigs).set(data as any).where(eq(hrAgentConfigs.id, id)).returning();
    return config;
  }

  // HR Agent Logs methods
  async createHrAgentLog(data: InsertHrAgentLog): Promise<HrAgentLog> {
    const id = uuidv4();
    const [log] = await db.insert(hrAgentLogs).values({ ...data, id } as any).returning();
    return log;
  }

  async getHrAgentLogsByAgent(agentName: string, limit: number = 100): Promise<HrAgentLog[]> {
    return await db.select()
      .from(hrAgentLogs)
      .where(eq(hrAgentLogs.agentName, agentName))
      .orderBy(hrAgentLogs.createdAt)
      .limit(limit);
  }

  async getAllHrAgentLogs(limit: number = 100): Promise<HrAgentLog[]> {
    return await db.select()
      .from(hrAgentLogs)
      .orderBy(hrAgentLogs.createdAt)
      .limit(limit);
  }

  // Job Posting methods
  async createJobPosting(data: InsertJobPosting): Promise<JobPosting> {
    const id = uuidv4();
    const [posting] = await db.insert(jobPostings).values({ ...data, id } as any).returning();
    return posting;
  }

  async getJobPostingById(id: string): Promise<JobPosting | null> {
    const [posting] = await db.select().from(jobPostings).where(eq(jobPostings.id, id));
    return posting || null;
  }

  async getAllJobPostings(): Promise<JobPosting[]> {
    return await db.select().from(jobPostings);
  }

  async updateJobPosting(id: string, data: Partial<InsertJobPosting>): Promise<JobPosting> {
    const [posting] = await db.update(jobPostings).set(data as any).where(eq(jobPostings.id, id)).returning();
    return posting;
  }

  async deleteJobPosting(id: string): Promise<void> {
    await db.delete(jobPostings).where(eq(jobPostings.id, id));
  }

  // Candidate Source methods
  async createCandidateSource(data: InsertCandidateSource): Promise<CandidateSource> {
    const id = uuidv4();
    const [source] = await db.insert(candidateSources).values({ ...data, id } as any).returning();
    return source;
  }

  async getCandidateSourcesByCandidateId(candidateId: string): Promise<CandidateSource[]> {
    return await db.select().from(candidateSources).where(eq(candidateSources.candidateId, candidateId));
  }

  async getCandidateSourcesByBatchId(batchId: string): Promise<CandidateSource[]> {
    return await db.select().from(candidateSources).where(eq(candidateSources.importBatchId, batchId));
  }

  // Job Import Log methods
  async createJobImportLog(data: InsertJobImportLog): Promise<JobImportLog> {
    const id = uuidv4();
    const [log] = await db.insert(jobImportLogs).values({ ...data, id } as any).returning();
    return log;
  }

  async getJobImportLogs(limit: number = 100): Promise<JobImportLog[]> {
    return await db.select()
      .from(jobImportLogs)
      .orderBy(jobImportLogs.importedAt)
      .limit(limit);
  }

  // Interview Availability methods
  async createInterviewAvailability(data: InsertInterviewAvailability): Promise<InterviewAvailability> {
    const id = uuidv4();
    const [availability] = await db.insert(interviewAvailability).values({ ...data, id }).returning();
    return availability;
  }

  async getInterviewAvailabilityByInterviewer(interviewerId: string): Promise<InterviewAvailability[]> {
    return await db.select()
      .from(interviewAvailability)
      .where(and(
        eq(interviewAvailability.interviewerId, interviewerId),
        eq(interviewAvailability.isActive, true)
      ));
  }

  async updateInterviewAvailability(id: string, data: Partial<InsertInterviewAvailability>): Promise<InterviewAvailability> {
    const [availability] = await db.update(interviewAvailability)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(interviewAvailability.id, id))
      .returning();
    return availability;
  }

  async deleteInterviewAvailability(id: string): Promise<void> {
    await db.delete(interviewAvailability).where(eq(interviewAvailability.id, id));
  }

  // Interview Panel Members methods
  async createInterviewPanelMember(data: InsertInterviewPanelMember): Promise<InterviewPanelMember> {
    const id = uuidv4();
    const [member] = await db.insert(interviewPanelMembers).values({ ...data, id } as any).returning();
    return member;
  }

  async getInterviewPanelMembersByInterview(interviewId: string): Promise<InterviewPanelMember[]> {
    return await db.select()
      .from(interviewPanelMembers)
      .where(eq(interviewPanelMembers.interviewId, interviewId));
  }

  async updateInterviewPanelMember(id: string, data: Partial<InsertInterviewPanelMember>): Promise<InterviewPanelMember> {
    const [member] = await db.update(interviewPanelMembers)
      .set(data as any)
      .where(eq(interviewPanelMembers.id, id))
      .returning();
    return member;
  }

  async deleteInterviewPanelMember(id: string): Promise<void> {
    await db.delete(interviewPanelMembers).where(eq(interviewPanelMembers.id, id));
  }

  // Phase 3: Email Campaign Management
  async createEmailCampaign(data: InsertEmailCampaign): Promise<EmailCampaign> {
    const id = uuidv4();
    const [campaign] = await db.insert(emailCampaigns).values({ ...data, id } as any).returning();
    return campaign;
  }

  async getEmailCampaignById(id: string): Promise<EmailCampaign | null> {
    const [campaign] = await db.select().from(emailCampaigns).where(eq(emailCampaigns.id, id));
    return campaign || null;
  }

  async getAllEmailCampaigns(): Promise<EmailCampaign[]> {
    return await db.select().from(emailCampaigns);
  }

  async updateEmailCampaign(id: string, data: Partial<InsertEmailCampaign>): Promise<EmailCampaign> {
    const [campaign] = await db.update(emailCampaigns).set(data as any).where(eq(emailCampaigns.id, id)).returning();
    return campaign;
  }

  async deleteEmailCampaign(id: string): Promise<void> {
    await db.delete(emailCampaigns).where(eq(emailCampaigns.id, id));
  }

  // Campaign Steps
  async createCampaignStep(data: InsertCampaignStep): Promise<CampaignStep> {
    const id = uuidv4();
    const [step] = await db.insert(campaignSteps).values({ ...data, id } as any).returning();
    return step;
  }

  async getCampaignStepsByCampaignId(campaignId: string): Promise<CampaignStep[]> {
    return await db.select().from(campaignSteps).where(eq(campaignSteps.campaignId, campaignId));
  }

  async updateCampaignStep(id: string, data: Partial<InsertCampaignStep>): Promise<CampaignStep> {
    const [step] = await db.update(campaignSteps).set(data as any).where(eq(campaignSteps.id, id)).returning();
    return step;
  }

  async deleteCampaignStep(id: string): Promise<void> {
    await db.delete(campaignSteps).where(eq(campaignSteps.id, id));
  }

  // Campaign Recipients
  async createCampaignRecipient(data: InsertCampaignRecipient): Promise<CampaignRecipient> {
    const id = uuidv4();
    const [recipient] = await db.insert(campaignRecipients).values({ ...data, id } as any).returning();
    return recipient;
  }

  async getCampaignRecipientsByCampaignId(campaignId: string): Promise<CampaignRecipient[]> {
    return await db.select().from(campaignRecipients).where(eq(campaignRecipients.campaignId, campaignId));
  }

  async updateCampaignRecipient(id: string, data: Partial<InsertCampaignRecipient>): Promise<CampaignRecipient> {
    const [recipient] = await db.update(campaignRecipients).set(data as any).where(eq(campaignRecipients.id, id)).returning();
    return recipient;
  }

  // Email Tracking
  async createEmailTracking(data: InsertEmailTracking): Promise<EmailTracking> {
    const id = uuidv4();
    const [tracking] = await db.insert(emailTracking).values({ ...data, id } as any).returning();
    return tracking;
  }

  async getEmailTrackingByMessageId(messageId: string): Promise<EmailTracking | null> {
    const [tracking] = await db.select().from(emailTracking).where(eq(emailTracking.messageId, messageId));
    return tracking || null;
  }

  async updateEmailTracking(id: string, data: Partial<InsertEmailTracking>): Promise<EmailTracking> {
    const [tracking] = await db.update(emailTracking).set(data as any).where(eq(emailTracking.id, id)).returning();
    return tracking;
  }

  // SMS Messages
  async createSmsMessage(data: InsertSmsMessage): Promise<SmsMessage> {
    const id = uuidv4();
    const [message] = await db.insert(smsMessages).values({ ...data, id } as any).returning();
    return message;
  }

  async getSmsMessageById(id: string): Promise<SmsMessage | null> {
    const [message] = await db.select().from(smsMessages).where(eq(smsMessages.id, id));
    return message || null;
  }

  async getAllSmsMessages(): Promise<SmsMessage[]> {
    return await db.select().from(smsMessages);
  }

  async updateSmsMessage(id: string, data: Partial<InsertSmsMessage>): Promise<SmsMessage> {
    const [message] = await db.update(smsMessages).set(data as any).where(eq(smsMessages.id, id)).returning();
    return message;
  }

  // Communication Preferences
  async createCommunicationPreference(data: InsertCommunicationPreference): Promise<CommunicationPreference> {
    const id = uuidv4();
    const [pref] = await db.insert(communicationPreferences).values({ ...data, id } as any).returning();
    return pref;
  }

  async getCommunicationPreferenceByCandidateId(candidateId: string): Promise<CommunicationPreference | null> {
    const [pref] = await db.select().from(communicationPreferences).where(eq(communicationPreferences.candidateId, candidateId));
    return pref || null;
  }

  async getAllCommunicationPreferences(): Promise<CommunicationPreference[]> {
    return await db.select().from(communicationPreferences);
  }

  async updateCommunicationPreference(id: string, data: Partial<InsertCommunicationPreference>): Promise<CommunicationPreference> {
    const [pref] = await db.update(communicationPreferences).set(data as any).where(eq(communicationPreferences.id, id)).returning();
    return pref;
  }

  // AI Email Generations
  async createAiEmailGeneration(data: InsertAiEmailGeneration): Promise<AiEmailGeneration> {
    const id = uuidv4();
    const [generation] = await db.insert(aiEmailGenerations).values({ ...data, id } as any).returning();
    return generation;
  }

  async getAiEmailGenerationsByCandidate(candidateId: string): Promise<AiEmailGeneration[]> {
    return await db.select().from(aiEmailGenerations).where(eq(aiEmailGenerations.candidateId, candidateId));
  }

  async updateAiEmailGeneration(id: string, data: Partial<InsertAiEmailGeneration>): Promise<AiEmailGeneration> {
    const [generation] = await db.update(aiEmailGenerations).set(data as any).where(eq(aiEmailGenerations.id, id)).returning();
    return generation;
  }

  // Workflow Execution Methods (core workflow CRUD is defined below in Workflow Methods section)
  async createWorkflowExecution(data: any): Promise<any> {
    const id = uuidv4();
    const [execution] = await db.insert(workflowExecutions).values({ ...data, id }).returning();
    return execution;
  }

  async getWorkflowExecutionById(id: string): Promise<any | null> {
    const [execution] = await db.select().from(workflowExecutions).where(eq(workflowExecutions.id, id));
    return execution || null;
  }

  async getWorkflowExecutions(workflowId: string): Promise<any[]> {
    return await db.select().from(workflowExecutions).where(eq(workflowExecutions.workflowId, workflowId));
  }

  async updateWorkflowExecution(id: string, data: any): Promise<any> {
    // Ensure completedAt is a Date object if provided
    const updateData = { ...data };
    if (updateData.completedAt && typeof updateData.completedAt === 'string') {
      updateData.completedAt = new Date(updateData.completedAt);
    }
    
    const [execution] = await db.update(workflowExecutions)
      .set(updateData)
      .where(eq(workflowExecutions.id, id))
      .returning();
    return execution;
  }

  async getActiveWorkflowsByType(type: string): Promise<any[]> {
    return await db.select().from(workflows)
      .where(and(
        eq(workflows.type, type as any),
        eq(workflows.status, 'ACTIVE' as any)
      ));
  }

  async updateWorkflowExecutionCount(id: string): Promise<void> {
    const [workflow] = await db.select().from(workflows).where(eq(workflows.id, id));
    if (workflow) {
      await db.update(workflows)
        .set({ 
          executionCount: (workflow.executionCount || 0) + 1,
          lastExecuted: new Date(),
          updatedAt: new Date()
        })
        .where(eq(workflows.id, id));
    }
  }

  async updateWorkflowStatus(id: string, status: string): Promise<any> {
    const [workflow] = await db.update(workflows)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(workflows.id, id))
      .returning();
    return workflow;
  }

  async createWorkflowStepLog(data: any): Promise<any> {
    const id = uuidv4();
    const [log] = await db.insert(workflowStepLogs).values({ ...data, id }).returning();
    return log;
  }

  async getWorkflowStepLogs(executionId: string): Promise<any[]> {
    return await db.select().from(workflowStepLogs).where(eq(workflowStepLogs.executionId, executionId));
  }

  async getAllWorkflowTemplates(): Promise<any[]> {
    return await db.select().from(workflowTemplates);
  }

  async createWorkflowTemplate(data: any): Promise<any> {
    const id = uuidv4();
    const [template] = await db.insert(workflowTemplates).values({ ...data, id }).returning();
    return template;
  }

  async getWorkflowTemplateById(id: string): Promise<any> {
    const [template] = await db.select().from(workflowTemplates).where(eq(workflowTemplates.id, id));
    return template || null;
  }

  // Phase 5: AI Enhancement Implementation Methods
  async createAiModelPerformance(data: any): Promise<AiModelPerformance> {
    const id = uuidv4();
    const [performance] = await db.insert(aiModelPerformance).values({ ...data, id } as any).returning();
    return performance;
  }

  async getAiModelPerformance(metricType: string): Promise<AiModelPerformance[]> {
    return await db.select().from(aiModelPerformance)
      .where(eq(aiModelPerformance.metricType, metricType as any));
  }

  async createSalaryBenchmark(data: any): Promise<SalaryBenchmark> {
    const id = uuidv4();
    const [benchmark] = await db.insert(salaryBenchmarks).values({ ...data, id }).returning();
    return benchmark;
  }

  async getSalaryBenchmarkByPosition(position: string, location: string): Promise<SalaryBenchmark | null> {
    const [benchmark] = await db.select().from(salaryBenchmarks)
      .where(and(
        eq(salaryBenchmarks.position, position),
        eq(salaryBenchmarks.location, location)
      ));
    return benchmark || null;
  }

  async getAllSalaryBenchmarks(): Promise<SalaryBenchmark[]> {
    return await db.select().from(salaryBenchmarks);
  }

  async updateSalaryBenchmark(id: string, data: any): Promise<SalaryBenchmark> {
    const [benchmark] = await db.update(salaryBenchmarks)
      .set({ ...data, lastUpdated: new Date() })
      .where(eq(salaryBenchmarks.id, id))
      .returning();
    return benchmark;
  }

  async createInterviewQuestion(data: any): Promise<InterviewQuestionBank> {
    const id = uuidv4();
    const [question] = await db.insert(interviewQuestionBank).values({ ...data, id }).returning();
    return question;
  }

  async getInterviewQuestionsByPosition(position: string, category?: string): Promise<InterviewQuestionBank[]> {
    if (category) {
      return await db.select().from(interviewQuestionBank)
        .where(and(
          eq(interviewQuestionBank.position, position),
          eq(interviewQuestionBank.category, category as any)
        ));
    }

    return await db.select().from(interviewQuestionBank)
      .where(eq(interviewQuestionBank.position, position));
  }

  async updateInterviewQuestionUsage(id: string): Promise<void> {
    const [question] = await db.select().from(interviewQuestionBank)
      .where(eq(interviewQuestionBank.id, id));
    
    if (question) {
      await db.update(interviewQuestionBank)
        .set({ 
          usageCount: (question.usageCount || 0) + 1,
          updatedAt: new Date()
        })
        .where(eq(interviewQuestionBank.id, id));
    }
  }

  async getAllInterviewQuestions(): Promise<InterviewQuestionBank[]> {
    return await db.select().from(interviewQuestionBank);
  }
  
  // AI Criteria Methods
  async createAiCriteria(data: Omit<InsertAiCriteria, 'id' | 'createdAt' | 'updatedAt'>): Promise<AiCriteria> {
    const id = uuidv4();
    const [criteria] = await db.insert(aiCriteria).values({ 
      ...data, 
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    
    // Parse the criteria field back to array for frontend
    return {
      ...criteria,
      criteria: typeof criteria.criteria === 'string' 
        ? JSON.parse(criteria.criteria) 
        : criteria.criteria
    } as any;
  }

  async getAiCriteriaById(id: string): Promise<AiCriteria | null> {
    const [criteria] = await db.select().from(aiCriteria)
      .where(eq(aiCriteria.id, id));
    
    if (!criteria) return null;
    
    // Parse the criteria field back to array for frontend
    return {
      ...criteria,
      criteria: typeof criteria.criteria === 'string' 
        ? JSON.parse(criteria.criteria) 
        : criteria.criteria
    } as any;
  }

  async getAllAiCriteria(): Promise<AiCriteria[]> {
    const results = await db.select().from(aiCriteria);
    
    // Parse the criteria field back to array for frontend
    return results.map(criteria => ({
      ...criteria,
      criteria: typeof criteria.criteria === 'string' 
        ? JSON.parse(criteria.criteria) 
        : criteria.criteria
    })) as any;
  }

  async updateAiCriteria(id: string, data: Partial<Omit<InsertAiCriteria, 'id' | 'createdAt' | 'updatedAt'>>): Promise<AiCriteria> {
    const [criteria] = await db.update(aiCriteria)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(aiCriteria.id, id))
      .returning();
    
    // Parse the criteria field back to array for frontend
    return {
      ...criteria,
      criteria: typeof criteria.criteria === 'string' 
        ? JSON.parse(criteria.criteria) 
        : criteria.criteria
    } as any;
  }

  async deleteAiCriteria(id: string): Promise<void> {
    await db.delete(aiCriteria).where(eq(aiCriteria.id, id));
  }
  
  // Email Template Methods
  async createEmailTemplate(data: any): Promise<EmailTemplate> {
    const id = uuidv4();
    const [template] = await db.insert(emailTemplates).values({ ...data, id }).returning();
    return template;
  }
  
  async getEmailTemplateById(id: string): Promise<EmailTemplate | null> {
    const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id));
    return template || null;
  }
  
  async getAllEmailTemplates(): Promise<EmailTemplate[]> {
    return await db.select().from(emailTemplates);
  }
  
  async updateEmailTemplate(id: string, data: any): Promise<EmailTemplate | null> {
    const [template] = await db.update(emailTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(emailTemplates.id, id))
      .returning();
    return template || null;
  }
  
  async deleteEmailTemplate(id: string): Promise<void> {
    await db.delete(emailTemplates).where(eq(emailTemplates.id, id));
  }
  
  // Email Log Methods
  async createEmailLog(data: any): Promise<EmailLog> {
    const id = uuidv4();
    const [log] = await db.insert(emailLogs).values({ ...data, id }).returning();
    return log;
  }
  
  async getEmailLogsByCandidateId(candidateId: string): Promise<EmailLog[]> {
    return await db.select().from(emailLogs).where(eq(emailLogs.candidateId, candidateId));
  }

  async updateEmailLog(id: string, data: Partial<any>): Promise<EmailLog> {
    const [log] = await db.update(emailLogs)
      .set(data)
      .where(eq(emailLogs.id, id))
      .returning();
    return log;
  }

  // Onboarding Workflow Methods
  async createOnboardingWorkflow(data: InsertOnboardingWorkflow): Promise<OnboardingWorkflow> {
    const id = uuidv4();
    const [workflow] = await db.insert(onboardingWorkflows).values({
      ...data,
      id,
      status: (data.status || 'NOT_STARTED') as 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED',
    }).returning();
    return workflow;
  }

  async getOnboardingWorkflowById(id: string): Promise<OnboardingWorkflow | null> {
    const [workflow] = await db.select().from(onboardingWorkflows).where(eq(onboardingWorkflows.id, id));
    return workflow || null;
  }

  async getAllOnboardingWorkflows(): Promise<OnboardingWorkflow[]> {
    return await db.select().from(onboardingWorkflows);
  }

  async updateOnboardingWorkflow(id: string, data: Partial<OnboardingWorkflow>): Promise<OnboardingWorkflow | null> {
    const [workflow] = await db.update(onboardingWorkflows)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(onboardingWorkflows.id, id))
      .returning();
    return workflow || null;
  }

  // Onboarding Step Methods
  async createOnboardingStep(data: InsertOnboardingStep): Promise<OnboardingStep> {
    const id = uuidv4();
    const [step] = await db.insert(onboardingSteps).values({
      ...data,
      id,
      type: data.type as 'DOCUMENT_UPLOAD' | 'FORM_FILL' | 'TRAINING' | 'MEETING' | 'TASK' | 'REVIEW' | 'DOCUMENT_READ' | 'EQUIPMENT',
      status: (data.status || 'PENDING') as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED',
      completedByRole: data.completedByRole as 'MANAGER' | 'EMPLOYEE' | null | undefined,
    }).returning();
    return step;
  }

  async getOnboardingStepById(id: string): Promise<OnboardingStep | null> {
    const [step] = await db.select().from(onboardingSteps).where(eq(onboardingSteps.id, id));
    return step || null;
  }

  async getOnboardingStepsByWorkflowId(workflowId: string): Promise<OnboardingStep[]> {
    return await db.select().from(onboardingSteps).where(eq(onboardingSteps.workflowId, workflowId));
  }

  async updateOnboardingStep(id: string, data: Partial<OnboardingStep>): Promise<OnboardingStep | null> {
    const [step] = await db.update(onboardingSteps)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(onboardingSteps.id, id))
      .returning();
    return step || null;
  }

  // Onboarding Template Methods
  async createOnboardingTemplate(data: InsertOnboardingTemplate): Promise<OnboardingTemplate> {
    const [template] = await db.insert(onboardingTemplates).values(data).returning();
    return template;
  }

  async getOnboardingTemplateById(id: string): Promise<OnboardingTemplate | null> {
    const [template] = await db.select().from(onboardingTemplates).where(eq(onboardingTemplates.id, id));
    return template || null;
  }

  async getAllOnboardingTemplates(): Promise<OnboardingTemplate[]> {
    return await db.select().from(onboardingTemplates);
  }

  async updateOnboardingTemplate(id: string, data: Partial<OnboardingTemplate>): Promise<OnboardingTemplate | null> {
    const [template] = await db.update(onboardingTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(onboardingTemplates.id, id))
      .returning();
    return template || null;
  }

  async deleteOnboardingTemplate(id: string): Promise<boolean> {
    const result = await db.delete(onboardingTemplates).where(eq(onboardingTemplates.id, id));
    return true;
  }

  // Onboarding Instance Methods
  async createOnboardingInstance(data: InsertOnboardingInstance & { id?: string }): Promise<OnboardingInstance> {
    const id = data.id || `instance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const [instance] = await db.insert(onboardingInstances).values({
      ...data,
      id,
      // Let the database handle defaults for timestamps
    }).returning();
    return instance;
  }

  async getOnboardingInstanceById(id: string): Promise<OnboardingInstance | null> {
    const [instance] = await db.select().from(onboardingInstances).where(eq(onboardingInstances.id, id));
    return instance || null;
  }

  async getAllOnboardingInstances(): Promise<OnboardingInstance[]> {
    return await db.select().from(onboardingInstances);
  }

  async getOnboardingInstancesByEmployeeId(employeeId: string): Promise<OnboardingInstance[]> {
    return await db.select().from(onboardingInstances).where(eq(onboardingInstances.employeeId, employeeId));
  }

  async updateOnboardingInstance(id: string, data: Partial<OnboardingInstance>): Promise<OnboardingInstance | null> {
    const [instance] = await db.update(onboardingInstances)
      .set(data)
      .where(eq(onboardingInstances.id, id))
      .returning();
    return instance || null;
  }

  // Overdue Onboarding Steps
  async getOverdueOnboardingSteps(): Promise<OnboardingStep[]> {
    const now = new Date();
    return await db.select()
      .from(onboardingSteps)
      .where(
        and(
          lt(onboardingSteps.dueDate, now),
          eq(onboardingSteps.status, 'PENDING')
        )
      );
  }

  // Notification Methods
  async createNotification(data: Omit<InsertNotification, 'id'> & { id?: string }): Promise<Notification> {
    const id = data.id || `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const [notification] = await db.insert(notifications).values({
      ...data,
      id,
    }).returning();
    return notification;
  }

  async getNotificationById(id: string): Promise<Notification | null> {
    const [notification] = await db.select().from(notifications).where(eq(notifications.id, id));
    return notification || null;
  }

  async getNotificationsByUserId(userId: string, limit: number = 50): Promise<Notification[]> {
    return await db.select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async getUnreadNotificationsByUserId(userId: string): Promise<Notification[]> {
    return await db.select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.read, false)
        )
      )
      .orderBy(desc(notifications.createdAt));
  }

  async markNotificationAsRead(id: string, userId?: string): Promise<void> {
    await db.update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, id));
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db.update(notifications)
      .set({ read: true })
      .where(eq(notifications.userId, userId));
  }

  async deleteNotification(id: string): Promise<boolean> {
    await db.delete(notifications).where(eq(notifications.id, id));
    return true;
  }

  async deleteAllNotifications(userId: string): Promise<void> {
    await db.delete(notifications).where(eq(notifications.userId, userId));
  }

  // IStorage interface wrapper methods
  async getNotifications(userId: string): Promise<Notification[]> {
    return this.getNotificationsByUserId(userId);
  }

  async clearNotifications(userId: string): Promise<void> {
    await this.deleteAllNotifications(userId);
  }

  async getRecentNotification(userId: string, type: string, metadataContains: string, hoursAgo: number): Promise<Notification | null> {
    const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    const results = await db.select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.type, type as any),
          gte(notifications.createdAt, cutoff)
        )
      );
    // Filter by metadata contains (since SQL LIKE in drizzle is complex)
    return results.find(n => n.metadata?.includes(metadataContains)) || null;
  }

  // Analytics Report Methods
  async createAnalyticsReport(data: InsertAnalyticsReport): Promise<AnalyticsReport> {
    const id = uuidv4();
    const [report] = await db.insert(analyticsReports).values({
      ...data,
      id,
      type: data.type as 'EMPLOYEE_PERFORMANCE' | 'PTO_ANALYSIS' | 'SALES_REPORT' | 'RECRUITMENT_METRICS' | 'CUSTOM',
    }).returning();
    return report;
  }

  async getAnalyticsReportById(id: string): Promise<AnalyticsReport | null> {
    const [report] = await db.select().from(analyticsReports).where(eq(analyticsReports.id, id));
    return report || null;
  }

  async getAllAnalyticsReports(): Promise<AnalyticsReport[]> {
    return await db.select().from(analyticsReports);
  }

  async updateAnalyticsReport(id: string, data: Partial<AnalyticsReport>): Promise<AnalyticsReport | null> {
    const [report] = await db.update(analyticsReports)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(analyticsReports.id, id))
      .returning();
    return report || null;
  }

  // Report History Methods
  async createReportHistory(data: InsertReportHistory): Promise<ReportHistory> {
    const id = uuidv4();
    const [history] = await db.insert(reportHistory).values({
      ...data,
      id,
      status: (data.status || 'GENERATING') as 'GENERATING' | 'COMPLETED' | 'FAILED',
    }).returning();
    return history;
  }

  async getReportHistoryById(id: string): Promise<ReportHistory | null> {
    const [history] = await db.select().from(reportHistory).where(eq(reportHistory.id, id));
    return history || null;
  }

  async getReportHistoryByReportId(reportId: string): Promise<ReportHistory[]> {
    return await db.select().from(reportHistory).where(eq(reportHistory.reportId, reportId));
  }

  async getAllReportHistory(): Promise<ReportHistory[]> {
    return await db.select().from(reportHistory);
  }

  async updateReportHistory(id: string, data: Partial<ReportHistory>): Promise<ReportHistory | null> {
    const [history] = await db.update(reportHistory)
      .set(data)
      .where(eq(reportHistory.id, id))
      .returning();
    return history || null;
  }

  // Workflow Methods
  async createWorkflow(data: any): Promise<any> {
    const id = uuidv4();
    const [workflow] = await db.insert(workflows).values({ ...data, id }).returning();
    return workflow;
  }
  
  async getWorkflowById(id: string): Promise<any | null> {
    const [workflow] = await db.select().from(workflows).where(eq(workflows.id, id));
    return workflow || null;
  }
  
  async getAllWorkflows(): Promise<any[]> {
    return await db.select().from(workflows);
  }
  
  async updateWorkflow(id: string, data: any): Promise<any> {
    const [workflow] = await db.update(workflows)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(workflows.id, id))
      .returning();
    return workflow;
  }
  
  async deleteWorkflow(id: string): Promise<void> {
    await db.delete(workflows).where(eq(workflows.id, id));
  }
  
  // Workflow Step Methods
  async createWorkflowStep(data: any): Promise<any> {
    const id = uuidv4();
    const [step] = await db.insert(workflowSteps).values({ ...data, id }).returning();
    return step;
  }
  
  async getWorkflowStepsByWorkflowId(workflowId: string): Promise<any[]> {
    return await db.select().from(workflowSteps).where(eq(workflowSteps.workflowId, workflowId));
  }
  
  async updateWorkflowStep(id: string, data: any): Promise<any> {
    const [step] = await db.update(workflowSteps)
      .set(data)
      .where(eq(workflowSteps.id, id))
      .returning();
    return step;
  }
  
  async deleteWorkflowStep(id: string): Promise<void> {
    await db.delete(workflowSteps).where(eq(workflowSteps.id, id));
  }
  
  // Workflow Step Execution Methods
  async createWorkflowStepExecution(data: any): Promise<void> {
    const id = uuidv4();
    await db.insert(workflowStepLogs).values({ ...data, id });
  }
  
  async updateWorkflowStepExecution(stepId: string, data: any): Promise<void> {
    await db.update(workflowStepLogs).set(data).where(eq(workflowStepLogs.stepId, stepId));
  }
  
  // Territory Management Implementation - NEW
  async createTerritory(data: InsertTerritory): Promise<Territory> {
    const id = uuidv4();
    const [territory] = await db.insert(territories).values({ ...data, id }).returning();
    return territory;
  }
  
  async getTerritoryById(id: string): Promise<Territory | null> {
    const [territory] = await db.select().from(territories).where(eq(territories.id, id));
    return territory || null;
  }
  
  async getAllTerritories(): Promise<Territory[]> {
    return await db.select().from(territories);
  }
  
  async updateTerritory(id: string, data: Partial<InsertTerritory>): Promise<Territory> {
    const [territory] = await db.update(territories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(territories.id, id))
      .returning();
    return territory;
  }
  
  async deleteTerritory(id: string): Promise<void> {
    await db.delete(territories).where(eq(territories.id, id));
  }
  
  async getTerritoryBySalesManager(managerId: string): Promise<Territory | null> {
    const [territory] = await db.select().from(territories)
      .where(eq(territories.salesManagerId, managerId));
    return territory || null;
  }
  
  // Company PTO Policy Management Implementation - NEW
  async getCompanyPtoPolicy(): Promise<CompanyPtoPolicy | null> {
    const [policy] = await db.select().from(companyPtoPolicy);
    return policy || null;
  }

  async createCompanyPtoPolicy(data: InsertCompanyPtoPolicy): Promise<CompanyPtoPolicy> {
    const id = uuidv4();
    const [policy] = await db.insert(companyPtoPolicy).values({ ...data, id }).returning();
    return policy;
  }

  async updateCompanyPtoPolicy(data: Partial<InsertCompanyPtoPolicy>): Promise<CompanyPtoPolicy> {
    const existing = await this.getCompanyPtoPolicy();
    if (existing) {
      const [policy] = await db.update(companyPtoPolicy)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(companyPtoPolicy.id, existing.id))
        .returning();
      return policy;
    } else {
      return await this.createCompanyPtoPolicy(data as InsertCompanyPtoPolicy);
    }
  }

  // Individual PTO Policy Management Implementation - NEW
  async createPtoPolicy(data: InsertPtoPolicy): Promise<PtoPolicy> {
    const id = uuidv4();
    const [policy] = await db.insert(ptoPolicies).values({
      ...data,
      policyLevel: (data.policyLevel || 'COMPANY') as 'COMPANY' | 'DEPARTMENT' | 'INDIVIDUAL',
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    return policy;
  }
  
  async getPtoPolicyByEmployee(employeeId: string): Promise<PtoPolicy | null> {
    const [policy] = await db.select().from(ptoPolicies)
      .where(eq(ptoPolicies.employeeId, employeeId));
    return policy || null;
  }

  // Alias for backwards compatibility
  async getPtoPolicyByEmployeeId(employeeId: string): Promise<PtoPolicy | null> {
    return this.getPtoPolicyByEmployee(employeeId);
  }
  
  async getAllPtoPolicies(): Promise<PtoPolicy[]> {
    return await db.select().from(ptoPolicies);
  }
  
  async updatePtoPolicy(id: string, data: Partial<InsertPtoPolicy>): Promise<PtoPolicy> {
    const { policyLevel, ...restData } = data;
    const updateData: Partial<PtoPolicy> = {
      ...restData,
      ...(policyLevel ? { policyLevel: policyLevel as 'COMPANY' | 'DEPARTMENT' | 'INDIVIDUAL' } : {}),
      updatedAt: new Date()
    };
    const [policy] = await db.update(ptoPolicies)
      .set(updateData)
      .where(eq(ptoPolicies.id, id))
      .returning();
    return policy;
  }

  async deletePtoPolicy(id: string): Promise<void> {
    await db.delete(ptoPolicies).where(eq(ptoPolicies.id, id));
  }
  
  // Department PTO Settings Implementation - NEW
  async getDepartmentPtoSettings(): Promise<DepartmentPtoSetting[]> {
    return await db.select().from(departmentPtoSettings);
  }

  async getDepartmentPtoSettingByDepartment(department: string): Promise<DepartmentPtoSetting | null> {
    const [setting] = await db.select().from(departmentPtoSettings)
      .where(eq(departmentPtoSettings.department, department));
    return setting || null;
  }

  async createDepartmentPtoSetting(data: InsertDepartmentPtoSetting): Promise<DepartmentPtoSetting> {
    // Check if department setting already exists
    const existing = await this.getDepartmentPtoSettingByDepartment(data.department);
    if (existing) {
      // Update existing setting instead of creating duplicate
      return await this.updateDepartmentPtoSetting(existing.id, data);
    }
    
    const id = uuidv4();
    const [setting] = await db.insert(departmentPtoSettings).values({ ...data, id }).returning();
    return setting;
  }
  
  async updateDepartmentPtoSetting(id: string, data: Partial<InsertDepartmentPtoSetting>): Promise<DepartmentPtoSetting> {
    const [setting] = await db.update(departmentPtoSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(departmentPtoSettings.id, id))
      .returning();
    return setting;
  }

  async deleteDepartmentPtoSetting(id: string): Promise<void> {
    await db.delete(departmentPtoSettings).where(eq(departmentPtoSettings.id, id));
  }
  
  async getAllDepartmentPtoSettings(): Promise<DepartmentPtoSetting[]> {
    return await db.select().from(departmentPtoSettings);
  }
  
  // COI Document Management Implementation - NEW
  async createCoiDocument(data: Omit<InsertCoiDocument, 'id'>): Promise<CoiDocument> {
    const id = uuidv4();
    const [doc] = await db.insert(coiDocuments).values({ ...data, id }).returning();
    return doc;
  }
  
  async getCoiDocumentById(id: string): Promise<CoiDocument | null> {
    const [doc] = await db.select().from(coiDocuments).where(eq(coiDocuments.id, id));
    return doc || null;
  }
  
  async getCoiDocumentsByEmployeeId(employeeId: string): Promise<CoiDocument[]> {
    return await db.select().from(coiDocuments)
      .where(eq(coiDocuments.employeeId, employeeId));
  }
  
  async getAllCoiDocuments(): Promise<CoiDocument[]> {
    return await db.select().from(coiDocuments);
  }
  
  async getExpiringCoiDocuments(daysBeforeExpiration: number): Promise<CoiDocument[]> {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysBeforeExpiration);
    
    // Use string comparison for dates stored as text
    const targetDateStr = targetDate.toISOString().split('T')[0];
    
    return await db.select().from(coiDocuments)
      .where(lt(coiDocuments.expirationDate, targetDateStr));
  }
  
  async updateCoiDocument(id: string, data: Partial<InsertCoiDocument>): Promise<CoiDocument> {
    const [doc] = await db.update(coiDocuments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(coiDocuments.id, id))
      .returning();
    return doc;
  }
  
  async deleteCoiDocument(id: string): Promise<void> {
    await db.delete(coiDocuments).where(eq(coiDocuments.id, id));
  }

  async clearAllCoiDocuments(): Promise<number> {
    const result = await db.delete(coiDocuments);
    return result.rowCount || 0;
  }

  async clearAllToolAssignments(): Promise<number> {
    const result = await db.delete(toolAssignments);
    return result.rowCount || 0;
  }

  // Employee Assignment Management Implementation - NEW
  async createEmployeeAssignment(data: Omit<InsertEmployeeAssignment, 'id' | 'createdAt' | 'updatedAt'>): Promise<EmployeeAssignment> {
    const id = uuidv4();
    const [assignment] = await db.insert(employeeAssignments).values({ ...data, id }).returning();
    return assignment;
  }
  
  async getEmployeeAssignmentById(id: string): Promise<EmployeeAssignment | null> {
    const [assignment] = await db.select().from(employeeAssignments)
      .where(eq(employeeAssignments.id, id));
    return assignment || null;
  }
  
  async getEmployeeAssignmentsByEmployeeId(employeeId: string): Promise<EmployeeAssignment[]> {
    return await db.select().from(employeeAssignments)
      .where(eq(employeeAssignments.employeeId, employeeId));
  }
  
  async getEmployeeAssignmentsByAssignedToId(assignedToId: string): Promise<EmployeeAssignment[]> {
    return await db.select().from(employeeAssignments)
      .where(eq(employeeAssignments.assignedToId, assignedToId));
  }
  
  async updateEmployeeAssignment(id: string, data: Partial<InsertEmployeeAssignment>): Promise<EmployeeAssignment> {
    const [assignment] = await db.update(employeeAssignments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(employeeAssignments.id, id))
      .returning();
    return assignment;
  }
  
  async deleteEmployeeAssignment(id: string): Promise<void> {
    await db.delete(employeeAssignments).where(eq(employeeAssignments.id, id));
  }

  // HR Assignment Management Implementation (Sourcer Assignments) - NEW
  async createHrAssignment(data: Omit<InsertHrAssignment, 'id' | 'createdAt' | 'updatedAt'>): Promise<HrAssignment> {
    const id = uuidv4();
    const [assignment] = await db.insert(hrAssignments).values({ ...data, id }).returning();
    return assignment;
  }

  async getHrAssignmentById(id: string): Promise<HrAssignment | null> {
    const [assignment] = await db.select().from(hrAssignments)
      .where(eq(hrAssignments.id, id));
    return assignment || null;
  }

  async getHrAssignmentsByCandidateId(candidateId: string): Promise<HrAssignment[]> {
    return await db.select().from(hrAssignments)
      .where(and(
        eq(hrAssignments.assigneeId, candidateId),
        eq(hrAssignments.type, 'CANDIDATE')
      ))
      .orderBy(hrAssignments.createdAt);
  }

  async getActiveAssignmentsByHrMemberId(hrMemberId: string): Promise<HrAssignment[]> {
    return await db.select().from(hrAssignments)
      .where(and(
        eq(hrAssignments.hrMemberId, hrMemberId),
        eq(hrAssignments.status, 'ACTIVE')
      ))
      .orderBy(hrAssignments.createdAt);
  }

  async getAllHrAssignments(): Promise<HrAssignment[]> {
    return await db.select().from(hrAssignments)
      .orderBy(hrAssignments.createdAt);
  }

  async updateHrAssignment(id: string, data: Partial<InsertHrAssignment>): Promise<HrAssignment> {
    const [assignment] = await db.update(hrAssignments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(hrAssignments.id, id))
      .returning();
    return assignment;
  }

  async deleteHrAssignment(id: string): Promise<void> {
    await db.delete(hrAssignments).where(eq(hrAssignments.id, id));
  }

  // HR Performance Metrics Implementation - NEW
  async createHrPerformanceMetric(data: Omit<InsertHrPerformanceMetric, 'id' | 'createdAt' | 'updatedAt'>): Promise<HrPerformanceMetric> {
    const id = uuidv4();
    const [metric] = await db.insert(hrPerformanceMetrics).values({ ...data, id }).returning();
    return metric;
  }

  async getHrPerformanceMetricById(id: string): Promise<HrPerformanceMetric | null> {
    const [metric] = await db.select().from(hrPerformanceMetrics)
      .where(eq(hrPerformanceMetrics.id, id));
    return metric || null;
  }

  async getHrPerformanceMetricsByHrMemberId(hrMemberId: string): Promise<HrPerformanceMetric[]> {
    return await db.select().from(hrPerformanceMetrics)
      .where(eq(hrPerformanceMetrics.hrMemberId, hrMemberId))
      .orderBy(hrPerformanceMetrics.period);
  }

  async updateHrPerformanceMetric(id: string, data: Partial<InsertHrPerformanceMetric>): Promise<HrPerformanceMetric> {
    const [metric] = await db.update(hrPerformanceMetrics)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(hrPerformanceMetrics.id, id))
      .returning();
    return metric;
  }

  // Contract Template Management Implementation - NEW
  async createContractTemplate(data: InsertContractTemplate): Promise<ContractTemplate> {
    const id = uuidv4();
    const [template] = await db.insert(contractTemplates).values({ ...data, id }).returning();
    return template;
  }
  
  async getContractTemplateById(id: string): Promise<ContractTemplate | null> {
    const [template] = await db.select().from(contractTemplates)
      .where(eq(contractTemplates.id, id));
    return template || null;
  }
  
  async getAllContractTemplates(): Promise<ContractTemplate[]> {
    return await db.select().from(contractTemplates);
  }
  
  async getContractTemplatesByTerritory(territory: string): Promise<ContractTemplate[]> {
    return await db.select().from(contractTemplates)
      .where(eq(contractTemplates.territory, territory));
  }
  
  async updateContractTemplate(id: string, data: Partial<InsertContractTemplate>): Promise<ContractTemplate> {
    const [template] = await db.update(contractTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(contractTemplates.id, id))
      .returning();
    return template;
  }
  
  async deleteContractTemplate(id: string): Promise<void> {
    await db.delete(contractTemplates).where(eq(contractTemplates.id, id));
  }
  
  // Employee Contract Management Implementation - NEW
  async createEmployeeContract(data: InsertEmployeeContract): Promise<EmployeeContract> {
    const id = uuidv4();
    const [contract] = await db.insert(employeeContracts).values({ ...data, id }).returning();
    return contract;
  }
  
  async getEmployeeContractById(id: string): Promise<EmployeeContract | null> {
    const [contract] = await db.select().from(employeeContracts)
      .where(eq(employeeContracts.id, id));
    return contract || null;
  }
  
  async getEmployeeContractsByEmployeeId(employeeId: string): Promise<EmployeeContract[]> {
    return await db.select().from(employeeContracts)
      .where(eq(employeeContracts.employeeId, employeeId));
  }
  
  async getAllEmployeeContracts(): Promise<EmployeeContract[]> {
    return await db.select().from(employeeContracts);
  }
  
  async updateEmployeeContract(id: string, data: Partial<InsertEmployeeContract>): Promise<EmployeeContract> {
    const [contract] = await db.update(employeeContracts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(employeeContracts.id, id))
      .returning();
    return contract;
  }
  
  async deleteEmployeeContract(id: string): Promise<void> {
    await db.delete(employeeContracts).where(eq(employeeContracts.id, id));
  }

  // Additional PTO Policy Methods for Three-Level System
  async getPtoPolicyById(id: string): Promise<PtoPolicy | null> {
    const [policy] = await db.select().from(ptoPolicies)
      .where(eq(ptoPolicies.id, id));
    return policy || null;
  }

  // Action handler methods for Susan AI
  async getCandidateByName(name: string): Promise<Candidate | null> {
    // Search by full name or partial match
    const results = await db.select().from(candidates)
      .where(
        or(
          eq(candidates.firstName, name),
          eq(candidates.lastName, name),
          sql`CONCAT(${candidates.firstName}, ' ', ${candidates.lastName}) = ${name}`
        )
      );
    return results[0] || null;
  }

  async scheduleInterview(candidateId: string, interviewData: Partial<InsertInterview>): Promise<Interview> {
    return await this.createInterview({
      candidateId,
      interviewerId: interviewData.interviewerId || '',
      scheduledDate: interviewData.scheduledDate || new Date(),
      type: interviewData.type || 'VIDEO',
      ...interviewData
    } as InsertInterview);
  }

  async sendEmailNotification(to: string, subject: string, message: string): Promise<boolean> {
    try {
      // Log email for tracking
      await this.createEmailLog({
        candidateId: '', // can be empty for system notifications
        subject,
        content: message,
        toEmail: to,
        fromEmail: 'hr@roof-er.com',
        status: 'SENT'
      });
      
      // In a real implementation, this would integrate with email service
      console.log('[EMAIL] Sent email to:', to, 'Subject:', subject);
      return true;
    } catch (error) {
      console.error('[EMAIL] Failed to send email:', error);
      return false;
    }
  }

  async checkPtoBalance(employeeId: string): Promise<{ available: number; used: number; total: number }> {
    // Get PTO policy for employee
    const policy = await this.getPtoPolicyByEmployee(employeeId);
    if (!policy) {
      return { available: 0, used: 0, total: 0 };
    }

    // Calculate used PTO days from approved requests this year
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31);
    
    const approvedRequests = await db.select().from(ptoRequests)
      .where(
        and(
          eq(ptoRequests.employeeId, employeeId),
          eq(ptoRequests.status, 'APPROVED'),
          gte(ptoRequests.startDate, startOfYear.toISOString()),
          lte(ptoRequests.endDate, endOfYear.toISOString())
        )
      );

    const usedDays = approvedRequests.reduce((total, request) => total + (request.days || 0), 0);
    const totalAllowance = policy.totalDays || 0;
    const available = Math.max(0, totalAllowance - usedDays);

    return { available, used: usedDays, total: totalAllowance };
  }

  async createPtoRequestForEmployee(employeeId: string, requestData: Partial<InsertPtoRequest>): Promise<PtoRequest> {
    return await this.createPtoRequest({
      employeeId,
      status: 'PENDING',
      ...requestData
    } as InsertPtoRequest & { employeeId: string });
  }
  
  // Google Sync Helper Methods
  async getUserByName(name: string): Promise<User | null> {
    const [firstName, ...lastNameParts] = name.split(' ');
    const lastName = lastNameParts.join(' ');
    
    const [user] = await db.select().from(users)
      .where(and(
        eq(users.firstName, firstName),
        eq(users.lastName, lastName)
      ));
    return user || null;
  }
  
  async getUsersByRole(role: string): Promise<User[]> {
    return await db.select().from(users)
      .where(eq(users.role, role as any));
  }
  
  async getAllToolInventory(): Promise<ToolInventory[]> {
    return await db.select().from(toolInventory);
  }
  
  async updateToolInventory(id: string, data: any): Promise<ToolInventory> {
    const [tool] = await db.update(toolInventory)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(toolInventory.id, id))
      .returning();
    return tool;
  }
  
  async createCOIDocument(data: any): Promise<any> {
    const id = uuidv4();
    const [doc] = await db.insert(coiDocuments).values({ ...data, id }).returning();
    return doc;
  }
  
  async getAllCOIDocuments(): Promise<any[]> {
    return await db.select().from(coiDocuments);
  }
  
  async updatePTORequest(id: string, data: Partial<PtoRequest>): Promise<PtoRequest> {
    const [updated] = await db.update(ptoRequests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(ptoRequests.id, id))
      .returning();
    return updated;
  }
  
  async getAllPerformanceReviews(): Promise<EmployeeReview[]> {
    return await db.select().from(employeeReviews);
  }
  
  async updateCOIDocument(id: string, data: Partial<CoiDocument>): Promise<CoiDocument> {
    const [updated] = await db.update(coiDocuments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(coiDocuments.id, id))
      .returning();
    return updated;
  }
  
  async getAllTools(): Promise<ToolInventory[]> {
    return await db.select().from(toolInventory);
  }
  
  async createTool(data: Partial<ToolInventory>): Promise<ToolInventory> {
    const id = uuidv4();
    const [tool] = await db.insert(toolInventory).values({ ...data, id } as any).returning();
    return tool;
  }
  
  async updateTool(id: string, data: Partial<ToolInventory>): Promise<ToolInventory> {
    const [updated] = await db.update(toolInventory)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(toolInventory.id, id))
      .returning();
    return updated;
  }

  // Equipment Receipt methods
  async createEquipmentReceipt(data: any): Promise<any> {
    const [receipt] = await db.insert(equipmentReceipts).values(data).returning();
    return receipt;
  }

  async getEquipmentReceiptById(id: string): Promise<any | null> {
    const [receipt] = await db.select().from(equipmentReceipts).where(eq(equipmentReceipts.id, id));
    return receipt || null;
  }

  async getEquipmentReceiptsByEmployee(employeeId: string): Promise<any[]> {
    return await db.select().from(equipmentReceipts).where(eq(equipmentReceipts.employeeId, employeeId));
  }

  async updateEquipmentReceipt(id: string, data: any): Promise<any> {
    const [updated] = await db.update(equipmentReceipts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(equipmentReceipts.id, id))
      .returning();
    return updated;
  }

  async getPendingEquipmentReceipts(): Promise<any[]> {
    return await db.select().from(equipmentReceipts).where(eq(equipmentReceipts.status, 'PENDING'));
  }

  // Equipment Receipt Tokens (for public signing links)
  async createEquipmentReceiptToken(data: { id: string; receiptId: string; startDate: Date; expiresAt: Date }): Promise<any> {
    const [token] = await db.insert(equipmentReceiptTokens).values({
      id: data.id,
      receiptId: data.receiptId,
      startDate: data.startDate,
      expiresAt: data.expiresAt,
    }).returning();
    return token;
  }

  async getEquipmentReceiptToken(id: string): Promise<any | null> {
    const [token] = await db.select().from(equipmentReceiptTokens).where(eq(equipmentReceiptTokens.id, id));
    return token || null;
  }

  async markEquipmentReceiptTokenUsed(id: string): Promise<any> {
    const [updated] = await db.update(equipmentReceiptTokens)
      .set({ usedAt: new Date() })
      .where(eq(equipmentReceiptTokens.id, id))
      .returning();
    return updated;
  }

  // Search method
  async search(query: string, userRole: string): Promise<any[]> {
    const results: any[] = [];
    const searchTerm = query.toLowerCase();
    
    // Search employees
    const employees = await db.select().from(users);
    employees.forEach(emp => {
      if (
        emp.firstName?.toLowerCase().includes(searchTerm) ||
        emp.lastName?.toLowerCase().includes(searchTerm) ||
        emp.email?.toLowerCase().includes(searchTerm) ||
        emp.position?.toLowerCase().includes(searchTerm)
      ) {
        results.push({
          id: emp.id,
          type: 'employee',
          title: `${emp.firstName} ${emp.lastName}`,
          subtitle: `${emp.position} - ${emp.department}`,
          link: `/employees/${emp.id}`
        });
      }
    });
    
    // Search candidates
    const candidateList = await db.select().from(candidates);
    candidateList.forEach(cand => {
      if (
        cand.firstName?.toLowerCase().includes(searchTerm) ||
        cand.lastName?.toLowerCase().includes(searchTerm) ||
        cand.email?.toLowerCase().includes(searchTerm) ||
        cand.position?.toLowerCase().includes(searchTerm)
      ) {
        results.push({
          id: cand.id,
          type: 'candidate',
          title: `${cand.firstName} ${cand.lastName}`,
          subtitle: `${cand.position} - ${cand.status}`,
          link: `/recruiting?candidateId=${cand.id}`
        });
      }
    });
    
    // Search PTO requests
    const ptoList = await db.select().from(ptoRequests);
    for (const pto of ptoList) {
      const employee = await this.getUserById(pto.employeeId);
      if (employee) {
        if (
          employee.firstName?.toLowerCase().includes(searchTerm) ||
          employee.lastName?.toLowerCase().includes(searchTerm) ||
          pto.reason?.toLowerCase().includes(searchTerm)
        ) {
          results.push({
            id: pto.id,
            type: 'pto',
            title: `PTO Request - ${employee.firstName} ${employee.lastName}`,
            subtitle: `${pto.reason} - ${pto.status}`,
            link: `/pto`
          });
        }
      }
    }
    
    // Search tools/equipment
    const tools = await db.select().from(toolInventory);
    tools.forEach(tool => {
      if (
        tool.name?.toLowerCase().includes(searchTerm) ||
        tool.category?.toLowerCase().includes(searchTerm) ||
        tool.serialNumber?.toLowerCase().includes(searchTerm)
      ) {
        results.push({
          id: tool.id,
          type: 'tool',
          title: tool.name,
          subtitle: `${tool.category} - ${tool.availableQuantity} available`,
          link: `/tools`
        });
      }
    });
    
    // Search documents if user has appropriate role
    if (['ADMIN', 'MANAGER'].includes(userRole)) {
      const docs = await db.select().from(documents);
      docs.forEach(doc => {
        if (
          doc.name?.toLowerCase().includes(searchTerm) ||
          doc.type?.toLowerCase().includes(searchTerm)
        ) {
          results.push({
            id: doc.id,
            type: 'document',
            title: doc.name,
            subtitle: doc.type,
            link: `/documents/${doc.id}`
          });
        }
      });
    }
    
    return results.slice(0, 20); // Limit to 20 results
  }

  // Attendance Management Methods
  async createAttendanceSession(data: InsertAttendanceSession): Promise<AttendanceSession> {
    const id = uuidv4();
    const qrToken = uuidv4(); // Generate unique token
    const [session] = await db.insert(attendanceSessions).values({
      ...data,
      id,
      qrToken: data.qrToken || qrToken,
    }).returning();
    return session;
  }

  async getAttendanceSessionById(id: string): Promise<AttendanceSession | null> {
    const [session] = await db.select().from(attendanceSessions).where(eq(attendanceSessions.id, id));
    return session || null;
  }

  async getAttendanceSessionByToken(token: string): Promise<AttendanceSession | null> {
    const [session] = await db.select().from(attendanceSessions).where(eq(attendanceSessions.qrToken, token));
    return session || null;
  }

  async getAllAttendanceSessions(): Promise<AttendanceSession[]> {
    return db.select().from(attendanceSessions).orderBy(attendanceSessions.createdAt);
  }

  async getActiveAttendanceSessions(): Promise<AttendanceSession[]> {
    return db.select().from(attendanceSessions)
      .where(eq(attendanceSessions.status, 'ACTIVE'))
      .orderBy(attendanceSessions.createdAt);
  }

  async updateAttendanceSession(id: string, data: Partial<InsertAttendanceSession>): Promise<AttendanceSession> {
    const [session] = await db.update(attendanceSessions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(attendanceSessions.id, id))
      .returning();
    return session;
  }

  async closeAttendanceSession(id: string): Promise<AttendanceSession> {
    const [session] = await db.update(attendanceSessions)
      .set({ status: 'CLOSED', updatedAt: new Date() })
      .where(eq(attendanceSessions.id, id))
      .returning();
    return session;
  }

  async rotateSessionToken(id: string): Promise<AttendanceSession> {
    const newToken = uuidv4();
    const [session] = await db.update(attendanceSessions)
      .set({ qrToken: newToken, updatedAt: new Date() })
      .where(eq(attendanceSessions.id, id))
      .returning();
    return session;
  }

  async createAttendanceCheckIn(data: InsertAttendanceCheckIn): Promise<AttendanceCheckIn> {
    const id = uuidv4();
    const [checkIn] = await db.insert(attendanceCheckIns).values({
      ...data,
      id,
    }).returning();
    return checkIn;
  }

  async getAttendanceCheckInById(id: string): Promise<AttendanceCheckIn | null> {
    const [checkIn] = await db.select().from(attendanceCheckIns).where(eq(attendanceCheckIns.id, id));
    return checkIn || null;
  }

  async getCheckInsBySessionId(sessionId: string): Promise<AttendanceCheckIn[]> {
    return db.select().from(attendanceCheckIns)
      .where(eq(attendanceCheckIns.sessionId, sessionId))
      .orderBy(attendanceCheckIns.checkedInAt);
  }

  async getCheckInsByUserId(userId: string): Promise<AttendanceCheckIn[]> {
    return db.select().from(attendanceCheckIns)
      .where(eq(attendanceCheckIns.userId, userId))
      .orderBy(attendanceCheckIns.checkedInAt);
  }

  async hasUserCheckedIn(sessionId: string, userId: string | null, name: string): Promise<boolean> {
    const conditions = userId 
      ? or(
          eq(attendanceCheckIns.userId, userId),
          eq(attendanceCheckIns.name, name)
        )
      : eq(attendanceCheckIns.name, name);
      
    const [existing] = await db.select()
      .from(attendanceCheckIns)
      .where(and(
        eq(attendanceCheckIns.sessionId, sessionId),
        conditions
      ));
    
    return !!existing;
  }

  async exportSessionAttendance(sessionId: string): Promise<AttendanceCheckIn[]> {
    return this.getCheckInsBySessionId(sessionId);
  }

  // Equipment Checklist Management Methods
  async createEquipmentChecklist(data: InsertEquipmentChecklist): Promise<any> {
    const id = uuidv4();
    const [checklist] = await db.insert(equipmentChecklists).values({ ...data, id } as any).returning();
    return checklist;
  }

  async getEquipmentChecklistById(id: string): Promise<any | null> {
    const [checklist] = await db.select().from(equipmentChecklists)
      .where(eq(equipmentChecklists.id, id));
    return checklist || null;
  }

  async getEquipmentChecklistByToken(token: string): Promise<any | null> {
    const [checklist] = await db.select().from(equipmentChecklists)
      .where(eq(equipmentChecklists.accessToken, token));
    return checklist || null;
  }

  async getEquipmentChecklistsByEmployee(employeeId: string): Promise<any[]> {
    return db.select().from(equipmentChecklists)
      .where(eq(equipmentChecklists.employeeId, employeeId));
  }

  async getAllEquipmentChecklists(): Promise<any[]> {
    return db.select().from(equipmentChecklists);
  }

  async updateEquipmentChecklist(id: string, data: Partial<InsertEquipmentChecklist>): Promise<any> {
    const updateData = { ...data, updatedAt: new Date() };
    const [checklist] = await db.update(equipmentChecklists)
      .set(updateData as any)
      .where(eq(equipmentChecklists.id, id))
      .returning();
    return checklist;
  }

  async deleteEquipmentChecklist(id: string): Promise<void> {
    await db.delete(equipmentChecklists).where(eq(equipmentChecklists.id, id));
  }

  // Termination Reminder Management Methods
  async createTerminationReminder(data: InsertTerminationReminder): Promise<any> {
    const id = uuidv4();
    const [reminder] = await db.insert(terminationReminders).values({ ...data, id }).returning();
    return reminder;
  }

  async getTerminationReminderById(id: string): Promise<any | null> {
    const [reminder] = await db.select().from(terminationReminders)
      .where(eq(terminationReminders.id, id));
    return reminder || null;
  }

  async getTerminationReminderByEmployee(employeeId: string): Promise<any | null> {
    const [reminder] = await db.select().from(terminationReminders)
      .where(eq(terminationReminders.employeeId, employeeId));
    return reminder || null;
  }

  async getPendingTerminationReminders(): Promise<any[]> {
    return db.select().from(terminationReminders)
      .where(and(
        eq(terminationReminders.itemsReturned, false),
        sql`${terminationReminders.resolvedAt} IS NULL`
      ));
  }

  async updateTerminationReminder(id: string, data: any): Promise<any> {
    const [reminder] = await db.update(terminationReminders)
      .set(data)
      .where(eq(terminationReminders.id, id))
      .returning();
    return reminder;
  }

  async resolveTerminationReminder(id: string, itemsReturned: boolean): Promise<any> {
    return this.updateTerminationReminder(id, {
      itemsReturned,
      resolvedAt: new Date()
    });
  }

  // ============================================
  // Equipment Agreement Methods
  // ============================================

  async createEquipmentAgreement(data: any): Promise<EquipmentAgreement> {
    const id = uuidv4();
    const [agreement] = await db.insert(equipmentAgreements).values({ ...data, id } as any).returning();
    return agreement;
  }

  async getEquipmentAgreementById(id: string): Promise<EquipmentAgreement | null> {
    const [agreement] = await db.select().from(equipmentAgreements)
      .where(eq(equipmentAgreements.id, id));
    return agreement || null;
  }

  async getEquipmentAgreementByToken(token: string): Promise<EquipmentAgreement | null> {
    const [agreement] = await db.select().from(equipmentAgreements)
      .where(eq(equipmentAgreements.accessToken, token));
    return agreement || null;
  }

  async getEquipmentAgreementsByEmployee(employeeId: string): Promise<EquipmentAgreement[]> {
    return db.select().from(equipmentAgreements)
      .where(eq(equipmentAgreements.employeeId, employeeId));
  }

  async getAllEquipmentAgreements(): Promise<EquipmentAgreement[]> {
    return db.select().from(equipmentAgreements);
  }

  async getPendingEquipmentAgreements(): Promise<EquipmentAgreement[]> {
    return db.select().from(equipmentAgreements)
      .where(eq(equipmentAgreements.status, 'PENDING'));
  }

  async updateEquipmentAgreement(id: string, data: Partial<EquipmentAgreement>): Promise<EquipmentAgreement> {
    const [agreement] = await db.update(equipmentAgreements)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(equipmentAgreements.id, id))
      .returning();
    return agreement;
  }

  async signEquipmentAgreement(id: string, signatureData: string, signatureIp: string): Promise<EquipmentAgreement> {
    return this.updateEquipmentAgreement(id, {
      signatureData,
      signatureIp,
      signedAt: new Date(),
      status: 'SIGNED'
    });
  }

  async deleteEquipmentAgreement(id: string): Promise<void> {
    await db.delete(equipmentAgreements)
      .where(eq(equipmentAgreements.id, id));
  }

  // ============================================
  // Role Equipment Defaults Methods
  // ============================================

  async createRoleEquipmentDefault(data: any): Promise<RoleEquipmentDefault> {
    const id = uuidv4();
    const [defaults] = await db.insert(roleEquipmentDefaults).values({ ...data, id } as any).returning();
    return defaults;
  }

  async getRoleEquipmentDefaultByRole(role: string): Promise<RoleEquipmentDefault | null> {
    const [defaults] = await db.select().from(roleEquipmentDefaults)
      .where(eq(roleEquipmentDefaults.role, role));
    return defaults || null;
  }

  async getAllRoleEquipmentDefaults(): Promise<RoleEquipmentDefault[]> {
    return db.select().from(roleEquipmentDefaults);
  }

  async updateRoleEquipmentDefault(id: string, data: Partial<RoleEquipmentDefault>): Promise<RoleEquipmentDefault> {
    const [defaults] = await db.update(roleEquipmentDefaults)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(roleEquipmentDefaults.id, id))
      .returning();
    return defaults;
  }

  async upsertRoleEquipmentDefault(role: string, items: string): Promise<RoleEquipmentDefault> {
    const existing = await this.getRoleEquipmentDefaultByRole(role);
    if (existing) {
      return this.updateRoleEquipmentDefault(existing.id, { items });
    }
    return this.createRoleEquipmentDefault({ role, items });
  }

  async deleteRoleEquipmentDefault(id: string): Promise<void> {
    await db.delete(roleEquipmentDefaults)
      .where(eq(roleEquipmentDefaults.id, id));
  }

  // ============================================
  // SUPER ADMIN CONTROL CENTER METHODS
  // ============================================

  // API Metrics Methods
  async createApiMetric(data: InsertApiMetric): Promise<ApiMetric> {
    const id = uuidv4();
    const [metric] = await db.insert(apiMetrics).values({ ...data, id } as any).returning();
    return metric;
  }

  async getApiMetrics(options?: {
    startDate?: Date;
    endDate?: Date;
    endpoint?: string;
    statusCode?: number;
    limit?: number;
  }): Promise<ApiMetric[]> {
    let query = db.select().from(apiMetrics);

    const conditions = [];
    if (options?.startDate) {
      conditions.push(gte(apiMetrics.timestamp, options.startDate));
    }
    if (options?.endDate) {
      conditions.push(lte(apiMetrics.timestamp, options.endDate));
    }
    if (options?.endpoint) {
      conditions.push(eq(apiMetrics.endpoint, options.endpoint));
    }
    if (options?.statusCode) {
      conditions.push(eq(apiMetrics.statusCode, options.statusCode));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = await query.orderBy(sql`${apiMetrics.timestamp} DESC`).limit(options?.limit || 1000);
    return results;
  }

  async getApiMetricsSummary(timeWindowMinutes: number = 60): Promise<{
    totalRequests: number;
    errorCount: number;
    avgResponseTime: number;
    successRate: number;
  }> {
    const startTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
    const metrics = await this.getApiMetrics({ startDate: startTime });

    const totalRequests = metrics.length;
    const errorCount = metrics.filter(m => m.statusCode >= 400).length;
    const avgResponseTime = totalRequests > 0
      ? metrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests
      : 0;
    const successRate = totalRequests > 0 ? ((totalRequests - errorCount) / totalRequests) * 100 : 100;

    return { totalRequests, errorCount, avgResponseTime, successRate };
  }

  async getEndpointStats(timeWindowMinutes: number = 60): Promise<Array<{
    endpoint: string;
    method: string;
    requestCount: number;
    errorCount: number;
    avgResponseTime: number;
  }>> {
    const startTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
    const metrics = await this.getApiMetrics({ startDate: startTime });

    const endpointMap = new Map<string, {
      endpoint: string;
      method: string;
      requests: number;
      errors: number;
      totalTime: number;
    }>();

    for (const m of metrics) {
      const key = `${m.method}:${m.endpoint}`;
      const existing = endpointMap.get(key) || {
        endpoint: m.endpoint,
        method: m.method,
        requests: 0,
        errors: 0,
        totalTime: 0
      };
      existing.requests++;
      if (m.statusCode >= 400) existing.errors++;
      existing.totalTime += m.responseTime;
      endpointMap.set(key, existing);
    }

    return Array.from(endpointMap.values()).map(e => ({
      endpoint: e.endpoint,
      method: e.method,
      requestCount: e.requests,
      errorCount: e.errors,
      avgResponseTime: e.requests > 0 ? e.totalTime / e.requests : 0
    }));
  }

  async getApiErrors(limit: number = 100): Promise<ApiMetric[]> {
    return db.select().from(apiMetrics)
      .where(gte(apiMetrics.statusCode, 400))
      .orderBy(sql`${apiMetrics.timestamp} DESC`)
      .limit(limit);
  }

  async cleanupOldApiMetrics(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const result = await db.delete(apiMetrics)
      .where(lt(apiMetrics.timestamp, cutoffDate));
    return (result as any).rowCount || 0;
  }

  // Feature Toggles Methods
  async createFeatureToggle(data: InsertFeatureToggle): Promise<FeatureToggle> {
    const id = uuidv4();
    const [toggle] = await db.insert(featureToggles).values({ ...data, id } as any).returning();
    return toggle;
  }

  async getFeatureToggleById(id: string): Promise<FeatureToggle | null> {
    const [toggle] = await db.select().from(featureToggles).where(eq(featureToggles.id, id));
    return toggle || null;
  }

  async getFeatureToggleByKey(key: string): Promise<FeatureToggle | null> {
    const [toggle] = await db.select().from(featureToggles).where(eq(featureToggles.featureKey, key));
    return toggle || null;
  }

  async getAllFeatureToggles(): Promise<FeatureToggle[]> {
    return db.select().from(featureToggles).orderBy(featureToggles.category, featureToggles.featureName);
  }

  async updateFeatureToggle(id: string, data: Partial<FeatureToggle>): Promise<FeatureToggle> {
    const [toggle] = await db.update(featureToggles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(featureToggles.id, id))
      .returning();
    return toggle;
  }

  async toggleFeature(key: string, enabled: boolean, updatedBy: string): Promise<FeatureToggle | null> {
    const toggle = await this.getFeatureToggleByKey(key);
    if (!toggle) return null;
    return this.updateFeatureToggle(toggle.id, { isEnabled: enabled, updatedBy });
  }

  async isFeatureEnabled(key: string): Promise<boolean> {
    const toggle = await this.getFeatureToggleByKey(key);
    return toggle?.isEnabled ?? true; // Default to enabled if not found
  }

  async deleteFeatureToggle(id: string): Promise<void> {
    await db.delete(featureToggles).where(eq(featureToggles.id, id));
  }

  // System Audit Logs Methods
  async createAuditLog(data: InsertSystemAuditLog): Promise<SystemAuditLog> {
    const id = uuidv4();
    const [log] = await db.insert(systemAuditLogs).values({ ...data, id } as any).returning();
    return log;
  }

  async getAuditLogs(options?: {
    userId?: string;
    action?: string;
    resourceType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<SystemAuditLog[]> {
    let query = db.select().from(systemAuditLogs);

    const conditions = [];
    if (options?.userId) {
      conditions.push(eq(systemAuditLogs.userId, options.userId));
    }
    if (options?.action) {
      conditions.push(eq(systemAuditLogs.action, options.action as any));
    }
    if (options?.resourceType) {
      conditions.push(eq(systemAuditLogs.resourceType, options.resourceType));
    }
    if (options?.startDate) {
      conditions.push(gte(systemAuditLogs.createdAt, options.startDate));
    }
    if (options?.endDate) {
      conditions.push(lte(systemAuditLogs.createdAt, options.endDate));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return query.orderBy(sql`${systemAuditLogs.createdAt} DESC`).limit(options?.limit || 500);
  }

  // API Alerts Methods
  async createApiAlert(data: InsertApiAlert): Promise<ApiAlert> {
    const id = uuidv4();
    const [alert] = await db.insert(apiAlerts).values({ ...data, id } as any).returning();
    return alert;
  }

  async getApiAlertById(id: string): Promise<ApiAlert | null> {
    const [alert] = await db.select().from(apiAlerts).where(eq(apiAlerts.id, id));
    return alert || null;
  }

  async getAllApiAlerts(): Promise<ApiAlert[]> {
    return db.select().from(apiAlerts).orderBy(apiAlerts.alertName);
  }

  async getActiveApiAlerts(): Promise<ApiAlert[]> {
    return db.select().from(apiAlerts).where(eq(apiAlerts.isActive, true));
  }

  async updateApiAlert(id: string, data: Partial<ApiAlert>): Promise<ApiAlert> {
    const [alert] = await db.update(apiAlerts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(apiAlerts.id, id))
      .returning();
    return alert;
  }

  async triggerAlert(id: string): Promise<ApiAlert> {
    const [alert] = await db.update(apiAlerts)
      .set({
        lastTriggered: new Date(),
        triggerCount: sql`${apiAlerts.triggerCount} + 1`
      })
      .where(eq(apiAlerts.id, id))
      .returning();
    return alert;
  }

  async deleteApiAlert(id: string): Promise<void> {
    await db.delete(apiAlerts).where(eq(apiAlerts.id, id));
  }

  // SQL Query History Methods
  async createSqlQueryHistory(data: InsertSqlQueryHistory): Promise<SqlQueryHistoryEntry> {
    const id = uuidv4();
    const [entry] = await db.insert(sqlQueryHistory).values({ ...data, id } as any).returning();
    return entry;
  }

  async getSqlQueryHistory(options?: {
    executedBy?: string;
    queryType?: string;
    success?: boolean;
    limit?: number;
  }): Promise<SqlQueryHistoryEntry[]> {
    let query = db.select().from(sqlQueryHistory);

    const conditions = [];
    if (options?.executedBy) {
      conditions.push(eq(sqlQueryHistory.executedBy, options.executedBy));
    }
    if (options?.queryType) {
      conditions.push(eq(sqlQueryHistory.queryType, options.queryType as any));
    }
    if (options?.success !== undefined) {
      conditions.push(eq(sqlQueryHistory.success, options.success));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return query.orderBy(sql`${sqlQueryHistory.createdAt} DESC`).limit(options?.limit || 100);
  }

  async cleanupOldSqlHistory(olderThanDays: number = 90): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const result = await db.delete(sqlQueryHistory)
      .where(lt(sqlQueryHistory.createdAt, cutoffDate));
    return (result as any).rowCount || 0;
  }

  // Database Admin Methods (for table browsing)
  async getTableList(): Promise<Array<{ tableName: string; rowCount: number }>> {
    const result = await db.execute(sql`
      SELECT
        schemaname,
        relname as table_name,
        n_live_tup as row_count
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY relname
    `);
    return (result.rows as any[]).map(r => ({
      tableName: r.table_name,
      rowCount: parseInt(r.row_count) || 0
    }));
  }

  async getTableData(tableName: string, options?: {
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDir?: 'asc' | 'desc';
  }): Promise<{ rows: any[]; total: number }> {
    // Validate table name to prevent SQL injection
    const validTables = (await this.getTableList()).map(t => t.tableName);
    if (!validTables.includes(tableName)) {
      throw new Error(`Invalid table name: ${tableName}`);
    }

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    const orderBy = options?.orderBy || 'id';
    const orderDir = options?.orderDir || 'desc';

    // Get total count
    const countResult = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM "${tableName}"`));
    const total = parseInt((countResult.rows[0] as any)?.count) || 0;

    // Get rows with pagination
    const dataResult = await db.execute(
      sql.raw(`SELECT * FROM "${tableName}" ORDER BY "${orderBy}" ${orderDir.toUpperCase()} LIMIT ${limit} OFFSET ${offset}`)
    );

    return { rows: dataResult.rows as any[], total };
  }

  async executeRawQuery(query: string, executedBy: string, executedByEmail: string, ipAddress?: string): Promise<{
    rows: any[];
    rowCount: number;
    executionTime: number;
  }> {
    const startTime = Date.now();
    let success = true;
    let errorMessage: string | undefined;
    let rows: any[] = [];
    let rowCount = 0;

    // Determine query type
    const queryUpper = query.trim().toUpperCase();
    let queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER' = 'OTHER';
    if (queryUpper.startsWith('SELECT')) queryType = 'SELECT';
    else if (queryUpper.startsWith('INSERT')) queryType = 'INSERT';
    else if (queryUpper.startsWith('UPDATE')) queryType = 'UPDATE';
    else if (queryUpper.startsWith('DELETE')) queryType = 'DELETE';

    // Extract table name
    const tableMatch = query.match(/(?:FROM|INTO|UPDATE|DELETE FROM)\s+["']?(\w+)["']?/i);
    const tableName = tableMatch?.[1] || undefined;

    try {
      const result = await db.execute(sql.raw(query));
      rows = result.rows as any[];
      rowCount = (result as any).rowCount || rows.length;
    } catch (error: any) {
      success = false;
      errorMessage = error.message;
      throw error;
    } finally {
      const executionTime = Date.now() - startTime;

      // Log the query
      await this.createSqlQueryHistory({
        query,
        queryType,
        executedBy,
        executedByEmail,
        executionTime,
        rowsAffected: rowCount,
        success,
        errorMessage,
        tableName,
        ipAddress
      });
    }

    return { rows, rowCount, executionTime: Date.now() - startTime };
  }

  // Susan AI - Inventory Alert Management
  async getActiveAlerts(): Promise<InventoryAlert[]> {
    return db.select().from(inventoryAlerts).where(eq(inventoryAlerts.alertEnabled, true));
  }

  async updateAlert(id: string, data: Partial<InsertInventoryAlert>): Promise<InventoryAlert | null> {
    const [alert] = await db.update(inventoryAlerts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(inventoryAlerts.id, id))
      .returning();
    return alert || null;
  }

  async createAlert(data: InsertInventoryAlert): Promise<InventoryAlert> {
    const id = uuidv4();
    const [alert] = await db.insert(inventoryAlerts).values({ ...data, id }).returning();
    return alert;
  }

  // Susan AI - Tool Assignment Management
  async createToolAssignment(data: InsertToolAssignment): Promise<ToolAssignment> {
    const id = uuidv4();
    const insertData = {
      ...data,
      id,
      condition: (data.condition || 'GOOD') as 'NEW' | 'GOOD' | 'FAIR' | 'POOR',
      status: (data.status || 'ASSIGNED') as 'ASSIGNED' | 'RETURNED' | 'LOST' | 'DAMAGED',
    };
    const [assignment] = await db.insert(toolAssignments).values(insertData).returning();
    return assignment;
  }

  async getToolAssignmentsByTool(toolId: string): Promise<ToolAssignment[]> {
    return db.select().from(toolAssignments).where(eq(toolAssignments.toolId, toolId));
  }

  async updateToolAssignment(id: string, data: Partial<InsertToolAssignment>): Promise<ToolAssignment | null> {
    const updateData: any = { ...data, updatedAt: new Date() };
    if (data.status) {
      updateData.status = data.status as 'ASSIGNED' | 'RETURNED' | 'LOST' | 'DAMAGED';
    }
    if (data.condition) {
      updateData.condition = data.condition as 'NEW' | 'GOOD' | 'FAIR' | 'POOR';
    }
    const [assignment] = await db.update(toolAssignments)
      .set(updateData)
      .where(eq(toolAssignments.id, id))
      .returning();
    return assignment || null;
  }

  // Susan AI - Message Management (using SMS for external, notifications for internal)
  async getUnreadMessages(userId: string): Promise<SmsMessage[]> {
    // SMS messages are for external communications
    // Return pending messages for tracking purposes
    return db.select().from(smsMessages)
      .where(eq(smsMessages.status, 'PENDING'));
  }

  async createMessage(data: InsertSmsMessage): Promise<SmsMessage> {
    // Alias for createSmsMessage
    return this.createSmsMessage(data);
  }
}

export const storage = new DrizzleStorage();
