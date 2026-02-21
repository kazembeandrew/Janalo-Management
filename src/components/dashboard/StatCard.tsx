import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  subtitle?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color, subtitle }) => (
  <div className="bg-white overflow-hidden rounded-xl shadow-sm border border-gray-100 p-5 flex items-start justify-between">
      <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-500 mb-1 truncate">{title}</p>
          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 truncate" title={String(value)}>{value}</h3>
          {subtitle && <p className="text-xs text-gray-400 mt-1 truncate">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-lg ${color} bg-opacity-10 ml-4 shrink-0`}>
          <Icon className={`h-6 w-6 ${color.replace('bg-', 'text-')}`} />
      </div>
  </div>
);