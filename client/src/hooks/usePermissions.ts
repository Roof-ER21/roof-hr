import { useAuth } from '@/lib/auth';
import {
  ADMIN_ROLES,
  MANAGER_ROLES,
  SUPER_ADMIN_EMAIL,
  isSystemAdmin,
  isAdmin as isAdminRole,
  isManager as isManagerRole,
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
    return user?.role === 'SYSTEM_ADMIN' || user?.role === 'TRUE_ADMIN';
  };

  const isEmployee = (): boolean => {
    return user?.role === 'EMPLOYEE' || user?.role === 'SALES_REP' || user?.role === 'FIELD_TECH' || user?.role === 'CONTRACTOR';
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
    userRole: user?.role,
    userEmail: user?.email,
  };
};