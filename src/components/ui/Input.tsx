import React from 'react';
import { cn } from '@/utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  variant?: 'default' | 'filled' | 'outlined';
}

const variantClasses = {
  default: 'bg-gray-50 border border-gray-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500',
  filled: 'bg-gray-100 border-0 focus:bg-white focus:ring-2 focus:ring-indigo-500',
  outlined: 'bg-transparent border-2 border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500'
};

export const Input: React.FC<InputProps> = ({
  className,
  label,
  error,
  helperText,
  startIcon,
  endIcon,
  variant = 'default',
  id,
  ...props
}) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-bold text-gray-700"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {startIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {startIcon}
          </div>
        )}
        <input
          id={inputId}
          className={cn(
            'block w-full rounded-xl transition-all duration-200',
            'placeholder-gray-400 text-sm',
            startIcon ? 'pl-10' : 'pl-3',
            endIcon ? 'pr-10' : 'pr-3',
            'py-2.5',
            variantClasses[variant],
            error && 'border-red-300 focus:border-red-500 focus:ring-red-500',
            className
          )}
          {...props}
        />
        {endIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            {endIcon}
          </div>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-600 font-medium">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-xs text-gray-500">{helperText}</p>
      )}
    </div>
  );
};
