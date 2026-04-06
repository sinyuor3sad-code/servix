'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

function Dialog({ open, onOpenChange, children }: DialogProps): React.ReactElement | null {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  React.useEffect(() => {
    function handleEscape(e: KeyboardEvent): void {
      if (e.key === 'Escape') onOpenChange(false);
    }
    if (open) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-[6px] animate-fade-in"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div className="relative z-50 w-full max-w-lg animate-cinematic">
        {children}
      </div>
    </div>
  );
}

function DialogContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div
      className={cn(
        'mx-4 rounded-[var(--radius-xl)] border border-[var(--glass-border)] bg-[var(--card)] p-6 shadow-[var(--shadow-2xl)]',
        'backdrop-blur-sm',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface DialogCloseProps {
  onClose: () => void;
  className?: string;
}

function DialogClose({ onClose, className }: DialogCloseProps): React.ReactElement {
  return (
    <button
      onClick={onClose}
      className={cn(
        'absolute top-4 end-4 rounded-[var(--radius-sm)] p-1.5 text-[var(--muted-foreground)]',
        'transition-all duration-[var(--duration-fast)]',
        'hover:text-[var(--foreground)] hover:bg-[var(--muted)]',
        'focus:outline-none focus:ring-2 focus:ring-[var(--ring)]',
        className
      )}
      aria-label="إغلاق"
    >
      <X className="h-4 w-4" />
    </button>
  );
}

function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div
      className={cn('mb-5 flex flex-col gap-1.5', className)}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>): React.ReactElement {
  return (
    <h2
      className={cn(
        'text-lg font-bold text-[var(--foreground)] tracking-tight',
        className
      )}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>): React.ReactElement {
  return (
    <p
      className={cn('text-sm text-[var(--muted-foreground)] leading-relaxed', className)}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div
      className={cn('mt-6 flex justify-end gap-2.5', className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogContent,
  DialogClose,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
};
