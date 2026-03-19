'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--brand-primary)] text-white shadow-sm hover:bg-[var(--brand-primary-dark)]',
        destructive:
          'bg-red-600 text-white shadow-sm hover:bg-red-700',
        outline:
          'border border-[var(--border)] bg-transparent hover:bg-[var(--muted)] text-[var(--foreground)]',
        secondary:
          'bg-[var(--muted)] text-[var(--foreground)] shadow-sm hover:bg-[var(--muted)]/80',
        ghost:
          'hover:bg-[var(--muted)] text-[var(--foreground)]',
        link:
          'text-[var(--brand-primary)] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-6 text-base',
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
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
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
