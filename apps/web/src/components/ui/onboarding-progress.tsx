import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OnboardingStep {
  label: string;
  done: boolean;
  current: boolean;
}

interface OnboardingProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  steps: OnboardingStep[];
}

const OnboardingProgress = React.forwardRef<HTMLDivElement, OnboardingProgressProps>(
  ({ steps, className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center justify-center', className)} {...props}>
      {steps.map((step, idx) => (
        <React.Fragment key={idx}>
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-colors',
                step.done
                  ? 'bg-accent text-white'
                  : step.current
                    ? 'bg-accent text-white ring-2 ring-accent ring-offset-2 ring-offset-bg'
                    : 'bg-bg-3 text-ink-3'
              )}
            >
              {step.done ? <Check className="w-4 h-4" /> : idx + 1}
            </div>
            <span className="text-xs font-medium text-ink-2 mt-2 text-center whitespace-nowrap">
              {step.label}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div
              className={cn(
                'h-0.5 w-12 mx-4 transition-colors',
                step.done ? 'bg-accent' : 'bg-bg-3'
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  )
);
OnboardingProgress.displayName = 'OnboardingProgress';

export { OnboardingProgress };
