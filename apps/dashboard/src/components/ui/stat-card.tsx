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
        'relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6',
        'shadow-[var(--shadow)] hover:shadow-[var(--shadow-md)]',
        'transition-all duration-[var(--duration-normal)] ease-[var(--ease-out-expo)]',
        className
      )}
      {...props}
    >
      {/* Subtle ambient glow */}
      {Icon && (
        <div className="absolute -top-6 -end-6 h-20 w-20 rounded-full bg-[var(--brand-primary)] opacity-[0.03] blur-2xl pointer-events-none" />
      )}

      <div className="relative flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--muted-foreground)]">
          {label}
        </p>
        {Icon && (
          <div className="rounded-[var(--radius)] bg-[var(--muted)] p-2.5 transition-colors">
            <Icon className="h-4 w-4 text-[var(--brand-primary)]" />
          </div>
        )}
      </div>
      <div className="relative mt-3 flex items-end gap-2.5">
        <p className="text-2xl font-bold text-[var(--foreground)] tracking-tight">{displayValue}</p>
        {trend && (
          <span
            className={cn(
              'mb-0.5 inline-flex items-center gap-0.5 text-xs font-semibold rounded-full px-1.5 py-0.5',
              trend.direction === 'up'
                ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
                : 'text-red-600 bg-red-50 dark:bg-red-950/30'
            )}
          >
            {trend.direction === 'up' ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
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
