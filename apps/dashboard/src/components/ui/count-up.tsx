'use client';

import { useEffect, useState } from 'react';

interface CountUpProps {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}

function CountUp({
  value,
  duration = 600,
  format = (n) => n.toLocaleString('ar-SA'),
  className,
}: CountUpProps): React.ReactElement {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let start = 0;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - progress) ** 2;
      const current = Math.round(value * eased);
      setDisplay(current);
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
  }, [value, duration]);

  return <span className={className}>{format(display)}</span>;
}

export { CountUp };
