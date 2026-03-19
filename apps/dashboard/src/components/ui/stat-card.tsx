import * as React from 'react';
import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CountUp } from './count-up';

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  label: string;
  value: string | number;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  animateValue?: boolean;
  valueFormat?: (n: number) => string;
}

function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  animateValue = false,
  valueFormat,
  className,
  ...props
}: StatCardProps): React.ReactElement {
  const displayValue =
    animateValue && typeof value === 'number' ? (
      <CountUp value={value} format={valueFormat} />
    ) : (
      value
    );

  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--border)] bg-[var(--background)] p-6 shadow-sm',
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--muted-foreground)]">
          {label}
        </p>
        {Icon && (
          <div className="rounded-lg bg-[var(--muted)] p-2">
            <Icon className="h-4 w-4 text-[var(--muted-foreground)]" />
          </div>
        )}
      </div>
      <div className="mt-3 flex items-end gap-2">
        <p className="text-2xl font-bold text-[var(--foreground)]">{displayValue}</p>
        {trend && (
          <span
            className={cn(
              'mb-0.5 inline-flex items-center gap-0.5 text-xs font-medium',
              trend.direction === 'up'
                ? 'text-emerald-600'
                : 'text-red-600'
            )}
          >
            {trend.direction === 'up' ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {trend.value}%
          </span>
        )}
      </div>
    </div>
  );
}

export { StatCard };
export type { StatCardProps };
