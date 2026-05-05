import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  prefixIcon?: React.ReactNode;
  suffixIcon?: React.ReactNode;
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, prefixIcon, suffixIcon, error, type, ...props }, ref) => (
    <div className="relative">
      {prefixIcon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none">
          {prefixIcon}
        </div>
      )}
      <input
        type={type}
        className={cn(
          'bg-bg border rounded-md text-ink font-mono text-sm py-2 px-3 w-full',
          'focus:border-accent/60 focus:ring-2 focus:ring-accent/10 focus:outline-none',
          'transition-colors duration-150',
          prefixIcon && 'pl-9',
          suffixIcon && 'pr-9',
          error && 'border-danger focus:border-danger focus:ring-danger/10',
          'placeholder:text-ink-3',
          className
        )}
        ref={ref}
        {...props}
      />
      {suffixIcon && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none">
          {suffixIcon}
        </div>
      )}
    </div>
  )
);
Input.displayName = 'Input';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
    <textarea
      className={cn(
        'bg-bg border border-border rounded-md text-ink font-mono text-sm py-2 px-3 w-full',
        'focus:border-accent/60 focus:ring-2 focus:ring-accent/10 focus:outline-none',
        'transition-colors duration-150 resize-none',
        error && 'border-danger focus:border-danger focus:ring-danger/10',
        'placeholder:text-ink-3',
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';

export { Input, Textarea };
