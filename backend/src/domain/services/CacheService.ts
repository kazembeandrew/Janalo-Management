// Domain Layer - Services
// Cache management service for performance optimization

import { RedisCache } from '../../infrastructure/cache/RedisCache';
import { Money } from '../value-objects/Money';

export interface CacheKeyStrategy {
  accountBalance: (accountId: string, fiscalPeriod?: string) => string;
  userPermissions: (userId: string) => string;
  trialBalance: (asOfDate: string) => string;
  report: (reportType: string, parameters: Record<string, any>) => string;
}

export class CacheService {
  constructor(
    private readonly cache: RedisCache,
    private readonly keyStrategy: CacheKeyStrategy
  ) {}

  // Account balance caching
  async getCachedAccountBalance(accountId: string, fiscalPeriod?: string): Promise<Money | null> {
    return await this.cache.getAccountBalance(accountId, fiscalPeriod);
  }

  async setCachedAccountBalance(accountId: string, balance: Money, fiscalPeriod?: string): Promise<void> {
    await this.cache.setAccountBalance(accountId, balance, fiscalPeriod);
  }

  async invalidateAccountBalance(accountId: string): Promise<void> {
    await this.cache.invalidateAccountBalance(accountId);
  }

  // User permissions caching
  async getCachedUserPermissions(userId: string): Promise<string[] | null> {
    return await this.cache.getUserPermissions(userId);
  }

  async setCachedUserPermissions(userId: string, permissions: string[]): Promise<void> {
    await this.cache.setUserPermissions(userId, permissions);
  }

  async invalidateUserPermissions(userId: string): Promise<void> {
    await this.cache.invalidateUserPermissions(userId);
  }

  // Trial balance caching
  async getCachedTrialBalance(asOfDate: string): Promise<any | null> {
    return await this.cache.getTrialBalance(asOfDate);
  }

  async setCachedTrialBalance(asOfDate: string, data: any): Promise<void> {
    await this.cache.setTrialBalance(asOfDate, data);
  }

  async invalidateTrialBalance(): Promise<void> {
    await this.cache.invalidateTrialBalance();
  }

  // Report caching
  async getCachedReport(reportType: string, parameters: Record<string, any>): Promise<any | null> {
    return await this.cache.getReport(reportType, parameters);
  }

  async setCachedReport(reportType: string, parameters: Record<string, any>, data: any): Promise<void> {
    await this.cache.setReport(reportType, parameters, data);
  }

  async invalidateReports(): Promise<void> {
    await this.cache.invalidateReports();
  }

  // Cache warming utilities
  async warmFrequentlyAccessedData(): Promise<void> {
    try {
      // This would be called periodically to warm cache with frequently accessed data
      console.log('🔄 Warming frequently accessed cache data');

      // Example: Warm system account balances
      // await this.warmSystemAccountBalances();

      // Example: Warm common user permissions
      // await this.warmCommonUserPermissions();

    } catch (error) {
      console.error('Cache warming error:', error);
    }
  }

  // Cache invalidation strategies
  async invalidateJournalEntryRelated(accountIds: string[]): Promise<void> {
    // When a journal entry is posted, invalidate related account balances
    for (const accountId of accountIds) {
      await this.invalidateAccountBalance(accountId);
    }

    // Also invalidate trial balance
    await this.invalidateTrialBalance();
  }

  async invalidateUserRelated(userId: string): Promise<void> {
    // When user permissions change, invalidate their cache
    await this.invalidateUserPermissions(userId);
  }

  async invalidateSystemWide(): Promise<void> {
    // Clear all caches - use sparingly
    await this.invalidateTrialBalance();
    await this.invalidateReports();
  }

  // Cache statistics and monitoring
  async getCacheStats(): Promise<{
    health: boolean;
    hitRate?: number;
    memoryUsage?: any;
    keys: number;
  }> {
    const stats = await this.cache.getStats();

    return {
      health: stats.connected,
      memoryUsage: stats.memory,
      keys: stats.keys
    };
  }

  // Cache configuration
  async configureCache(config: {
    enableCompression?: boolean;
    maxMemory?: string;
    evictionPolicy?: string;
  }): Promise<void> {
    // Implementation would configure Redis settings
    console.log('Cache configuration updated:', config);
  }

  // Background cache maintenance
  async performMaintenance(): Promise<void> {
    try {
      // Clean up expired keys
      // Optimize memory usage
      // Warm frequently accessed data
      console.log('🧹 Performing cache maintenance');

      await this.warmFrequentlyAccessedData();

    } catch (error) {
      console.error('Cache maintenance error:', error);
    }
  }

  // Cache warming strategies
  private async warmSystemAccountBalances(): Promise<void> {
    // Implementation would identify and cache frequently accessed account balances
    // This would be called during system startup or periodically
  }

  private async warmCommonUserPermissions(): Promise<void> {
    // Implementation would cache permissions for frequently active users
    // This would help with dashboard performance
  }
}

// Default cache key strategy
export const defaultCacheKeyStrategy: CacheKeyStrategy = {
  accountBalance: (accountId: string, fiscalPeriod?: string) =>
    fiscalPeriod ? `account:balance:${accountId}:${fiscalPeriod}` : `account:balance:${accountId}:current`,

  userPermissions: (userId: string) => `user:permissions:${userId}`,

  trialBalance: (asOfDate: string) => `trial_balance:${asOfDate}`,

  report: (reportType: string, parameters: Record<string, any>) => {
    const paramString = Object.entries(parameters)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    return `report:${reportType}:${paramString}`;
  }
};
