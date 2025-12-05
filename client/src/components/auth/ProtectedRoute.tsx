import { useAuth } from '@/lib/auth';
import { usePermissions } from '@/hooks/usePermissions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  resource?: string;
  action?: string;
}

export function ProtectedRoute({ 
  children, 
  requiredRole, 
  resource, 
  action = 'read' 
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const { hasPermission, isAdmin, isManager } = usePermissions();

  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!user) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You must be logged in to access this page.
        </AlertDescription>
      </Alert>
    );
  }

  // Check role-based access
  if (requiredRole) {
    const hasRoleAccess = 
      (requiredRole === 'ADMIN' && isAdmin()) ||
      (requiredRole === 'MANAGER' && isManager()) ||
      (requiredRole === 'EMPLOYEE' && user.role === 'EMPLOYEE') ||
      isAdmin(); // Admin can access everything

    if (!hasRoleAccess) {
      return (
        <Alert variant="destructive" className="m-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access this page. Required role: {requiredRole}
          </AlertDescription>
        </Alert>
      );
    }
  }

  // Check resource-based access
  if (resource && !hasPermission(resource, action)) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You don't have permission to {action} {resource}.
        </AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
}