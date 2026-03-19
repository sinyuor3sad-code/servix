import { type HTMLAttributes, type ReactElement } from 'react';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  label: string;
  value: string | number;
  iconColor?: string;
}

function StatCard({
  icon: Icon,
  label,
  value,
  iconColor,
  className,
  ...props
}: StatCardProps): ReactElement {
  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm',
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--muted-foreground)]">
          {label}
        </p>
        {Icon && (
          <div className={cn('rounded-lg p-2', iconColor || 'bg-[var(--primary-50)] text-[var(--brand-primary)]')}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

export { StatCard };
export type { StatCardProps };
