/**
 * Application Error Class
 * Standardized error handling across the application
 */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Create error from Supabase error response
   */
  static fromSupabase(error: any): AppError {
    // Handle specific Supabase error codes
    switch (error.code) {
      case 'PGRST301':
        return new AppError(
          'NOT_FOUND',
          'The requested resource was not found',
          404,
          error.details
        );
      case 'PGRST119':
        return new AppError(
          'DUPLICATE_ENTRY',
          'A record with this value already exists',
          409,
          error.details
        );
      case '23505':
        return new AppError(
          'UNIQUE_VIOLATION',
          'This entry already exists',
          409,
          error.details
        );
      case '23503':
        return new AppError(
          'FOREIGN_KEY_VIOLATION',
          'Referenced record does not exist',
          400,
          error.details
        );
      case 'JWT_EXPIRED':
        return new AppError(
          'SESSION_EXPIRED',
          'Your session has expired. Please log in again.',
          401,
          error.details
        );
      default:
        return new AppError(
          'DATABASE_ERROR',
          error.message || 'A database error occurred',
          500,
          error.details
        );
    }
  }

  /**
   * Create error from network error
   */
  static fromNetwork(error: any): AppError {
    if (!navigator.onLine) {
      return new AppError(
        'OFFLINE',
        'You are offline. Please check your internet connection.',
        0,
        error
      );
    }

    return new AppError(
      'NETWORK_ERROR',
      'A network error occurred. Please try again.',
      503,
      error
    );
  }

  /**
   * Create validation error
   */
  static validation(field: string, message: string): AppError {
    return new AppError(
      'VALIDATION_ERROR',
      `${field}: ${message}`,
      400,
      { field, message }
    );
  }

  /**
   * Convert to user-friendly message
   */
  toUserMessage(): string {
    switch (this.code) {
      case 'NOT_FOUND':
        return 'Item not found';
      case 'DUPLICATE_ENTRY':
      case 'UNIQUE_VIOLATION':
        return 'This entry already exists';
      case 'SESSION_EXPIRED':
        return 'Please log in again';
      case 'OFFLINE':
        return 'No internet connection';
      case 'VALIDATION_ERROR':
        return this.message;
      default:
        return this.message || 'An unexpected error occurred';
    }
  }
}

/**
 * Centralized error handler for services
 */
export const handleServiceError = (error: any): never => {
  // Already an AppError
  if (error instanceof AppError) {
    throw error;
  }

  // Supabase errors
  if (error?.code?.startsWith('PGRST') || error?.code === '23505' || error?.code === '23503') {
    throw AppError.fromSupabase(error);
  }

  // Network errors
  if (error?.name === 'TypeError' && error?.message === 'Failed to fetch') {
    throw AppError.fromNetwork(error);
  }

  // Generic fallback
  throw new AppError(
    'UNKNOWN_ERROR',
    'An unexpected error occurred. Please try again.',
    500,
    error
  );
};

/**
 * Check if error is a specific type
 */
export const isErrorType = (error: any, code: string): boolean => {
  return error instanceof AppError && error.code === code;
};