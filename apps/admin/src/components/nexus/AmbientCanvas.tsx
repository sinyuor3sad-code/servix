'use client';

import { useEffect, useRef } from 'react';

/**
 * LIVING CANVAS — Particles drift slowly toward center.
 * Not random. Not decorative. Gravitational. Intentional.
 * The system is breathing. The system is aware.
 */
export function SovereignCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let w = 0, h = 0;
    let frame = 0;

    interface Mote {
      x: number; y: number;
      speed: number;
      size: number;
      opacity: number;
      angle: number;
    }

    const MOTE_COUNT = 80;
    let motes: Mote[] = [];

    function createMote(): Mote {
      // Spawn from edges
      const edge = Math.random();
      let x: number, y: number;
      if (edge < 0.25) { x = 0; y = Math.random() * h; }
      else if (edge < 0.5) { x = w; y = Math.random() * h; }
      else if (edge < 0.75) { x = Math.random() * w; y = 0; }
      else { x = Math.random() * w; y = h; }

      return {
        x, y,
        speed: 0.15 + Math.random() * 0.25,
        size: 0.5 + Math.random() * 1.2,
        opacity: 0.03 + Math.random() * 0.06,
        angle: Math.atan2(h / 2 - y, w / 2 - x) + (Math.random() - 0.5) * 0.4,
      };
    }

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * window.devicePixelRatio;
      canvas.height = h * window.devicePixelRatio;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);

      motes = [];
      for (let i = 0; i < MOTE_COUNT; i++) {
        const m = createMote();
        // Scatter initially
        m.x = Math.random() * w;
        m.y = Math.random() * h;
        motes.push(m);
      }
    }

    resize();
    window.addEventListener('resize', resize);

    let animId: number;

    function draw() {
      frame++;
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;

      // Ambient center glow — breathing
      const breathe = Math.sin(frame * 0.005) * 0.5 + 0.5;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 300);
      glow.addColorStop(0, `rgba(201,168,76, ${0.02 + breathe * 0.01})`);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // Draw motes
      for (let i = 0; i < motes.length; i++) {
        const m = motes[i];

        // Drift toward center
        const dx = cx - m.x;
        const dy = cy - m.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        m.x += Math.cos(angle) * m.speed;
        m.y += Math.sin(angle) * m.speed;

        // Fade as approaching center
        const fadeDist = Math.max(0, 1 - dist / (Math.min(w, h) * 0.6));
        const alpha = m.opacity * (1 - fadeDist * 0.8);

        // Draw
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(201,168,76, ${alpha})`;
        ctx.fill();

        // Soft halo for larger motes
        if (m.size > 1) {
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.size * 5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(201,168,76, ${alpha * 0.15})`;
          ctx.fill();
        }

        // Recycle if near center
        if (dist < 30) {
          Object.assign(motes[i], createMote());
        }
      }

      animId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="sv-canvas" aria-hidden="true" />;
}
