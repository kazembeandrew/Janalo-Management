import type { ServiceError, ServiceResult } from '@/services/_shared/types';

export function ok<T>(data: T): ServiceResult<T> {
  return { data, error: null, success: true };
}

export function fail(message: string, code?: string, details?: string): ServiceResult<null> {
  return {
    data: null,
    error: {
      message,
      code,
      details,
    },
    success: false,
  };
}

export function toServiceError(error: unknown, fallbackMessage: string): ServiceError {
  if (typeof error === 'object' && error !== null) {
    const maybeMessage = 'message' in error ? error.message : undefined;
    const maybeCode = 'code' in error ? error.code : undefined;
    const maybeDetails = 'details' in error ? error.details : undefined;

    return {
      message: typeof maybeMessage === 'string' && maybeMessage.length > 0 ? maybeMessage : fallbackMessage,
      code: typeof maybeCode === 'string' ? maybeCode : undefined,
      details: typeof maybeDetails === 'string' ? maybeDetails : undefined,
    };
  }

  if (typeof error === 'string' && error.length > 0) {
    return { message: error };
  }

  return { message: fallbackMessage };
}