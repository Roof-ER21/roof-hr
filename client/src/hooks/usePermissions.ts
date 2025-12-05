import { useAuth } from '@/lib/auth';

export interface Permission {
  role: string;
  resource: string;
  action: string;
}

export const usePermissions = () => {
  const { user } = useAuth();

  const hasPermission = (resource: string, action: string): boolean => {
    if (!user) return false;

    const { role } = user;

    // Admin has all permissions
    if (role === 'ADMIN') return true;

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
    return user?.role === 'ADMIN';
  };

  const isManager = (): boolean => {
    return user?.role === 'MANAGER' || user?.role === 'ADMIN';
  };

  const isEmployee = (): boolean => {
    return user?.role === 'EMPLOYEE';
  };

  return {
    hasPermission,
    canViewResource,
    canEditResource,
    canCreateResource,
    canDeleteResource,
    isAdmin,
    isManager,
    isEmployee,
    userRole: user?.role,
  };
};