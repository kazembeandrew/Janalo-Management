export interface ServiceError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface ServiceSuccess<T> {
  success: true;
  data: T;
}

export type ServiceResult<T> = ServiceSuccess<T> | ServiceError;

/**
 * Centralized error handler for Supabase operations
 * Converts Supabase errors into standardized format
 */
export const handleSupabaseError = (error: any, context?: string): ServiceError => {
  console.error(`[Service Error${context ? ` - ${context}` : ''}]:`, error);
  
  // Handle Supabase-specific errors
  if (error?.code) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message || 'Database operation failed',
        details: error.details || error.hint,
      },
    };
  }
  
  // Handle generic errors
  return {
    success: false,
    error: {
      code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      details: error,
    },
  };
};

/**
 * Async operation wrapper with standardized error handling
 */
export async function wrapAsyncOperation<T>(
  operation: () => Promise<T>,
  errorMessage?: string
): Promise<ServiceResult<T>> {
  try {
    const result = await operation();
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    return handleSupabaseError(error, errorMessage);
  }
}

/**
 * Validate required fields in an object
 */
export function validateRequiredFields<T extends Record<string, any>>(
  obj: T,
  requiredFields: Array<keyof T>
): Array<keyof T> {
  return requiredFields.filter(field => obj[field] === undefined || obj[field] === null);
}
