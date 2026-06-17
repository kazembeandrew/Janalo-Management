// Simple in-memory cache with TTL support and cross-tab invalidation
export class Cache<T = any> {
  private cache = new Map<string, { value: T; expiry: number }>();
  private broadcastChannel: BroadcastChannel | null = null;
  
  constructor(private name: string = 'default') {
    // Set up cross-tab communication for cache invalidation
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel(`cache-${name}`);
      this.broadcastChannel.onmessage = (event) => {
        const { type, key } = event.data;
        if (type === 'invalidate' && key) {
          this.cache.delete(key);
        } else if (type === 'clear') {
          this.cache.clear();
        }
      };
    }
  }
  
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
    const deleted = this.cache.delete(key);
    // Notify other tabs about the invalidation
    if (deleted && this.broadcastChannel) {
      this.broadcastChannel.postMessage({ type: 'invalidate', key });
    }
    return deleted;
  }
  
  clear(): void {
    this.cache.clear();
    // Notify other tabs about the clear
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({ type: 'clear' });
    }
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
  
  // Invalidate a specific key across all tabs
  invalidate(key: string): void {
    this.delete(key);
  }
  
  // Destroy the broadcast channel (cleanup)
  destroy(): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
  }
}

// Global cache instances with unique names for cross-tab sync
export const aiInsightsCache = new Cache<any>('ai-insights');
export const dashboardCache = new Cache<any>('dashboard');
export const apiCache = new Cache<any>('api');
export const loansCache = new Cache<any>('loans');
export const borrowersCache = new Cache<any>('borrowers');
export const accountsCache = new Cache<any>('accounts');

// Periodic cleanup
setInterval(() => {
  aiInsightsCache.cleanup();
  dashboardCache.cleanup();
  apiCache.cleanup();
  loansCache.cleanup();
  borrowersCache.cleanup();
  accountsCache.cleanup();
}, 60 * 1000); // Cleanup every minute

// React hook for caching with cross-tab invalidation support
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
