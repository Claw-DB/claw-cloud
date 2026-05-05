import * as React from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

const Tooltip = RadixTooltip.Root;

interface TooltipTriggerProps
  extends React.ComponentPropsWithoutRef<typeof RadixTooltip.Trigger> {}

const TooltipTrigger = React.forwardRef<
  React.ElementRef<typeof RadixTooltip.Trigger>,
  TooltipTriggerProps
>(({ className, ...props }, ref) => (
  <RadixTooltip.Trigger
    ref={ref}
    className={cn('cursor-help', className)}
    {...props}
  />
));
TooltipTrigger.displayName = RadixTooltip.Trigger.displayName;

interface TooltipContentProps
  extends React.ComponentPropsWithoutRef<typeof RadixTooltip.Content> {}

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof RadixTooltip.Content>,
  TooltipContentProps
>(({ className, sideOffset = 4, ...props }, ref) => (
  <RadixTooltip.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      'z-50 inline-flex items-center rounded-md border border-border bg-bg-3 px-2.5 py-1.5 text-xs text-ink max-w-[220px] word-wrap animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
      className
    )}
    {...props}
  />
));
TooltipContent.displayName = RadixTooltip.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent };
