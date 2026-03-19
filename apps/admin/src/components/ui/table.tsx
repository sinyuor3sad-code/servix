import { forwardRef, type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes, type ReactElement } from 'react';
import { cn } from '@/lib/utils';

const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref): ReactElement => (
    <div className="relative w-full overflow-auto">
      <table
        ref={ref}
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  )
);
Table.displayName = 'Table';

const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref): ReactElement => (
    <thead
      ref={ref}
      className={cn('border-b border-[var(--border)] [&_tr]:border-b', className)}
      {...props}
    />
  )
);
TableHeader.displayName = 'TableHeader';

const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref): ReactElement => (
    <tbody
      ref={ref}
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  )
);
TableBody.displayName = 'TableBody';

const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref): ReactElement => (
    <tr
      ref={ref}
      className={cn(
        'border-b border-[var(--border)] transition-colors hover:bg-[var(--muted)]/50',
        className
      )}
      {...props}
    />
  )
);
TableRow.displayName = 'TableRow';

const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref): ReactElement => (
    <th
      ref={ref}
      className={cn(
        'h-12 px-4 text-start align-middle font-medium text-[var(--muted-foreground)]',
        className
      )}
      {...props}
    />
  )
);
TableHead.displayName = 'TableHead';

const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref): ReactElement => (
    <td
      ref={ref}
      className={cn(
        'p-4 align-middle text-[var(--foreground)]',
        className
      )}
      {...props}
    />
  )
);
TableCell.displayName = 'TableCell';

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
