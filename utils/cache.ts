// Simple in-memory cache with TTL support
export class Cache<T = any> {
  private cache = new Map<string, { value: T; expiry: number }>();
  
  set(key: string, value: T, ttlMs: number = 5 * 60 * 1000): void {
    const expiry = Date.now() + ttlMs;
    this.cache.set(key, { value, expiry });
  }
  
  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }
  
  has(key: string): boolean {
    return this.get(key) !== null;
  }
  
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

// Global cache instances
export const aiInsightsCache = new Cache<any>();
export const dashboardCache = new Cache<any>();
export const apiCache = new Cache<any>();

// Periodic cleanup
setInterval(() => {
  aiInsightsCache.cleanup();
  dashboardCache.cleanup();
  apiCache.cleanup();
}, 60 * 1000); // Cleanup every minute

// React hook for caching
import { useState, useEffect, useCallback } from 'react';

export function useCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = 5 * 60 * 1000,
  cache: Cache<T> = apiCache
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    // Try cache first
    const cached = cache.get(key);
    if (cached) {
      setData(cached);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetcher();
      cache.set(key, result, ttlMs);
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [key, fetcher, ttlMs, cache]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const invalidate = useCallback(() => {
    cache.delete(key);
    fetchData();
  }, [key, cache, fetchData]);

  return { data, loading, error, refetch: fetchData, invalidate };
}
