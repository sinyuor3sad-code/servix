'use client';

import { useEffect, useRef, useState } from 'react';

interface PulseMetric {
  label: string;
  value: number;
  suffix?: string;
  delta?: { value: number; direction: 'up' | 'down' };
}

function CountUp({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [current, setCurrent] = useState(0);
  const ref = useRef<number>(0);
  const startTime = useRef<number>(0);

  useEffect(() => {
    if (target === 0) { setCurrent(0); return; }
    startTime.current = performance.now();
    ref.current = requestAnimationFrame(function animate(now) {
      const elapsed = now - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4); // easeOutQuart
      setCurrent(Math.round(eased * target));
      if (progress < 1) ref.current = requestAnimationFrame(animate);
    });
    return () => cancelAnimationFrame(ref.current);
  }, [target, duration]);

  return <>{current.toLocaleString('en-US')}</>;
}

export function EmpirePulse({ metrics }: { metrics: PulseMetric[] }) {
  return (
    <div className="os-empire-pulse os-enter os-enter-2">
      {metrics.map((m, i) => (
        <div key={i} className="os-pulse-cell">
          <div className="os-pulse-label">{m.label}</div>
          <div>
            <span className="os-pulse-value">
              <CountUp target={m.value} />
            </span>
            {m.suffix && <span className="os-pulse-suffix">{m.suffix}</span>}
          </div>
          {m.delta && (
            <div className={`os-pulse-delta ${m.delta.direction}`}>
              {m.delta.direction === 'up' ? '↑' : '↓'} {m.delta.value}%
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
