import { useState, useEffect, useMemo } from 'react';

/**
 * Debounce hook - delays value updates to reduce unnecessary operations
 * @param value The value to debounce
 * @param delay Delay in milliseconds (default: 500ms)
 */
export const useDebounce = <T,>(value: T, delay: number = 500): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Pagination hook - handles pagination logic for lists
 * @param items Array of items to paginate
 * @param pageSize Number of items per page (default: 20)
 */
export const usePagination = <T,>(
  items: T[],
  pageSize: number = 20
) => {
  const [currentPage, setCurrentPage] = useState(1);
  
  const totalPages = Math.ceil(items.length / pageSize);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  const hasNext = currentPage < totalPages;
  const hasPrev = currentPage > 1;

  const nextPage = () => {
    if (hasNext) setCurrentPage(prev => prev + 1);
  };

  const prevPage = () => {
    if (hasPrev) setCurrentPage(prev => prev - 1);
  };

  const goToPage = (page: number) => {
    const newPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(newPage);
  };

  const reset = () => {
    setCurrentPage(1);
  };

  return {
    currentPage,
    setCurrentPage,
    paginatedItems,
    totalPages,
    hasNext,
    hasPrev,
    nextPage,
    prevPage,
    goToPage,
    reset,
    startIndex: (currentPage - 1) * pageSize + 1,
    endIndex: Math.min(currentPage * pageSize, items.length),
    total: items.length,
  };
};

/**
 * Local storage hook - persists state to localStorage
 * @param key Storage key
 * @param initialValue Default value
 */
export const useLocalStorage = <T,>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      if (typeof window === 'undefined') {
        return initialValue;
      }
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  const removeValue = () => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
      setStoredValue(initialValue);
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue, removeValue] as const;
};