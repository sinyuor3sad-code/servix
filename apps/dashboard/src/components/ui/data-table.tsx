'use client';

import * as React from 'react';
import { Search, ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './table';
import { Input } from './input';
import { Button } from './button';
import { Spinner } from './spinner';
import { EmptyState } from './empty-state';

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
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
  className,
}: DataTableProps<T>): React.ReactElement {
  const [searchQuery, setSearchQuery] = React.useState('');

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>): void {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch?.(query);
  }

  return (
    <div className={cn('w-full space-y-4', className)}>
      {searchable && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            placeholder={searchPlaceholder}
            className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] ps-10 pe-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : data.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
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
                        : String((row as Record<string, unknown>)[col.key] ?? '')}
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
