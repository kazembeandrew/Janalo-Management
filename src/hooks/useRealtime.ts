import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface RealtimeSubscription {
  table: string;
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  filter?: string;
  callback?: (payload: any) => void;
}

export interface RealtimeData<T = any> {
  data: T[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

/**
 * Fixed useRealtime hook that accepts a stable query key and separate fetch function
 * to avoid infinite re-renders caused by inline arrow functions in dependencies.
 */
export function useRealtime<T = any>(
  tableName: string,
  options: {
    event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
    filter?: string;
    enabled?: boolean;
    refetchInterval?: number;
    queryKey?: string; // Stable key to trigger refetches
    fetchFn?: () => Promise<T[]>; // Separate fetch function
  } = {}
): RealtimeData<T> & { refetch: () => void; subscribe: (callback: (payload: T) => void) => void } {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const channelRef = useRef<any>(null);
  const subscribersRef = useRef<Set<(payload: T) => void>>(new Set());
  const { event = '*', filter, enabled = true, refetchInterval, queryKey, fetchFn } = options;

  // fetchData no longer depends on initialQuery, only on fetchFn reference
  const fetchData = useCallback(async () => {
    if (!enabled || !fetchFn) return;
    
    try {
      setLoading(true);
      setError(null);
      const result = await fetchFn();
      setData(result);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [enabled, fetchFn]);

  const subscribe = useCallback((callback: (payload: T) => void) => {
    subscribersRef.current.add(callback);
    return () => {
      subscribersRef.current.delete(callback);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Initial data fetch
    fetchData();

    // Set up real-time subscription
    const channel = supabase
      .channel(`realtime-${tableName}`)
      .on('postgres_changes', 
        { 
          event, 
          schema: 'public', 
          table: tableName,
          filter: filter
        }, 
        (payload) => {
          // Notify all subscribers
          subscribersRef.current.forEach(callback => {
            callback(payload.new as T);
          });

          // Update local data based on event type
          switch (payload.eventType) {
            case 'INSERT':
              setData(prev => [...prev, payload.new as T]);
              break;
            case 'UPDATE':
              setData(prev => 
                prev.map(item => 
                  (item as any).id === payload.new.id ? payload.new as T : item
                )
              );
              break;
            case 'DELETE':
              setData(prev => 
                prev.filter(item => (item as any).id !== payload.old.id)
              );
              break;
          }
          setLastUpdated(new Date());
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Set up refetch interval if specified
    let intervalId: NodeJS.Timeout;
    if (refetchInterval && refetchInterval > 0) {
      intervalId = setInterval(fetchData, refetchInterval);
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [enabled, tableName, event, filter, fetchData, refetchInterval]); // Removed initialQuery from deps

  return {
    data,
    loading,
    error,
    lastUpdated,
    refetch: fetchData,
    subscribe
  };
}

export function useRealtimeMetrics(
  metricsQuery: () => Promise<any>,
  options: {
    interval?: number;
    enabled?: boolean;
  } = {}
) {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { interval = 30000, enabled = true } = options;

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await metricsQuery();
      setMetrics(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!enabled) return;

    fetchMetrics();
    const intervalId = setInterval(fetchMetrics, interval);

    return () => clearInterval(intervalId);
  }, [enabled, interval, metricsQuery]);

  return { metrics, loading, error, refetch: fetchMetrics };
}

// Hook for real-time notifications
export function useRealtimeNotifications(userId: string) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        }, 
        (payload) => {
          const newNotification = payload.new;
          setNotifications(prev => [newNotification, ...prev]);
          if (!newNotification.read) {
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          setNotifications(prev =>
            prev.map(notification =>
              notification.id === payload.new.id ? payload.new : notification
            )
          );
          if (payload.new.read && !payload.old.read) {
            setUnreadCount(prev => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);
  };

  const markAllAsRead = async () => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead
  };
}
