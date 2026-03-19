import { type HTMLAttributes, type ReactElement } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-[var(--brand-primary)] text-white',
        secondary: 'bg-[var(--muted)] text-[var(--foreground)]',
        destructive: 'bg-red-100 text-red-700',
        outline: 'border border-[var(--border)] text-[var(--foreground)] bg-transparent',
        success: 'bg-emerald-100 text-emerald-700',
        warning: 'bg-amber-100 text-amber-700',
        info: 'bg-sky-100 text-sky-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps): ReactElement {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
export type { BadgeProps };
