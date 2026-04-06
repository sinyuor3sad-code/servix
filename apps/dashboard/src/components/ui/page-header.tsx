import * as React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

function PageHeader({
  title,
  description,
  actions,
  className,
  ...props
}: PageHeaderProps): React.ReactElement {
  return (
    <div
      className={cn(
        'mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
      {...props}
    >
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2.5">{actions}</div>
      )}
    </div>
  );
}

export { PageHeader };
export type { PageHeaderProps };
