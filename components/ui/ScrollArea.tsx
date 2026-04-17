import React from 'react';
import { cn } from '@/utils/cn';

export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  height?: string | number;
  width?: string | number;
}

export const ScrollArea: React.FC<ScrollAreaProps> = ({
  children,
  className,
  height = 'auto',
  width = 'auto',
  ...props
}) => {
  return (
    <div
      className={cn(
        'overflow-auto',
        className
      )}
      style={{
        height: typeof height === 'number' ? `${height}px` : height,
        width: typeof width === 'number' ? `${width}px` : width,
      }}
      {...props}
    >
      {children}
    </div>
  );
};