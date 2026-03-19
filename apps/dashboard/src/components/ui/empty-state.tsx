'use client';

import * as React from 'react';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { motion } from 'motion/react';

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
  ...props
}: EmptyStateProps): React.ReactElement {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        'flex flex-col items-center justify-center px-6 py-16 text-center',
        className
      )}
    >
      {Icon && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.2 }}
          className="mb-4 rounded-full bg-[var(--muted)] p-4"
        >
          <Icon className="h-8 w-8 text-[var(--muted-foreground)]" />
        </motion.div>
      )}
      <h3 className="text-lg font-semibold text-[var(--foreground)]">
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-[var(--muted-foreground)]">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-4" size="sm">
          {actionLabel}
        </Button>
      )}
    </motion.div>
  );
}

export { EmptyState };
export type { EmptyStateProps };
