import React from 'react';
import { cn } from '@/utils/cn';

export interface DialogProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const Dialog: React.FC<DialogProps> = ({
  children,
  open = false,
  onOpenChange,
  className,
  ...props
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={() => onOpenChange?.(false)}
      />
      <div
        className={cn(
          'relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4',
          className
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  );
};

export const DialogTrigger: React.FC<React.HTMLAttributes<HTMLButtonElement>> = ({
  children,
  onClick,
  ...props
}) => {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background"
      {...props}
    >
      {children}
    </button>
  );
};

export const DialogContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div className={cn("p-6", className)} {...props}>
      {children}
    </div>
  );
};

export const DialogHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props}>
      {children}
    </div>
  );
};

export const DialogTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className,
  ...props
}) => {
  return (
    <h2 className={cn("text-lg font-semibold text-gray-900", className)} {...props}>
      {children}
    </h2>
  );
};