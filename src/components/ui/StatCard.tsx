import React from 'react';
import { cn } from '@/utils/cn';

export interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: string | number;
    type: 'increase' | 'decrease' | 'neutral';
  };
  icon?: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  loading?: boolean;
  className?: string;
}

const variantClasses = {
  default: 'bg-white border border-gray-100',
  success: 'bg-green-50 border border-green-100',
  warning: 'bg-amber-50 border border-amber-100',
  error: 'bg-red-50 border border-red-100',
  info: 'bg-blue-50 border border-blue-100'
};

const changeColorClasses = {
  increase: 'text-green-600',
  decrease: 'text-red-600',
  neutral: 'text-gray-600'
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  icon,
  variant = 'default',
  loading = false,
  className
}) => {
  if (loading) {
    return (
      <div className={cn('bg-white p-6 rounded-2xl shadow-sm border border-gray-100', className)}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('p-6 rounded-2xl shadow-sm', variantClasses[variant], className)}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            {title}
          </p>
          <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
          {change && (
            <div className={cn('mt-2 flex items-center text-xs font-medium', changeColorClasses[change.type])}>
              <span>{change.value}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="ml-4 flex-shrink-0">
            <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600">
              {icon}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
