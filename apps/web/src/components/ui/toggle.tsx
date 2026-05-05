import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ToggleProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Toggle = React.forwardRef<HTMLInputElement, ToggleProps>(
  ({ className, ...props }, ref) => {
    const id = React.useId();
    return (
      <label htmlFor={id} className="inline-flex cursor-pointer">
        <input
          ref={ref}
          type="checkbox"
          id={id}
          className="sr-only peer"
          {...props}
        />
        <div
          className={cn(
            'relative h-5 w-9 rounded-full bg-bg-3 transition-colors duration-200 peer-checked:bg-accent',
            className
          )}
        >
          <div className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-4" />
        </div>
      </label>
    );
  }
);
Toggle.displayName = 'Toggle';

export { Toggle };
