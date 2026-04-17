import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Filter, History, Clock } from 'lucide-react';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';

interface SearchBarProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onFocusChange?: (focused: boolean) => void;
  minChars?: number;
  searchEmpty?: boolean;
  onSearch?: (query: string) => void;
  onSubmit?: (query: string) => void;
  showFilterButton?: boolean;
  showHistory?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = "Search...",
  value,
  onChange,
  onFocusChange,
  minChars = 2,
  searchEmpty = false,
  onSearch,
  onSubmit,
  showFilterButton = false,
  showHistory = false
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    performSearch,
    searchResults,
    searchLoading,
    searchError,
    searchHistory,
    addToHistory,
    removeFromHistory,
    clearHistory
  } = useGlobalSearch();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (onFocusChange) {
      onFocusChange(isFocused);
    }
  }, [isFocused, onFocusChange]);

  useEffect(() => {
    if (isFocused && value.length >= minChars) {
      setShowDropdown(true);
      if (onSearch) {
        onSearch(value);
      } else {
        performSearch(value);
      }
    } else if (!searchEmpty && value.length < minChars) {
      setShowDropdown(false);
    }
  }, [value, isFocused, minChars, onSearch, performSearch, searchEmpty]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    // Trigger search if focused and meets min chars requirement
    if (isFocused && newValue.length >= minChars) {
      setShowDropdown(true);
      if (onSearch) {
        onSearch(newValue);
      } else {
        performSearch(newValue);
      }
    } else if (!searchEmpty && newValue.length < minChars) {
      setShowDropdown(false);
    }
  };

  const handleInputFocus = () => {
    setIsFocused(true);
    if (value.length >= minChars) {
      setShowDropdown(true);
    }
  };

  const handleInputBlur = () => {
    // Delay hiding dropdown to allow clicking on results
    setTimeout(() => {
      setIsFocused(false);
      setShowDropdown(false);
    }, 150);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      addToHistory(value.trim());
      if (onSubmit) {
        onSubmit(value.trim());
      }
    }
  };

  const handleHistorySelect = (query: string) => {
    onChange(query);
    inputRef.current?.focus();
    if (onSearch) {
      onSearch(query);
    } else {
      performSearch(query);
    }
  };

  const handleClearInput = () => {
    onChange('');
    inputRef.current?.focus();
    setShowDropdown(false);
  };

  const showResults = showDropdown && 
    ((searchResults as any)?.borrowers?.length > 0 || (searchResults as any)?.loans?.length > 0 || 
     searchHistory.length > 0 || searchLoading || searchError);

  return (
    <div className="relative" ref={dropdownRef}>
      <form onSubmit={handleSearchSubmit} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          {value && (
            <button
              type="button"
              onClick={handleClearInput}
              className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {showFilterButton && (
            <button
              type="button"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <Filter className="h-4 w-4" />
            </button>
          )}
        </div>

        {showResults && (
          <div
            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50 animate-in fade-in-0 zoom-in-95 duration-200"
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="p-2">
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center text-xs text-gray-500 font-medium">
                  <Search className="h-3 w-3 mr-1" />
                  Results
                </div>
                {searchLoading && (
                  <div className="text-xs text-gray-400">Searching…</div>
                )}
              </div>

              {!!searchError && (
                <div className="px-3 py-2 text-sm text-red-600">{searchError}</div>
              )}

              {!searchLoading &&
                !searchError &&
                (searchResults as any)?.borrowers?.length === 0 &&
                (searchResults as any)?.loans?.length === 0 &&
                searchHistory.length === 0 && (
                  <div className="px-3 py-2 text-sm text-gray-500">No matches.</div>
                )}

              {showHistory && searchHistory.length > 0 && (
                <>
                  <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
                    Recent Searches
                  </div>
                  {searchHistory.slice(0, 5).map((search, index) => (
                    <button
                      key={index}
                      className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors text-left"
                      onClick={() => handleHistorySelect(search)}
                      type="button"
                    >
                      <Clock className="h-3 w-3 mr-2 text-gray-400" />
                      <span className="truncate">{search}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromHistory(search);
                        }}
                        className="ml-auto text-gray-400 hover:text-gray-600"
                        title="Remove from history"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </button>
                  ))}
                  {searchHistory.length > 0 && (
                    <button
                      onClick={clearHistory}
                      className="w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left"
                    >
                      Clear History
                    </button>
                  )}
                </>
              )}

              {(searchResults as any)?.borrowers?.length > 0 && (
                <>
                  <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
                    Borrowers
                  </div>
                  {(searchResults as any).borrowers.map((borrower: any) => (
                    <button
                      key={borrower.id}
                      className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors text-left"
                      onClick={() => {
                        onChange(borrower.full_name);
                        if (onSubmit) {
                          onSubmit(borrower.full_name);
                        }
                      }}
                      type="button"
                    >
                      <Search className="h-3 w-3 mr-2 text-indigo-500" />
                      <span className="truncate">{borrower.full_name}</span>
                    </button>
                  ))}
                </>
              )}

              {(searchResults as any)?.loans?.length > 0 && (
                <>
                  <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
                    Loans
                  </div>
                  {(searchResults as any).loans.map((loan: any) => (
                    <button
                      key={loan.id}
                      className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors text-left"
                      onClick={() => {
                        onChange(loan.reference_no);
                        if (onSubmit) {
                          onSubmit(loan.reference_no);
                        }
                      }}
                      type="button"
                    >
                      <Search className="h-3 w-3 mr-2 text-emerald-600" />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{loan.reference_no}</div>
                        <div className="truncate text-xs text-gray-500">{loan.borrowers?.full_name || 'Unknown'}</div>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </form>
    </div>
  );
};