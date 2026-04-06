'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 font-medium transition-all',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    'active:scale-[0.97] press-effect',
  ].join(' '),
  {
    variants: {
      variant: {
        default: [
          'bg-[var(--brand-primary)] text-white',
          'shadow-[var(--shadow-md)]',
          'hover:bg-[var(--brand-primary-dark)] hover:shadow-[var(--shadow-lg)]',
          'hover:brightness-110',
          'rounded-[var(--radius)]',
        ].join(' '),
        destructive: [
          'bg-gradient-to-b from-red-500 to-red-600 text-white',
          'shadow-[0_2px_8px_rgba(220,38,38,0.25)]',
          'hover:from-red-600 hover:to-red-700 hover:shadow-[0_4px_16px_rgba(220,38,38,0.3)]',
          'rounded-[var(--radius)]',
        ].join(' '),
        outline: [
          'border border-[var(--border)] bg-transparent text-[var(--foreground)]',
          'hover:bg-[var(--muted)] hover:border-[var(--muted-foreground)]/30',
          'hover:shadow-[var(--shadow)]',
          'rounded-[var(--radius)]',
        ].join(' '),
        secondary: [
          'bg-[var(--muted)] text-[var(--foreground)]',
          'shadow-[var(--shadow-xs)]',
          'hover:bg-[var(--muted)]/80 hover:shadow-[var(--shadow)]',
          'rounded-[var(--radius)]',
        ].join(' '),
        ghost: [
          'text-[var(--foreground)]',
          'hover:bg-[var(--muted)]',
          'rounded-[var(--radius)]',
        ].join(' '),
        link: [
          'text-[var(--brand-primary)] underline-offset-4',
          'hover:underline hover:brightness-110',
        ].join(' '),
      },
      size: {
        default: 'h-10 px-5 py-2 text-sm',
        sm: 'h-8 px-3.5 text-xs',
        lg: 'h-12 px-7 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, children, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
export type { ButtonProps };
