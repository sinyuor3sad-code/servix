import { forwardRef, type HTMLAttributes, type ReactElement } from 'react';
import { cn } from '@/lib/utils';

const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref): ReactElement => (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm',
        className
      )}
      {...props}
    />
  )
);
Card.displayName = 'Card';

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref): ReactElement => (
    <div
      ref={ref}
      className={cn('flex flex-col gap-1.5 p-6', className)}
      {...props}
    />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref): ReactElement => (
    <h3
      ref={ref}
      className={cn(
        'text-lg font-semibold leading-none tracking-tight text-[var(--foreground)]',
        className
      )}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref): ReactElement => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

export { Card, CardHeader, CardTitle, CardContent };
