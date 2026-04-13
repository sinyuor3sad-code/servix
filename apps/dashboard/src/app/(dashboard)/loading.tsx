/**
 * Premium skeleton loading — renders an instant page shell with
 * shimmer animation while Next.js streams the actual page component.
 * This eliminates the "blank page with spinner" anti-pattern.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Page header skeleton */}
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-2xl skeleton-shimmer" />
        <div className="space-y-2">
          <div className="h-6 w-40 rounded-xl skeleton-shimmer" />
          <div className="h-3 w-56 rounded-lg skeleton-shimmer" style={{ animationDelay: '50ms' }} />
        </div>
      </div>

      {/* KPI cards skeleton — 4 cards with staggered shimmer */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-2xl skeleton-shimmer"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>

      {/* Main content area skeleton */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 h-72 rounded-2xl skeleton-shimmer" style={{ animationDelay: '240ms' }} />
        <div className="h-72 rounded-2xl skeleton-shimmer" style={{ animationDelay: '300ms' }} />
      </div>

      {/* Table rows skeleton */}
      <div className="rounded-2xl border border-[var(--border)] overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-5 py-4 border-b border-[var(--border)] last:border-b-0"
          >
            <div className="h-9 w-9 rounded-xl skeleton-shimmer flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded-lg skeleton-shimmer" />
              <div className="h-3 w-48 rounded-lg skeleton-shimmer" style={{ animationDelay: `${i * 40 + 20}ms` }} />
            </div>
            <div className="h-8 w-20 rounded-xl skeleton-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}
