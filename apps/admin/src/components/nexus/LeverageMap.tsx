'use client';

import type { ReactElement } from 'react';
import {
  AlertTriangle,
  TrendingUp,
  Clock,
  Shield,
  Zap,
} from 'lucide-react';

export interface LeverageInsight {
  id: string;
  type: 'opportunity' | 'risk' | 'trend' | 'milestone' | 'alert';
  message: string; // supports <strong> inline
  priority: 'high' | 'medium' | 'low';
}

const ICON_MAP: Record<string, { icon: React.ElementType; bg: string; color: string }> = {
  opportunity: { icon: Zap,             bg: 'rgba(16,185,129,0.08)',  color: '#34d399' },
  risk:        { icon: AlertTriangle,   bg: 'rgba(239,68,68,0.08)',   color: '#f87171' },
  trend:       { icon: TrendingUp,      bg: 'rgba(99,102,241,0.08)',  color: '#818cf8' },
  milestone:   { icon: Shield,          bg: 'rgba(201,168,76,0.08)',  color: '#C9A84C' },
  alert:       { icon: Clock,           bg: 'rgba(245,158,11,0.08)', color: '#fbbf24' },
};

export function LeverageMap({ insights }: { insights: LeverageInsight[] }): ReactElement {
  if (insights.length === 0) {
    return (
      <div className="os-enter os-enter-4" style={{ padding: '20px 0' }}>
        <div className="os-section-label">رؤى استراتيجية</div>
        <div
          style={{
            padding: '40px 24px',
            borderRadius: 16,
            background: 'var(--os-surface-1)',
            border: '1px solid var(--os-border)',
            textAlign: 'center',
          }}
        >
          <Shield size={32} strokeWidth={1} style={{ color: 'var(--os-text-3)', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--os-text-2)' }}>
            لا توجد تنبيهات — الوضع مستقر
          </p>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--os-text-3)', marginTop: 4 }}>
            ستظهر الرؤى الاستراتيجية هنا عند توفر بيانات كافية
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="os-enter os-enter-4">
      <div className="os-section-label">رؤى استراتيجية</div>
      <div className="os-leverage">
        {insights.map((insight) => {
          const cfg = ICON_MAP[insight.type] || ICON_MAP.trend;
          const Icon = cfg.icon;
          return (
            <div key={insight.id} className="os-leverage-item">
              <div className="os-leverage-icon" style={{ background: cfg.bg }}>
                <Icon size={18} strokeWidth={1.5} style={{ color: cfg.color }} />
              </div>
              <p
                className="os-leverage-text"
                dangerouslySetInnerHTML={{ __html: insight.message }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
