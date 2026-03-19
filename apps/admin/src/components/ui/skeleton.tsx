import { type HTMLAttributes, type ReactElement } from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'rectangular' | 'circular' | 'text';
}

function Skeleton({
  className,
  variant = 'rectangular',
  ...props
}: SkeletonProps): ReactElement {
  return (
    <div
      className={cn(
        'animate-pulse bg-[var(--muted)]',
        variant === 'rectangular' && 'rounded-lg',
        variant === 'circular' && 'rounded-full',
        variant === 'text' && 'h-4 w-full rounded',
        className
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

export { Skeleton };
export type { SkeletonProps };
