'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CopyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  copyDuration?: number;
}

const CopyButton = React.forwardRef<HTMLButtonElement, CopyButtonProps>(
  ({ value, copyDuration = 1500, className, ...props }, ref) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), copyDuration);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    };

    return (
      <button
        ref={ref}
        onClick={handleCopy}
        className={cn(
          'inline-flex items-center justify-center rounded-md p-1.5 text-ink-2 transition-colors hover:bg-bg-2',
          className
        )}
        {...props}
      >
        {copied ? (
          <Check className="w-4 h-4 text-success" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </button>
    );
  }
);
CopyButton.displayName = 'CopyButton';

export { CopyButton };
