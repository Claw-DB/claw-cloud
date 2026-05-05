import * as React from 'react';
import { cn } from '@/lib/utils';

interface PageWrapperProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function PageWrapper({ children, className, ...props }: PageWrapperProps) {
  return (
    <div
      className={cn(
        'p-7 animate-fade-up',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
