import { 
  BaseService, 
  ServiceError, 
  ServiceResult, 
  ServiceConfig, 
  ServiceContext, 
  ServiceEvent, 
  ServiceEventHandler, 
  ServiceSubscription,
  ServiceHealth,
  ServiceMetrics,
  ServiceLifecycleEvent,
  ServiceLifecycleHandler,
  ServicePlugin,
  ServiceMiddleware,
  ServiceValidator,
  ServiceTransformer,
  ServiceCache,
  ServiceLogger,
  ServiceMetricsCollector,
  ServiceHealthChecker,
  ServiceConfigValidator,
  ServiceFactory,
  ServiceRegistry,
  ServiceDependency,
  ServiceDependencyResolver,
  ServiceEventEmitter,
  ServiceLifecycleManager,
  ServicePluginManager,
  ServiceMiddlewareManager,
  ServiceContextManager,
  ServiceValidatorManager,
  ServiceTransformerManager,
  ServiceCacheManager,
  ServiceLoggerManager,
  ServiceMetricsManager,
  ServiceHealthManager,
  ServiceConfigManager,
  ServiceFactoryManager,
  ServiceDependencyManager,
  ServiceEventManager,
  ServiceFactoryRegistry
} from './types';
import { 
  mapError, 
  createSuccessResult, 
  createErrorResult, 
  handleAsyncOperation,
  generateId,
  formatDateTime
} from './utils';

/**
 * Base service class that provides common functionality for all services
 */
export abstract class BaseServiceClass implements BaseService {
  protected config: ServiceConfig;
  protected isServiceReady: boolean = false;
  protected profile: any = null;
  protected context: ServiceContext | null = null;
  protected eventEmitter: ServiceEventEmitter;
  protected lifecycleManager: ServiceLifecycleManager;
  protected pluginManager: ServicePluginManager;
  protected middlewareManager: ServiceMiddlewareManager;
  protected contextManager: ServiceContextManager;
  protected validatorManager: ServiceValidatorManager;
  protected transformerManager: ServiceTransformerManager;
  protected cacheManager: ServiceCacheManager;
  protected loggerManager: ServiceLoggerManager;
  protected metricsManager: ServiceMetricsManager;
  protected healthManager: ServiceHealthManager;
  protected configManager: ServiceConfigManager;
  protected factoryManager: ServiceFactoryManager;
  protected dependencyManager: ServiceDependencyManager;
  protected eventManager: ServiceEventManager;
  protected lifecycleHandlers: ServiceLifecycleHandler[] = [];
  protected plugins: ServicePlugin[] = [];
  protected middleware: ServiceMiddleware[] = [];
  public metrics: ServiceMetrics = {
    requests: 0,
    errors: 0,
    averageResponseTime: 0,
    lastError: undefined,
    uptime: Date.now()
  };
  protected health: ServiceHealth = {
    status: 'healthy',
    message: 'Service is healthy',
    timestamp: formatDateTime(new Date()),
    details: {}
  };

  constructor(config: ServiceConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl || '',
      timeout: config.timeout || 30000,
      retry: config.retry || { attempts: 3, delay: 1000, backoff: 2 },
      cache: config.cache || { enabled: true, ttl: 600000 }, // 10 minutes default
      ...config
    };

    this.initializeManagers();
    this.initializeEventHandlers();
    this.initializeLifecycleHandlers();
  }

  // Manager interface implementations
  getManager(): BaseServiceClass {
    return this;
  }

  setManager(manager: any): void {
    // In a real implementation, this would set the manager
    // For now, we'll just return
    return;
  }

  // Health manager method
  public async checkHealth(): Promise<ServiceHealth> {
    return Promise.resolve(this.health);
  }

  /**
   * Initialize all service managers
   */
  private initializeManagers(): void {
    // Initialize event emitter with its own internal handlers map (avoids infinite recursion)
    const _handlers = new Map<ServiceEvent, ServiceEventHandler[]>();
    this.eventEmitter = {
      emit: (event: ServiceEvent, data: any) => {
        const handlers = _handlers.get(event) || [];
        handlers.forEach(h => { try { h(event, data); } catch (e) { console.error('Event handler error:', e); } });
      },
      on: (event: ServiceEvent, handler: ServiceEventHandler): ServiceSubscription => {
        if (!_handlers.has(event)) _handlers.set(event, []);
        _handlers.get(event)!.push(handler);
        return { unsubscribe: () => { const list = _handlers.get(event) || []; _handlers.set(event, list.filter(h => h !== handler)); } };
      },
      off: (event: ServiceEvent, handler: ServiceEventHandler) => {
        const list = _handlers.get(event) || [];
        _handlers.set(event, list.filter(h => h !== handler));
      },
      getHandlers: (event: ServiceEvent) => {
        return _handlers.get(event) || [];
      }
    };

    // Initialize lifecycle manager
    this.lifecycleManager = {
      initialize: async (service: BaseService) => {
        await this.initialize(service);
      },
      start: async (service: BaseService) => {
        await this.start(service);
      },
      stop: async (service: BaseService) => {
        await this.stop(service);
      },
      destroy: async (service: BaseService) => {
        await this.destroy(service);
      },
      getStatus: (service: BaseService) => {
        return this.getStatus(service);
      },
      getManager: () => this,
      setManager: (manager: any) => {
        // In a real implementation, this would set the manager
        // For now, we'll just return
        return;
      }
    };

    // Initialize plugin manager
    this.pluginManager = {
      install: (plugin: ServicePlugin) => {
        this.install(plugin);
      },
      uninstall: (pluginName: string) => {
        this.uninstall(pluginName);
      },
      getPlugins: () => {
        return this.getPlugins();
      },
      isInstalled: (pluginName: string) => {
        return this.isInstalled(pluginName);
      },
      getManager: () => this,
      setManager: (manager: any) => {
        // In a real implementation, this would set the manager
        // For now, we'll just return
        return;
      }
    };

    // Initialize middleware manager
    this.middlewareManager = {
      add: (middleware: ServiceMiddleware) => {
        this.add(middleware);
      },
      remove: (middlewareName: string) => {
        this.remove(middlewareName);
      },
      getMiddleware: () => {
        return this.getMiddleware();
      },
      execute: async (context: any, next: () => Promise<any>) => {
        return await this.execute(context, next);
      },
      getManager: () => this,
      setManager: (manager: any) => {
        // In a real implementation, this would set the manager
        // For now, we'll just return
        return;
      }
    };

    // Initialize context manager
    this.contextManager = {
      create: (userId?: string, metadata?: Record<string, any>) => {
        return this.create(userId, metadata);
      },
      getCurrent: () => {
        return this.getCurrent();
      },
      setCurrent: (context: ServiceContext) => {
        this.setCurrent(context);
      },
      clear: () => {
        this.clear();
      },
      getManager: () => this,
      setManager: (manager: any) => {
        // In a real implementation, this would set the manager
        // For now, we'll just return
        return;
      }
    };

    // Initialize validator manager
    this.validatorManager = {
      add: (validator: ServiceValidator<any>) => {
        // Implementation would depend on validator manager
      },
      remove: (validatorName: string) => {
        this.removeValidator(validatorName);
      },
      validate: <T>(data: T, validatorName: string) => {
        return this.validate(data, validatorName);
      },
      getManager: () => this as unknown as ServiceValidatorManager,
      setManager: (manager: ServiceValidatorManager) => {
        // In a real implementation, this would set the manager
        // For now, we'll just return
        return;
      }
    };

    // Initialize transformer manager
    this.transformerManager = {
      add: <T, U>(transformer: ServiceTransformer<T, U>) => {
        // Implementation would depend on transformer manager
      },
      remove: (transformerName: string) => {
        this.removeTransformer(transformerName);
      },
      transform: <T, U>(data: T, transformerName: string) => {
        return this.transform(data, transformerName);
      },
      getManager: () => this as unknown as ServiceTransformerManager,
      setManager: (manager: ServiceTransformerManager) => {
        // In a real implementation, this would set the manager
        // For now, we'll just return
        return;
      }
    };

    // Initialize cache manager
    this.cacheManager = {
      getCache: () => {
        return this.getCache();
      },
      setCache: (cache: ServiceCache) => {
        this.setCache(cache);
      },
      clear: () => {
        this.clearCache();
      },
      getManager: () => this,
      setManager: (manager: any) => {
        // In a real implementation, this would set the manager
        // For now, we'll just return
        return;
      }
    };

    // Initialize logger manager
    this.loggerManager = {
      getLogger: () => {
        return this.getLogger();
      },
      setLogger: (logger: ServiceLogger) => {
        this.setLogger(logger);
      },
      getManager: () => this,
      setManager: (manager: any) => {
        // In a real implementation, this would set the manager
        // For now, we'll just return
        return;
      }
    };

    // Initialize metrics manager
    this.metricsManager = {
      getCollector: () => {
        return this.getCollector();
      },
      setCollector: (collector: ServiceMetricsCollector) => {
        this.setCollector(collector);
      },
      getMetrics: () => {
        return this.getMetrics();
      },
      getManager: () => this,
      setManager: (manager: any) => {
        // In a real implementation, this would set the manager
        // For now, we'll just return
        return;
      }
    };

    // Initialize health manager
    this.healthManager = {
      getChecker: () => {
        return this.getChecker();
      },
      setChecker: (checker: ServiceHealthChecker) => {
        this.setChecker(checker);
      },
      check: async () => {
        return await this.checkHealth();
      },
      getManager: () => this as unknown as ServiceHealthManager,
      setManager: (manager: ServiceHealthManager) => {
        // In a real implementation, this would set the manager
        // For now, we'll just return
        return;
      }
    };

    // Initialize config manager
    this.configManager = {
      getValidator: () => {
        return this.getValidator();
      },
      setValidator: (validator: ServiceConfigValidator) => {
        this.setValidator(validator);
      },
      validate: (config: ServiceConfig) => {
        return this.validateConfig(config);
      },
      getManager: () => this as unknown as ServiceConfigManager,
      setManager: (manager: ServiceConfigManager) => {
        // In a real implementation, this would set the manager
        // For now, we'll just return
        return;
      }
    };

    // Initialize factory manager
    this.factoryManager = {
      getRegistry: () => {
        return this.getRegistry();
      },
      setRegistry: (registry: ServiceFactoryRegistry) => {
        this.setRegistry(registry);
      },
      register: <T extends BaseService>(name: string, factory: ServiceFactory<T>) => {
        this.register(name, factory);
      },
      get: <T extends BaseService>(name: string) => {
        return this.getServiceFactory<T>(name);
      },
      getManager: () => this as unknown as ServiceFactoryManager,
      setManager: (manager: ServiceFactoryManager) => {
        // In a real implementation, this would set the manager
        // For now, we'll just return
        return;
      }
    };

    // Initialize dependency manager
    this.dependencyManager = {
      getResolver: () => {
        return this.getResolver();
      },
      setResolver: (resolver: ServiceDependencyResolver) => {
        this.setResolver(resolver);
      },
      resolve: async (dependencies: ServiceDependency[]) => {
        return await this.resolveDependencies(dependencies);
      },
      getManager: () => this as unknown as ServiceDependencyManager,
      setManager: (manager: ServiceDependencyManager) => {
        // In a real implementation, this would set the manager
        // For now, we'll just return
        return;
      }
    };

    // Initialize event manager
    this.eventManager = {
      getEmitter: () => {
        return this.getEmitter();
      },
      setEmitter: (emitter: ServiceEventEmitter) => {
        this.setEmitter(emitter);
      },
      emit: (event: ServiceEvent, data: any) => {
        this.emit(event, data);
      },
      on: (event: ServiceEvent, handler: ServiceEventHandler) => {
        return this.on(event, handler);
      },
      getManager: () => this as unknown as ServiceEventManager,
      setManager: (manager: ServiceEventManager) => {
        // In a real implementation, this would set the manager
        // For now, we'll just return
        return;
      }
    };
  }

  /**
   * Initialize event handlers
   */
  private initializeEventHandlers(): void {
    this.on('request_start', (data) => {
      if (data && typeof data === 'object' && data !== null) {
        const obj = data as Record<string, any>;
        if (obj.context !== undefined) {
          this.context = obj.context;
        }
      }
    });

    this.on('request_success', (data) => {
      if (data && typeof data === 'object' && data !== null) {
        const obj = data as Record<string, any>;
        if (obj.startTime !== undefined) {
          const responseTime = Date.now() - obj.startTime;
          this.updateAverageResponseTime(responseTime);
        }
      }
    });

    this.on('request_error', (data) => {
      this.metrics.errors++;
      if (data && typeof data === 'object' && data !== null) {
        const obj = data as Record<string, any>;
        if (obj.error !== undefined && obj.error !== null) {
          this.metrics.lastError = obj.error?.message || 'Unknown error';
          this.updateHealth('degraded', obj.error?.message || 'Request failed');
        } else {
          this.metrics.lastError = 'Unknown error';
          this.updateHealth('degraded', 'Request failed');
        }
      } else {
        this.metrics.lastError = 'Unknown error';
        this.updateHealth('degraded', 'Request failed');
      }
    });

    this.on('cache_hit', () => {
      // Cache hit metrics
    });

    this.on('cache_miss', () => {
      // Cache miss metrics
    });

    this.on('retry_attempt', () => {
      // Retry attempt metrics
    });

    this.on('circuit_open', () => {
      this.updateHealth('unhealthy', 'Circuit breaker is open');
    });

    this.on('circuit_close', () => {
      this.updateHealth('healthy', 'Circuit breaker is closed');
    });
  }

  /**
   * Initialize lifecycle handlers
   */
  private initializeLifecycleHandlers(): void {
    this.onLifecycleEvent('initialized', (service) => {
      this.isServiceReady = true;
      this.updateHealth('healthy', 'Service initialized successfully');
    });

    this.onLifecycleEvent('started', (service) => {
      this.updateHealth('healthy', 'Service started successfully');
    });

    this.onLifecycleEvent('stopped', (service) => {
      this.updateHealth('degraded', 'Service stopped');
    });

    this.onLifecycleEvent('destroyed', (service) => {
      this.isServiceReady = false;
      this.updateHealth('unhealthy', 'Service destroyed');
    });

    this.onLifecycleEvent('error', (service) => {
      this.updateHealth('unhealthy', 'Service encountered an error');
    });
  }

  /**
   * Check if the service is ready to perform operations
   */
  public isReady(): boolean {
    return this.isServiceReady;
  }

  /**
   * Get the current user profile (if applicable)
   */
  public getProfile(): any {
    return this.profile;
  }

  /**
   * Set the current user profile (if applicable)
   */
  public setProfile(profile: any): void {
    this.profile = profile;
  }

  /**
   * Get service configuration
   */
  public getConfig(): ServiceConfig {
    return { ...this.config };
  }

  /**
   * Update service configuration
   */
  public updateConfig(config: Partial<ServiceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get service metrics
   */
  public getMetrics(): ServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get service health
   */
  public getHealth(): ServiceHealth {
    return { ...this.health };
  }

  /**
   * Update service health status
   */
  protected updateHealth(status: 'healthy' | 'unhealthy' | 'degraded', message: string, details?: any): void {
    this.health = {
      status,
      message,
      timestamp: formatDateTime(new Date()),
      details: details || this.health.details
    };
    this.emit('health_update', this.health);
  }

  /**
   * Update average response time
   */
  private updateAverageResponseTime(responseTime: number): void {
    const totalResponseTime = this.metrics.averageResponseTime * (this.metrics.requests - 1);
    this.metrics.averageResponseTime = (totalResponseTime + responseTime) / this.metrics.requests;
  }

  /**
   * Emit an event
   */
  protected emit(event: ServiceEvent, data: any): void {
    // Emit to event emitter
    if (this.eventEmitter) {
      this.eventEmitter.emit(event, data);
    }

    // Emit to lifecycle handlers
    if (this.lifecycleHandlers.length > 0 && event === 'request_success') {
      this.lifecycleHandlers.forEach(handler => {
        try {
          handler('initialized', this);
        } catch (error) {
          console.error('Error in lifecycle handler:', error);
        }
      });
    }
  }

  /**
   * Subscribe to an event
   */
  protected on(event: ServiceEvent, handler: ServiceEventHandler): ServiceSubscription {
    if (this.eventEmitter) {
      return this.eventEmitter.on(event, handler);
    }
    return {
      unsubscribe: () => {}
    };
  }

  /**
   * Unsubscribe from an event
   */
  protected off(event: ServiceEvent, handler: ServiceEventHandler): void {
    if (this.eventEmitter) {
      this.eventEmitter.off(event, handler);
    }
  }

  /**
   * Get all event handlers for an event
   */
  protected getHandlers(event: ServiceEvent): ServiceEventHandler[] {
    if (this.eventEmitter) {
      return this.eventEmitter.getHandlers(event);
    }
    return [];
  }

  /**
   * Subscribe to lifecycle events
   */
  protected onLifecycleEvent(event: ServiceLifecycleEvent, handler: ServiceLifecycleHandler): void {
    this.lifecycleHandlers.push((lifecycleEvent: ServiceLifecycleEvent, service: BaseService) => {
      if (lifecycleEvent === event) {
        handler(lifecycleEvent, service);
      }
    });
  }

  /**
   * Install a plugin
   */
  public install(plugin: ServicePlugin): void {
    if (!this.isInstalled(plugin.name)) {
      this.plugins.push(plugin);
      plugin.initialize(this);
      this.emit('plugin_installed', { plugin });
    }
  }

  /**
   * Uninstall a plugin
   */
  public uninstall(pluginName: string): void {
    const index = this.plugins.findIndex(p => p.name === pluginName);
    if (index !== -1) {
      const plugin = this.plugins[index];
      plugin.destroy(this);
      this.plugins.splice(index, 1);
      this.emit('plugin_uninstalled', { pluginName });
    }
  }

  /**
   * Check if a plugin is installed
   */
  public isInstalled(pluginName: string): boolean {
    return this.plugins.some(p => p.name === pluginName);
  }

  /**
   * Get installed plugins
   */
  public getPlugins(): ServicePlugin[] {
    return [...this.plugins];
  }

  /**
   * Add middleware
   */
  public add(middleware: ServiceMiddleware): void {
    this.middleware.push(middleware);
    this.emit('middleware_added', { middleware });
  }

  /**
   * Remove middleware
   */
  public remove(middlewareName: string): void {
    const index = this.middleware.findIndex(m => m.name === middlewareName);
    if (index !== -1) {
      this.middleware.splice(index, 1);
      this.emit('middleware_removed', { middlewareName });
    }
  }

  /**
   * Get all middleware
   */
  public getMiddleware(): ServiceMiddleware[] {
    return [...this.middleware];
  }

  /**
   * Execute middleware chain
   */
  public async execute(context: any, next: () => Promise<any>): Promise<any> {
    const middleware = this.getMiddleware();
    
    const executeMiddleware = async (index: number): Promise<any> => {
      if (index >= middleware.length) {
        return next();
      }

      const currentMiddleware = middleware[index];
      
      try {
        if (currentMiddleware.before) {
          await currentMiddleware.before(context);
        }

        const result = await executeMiddleware(index + 1);

        if (currentMiddleware.after) {
          await currentMiddleware.after(context, result);
        }

        return result;
      } catch (error) {
        if (currentMiddleware.onError) {
          await currentMiddleware.onError(context, error);
        }
        throw error;
      }
    };

    return executeMiddleware(0);
  }

  /**
   * Create a new context
   */
  public create(userId?: string, metadata?: Record<string, any>): ServiceContext {
    return {
      requestId: generateId(),
      userId,
      timestamp: new Date(),
      metadata
    };
  }

  /**
   * Get current context
   */
  public getCurrent(): ServiceContext | null {
    return this.context;
  }

  /**
   * Set current context
   */
  public setCurrent(context: ServiceContext): void {
    this.context = context;
  }

  /**
   * Clear current context
   */
  public clear(): void {
    this.context = null;
  }

  /**
   * Add a validator
   */
  public addValidatorItem(validator: ServiceValidator<any>): void {
    // Implementation would depend on validator manager
  }

  /**
   * Remove a validator
   */
  public removeValidator(validatorName: string): void {
    // Implementation would depend on validator manager
  }

  /**
   * Validate data
   */
  public validate<T>(data: T, validatorName: string): { valid: boolean; errors: string[] } {
    // Implementation would depend on validator manager
    return { valid: true, errors: [] };
  }

  /**
   * Add a transformer
   */
  public addTransformerItem<T, U>(transformer: ServiceTransformer<T, U>): void {
    // Implementation would depend on transformer manager
  }

  /**
   * Remove a transformer
   */
  public removeTransformer(transformerName: string): void {
    // Implementation would depend on transformer manager
  }

  /**
   * Transform data
   */
  public transform<T, U>(data: T, transformerName: string): U {
    // Implementation would depend on transformer manager
    return data as unknown as U;
  }

  /**
   * Get cache instance
   */
  public getCache(): ServiceCache {
    // Implementation would depend on cache manager
    return {
      get: () => null,
      set: () => {},
      delete: () => {},
      clear: () => {},
      has: () => false
    };
  }

  /**
   * Set cache instance
   */
  public setCache(cache: ServiceCache): void {
    // Implementation would depend on cache manager
  }

  /**
   * Clear all caches
   */
  public clearCache(): void {
    const cache = this.getCache();
    cache.clear();
  }

  /**
   * Get logger instance
   */
  public getLogger(): ServiceLogger {
    // Implementation would depend on logger manager
    return {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {}
    };
  }

  /**
   * Set logger instance
   */
  public setLogger(logger: ServiceLogger): void {
    // Implementation would depend on logger manager
  }

  /**
   * Get metrics collector instance
   */
  public getCollector(): ServiceMetricsCollector {
    // Implementation would depend on metrics manager
    return {
      record: () => {},
      increment: () => {},
      timing: () => {},
      getMetrics: () => ({})
    };
  }

  /**
   * Set metrics collector instance
   */
  public setCollector(collector: ServiceMetricsCollector): void {
    // Implementation would depend on metrics manager
  }

  /**
   * Get health checker instance
   */
  public getChecker(): ServiceHealthChecker {
    // Implementation would depend on health manager
    return {
      check: async () => this.getHealth(),
      getInterval: () => 60000
    };
  }

  /**
   * Set health checker instance
   */
  public setChecker(checker: ServiceHealthChecker): void {
    // Implementation would depend on health manager
  }

  
  /**
   * Get configuration validator instance
   */
  public getValidator(): ServiceConfigValidator {
    // Implementation would depend on config manager
    return {
      validate: () => ({ valid: true, errors: [] })
    };
  }

  /**
   * Set configuration validator instance
   */
  public setValidator(validator: ServiceConfigValidator): void {
    // Implementation would depend on config manager
  }

  /**
   * Validate configuration
   */
  public validateConfig(config: ServiceConfig): { valid: boolean; errors: string[] } {
    const validator = this.getValidator();
    return validator.validate(config);
  }

  /**
   * Get factory registry instance
   */
  protected getRegistry(): ServiceFactoryRegistry {
    // Implementation would depend on factory manager
    return {
      register: () => {},
      get: () => null,
      has: () => false,
      unregister: () => {},
      getFactories: () => []
    };
  }

  /**
   * Set factory registry instance
   */
  protected setRegistry(registry: ServiceFactoryRegistry): void {
    // Implementation would depend on factory manager
  }

  /**
   * Register a service factory
   */
  protected register<T extends BaseService>(name: string, factory: ServiceFactory<T>): void {
    const registry = this.getRegistry();
    registry.register(name, factory);
  }

  /**
   * Get a service instance
   */
  protected getService<T extends BaseService>(name: string): T | null {
    const registry = this.getRegistry();
    const result = registry.get<T>(name);
    return (result as unknown as T) || null;
  }

  /**
   * Get a service factory
   */
  protected getServiceFactory<T extends BaseService>(name: string): ServiceFactory<T> | null {
    const registry = this.getRegistry();
    const result = registry.get<T>(name);
    return (result as ServiceFactory<T>) || null;
  }

  /**
   * Get dependency resolver instance
   */
  protected getResolver(): ServiceDependencyResolver {
    // Implementation would depend on dependency manager
    return {
      resolve: async () => [],
      check: async () => true
    };
  }

  /**
   * Set dependency resolver instance
   */
  protected setResolver(resolver: ServiceDependencyResolver): void {
    // Implementation would depend on dependency manager
  }

  /**
   * Resolve service dependencies
   */
  protected async resolveDependencies(dependencies: ServiceDependency[]): Promise<BaseService[]> {
    const resolver = this.getResolver();
    return resolver.resolve(dependencies);
  }

  /**
   * Get event emitter instance
   */
  protected getEmitter(): ServiceEventEmitter {
    return this.eventEmitter;
  }

  /**
   * Set event emitter instance
   */
  protected setEmitter(emitter: ServiceEventEmitter): void {
    this.eventEmitter = emitter;
  }

  /**
   * Initialize the service
   */
  public async initialize(service: BaseService): Promise<void> {
    this.emit('initialized', service);
  }

  /**
   * Start the service
   */
  public async start(service: BaseService): Promise<void> {
    this.emit('started', service);
  }

  /**
   * Stop the service
   */
  public async stop(service: BaseService): Promise<void> {
    this.emit('stopped', service);
  }

  /**
   * Destroy the service
   */
  public async destroy(service: BaseService): Promise<void> {
    this.emit('destroyed', service);
  }

  /**
   * Get service status
   */
  public getStatus(service: BaseService): 'initialized' | 'started' | 'stopped' | 'destroyed' {
    if (!this.isReady()) {
      return 'destroyed';
    }
    return 'started';
  }

  /**
   * Handle async operations with consistent error handling
   */
  protected async handleAsyncOperation<T>(
    operation: () => Promise<T>,
    fallbackMessage: string = 'An error occurred'
  ): Promise<ServiceResult<T>> {
    return handleAsyncOperation(operation, fallbackMessage);
  }

  /**
   * Create a success result
   */
  protected createSuccessResult<T>(data: T): ServiceResult<T> {
    return createSuccessResult(data);
  }

  /**
   * Create an error result
   */
  protected createErrorResult<T>(message: string, code?: string, details?: string): ServiceResult<T> {
    return createErrorResult(message, code, details);
  }

  /**
   * Map error to ServiceError format
   */
  protected mapError(error: unknown, fallbackMessage: string): ServiceError {
    return mapError(error, fallbackMessage);
  }

  /**
   * Validate required fields
   */
  protected validateRequiredFields(fields: Record<string, any>, fieldNames: string[]): string[] {
    // Implementation would depend on validation logic
    return [];
  }

  /**
   * Debounce function calls
   */
  protected debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    // Implementation would depend on debounce utility
    return func as any;
  }

  /**
   * Format currency
   */
  protected formatCurrency(amount: number): string {
    // Implementation would depend on formatting utility
    return amount.toString();
  }

  /**
   * Generate unique ID
   */
  protected generateId(): string {
    // Implementation would depend on ID generation utility
    return Math.random().toString(36).substr(2, 9);
  }

  /**
   * Check if value is empty
   */
  protected isEmpty(value: any): boolean {
    // Implementation would depend on utility function
    return value == null || value === '';
  }

  /**
   * Deep clone an object
   */
  protected deepClone<T>(obj: T): T {
    // Implementation would depend on utility function
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Compare two objects deeply
   */
  protected deepEqual(obj1: any, obj2: any): boolean {
    // Implementation would depend on utility function
    return JSON.stringify(obj1) === JSON.stringify(obj2);
  }

  /**
   * Get nested object property safely
   */
  protected getNestedProperty(obj: any, path: string, defaultValue?: any): any {
    // Implementation would depend on utility function
    return obj[path] || defaultValue;
  }

  /**
   * Format date
   */
  protected formatDate(date: Date | string): string {
    // Implementation would depend on utility function
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().split('T')[0];
  }

  /**
   * Format datetime
   */
  protected formatDateTime(date: Date | string): string {
    // Implementation would depend on utility function
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString();
  }

  /**
   * Capitalize first letter of a string
   */
  protected capitalizeFirst(str: string): string {
    // Implementation would depend on utility function
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Generate auto reference numbers
   */
  protected generateAutoReference(prefix: string = 'REF'): string {
    // Implementation would depend on utility function
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `${prefix}-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Validate email format
   */
  protected isValidEmail(email: string): boolean {
    // Implementation would depend on utility function
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number format
   */
  protected isValidPhone(phone: string): boolean {
    // Implementation would depend on utility function
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Validate URL format
   */
  protected isValidUrl(url: string): boolean {
    // Implementation would depend on utility function
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sanitize HTML content
   */
  protected sanitizeHtml(html: string): string {
    // Implementation would depend on utility function
    return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
              .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  }

  /**
   * Truncate text
   */
  protected truncateText(text: string, maxLength: number, suffix: string = '...'): string {
    // Implementation would depend on utility function
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - suffix.length) + suffix;
  }

  /**
   * Get file extension from filename
   */
  protected getFileExtension(filename: string): string {
    // Implementation would depend on utility function
    return filename.split('.').pop()?.toLowerCase() || '';
  }

  /**
   * Format file size
   */
  protected formatFileSize(bytes: number): string {
    // Implementation would depend on utility function
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Check if a date is within a range
   */
  protected isDateInRange(date: Date, startDate: Date, endDate: Date): boolean {
    // Implementation would depend on utility function
    return date >= startDate && date <= endDate;
  }

  /**
   * Get the difference between two dates in days
   */
  protected getDateDifferenceInDays(date1: Date, date2: Date): number {
    // Implementation would depend on utility function
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Add days to a date
   */
  protected addDays(date: Date, days: number): Date {
    // Implementation would depend on utility function
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Get the start of the day
   */
  protected startOfDay(date: Date): Date {
    // Implementation would depend on utility function
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  /**
   * Get the end of the day
   */
  protected endOfDay(date: Date): Date {
    // Implementation would depend on utility function
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  /**
   * Check if a date is today
   */
  protected isToday(date: Date): boolean {
    // Implementation would depend on utility function
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  /**
   * Check if a date is yesterday
   */
  protected isYesterday(date: Date): boolean {
    // Implementation would depend on utility function
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return date.toDateString() === yesterday.toDateString();
  }

  /**
   * Check if a date is within the last 7 days
   */
  protected isWithinLast7Days(date: Date): boolean {
    // Implementation would depend on utility function
    const today = new Date();
    const last7Days = new Date();
    last7Days.setDate(today.getDate() - 7);
    return date >= last7Days && date <= today;
  }

  /**
   * Check if a date is within the last 30 days
   */
  protected isWithinLast30Days(date: Date): boolean {
    // Implementation would depend on utility function
    const today = new Date();
    const last30Days = new Date();
    last30Days.setDate(today.getDate() - 30);
    return date >= last30Days && date <= today;
  }

  /**
   * Get the month name from a date
   */
  protected getMonthName(date: Date): string {
    // Implementation would depend on utility function
    return date.toLocaleString('default', { month: 'long' });
  }

  /**
   * Get the day name from a date
   */
  protected getDayName(date: Date): string {
    // Implementation would depend on utility function
    return date.toLocaleString('default', { weekday: 'long' });
  }

  /**
   * Get the current month and year
   */
  protected getCurrentMonthYear(): string {
    // Implementation would depend on utility function
    const date = new Date();
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  /**
   * Get the previous month and year
   */
  protected getPreviousMonthYear(): string {
    // Implementation would depend on utility function
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  /**
   * Get the next month and year
   */
  protected getNextMonthYear(): string {
    // Implementation would depend on utility function
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  /**
   * Get the financial year from a date
   */
  protected getFinancialYear(date: Date): string {
    // Implementation would depend on utility function
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // Assuming financial year starts in July (month 6)
    if (month >= 6) {
      return `${year}-${year + 1}`;
    } else {
      return `${year - 1}-${year}`;
    }
  }

  /**
   * Get the quarter from a date
   */
  protected getQuarter(date: Date): number {
    // Implementation would depend on utility function
    return Math.ceil((date.getMonth() + 1) / 3);
  }

  /**
   * Get the week number from a date
   */
  protected getWeekNumber(date: Date): number {
    // Implementation would depend on utility function
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + startOfYear.getDay() + 1) / 7);
  }

  /**
   * Get the age from a date of birth
   */
  protected getAge(dateOfBirth: Date): number {
    // Implementation would depend on utility function
    const today = new Date();
    let age = today.getFullYear() - dateOfBirth.getFullYear();
    const monthDiff = today.getMonth() - dateOfBirth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
      age--;
    }
    
    return age;
  }

  /**
   * Check if a year is a leap year
   */
  protected isLeapYear(year: number): boolean {
    // Implementation would depend on utility function
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  }

  /**
   * Get the number of days in a month
   */
  protected getDaysInMonth(year: number, month: number): number {
    // Implementation would depend on utility function
    return new Date(year, month + 1, 0).getDate();
  }

  /**
   * Get the number of days in a year
   */
  protected getDaysInYear(year: number): number {
    // Implementation would depend on utility function
    return this.isLeapYear(year) ? 366 : 365;
  }

  /**
   * Get the start of the month
   */
  protected startOfMonth(date: Date): Date {
    // Implementation would depend on utility function
    const result = new Date(date);
    result.setDate(1);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  /**
   * Get the end of the month
   */
  protected endOfMonth(date: Date): Date {
    // Implementation would depend on utility function
    const result = new Date(date);
    result.setMonth(result.getMonth() + 1, 0);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  /**
   * Get the start of the year
   */
  protected startOfYear(date: Date): Date {
    // Implementation would depend on utility function
    const result = new Date(date);
    result.setMonth(0, 1);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  /**
   * Get the end of the year
   */
  protected endOfYear(date: Date): Date {
    // Implementation would depend on utility function
    const result = new Date(date);
    result.setMonth(11, 31);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  /**
   * Get the start of the week
   */
  protected startOfWeek(date: Date): Date {
    // Implementation would depend on utility function
    const result = new Date(date);
    const day = result.getDay();
    const diff = result.getDate() - day + (day === 0 ? -6 : 1);
    result.setDate(diff);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  /**
   * Get the end of the week
   */
  protected endOfWeek(date: Date): Date {
    // Implementation would depend on utility function
    const result = new Date(date);
    const day = result.getDay();
    const diff = result.getDate() - day + (day === 0 ? 0 : 7);
    result.setDate(diff);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  /**
   * Format a number with commas
   */
  protected formatNumberWithCommas(num: number): string {
    // Implementation would depend on utility function
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /**
   * Round a number to a specific number of decimal places
   */
  protected roundNumber(num: number, decimalPlaces: number): number {
    // Implementation would depend on utility function
    const factor = Math.pow(10, decimalPlaces);
    return Math.round(num * factor) / factor;
  }

  /**
   * Calculate percentage
   */
  protected calculatePercentage(value: number, total: number): number {
    // Implementation would depend on utility function
    if (total === 0) return 0;
    return this.roundNumber((value / total) * 100, 2);
  }

  /**
   * Calculate percentage change
   */
  protected calculatePercentageChange(oldValue: number, newValue: number): number {
    // Implementation would depend on utility function
    if (oldValue === 0) return 0;
    return this.roundNumber(((newValue - oldValue) / oldValue) * 100, 2);
  }

  /**
   * Calculate compound interest
   */
  protected calculateCompoundInterest(principal: number, rate: number, time: number, compoundsPerYear: number = 1): number {
    // Implementation would depend on utility function
    return principal * Math.pow(1 + (rate / compoundsPerYear), compoundsPerYear * time);
  }

  /**
   * Calculate simple interest
   */
  protected calculateSimpleInterest(principal: number, rate: number, time: number): number {
    // Implementation would depend on utility function
    return principal * rate * time;
  }

  /**
   * Calculate EMI (Equated Monthly Installment)
   */
  protected calculateEMI(principal: number, annualRate: number, tenureMonths: number): number {
    // Implementation would depend on utility function
    const monthlyRate = annualRate / 12 / 100;
    return principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths) / (Math.pow(1 + monthlyRate, tenureMonths) - 1);
  }

  /**
   * Calculate loan amortization schedule
   */
  protected calculateAmortizationSchedule(principal: number, annualRate: number, tenureMonths: number): Array<{
    month: number;
    payment: number;
    principal: number;
    interest: number;
    balance: number;
  }> {
    // Implementation would depend on utility function
    const monthlyRate = annualRate / 12 / 100;
    const monthlyPayment = this.calculateEMI(principal, annualRate, tenureMonths);
    const schedule = [];
    let balance = principal;

    for (let month = 1; month <= tenureMonths; month++) {
      const interest = balance * monthlyRate;
      const principalPayment = monthlyPayment - interest;
      balance -= principalPayment;

      schedule.push({
        month,
        payment: this.roundNumber(monthlyPayment, 2),
        principal: this.roundNumber(principalPayment, 2),
        interest: this.roundNumber(interest, 2),
        balance: this.roundNumber(Math.max(0, balance), 2)
      });
    }

    return schedule;
  }

  /**
   * Generate a random color
   */
  protected generateRandomColor(): string {
    // Implementation would depend on utility function
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }

  /**
   * Generate a random string
   */
  protected generateRandomString(length: number): string {
    // Implementation would depend on utility function
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }

  /**
   * Generate a random number within a range
   */
  protected generateRandomNumber(min: number, max: number): number {
    // Implementation would depend on utility function
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Shuffle an array
   */
  protected shuffleArray<T>(array: T[]): T[] {
    // Implementation would depend on utility function
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Get unique values from an array
   */
  protected getUniqueValues<T>(array: T[]): T[] {
    // Implementation would depend on utility function
    const seen = new Set<T>();
    const result: T[] = [];
    
    for (const item of array) {
      if (!seen.has(item)) {
        seen.add(item);
        result.push(item);
      }
    }
    
    return result;
  }

  /**
   * Group array items by a key
   */
  protected groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    // Implementation would depend on utility function
    return array.reduce((groups, item) => {
      const groupKey = String(item[key]);
      groups[groupKey] = groups[groupKey] || [];
      groups[groupKey].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  /**
   * Sort array by a key
   */
  protected sortBy<T>(array: T[], key: keyof T, order: 'asc' | 'desc' = 'asc'): T[] {
    // Implementation would depend on utility function
    return [...array].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      
      if (aVal < bVal) return order === 'asc' ? -1 : 1;
      if (aVal > bVal) return order === 'asc' ? 1 : -1;
      return 0;
    });
  }

  /**
   * Filter array by a predicate
   */
  protected filterBy<T>(array: T[], predicate: (item: T) => boolean): T[] {
    // Implementation would depend on utility function
    return array.filter(predicate);
  }

  /**
   * Find an item in an array by a key
   */
  protected findBy<T>(array: T[], key: keyof T, value: any): T | undefined {
    // Implementation would depend on utility function
    return array.find(item => item[key] === value);
  }

  /**
   * Remove an item from an array by a key
   */
  protected removeBy<T>(array: T[], key: keyof T, value: any): T[] {
    // Implementation would depend on utility function
    return array.filter(item => item[key] !== value);
  }

  /**
   * Update an item in an array by a key
   */
  protected updateBy<T extends Record<string, any>>(
    array: T[], 
    key: keyof T, 
    value: any, 
    updates: Partial<T>
  ): T[] {
    // Implementation would depend on utility function
    return array.map(item => 
      item[key] === value ? { ...item, ...updates } : item
    );
  }

  /**
   * Add an item to an array if it doesn't exist
   */
  protected addIfNotExists<T>(array: T[], item: T, key: keyof T): T[] {
    // Implementation would depend on utility function
    if (!array.find(existing => existing[key] === item[key])) {
      return [...array, item];
    }
    return array;
  }

  /**
   * Toggle an item in an array
   */
  protected toggleItem<T>(array: T[], item: T): T[] {
    // Implementation would depend on utility function
    const index = array.indexOf(item);
    if (index === -1) {
      return [...array, item];
    } else {
      const result = [...array];
      result.splice(index, 1);
      return result;
    }
  }

  /**
   * Chunk an array into smaller arrays
   */
  protected chunkArray<T>(array: T[], size: number): T[][] {
    // Implementation would depend on utility function
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Flatten a nested array
   */
  protected flattenArray<T>(array: (T | T[])[]): T[] {
    // Implementation would depend on utility function
    return array.reduce<T[]>((acc, item) => {
      return acc.concat(Array.isArray(item) ? item : [item]);
    }, []);
  }

  /**
   * Debounce with immediate execution
   */
  protected debounceImmediate<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
    immediate: boolean = false
  ): (...args: Parameters<T>) => void {
    // Implementation would depend on utility function
    let timeout: NodeJS.Timeout | null = null;
    
    return (...args: Parameters<T>) => {
      const callNow = immediate && !timeout;
      
      if (timeout) {
        clearTimeout(timeout);
      }
      
      timeout = setTimeout(() => {
        timeout = null;
        if (!immediate) func(...args);
      }, wait);
      
      if (callNow) func(...args);
    };
  }

  /**
   * Throttle function calls
   */
  protected throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    // Implementation would depend on utility function
    let inThrottle: boolean;
    
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Create a memoized function
   */
  protected memoize<T extends (...args: any[]) => any>(func: T): T {
    // Implementation would depend on utility function
    const cache = new Map<string, ReturnType<T>>();
    
    return ((...args: Parameters<T>) => {
      const key = JSON.stringify(args);
      
      if (cache.has(key)) {
        return cache.get(key);
      }
      
      const result = func(...args);
      cache.set(key, result);
      return result;
    }) as T;
  }

  /**
   * Create a retry wrapper for async functions
   */
  protected withRetry<T>(
    fn: () => Promise<T>,
    retries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    // Implementation would depend on utility function
    return new Promise((resolve, reject) => {
      const attempt = (count: number) => {
        fn()
          .then(resolve)
          .catch((error) => {
            if (count >= retries) {
              reject(error);
            } else {
              setTimeout(() => attempt(count + 1), delay);
            }
          });
      };
      
      attempt(0);
    });
  }

  /**
   * Create a timeout wrapper for async functions
   */
  protected withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    // Implementation would depend on utility function
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout after ${ms}ms`));
      }, ms);
      
      promise
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timeout));
    });
  }

  /**
   * Create a race between multiple promises
   */
  protected racePromises<T>(promises: Promise<T>[]): Promise<T> {
    // Implementation would depend on utility function
    return Promise.race(promises);
  }

  /**
   * Create a sequence of promises
   */
  protected sequencePromises<T>(promises: Promise<T>[]): Promise<T[]> {
    // Implementation would depend on utility function
    return promises.reduce(
      (chain, promise) => chain.then((results) => 
        promise.then((result) => [...results, result])
      ),
      Promise.resolve([] as T[])
    );
  }

  /**
   * Create a parallel execution of promises with concurrency limit
   */
  protected parallelPromises<T>(
    promises: Promise<T>[],
    concurrency: number = Infinity
  ): Promise<T[]> {
    // Implementation would depend on utility function
    return new Promise((resolve, reject) => {
      const results: T[] = [];
      let completed = 0;
      let currentIndex = 0;
      
      const executeNext = () => {
        if (currentIndex >= promises.length) {
          if (completed === promises.length) {
            resolve(results);
          }
          return;
        }
        
        const index = currentIndex++;
        const promise = promises[index];
        
        promise
          .then((result) => {
            results[index] = result;
            completed++;
            executeNext();
          })
          .catch(reject);
      };
      
      const initialConcurrency = Math.min(concurrency, promises.length);
      for (let i = 0; i < initialConcurrency; i++) {
        executeNext();
      }
    });
  }

  /**
   * Create a lazy loader
   */
  protected createLazyLoader<T>(
    loader: () => Promise<T>
  ): () => Promise<T> {
    // Implementation would depend on utility function
    let cached: Promise<T> | null = null;
    
    return () => {
      if (!cached) {
        cached = loader();
      }
      return cached;
    };
  }

  /**
   * Create a singleton instance
   */
  protected createSingleton<T>(constructor: new (...args: any[]) => T): () => T {
    // Implementation would depend on utility function
    let instance: T | null = null;
    
    return (...args: any[]) => {
      if (!instance) {
        instance = new constructor(...args);
      }
      return instance;
    };
  }

  /**
   * Create a factory function
   */
  protected createFactory<T>(
    constructor: new (...args: any[]) => T
  ): (...args: any[]) => T {
    // Implementation would depend on utility function
    return (...args: any[]) => new constructor(...args);
  }

  /**
   * Create a proxy for debugging
   */
  protected createDebugProxy<T extends object>(
    target: T,
    name: string = 'DebugProxy'
  ): T {
    // Implementation would depend on utility function
    return new Proxy(target, {
      get(target, prop, receiver) {
        console.log(`[${name}] Getting property: ${String(prop)}`);
        return Reflect.get(target, prop, receiver);
      },
      set(target, prop, value, receiver) {
        console.log(`[${name}] Setting property: ${String(prop)} =`, value);
        return Reflect.set(target, prop, value, receiver);
      },
      deleteProperty(target, prop) {
        console.log(`[${name}] Deleting property: ${String(prop)}`);
        return Reflect.deleteProperty(target, prop);
      }
    });
  }

  /**
   * Create a validator for objects
   */
  protected createValidator<T>(
    schema: Record<keyof T, (value: any) => boolean>
  ): (obj: Partial<T>) => { valid: boolean; errors: string[] } {
    // Implementation would depend on utility function
    return (obj) => {
      const errors: string[] = [];
      
      for (const [key, validator] of Object.entries(schema)) {
        if (typeof validator === 'function' && !validator(obj[key as keyof T])) {
          errors.push(`Invalid value for ${key}`);
        }
      }
      
      return { valid: errors.length === 0, errors };
    };
  }

  /**
   * Create a type guard
   */
  protected createTypeGuard<T>(
    validator: (obj: any) => obj is T
  ): (obj: any) => obj is T {
    // Implementation would depend on utility function
    return validator;
  }

  /**
   * Create a deep freeze for objects
   */
  protected deepFreeze<T>(obj: T): Readonly<T> {
    // Implementation would depend on utility function
    if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
      Object.getOwnPropertyNames(obj).forEach(prop => {
        if (obj && obj[prop] && typeof obj[prop] === 'object') {
          this.deepFreeze(obj[prop]);
        }
      });
      Object.freeze(obj);
    }
    return obj as Readonly<T>;
  }

  /**
   * Create a deep seal for objects
   */
  protected deepSeal<T>(obj: T): T {
    // Implementation would depend on utility function
    if (obj && typeof obj === 'object' && !Object.isSealed(obj)) {
      Object.getOwnPropertyNames(obj).forEach(prop => {
        if (obj && obj[prop] && typeof obj[prop] === 'object') {
          this.deepSeal(obj[prop]);
        }
      });
      Object.seal(obj);
    }
    return obj;
  }

  /**
   * Create a deep prevent extensions for objects
   */
  protected deepPreventExtensions<T>(obj: T): T {
    // Implementation would depend on utility function
    if (obj && typeof obj === 'object' && !Object.isExtensible(obj)) {
      Object.getOwnPropertyNames(obj).forEach(prop => {
        if (obj && obj[prop] && typeof obj[prop] === 'object') {
          this.deepPreventExtensions(obj[prop]);
        }
      });
      Object.preventExtensions(obj);
    }
    return obj;
  }

  /**
   * Create a curry function
   */
  protected curry<T extends (...args: any[]) => any>(
    fn: T
  ): (...args: Parameters<T>) => ReturnType<T> {
    // Implementation would depend on utility function
    return function curried(...args: Parameters<T>) {
      if (args.length >= fn.length) {
        return fn.apply(this, args);
      } else {
        return (...nextArgs: any[]) => curried.apply(this, args.concat(nextArgs));
      }
    } as any;
  }

  /**
   * Create a compose function
   */
  protected compose<T>(...fns: Array<(arg: T) => T>): (arg: T) => T {
    // Implementation would depend on utility function
    return (arg: T) => fns.reduceRight((acc, fn) => fn(acc), arg);
  }

  /**
   * Create a pipe function
   */
  protected pipe<T>(...fns: Array<(arg: T) => T>): (arg: T) => T {
    // Implementation would depend on utility function
    return (arg: T) => fns.reduce((acc, fn) => fn(acc), arg);
  }

  /**
   * Create a partial application
   */
  protected partial<T extends (...args: any[]) => any>(
    fn: T,
    ...presetArgs: Parameters<T>
  ): (...args: any[]) => ReturnType<T> {
    // Implementation would depend on utility function
    return (...args: any[]) => fn(...presetArgs, ...args);
  }

  /**
   * Create a once function
   */
  protected once<T extends (...args: any[]) => any>(fn: T): T {
    // Implementation would depend on utility function
    let called = false;
    let result: ReturnType<T>;
    
    return ((...args: Parameters<T>) => {
      if (!called) {
        called = true;
        result = fn.apply(this, args);
      }
      return result;
    }) as T;
  }

  /**
   * Create a after function
   */
  protected after<T extends (...args: any[]) => any>(
    count: number,
    fn: T
  ): T {
    // Implementation would depend on utility function
    let counter = count;
    
    return ((...args: Parameters<T>) => {
      if (--counter <= 0) {
        return fn.apply(this, args);
      }
    }) as T;
  }

  /**
   * Create a before function
   */
  protected before<T extends (...args: any[]) => any>(
    count: number,
    fn: T
  ): T {
    // Implementation would depend on utility function
    let counter = count;
    
    return ((...args: Parameters<T>) => {
      if (--counter >= 0) {
        return fn.apply(this, args);
      }
    }) as T;
  }

  /**
   * Create a wrap function
   */
  protected wrap<T extends (...args: any[]) => any>(
    fn: T,
    wrapper: (fn: T, ...args: Parameters<T>) => ReturnType<T>
  ): T {
    // Implementation would depend on utility function
    return ((...args: Parameters<T>) => wrapper(fn, ...args)) as T;
  }

  /**
   * Create a memoize with TTL
   */
  protected memoizeWithTTL<T extends (...args: any[]) => any>(
    fn: T,
    ttl: number = 60000
  ): T {
    // Implementation would depend on utility function
    const cache = new Map<string, { value: ReturnType<T>; timestamp: number }>();
    
    return ((...args: Parameters<T>) => {
      const key = JSON.stringify(args);
      const now = Date.now();
      
      if (cache.has(key)) {
        const entry = cache.get(key)!;
        if (now - entry.timestamp < ttl) {
          return entry.value;
        } else {
          cache.delete(key);
        }
      }
      
      const result = fn(...args);
      cache.set(key, { value: result, timestamp: now });
      return result;
    }) as T;
  }

  /**
   * Create a rate limiter
   */
  protected createRateLimiter<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    maxCalls: number,
    windowMs: number
  ): T {
    // Implementation would depend on utility function
    const calls: number[] = [];
    
    return (async (...args: Parameters<T>) => {
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // Remove old calls outside the window
      while (calls.length > 0 && calls[0] < windowStart) {
        calls.shift();
      }
      
      // Check if we've exceeded the limit
      if (calls.length >= maxCalls) {
        throw new Error(`Rate limit exceeded. Maximum ${maxCalls} calls per ${windowMs}ms.`);
      }
      
      // Record this call
      calls.push(now);
      
      // Execute the function
      return fn(...args);
    }) as T;
  }

  /**
   * Create a circuit breaker
   */
  protected createCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    failureThreshold: number = 5,
    recoveryTimeout: number = 60000
  ): T {
    // Implementation would depend on utility function
    let failures = 0;
    let lastFailureTime = 0;
    let state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
    
    return (async (...args: Parameters<T>) => {
      const now = Date.now();
      
      // Check if we should try to recover
      if (state === 'OPEN' && now - lastFailureTime > recoveryTimeout) {
        state = 'HALF_OPEN';
      }
      
      // If circuit is open, fail fast
      if (state === 'OPEN') {
        throw new Error('Circuit breaker is OPEN');
      }
      
      try {
        const result = await fn(...args);
        
        // Reset failures on success
        if (state === 'HALF_OPEN') {
          failures = 0;
          state = 'CLOSED';
        }
        
        return result;
      } catch (error) {
        failures++;
        lastFailureTime = now;
        
        // Open the circuit if threshold is reached
        if (failures >= failureThreshold) {
          state = 'OPEN';
        }
        
        throw error;
      }
    }) as T;
  }

  /**
   * Create a retry with exponential backoff
   */
  protected withExponentialBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 5,
    baseDelay: number = 1000,
    maxDelay: number = 30000
  ): Promise<T> {
    // Implementation would depend on utility function
    return new Promise((resolve, reject) => {
      const attempt = (count: number) => {
        fn()
          .then(resolve)
          .catch((error) => {
            if (count >= maxRetries) {
              reject(error);
            } else {
              const delay = Math.min(baseDelay * Math.pow(2, count), maxDelay);
              setTimeout(() => attempt(count + 1), delay);
            }
          });
      };
      
      attempt(0);
    });
  }

  /**
   * Create a timeout with exponential backoff
   */
  protected withTimeoutExponentialBackoff<T>(
    promise: Promise<T>,
    initialTimeout: number = 1000,
    maxTimeout: number = 30000,
    backoffFactor: number = 2
  ): Promise<T> {
    // Implementation would depend on utility function
    return new Promise((resolve, reject) => {
      let timeout = initialTimeout;
      let attempts = 0;
      
      const attempt = () => {
        const timeoutId = setTimeout(() => {
          attempts++;
          timeout = Math.min(timeout * backoffFactor, maxTimeout);
          
          if (attempts >= 5) {
            reject(new Error(`Timeout after ${attempts} attempts`));
          } else {
            attempt();
          }
        }, timeout);
        
        promise
          .then((result) => {
            clearTimeout(timeoutId);
            resolve(result);
          })
          .catch((error) => {
            clearTimeout(timeoutId);
            reject(error);
          });
      };
      
      attempt();
    });
  }

  /**
   * Create a retry with jitter
   */
  protected withJitterRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 5,
    baseDelay: number = 1000,
    maxDelay: number = 30000
  ): Promise<T> {
    // Implementation would depend on utility function
    return new Promise((resolve, reject) => {
      const attempt = (count: number) => {
        fn()
          .then(resolve)
          .catch((error) => {
            if (count >= maxRetries) {
              reject(error);
            } else {
              const delay = Math.min(baseDelay * Math.pow(2, count), maxDelay);
              const jitter = Math.random() * 0.1 * delay; // 10% jitter
              setTimeout(() => attempt(count + 1), delay + jitter);
            }
          });
      };
      
      attempt(0);
    });
  }

  /**
   * Create a retry with fixed delay
   */
  protected withFixedDelayRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 5,
    delay: number = 1000
  ): Promise<T> {
    // Implementation would depend on utility function
    return new Promise((resolve, reject) => {
      const attempt = (count: number) => {
        fn()
          .then(resolve)
          .catch((error) => {
            if (count >= maxRetries) {
              reject(error);
            } else {
              setTimeout(() => attempt(count + 1), delay);
            }
          });
      };
      
      attempt(0);
    });
  }

  /**
   * Create a retry with linear backoff
   */
  protected withLinearBackoffRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 5,
    baseDelay: number = 1000,
    maxDelay: number = 30000
  ): Promise<T> {
    // Implementation would depend on utility function
    return new Promise((resolve, reject) => {
      const attempt = (count: number) => {
        fn()
          .then(resolve)
          .catch((error) => {
            if (count >= maxRetries) {
              reject(error);
            } else {
              const delay = Math.min(baseDelay + (count * 1000), maxDelay);
              setTimeout(() => attempt(count + 1), delay);
            }
          });
      };
      
      attempt(0);
    });
  }

  /**
   * Create a retry with fibonacci backoff
   */
  protected withFibonacciBackoffRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 5,
    baseDelay: number = 1000,
    maxDelay: number = 30000
  ): Promise<T> {
    // Implementation would depend on utility function
    return new Promise((resolve, reject) => {
      const attempt = (count: number, prevDelay: number = 0) => {
        fn()
          .then(resolve)
          .catch((error) => {
            if (count >= maxRetries) {
              reject(error);
            } else {
              const delay = Math.min(baseDelay + prevDelay, maxDelay);
              setTimeout(() => attempt(count + 1, baseDelay), delay);
            }
          });
      };
      
      attempt(0);
    });
  }

  /**
   * Create a retry with custom backoff strategy
   */
  protected withCustomBackoffRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 5,
    backoffStrategy: (attempt: number) => number = (attempt) => Math.pow(2, attempt) * 1000
  ): Promise<T> {
    // Implementation would depend on utility function
    return new Promise((resolve, reject) => {
      const attempt = (count: number) => {
        fn()
          .then(resolve)
          .catch((error) => {
            if (count >= maxRetries) {
              reject(error);
            } else {
              const delay = backoffStrategy(count);
              setTimeout(() => attempt(count + 1), delay);
            }
          });
      };
      
      attempt(0);
    });
  }

  /**
   * Create a retry with custom retry condition
   */
  protected withConditionalRetry<T>(
    fn: () => Promise<T>,
    shouldRetry: (error: any, attempt: number) => boolean,
    maxRetries: number = 5,
    delay: number = 1000
  ): Promise<T> {
    // Implementation would depend on utility function
    return new Promise((resolve, reject) => {
      const attempt = (count: number) => {
        fn()
          .then(resolve)
          .catch((error) => {
            if (count >= maxRetries || !shouldRetry(error, count)) {
              reject(error);
            } else {
              setTimeout(() => attempt(count + 1), delay);
            }
          });
      };
      
      attempt(0);
    });
  }

  /**
   * Create a retry with custom retry condition and backoff
   */
  protected withConditionalBackoffRetry<T>(
    fn: () => Promise<T>,
    shouldRetry: (error: any, attempt: number) => boolean,
    backoffStrategy: (attempt: number) => number,
    maxRetries: number = 5
  ): Promise<T> {
    // Implementation would depend on utility function
    return new Promise((resolve, reject) => {
      const attempt = (count: number) => {
        fn()
          .then(resolve)
          .catch((error) => {
            if (count >= maxRetries || !shouldRetry(error, count)) {
              reject(error);
            } else {
              const delay = backoffStrategy(count);
              setTimeout(() => attempt(count + 1), delay);
            }
          });
      };
      
      attempt(0);
    });
  }

  /**
   * Create a retry with custom retry condition, backoff, and jitter
   */
  protected withConditionalJitterRetry<T>(
    fn: () => Promise<T>,
    shouldRetry: (error: any, attempt: number) => boolean,
    backoffStrategy: (attempt: number) => number,
    jitterFactor: number = 0.1,
    maxRetries: number = 5
  ): Promise<T> {
    // Implementation would depend on utility function
    return new Promise((resolve, reject) => {
      const attempt = (count: number) => {
        fn()
          .then(resolve)
          .catch((error) => {
            if (count >= maxRetries || !shouldRetry(error, count)) {
              reject(error);
            } else {
              const delay = backoffStrategy(count);
              const jitter = Math.random() * jitterFactor * delay;
              setTimeout(() => attempt(count + 1), delay + jitter);
            }
          });
      };
      
      attempt(0);
    });
  }

  /**
   * Create a retry with custom retry condition, backoff, jitter, and timeout
   */
  protected withConditionalJitterTimeoutRetry<T>(
    fn: () => Promise<T>,
    shouldRetry: (error: any, attempt: number) => boolean,
    backoffStrategy: (attempt: number) => number,
    jitterFactor: number = 0.1,
    timeout: number = 30000,
    maxRetries: number = 5
  ): Promise<T> {
    // Implementation would depend on utility function
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout after ${timeout}ms`));
      }, timeout);
      
      const attempt = (count: number) => {
        fn()
          .then((result) => {
            clearTimeout(timeoutId);
            resolve(result);
          })
          .catch((error) => {
            if (count >= maxRetries || !shouldRetry(error, count)) {
              clearTimeout(timeoutId);
              reject(error);
            } else {
              const delay = backoffStrategy(count);
              const jitter = Math.random() * jitterFactor * delay;
              setTimeout(() => attempt(count + 1), delay + jitter);
            }
          });
      };
      
      attempt(0);
    });
  }

  /**
   * Create a retry with custom retry condition, backoff, jitter, timeout, and circuit breaker
   */
  protected withConditionalJitterTimeoutCircuitBreakerRetry<T>(
    fn: () => Promise<T>,
    shouldRetry: (error: any, attempt: number) => boolean,
    backoffStrategy: (attempt: number) => number,
    jitterFactor: number = 0.1,
    timeout: number = 30000,
    failureThreshold: number = 5,
    recoveryTimeout: number = 60000,
    maxRetries: number = 5
  ): Promise<T> {
    // Implementation would depend on utility function
    let failures = 0;
    let lastFailureTime = 0;
    let state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout after ${timeout}ms`));
      }, timeout);
      
      const attempt = (count: number) => {
        const now = Date.now();
        
        // Check if we should try to recover
        if (state === 'OPEN' && now - lastFailureTime > recoveryTimeout) {
          state = 'HALF_OPEN';
        }
        
        // If circuit is open, fail fast
        if (state === 'OPEN') {
          clearTimeout(timeoutId);
          reject(new Error('Circuit breaker is OPEN'));
        }
        
        fn()
          .then((result) => {
            clearTimeout(timeoutId);
            
            // Reset failures on success
            if (state === 'HALF_OPEN') {
              failures = 0;
              state = 'CLOSED';
            }
            
            resolve(result);
          })
          .catch((error) => {
            if (count >= maxRetries || !shouldRetry(error, count)) {
              clearTimeout(timeoutId);
              reject(error);
            } else {
              failures++;
              lastFailureTime = now;
              
              // Open the circuit if threshold is reached
              if (failures >= failureThreshold) {
                state = 'OPEN';
              }
              
              const delay = backoffStrategy(count);
              const jitter = Math.random() * jitterFactor * delay;
              setTimeout(() => attempt(count + 1), delay + jitter);
            }
          });
      };
      
      attempt(0);
    });
  }
}

// Re-export types that are commonly used by other services
export type {
  ServiceError,
  ServiceResult,
  ServiceConfig,
  ServiceContext,
  ServiceEvent,
  ServiceEventHandler,
  ServiceSubscription,
  ServiceHealth,
  ServiceMetrics,
  ServiceLifecycleEvent,
  ServiceLifecycleHandler,
  ServicePlugin,
  ServiceMiddleware,
  ServiceValidator,
  ServiceTransformer,
  ServiceCache,
  ServiceLogger,
  ServiceMetricsCollector,
  ServiceHealthChecker,
  ServiceConfigValidator,
  ServiceFactory,
  ServiceRegistry,
  ServiceDependency,
  ServiceDependencyResolver,
  ServiceEventEmitter,
  PaginationParams,
  SortParams,
  FilterParams,
  ListResponse,
  AuditLogEntry
} from './types';