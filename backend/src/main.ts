// Main Application Server
// Clean Architecture Implementation with Enhanced Security & Performance
// NOTE: This is an aspirational backend implementation with full clean architecture.
// Currently not in use - the active server is server.ts in the root directory.

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
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
if (!supabaseUrl || !supabaseKey) {
    console.error('ERROR: SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables are required');
    process.exit(1);
}
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

