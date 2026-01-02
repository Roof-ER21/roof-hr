import { useAuth } from '@/lib/auth';
import {
  ADMIN_ROLES,
  MANAGER_ROLES,
  SUPER_ADMIN_EMAIL,
  isSystemAdmin,
  isAdmin as isAdminRole,
  isManager as isManagerRole,
  LIMITED_SOURCER_EMAILS,
  LEAD_SOURCER_EMAILS,
  ALL_SOURCER_EMAILS,
  isLimitedSourcer as isLimitedSourcerFn,
  isLeadSourcer as isLeadSourcerFn,
  isSourcer as isSourcerFn,
  isSourcerRole as isSourcerRoleFn,
} from '@shared/constants/roles';

export interface Permission {
  role: string;
  resource: string;
  action: string;
}

export const usePermissions = () => {
  const { user } = useAuth();

  const hasPermission = (resource: string, action: string): boolean => {
    if (!user) return false;

    const { role, email } = user;

    // Ahmed always has full access (email-based fallback)
    if (email === SUPER_ADMIN_EMAIL) return true;

    // Admin has all permissions
    if (ADMIN_ROLES.includes(role)) return true;

    // Manager permissions
    if (role === 'MANAGER') {
      const managerPermissions = [
        // User management
        'users.read',
        'users.create',
        'users.update',
        // PTO management
        'pto.read',
        'pto.approve',
        'pto.deny',
        // Recruiting
        'candidates.read',
        'candidates.create',
        'candidates.update',
        'interviews.read',
        'interviews.create',
        'interviews.update',
        // Reviews
        'reviews.read',
        'reviews.create',
        'reviews.update',
        // Documents
        'documents.read',
        'documents.create',
        'documents.update',
        // HR Management permissions only
        // Settings
        'settings.read',
        'settings.update',
      ];
      return managerPermissions.includes(`${resource}.${action}`);
    }

    // Employee permissions (limited)
    if (role === 'EMPLOYEE') {
      const employeePermissions = [
        // Self-service
        'pto.read',
        'pto.create',
        'documents.read',
        'tasks.read',
        'tasks.create',
        'tasks.update',

        'dashboard.read',
      ];
      return employeePermissions.includes(`${resource}.${action}`);
    }

    return false;
  };

  const canViewResource = (resource: string): boolean => {
    return hasPermission(resource, 'read');
  };

  const canEditResource = (resource: string): boolean => {
    return hasPermission(resource, 'update');
  };

  const canCreateResource = (resource: string): boolean => {
    return hasPermission(resource, 'create');
  };

  const canDeleteResource = (resource: string): boolean => {
    return hasPermission(resource, 'delete');
  };

  const isAdmin = (): boolean => {
    if (!user) return false;
    // Ahmed always has admin access
    if (user.email === SUPER_ADMIN_EMAIL) return true;
    return user?.role ? ADMIN_ROLES.includes(user.role) : false;
  };

  const isManager = (): boolean => {
    if (!user) return false;
    // Ahmed always has manager access
    if (user.email === SUPER_ADMIN_EMAIL) return true;
    return user?.role ? MANAGER_ROLES.includes(user.role) : false;
  };

  const isSystemAdmin = (): boolean => {
    if (!user) return false;
    // Ahmed always has system admin access
    if (user.email === SUPER_ADMIN_EMAIL) return true;
    const role = user?.role as string | undefined;
    return role === 'SYSTEM_ADMIN' || role === 'TRUE_ADMIN';
  };

  const isEmployee = (): boolean => {
    const role = user?.role as string | undefined;
    return role === 'EMPLOYEE' || role === 'SALES_REP' || role === 'FIELD_TECH' || role === 'CONTRACTOR';
  };

  // ============================================================================
  // SOURCER ROLE CHECKS
  // ============================================================================

  /**
   * Check if user is a limited sourcer (Tim Danelle, Sima Popal)
   * Limited sourcers can only see candidates assigned to them
   */
  const isLimitedSourcer = (): boolean => {
    if (!user) return false;
    return isLimitedSourcerFn(user);
  };

  /**
   * Check if user is a lead sourcer (Ryan Ferguson)
   * Lead sourcers can see all candidates, bulk import/assign, assign to others
   */
  const isLeadSourcer = (): boolean => {
    if (!user) return false;
    return isLeadSourcerFn(user);
  };

  /**
   * Check if user is any type of sourcer (email-based)
   */
  const isSourcer = (): boolean => {
    if (!user) return false;
    return isSourcerFn(user);
  };

  /**
   * Check if user has the SOURCER role (role-based, for Sima/Jobs)
   */
  const isSourcerRole = (): boolean => {
    if (!user) return false;
    return isSourcerRoleFn(user);
  };

  // ============================================================================
  // SOURCER PERMISSION HELPERS
  // ============================================================================

  /**
   * Can user see all candidates (managers + lead sourcers)
   */
  const canSeeAllCandidates = (): boolean => {
    if (!user) return false;
    if (isManager()) return true;
    if (isLeadSourcer()) return true;
    return false;
  };

  /**
   * Can user perform bulk actions (bulk assign, bulk import)
   * Managers + lead sourcers can do this
   */
  const canBulkManageCandidates = (): boolean => {
    if (!user) return false;
    if (isManager()) return true;
    if (isLeadSourcer()) return true;
    return false;
  };

  /**
   * Can user assign candidates to others
   * Managers + lead sourcers can do this
   */
  const canAssignCandidates = (): boolean => {
    if (!user) return false;
    if (isManager()) return true;
    if (isLeadSourcer()) return true;
    return false;
  };

  /**
   * Can user access email campaigns
   * Only managers (not sourcers)
   */
  const canAccessEmailCampaigns = (): boolean => {
    if (!user) return false;
    if (isSourcer()) return false; // Sourcers don't get email campaigns
    return isManager();
  };

  /**
   * Can user access workflow management
   * Only managers (not sourcers)
   */
  const canAccessWorkflowManagement = (): boolean => {
    if (!user) return false;
    if (isSourcer()) return false; // Sourcers don't get workflow management
    return isManager();
  };

  /**
   * Can user see all recruitment stats
   * Managers + lead sourcers can see all stats
   * Limited sourcers only see their own stats
   */
  const canSeeAllRecruitmentStats = (): boolean => {
    if (!user) return false;
    if (isLimitedSourcer()) return false;
    if (isManager()) return true;
    if (isLeadSourcer()) return true;
    return false;
  };

  return {
    hasPermission,
    canViewResource,
    canEditResource,
    canCreateResource,
    canDeleteResource,
    isSystemAdmin,
    isAdmin,
    isManager,
    isEmployee,
    // Sourcer role checks
    isLimitedSourcer,
    isLeadSourcer,
    isSourcer,
    isSourcerRole, // Role-based check for Sima/Jobs
    // Sourcer permission helpers
    canSeeAllCandidates,
    canBulkManageCandidates,
    canAssignCandidates,
    canAccessEmailCampaigns,
    canAccessWorkflowManagement,
    canSeeAllRecruitmentStats,
    // User info
    userRole: user?.role,
    userEmail: user?.email,
    userId: user?.id,
  };
};
