import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

// Route name mappings for better display
const routeNames: Record<string, string> = {
  'dashboard': 'Dashboard',
  'my-portal': 'My Portal',
  'team-directory': 'Team Directory',
  'team-dashboard': 'Team Dashboard',
  'susan-ai': 'Susan AI',
  'resume-uploader': 'Resume Uploader',
  'recruiting': 'Recruiting',
  'documents': 'Documents',
  'tools': 'Tools & Equipment',
  'coi-documents': 'COI Tracking',
  'contracts': 'Contracts',
  'employees': 'Employees',
  'employee-assignments': 'Assignments',
  'territories': 'Territories',
  'pto': 'PTO Requests',
  'pto-policies': 'PTO Policies',
  'reviews': 'Reviews',
  'attendance': 'Attendance',
  'google-integration': 'Google Integration',
  'settings': 'Settings',
  'admin': 'Admin',
  'analytics': 'Analytics',
  'email-templates': 'Email Templates',
  'workflow-builder': 'Workflow Builder',
};

export function Breadcrumbs() {
  const location = useLocation();
  const pathSegments = location.pathname.split('/').filter(Boolean);

  // Don't show breadcrumbs on dashboard (home)
  if (pathSegments.length === 0 || (pathSegments.length === 1 && pathSegments[0] === 'dashboard')) {
    return null;
  }

  const breadcrumbs = pathSegments.map((segment, index) => {
    const path = '/' + pathSegments.slice(0, index + 1).join('/');
    const name = routeNames[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
    const isLast = index === pathSegments.length - 1;

    return {
      path,
      name,
      isLast,
    };
  });

  return (
    <nav aria-label="Breadcrumb" className="flex items-center space-x-1 text-sm mb-4">
      <Link
        to="/dashboard"
        className="flex items-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        aria-label="Go to Dashboard"
      >
        <Home className="w-4 h-4" />
      </Link>

      {breadcrumbs.map((breadcrumb) => (
        <div key={breadcrumb.path} className="flex items-center">
          <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-600 mx-1" aria-hidden="true" />
          {breadcrumb.isLast ? (
            <span
              className="font-medium text-gray-900 dark:text-white"
              aria-current="page"
            >
              {breadcrumb.name}
            </span>
          ) : (
            <Link
              to={breadcrumb.path}
              className={cn(
                "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              )}
            >
              {breadcrumb.name}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
