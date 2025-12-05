import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { NotificationDropdown } from '@/components/notifications/notification-dropdown';
import { SearchModal } from '@/components/search/search-modal';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={onMenuClick}
            >
              <Menu className="w-6 h-6" />
            </Button>
            <div className="ml-4 md:ml-0">
              <h1 className="text-2xl font-semibold text-secondary-950">Dashboard</h1>
              <p className="text-sm text-secondary-600">
                Welcome back, {user?.firstName}. Here's what's happening today.
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <NotificationDropdown />
            <SearchModal />
            <Button
              variant="ghost"
              onClick={logout}
              className="text-sm"
            >
              Logout
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
