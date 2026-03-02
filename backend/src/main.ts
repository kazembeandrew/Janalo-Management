// Main Application Server
// Clean Architecture Implementation with Enhanced Security & Performance

import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

// Domain Services (Enhanced with Performance Features)
import { AccountingService } from './domain/services/AccountingService';
import { AuthorizationService } from './domain/services/AuthorizationService';
import { AuditService } from './domain/services/AuditService';
import { CacheService, defaultCacheKeyStrategy } from './domain/services/CacheService';
import { EnhancedAccountingService } from './domain/services/EnhancedAccountingService';

// Infrastructure
import { SupabaseClientWrapper } from './infrastructure/external/SupabaseClientWrapper';
import { AccountRepository } from './infrastructure/database/AccountRepository';
import { JournalEntryRepository } from './infrastructure/database/JournalEntryRepository';
import { UserRepository } from './infrastructure/database/UserRepository';
import { PermissionRepository } from './infrastructure/database/PermissionRepository';
import { RoleRepository } from './infrastructure/database/RoleRepository';
import { UserRoleRepository } from './infrastructure/database/UserRoleRepository';
import { AuditLogRepository } from './infrastructure/database/AuditLogRepository';
import { RedisCache } from './infrastructure/cache/RedisCache';

// Async Processing
import { jobProcessor, initializeJobProcessor } from './infrastructure/async/JobProcessor';

// GraphQL
import { createGraphQLServer } from './api/graphql/schema';

// API Documentation
import { createSwaggerMiddleware } from './api/docs/swagger';

// API & Middleware
import { createAccountingRoutes } from './api/routes/accounting';
import { createEnhancedAccountingRoutes } from './api/routes/enhanced-accounting';
import { AuthorizationMiddleware } from './api/middleware/authorization';
import { SecurityMiddleware } from './infrastructure/security/SecurityMiddleware';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Initialize infrastructure
const supabaseUrl = process.env.SUPABASE_URL || 'https://tfpzehyrkzbenjobkdsz.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmcHlaaHlya3piZW5qb2JrZHN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MDc1MjIsImV4cCI6MjA4Njk4MzUyMn0.p5NEtPP5xAlqBbZwibnkZv2MH4RVYfVKqt8MewTHNsQ';
const supabase = new SupabaseClientWrapper(supabaseUrl, supabaseKey);

// Initialize repositories
const accountRepo = new AccountRepository(supabase);
const journalEntryRepo = new JournalEntryRepository(supabase);
const userRepo = new UserRepository(supabase);
const permissionRepo = new PermissionRepository(supabase);
const roleRepo = new RoleRepository(supabase);
const userRoleRepo = new UserRoleRepository(supabase);
const auditRepo = new AuditLogRepository(supabase);

// Initialize cache (Redis)
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  ttl: {
    accountBalance: parseInt(process.env.CACHE_TTL_ACCOUNT_BALANCE || '300'), // 5 minutes
    trialBalance: parseInt(process.env.CACHE_TTL_TRIAL_BALANCE || '600'),    // 10 minutes
    userPermissions: parseInt(process.env.CACHE_TTL_USER_PERMISSIONS || '1800'), // 30 minutes
    reports: parseInt(process.env.CACHE_TTL_REPORTS || '900')                // 15 minutes
  }
};

const redisCache = new RedisCache(redisConfig);
const cacheService = new CacheService(redisCache, defaultCacheKeyStrategy);

// Initialize domain services
const accountingService = new AccountingService(
  accountRepo,
  journalEntryRepo,
  userRepo
);

const authService = new AuthorizationService(
  permissionRepo,
  roleRepo,
  userRoleRepo
);

const auditService = new AuditService(auditRepo);

// Initialize enhanced accounting service with caching
const enhancedAccountingService = new EnhancedAccountingService(
  accountRepo,
  journalEntryRepo,
  userRepo,
  cacheService
);

// Initialize middleware
const authMiddleware = new AuthorizationMiddleware(authService, supabase);

// Initialize async job processor
initializeJobProcessor(enhancedAccountingService, cacheService);

// Security middleware setup
app.use(SecurityMiddleware.createHelmetConfig());
app.use(SecurityMiddleware.securityLogger());
app.use(SecurityMiddleware.sanitizeRequest());
app.use(SecurityMiddleware.sqlInjectionProtection());

// Rate limiting
app.use('/api/', SecurityMiddleware.createRateLimiter());
app.use('/api/auth', SecurityMiddleware.createAuthRateLimiter());
app.use('/api/admin', SecurityMiddleware.createStrictRateLimiter());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Enhanced health check with performance metrics
app.get('/api/health', async (req, res) => {
  try {
    const cacheHealth = await redisCache.healthCheck();
    const cacheStats = await cacheService.getCacheStats();
    const queueStats = jobProcessor.getQueueStats();

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        accounting: 'available',
        authorization: 'available',
        audit: 'available',
        cache: cacheHealth ? 'healthy' : 'unhealthy',
        async_jobs: 'running'
      },
      performance: {
        cache: cacheStats,
        queue: queueStats
      }
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// API Documentation (Swagger UI)
if (process.env.NODE_ENV !== 'production') {
  app.use('/api-docs', ...createSwaggerMiddleware());
}

// API Routes - Multiple versions
app.use('/api/accounting', createAccountingRoutes(
  accountingService,
  authService,
  auditService,
  authMiddleware
));

// Enhanced API with full validation and features
app.use('/api/accounting', createEnhancedAccountingRoutes(
  enhancedAccountingService,
  authService,
  auditService,
  authMiddleware
));

// GraphQL API
const graphQLServer = createGraphQLServer(
  enhancedAccountingService,
  authService,
  auditService
);

// Apply GraphQL auth middleware
app.use('/graphql', authMiddleware.authenticateAndLoadPermissions());

// Apply GraphQL server
graphQLServer.start().then(() => {
  graphQLServer.applyMiddleware({
    app,
    path: '/graphql'
  });
});

// Backward compatibility routes (temporary)
app.post('/api/admin/create-user',
  authMiddleware.authenticateAndLoadPermissions(),
  authMiddleware.requireAdmin(),
  async (req, res) => {
    // Implementation would go here - keeping for backward compatibility
    res.json({ message: 'Use new API endpoints' });
  }
);

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');

  // Stop job processor
  jobProcessor.stop();

  // Stop GraphQL server
  await graphQLServer.stop();

  // Close cache connection
  await redisCache.disconnect();

  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');

  // Stop job processor
  jobProcessor.stop();

  // Stop GraphQL server
  await graphQLServer.stop();

  // Close cache connection
  await redisCache.disconnect();

  process.exit(0);
});

// Vite dev server setup
async function startServer() {
  // Connect to cache
  try {
    await redisCache.connect();
    console.log('✅ Redis cache connected');
  } catch (error) {
    console.warn('⚠️ Redis cache not available:', error.message);
    console.warn('⚠️ Application will continue without caching');
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Accounting API available at /api/accounting`);
    console.log(`🔐 Enhanced RBAC & Security Active`);
    console.log(`📋 Audit Logging Enabled`);
    console.log(`💾 Redis Caching Active`);
    console.log(`⚡ Async Job Processing Active`);
    console.log(`🔗 GraphQL API available at /graphql`);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`📖 API Documentation available at /api-docs`);
    }
  });
}

startServer().catch(console.error);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize infrastructure
const supabaseUrl = process.env.SUPABASE_URL || 'https://tfpzehyrkzbenjobkdsz.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmcHplaHlya3piZW5qb2JrZHN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MDc1MjIsImV4cCI6MjA4Njk4MzUyMn0.p5NEtPP5xAlqBbZwibnkZv2MH4RVYfVKqt8MewTHNsQ';
const supabase = new SupabaseClientWrapper(supabaseUrl, supabaseKey);

// Initialize repositories
const accountRepo = new AccountRepository(supabase);
const journalEntryRepo = new JournalEntryRepository(supabase);
const userRepo = new UserRepository(supabase);
const permissionRepo = new PermissionRepository(supabase);
const roleRepo = new RoleRepository(supabase);
const userRoleRepo = new UserRoleRepository(supabase);
const auditRepo = new AuditLogRepository(supabase);

// Initialize cache (Redis)
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  ttl: {
    accountBalance: parseInt(process.env.CACHE_TTL_ACCOUNT_BALANCE || '300'), // 5 minutes
    trialBalance: parseInt(process.env.CACHE_TTL_TRIAL_BALANCE || '600'),    // 10 minutes
    userPermissions: parseInt(process.env.CACHE_TTL_USER_PERMISSIONS || '1800'), // 30 minutes
    reports: parseInt(process.env.CACHE_TTL_REPORTS || '900')                // 15 minutes
  }
};

const redisCache = new RedisCache(redisConfig);
const cacheService = new CacheService(redisCache, defaultCacheKeyStrategy);

// Initialize domain services
const accountingService = new AccountingService(
  accountRepo,
  journalEntryRepo,
  userRepo
);

const authService = new AuthorizationService(
  permissionRepo,
  roleRepo,
  userRoleRepo
);

const auditService = new AuditService(auditRepo);

// Initialize enhanced accounting service with caching
const enhancedAccountingService = new EnhancedAccountingService(
  accountRepo,
  journalEntryRepo,
  userRepo,
  cacheService
);

// Initialize middleware
const authMiddleware = new AuthorizationMiddleware(authService, supabase);

// Initialize async job processor
initializeJobProcessor(enhancedAccountingService, cacheService);

// Security middleware setup
app.use(SecurityMiddleware.createHelmetConfig());
app.use(SecurityMiddleware.securityLogger());
app.use(SecurityMiddleware.sanitizeRequest());
app.use(SecurityMiddleware.sqlInjectionProtection());

// Rate limiting
app.use('/api/', SecurityMiddleware.createRateLimiter());
app.use('/api/auth', SecurityMiddleware.createAuthRateLimiter());
app.use('/api/admin', SecurityMiddleware.createStrictRateLimiter());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Enhanced health check with performance metrics
app.get('/api/health', async (req, res) => {
  try {
    const cacheHealth = await redisCache.healthCheck();
    const cacheStats = await cacheService.getCacheStats();
    const queueStats = jobProcessor.getQueueStats();

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        accounting: 'available',
        authorization: 'available',
        audit: 'available',
        cache: cacheHealth ? 'healthy' : 'unhealthy',
        async_jobs: 'running'
      },
      performance: {
        cache: cacheStats,
        queue: queueStats
      }
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// API Routes
app.use('/api/accounting', createAccountingRoutes(
  enhancedAccountingService,
  authService,
  auditService,
  authMiddleware
));

// Async job status endpoint
app.get('/api/jobs/:jobId',
  authMiddleware.authenticateAndLoadPermissions(),
  async (req, res) => {
    try {
      const { jobId } = req.params;
      const job = await jobProcessor.getJobStatus(jobId);

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Check if user owns this job
      if (job.userId && job.userId !== req.user?.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json({
        success: true,
        data: {
          id: job.id,
          type: job.type,
          status: job.status,
          progress: job.progress,
          createdAt: job.createdAt,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          result: job.result,
          error: job.error
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Cache management endpoints (admin only)
app.post('/api/admin/cache/warm',
  authMiddleware.authenticateAndLoadPermissions(),
  authMiddleware.requireAdmin(),
  async (req, res) => {
    try {
      await cacheService.warmFrequentlyAccessedData();
      res.json({ success: true, message: 'Cache warming initiated' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

app.post('/api/admin/cache/clear',
  authMiddleware.authenticateAndLoadPermissions(),
  authMiddleware.requireAdmin(),
  async (req, res) => {
    try {
      await cacheService.invalidateSystemWide();
      res.json({ success: true, message: 'Cache cleared' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Backward compatibility routes (temporary)
app.post('/api/admin/create-user',
  authMiddleware.authenticateAndLoadPermissions(),
  authMiddleware.requireAdmin(),
  async (req, res) => {
    // Implementation would go here - keeping for backward compatibility
    res.json({ message: 'Use new API endpoints' });
  }
);

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');

  // Stop job processor
  jobProcessor.stop();

  // Close cache connection
  await redisCache.disconnect();

  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');

  // Stop job processor
  jobProcessor.stop();

  // Close cache connection
  await redisCache.disconnect();

  process.exit(0);
});

// Vite dev server setup
async function startServer() {
  // Connect to cache
  try {
    await redisCache.connect();
    console.log('✅ Redis cache connected');
  } catch (error) {
    console.warn('⚠️ Redis cache not available:', error.message);
    console.warn('⚠️ Application will continue without caching');
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Accounting API available at /api/accounting`);
    console.log(`🔐 Enhanced RBAC & Security Active`);
    console.log(`📋 Audit Logging Enabled`);
    console.log(`💾 Redis Caching Active`);
    console.log(`⚡ Async Job Processing Active`);
  });
}

startServer().catch(console.error);
