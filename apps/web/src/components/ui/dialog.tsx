import * as React from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const Dialog = RadixDialog.Root;
const DialogTrigger = RadixDialog.Trigger;

interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof RadixDialog.Content> {}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Content>,
  DialogContentProps
>(({ className, ...props }, ref) => (
  <RadixDialog.Portal>
    <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
    <RadixDialog.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-xl border border-border bg-bg-1 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
        className
      )}
      {...props}
    />
    <RadixDialog.Close className="absolute right-4 top-4 rounded-md opacity-70 ring-offset-bg-1 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent/10">
      <X className="h-4 w-4" />
    </RadixDialog.Close>
  </RadixDialog.Portal>
));
DialogContent.displayName = RadixDialog.Content.displayName;

interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

const DialogHeader = ({
  className,
  ...props
}: DialogHeaderProps) => (
  <div
    className={cn('flex flex-col space-y-1.5 border-b border-border px-6 py-4', className)}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

interface DialogTitleProps
  extends React.ComponentPropsWithoutRef<typeof RadixDialog.Title> {}

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Title>,
  DialogTitleProps
>(({ className, ...props }, ref) => (
  <RadixDialog.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
DialogTitle.displayName = RadixDialog.Title.displayName;

interface DialogBodyProps extends React.HTMLAttributes<HTMLDivElement> {}

const DialogBody = ({
  className,
  ...props
}: DialogBodyProps) => (
  <div className={cn('px-6 py-4', className)} {...props} />
);
DialogBody.displayName = 'DialogBody';

interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

const DialogFooter = ({
  className,
  ...props
}: DialogFooterProps) => (
  <div
    className={cn('flex justify-end gap-2 border-t border-border px-6 py-4', className)}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
};
