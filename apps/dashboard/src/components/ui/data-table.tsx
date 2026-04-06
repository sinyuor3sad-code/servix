'use client';

import * as React from 'react';
import { Search, ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './table';
import { Button } from './button';
import { Spinner } from './spinner';
import { EmptyState } from './empty-state';

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
  /** If true, this column is shown as the card title on mobile */
  primary?: boolean;
  /** If true, hide this column in mobile card view */
  hideMobile?: boolean;
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
  /** Custom mobile card renderer — if provided, overrides default card layout */
  mobileCard?: (row: T) => React.ReactNode;
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
  mobileCard,
}: DataTableProps<T>): React.ReactElement {
  const [searchQuery, setSearchQuery] = React.useState('');

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>): void {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch?.(query);
  }

  // Separate columns into primary, visible, and actions for mobile
  const primaryCol = columns.find((c) => c.primary);
  const actionCol = columns.find((c) => c.key === 'actions');
  const mobileVisibleCols = columns.filter(
    (c) => !c.primary && !c.hideMobile && c.key !== 'actions'
  );

  return (
    <div className={cn('w-full space-y-4', className)}>
      {searchable && (
        <div className="relative">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            placeholder={searchPlaceholder}
            className={cn(
              'flex h-12 w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] ps-10 pe-4 py-2 text-sm text-[var(--foreground)]',
              'placeholder:text-[var(--muted-foreground)]/60',
              'transition-all duration-[var(--duration-normal)] ease-[var(--ease-out-expo)]',
              'focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/40 focus:border-[var(--brand-primary)] focus:shadow-[var(--glow-primary)]',
              'hover:border-[var(--muted-foreground)]/30',
              'sm:max-w-sm sm:h-11'
            )}
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : data.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <>
          {/* ── Desktop: Table View ── */}
          <div className="hidden sm:block rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-[var(--shadow)]">
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

          {/* ── Mobile: Premium Card View ── */}
          <div className="sm:hidden space-y-3">
            {data.map((row) => (
              <div
                key={keyExtractor(row)}
                className="mobile-card rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow)] active:shadow-[var(--shadow-md)] transition-all"
              >
                {mobileCard ? (
                  mobileCard(row)
                ) : (
                  <div className="space-y-3">
                    {/* Primary row — name/title prominently */}
                    {primaryCol && (
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-bold text-[var(--foreground)] min-w-0 flex-1 truncate">
                          {primaryCol.render
                            ? primaryCol.render(row)
                            : String((row as Record<string, unknown>)[primaryCol.key] ?? '')}
                        </div>
                      </div>
                    )}

                    {/* Secondary info — stacked key-value pairs */}
                    {mobileVisibleCols.length > 0 && (
                      <div className="space-y-2 py-1">
                        {mobileVisibleCols.map((col) => {
                          const value = col.render
                            ? col.render(row)
                            : String((row as Record<string, unknown>)[col.key] ?? '');

                          return (
                            <div key={col.key} className="flex items-center justify-between gap-3">
                              <span className="text-xs font-semibold text-[var(--muted-foreground)] shrink-0">
                                {col.header}
                              </span>
                              <div className="text-[13px] text-[var(--foreground)] text-end truncate">
                                {value}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Actions footer */}
                    {actionCol && (
                      <div className="pt-2 border-t border-[var(--border)] flex items-center justify-end gap-2">
                        {actionCol.render
                          ? actionCol.render(row)
                          : null}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1 pt-2">
          <p className="text-xs sm:text-sm text-[var(--muted-foreground)] font-medium">
            صفحة {page} من {totalPages}
          </p>
          <div className="flex items-center gap-1.5">
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
