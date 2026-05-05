import * as React from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MetricTileProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  trend?: number;
  trendDir?: 'up' | 'down' | 'neutral';
  accentColor?: string;
  unit?: string;
}

const MetricTile = React.forwardRef<HTMLDivElement, MetricTileProps>(
  (
    {
      label,
      value,
      trend,
      trendDir = 'neutral',
      accentColor = '#6c8fff',
      unit,
      className,
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
      className={cn(
        'bg-bg-1 border border-border rounded-lg p-4 relative overflow-hidden',
        className
      )}
      {...props}
    >
      {/* Top accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{ backgroundColor: accentColor }}
      />

      <div className="text-xs font-medium text-ink-3 mb-2">{label}</div>

      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-1">
          <div
            className="text-2xl font-bold tracking-tight"
            style={{ color: accentColor }}
          >
            {value}
          </div>
          {unit && <span className="text-sm text-ink-3">{unit}</span>}
        </div>

        {trend !== undefined && (
          <div
            className={cn(
              'flex items-center gap-0.5 text-xs font-mono',
              trendDir === 'up' && 'text-success',
              trendDir === 'down' && 'text-danger',
              trendDir === 'neutral' && 'text-ink-3'
            )}
          >
            {trendDir === 'up' && <ArrowUp className="w-3 h-3" />}
            {trendDir === 'down' && <ArrowDown className="w-3 h-3" />}
            {trendDir === 'neutral' && <Minus className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
    </div>
  )
);
MetricTile.displayName = 'MetricTile';

export { MetricTile };
