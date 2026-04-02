export default function AdminLoading() {
  return (
    <div className="space-y-5 p-6">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-white/[0.04]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.02]" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.02]" />
    </div>
  );
}
