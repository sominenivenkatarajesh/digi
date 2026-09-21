import React from 'react';
import { cn } from '@/lib/utils';

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  size?: 'default' | 'narrow' | 'wide';
}

export function Container({
  children,
  className,
  size = 'default',
  ...props
}: ContainerProps) {
  const maxWidths = {
    narrow: 'max-w-4xl',
    default: 'max-w-6xl',
    wide: 'max-w-7xl',
  };

  return (
    <div
      className={cn(
        'mx-auto w-full px-4 sm:px-6 lg:px-8',
        maxWidths[size],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
