'use client';

import type { ReactElement } from 'react';

export interface MomentumEvent {
  id: string;
  type: 'registration' | 'payment' | 'expiry' | 'alert' | 'system';
  text: string;
  timeAgo: string;
}

const DOT_COLORS: Record<string, string> = {
  registration: '#8B5CF6',
  payment:      '#10B981',
  expiry:       '#F59E0B',
  alert:        '#EF4444',
  system:       '#6366F1',
};

export function MomentumRiver({ events }: { events: MomentumEvent[] }): ReactElement {
  if (events.length === 0) {
    return (
      <div className="os-enter os-enter-3" style={{ padding: '20px 0' }}>
        <div className="os-section-label">تدفق الأحداث</div>
        <div
          style={{
            padding: '32px 24px',
            borderRadius: 16,
            background: 'var(--os-surface-1)',
            border: '1px solid var(--os-border)',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--os-text-3)' }}>
            لا توجد أحداث حديثة — النظام هادئ
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="os-enter os-enter-3">
      <div className="os-section-label">تدفق الأحداث</div>
      <div className="os-momentum">
        {events.map((ev) => (
          <div key={ev.id} className="os-momentum-item">
            <span
              className="os-momentum-dot"
              style={{ background: DOT_COLORS[ev.type] || '#6366F1' }}
            />
            <span className="os-momentum-text">{ev.text}</span>
            <span className="os-momentum-time">{ev.timeAgo}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
