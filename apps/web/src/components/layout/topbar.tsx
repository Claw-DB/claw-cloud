'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/ui/notification-bell';

interface TopbarProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  actions?: React.ReactNode;
}

export function Topbar({ title, actions, className, ...props }: TopbarProps) {
  return (
    <div
      className={cn(
        'sticky top-0 z-10 h-14 border-b border-border bg-bg/85 backdrop-blur-md px-7 flex items-center justify-between',
        className
      )}
      {...props}
    >
      {title && <h1 className="text-lg font-semibold text-ink">{title}</h1>}
      <div className="flex items-center gap-2 ml-auto">
        {actions && <div className="flex items-center gap-3">{actions}</div>}
        <NotificationBell />
      </div>
    </div>
  );
}
