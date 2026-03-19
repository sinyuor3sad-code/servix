import * as React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'rectangular' | 'circular' | 'text' | 'card';
}

function Skeleton({
  className,
  variant = 'rectangular',
  ...props
}: SkeletonProps): React.ReactElement {
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-[var(--muted)]',
        'before:absolute before:inset-0 before:translate-x-[-100%] before:animate-[shimmer_1.8s_ease-in-out_infinite]',
        'before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent',
        variant === 'rectangular' && 'rounded-lg',
        variant === 'circular' && 'rounded-full',
        variant === 'text' && 'h-4 w-full rounded',
        variant === 'card' && 'rounded-xl',
        className
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

export { Skeleton };
export type { SkeletonProps };
