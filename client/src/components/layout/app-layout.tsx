import { useState } from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background transition-colors">
      {/* The sidebar carries every nav link in the app, so without this a
          keyboard user tabs through all of them on every single page before
          reaching the content. Invisible until focused. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-sm focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-col flex-1">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {/* tabIndex={-1} so the skip link can actually move focus here, rather
            than only scrolling the page and leaving focus in the nav. */}
        <main id="main-content" tabIndex={-1} className="flex-1 bg-background focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
