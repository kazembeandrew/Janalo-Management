import { useState, useEffect } from 'react';

/**
 * Hook for animating numbers from 0 to a target value with easing
 * @param target - The target number to count up to
 * @param duration - Animation duration in milliseconds (default: 1200ms)
 * @returns The current animated value
 */
export function useCountUp(target: number, duration: number = 1200): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    // Reset to 0 when target changes
    setValue(0);
    
    const start = performance.now();
    
    const raf = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      // easeOutCubic easing function for smooth animation
      const ease = 1 - Math.pow(1 - t, 3);
      
      setValue(Math.round(ease * target));
      
      // Continue animation until complete
      if (t < 1) {
        requestAnimationFrame(raf);
      }
    };
    
    requestAnimationFrame(raf);
  }, [target, duration]);

  return value;
}
