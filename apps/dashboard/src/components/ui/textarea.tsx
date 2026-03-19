'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const textareaId = id || React.useId();

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-[var(--foreground)]"
          >
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          className={cn(
            'flex min-h-[80px] w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'resize-y',
            error && 'border-red-500 focus:ring-red-500',
            className
          )}
          ref={ref}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${textareaId}-error` : undefined}
          {...props}
        />
        {error && (
          <p
            id={`${textareaId}-error`}
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
Textarea.displayName = 'Textarea';

export { Textarea };
export type { TextareaProps };
