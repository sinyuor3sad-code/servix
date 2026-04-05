'use client';

import { useEffect, useRef } from 'react';

/**
 * THE ATMOSPHERE v5 — Cinematic multi-layer environment
 *
 * Layer 1: Animated gradient mesh (deep navy → indigo → obsidian)
 * Layer 2: Perspective wireframe grid (3D floor fading into distance)
 * Layer 3: Floating gold motes drifting toward center
 * Layer 4: Mouse-reactive light halo that follows with delay
 * Layer 5: Film grain noise texture (very subtle)
 * Layer 6: Horizontal scan line
 */
export function Atmosphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const smoothMouse = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const canvas = canvasEl; // non-null for closures
    const ctx = canvas.getContext('2d')!;
    let w = 0, h = 0, frame = 0, dpr = 1;

    // Motes
    interface Mote { x: number; y: number; speed: number; size: number; alpha: number; hue: number; }
    const MOTES: Mote[] = [];
    const MOTE_COUNT = 45;

    function spawnMote(): Mote {
      const edge = Math.floor(Math.random() * 4);
      let x = 0, y = 0;
      if (edge === 0) { x = Math.random() * w; y = -10; }
      else if (edge === 1) { x = w + 10; y = Math.random() * h; }
      else if (edge === 2) { x = Math.random() * w; y = h + 10; }
      else { x = -10; y = Math.random() * h; }
      const isGold = Math.random() > 0.4;
      return {
        x, y,
        speed: 0.1 + Math.random() * 0.18,
        size: 0.4 + Math.random() * 1.0,
        alpha: 0.02 + Math.random() * 0.04,
        hue: isGold ? 0 : 1, // 0=gold, 1=blue
      };
    }

    // Noise canvas (separate to prevent layer destruction)
    let noiseCanvas: HTMLCanvasElement | null = null;
    function generateNoise() {
      noiseCanvas = document.createElement('canvas');
      noiseCanvas.width = Math.min(w, 512);
      noiseCanvas.height = Math.min(h, 512);
      const nCtx = noiseCanvas.getContext('2d')!;
      const nd = nCtx.createImageData(noiseCanvas.width, noiseCanvas.height);
      for (let i = 0; i < nd.data.length; i += 4) {
        const v = Math.random() * 255;
        nd.data[i] = v;
        nd.data[i + 1] = v;
        nd.data[i + 2] = v;
        nd.data[i + 3] = 6;
      }
      nCtx.putImageData(nd, 0, 0);
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

      generateNoise();
    }

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', (e) => { mouseRef.current = { x: e.clientX, y: e.clientY }; });

    let animId: number;

    function draw() {
      frame++;
      ctx.clearRect(0, 0, w, h);

      // Smooth mouse
      smoothMouse.current.x += (mouseRef.current.x - smoothMouse.current.x) * 0.03;
      smoothMouse.current.y += (mouseRef.current.y - smoothMouse.current.y) * 0.03;

      const cx = w / 2, cy = h / 2;
      const breathe = Math.sin(frame * 0.003) * 0.5 + 0.5;
      const breathe2 = Math.sin(frame * 0.002 + 1) * 0.5 + 0.5;

      // ═══ LAYER 1: Gradient mesh background (cinematic depth) ═══
      const bgGrad = ctx.createRadialGradient(
        cx, cy * 0.6, 0,
        cx, cy * 0.6, Math.max(w, h) * 0.8
      );
      bgGrad.addColorStop(0, `rgba(15, 18, 55, ${0.95 + breathe * 0.05})`);
      bgGrad.addColorStop(0.25, `rgba(10, 12, 40, 0.8)`);
      bgGrad.addColorStop(0.5, `rgba(6, 6, 20, 0.5)`);
      bgGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Secondary: moving indigo/purple nebula
      const accentGrad = ctx.createRadialGradient(
        cx * 0.3 + breathe2 * cx * 0.5, cy * 0.4, 0,
        cx * 0.3 + breathe2 * cx * 0.5, cy * 0.4, 450
      );
      accentGrad.addColorStop(0, `rgba(79, 70, 229, ${0.05 + breathe2 * 0.025})`);
      accentGrad.addColorStop(0.5, `rgba(59, 50, 180, ${0.02 + breathe2 * 0.01})`);
      accentGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = accentGrad;
      ctx.fillRect(0, 0, w, h);

      // Tertiary: teal accent on opposite side
      const tealGrad = ctx.createRadialGradient(
        cx * 1.6 - breathe * cx * 0.3, cy * 0.7, 0,
        cx * 1.6 - breathe * cx * 0.3, cy * 0.7, 350
      );
      tealGrad.addColorStop(0, `rgba(20, 184, 166, ${0.02 + breathe * 0.01})`);
      tealGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = tealGrad;
      ctx.fillRect(0, 0, w, h);

      // Gold warmth at center
      const goldGlow = ctx.createRadialGradient(cx, cy * 0.85, 0, cx, cy * 0.85, 300);
      goldGlow.addColorStop(0, `rgba(201, 168, 76, ${0.03 + breathe * 0.015})`);
      goldGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = goldGlow;
      ctx.fillRect(0, 0, w, h);

      // ═══ LAYER 2: Perspective wireframe grid ═══
      const gridY = h * 0.65;
      const vanishX = cx;
      const vanishY = h * 0.35;
      const horizon = h * 0.55;
      const gridLines = 18;
      const gridSpacing = 80;

      ctx.lineWidth = 0.6;

      // Horizontal lines (receding into distance)
      for (let i = 0; i < gridLines; i++) {
        const t = i / gridLines;
        const y = horizon + (h - horizon) * Math.pow(t, 1.5);
        const spread = 1 - Math.pow(1 - t, 2);
        const lineAlpha = t * 0.6;

        ctx.globalAlpha = lineAlpha * (0.35 + breathe * 0.1);
        ctx.strokeStyle = `rgba(99, 102, 241, 0.3)`;
        ctx.beginPath();
        ctx.moveTo(cx - w * 0.6 * spread, y);
        ctx.lineTo(cx + w * 0.6 * spread, y);
        ctx.stroke();
      }

      // Vertical lines (converging to vanishing point)
      const vLines = 16;
      for (let i = -vLines / 2; i <= vLines / 2; i++) {
        const bottomX = cx + i * gridSpacing;
        const lineAlpha = 1 - Math.abs(i) / (vLines / 2) * 0.7;

        ctx.globalAlpha = lineAlpha * (0.12 + breathe * 0.04);
        ctx.strokeStyle = `rgba(99, 102, 241, 0.25)`;
        ctx.beginPath();
        ctx.moveTo(bottomX, h);
        ctx.lineTo(vanishX + (bottomX - vanishX) * 0.08, horizon);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;

      // ═══ LAYER 3: Mouse light halo ═══
      if (smoothMouse.current.x > 0) {
        const mg = ctx.createRadialGradient(
          smoothMouse.current.x, smoothMouse.current.y, 0,
          smoothMouse.current.x, smoothMouse.current.y, 280
        );
        mg.addColorStop(0, `rgba(201, 168, 76, 0.03)`);
        mg.addColorStop(0.4, `rgba(99, 102, 241, 0.015)`);
        mg.addColorStop(1, 'transparent');
        ctx.fillStyle = mg;
        ctx.fillRect(0, 0, w, h);
      }

      // ═══ LAYER 4: Gravitational motes ═══
      for (let i = 0; i < MOTES.length; i++) {
        const m = MOTES[i];
        const dx = cx - m.x, dy = cy - m.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        m.x += Math.cos(angle) * m.speed;
        m.y += Math.sin(angle) * m.speed;

        const fadeFactor = Math.max(0.2, dist / (Math.min(w, h) * 0.5));
        const a = m.alpha * fadeFactor;

        const color = m.hue === 0
          ? `rgba(201, 168, 76, ${a})`
          : `rgba(120, 130, 255, ${a * 0.7})`;

        ctx.beginPath();
        ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        if (m.size > 0.8) {
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.size * 5, 0, Math.PI * 2);
          ctx.fillStyle = m.hue === 0
            ? `rgba(201, 168, 76, ${a * 0.12})`
            : `rgba(120, 130, 255, ${a * 0.08})`;
          ctx.fill();
        }

        if (dist < 25) Object.assign(MOTES[i], spawnMote());
      }

      // ═══ LAYER 5: Scan line ═══
      const scanY = (frame * 0.4) % (h * 1.2) - h * 0.1;
      const scanGrad = ctx.createLinearGradient(0, scanY - 2, 0, scanY + 2);
      scanGrad.addColorStop(0, 'transparent');
      scanGrad.addColorStop(0.5, `rgba(99, 102, 241, 0.015)`);
      scanGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, scanY - 2, w, 4);

      // ═══ LAYER 6: Noise grain (composited on top) ═══
      if (noiseCanvas) {
        ctx.globalAlpha = 0.03;
        ctx.drawImage(noiseCanvas, 0, 0, w, h);
        ctx.globalAlpha = 1;
      }

      animId = requestAnimationFrame(draw);
    }

    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} className="nx-atmosphere" aria-hidden="true" />;
}
