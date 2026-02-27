import React, { Suspense } from 'react';
import { LoadingPage } from '@/components/ui/LoadingSpinner';

// Generic lazy loading wrapper with loading fallback
export function lazyLoad(
  importFunc: () => Promise<any>,
  fallback?: React.ReactNode
) {
  const LazyComponent = React.lazy(async () => {
    const module = await importFunc();
    // Handle both default exports and named exports
    if ('default' in module) {
      return module;
    } else {
      // For named exports, extract the first exported component
      const component = Object.values(module)[0];
      return { default: component };
    }
  });
  
  return function LazyWrapper(props: any) {
    return (
      <Suspense fallback={fallback || <LoadingPage />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

// Preload utility for critical components
export function preloadComponent(importFunc: () => Promise<any>) {
  importFunc();
}

// Intersection Observer based lazy loading for below-the-fold content
export function useIntersectionObserver(
  ref: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = React.useState(false);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref, options]);

  return isIntersecting;
}
