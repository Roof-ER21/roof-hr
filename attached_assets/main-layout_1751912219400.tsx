
'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Header } from './header';
import { Sidebar } from './sidebar';
import { Providers } from '@/components/providers/session-provider';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="spinner border-primary"></div>
      </div>
    );
  }

  if (!session) {
    return <div>{children}</div>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-auto bg-muted/30">
          <div className="mobile-container py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
