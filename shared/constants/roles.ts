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

// Check if user can approve PTO (email-based restriction)
export function canApprovePtoRequests(user: { role?: string; email?: string } | null): boolean {
  if (!user) return false;
  return PTO_APPROVER_EMAILS.includes(user.email || '');
}

// Legacy function - now delegates to email-based check
export function canApprovePto(user: { role?: string; email?: string } | null): boolean {
  return canApprovePtoRequests(user);
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
  // Legacy
  TRUE_ADMIN: 'System Administrator',
  ADMIN: 'HR Administrator',
  TERRITORY_SALES_MANAGER: 'Territory Manager',
};

export function getRoleDisplayName(role: string | undefined | null): string {
  if (!role) return 'Unknown';
  return ROLE_DISPLAY_NAMES[role] || role;
}
