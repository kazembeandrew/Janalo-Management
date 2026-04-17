/**
 * Service Error interface for consistent error handling across all services
 */
export interface ServiceError {
  message: string;
  code?: string;
  details?: string;
}

/**
 * Service Result interface for consistent success/error handling
 */
export interface ServiceResult<T> {
  data: T | null;
  error: ServiceError | null;
  success: boolean;
}

/**
 * Base service interface that all services should implement
 */
export interface BaseService {
  /**
   * Check if the service is ready to perform operations
   */
  isReady(): boolean;
  
  /**
   * Get the current user profile (if applicable)
   */
  getProfile?(): any;
  
  /**
   * Set the current user profile (if applicable)
   */
  setProfile?(profile: any): void;
}

/**
 * Pagination parameters for list operations
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

/**
 * Sort parameters for list operations
 */
export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Filter parameters for list operations
 */
export interface FilterParams {
  [key: string]: any;
}

/**
 * Base list response interface
 */
export interface ListResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Search parameters for global search operations
 */
export interface SearchParams {
  query: string;
  filters?: FilterParams;
  pagination?: PaginationParams;
  sort?: SortParams;
}

/**
 * Global search result interface
 */
export interface GlobalSearchResult {
  borrowers: any[];
  loans: any[];
  users?: any[];
  documents?: any[];
}

/**
 * Search options interface
 */
export interface SearchOptions {
  query?: string;
  limit?: number;
  offset?: number;
  filters?: Record<string, any>;
}

/**
 * Search borrower result interface
 */
export interface SearchBorrowerResult {
  id: string;
  full_name: string;
  phone?: string;
  email?: string;
  address?: string;
  created_at: string;
}

/**
 * Search loan result interface
 */
export interface SearchLoanResult {
  id: string;
  borrower_id: string;
  borrower_full_name?: string;
  loan_number?: string;
  reference_no?: string;
  amount?: number;
  principal_amount?: number;
  status: string;
  created_at?: string;
  disbursement_date?: string;
  borrowers?: {
    full_name: string;
  };
}

/**
 * Audit log entry interface
 */
export interface AuditLogEntry {
  action: string;
  entity_type: string;
  entity_id: string;
  details: any;
}

/**
 * File upload result interface
 */
export interface FileUploadResult {
  id: string;
  name: string;
  path: string;
  url: string;
  size: number;
  type: string;
}

/**
 * File download result interface
 */
export interface FileDownloadResult {
  data: Blob;
  filename: string;
  contentType: string;
}

/**
 * Database transaction interface
 */
export interface DatabaseTransaction {
  /**
   * Execute a query within the transaction
   */
  query<T>(sql: string, params?: any[]): Promise<T>;
  
  /**
   * Commit the transaction
   */
  commit(): Promise<void>;
  
  /**
   * Rollback the transaction
   */
  rollback(): Promise<void>;
}

/**
 * Service configuration interface
 */
export interface ServiceConfig {
  /**
   * API base URL
   */
  baseUrl?: string;
  
  /**
   * Default timeout for requests
   */
  timeout?: number;
  
  /**
   * Retry configuration
   */
  retry?: {
    attempts: number;
    delay: number;
    backoff: number;
  };
  
  /**
   * Cache configuration
   */
  cache?: {
    enabled: boolean;
    ttl: number;
  };
}

/**
 * Service health check result
 */
export interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  message: string;
  timestamp: string;
  details?: any;
}

/**
 * Service metrics interface
 */
export interface ServiceMetrics {
  requests: number;
  errors: number;
  averageResponseTime: number;
  lastError?: string;
  uptime: number;
}

/**
 * Service event types
 */
export type ServiceEvent = 
  | 'request_start'
  | 'request_success'
  | 'request_error'
  | 'cache_hit'
  | 'cache_miss'
  | 'retry_attempt'
  | 'circuit_open'
  | 'circuit_close'
  | 'health_update'
  | 'plugin_installed'
  | 'plugin_uninstalled'
  | 'middleware_added'
  | 'middleware_removed'
  | 'initialized'
  | 'started'
  | 'stopped'
  | 'destroyed';

/**
 * Service event handler interface
 */
export interface ServiceEventHandler {
  (event: ServiceEvent, data: any): void;
}

/**
 * Service subscription interface
 */
export interface ServiceSubscription {
  /**
   * Unsubscribe from events
   */
  unsubscribe(): void;
}

/**
 * Service factory interface
 */
export interface ServiceFactory<T extends BaseService> {
  /**
   * Create a new service instance
   */
  create(config?: ServiceConfig): T;
  
  /**
   * Get the singleton instance
   */
  getInstance(config?: ServiceConfig): T;
}

/**
 * Service registry interface
 */
export interface ServiceRegistry {
  /**
   * Register a service
   */
  register<T extends BaseService>(name: string, factory: ServiceFactory<T>): void;
  
  /**
   * Get a service instance
   */
  get<T extends BaseService>(name: string): T | null;
  
  /**
   * Check if a service is registered
   */
  has(name: string): boolean;
  
  /**
   * Unregister a service
   */
  unregister(name: string): void;
  
  /**
   * Get all registered service names
   */
  getServices(): string[];
}

/**
 * Service dependency interface
 */
export interface ServiceDependency {
  /**
   * Service name
   */
  name: string;
  
  /**
   * Service version
   */
  version?: string;
  
  /**
   * Service configuration
   */
  config?: ServiceConfig;
}

/**
 * Service lifecycle events
 */
export type ServiceLifecycleEvent = 
  | 'initialized'
  | 'started'
  | 'stopped'
  | 'destroyed'
  | 'error';

/**
 * Service lifecycle handler interface
 */
export interface ServiceLifecycleHandler {
  (event: ServiceLifecycleEvent, service: BaseService): void;
}

/**
 * Service plugin interface
 */
export interface ServicePlugin {
  /**
   * Plugin name
   */
  name: string;
  
  /**
   * Plugin version
   */
  version: string;
  
  /**
   * Initialize the plugin
   */
  initialize(service: BaseService): void;
  
  /**
   * Destroy the plugin
   */
  destroy(service: BaseService): void;
}

/**
 * Service middleware interface
 */
export interface ServiceMiddleware {
  /**
   * Middleware name
   */
  name: string;
  
  /**
   * Execute before the service method
   */
  before?(context: any): Promise<void> | void;
  
  /**
   * Execute after the service method
   */
  after?(context: any, result: any): Promise<void> | void;
  
  /**
   * Execute when an error occurs
   */
  onError?(context: any, error: any): Promise<void> | void;
}

/**
 * Service context interface
 */
export interface ServiceContext {
  /**
   * Request ID
   */
  requestId: string;
  
  /**
   * User ID
   */
  userId?: string;
  
  /**
   * Timestamp
   */
  timestamp: Date;
  
  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Service validator interface
 */
export interface ServiceValidator<T> {
  /**
   * Validate input data
   */
  validateInput(data: any): { valid: boolean; errors: string[] };
  
  /**
   * Validate output data
   */
  validateOutput(data: T): { valid: boolean; errors: string[] };
}

/**
 * Service transformer interface
 */
export interface ServiceTransformer<T, U> {
  /**
   * Transform input data
   */
  transformInput(data: T): U;
  
  /**
   * Transform output data
   */
  transformOutput(data: U): T;
}

/**
 * Service cache interface
 */
export interface ServiceCache {
  /**
   * Get cached data
   */
  get<T>(key: string): T | null;
  
  /**
   * Set cached data
   */
  set<T>(key: string, value: T, ttl?: number): void;
  
  /**
   * Delete cached data
   */
  delete(key: string): void;
  
  /**
   * Clear all cached data
   */
  clear(): void;
  
  /**
   * Check if key exists in cache
   */
  has(key: string): boolean;
}

/**
 * Service logger interface
 */
export interface ServiceLogger {
  /**
   * Log debug message
   */
  debug(message: string, ...args: any[]): void;
  
  /**
   * Log info message
   */
  info(message: string, ...args: any[]): void;
  
  /**
   * Log warning message
   */
  warn(message: string, ...args: any[]): void;
  
  /**
   * Log error message
   */
  error(message: string, ...args: any[]): void;
}

/**
 * Service metrics collector interface
 */
export interface ServiceMetricsCollector {
  /**
   * Record a metric
   */
  record(metric: string, value: number, tags?: Record<string, string>): void;
  
  /**
   * Increment a counter
   */
  increment(counter: string, tags?: Record<string, string>): void;
  
  /**
   * Record a timing
   */
  timing(timer: string, duration: number, tags?: Record<string, string>): void;
  
  /**
   * Get metrics
   */
  getMetrics(): Record<string, any>;
}

/**
 * Service health checker interface
 */
export interface ServiceHealthChecker {
  /**
   * Check service health
   */
  check(): Promise<ServiceHealth>;
  
  /**
   * Get health check interval
   */
  getInterval(): number;
}

/**
 * Service configuration validator interface
 */
export interface ServiceConfigValidator {
  /**
   * Validate service configuration
   */
  validate(config: ServiceConfig): { valid: boolean; errors: string[] };
}

/**
 * Service factory registry interface
 */
export interface ServiceFactoryRegistry {
  /**
   * Register a service factory
   */
  register<T extends BaseService>(name: string, factory: ServiceFactory<T>): void;
  
  /**
   * Get a service factory
   */
  get<T extends BaseService>(name: string): ServiceFactory<T> | null;
  
  /**
   * Check if a service factory is registered
   */
  has(name: string): boolean;
  
  /**
   * Unregister a service factory
   */
  unregister(name: string): void;
  
  /**
   * Get all registered service factory names
   */
  getFactories(): string[];
}

/**
 * Service dependency resolver interface
 */
export interface ServiceDependencyResolver {
  /**
   * Resolve service dependencies
   */
  resolve(dependencies: ServiceDependency[]): Promise<BaseService[]>;
  
  /**
   * Check if dependencies are satisfied
   */
  check(dependencies: ServiceDependency[]): Promise<boolean>;
}

/**
 * Service event emitter interface
 */
export interface ServiceEventEmitter {
  /**
   * Emit an event
   */
  emit(event: ServiceEvent, data: any): void;
  
  /**
   * Subscribe to an event
   */
  on(event: ServiceEvent, handler: ServiceEventHandler): ServiceSubscription;
  
  /**
   * Unsubscribe from an event
   */
  off(event: ServiceEvent, handler: ServiceEventHandler): void;
  
  /**
   * Get all event handlers for an event
   */
  getHandlers(event: ServiceEvent): ServiceEventHandler[];
}

/**
 * Service lifecycle manager interface
 */
export interface ServiceLifecycleManager {
  getManager(): ServiceLifecycleManager;
  setManager(manager: any): void;
  initialize(service: BaseService): Promise<void>;
  start(service: BaseService): Promise<void>;
  stop(service: BaseService): Promise<void>;
  destroy(service: BaseService): Promise<void>;
  getStatus(service: BaseService): 'initialized' | 'started' | 'stopped' | 'destroyed';
}

/**
 * Service plugin manager interface
 */
export interface ServicePluginManager {
  getManager(): ServicePluginManager;
  setManager(manager: any): void;
  install(plugin: ServicePlugin): void;
  uninstall(pluginName: string): void;
  getPlugins(): ServicePlugin[];
  isInstalled(pluginName: string): boolean;
}

/**
 * Service middleware manager interface
 */
export interface ServiceMiddlewareManager {
  getManager(): ServiceMiddlewareManager;
  setManager(manager: any): void;
  add(middleware: ServiceMiddleware): void;
  remove(middlewareName: string): void;
  getMiddleware(): ServiceMiddleware[];
  execute(context: any, next: () => Promise<any>): Promise<any>;
}

/**
 * Service context manager interface
 */
export interface ServiceContextManager {
  getManager(): ServiceContextManager;
  setManager(manager: any): void;
  create(userId?: string, metadata?: Record<string, any>): ServiceContext;
  getCurrent(): ServiceContext | null;
  setCurrent(context: ServiceContext): void;
  clear(): void;
}

/**
 * Service validator manager interface
 */
export interface ServiceValidatorManager {
  getManager(): ServiceValidatorManager;
  setManager(manager: any): void;
  add(validator: ServiceValidator<any>): void;
  remove(validatorName: string): void;
  validate<T>(data: T, validatorName: string): { valid: boolean; errors: string[] };
}

/**
 * Service transformer manager interface
 */
export interface ServiceTransformerManager {
  getManager(): ServiceTransformerManager;
  setManager(manager: any): void;
  add<T, U>(transformer: ServiceTransformer<T, U>): void;
  remove(transformerName: string): void;
  transform<T, U>(data: T, transformerName: string): U;
}

/**
 * Service cache manager interface
 */
export interface ServiceCacheManager {
  getManager(): ServiceCacheManager;
  setManager(manager: any): void;
  getCache(): ServiceCache;
  setCache(cache: ServiceCache): void;
  clear(): void;
}

/**
 * Service logger manager interface
 */
export interface ServiceLoggerManager {
  getManager(): ServiceLoggerManager;
  setManager(manager: any): void;
  getLogger(): ServiceLogger;
  setLogger(logger: ServiceLogger): void;
}

/**
 * Service metrics manager interface
 */
export interface ServiceMetricsManager {
  getManager(): ServiceMetricsManager;
  setManager(manager: any): void;
  getCollector(): ServiceMetricsCollector;
  setCollector(collector: ServiceMetricsCollector): void;
  getMetrics(): Record<string, any>;
}

/**
 * Service health manager interface
 */
export interface ServiceHealthManager {
  getManager(): ServiceHealthManager;
  setManager(manager: any): void;
  getChecker(): ServiceHealthChecker;
  setChecker(checker: ServiceHealthChecker): void;
  check(): Promise<ServiceHealth>;
}

/**
 * Service configuration manager interface
 */
export interface ServiceConfigManager {
  getManager(): ServiceConfigManager;
  setManager(manager: any): void;
  getValidator(): ServiceConfigValidator;
  setValidator(validator: ServiceConfigValidator): void;
  validate(config: ServiceConfig): { valid: boolean; errors: string[] };
}

/**
 * Service factory manager interface
 */
export interface ServiceFactoryManager {
  getManager(): ServiceFactoryManager;
  setManager(manager: any): void;
  getRegistry(): ServiceFactoryRegistry;
  setRegistry(registry: ServiceFactoryRegistry): void;
  register<T extends BaseService>(name: string, factory: ServiceFactory<T>): void;
  get<T extends BaseService>(name: string): ServiceFactory<T> | null;
}

/**
 * Service dependency manager interface
 */
export interface ServiceDependencyManager {
  getManager(): ServiceDependencyManager;
  setManager(manager: any): void;
  getResolver(): ServiceDependencyResolver;
  setResolver(resolver: ServiceDependencyResolver): void;
  resolve(dependencies: ServiceDependency[]): Promise<BaseService[]>;
}

/**
 * Service event manager interface
 */
export interface ServiceEventManager {
  getManager(): ServiceEventManager;
  setManager(manager: any): void;
  getEmitter(): ServiceEventEmitter;
  setEmitter(emitter: ServiceEventEmitter): void;
  emit(event: ServiceEvent, data: any): void;
  on(event: ServiceEvent, handler: ServiceEventHandler): ServiceSubscription;
}
