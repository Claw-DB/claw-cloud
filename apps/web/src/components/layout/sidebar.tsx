'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useAuth, useWorkspace } from '@/app/providers';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: string;
}

interface NavSection {
  label?: string;
  items: NavItem[];
}

const NAVIGATION: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: '📊' },
    ],
  },
  {
    label: 'Control Plane',
    items: [
      { label: 'Instances', href: '/dashboard/instances', icon: '🖥️' },
      { label: 'API Keys', href: '/dashboard/api-keys', icon: '🔑' },
      { label: 'Usage', href: '/dashboard/usage', icon: '📈' },
      { label: 'Team', href: '/dashboard/team', icon: '👥' },
      { label: 'Sync Hub', href: '/dashboard/sync', icon: '🔄' },
      { label: 'AI Assistant', href: '/dashboard/ai', icon: '🤖' },
      { label: 'Integrations', href: '/dashboard/integrations', icon: '🔌' },
      { label: 'Webhooks', href: '/dashboard/webhooks', icon: '🪝' },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Billing', href: '/dashboard/billing', icon: '💳' },
      { label: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
    ],
  },
];

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { workspace, workspaces, setWorkspaceId } = useWorkspace();
  const [wsSwitcherOpen, setWsSwitcherOpen] = React.useState(false);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <aside className="w-56 border-r border-border bg-bg-1 flex flex-col overflow-y-auto shrink-0">
      {/* Logo */}
      <div className="p-5 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 shrink-0">
            <svg width="32" height="32" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="64" height="64" rx="12" fill="#0f0e0c"/>
              <g stroke="#6c8fff" strokeLinecap="round" strokeLinejoin="round" fill="none">
                <path strokeWidth="3.5" d="M20 47 C18 38 22 30 26 24 C28 20 28 15 24 13"/>
                <path strokeWidth="3.5" d="M31 47 C30 37 34 28 37 22 C39 17 37 12 33 11"/>
                <path strokeWidth="3.5" d="M41 47 C41 37 45 29 47 23 C49 17 46 12 42 12"/>
                <ellipse cx="32" cy="51" rx="14" ry="3.5" strokeWidth="2" opacity="0.45"/>
              </g>
            </svg>
          </div>
          <div>
            <div className="font-semibold text-sm text-ink">ClawDB</div>
            <div className="text-xs text-ink-3">cloud</div>
          </div>
        </Link>
      </div>

      {/* Workspace Switcher */}
      <div className="p-3 border-b border-border relative">
        <button
          onClick={() => setWsSwitcherOpen((v) => !v)}
          className="w-full text-left px-3 py-2 rounded-md bg-bg-2 hover:bg-bg-3 transition-colors text-sm font-medium text-ink flex items-center justify-between gap-1"
        >
          <span className="truncate">{workspace?.name ?? 'Select workspace'}</span>
          <ChevronDown className={cn('w-3.5 h-3.5 text-ink-3 shrink-0 transition-transform', wsSwitcherOpen && 'rotate-180')} />
        </button>

        {wsSwitcherOpen && workspaces.length > 0 && (
          <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-bg-2 border border-border rounded-md shadow-xl overflow-hidden">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => { setWorkspaceId(ws.id); setWsSwitcherOpen(false); }}
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-bg-3 transition-colors flex items-center justify-between gap-2"
              >
                <span className="truncate text-ink">{ws.name}</span>
                {ws.id === workspace?.id && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
              </button>
            ))}
            <div className="border-t border-border">
              <Link
                href="/onboarding"
                onClick={() => setWsSwitcherOpen(false)}
                className="block px-3 py-2.5 text-sm text-accent hover:bg-bg-3 transition-colors"
              >
                + New workspace
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {NAVIGATION.map((section, idx) => (
          <div key={idx} className={idx > 0 ? 'mt-6' : ''}>
            {section.label && (
              <div className="px-3 py-2 text-xs font-semibold text-ink-3 uppercase tracking-wider">
                {section.label}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-accent/10 text-accent border-l-2 border-accent pl-2.5'
                        : 'text-ink-2 hover:text-ink hover:bg-bg-2',
                    )}
                  >
                    <span className="text-base leading-none">{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && <Badge variant="info">{item.badge}</Badge>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User Row */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold shrink-0">
            {user ? initials(user.name) : '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-ink truncate">{user?.name ?? '—'}</div>
            <div className="text-xs text-ink-3 truncate">{workspace?.plan ?? 'Free'}</div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-1.5 rounded hover:bg-bg-3 text-ink-3 hover:text-ink transition-colors shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
