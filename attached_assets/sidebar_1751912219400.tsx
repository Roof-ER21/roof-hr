
'use client';

import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Home,
  User,
  Calendar,
  Users,
  FileText,
  Shield,
  BarChart3,
  Settings,
  MapPin,
  Clock,
  UserPlus
} from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'OWNER';
  
  const hasRecruitingAccess = session?.user?.role === 'ADMIN' || 
                            session?.user?.role === 'OWNER' || 
                            session?.user?.role === 'SALES_DIRECTOR' ||
                            session?.user?.role === 'HR_DIRECTOR' ||
                            session?.user?.role === 'HR_RECRUITER';
  
  const isW2Employee = session?.user?.employmentType === 'W2';

  const navigationItems = [
    {
      title: 'Dashboard',
      href: '/dashboard',
      icon: Home,
      description: 'Overview and quick actions'
    },
    {
      title: 'My Profile',
      href: '/profile',
      icon: User,
      description: 'Personal information and documents'
    },
    ...(isW2Employee ? [{
      title: 'Request PTO',
      href: '/pto',
      icon: Calendar,
      description: 'Manage time off requests'
    }] : []),
    ...(hasRecruitingAccess ? [{
      title: 'Recruiting',
      href: '/recruiting',
      icon: UserPlus,
      description: 'Manage candidates and hiring'
    }] : []),
    {
      title: 'Schedule Meeting',
      href: '/meetings',
      icon: Users,
      description: 'Book time with team members'
    },
    {
      title: 'Check-In',
      href: '/checkin',
      icon: MapPin,
      description: 'GPS job site check-in',
      mobile: true
    },
    {
      title: 'Safety & Compliance',
      href: '/safety',
      icon: Shield,
      description: 'OSHA training and incident reporting'
    }
  ];

  const adminItems = [
    {
      title: 'Admin Panel',
      href: '/admin',
      icon: Settings,
      description: 'User management and settings',
      badge: 'Admin'
    },
    {
      title: 'Reports',
      href: '/admin/reports',
      icon: BarChart3,
      description: 'Analytics and compliance reports'
    },
    {
      title: 'Documents',
      href: '/admin/documents',
      icon: FileText,
      description: 'Document management and requirements'
    },
    {
      title: 'PTO Management',
      href: '/admin/pto',
      icon: Clock,
      description: 'Approve and manage time off requests'
    }
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard' || pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-64 transform bg-white border-r transition-transform duration-200 ease-in-out md:relative md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo and header */}
          <div className="flex h-16 items-center justify-center border-b px-6">
            <Logo size="sm" />
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            <div className="space-y-1">
              {navigationItems.map((item) => (
                <Link key={item.href} href={item.href} onClick={onClose}>
                  <Button
                    variant={isActive(item.href) ? 'default' : 'ghost'}
                    className={cn(
                      'w-full justify-start gap-3 h-11 px-3',
                      isActive(item.href) && 'bg-primary text-white hover:bg-primary/90'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-medium">{item.title}</span>
                      <span className="text-xs opacity-70 hidden lg:block">
                        {item.description}
                      </span>
                    </div>
                  </Button>
                </Link>
              ))}
            </div>

            {/* Admin section */}
            {isAdmin && (
              <>
                <div className="pt-4">
                  <div className="px-3 py-2">
                    <h3 className="text-xs font-semibold text-secondary-500 uppercase tracking-wider">
                      Administration
                    </h3>
                  </div>
                  <div className="space-y-1">
                    {adminItems.map((item) => (
                      <Link key={item.href} href={item.href} onClick={onClose}>
                        <Button
                          variant={isActive(item.href) ? 'default' : 'ghost'}
                          className={cn(
                            'w-full justify-start gap-3 h-11 px-3',
                            isActive(item.href) && 'bg-primary text-white hover:bg-primary/90'
                          )}
                        >
                          <item.icon className="h-5 w-5" />
                          <div className="flex flex-col items-start flex-1">
                            <div className="flex items-center justify-between w-full">
                              <span className="text-sm font-medium">{item.title}</span>
                              {item.badge && (
                                <Badge variant="secondary" className="text-xs">
                                  {item.badge}
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs opacity-70 hidden lg:block">
                              {item.description}
                            </span>
                          </div>
                        </Button>
                      </Link>
                    ))}
                  </div>
                </div>
              </>
            )}
          </nav>

          {/* Footer with company values */}
          <div className="border-t p-4">
            <div className="text-center">
              <p className="text-xs font-semibold text-secondary-900 mb-2">
                Our Core Values
              </p>
              <div className="flex justify-center gap-2 text-xs">
                <span className="text-primary font-medium">Integrity</span>
                <span className="text-secondary-500">•</span>
                <span className="text-primary font-medium">Quality</span>
                <span className="text-secondary-500">•</span>
                <span className="text-primary font-medium">Simplicity</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
