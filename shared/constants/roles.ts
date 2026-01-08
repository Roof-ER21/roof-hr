// Centralized role definitions for Roof HR
// Use these constants throughout the app for consistent role checking

// ============================================================================
// ROLE DEFINITIONS - New Hierarchy (Dec 2024)
// ============================================================================
// Level 1: SYSTEM_ADMIN - Highest access, full system control
// Level 2: HR_ADMIN - HR functions, policies, employee management
// Level 3: GENERAL_MANAGER - Company-wide management, reports, all teams
// Level 4: TERRITORY_MANAGER - Manage specific territory and its team
// Level 5: MANAGER - Team management, approvals, recruiting
// Level 6: TEAM_LEAD - Limited team oversight
// Level 7: EMPLOYEE - Standard employee access
// Level 8: FIELD_TECH - Field worker access
// Level 9: SALES_REP - Sales-specific access
// Level 10: CONTRACTOR - Limited contractor access
// Level 11: SOURCER - Recruiting-focused role (assigned candidates only)
// ============================================================================

export const ROLE = {
  // New role names
  SYSTEM_ADMIN: 'SYSTEM_ADMIN',
  HR_ADMIN: 'HR_ADMIN',
  GENERAL_MANAGER: 'GENERAL_MANAGER',
  TERRITORY_MANAGER: 'TERRITORY_MANAGER',
  MANAGER: 'MANAGER',
  TEAM_LEAD: 'TEAM_LEAD',
  EMPLOYEE: 'EMPLOYEE',
  FIELD_TECH: 'FIELD_TECH',
  SALES_REP: 'SALES_REP',
  CONTRACTOR: 'CONTRACTOR',
  SOURCER: 'SOURCER',

  // Legacy aliases for backward compatibility during migration
  TRUE_ADMIN: 'SYSTEM_ADMIN',  // Maps to SYSTEM_ADMIN
  ADMIN: 'HR_ADMIN',           // Maps to HR_ADMIN
  TERRITORY_SALES_MANAGER: 'TERRITORY_MANAGER',  // Maps to TERRITORY_MANAGER
  SALES: 'SALES_REP',          // Maps to SALES_REP
} as const;

export type UserRole =
  | 'SYSTEM_ADMIN'
  | 'HR_ADMIN'
  | 'GENERAL_MANAGER'
  | 'TERRITORY_MANAGER'
  | 'MANAGER'
  | 'TEAM_LEAD'
  | 'EMPLOYEE'
  | 'FIELD_TECH'
  | 'SALES_REP'
  | 'CONTRACTOR'
  | 'SOURCER'
  // Legacy roles (for backward compatibility during migration)
  | 'TRUE_ADMIN'
  | 'ADMIN'
  | 'TERRITORY_SALES_MANAGER';

// ============================================================================
// SUPER ADMIN PROTECTION
// ============================================================================
// Ahmed always has full system access, regardless of database role
export const SUPER_ADMIN_EMAIL = 'ahmed.mahmoud@theroofdocs.com';

// ============================================================================
// ROLE GROUPS FOR PERMISSION CHECKS
// ============================================================================

// Level 1: System Admin - full system access (God mode)
export const SYSTEM_ADMIN_ROLES: string[] = [
  'SYSTEM_ADMIN',
  'TRUE_ADMIN',  // Legacy
];

// Level 2: Admin - full feature access
export const ADMIN_ROLES: string[] = [
  'SYSTEM_ADMIN',
  'HR_ADMIN',
  'TRUE_ADMIN',  // Legacy
  'ADMIN',       // Legacy
];

// Level 3: Management - team/company management
export const MANAGER_ROLES: string[] = [
  'SYSTEM_ADMIN',
  'HR_ADMIN',
  'GENERAL_MANAGER',
  'TERRITORY_MANAGER',
  'MANAGER',
  // Legacy
  'TRUE_ADMIN',
  'ADMIN',
  'TERRITORY_SALES_MANAGER',
];

// Level 4: HR Functions (can manage HR policies, employees)
export const HR_ROLES: string[] = [
  'SYSTEM_ADMIN',
  'HR_ADMIN',
  'GENERAL_MANAGER',
  // Legacy
  'TRUE_ADMIN',
  'ADMIN',
];

// Level 5: Sourcer - recruiting-focused access
export const SOURCER_ROLES: string[] = [
  'SOURCER',
];

// All roles that have basic system access
export const ALL_ROLES: string[] = [
  'SYSTEM_ADMIN',
  'HR_ADMIN',
  'GENERAL_MANAGER',
  'TERRITORY_MANAGER',
  'MANAGER',
  'TEAM_LEAD',
  'EMPLOYEE',
  'FIELD_TECH',
  'SALES_REP',
  'CONTRACTOR',
  'SOURCER',
  // Legacy
  'TRUE_ADMIN',
  'ADMIN',
  'TERRITORY_SALES_MANAGER',
];

// ============================================================================
// PERMISSION CHECK FUNCTIONS
// ============================================================================

// Check if user has system admin access (highest level)
export function isSystemAdmin(user: { role?: string; email?: string } | null): boolean {
  if (!user) return false;
  // Ahmed always has system admin access
  if (user.email === SUPER_ADMIN_EMAIL) return true;
  return SYSTEM_ADMIN_ROLES.includes(user.role || '');
}

// Check if user has admin-level access
export function isAdmin(user: { role?: string; email?: string } | null): boolean {
  if (!user) return false;
  // Ahmed always has admin access
  if (user.email === SUPER_ADMIN_EMAIL) return true;
  return ADMIN_ROLES.includes(user.role || '');
}

// Check if user has manager-level access
export function isManager(role: string | undefined | null): boolean {
  if (!role) return false;
  return MANAGER_ROLES.includes(role);
}

// Check if user is in HR roles
export function isHRAdmin(role: string | undefined | null): boolean {
  if (!role) return false;
  return HR_ROLES.includes(role);
}

// ============================================================================
// FEATURE-SPECIFIC PERMISSION CHECKS
// ============================================================================

export function canManageEmployees(role: string | undefined | null): boolean {
  return isManager(role);
}

export function canManagePolicies(user: { role?: string; email?: string } | null): boolean {
  return isAdmin(user);
}

export function canViewReports(role: string | undefined | null): boolean {
  return isManager(role);
}

export function canManageContracts(role: string | undefined | null): boolean {
  return isHRAdmin(role);
}

export function canAccessRecruitingAdmin(user: { role?: string; email?: string } | null): boolean {
  return isAdmin(user);
}

// ============================================================================
// PTO APPROVAL RESTRICTION
// ============================================================================
// PTO Approvers - ONLY these 4 people can approve/deny PTO requests
// Regardless of their role in the system
export const PTO_APPROVER_EMAILS = [
  'ahmed.mahmoud@theroofdocs.com',
  'ford.barsi@theroofdocs.com',
  'reese.samala@theroofdocs.com',
  'oliver.brown@theroofdocs.com'
];

export const PTO_DEPARTMENT_APPROVERS = [
  { email: 'greg.campbell@theroofdocs.com', department: 'Production' }
];

// Senior managers (Ford/Reese) - their PTO requests only go to Oliver & Ahmed
export const SENIOR_MANAGER_EMAILS = [
  'ford.barsi@theroofdocs.com',
  'reese.samala@theroofdocs.com'
];

// Senior approvers (Oliver & Ahmed) - approve Ford/Reese PTO requests
export const SENIOR_PTO_APPROVER_EMAILS = [
  'ahmed.mahmoud@theroofdocs.com',
  'oliver.brown@theroofdocs.com'
];

// PTO reminder recipients - all 4 managers receive reminders
export const PTO_REMINDER_RECIPIENTS = PTO_APPROVER_EMAILS;

/**
 * Get the appropriate PTO approvers for an employee
 * Ford/Reese requests go only to Oliver & Ahmed
 * Everyone else's requests go to all 4 approvers
 */
export function getDepartmentApproverForDepartment(department?: string | null): string[] {
  if (!department) return [];
  const normalized = department.toLowerCase();
  return PTO_DEPARTMENT_APPROVERS
    .filter((entry) => entry.department.toLowerCase() === normalized)
    .map((entry) => entry.email);
}

export function getDepartmentApproverEntry(email?: string | null) {
  if (!email) return null;
  const normalized = email.toLowerCase();
  return PTO_DEPARTMENT_APPROVERS.find((entry) => entry.email.toLowerCase() === normalized) || null;
}

export function getPTOApproversForEmployee(employeeEmail: string, employeeDepartment?: string | null): string[] {
  if (SENIOR_MANAGER_EMAILS.includes(employeeEmail.toLowerCase())) {
    return SENIOR_PTO_APPROVER_EMAILS; // Ford/Reese → Oliver & Ahmed only
  }
  const departmentApprovers = getDepartmentApproverForDepartment(employeeDepartment);
  const allApprovers = [...PTO_APPROVER_EMAILS, ...departmentApprovers];
  return Array.from(new Set(allApprovers));
}

// Check if user can approve PTO (email-based restriction)
export function canApprovePtoRequests(user: { role?: string; email?: string } | null): boolean {
  if (!user) return false;
  return PTO_APPROVER_EMAILS.includes(user.email || '');
}

export function isCorePtoApprover(email?: string | null): boolean {
  if (!email) return false;
  return PTO_APPROVER_EMAILS.includes(email.toLowerCase());
}

// Legacy function - now delegates to email-based check
export function canApprovePto(user: { role?: string; email?: string } | null): boolean {
  return canApprovePtoRequests(user);
}

// ============================================================================
// ONBOARDING CHECKLIST ACCESS
// ============================================================================
// Users who can access the Onboarding Checklist (in addition to ADMIN_ROLES)
export const ONBOARDING_ADMIN_EMAILS = [
  'ahmed.mahmoud@theroofdocs.com',
  'ford.barsi@theroofdocs.com',
  'oliver.brown@theroofdocs.com',
  'reese.samala@theroofdocs.com',
  'careers@theroofdocs.com',  // Ryan Ferguson
];

export function canAccessOnboardingChecklist(user: { role?: string; email?: string } | null): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (user.email && ONBOARDING_ADMIN_EMAILS.includes(user.email.toLowerCase())) return true;
  return false;
}

// ============================================================================
// POLICY ADMIN ACCESS
// ============================================================================
const POLICY_ADMIN_EMAILS = [
  'ahmed.mahmoud@theroofdocs.com',
  'ford.barsi@theroofdocs.com'
];

export function canEditPtoPolicies(user: { role?: string; email?: string } | null): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (user.email && POLICY_ADMIN_EMAILS.includes(user.email)) return true;
  return false;
}

// ============================================================================
// RECRUITMENT SOURCER ROLES
// ============================================================================
// DEPRECATED: Limited sourcer emails no longer used - access is now assignment-based
// Anyone with assigned candidates can see recruiting (restricted to their assignments)
export const LIMITED_SOURCER_EMAILS: string[] = [];

// Lead Sourcer - can see all candidates, bulk import/assign, assign to others
export const LEAD_SOURCER_EMAILS = [
  'careers@theroofdocs.com',     // Ryan Ferguson
];

// Extended Sourcers - can move candidates to OFFER stage (but not HIRED)
export const EXTENDED_SOURCER_EMAILS = [
  'recruiting@theroofdocs.com',  // Sima Popal
  'jobs@theroofdocs.com',        // Natia Tutberidze
];

// All sourcers combined (kept for backward compatibility)
export const ALL_SOURCER_EMAILS = [
  ...LIMITED_SOURCER_EMAILS,
  ...LEAD_SOURCER_EMAILS,
  ...EXTENDED_SOURCER_EMAILS,
];

/**
 * @deprecated Access is now assignment-based. Non-managers only see assigned candidates.
 * This function always returns false.
 */
export function isLimitedSourcer(user: { email?: string } | null): boolean {
  return false; // Deprecated - access is now assignment-based
}

/**
 * Check if user is a lead sourcer (can see all, bulk import/assign, assign to others)
 */
export function isLeadSourcer(user: { email?: string } | null): boolean {
  if (!user?.email) return false;
  return LEAD_SOURCER_EMAILS.includes(user.email.toLowerCase());
}

/**
 * Check if user is an extended sourcer (can move to OFFER stage)
 * Extended sourcers: Sima Popal, Natia Tutberidze
 */
export function isExtendedSourcer(user: { email?: string } | null): boolean {
  if (!user?.email) return false;
  return EXTENDED_SOURCER_EMAILS.includes(user.email.toLowerCase());
}

/**
 * Check if user is any type of sourcer
 */
export function isSourcer(user: { email?: string } | null): boolean {
  if (!user?.email) return false;
  return ALL_SOURCER_EMAILS.includes(user.email.toLowerCase());
}

/**
 * Check if user can perform bulk actions (import/assign)
 * Lead sourcers and managers can do this
 */
export function canBulkManageCandidates(user: { email?: string; role?: string } | null): boolean {
  if (!user) return false;
  if (isLeadSourcer(user)) return true;
  if (isManager(user.role)) return true;
  return false;
}

/**
 * Check if user can assign candidates to others
 * Lead sourcers and managers can do this
 */
export function canAssignCandidates(user: { email?: string; role?: string } | null): boolean {
  if (!user) return false;
  if (isLeadSourcer(user)) return true;
  if (isManager(user.role)) return true;
  return false;
}

// ============================================================================
// EMPLOYMENT TYPE CHECKS
// ============================================================================
// Employment types that don't receive PTO by default
export const NO_PTO_EMPLOYMENT_TYPES = ['1099', 'CONTRACTOR'];
export const NO_PTO_DEPARTMENTS = ['Sales'];

export function employeeGetsPto(employee: { department?: string; employmentType?: string } | null): boolean {
  if (!employee) return false;
  if (employee.department && NO_PTO_DEPARTMENTS.includes(employee.department)) return false;
  if (employee.employmentType && NO_PTO_EMPLOYMENT_TYPES.includes(employee.employmentType)) return false;
  return true;
}

// ============================================================================
// ROLE DISPLAY NAMES
// ============================================================================
export const ROLE_DISPLAY_NAMES: Record<string, string> = {
  SYSTEM_ADMIN: 'System Administrator',
  HR_ADMIN: 'HR Administrator',
  GENERAL_MANAGER: 'General Manager',
  TERRITORY_MANAGER: 'Territory Manager',
  MANAGER: 'Manager',
  TEAM_LEAD: 'Team Lead',
  EMPLOYEE: 'Employee',
  FIELD_TECH: 'Field Technician',
  SALES_REP: 'Sales Representative',
  CONTRACTOR: 'Contractor',
  SOURCER: 'Sourcer',
  // Legacy
  TRUE_ADMIN: 'System Administrator',
  ADMIN: 'HR Administrator',
  TERRITORY_SALES_MANAGER: 'Territory Manager',
};

export function getRoleDisplayName(role: string | undefined | null): string {
  if (!role) return 'Unknown';
  return ROLE_DISPLAY_NAMES[role] || role;
}

// ============================================================================
// PAGE ACCESS RESTRICTIONS
// ============================================================================
// Users who have restricted access to certain navigation items
// Even though they may have a manager role, these pages are hidden
export const RESTRICTED_PAGE_ACCESS: Record<string, string[]> = {
  // Bruno Nacipucha - hide Employees and Facilities sections
  'bruno.n@theroofdocs.com': ['Employees', 'Facilities'],
};

/**
 * Get the pages that should be hidden for a specific user
 * Returns an empty array if no restrictions
 */
export function getRestrictedPages(user: { email?: string } | null): string[] {
  if (!user?.email) return [];
  return RESTRICTED_PAGE_ACCESS[user.email.toLowerCase()] || [];
}

// ============================================================================
// FACILITIES ACCESS (Special email-based access)
// ============================================================================
// Non-managers who need Facilities page access
export const FACILITIES_ACCESS_EMAILS = [
  'alex.ortega@theroofdocs.com',
];

/**
 * Check if user has access to Facilities pages
 * Admins get access by role, others need to be in FACILITIES_ACCESS_EMAILS
 */
export function canAccessFacilities(user: { role?: string; email?: string } | null): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (user.email && FACILITIES_ACCESS_EMAILS.includes(user.email.toLowerCase())) return true;
  return false;
}

// ============================================================================
// SOURCER ROLE CHECKS
// ============================================================================
/**
 * Check if user has the SOURCER role
 */
export function isSourcerRole(user: { role?: string } | null): boolean {
  if (!user?.role) return false;
  return SOURCER_ROLES.includes(user.role);
}

// ============================================================================
// ALERT & NOTIFICATION RECIPIENTS
// ============================================================================
// IMPORTANT: These constants define WHO receives each type of alert
// Do NOT send alerts company-wide - only to specific people who need them

// Top 3 Leaders who should receive important alerts
export const TOP_LEADERSHIP_EMAILS = [
  'oliver.brown@theroofdocs.com',  // Oliver (General Manager)
  'reese.samala@theroofdocs.com',  // Reese (Territory Sales Manager)
  'ford.barsi@theroofdocs.com',    // Ford (Territory Sales Manager)
];

// Recruiting Team (Sourcers)
export const RECRUITING_TEAM_EMAILS = [
  'careers@theroofdocs.com',       // Ryan Ferguson (Lead Sourcer)
  'jobs@theroofdocs.com',          // Natia Tutberidze (Extended Sourcer)
  'recruiting@theroofdocs.com',    // Sima Popal (Extended Sourcer)
];

// Screening Failure Alerts - Recruiters + Top Leadership
// Alerts when a candidate fails screening but proceeds to interview
export const SCREENING_ALERT_RECIPIENTS = [
  ...RECRUITING_TEAM_EMAILS,       // All recruiters involved
  ...TOP_LEADERSHIP_EMAILS,        // Oliver, Reese, Ford
];

// Contract Notifications - Core recipients (Top Leadership + Lead Recruiter)
export const CONTRACT_CORE_ALERT_RECIPIENTS = [
  ...TOP_LEADERSHIP_EMAILS,        // Oliver, Reese, Ford
  'careers@theroofdocs.com',       // Ryan (handles onboarding/contracts)
];

// Contract Notifications - Retail leadership extras
export const RETAIL_CONTRACT_ALERT_RECIPIENTS = [
  'bruno.n@theroofdocs.com',
  'keith.ziemba@theroofdocs.com',
  'jeremy.hayden@theroofdocs.com',
];

// Backward-compatible alias
export const CONTRACT_ALERT_RECIPIENTS = CONTRACT_CORE_ALERT_RECIPIENTS;

// Interview Conflict Alerts - Recruiters + Top Leadership
// Alerts about scheduling conflicts
export const INTERVIEW_CONFLICT_ALERT_RECIPIENTS = [
  ...RECRUITING_TEAM_EMAILS,       // All recruiters involved
  ...TOP_LEADERSHIP_EMAILS,        // Oliver, Reese, Ford
];

/**
 * Check if user should receive screening alerts
 */
export function shouldReceiveScreeningAlerts(email: string | undefined | null): boolean {
  if (!email) return false;
  return SCREENING_ALERT_RECIPIENTS.includes(email.toLowerCase());
}

/**
 * Check if user should receive contract alerts
 */
export function shouldReceiveContractAlerts(email: string | undefined | null): boolean {
  if (!email) return false;
  return CONTRACT_ALERT_RECIPIENTS.includes(email.toLowerCase());
}

/**
 * Check if user should receive interview conflict alerts
 */
export function shouldReceiveInterviewConflictAlerts(email: string | undefined | null): boolean {
  if (!email) return false;
  return INTERVIEW_CONFLICT_ALERT_RECIPIENTS.includes(email.toLowerCase());
}
