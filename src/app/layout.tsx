import '@/styles/globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { RegisterServiceWorker } from '@/components/pwa/register-sw';
import { getOptionalUserId } from '@/lib/auth';
import { LogoutButton } from '@/components/logout-button';
import { BrandLogo } from '@/components/brand-logo';

export const metadata: Metadata = {
  title: 'My Money Maker',
  description: 'AI-powered business-building assistant for social sellers and network marketers',
  manifest: '/manifest.webmanifest'
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const userId = await getOptionalUserId();

  return (
    <html lang="en">
      <body>
        <header className="border-b border-clemson-stadium bg-white">
          <div className="mx-auto flex max-w-5xl items-start justify-between px-4 py-3">
            <BrandLogo compact />
            <nav className="flex items-center gap-4 pt-2 text-sm">
              <Link href="/dashboard" className="hover:text-clemson-purple">Dashboard</Link>
              <Link href="/tracker" className="hover:text-clemson-purple">Tracker</Link>
              <Link href="/admin" className="hover:text-clemson-purple">Admin</Link>
              {userId ? <LogoutButton /> : <Link href="/auth" className="hover:text-clemson-purple">Login</Link>}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
