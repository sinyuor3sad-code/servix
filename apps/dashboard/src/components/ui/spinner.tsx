import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-10 w-10',
} as const;

function Spinner({
  size = 'md',
  className,
  ...props
}: SpinnerProps): React.ReactElement {
  return (
    <div
      role="status"
      aria-label="جارٍ التحميل"
      className={cn('flex items-center justify-center', className)}
      {...props}
    >
      <Loader2
        className={cn('animate-spin text-[var(--brand-primary)]', sizeClasses[size])}
      />
      <span className="sr-only">جارٍ التحميل</span>
    </div>
  );
}

export { Spinner };
export type { SpinnerProps };
