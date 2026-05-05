import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, ...props }, ref) => (
    <div className="relative">
      <select
        className={cn(
          'appearance-none bg-bg border border-border rounded-md text-ink font-mono text-sm py-2 px-3 w-full',
          'focus:border-accent/60 focus:ring-2 focus:ring-accent/10 focus:outline-none',
          'transition-colors duration-150 pr-9',
          error && 'border-danger focus:border-danger focus:ring-danger/10',
          'cursor-pointer',
          className
        )}
        ref={ref}
        {...props}
      />
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none" />
    </div>
  )
);
Select.displayName = 'Select';

export { Select };
