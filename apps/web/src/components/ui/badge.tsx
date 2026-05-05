import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono',
  {
    variants: {
      variant: {
        active: 'bg-success/20 text-success',
        pending: 'bg-warning/20 text-warning',
        error: 'bg-danger/20 text-danger',
        info: 'bg-accent/20 text-accent',
        neutral: 'bg-bg-3 text-ink-2',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  withDot?: boolean;
  animated?: boolean;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, withDot, animated, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    >
      {withDot && (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            {
              active: 'bg-success',
              pending: 'bg-warning',
              error: 'bg-danger',
              info: 'bg-accent',
              neutral: 'bg-ink-3',
            }[variant || 'neutral'],
            animated && 'animate-pulse-dot'
          )}
        />
      )}
    </span>
  )
);
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
