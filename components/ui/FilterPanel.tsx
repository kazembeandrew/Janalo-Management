import React, { useState } from 'react';
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';
import { cn } from '@/utils/cn';

export interface FilterOption {
  label: string;
  value: string;
  count?: number;
}

export interface FilterGroup {
  name: string;
  key: string;
  options: FilterOption[];
  type: 'checkbox' | 'radio';
}

export interface FilterPanelProps {
  groups: FilterGroup[];
  filters: Record<string, string[]>;
  onFilterChange: (key: string, value: string[]) => void;
  onClearAll: () => void;
  className?: string;
  isOpen?: boolean;
  onToggle?: () => void;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  groups,
  filters,
  onFilterChange,
  onClearAll,
  className,
  isOpen = false,
  onToggle
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(groups.map(g => g.key))
  );

  const toggleGroup = (groupKey: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey);
    } else {
      newExpanded.add(groupKey);
    }
    setExpandedGroups(newExpanded);
  };

  const handleOptionChange = (groupKey: string, optionValue: string, type: 'checkbox' | 'radio') => {
    const currentFilters = filters[groupKey] || [];
    
    if (type === 'checkbox') {
      if (currentFilters.includes(optionValue)) {
        onFilterChange(groupKey, currentFilters.filter(v => v !== optionValue));
      } else {
        onFilterChange(groupKey, [...currentFilters, optionValue]);
      }
    } else {
      onFilterChange(groupKey, [optionValue]);
    }
  };

  const getActiveFiltersCount = () => {
    let total = 0;
    for (const key in filters) {
      total += filters[key].length;
    }
    return total;
  };

  const activeFiltersCount = getActiveFiltersCount();

  return (
    <div className={cn('space-y-4', className)}>
      {/* Filter Toggle Button */}
      {onToggle && (
        <Button
          variant="outline"
          onClick={onToggle}
          icon={<Filter className="h-4 w-4" />}
          iconPosition="left"
          className="relative"
        >
          Filters
          {activeFiltersCount > 0 && (
            <span className="absolute -top-2 -right-2 h-5 w-5 bg-indigo-600 text-white text-xs rounded-full flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </Button>
      )}

      {/* Filter Panel */}
      {isOpen && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Filters</h3>
            <div className="flex items-center space-x-2">
              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearAll}
                  icon={<X className="h-4 w-4" />}
                >
                  Clear All
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.key} className="border border-gray-200 rounded-lg">
                <button
                  onClick={() => toggleGroup(group.key)}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
                >
                  <span className="font-medium text-gray-900">{group.name}</span>
                  {expandedGroups.has(group.key) ? (
                    <ChevronUp className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  )}
                </button>

                {expandedGroups.has(group.key) && (
                  <div className="p-3 border-t border-gray-200 space-y-2">
                    {group.options.map((option) => {
                      const isChecked = filters[group.key]?.includes(option.value);
                      
                      return (
                        <label
                          key={option.value}
                          className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                        >
                          <input
                            type={group.type}
                            name={group.key}
                            value={option.value}
                            checked={isChecked}
                            onChange={() => handleOptionChange(group.key, option.value, group.type)}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm text-gray-700">{option.label}</span>
                          {option.count !== undefined && (
                            <span className="text-xs text-gray-400">({option.count})</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
