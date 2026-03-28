import type { ReactNode } from 'react';

interface GlassProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function Glass({ children, className = '', hover = false }: GlassProps) {
  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl border border-white/[0.07]
        shadow-[0_4px_30px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.05)]
        ${hover ? 'transition-all duration-400 hover:border-amber-500/15 hover:shadow-[0_8px_40px_rgba(234,179,8,0.06)]' : ''}
        ${className}
      `}
      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.015) 100%)', backdropFilter: 'blur(40px) saturate(130%)' }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-transparent" />
      <div className="relative">{children}</div>
    </div>
  );
}

export function PageTitle({ title, desc, children }: { title: string; desc: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">{title}</h1>
        <p className="mt-1 text-[13px] text-white/30">{desc}</p>
      </div>
      {children}
    </div>
  );
}

export const TN: React.CSSProperties = { fontFeatureSettings: '"tnum" 1', fontVariantNumeric: 'tabular-nums' };
