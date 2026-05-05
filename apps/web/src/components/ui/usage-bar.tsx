import * as React from 'react';
import { cn } from '@/lib/utils';

export interface UsageBarProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  used: number;
  total: number;
  unit: string;
  colorClass?: string;
}

const UsageBar = React.forwardRef<HTMLDivElement, UsageBarProps>(
  (
    {
      label,
      used,
      total,
      unit,
      colorClass = 'bg-accent',
      className,
      ...props
    },
    ref
  ) => {
    const percentage = Math.min((used / total) * 100, 100);

    return (
      <div ref={ref} className={cn('', className)} {...props}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-ink">{label}</span>
          <span className="text-xs text-ink-2 font-mono">
            {used.toLocaleString()} / {total.toLocaleString()} {unit}
          </span>
        </div>
        <div className="h-1 bg-bg-3 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', colorClass)}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }
);
UsageBar.displayName = 'UsageBar';

export { UsageBar };
