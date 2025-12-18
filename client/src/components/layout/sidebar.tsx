import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Briefcase,
  FileText,
  Video,
  Settings,
  User,
  Shield,
  BarChart,
  Bot,
  Package,
  ChevronDown,
  ChevronRight,
  MapPin,
  AlertTriangle,
  Link as LinkIcon,
  ScrollText,
  Sparkles,
  Cloud,
  Clock,
  Upload,
  UserCircle
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
  { name: 'My Portal', href: '/my-portal', icon: UserCircle, roles: ['ADMIN', 'MANAGER', 'EMPLOYEE', 'TRUE_ADMIN', 'GENERAL_MANAGER', 'TERRITORY_SALES_MANAGER', 'CONTRACTOR', 'SALES_REP', 'FIELD_TECH'] },
  { name: 'Team Dashboard', href: '/team-dashboard', icon: Users, roles: ['ADMIN', 'MANAGER', 'TRUE_ADMIN', 'GENERAL_MANAGER', 'TERRITORY_SALES_MANAGER'] },
  { name: 'Susan AI', href: '/susan-ai', icon: Sparkles, roles: ['ADMIN', 'MANAGER', 'EMPLOYEE', 'TRUE_ADMIN', 'GENERAL_MANAGER', 'TERRITORY_SALES_MANAGER', 'CONTRACTOR', 'SALES_REP', 'FIELD_TECH'] },
  { name: 'Recruiting', href: '/recruiting', icon: Briefcase, roles: ['ADMIN', 'MANAGER'] },
  { 
    name: 'Documents', 
    href: '/documents', 
    icon: FileText, 
    roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'],
    children: [
      { name: 'All Documents', href: '/documents', icon: FileText, roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
      { name: 'Tools & Equipment', href: '/tools', icon: Package, roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
      { name: 'COI Tracking', href: '/coi-documents', icon: AlertTriangle, roles: ['ADMIN', 'MANAGER'] },
      { name: 'Contracts', href: '/contracts', icon: ScrollText, roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] }
    ]
  },
  { 
    name: 'Employees', 
    href: '/employees', 
    icon: Users, 
    roles: ['ADMIN', 'MANAGER'],
    children: [
      { name: 'Employee Directory', href: '/employees', icon: Users, roles: ['ADMIN', 'MANAGER'] },
      { name: 'Assignments', href: '/employee-assignments', icon: LinkIcon, roles: ['ADMIN', 'MANAGER'] },
      { name: 'Territories', href: '/territories', icon: MapPin, roles: ['ADMIN', 'MANAGER', 'TERRITORY_SALES_MANAGER'] }
    ]
  },
  { 
    name: 'Time Off', 
    href: '/pto', 
    icon: Calendar, 
    roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'],
    children: [
      { name: 'PTO Requests', href: '/pto', icon: Calendar, roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
      { name: 'PTO Policies', href: '/pto-policies', icon: Settings, roles: ['ADMIN', 'MANAGER', 'GENERAL_MANAGER'] }
    ]
  },
  { name: 'Reviews', href: '/reviews', icon: Video, roles: ['ADMIN', 'MANAGER'] },
  { name: 'Attendance', href: '/attendance', icon: Clock, roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
  { name: 'Google Integration', href: '/google-integration', icon: Cloud, roles: ['ADMIN'] },
  { name: 'Settings', href: '/settings', icon: Settings, roles: ['ADMIN', 'MANAGER'] },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuth();
  const [expandedItems, setExpandedItems] = useState<string[]>(['Documents', 'Employees', 'Time Off']);

  const toggleExpanded = (name: string) => {
    setExpandedItems(prev => 
      prev.includes(name) 
        ? prev.filter(item => item !== name)
        : [...prev, name]
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-[#171717] shadow-lg transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center p-6 border-b dark:border-[#2E2E2E]">
            <Logo size="md" />
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation
              .filter(item => !user?.role || item.roles.includes(user.role))
              .map((item) => {
                const isActive = location.pathname === item.href;
                const hasChildren = item.children && item.children.length > 0;
                const isExpanded = expandedItems.includes(item.name);
                const isChildActive = hasChildren && item.children.some(child => location.pathname === child.href);

                if (hasChildren) {
                  return (
                    <div key={item.name} className={`sidebar-${item.name.toLowerCase().replace(' ', '-')}`}>
                      <button
                        onClick={() => toggleExpanded(item.name)}
                        className={cn(
                          "w-full flex items-center justify-between px-2 py-2 text-sm font-medium rounded-lg transition-colors",
                          isActive || isChildActive
                            ? "text-white bg-primary"
                            : "text-secondary-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-[#262626]"
                        )}
                      >
                        <div className="flex items-center">
                          <item.icon className="w-5 h-5 mr-3" />
                          {item.name}
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                      {isExpanded && (
                        <div className="mt-1 ml-8 space-y-1">
                          {item.children
                            .filter(child => !user?.role || child.roles.includes(user.role))
                            .map((child) => {
                              const childIsActive = location.pathname === child.href;
                              return (
                                <Link
                                  key={child.name}
                                  to={child.href}
                                  onClick={onClose}
                                  className={cn(
                                    "flex items-center px-2 py-1.5 text-sm rounded-lg transition-colors",
                                    childIsActive
                                      ? "text-primary bg-primary/10 dark:bg-primary/20"
                                      : "text-secondary-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#262626]"
                                  )}
                                >
                                  <child.icon className="w-4 h-4 mr-2" />
                                  {child.name}
                                </Link>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={onClose}
                    className={cn(
                      `sidebar-${item.name.toLowerCase().replace(' ', '-')}`,
                      "flex items-center px-2 py-2 text-sm font-medium rounded-lg transition-colors",
                      isActive
                        ? "text-white bg-primary"
                        : "text-secondary-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-[#262626]"
                    )}
                  >
                    <item.icon className="w-5 h-5 mr-3" />
                    {item.name}
                  </Link>
                );
              })}
          </nav>
          
          {/* User Profile */}
          <div className="p-4 border-t dark:border-[#2E2E2E]">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-secondary-200 dark:bg-[#2E2E2E] rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-secondary-600 dark:text-gray-300" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-secondary-700 dark:text-white">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-secondary-500 dark:text-gray-400">{user?.position}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
