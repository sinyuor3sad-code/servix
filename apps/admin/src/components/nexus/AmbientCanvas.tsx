'use client';

import { useEffect, useRef } from 'react';

/**
 * THE ATMOSPHERE — Multi-layer living environment
 * Layer 1: Ultra-subtle dot grid that breathes
 * Layer 2: Radial gold warmth at center
 * Layer 3: Floating motes drifting toward center (gravitational)
 * Layer 4: Mouse-responsive light that follows with 200ms delay
 */
export function Atmosphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const smoothMouse = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let w = 0, h = 0, frame = 0, dpr = 1;

    interface Mote { x: number; y: number; speed: number; size: number; alpha: number; }
    const MOTES: Mote[] = [];
    const MOTE_COUNT = 50;

    function spawnMote(): Mote {
      const edge = Math.floor(Math.random() * 4);
      let x = 0, y = 0;
      if (edge === 0) { x = Math.random() * w; y = -10; }
      else if (edge === 1) { x = w + 10; y = Math.random() * h; }
      else if (edge === 2) { x = Math.random() * w; y = h + 10; }
      else { x = -10; y = Math.random() * h; }
      return { x, y, speed: 0.12 + Math.random() * 0.2, size: 0.4 + Math.random() * 1.0, alpha: 0.02 + Math.random() * 0.04 };
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      MOTES.length = 0;
      for (let i = 0; i < MOTE_COUNT; i++) {
        const m = spawnMote();
        m.x = Math.random() * w;
        m.y = Math.random() * h;
        MOTES.push(m);
      }
    }

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', (e) => { mouseRef.current = { x: e.clientX, y: e.clientY }; });

    let animId: number;

    function draw() {
      frame++;
      ctx.clearRect(0, 0, w, h);

      // Smooth mouse lag
      smoothMouse.current.x += (mouseRef.current.x - smoothMouse.current.x) * 0.04;
      smoothMouse.current.y += (mouseRef.current.y - smoothMouse.current.y) * 0.04;

      const cx = w / 2, cy = h / 2;
      const breathe = Math.sin(frame * 0.004) * 0.5 + 0.5;

      // Layer 1: Dot grid
      const spacing = 60;
      const cols = Math.ceil(w / spacing) + 1;
      const rows = Math.ceil(h / spacing) + 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * spacing;
          const y = r * spacing;
          const mx = smoothMouse.current.x;
          const my = smoothMouse.current.y;
          const dist = Math.sqrt((x-mx)**2 + (y-my)**2);
          const proximity = Math.max(0, 1 - dist / 200);
          const alpha = 0.015 + breathe * 0.006 + proximity * 0.08;

          ctx.beginPath();
          ctx.arc(x, y, 0.6 + proximity * 1.2, 0, Math.PI * 2);
          ctx.fillStyle = proximity > 0.3
            ? `rgba(201,168,76, ${alpha * 1.5})`
            : `rgba(255,255,255, ${alpha})`;
          ctx.fill();
        }
      }

      // Layer 2: Central warmth
      const glow = ctx.createRadialGradient(cx, cy * 0.85, 0, cx, cy * 0.85, 350 + breathe * 30);
      glow.addColorStop(0, `rgba(201,168,76, ${0.018 + breathe * 0.008})`);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // Layer 3: Mouse light
      if (smoothMouse.current.x > 0) {
        const mg = ctx.createRadialGradient(
          smoothMouse.current.x, smoothMouse.current.y, 0,
          smoothMouse.current.x, smoothMouse.current.y, 250
        );
        mg.addColorStop(0, `rgba(201,168,76, 0.025)`);
        mg.addColorStop(1, 'transparent');
        ctx.fillStyle = mg;
        ctx.fillRect(0, 0, w, h);
      }

      // Layer 4: Gravitational motes
      for (let i = 0; i < MOTES.length; i++) {
        const m = MOTES[i];
        const dx = cx - m.x, dy = cy - m.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const angle = Math.atan2(dy, dx);

        m.x += Math.cos(angle) * m.speed;
        m.y += Math.sin(angle) * m.speed;

        const fadeFactor = Math.max(0.2, dist / (Math.min(w,h) * 0.5));
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(201,168,76, ${m.alpha * fadeFactor})`;
        ctx.fill();

        if (m.size > 0.8) {
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.size * 4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(201,168,76, ${m.alpha * fadeFactor * 0.15})`;
          ctx.fill();
        }

        if (dist < 25) Object.assign(MOTES[i], spawnMote());
      }

      animId = requestAnimationFrame(draw);
    }

    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} className="nx-atmosphere" aria-hidden="true" />;
}
