import React from 'react';
import { cn } from '@/utils/cn';

export interface TouchButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  touchSize?: 'sm' | 'md' | 'lg'; // Larger touch targets for mobile
}

const variantClasses = {
  primary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-900',
  ghost: 'bg-transparent hover:bg-gray-100 text-gray-700'
};

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-4 py-2 text-base rounded-xl',
  lg: 'px-6 py-3 text-lg rounded-2xl'
};

const touchSizeClasses = {
  sm: 'min-h-[44px] min-w-[44px]', // iOS HIG minimum
  md: 'min-h-[48px] min-w-[48px]',
  lg: 'min-h-[52px] min-w-[52px]'
};

export const TouchButton: React.FC<TouchButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  touchSize = 'md',
  ...props
}) => {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
        'active:scale-95 touch-manipulation', // Touch feedback
        variantClasses[variant],
        sizeClasses[size],
        touchSizeClasses[touchSize],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};
