'use client';

import { useState, type ChangeEvent, type ReactNode, type ReactElement } from 'react';
import { Search, ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './table';
import { Button } from './button';

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  searchable?: boolean;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  actions?: ReactNode;
  className?: string;
}

function DataTable<T>({
  columns,
  data,
  keyExtractor,
  searchable,
  searchPlaceholder = 'بحث...',
  onSearch,
  loading,
  emptyTitle = 'لا توجد بيانات',
  emptyDescription,
  page = 1,
  totalPages = 1,
  onPageChange,
  actions,
  className,
}: DataTableProps<T>): ReactElement {
  const [searchQuery, setSearchQuery] = useState('');

  function handleSearch(e: ChangeEvent<HTMLInputElement>): void {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch?.(query);
  }

  return (
    <div className={cn('w-full space-y-4', className)}>
      {(searchable || actions) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {searchable && (
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearch}
                placeholder={searchPlaceholder}
                className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] ps-10 pe-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--muted)] border-t-[var(--brand-primary)]" />
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] py-16">
          <p className="text-lg font-medium text-[var(--foreground)]">{emptyTitle}</p>
          {emptyDescription && (
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">{emptyDescription}</p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--card)]">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col.key} className={col.className}>
                    {col.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={keyExtractor(row)}>
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {col.render
                        ? col.render(row)
                        : String((row as unknown as Record<string, unknown>)[col.key] ?? '')}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-sm text-[var(--muted-foreground)]">
            صفحة {page} من {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
              aria-label="الصفحة السابقة"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages}
              aria-label="الصفحة التالية"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export { DataTable };
export type { DataTableProps, Column };
