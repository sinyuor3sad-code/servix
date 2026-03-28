/**
 * Particles — components/particles.tsx
 *
 * Canvas particle layer — mounted ONLY for particle-enabled themes
 * (luxury | ramadan | vibrant). All other themes never load this module.
 *
 * ── Performance guards (auto-disable if any passes) ──────────────────────────
 *  1. prefers-reduced-motion: reduce          → accessibility
 *  2. navigator.hardwareConcurrency < 4       → weak CPU
 *  3. navigator.deviceMemory < 2              → < 2 GB RAM (Chrome non-standard)
 *  4. getBattery() → level < 0.20 + discharging
 *
 * ── Rendering optimizations ──────────────────────────────────────────────────
 *  • 30 fps hard cap — timestamp-delta gate (FRAME_MS ≈ 33ms)
 *  • DPR-aware canvas, capped at 2× (avoids 3× overdraw on Pro displays)
 *  • Visibility API — rAF loop fully stops when tab is hidden; lastTime
 *    resets on visibility restore to prevent a large delta spike
 *  • Edge drawing (O(n²)) skipped when particle count > EDGE_MAX_COUNT
 *  • useState status machine: 'checking' → never mounts canvas
 *    'disabled' → returns null (zero DOM nodes, zero paint)
 *    'active'   → canvas renders and animates
 *
 * ── CSS token integration ─────────────────────────────────────────────────────
 *  Reads --particle-color-1, --particle-color-2, --particle-count from
 *  getComputedStyle(#salon-root) so each [data-theme] drives its own colors.
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ── Constants ─────────────────────────────────────────────────────────────────

const FPS_TARGET     = 30;
const FRAME_MS       = 1000 / FPS_TARGET; // ~33 ms
const MAX_DPR        = 2;
const EDGE_THRESHOLD = 120;               // px — connect particles closer than this
const EDGE_MAX_COUNT = 35;                // O(n²) edges only below this particle count

// ── Types ─────────────────────────────────────────────────────────────────────

interface Particle {
  x:        number;
  y:        number;
  vx:       number;
  vy:       number;
  r:        number;         // radius
  alpha:    number;         // base opacity
  colorIdx: 0 | 1;         // index into colorsRef
  phase:    number;         // sine phase for pulse animation
}

type Status = 'checking' | 'active' | 'disabled';

// ── Performance guards ────────────────────────────────────────────────────────

async function shouldDisable(): Promise<boolean> {
  // 1. Accessibility — reduced motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;

  // 2. Weak CPU
  if (
    typeof navigator.hardwareConcurrency === 'number' &&
    navigator.hardwareConcurrency < 4
  ) return true;

  // 3. Low RAM (Chrome / Opera only — non-standard)
  const nav = navigator as Navigator & { deviceMemory?: number };
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory < 2) return true;

  // 4. Low battery
  try {
    type BatteryMgr = { level: number; charging: boolean };
    const getBattery = (navigator as Navigator & {
      getBattery?: () => Promise<BatteryMgr>;
    }).getBattery;
    if (getBattery) {
      const bat = await getBattery.call(navigator);
      if (!bat.charging && bat.level < 0.20) return true;
    }
  } catch { /* API not supported */ }

  return false;
}

// ── CSS var helper ────────────────────────────────────────────────────────────

function cssVar(el: Element, name: string, fallback: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ParticlesProps {
  /** CSS z-index of the canvas. Default: -1 (behind all content). */
  zIndex?: number;
  /** Override particle count from CSS token. */
  count?:  number;
}

export default function Particles({
  zIndex = -1,
  count:  countProp,
}: ParticlesProps): React.ReactElement | null {

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const rafRef     = useRef<number>(0);
  const psRef      = useRef<Particle[]>([]);
  const colorsRef  = useRef<[string, string]>([
    'rgba(168,85,247,0.5)',
    'rgba(34,211,238,0.35)',
  ]);

  // State machine — canvas is only inserted into the DOM when status='active'
  const [status, setStatus] = useState<Status>('checking');

  // ── Particle initializer ──────────────────────────────────────────────────
  const initParticles = useCallback((W: number, H: number, n: number) => {
    psRef.current = Array.from({ length: n }, () => ({
      x:        Math.random() * W,
      y:        Math.random() * H,
      vx:       (Math.random() - 0.5) * 0.5,
      vy:       (Math.random() - 0.5) * 0.3,
      r:        Math.random() * 2 + 0.8,
      alpha:    Math.random() * 0.5 + 0.2,
      colorIdx: (Math.random() > 0.5 ? 0 : 1) as 0 | 1,
      phase:    Math.random() * Math.PI * 2,
    }));
  }, []);

  // ── Guard check (runs once on mount) ─────────────────────────────────────
  useEffect(() => {
    let live = true;
    shouldDisable().then(off => {
      if (live) setStatus(off ? 'disabled' : 'active');
    });
    return () => { live = false; };
  }, []);

  // ── Animation loop (only when status === 'active') ────────────────────────
  useEffect(() => {
    if (status !== 'active') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rootEl = document.getElementById('salon-root') ?? document.documentElement;
    const DPR    = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    let cancelled = false;

    // Read theme-driven particle colors from CSS
    colorsRef.current = [
      cssVar(rootEl, '--particle-color-1', 'rgba(168,85,247,0.5)'),
      cssVar(rootEl, '--particle-color-2', 'rgba(34,211,238,0.35)'),
    ];

    // ── Resize handler ──────────────────────────────────────────────────────
    const resize = () => {
      const W = window.innerWidth;
      const H = window.innerHeight;
      canvas.width        = W * DPR;
      canvas.height       = H * DPR;
      canvas.style.width  = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.scale(DPR, DPR);

      const cssN = parseInt(cssVar(rootEl, '--particle-count', '35'), 10);
      initParticles(W, H, countProp ?? (Number.isFinite(cssN) ? cssN : 35));
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });

    // ── Draw loop ───────────────────────────────────────────────────────────
    let lastTime  = 0;
    let tick      = 0;
    const drawEdges = psRef.current.length <= EDGE_MAX_COUNT;

    const draw = (now: number) => {
      if (cancelled) return;

      // Pause rAF entirely when tab is hidden — resume via visibilitychange
      if (document.visibilityState === 'hidden') return;

      const delta = now - lastTime;
      if (delta < FRAME_MS) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      lastTime = now - (delta % FRAME_MS); // drift correction
      tick++;

      const W  = canvas.width  / DPR;
      const H  = canvas.height / DPR;
      const ps = psRef.current;
      const [c1, c2] = colorsRef.current;

      ctx.clearRect(0, 0, W, H);

      // ── Particles ─────────────────────────────────────────────────────────
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];

        // Translate + wrap
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10)    p.x = W + 10;
        if (p.x > W + 10) p.x = -10;
        if (p.y < -10)    p.y = H + 10;
        if (p.y > H + 10) p.y = -10;

        const a     = p.alpha * (0.5 + 0.5 * Math.sin(tick * 0.04 + p.phase));
        const color = p.colorIdx === 0 ? c1 : c2;

        // Glow halo
        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
        grd.addColorStop(0, color);
        grd.addColorStop(1, 'transparent');
        ctx.globalAlpha = a * 0.4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 5, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        // Core dot
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        ctx.globalAlpha = 1;
      }

      // ── Connecting edges (O(n²) — only for small counts) ──────────────────
      if (drawEdges) {
        for (let i = 0; i < ps.length; i++) {
          for (let j = i + 1; j < ps.length; j++) {
            const dx   = ps[i].x - ps[j].x;
            const dy   = ps[i].y - ps[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > EDGE_THRESHOLD) continue;

            ctx.globalAlpha = (1 - dist / EDGE_THRESHOLD) * 0.10;
            ctx.beginPath();
            ctx.moveTo(ps[i].x, ps[i].y);
            ctx.lineTo(ps[j].x, ps[j].y);
            ctx.strokeStyle = c1;
            ctx.lineWidth   = 0.5;
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    // ── Visibility-change: proper pause + resume ──────────────────────────
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !cancelled) {
        lastTime = 0; // reset delta so we don't spike after a long pause
        rafRef.current = requestAnimationFrame(draw);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [status, initParticles, countProp]);

  // Return null until guards confirm we should render (no empty canvas in DOM)
  if (status !== 'active') return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0"
      style={{ zIndex }}
    />
  );
}
