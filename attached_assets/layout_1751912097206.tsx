
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers/session-provider';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Roof-ER HR System - Internal Management Platform',
  description: 'Comprehensive HR management system for Roof-ER - The Roof Docs. Managing integrity, quality, and simplicity in every interaction.',
  keywords: ['HR', 'Roof-ER', 'Roofing', 'Employee Management', 'PTO', 'Safety', 'OSHA'],
  authors: [{ name: 'Roof-ER Development Team' }],
  viewport: 'width=device-width, initial-scale=1',
  themeColor: '#B70808',
  icons: {
    icon: '/roof-er-logo.png',
    apple: '/roof-er-logo.png',
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full antialiased`}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
