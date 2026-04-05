'use client';

import { useEffect, useRef, useCallback } from 'react';

/**
 * NEXUS v8 — LEGENDARY DUAL-THEME CANVAS
 * 
 * DARK: Deep space with energy core, radar scanner, constellations
 * LIGHT: Crystalline grid with prismatic nodes, blue energy flows
 * BOTH: Particles, connections, HUD corners, energy pulses, mouse interaction
 */
export function Atmosphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const smoothMouse = useRef({ x: -9999, y: -9999 });
  const themeRef = useRef<'dark' | 'light'>('dark');

  const getTheme = useCallback(() => {
    return (document.documentElement.getAttribute('data-theme') || 'dark') as 'dark' | 'light';
  }, []);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const canvas = canvasEl;
    const ctx = canvas.getContext('2d')!;
    let w = 0, h = 0, frame = 0;

    // Theme observer
    const obs = new MutationObserver(() => {
      themeRef.current = getTheme();
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    themeRef.current = getTheme();

    // Nodes
    interface Node {
      x: number; y: number; vx: number; vy: number;
      size: number; baseAlpha: number; type: 0 | 1;
    }
    const nodes: Node[] = [];
    const NODE_COUNT = 70;

    function spawnNode(): Node {
      const angle = Math.random() * Math.PI * 2;
      const r = 100 + Math.random() * Math.max(w, h) * 0.5;
      return {
        x: w / 2 + Math.cos(angle) * r,
        y: h / 2 + Math.sin(angle) * r,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: 1 + Math.random() * 2.5,
        baseAlpha: 0.2 + Math.random() * 0.4,
        type: Math.random() > 0.45 ? 0 : 1,
      };
    }

    // Pulses
    interface Pulse { radius: number; maxRadius: number; alpha: number; }
    const pulses: Pulse[] = [];

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      nodes.length = 0;
      for (let i = 0; i < NODE_COUNT; i++) {
        const n = spawnNode();
        n.x = Math.random() * w;
        n.y = Math.random() * h;
        nodes.push(n);
      }
    }

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', (e) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    });

    let animId: number;

    // Theme-aware colors
    function colors() {
      const dark = themeRef.current === 'dark';
      return {
        dark,
        // Primary accent (gold in dark, deep blue in light)
        primary: dark ? [201, 168, 76] : [79, 70, 229],
        // Secondary (indigo in dark, violet in light)  
        secondary: dark ? [99, 102, 241] : [139, 92, 246],
        // Tertiary
        tertiary: dark ? [20, 184, 166] : [59, 130, 246],
        // Grid
        grid: dark ? [99, 102, 241] : [99, 102, 241],
        // Core glow
        coreInner: dark ? [255, 230, 150] : [255, 255, 255],
        coreMid: dark ? [201, 168, 76] : [99, 102, 241],
        // Node colors
        nodeA: dark ? '201,168,76' : '79,70,229',
        nodeB: dark ? '130,140,255' : '139,92,246',
        // HUD
        hud: dark ? [99, 102, 241] : [99, 102, 241],
        // Background
        bgDeep: dark ? [16, 20, 60] : [235, 238, 248],
        bgMid: dark ? [8, 10, 35] : [240, 242, 250],
      };
    }

    function draw() {
      frame++;
      ctx.clearRect(0, 0, w, h);

      const mx = smoothMouse.current;
      mx.x += (mouseRef.current.x - mx.x) * 0.06;
      mx.y += (mouseRef.current.y - mx.y) * 0.06;

      const cx = w / 2, cy = h / 2;
      const t1 = Math.sin(frame * 0.003) * 0.5 + 0.5;
      const t2 = Math.sin(frame * 0.002 + 1.5) * 0.5 + 0.5;
      const c = colors();

      // ══════════════════════════════════════════════
      // 1. GRADIENT BACKGROUND
      // ══════════════════════════════════════════════
      const bg = ctx.createRadialGradient(cx, cy * 0.6, 0, cx, cy * 0.6, Math.max(w, h) * 0.9);
      bg.addColorStop(0, `rgba(${c.bgDeep.join(',')}, ${c.dark ? 1 : 0.8})`);
      bg.addColorStop(0.4, `rgba(${c.bgMid.join(',')}, ${c.dark ? 0.7 : 0.4})`);
      bg.addColorStop(1, 'transparent');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Nebulae
      const n1 = ctx.createRadialGradient(cx * 0.25 + t2 * cx * 0.5, cy * 0.35, 0, cx * 0.25 + t2 * cx * 0.5, cy * 0.35, 500);
      n1.addColorStop(0, `rgba(${c.secondary.join(',')}, ${c.dark ? 0.08 + t2 * 0.04 : 0.04 + t2 * 0.02})`);
      n1.addColorStop(1, 'transparent');
      ctx.fillStyle = n1;
      ctx.fillRect(0, 0, w, h);

      const n2 = ctx.createRadialGradient(cx * 1.6 - t1 * cx * 0.3, cy * 0.75, 0, cx * 1.6 - t1 * cx * 0.3, cy * 0.75, 400);
      n2.addColorStop(0, `rgba(${c.tertiary.join(',')}, ${c.dark ? 0.04 + t1 * 0.02 : 0.03 + t1 * 0.015})`);
      n2.addColorStop(1, 'transparent');
      ctx.fillStyle = n2;
      ctx.fillRect(0, 0, w, h);

      // ══════════════════════════════════════════════
      // 2. CENTRAL ENERGY CORE
      // ══════════════════════════════════════════════
      const coreAlpha = c.dark ? 0.14 + t1 * 0.08 : 0.06 + t1 * 0.04;
      const core1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, 280);
      core1.addColorStop(0, `rgba(${c.coreMid.join(',')}, ${coreAlpha})`);
      core1.addColorStop(0.3, `rgba(${c.coreMid.join(',')}, ${coreAlpha * 0.3})`);
      core1.addColorStop(0.6, `rgba(${c.secondary.join(',')}, ${coreAlpha * 0.08})`);
      core1.addColorStop(1, 'transparent');
      ctx.fillStyle = core1;
      ctx.fillRect(0, 0, w, h);

      // Bright inner core
      const core2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90);
      core2.addColorStop(0, `rgba(${c.coreInner.join(',')}, ${c.dark ? 0.1 + t1 * 0.05 : 0.04 + t1 * 0.02})`);
      core2.addColorStop(1, 'transparent');
      ctx.fillStyle = core2;
      ctx.fillRect(0, 0, w, h);

      // ══════════════════════════════════════════════
      // 3. SEGMENTED ROTATING RINGS
      // ══════════════════════════════════════════════
      const rings = [
        { r: 130, segs: 60, gap: 4, speed: 0.0008, primary: true, width: 2, alpha: c.dark ? 0.25 : 0.15 },
        { r: 185, segs: 80, gap: 3, speed: -0.0005, primary: false, width: 1.5, alpha: c.dark ? 0.15 : 0.10 },
        { r: 250, segs: 120, gap: 2, speed: 0.0003, primary: false, width: 1, alpha: c.dark ? 0.10 : 0.06 },
        { r: 330, segs: 40, gap: 8, speed: -0.0002, primary: true, width: 0.8, alpha: c.dark ? 0.06 : 0.04 },
      ];

      rings.forEach(ring => {
        const rot = frame * ring.speed;
        const segAngle = (Math.PI * 2) / ring.segs;
        const gapAngle = segAngle * (ring.gap / 10);
        const col = ring.primary ? c.primary : c.secondary;

        ctx.strokeStyle = `rgba(${col.join(',')}, ${ring.alpha + t1 * ring.alpha * 0.5})`;
        ctx.lineWidth = ring.width;

        for (let i = 0; i < ring.segs; i++) {
          const s = rot + i * segAngle + gapAngle / 2;
          const e = rot + (i + 1) * segAngle - gapAngle / 2;
          ctx.beginPath();
          ctx.arc(cx, cy, ring.r, s, e);
          ctx.stroke();
        }
      });

      // ══════════════════════════════════════════════
      // 4. RADAR SCANNER
      // ══════════════════════════════════════════════
      const scanAngle = frame * 0.008;
      const scanLen = 320;

      const scanGrad = ctx.createConicGradient(scanAngle, cx, cy);
      const scanColor = c.primary;
      scanGrad.addColorStop(0, `rgba(${scanColor.join(',')}, ${c.dark ? 0.18 : 0.10})`);
      scanGrad.addColorStop(0.06, `rgba(${scanColor.join(',')}, 0)`);
      scanGrad.addColorStop(0.5, 'transparent');
      scanGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = scanGrad;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, scanLen, scanAngle - 0.4, scanAngle);
      ctx.closePath();
      ctx.fill();

      // Scanner line
      ctx.strokeStyle = `rgba(${scanColor.join(',')}, ${c.dark ? 0.35 : 0.20})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(scanAngle) * scanLen, cy + Math.sin(scanAngle) * scanLen);
      ctx.stroke();

      // ══════════════════════════════════════════════
      // 5. PERSPECTIVE GRID
      // ══════════════════════════════════════════════
      const horizon = cy * 0.95;
      const gridAlpha = c.dark ? 0.35 : 0.12;
      ctx.lineWidth = 0.6;

      for (let i = 1; i <= 20; i++) {
        const t = i / 20;
        const y = horizon + (h - horizon) * Math.pow(t, 1.3);
        const spread = Math.pow(t, 0.7);
        ctx.globalAlpha = t * (gridAlpha + t1 * gridAlpha * 0.3);
        ctx.strokeStyle = `rgba(${c.grid.join(',')}, ${gridAlpha})`;
        ctx.beginPath();
        ctx.moveTo(cx - w * 0.75 * spread, y);
        ctx.lineTo(cx + w * 0.75 * spread, y);
        ctx.stroke();
      }

      for (let i = -10; i <= 10; i++) {
        const bx = cx + i * 75;
        ctx.globalAlpha = (1 - Math.abs(i) / 10 * 0.5) * (gridAlpha * 0.5 + t1 * 0.04);
        ctx.strokeStyle = `rgba(${c.grid.join(',')}, ${gridAlpha * 0.8})`;
        ctx.beginPath();
        ctx.moveTo(bx, h + 5);
        ctx.lineTo(cx + (bx - cx) * 0.05, horizon);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // ══════════════════════════════════════════════
      // 6. PARTICLES + CONNECTIONS
      // ══════════════════════════════════════════════
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const dx = cx - n.x, dy = cy - n.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        n.vx += (dx / dist) * 0.008;
        n.vy += (dy / dist) * 0.008;

        // STRONG mouse repulsion
        if (mx.x > 0) {
          const mdx = n.x - mx.x, mdy = n.y - mx.y;
          const md = Math.sqrt(mdx * mdx + mdy * mdy);
          if (md < 200) {
            const force = (200 - md) / 200 * 1.8;
            n.vx += (mdx / md) * force;
            n.vy += (mdy / md) * force;
          }
        }

        n.vx *= 0.985; n.vy *= 0.985;
        n.x += n.vx; n.y += n.vy;

        if (n.x < -50) n.x = w + 50;
        if (n.x > w + 50) n.x = -50;
        if (n.y < -50) n.y = h + 50;
        if (n.y > h + 50) n.y = -50;
      }

      // Connections
      const connDist = 150;
      ctx.lineWidth = 0.5;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < connDist) {
            const a = (1 - d / connDist) * (c.dark ? 0.18 : 0.10);
            const isA = nodes[i].type === 0 || nodes[j].type === 0;
            ctx.strokeStyle = `rgba(${isA ? c.nodeA : c.nodeB}, ${a})`;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw nodes with glow
      for (const n of nodes) {
        const col = n.type === 0 ? c.nodeA : c.nodeB;
        // Glow
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.size * 8);
        g.addColorStop(0, `rgba(${col}, ${n.baseAlpha * 0.35})`);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.fillRect(n.x - n.size * 8, n.y - n.size * 8, n.size * 16, n.size * 16);
        // Core
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${col}, ${n.baseAlpha})`;
        ctx.fill();
      }

      // ══════════════════════════════════════════════
      // 7. ENERGY PULSES
      // ══════════════════════════════════════════════
      if (frame % 100 === 0) {
        pulses.push({ radius: 0, maxRadius: 450, alpha: c.dark ? 0.18 : 0.10 });
      }
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.radius += 1.8;
        p.alpha *= 0.992;
        if (p.alpha < 0.002 || p.radius > p.maxRadius) { pulses.splice(i, 1); continue; }
        ctx.strokeStyle = `rgba(${c.primary.join(',')}, ${p.alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, p.radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ══════════════════════════════════════════════
      // 8. MOUSE FIELD
      // ══════════════════════════════════════════════
      if (mx.x > 0) {
        const eg = ctx.createRadialGradient(mx.x, mx.y, 0, mx.x, mx.y, 180);
        eg.addColorStop(0, `rgba(${c.primary.join(',')}, ${c.dark ? 0.12 : 0.06})`);
        eg.addColorStop(0.3, `rgba(${c.secondary.join(',')}, ${c.dark ? 0.04 : 0.02})`);
        eg.addColorStop(1, 'transparent');
        ctx.fillStyle = eg;
        ctx.fillRect(0, 0, w, h);

        // Rings
        ctx.strokeStyle = `rgba(${c.primary.join(',')}, ${c.dark ? 0.10 : 0.06})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(mx.x, mx.y, 50 + t1 * 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(${c.primary.join(',')}, ${c.dark ? 0.05 : 0.03})`;
        ctx.beginPath();
        ctx.arc(mx.x, mx.y, 25 + t1 * 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ══════════════════════════════════════════════
      // 9. HUD CORNERS
      // ══════════════════════════════════════════════
      const bs = 20, gp = 24;
      const hudAlpha = c.dark ? 0.14 : 0.10;
      ctx.strokeStyle = `rgba(${c.hud.join(',')}, ${hudAlpha})`;
      ctx.lineWidth = 1;
      // TL
      ctx.beginPath(); ctx.moveTo(gp + bs, gp); ctx.lineTo(gp, gp); ctx.lineTo(gp, gp + bs); ctx.stroke();
      // TR
      ctx.beginPath(); ctx.moveTo(w - gp - bs, gp); ctx.lineTo(w - gp, gp); ctx.lineTo(w - gp, gp + bs); ctx.stroke();
      // BL
      ctx.beginPath(); ctx.moveTo(gp + bs, h - gp); ctx.lineTo(gp, h - gp); ctx.lineTo(gp, h - gp - bs); ctx.stroke();
      // BR
      ctx.beginPath(); ctx.moveTo(w - gp - bs, h - gp); ctx.lineTo(w - gp, h - gp); ctx.lineTo(w - gp, h - gp - bs); ctx.stroke();

      // Labels
      ctx.font = '9px Inter, monospace';
      ctx.fillStyle = `rgba(${c.hud.join(',')}, ${hudAlpha * 1.2})`;
      ctx.textAlign = 'left';
      ctx.fillText('NEXUS.v8', gp, h - gp - bs - 4);
      ctx.textAlign = 'right';
      ctx.fillText(`${w}×${h}`, w - gp, gp + bs + 14);

      // ══════════════════════════════════════════════
      // 10. SCAN LINE
      // ══════════════════════════════════════════════
      const sy = (frame * 0.6) % (h * 1.3) - h * 0.15;
      ctx.globalAlpha = c.dark ? 0.03 : 0.015;
      ctx.fillStyle = `rgba(${c.secondary.join(',')}, 1)`;
      ctx.fillRect(0, sy, w, 1);
      ctx.globalAlpha = 1;

      animId = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      obs.disconnect();
    };
  }, [getTheme]);

  return <canvas ref={canvasRef} className="nx-atmosphere" aria-hidden="true" />;
}
