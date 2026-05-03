// Next.js app layout — root layout wrapping all dashboard pages with auth context
import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Claw Cloud — Managed ClawDB Platform',
  description: 'The managed hosted platform for ClawDB',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="mesh-bg" />
        <div className="app-shell">
          <aside className="app-sidebar">
            <div className="brand">clawdb cloud</div>
            <nav className="app-nav">
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/instances">Instances</Link>
              <Link href="/billing">Billing</Link>
              <Link href="/api-explorer">API Explorer</Link>
              <Link href="/team">Team</Link>
              <Link href="/settings">Settings</Link>
            </nav>
          </aside>
          <main className="app-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
