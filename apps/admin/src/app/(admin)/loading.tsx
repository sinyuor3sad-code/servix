export default function Loading() {
  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Title skeleton */}
      <div>
        <div className="h-3 w-20 rounded-lg mb-2" style={{ background: 'var(--nx-border)' }} />
        <div className="h-8 w-72 rounded-xl" style={{ background: 'var(--nx-border)' }} />
      </div>

      {/* Pulse strip skeleton */}
      <div className="nx-pulse-strip">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="nx-pulse-cell">
            <div className="h-2.5 w-16 rounded mb-4" style={{ background: 'var(--nx-border)' }} />
            <div className="h-8 w-12 rounded-lg" style={{ background: 'var(--nx-border)' }} />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="lg:col-span-7 nx-glass">
          <div className="p-6 space-y-4">
            <div className="h-4 w-32 rounded-lg" style={{ background: 'var(--nx-border)' }} />
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-4 py-3">
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--nx-border)' }} />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 rounded" style={{ background: 'var(--nx-border)' }} />
                  <div className="h-2.5 w-24 rounded" style={{ background: 'var(--nx-border)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-5 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="nx-insight" style={{ height: '72px' }} />
          ))}
        </div>
      </div>
    </div>
  );
}
