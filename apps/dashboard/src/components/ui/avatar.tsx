'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
} as const;

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function Avatar({
  src,
  alt = '',
  fallback,
  size = 'md',
  className,
  ...props
}: AvatarProps): React.ReactElement {
  const [imgError, setImgError] = React.useState(false);
  const showImage = src && !imgError;

  return (
    <div
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        'bg-[var(--muted)] ring-2 ring-[var(--border)] ring-offset-1 ring-offset-[var(--background)]',
        'transition-all duration-[var(--duration-fast)]',
        sizeClasses[size],
        className
      )}
      role="img"
      aria-label={alt || fallback || 'Avatar'}
      {...props}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="font-semibold text-[var(--muted-foreground)]">
          {fallback ? getInitials(fallback) : '?'}
        </span>
      )}
    </div>
  );
}

export { Avatar };
export type { AvatarProps };
