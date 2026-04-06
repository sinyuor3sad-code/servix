'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface DropdownMenuProps {
  children: React.ReactNode;
}

function DropdownMenu({ children }: DropdownMenuProps): React.ReactElement {
  return <div className="relative inline-block">{children}</div>;
}

interface DropdownMenuTriggerProps {
  children: React.ReactNode;
  className?: string;
  asChild?: boolean;
}

const DropdownMenuContext = React.createContext<{
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}>({ open: false, setOpen: () => {} });

function DropdownMenuRoot({
  children,
}: DropdownMenuProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function handleClick(e: MouseEvent): void {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-dropdown]')) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [open]);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block" data-dropdown>
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
}

function DropdownMenuTrigger({
  children,
  className,
}: DropdownMenuTriggerProps): React.ReactElement {
  const { open, setOpen } = React.useContext(DropdownMenuContext);

  return (
    <button
      type="button"
      className={cn('inline-flex items-center', className)}
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      aria-haspopup="menu"
    >
      {children}
    </button>
  );
}

interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: 'start' | 'end' | 'center';
}

function DropdownMenuContent({
  className,
  align = 'end',
  children,
  ...props
}: DropdownMenuContentProps): React.ReactElement | null {
  const { open } = React.useContext(DropdownMenuContext);

  if (!open) return null;

  return (
    <div
      className={cn(
        'absolute top-full z-50 mt-2 min-w-[10rem] overflow-hidden',
        'rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-1.5',
        'shadow-[var(--shadow-xl)]',
        'animate-scale-in',
        align === 'end' && 'end-0',
        align === 'start' && 'start-0',
        align === 'center' && 'start-1/2 -translate-x-1/2',
        className
      )}
      role="menu"
      {...props}
    >
      {children}
    </div>
  );
}

interface DropdownMenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  destructive?: boolean;
}

function DropdownMenuItem({
  className,
  destructive,
  ...props
}: DropdownMenuItemProps): React.ReactElement {
  const { setOpen } = React.useContext(DropdownMenuContext);

  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-sm',
        'transition-colors duration-[var(--duration-fast)]',
        'hover:bg-[var(--muted)] focus:bg-[var(--muted)] focus:outline-none',
        destructive
          ? 'text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30'
          : 'text-[var(--foreground)]',
        className
      )}
      role="menuitem"
      onClick={(e) => {
        props.onClick?.(e);
        setOpen(false);
      }}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
}: {
  className?: string;
}): React.ReactElement {
  return (
    <div
      className={cn('my-1.5 h-px bg-[var(--border)]', className)}
      role="separator"
    />
  );
}

function DropdownMenuLabel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div
      className={cn(
        'px-3 py-2 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider',
        className
      )}
      {...props}
    />
  );
}

export {
  DropdownMenuRoot as DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
};
