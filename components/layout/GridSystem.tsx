import React from 'react';
import { cn } from '@/utils/utils';

// Container component for consistent max-width and padding
export const Container: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  return (
    <div className={cn("w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", className)}>
      {children}
    </div>
  );
};

// Section component for consistent spacing
export const Section: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  return (
    <section className={cn("py-6", className)}>
      {children}
    </section>
  );
};

// Grid container component
export const Grid: React.FC<{
  children: React.ReactNode;
  className?: string;
  gap?: string;
}> = ({ children, className, gap = "gap-6" }) => {
  return (
    <div className={cn("grid grid-cols-12", gap, className)}>
      {children}
    </div>
  );
};

// Column component with responsive breakpoints
export interface ColProps {
  children: React.ReactNode;
  className?: string;
  span?: number;
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
  xxl?: number;
}

export const Col: React.FC<ColProps> = ({ 
  children, 
  className, 
  span = 12,
  xs,
  sm,
  md,
  lg,
  xl,
  xxl
}) => {
  const getClasses = () => {
    const classes = [];
    
    // Default span
    classes.push(`col-span-${span}`);
    
    // Responsive breakpoints
    if (xs) classes.push(`xs:col-span-${xs}`);
    if (sm) classes.push(`sm:col-span-${sm}`);
    if (md) classes.push(`md:col-span-${md}`);
    if (lg) classes.push(`lg:col-span-${lg}`);
    if (xl) classes.push(`xl:col-span-${xl}`);
    if (xxl) classes.push(`2xl:col-span-${xxl}`);
    
    return classes.join(' ');
  };

  return (
    <div className={cn(getClasses(), className)}>
      {children}
    </div>
  );
};

// Row component for flex layouts
export const Row: React.FC<{
  children: React.ReactNode;
  className?: string;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  direction?: 'row' | 'col' | 'row-reverse' | 'col-reverse';
  wrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  gap?: string;
}> = ({ 
  children, 
  className,
  align = 'start',
  justify = 'start',
  direction = 'row',
  wrap = 'nowrap',
  gap = 'gap-4'
}) => {
  const getClasses = () => {
    const classes = ['flex', gap];
    
    // Alignment
    classes.push(`items-${align}`);
    
    // Justification
    if (justify === 'between') classes.push('justify-between');
    else if (justify === 'around') classes.push('justify-around');
    else if (justify === 'evenly') classes.push('justify-evenly');
    else if (justify === 'center') classes.push('justify-center');
    else if (justify === 'end') classes.push('justify-end');
    else classes.push('justify-start');
    
    // Direction
    if (direction === 'col') classes.push('flex-col');
    else if (direction === 'row-reverse') classes.push('flex-row-reverse');
    else if (direction === 'col-reverse') classes.push('flex-col-reverse');
    
    // Wrap
    if (wrap === 'wrap') classes.push('flex-wrap');
    else if (wrap === 'wrap-reverse') classes.push('flex-wrap-reverse');
    else classes.push('flex-nowrap');
    
    return classes.join(' ');
  };

  return (
    <div className={cn(getClasses(), className)}>
      {children}
    </div>
  );
};

// Flex component for simple flex layouts
export const Flex: React.FC<{
  children: React.ReactNode;
  className?: string;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  direction?: 'row' | 'col';
  gap?: string;
}> = ({ 
  children, 
  className,
  align = 'start',
  justify = 'start',
  direction = 'row',
  gap = 'gap-4'
}) => {
  const getClasses = () => {
    const classes = ['flex', gap];
    
    // Alignment
    classes.push(`items-${align}`);
    
    // Justification
    if (justify === 'between') classes.push('justify-between');
    else if (justify === 'around') classes.push('justify-around');
    else if (justify === 'evenly') classes.push('justify-evenly');
    else if (justify === 'center') classes.push('justify-center');
    else if (justify === 'end') classes.push('justify-end');
    else classes.push('justify-start');
    
    // Direction
    if (direction === 'col') classes.push('flex-col');
    
    return classes.join(' ');
  };

  return (
    <div className={cn(getClasses(), className)}>
      {children}
    </div>
  );
};
