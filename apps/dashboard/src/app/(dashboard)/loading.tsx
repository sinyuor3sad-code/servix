export default function DashboardLoading() {
  return (
    <div className="space-y-5 p-4 md:p-6 animate-fade-in">
      {/* Page title skeleton */}
      <div className="h-8 w-48 rounded-[var(--radius)] bg-[var(--muted)] animate-pulse" />

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="relative overflow-hidden h-28 rounded-[var(--radius-xl)] bg-[var(--card)] border border-[var(--border)] shadow-[var(--shadow)]"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="absolute inset-0 bg-[var(--muted)] animate-pulse" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--surface-elevated)]/30 to-transparent animate-[shimmer_2s_ease-in-out_infinite]" />
          </div>
        ))}
      </div>

      {/* Content area skeleton */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="relative overflow-hidden h-64 rounded-[var(--radius-xl)] bg-[var(--card)] border border-[var(--border)] shadow-[var(--shadow)]"
          >
            <div className="absolute inset-0 bg-[var(--muted)] animate-pulse" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--surface-elevated)]/30 to-transparent animate-[shimmer_2s_ease-in-out_infinite]" style={{ animationDelay: `${i * 200}ms` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
