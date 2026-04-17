'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', label, error, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[var(--foreground)]"
          >
            {label}
          </label>
        )}
        <input
          type={type}
          id={inputId}
          className={cn(
            'flex h-10 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3.5 py-2 text-sm text-[var(--foreground)]',
            'placeholder:text-[var(--muted-foreground)]/60',
            'transition-all duration-[var(--duration-normal)] ease-[var(--ease-out-expo)]',
            'focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/40 focus:border-[var(--brand-primary)] focus:shadow-[var(--glow-primary)]',
            'hover:border-[var(--muted-foreground)]/30',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-red-500 focus:ring-red-500/40 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]',
            className
          )}
          ref={ref}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
        {error && (
          <p
            id={`${inputId}-error`}
            className="text-xs text-red-500 font-medium"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };
export type { InputProps };
