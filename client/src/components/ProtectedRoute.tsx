import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { ADMIN_ROLES, SUPER_ADMIN_EMAIL, ONBOARDING_ADMIN_EMAILS } from '@shared/constants/roles';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  requiredEmails?: string[];
}

export function ProtectedRoute({ children, requiredRoles, requiredEmails }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Super admin always has access
  if (user.email === SUPER_ADMIN_EMAIL) {
    return <>{children}</>;
  }

  // Check role-based access
  if (requiredRoles && requiredRoles.length > 0) {
    if (!user.role || !requiredRoles.includes(user.role)) {
      // Redirect non-authorized users to my-portal (not dashboard which may also be restricted)
      return <Navigate to="/my-portal" replace />;
    }
  }

  // Check email-based access
  if (requiredEmails && requiredEmails.length > 0) {
    if (!user.email || !requiredEmails.map(e => e.toLowerCase()).includes(user.email.toLowerCase())) {
      return <Navigate to="/my-portal" replace />;
    }
  }

  return <>{children}</>;
}
