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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'flex flex-col items-center justify-center px-6 py-20 text-center',
        className
      )}
    >
      {Icon && (
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="relative mb-5"
        >
          {/* Ambient glow behind icon */}
          <div className="absolute inset-0 rounded-full bg-[var(--brand-primary)] opacity-[0.06] blur-xl scale-150 pointer-events-none" />
          <div className="relative rounded-2xl bg-[var(--muted)] p-5">
            <Icon className="h-8 w-8 text-[var(--muted-foreground)]" />
          </div>
        </motion.div>
      )}
      <h3 className="text-lg font-bold text-[var(--foreground)]">
        {title}
      </h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-[var(--muted-foreground)] leading-relaxed">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-5" size="sm">
          {actionLabel}
        </Button>
      )}
    </motion.div>
  );
}

export { EmptyState };
export type { EmptyStateProps };
