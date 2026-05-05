import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ActivityFeedItem {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  time: string;
  variant?: 'default' | 'success' | 'warning' | 'error';
}

interface ActivityFeedProps extends React.HTMLAttributes<HTMLDivElement> {
  items: ActivityFeedItem[];
}

const ActivityFeed = React.forwardRef<HTMLDivElement, ActivityFeedProps>(
  ({ items, className, ...props }, ref) => (
    <div ref={ref} className={cn('space-y-3', className)} {...props}>
      {items.map((item) => (
        <div key={item.id} className="flex gap-3">
          <div
            className={cn(
              'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-ink-2',
              {
                'default': 'bg-bg-2',
                'success': 'bg-success/10 text-success',
                'warning': 'bg-warning/10 text-warning',
                'error': 'bg-danger/10 text-danger',
              }[item.variant || 'default']
            )}
          >
            {item.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-ink">{item.title}</div>
            <div className="text-xs text-ink-3">{item.description}</div>
            <div className="text-xs text-ink-3 font-mono mt-1">{item.time}</div>
          </div>
        </div>
      ))}
    </div>
  )
);
ActivityFeed.displayName = 'ActivityFeed';

export { ActivityFeed };
