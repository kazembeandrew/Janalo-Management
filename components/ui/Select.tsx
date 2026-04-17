import React from 'react';
import { cn } from '@/utils/cn';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const Select: React.FC<SelectProps> = ({
  className,
  children,
  ...props
}) => {
  return (
    <select
      className={cn(
        'block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
};

export const SelectTrigger: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        'block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const SelectValue: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({
  children,
  className,
  ...props
}) => {
  return (
    <span className={cn("block truncate", className)} {...props}>
      {children}
    </span>
  );
};

export const SelectContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        'absolute z-50 w-full bg-white border border-gray-300 rounded-md shadow-lg mt-1',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const SelectItem: React.FC<React.OptionHTMLAttributes<HTMLOptionElement>> = ({
  children,
  className,
  ...props
}) => {
  return (
    <option
      className={cn(
        'block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </option>
  );
};