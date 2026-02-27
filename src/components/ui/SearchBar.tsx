import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Clock, Filter } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  onFilter?: () => void;
  showFilterButton?: boolean;
  showHistory?: boolean;
  className?: string;
  debounceMs?: number;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Search...',
  onSearch,
  onFilter,
  showFilterButton = false,
  showHistory = true,
  className,
  debounceMs = 300
}) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  // Load search history from localStorage
  useEffect(() => {
    const history = localStorage.getItem('searchHistory');
    if (history) {
      setSearchHistory(JSON.parse(history).slice(0, 5)); // Keep only last 5 searches
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        onSearch(query);
        addToHistory(query);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs, onSearch]);

  // Close history dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistoryDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut (Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const addToHistory = (searchQuery: string) => {
    const newHistory = [searchQuery, ...searchHistory.filter(h => h !== searchQuery)].slice(0, 5);
    setSearchHistory(newHistory);
    localStorage.setItem('searchHistory', JSON.stringify(newHistory));
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('searchHistory');
  };

  const handleHistoryItemClick = (item: string) => {
    setQuery(item);
    onSearch(item);
    setShowHistoryDropdown(false);
  };

  return (
    <div className={cn('relative', className)} ref={historyRef}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        
        <input
          ref={inputRef}
          type="text"
          className={cn(
            'block w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm',
            'focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all',
            'placeholder-gray-400'
          )}
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            setTimeout(() => setShowHistoryDropdown(false), 200);
          }}
        />
        
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            title="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        
        {showFilterButton && (
          <button
            onClick={onFilter}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-indigo-600"
            title="Advanced filters"
          >
            <Filter className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search History Dropdown */}
      {showHistoryDropdown && isFocused && searchHistory.length > 0 && showHistory && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50">
          <div className="p-2">
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center text-xs text-gray-500 font-medium">
                <Clock className="h-3 w-3 mr-1" />
                Recent Searches
              </div>
              <button
                onClick={clearHistory}
                className="text-xs text-gray-400 hover:text-red-600 font-medium"
              >
                Clear
              </button>
            </div>
            {searchHistory.map((item, index) => (
              <button
                key={index}
                onClick={() => handleHistoryItemClick(item)}
                className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors text-left"
                title={`Search: ${item}`}
              >
                <Clock className="h-3 w-3 mr-2 text-gray-400" />
                {item}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Keyboard Shortcut Hint */}
      {!isFocused && (
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-xs font-medium text-gray-400 bg-gray-100 rounded">
            Ctrl+K
          </kbd>
        </div>
      )}
    </div>
  );
};
