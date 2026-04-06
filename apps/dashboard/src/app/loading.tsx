export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
      <div className="relative flex flex-col items-center gap-4">
        {/* Ambient glow */}
        <div className="absolute inset-0 rounded-full bg-[var(--brand-primary)] opacity-[0.06] blur-3xl scale-[3] pointer-events-none" />

        {/* Logo pulse */}
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-dark)] shadow-[0_4px_20px_color-mix(in_srgb,var(--brand-primary)_30%,transparent)]">
          <span className="text-2xl font-bold text-white tracking-tight">S</span>
        </div>

        {/* Premium spinner */}
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[var(--muted)] border-t-[var(--brand-primary)]" style={{ filter: 'drop-shadow(0 0 6px color-mix(in srgb, var(--brand-primary) 25%, transparent))' }} />

        <p className="text-sm font-medium text-[var(--muted-foreground)] animate-pulse">جاري التحميل...</p>
      </div>
    </div>
  );
}
