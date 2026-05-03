// Admin panel root layout — wraps all internal admin pages
import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Claw Cloud Admin',
  description: 'Internal operations dashboard',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="admin-shell">
          <aside className="admin-nav">
            <h2>Platform Ops</h2>
            <Link href="/">Overview</Link>
            <Link href="/tenants">Tenants</Link>
            <Link href="/instances">Instances</Link>
            <Link href="/incidents">Incidents</Link>
          </aside>
          <main className="admin-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
