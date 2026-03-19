import { type HTMLAttributes, type ReactNode, type ReactElement } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  actions?: ReactNode;
}

function PageHeader({
  title,
  description,
  actions,
  className,
  ...props
}: PageHeaderProps): ReactElement {
  return (
    <div
      className={cn(
        'mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
      {...props}
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-[var(--muted-foreground)]">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

export { PageHeader };
export type { PageHeaderProps };
