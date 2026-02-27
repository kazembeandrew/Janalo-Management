import React, { useState } from 'react';
import { X, Menu, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface MobileMenuItem {
  title: string;
  href?: string;
  icon?: React.ReactNode;
  badge?: number;
  children?: MobileMenuItem[];
  onClick?: () => void;
}

export interface MobileMenuProps {
  items: MobileMenuItem[];
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export const MobileMenu: React.FC<MobileMenuProps> = ({
  items,
  isOpen,
  onClose,
  className
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = (title: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(title)) {
      newExpanded.delete(title);
    } else {
      newExpanded.add(title);
    }
    setExpandedItems(newExpanded);
  };

  const handleItemClick = (item: MobileMenuItem) => {
    if (item.children) {
      toggleExpanded(item.title);
    } else if (item.onClick) {
      item.onClick();
      onClose();
    } else if (item.href) {
      window.location.href = item.href;
      onClose();
    }
  };

  const renderMenuItem = (item: MobileMenuItem, level: number = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.title);

    return (
      <div key={item.title}>
        <button
          onClick={() => handleItemClick(item)}
          className={cn(
            'w-full flex items-center justify-between p-4 text-left transition-colors',
            'hover:bg-gray-50 active:bg-gray-100',
            level === 0 ? 'border-b border-gray-100' : 'pl-8'
          )}
        >
          <div className="flex items-center space-x-3">
            {item.icon && (
              <div className="flex-shrink-0 text-gray-400">
                {item.icon}
              </div>
            )}
            <span className="text-gray-900 font-medium">{item.title}</span>
          </div>
          <div className="flex items-center space-x-2">
            {item.badge && item.badge > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
            {hasChildren && (
              isExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )
            )}
          </div>
        </button>
        
        {hasChildren && isExpanded && (
          <div className="bg-gray-50">
            {item.children?.map(child => renderMenuItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
        onClick={onClose}
      />
      
      {/* Menu Panel */}
      <div className={cn(
        'fixed inset-y-0 left-0 z-50 w-80 bg-white shadow-xl md:hidden',
        'transform transition-transform duration-300 ease-in-out',
        isOpen ? 'translate-x-0' : '-translate-x-full',
        className
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
            title="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Menu Items */}
        <div className="flex-1 overflow-y-auto">
          {items.map(item => renderMenuItem(item))}
        </div>
      </div>
    </>
  );
};
