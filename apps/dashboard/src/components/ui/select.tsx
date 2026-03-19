'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, id, ...props }, ref) => {
    const selectId = id || React.useId();

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-[var(--foreground)]"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            className={cn(
              'flex h-10 w-full appearance-none rounded-lg border border-[var(--border)] bg-[var(--background)] pe-10 ps-3 py-2 text-sm text-[var(--foreground)] transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-red-500 focus:ring-red-500',
              className
            )}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? `${selectId}-error` : undefined}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 end-3 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
        </div>
        {error && (
          <p
            id={`${selectId}-error`}
            className="text-xs text-red-500"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);
Select.displayName = 'Select';

export { Select };
export type { SelectProps, SelectOption };
