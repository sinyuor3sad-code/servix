'use client';

import { useEffect, useRef } from 'react';

/* ─────────────────────────────────────────────
   Pure-canvas cosmic background
   • Drifting constellation nodes
   • Connecting edges that pulse
   • Neon data-stream particles
   • Two large radial orbs floating beneath
───────────────────────────────────────────── */

interface Node {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  opacity: number;
  pulsePhase: number;
}

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number;
  maxLife: number;
  hue: number; // 270 = violet, 190 = cyan
}

const MAX_EDGE_DIST = 160;
const NODE_COUNT_BASE = 55;

export default function CosmicBg(): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    /* ── Resize ── */
    let W = 0, H = 0;
    const resize = () => {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight * 3; // cover full scroll height
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(document.body);

    /* ── Nodes ── */
    const nodeCount = Math.min(
      Math.floor((W * H) / 18000) + NODE_COUNT_BASE,
      140
    );
    const nodes: Node[] = Array.from({ length: nodeCount }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.28,
      vy: (Math.random() - 0.5) * 0.18,
      r: Math.random() * 1.8 + 0.6,
      opacity: Math.random() * 0.6 + 0.2,
      pulsePhase: Math.random() * Math.PI * 2,
    }));

    /* ── Particles ── */
    const particles: Particle[] = [];
    const spawnParticle = () => {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -(Math.random() * 1.4 + 0.4),
        life: 0,
        maxLife: Math.random() * 120 + 80,
        hue: Math.random() > 0.5 ? 275 : 190,
      });
    };
    for (let i = 0; i < 40; i++) spawnParticle();

    /* ── Draw ── */
    let t = 0;
    const draw = () => {
      t++;
      ctx.clearRect(0, 0, W, H);

      /* cosmic deep gradient fill */
      const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
      bg.addColorStop(0,   'rgba(8, 3, 22, 1)');
      bg.addColorStop(0.3, 'rgba(14, 6, 38, 1)');
      bg.addColorStop(0.7, 'rgba(10, 4, 28, 1)');
      bg.addColorStop(1,   'rgba(6, 3, 18, 1)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      /* large floating orbs */
      const drawOrb = (
        cx: number, cy: number,
        rx: number, ry: number,
        color0: string, color1: string
      ) => {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
        g.addColorStop(0,   color0);
        g.addColorStop(0.5, color1);
        g.addColorStop(1,   'transparent');
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      };

      const ox1 = W * 0.75 + Math.sin(t * 0.003) * 60;
      const oy1 = H * 0.18 + Math.cos(t * 0.002) * 40;
      drawOrb(ox1, oy1, 420, 340,
        'rgba(147,51,234,0.22)', 'rgba(99,102,241,0.08)');

      const ox2 = W * 0.18 + Math.cos(t * 0.0025) * 55;
      const oy2 = H * 0.38 + Math.sin(t * 0.0018) * 55;
      drawOrb(ox2, oy2, 380, 300,
        'rgba(168,85,247,0.16)', 'rgba(34,211,238,0.06)');

      const ox3 = W * 0.5 + Math.sin(t * 0.002) * 40;
      const oy3 = H * 0.62 + Math.cos(t * 0.0015) * 50;
      drawOrb(ox3, oy3, 340, 260,
        'rgba(99,102,241,0.14)', 'rgba(168,85,247,0.06)');

      /* dot grid overlay */
      ctx.fillStyle = 'rgba(168,85,247,0.055)';
      const gs = 32;
      for (let gx = 0; gx < W; gx += gs) {
        for (let gy = 0; gy < H; gy += gs) {
          ctx.beginPath();
          ctx.arc(gx, gy, 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      /* move + wrap nodes */
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -20) n.x = W + 20;
        if (n.x > W + 20) n.x = -20;
        if (n.y < -20) n.y = H + 20;
        if (n.y > H + 20) n.y = -20;
      }

      /* edges */
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > MAX_EDGE_DIST) continue;

          const alpha = (1 - dist / MAX_EDGE_DIST) * 0.18;
          const pulse  = 0.5 + 0.5 * Math.sin(t * 0.04 + a.pulsePhase);
          const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
          grad.addColorStop(0, `rgba(168,85,247,${alpha * (0.7 + 0.3 * pulse)})`);
          grad.addColorStop(0.5, `rgba(129,140,248,${alpha * 0.9})`);
          grad.addColorStop(1, `rgba(34,211,238,${alpha * 0.5})`);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = grad;
          ctx.lineWidth   = 0.7;
          ctx.stroke();
        }
      }

      /* nodes */
      for (const n of nodes) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 0.05 + n.pulsePhase);
        const alpha = n.opacity * (0.6 + 0.4 * pulse);

        /* glow */
        const gn = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 5);
        gn.addColorStop(0, `rgba(168,85,247,${alpha * 0.6})`);
        gn.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 5, 0, Math.PI * 2);
        ctx.fillStyle = gn;
        ctx.fill();

        /* core */
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220,190,255,${alpha})`;
        ctx.fill();
      }

      /* particles */
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        if (p.life > p.maxLife || p.y < -10) {
          particles.splice(i, 1);
          spawnParticle();
          continue;
        }
        const progress = p.life / p.maxLife;
        const alpha = progress < 0.15
          ? progress / 0.15
          : progress > 0.8
            ? (1 - progress) / 0.2
            : 1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue},90%,75%,${alpha * 0.7})`;
        ctx.fill();

        /* trailing streak */
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 8, p.y - p.vy * 8);
        ctx.strokeStyle = `hsla(${p.hue},90%,75%,${alpha * 0.3})`;
        ctx.lineWidth   = 0.8;
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0 }}
    />
  );
}
