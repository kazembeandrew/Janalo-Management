import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  subtitle?: string;
  accentColor?: string;
  trend?: 'up' | 'down' | 'neutral';
}

const ACCENT_MAP: Record<string, string> = {
  'bg-red-500':    'linear-gradient(90deg, #ef4444, #f87171)',
  'bg-green-600':  'linear-gradient(90deg, #16a34a, #4ade80)',
  'bg-purple-600': 'linear-gradient(90deg, #9333ea, #c084fc)',
  'bg-indigo-600': 'linear-gradient(90deg, #4f46e5, #818cf8)',
  'bg-blue-600':   'linear-gradient(90deg, #2563eb, #60a5fa)',
  'bg-amber-500':  'linear-gradient(90deg, #f59e0b, #fbbf24)',
  'bg-emerald-500':'linear-gradient(90deg, #10b981, #34d399)',
};

const ICON_BG_MAP: Record<string, string> = {
  'bg-red-500':    'bg-red-50 text-red-500',
  'bg-green-600':  'bg-green-50 text-green-600',
  'bg-purple-600': 'bg-purple-50 text-purple-600',
  'bg-indigo-600': 'bg-indigo-50 text-indigo-600',
  'bg-blue-600':   'bg-blue-50 text-blue-600',
  'bg-amber-500':  'bg-amber-50 text-amber-500',
  'bg-emerald-500':'bg-emerald-50 text-emerald-600',
};

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color, subtitle }) => {
  const accent = ACCENT_MAP[color] ?? 'linear-gradient(90deg, #6366f1, #818cf8)';
  const iconBg = ICON_BG_MAP[color] ?? 'bg-indigo-50 text-indigo-600';

  return (
    <div
      className="stat-card p-5 flex items-start justify-between min-w-0 group"
      style={{ '--card-accent': accent } as React.CSSProperties}
    >
      {/* Left: text */}
      <div className="min-w-0 flex-1 pr-3">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 truncate">
          {title}
        </p>
        <div
          className="text-xl font-extrabold text-gray-900 font-display leading-tight group-hover:text-indigo-900 transition-colors duration-200"
          title={String(value)}
          style={{
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            wordBreak: 'break-all',
          }}
        >
          {value}
        </div>
        {subtitle && (
          <p className="text-[11px] text-gray-400 mt-1.5 truncate font-medium">{subtitle}</p>
        )}
      </div>

      {/* Right: icon */}
      <div className={`p-2.5 rounded-xl ${iconBg} shrink-0 transition-transform duration-300 group-hover:scale-110`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
};