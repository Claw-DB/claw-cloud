'use client';

import * as React from 'react';
import { Bell, Check, CheckCheck, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function typeIcon(type: string) {
  const map: Record<string, string> = {
    INSTANCE_ALERT: '⚠️',
    BACKUP_COMPLETED: '✅',
    BILLING_PAYMENT_FAILED: '❌',
    BILLING_INVOICE_READY: '🧾',
    TEAM_INVITE: '👋',
    USAGE_ALERT: '📊',
  };
  return map[type] ?? '🔔';
}

export function NotificationBell() {
  const [open, setOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [unread, setUnread] = React.useState(0);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  // Close on outside click
  React.useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !buttonRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch initial notifications + unread count
  React.useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('claw_token') : null;
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${API_BASE}/notifications`, { headers }).then((r) => r.json()),
      fetch(`${API_BASE}/notifications/unread-count`, { headers }).then((r) => r.json()),
    ])
      .then(([items, { count }]) => {
        setNotifications(Array.isArray(items) ? items : []);
        setUnread(typeof count === 'number' ? count : 0);
      })
      .catch(() => {});
  }, []);

  // SSE stream
  React.useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('claw_token') : null;
    if (!token) return;

    const sse = new EventSource(`${API_BASE}/notifications/stream?token=${token}`);

    sse.onmessage = (e) => {
      try {
        const notif: Notification = JSON.parse(e.data);
        setNotifications((prev) => [notif, ...prev].slice(0, 50));
        setUnread((c) => c + 1);
      } catch {
        // ignore ping or malformed data
      }
    };

    return () => sse.close();
  }, []);

  const markRead = async (id: string) => {
    const token = localStorage.getItem('claw_token');
    if (!token) return;

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    setUnread((c) => Math.max(0, c - 1));

    await fetch(`${API_BASE}/notifications/${id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  };

  const markAllRead = async () => {
    const token = localStorage.getItem('claw_token');
    if (!token) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);

    await fetch(`${API_BASE}/notifications/read-all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg text-ink-3 hover:text-ink hover:bg-bg-3 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-bg-1 shadow-xl z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="text-sm font-semibold text-ink">Notifications</div>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-accent hover:underline"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-ink-3 hover:text-ink">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-sm text-ink-3">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    'flex gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-bg-2 transition-colors cursor-default',
                    !n.read && 'bg-accent/5',
                  )}
                >
                  <span className="text-base shrink-0 mt-0.5">{typeIcon(n.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn('text-sm font-medium', n.read ? 'text-ink-2' : 'text-ink')}>
                        {n.title}
                      </p>
                      {!n.read && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="text-ink-3 hover:text-accent shrink-0"
                          title="Mark as read"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-ink-3 mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-xs text-ink-3/60 mt-1">{fmtRelative(n.createdAt)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
