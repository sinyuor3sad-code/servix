/**
 * Canonical paginated response contract.
 *
 * ALL list endpoints in the SERVIX API MUST return this exact shape.
 * The frontend `PaginatedResponse<T>` interface mirrors this 1:1.
 *
 * @see apps/dashboard/src/types/index.ts  — frontend mirror
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Build a standardised paginated response from a data array and count.
 *
 * Usage in any service:
 *
 *   return paginate(employees, total, query.page, query.perPage);
 */
export function paginate<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

/**
 * Extract effective page-size from a DTO that may carry `limit` OR `perPage`.
 * Frontend sends `limit`; PaginationDto defaults to `perPage`.
 */
export function effectiveLimit(query: { limit?: number; perPage?: number }): number {
  return query.limit ?? query.perPage ?? 20;
}
