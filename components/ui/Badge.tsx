import React from 'react';
import { cn } from '@/utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md' | 'lg';
}

const variantClasses = {
  default: 'bg-gray-100 text-gray-700 border border-gray-200',
  primary: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
  secondary: 'bg-purple-100 text-purple-700 border border-purple-200',
  success: 'bg-green-100 text-green-700 border border-green-200',
  warning: 'bg-amber-100 text-amber-700 border border-amber-200',
  error: 'bg-red-100 text-red-700 border border-red-200',
  info: 'bg-blue-100 text-blue-700 border border-blue-200'
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-[10px] font-bold',
  md: 'px-2.5 py-1 text-xs font-bold',
  lg: 'px-3 py-1.5 text-sm font-bold'
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  className,
  variant = 'default',
  size = 'md',
  ...props
}) => {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full uppercase tracking-wider',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
