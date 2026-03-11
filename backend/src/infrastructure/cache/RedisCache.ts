// Infrastructure Layer - Cache
// Redis cache implementation for performance optimization

import Redis from 'ioredis';
import { Account } from '../../domain/entities/Account';
import { Money } from '../../domain/value-objects/Money';

export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  ttl: {
    accountBalance: number;     // 5 minutes
    trialBalance: number;       // 10 minutes
    userPermissions: number;    // 30 minutes
    reports: number;            // 15 minutes
  };
}

export class RedisCache {
  private client: Redis;
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = config;
    this.client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db || 0,
      enableReadyCheck: false,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      console.log('✅ Redis cache connected');
    });

    this.client.on('error', (error) => {
      console.error('❌ Redis cache error:', error.message);
    });

    this.client.on('ready', () => {
      console.log('✅ Redis cache ready');
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  // Generic cache operations
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      console.error('Cache delete pattern error:', error);
    }
  }

  // Account-specific cache operations
  async getAccountBalance(accountId: string, fiscalPeriod?: string): Promise<Money | null> {
    const key = this.buildAccountBalanceKey(accountId, fiscalPeriod);
    const cached = await this.get<{ amount: number; currency: string }>(key);
    return cached ? new Money(cached.amount, cached.currency) : null;
  }

  async setAccountBalance(accountId: string, balance: Money, fiscalPeriod?: string): Promise<void> {
    const key = this.buildAccountBalanceKey(accountId, fiscalPeriod);
    await this.set(key, balance.toJSON(), this.config.ttl.accountBalance);
  }

  async invalidateAccountBalance(accountId: string): Promise<void> {
    const pattern = `account:balance:${accountId}:*`;
    await this.deletePattern(pattern);
  }

  // User permissions cache
  async getUserPermissions(userId: string): Promise<string[] | null> {
    const key = `user:permissions:${userId}`;
    return await this.get<string[]>(key);
  }

  async setUserPermissions(userId: string, permissions: string[]): Promise<void> {
    const key = `user:permissions:${userId}`;
    await this.set(key, permissions, this.config.ttl.userPermissions);
  }

  async invalidateUserPermissions(userId: string): Promise<void> {
    const key = `user:permissions:${userId}`;
    await this.delete(key);
  }

  // Trial balance cache
  async getTrialBalance(asOfDate: string): Promise<any | null> {
    const key = `trial_balance:${asOfDate}`;
    return await this.get(key);
  }

  async setTrialBalance(asOfDate: string, data: any): Promise<void> {
    const key = `trial_balance:${asOfDate}`;
    await this.set(key, data, this.config.ttl.trialBalance);
  }

  async invalidateTrialBalance(): Promise<void> {
    const pattern = 'trial_balance:*';
    await this.deletePattern(pattern);
  }

  // Report cache
  async getReport(reportType: string, parameters: Record<string, any>): Promise<any | null> {
    const key = this.buildReportKey(reportType, parameters);
    return await this.get(key);
  }

  async setReport(reportType: string, parameters: Record<string, any>, data: any): Promise<void> {
    const key = this.buildReportKey(reportType, parameters);
    await this.set(key, data, this.config.ttl.reports);
  }

  async invalidateReports(): Promise<void> {
    const pattern = 'report:*';
    await this.deletePattern(pattern);
  }

  // Cache statistics
  async getStats(): Promise<{
    connected: boolean;
    db: number;
    keys: number;
    memory: any;
  }> {
    try {
      const info = await this.client.info();
      const db = parseInt(this.config.db?.toString() || '0');

      return {
        connected: this.client.status === 'ready',
        db,
        keys: await this.client.dbsize(),
        memory: this.parseMemoryInfo(info)
      };
    } catch (error) {
      return {
        connected: false,
        db: 0,
        keys: 0,
        memory: null
      };
    }
  }

  private parseMemoryInfo(info: string): any {
    const lines = info.split('\n');
    const memory: any = {};

    lines.forEach(line => {
      if (line.startsWith('used_memory:')) {
        memory.used = parseInt(line.split(':')[1]);
      }
      if (line.startsWith('used_memory_human:')) {
        memory.usedHuman = line.split(':')[1].trim();
      }
      if (line.startsWith('maxmemory:')) {
        memory.max = parseInt(line.split(':')[1]);
      }
    });

    return memory;
  }

  private buildAccountBalanceKey(accountId: string, fiscalPeriod?: string): string {
    return fiscalPeriod
      ? `account:balance:${accountId}:${fiscalPeriod}`
      : `account:balance:${accountId}:current`;
  }

  private buildReportKey(reportType: string, parameters: Record<string, any>): string {
    const paramString = Object.entries(parameters)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    return `report:${reportType}:${paramString}`;
  }

  // Cache warming utilities
  async warmAccountBalances(accountIds: string[]): Promise<void> {
    // Implementation would warm cache with frequently accessed balances
    console.log(`Warming cache for ${accountIds.length} accounts`);
  }

  async warmUserPermissions(userIds: string[]): Promise<void> {
    // Implementation would warm cache with frequently accessed permissions
    console.log(`Warming cache for ${userIds.length} users`);
  }
}
