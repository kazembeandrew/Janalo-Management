import React, { useState, useEffect, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error) => void;
}

/**
 * Functional Error Boundary using error state and effect hooks
 * Alternative to class-based error boundaries for React functional components
 */
export const ErrorBoundary: React.FC<ErrorBoundaryProps> = ({ 
  children, 
  fallback,
  onError 
}) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);

  // Monitor for errors in children using error boundary pattern
  useEffect(() => {
    const errorHandler = (error: ErrorEvent) => {
      console.error('Caught error:', error.error);
      setHasError(true);
      setError(error.error as Error);
      
      if (onError) {
        onError(error.error as Error);
      }
    };

    window.addEventListener('error', errorHandler);
    
    return () => {
      window.removeEventListener('error', errorHandler);
    };
  }, [onError]);

  const handleReset = () => {
    setHasError(false);
    setError(undefined);
    window.location.reload();
  };

  if (hasError) {
    if (fallback) {
      return fallback;
    }

    return (
      <div className="flex items-center justify-center min-h-[400px] bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-center max-w-md px-4">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Something went wrong
          </h3>
          <p className="text-gray-600 mb-4">
            {error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={handleReset}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// Default fallback component for pages
export const PageErrorFallback: React.FC<{ page: string; onRetry?: () => void }> = ({ 
  page, 
  onRetry 
}) => (
  <div className="flex items-center justify-center min-h-[400px] bg-gray-50 rounded-lg border border-gray-200">
    <div className="text-center max-w-md px-4">
      <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Failed to load {page}
      </h3>
      <p className="text-gray-600 mb-4">
        We're sorry, but we couldn't load this page. Please try again.
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <RefreshCcw className="h-4 w-4 mr-2" />
          Retry
        </button>
      )}
    </div>
  </div>
);
