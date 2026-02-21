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
  <div className="bg-white overflow-hidden rounded-xl shadow-sm border border-gray-100 p-5 flex items-start justify-between min-w-0">
      <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 truncate">{title}</p>
          {/* Reduced font size from text-2xl to text-lg/xl for better fit */}
          <h3 className="text-base sm:text-lg font-extrabold text-gray-900 truncate leading-tight" title={String(value)}>
            {value}
          </h3>
          {subtitle && <p className="text-[10px] text-gray-400 mt-1 truncate font-medium">{subtitle}</p>}
      </div>
      <div className={`p-2 rounded-lg ${color} bg-opacity-10 ml-3 shrink-0`}>
          <Icon className={`h-5 w-5 ${color.replace('bg-', 'text-')}`} />
      </div>
  </div>
);