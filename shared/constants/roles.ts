// Centralized role definitions for Roof HR
// Use these constants throughout the app for consistent role checking

export const ROLE = {
  ADMIN: 'ADMIN',
  TRUE_ADMIN: 'TRUE_ADMIN',
  MANAGER: 'MANAGER',
  GENERAL_MANAGER: 'GENERAL_MANAGER',
  TERRITORY_SALES_MANAGER: 'TERRITORY_SALES_MANAGER',
  EMPLOYEE: 'EMPLOYEE',
  SALES: 'SALES',
  CONTRACTOR: 'CONTRACTOR'
} as const;

export type UserRole = typeof ROLE[keyof typeof ROLE];

// Role groups for permission checks
export const MANAGER_ROLES: UserRole[] = [
  ROLE.ADMIN,
  ROLE.TRUE_ADMIN,
  ROLE.MANAGER,
  ROLE.GENERAL_MANAGER,
  ROLE.TERRITORY_SALES_MANAGER
];

export const ADMIN_ROLES: UserRole[] = [
  ROLE.ADMIN,
  ROLE.TRUE_ADMIN
];

export const HR_ROLES: UserRole[] = [
  ROLE.ADMIN,
  ROLE.TRUE_ADMIN,
  ROLE.GENERAL_MANAGER
];

// Permission check functions
export function isManager(role: string | undefined | null): boolean {
  if (!role) return false;
  return MANAGER_ROLES.includes(role as UserRole);
}

export function isAdmin(role: string | undefined | null): boolean {
  if (!role) return false;
  return ADMIN_ROLES.includes(role as UserRole);
}

export function isHRAdmin(role: string | undefined | null): boolean {
  if (!role) return false;
  return HR_ROLES.includes(role as UserRole);
}

export function canManageEmployees(role: string | undefined | null): boolean {
  return isManager(role);
}

export function canManagePolicies(role: string | undefined | null): boolean {
  return isAdmin(role);
}

export function canApprovePto(role: string | undefined | null): boolean {
  return isManager(role);
}

export function canViewReports(role: string | undefined | null): boolean {
  return isManager(role);
}

export function canManageContracts(role: string | undefined | null): boolean {
  return isHRAdmin(role);
}

export function canAccessRecruitingAdmin(role: string | undefined | null): boolean {
  return isAdmin(role);
}

// Special access checks that also verify specific users
const POLICY_ADMIN_EMAILS = [
  'ford.barsi@theroofdocs.com',
  'ahmed.mahmoud@theroofdocs.com'
];

// PTO Approvers - Only these users can approve/deny PTO requests
export const PTO_APPROVER_EMAILS = [
  'ford.barsi@theroofdocs.com',
  'ahmed.mahmoud@theroofdocs.com',
  'reese.samala@theroofdocs.com',
  'oliver.brown@theroofdocs.com'
];

export function canEditPtoPolicies(user: { role?: string; email?: string } | null): boolean {
  if (!user) return false;
  if (isAdmin(user.role)) return true;
  if (user.email && POLICY_ADMIN_EMAILS.includes(user.email)) return true;
  return false;
}

export function canApprovePtoRequests(user: { role?: string; email?: string } | null): boolean {
  if (!user) return false;
  if (user.email && PTO_APPROVER_EMAILS.includes(user.email)) return true;
  return false;
}

// Employment types that don't receive PTO by default
export const NO_PTO_EMPLOYMENT_TYPES = ['1099', 'CONTRACTOR'];
export const NO_PTO_DEPARTMENTS = ['Sales'];

export function employeeGetsPto(employee: { department?: string; employmentType?: string } | null): boolean {
  if (!employee) return false;
  if (employee.department && NO_PTO_DEPARTMENTS.includes(employee.department)) return false;
  if (employee.employmentType && NO_PTO_EMPLOYMENT_TYPES.includes(employee.employmentType)) return false;
  return true;
}
