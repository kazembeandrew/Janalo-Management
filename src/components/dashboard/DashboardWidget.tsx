import React, { useState } from 'react';
import { MoreHorizontal, RefreshCw, X, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface WidgetProps {
  id: string;
  title: string;
  children: React.ReactNode;
  className?: string;
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
  onRemove?: () => void;
  collapsible?: boolean;
  resizable?: boolean;
}

export interface DashboardWidgetProps extends WidgetProps {
  size?: 'small' | 'medium' | 'large' | 'full';
  position?: { x: number; y: number };
  onResize?: (size: 'small' | 'medium' | 'large' | 'full') => void;
  onMove?: (position: { x: number; y: number }) => void;
}

const sizeClasses = {
  small: 'col-span-1 row-span-1',
  medium: 'col-span-2 row-span-1',
  large: 'col-span-2 row-span-2',
  full: 'col-span-full row-span-2'
};

export const DashboardWidget: React.FC<DashboardWidgetProps> = ({
  id,
  title,
  children,
  className,
  loading = false,
  error,
  onRefresh,
  onRemove,
  collapsible = true,
  resizable = true,
  size = 'medium',
  onResize,
  onMove,
  position = { x: 0, y: 0 }
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleRefresh = () => {
    onRefresh?.();
  };

  const handleRemove = () => {
    onRemove?.();
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleResize = (newSize: 'small' | 'medium' | 'large' | 'full') => {
    onResize?.(newSize);
  };

  return (
    <div
      className={cn(
        'bg-white rounded-2xl shadow-sm border border-gray-200 transition-all duration-200',
        'hover:shadow-md',
        sizeClasses[size],
        isExpanded && 'fixed inset-4 z-50 col-span-full row-span-full',
        className
      )}
      style={isExpanded ? undefined : { transform: `translate(${position.x}px, ${position.y}px)` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center space-x-2">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          {loading && <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />}
        </div>
        
        <div className="flex items-center space-x-1">
          {onRefresh && (
            <button
              onClick={handleRefresh}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
          
          {collapsible && (
            <button
              onClick={toggleCollapse}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title={isCollapsed ? 'Expand' : 'Collapse'}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          )}
          
          {resizable && !isExpanded && (
            <button
              onClick={toggleExpand}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Expand"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          )}
          
          {isExpanded && (
            <button
              onClick={toggleExpand}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Minimize"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
          )}
          
          {onRemove && (
            <button
              onClick={handleRemove}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Remove"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={cn(
        'transition-all duration-200',
        isCollapsed ? 'h-0 overflow-hidden' : 'p-4'
      )}>
        {error ? (
          <div className="flex items-center justify-center h-32 text-red-600">
            <div className="text-center">
              <p className="text-sm font-medium">Error loading widget</p>
              <p className="text-xs text-gray-500 mt-1">{error}</p>
            </div>
          </div>
        ) : (
          children
        )}
      </div>

      {/* Resize Handle */}
      {resizable && !isExpanded && (
        <div className="absolute bottom-0 right-0 p-1 opacity-0 hover:opacity-100 transition-opacity">
          <div className="w-3 h-3 border-r-2 border-b-2 border-gray-400 cursor-se-resize" />
        </div>
      )}
    </div>
  );
};

// Widget Registry for managing dashboard widgets
export interface WidgetConfig {
  id: string;
  type: string;
  title: string;
  size: 'small' | 'medium' | 'large' | 'full';
  position: { x: number; y: number };
  props?: Record<string, any>;
}

export class WidgetRegistry {
  private widgets = new Map<string, WidgetConfig>();
  private components = new Map<string, React.ComponentType<any>>();

  registerComponent(type: string, component: React.ComponentType<any>) {
    this.components.set(type, component);
  }

  addWidget(config: WidgetConfig) {
    this.widgets.set(config.id, config);
  }

  removeWidget(id: string) {
    this.widgets.delete(id);
  }

  updateWidget(id: string, updates: Partial<WidgetConfig>) {
    const widget = this.widgets.get(id);
    if (widget) {
      this.widgets.set(id, { ...widget, ...updates });
    }
  }

  getWidgets(): WidgetConfig[] {
    return Array.from(this.widgets.values());
  }

  getWidget(id: string): WidgetConfig | undefined {
    return this.widgets.get(id);
  }

  getComponent(type: string): React.ComponentType<any> | undefined {
    return this.components.get(type);
  }

  clear() {
    this.widgets.clear();
  }
}

export const widgetRegistry = new WidgetRegistry();
