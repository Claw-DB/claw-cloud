// Admin panel root layout — wraps all internal admin pages
import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Claw Cloud Admin',
  description: 'Internal operations dashboard',
};

const NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: '📊' },
  { href: '/tenants', label: 'Tenants', icon: '🏢' },
  { href: '/instances', label: 'Instances', icon: '🖥️' },
  { href: '/incidents', label: 'Incidents', icon: '🚨' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#080a0f] text-[#e8eaf0] min-h-screen">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="w-56 border-r border-[#1e2433] bg-[#0d1018] flex flex-col shrink-0">
            <div className="px-5 py-4 border-b border-[#1e2433]">
              <div className="text-xs font-semibold text-[#6c7a96] uppercase tracking-widest">Claw Cloud</div>
              <div className="text-sm font-bold text-[#e8eaf0] mt-0.5">Admin Panel</div>
            </div>
            <nav className="p-3 flex flex-col gap-0.5 flex-1">
              {NAV_ITEMS.map(({ href, label, icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[#9aa3b8] hover:text-[#e8eaf0] hover:bg-[#131720] transition-colors"
                >
                  <span>{icon}</span>
                  {label}
                </Link>
              ))}
            </nav>
            <div className="p-4 border-t border-[#1e2433]">
              <div className="text-xs text-[#6c7a96]">Internal use only</div>
            </div>
          </aside>

          {/* Main */}
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
