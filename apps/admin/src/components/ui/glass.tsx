import type { ReactNode } from 'react';

interface GlassProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function Glass({ children, className = '', hover = false }: GlassProps) {
  return (
    <div
      className={`nx-glass ${hover ? 'nx-glass--hover' : ''} ${className}`}
    >
      <div className="nx-glass-sheen" />
      <div className="relative">{children}</div>
    </div>
  );
}

export function PageTitle({ title, desc, icon, children }: { title: string; desc: string; icon?: ReactNode; children?: ReactNode }) {
  return (
    <div className="nx-page-title">
      <div className="nx-page-title-text">
        {icon && <div className="nx-page-title-icon">{icon}</div>}
        <div>
          <h1 className="nx-h1">{title}</h1>
          <p className="nx-subtitle">{desc}</p>
        </div>
      </div>
      {children && <div className="nx-page-title-actions">{children}</div>}
    </div>
  );
}

export const TN: React.CSSProperties = { fontFeatureSettings: '"tnum" 1', fontVariantNumeric: 'tabular-nums' };
