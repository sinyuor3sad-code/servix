'use client';

import { useEffect, useRef } from 'react';

/**
 * THE FABRIC — A subtle intelligence mesh of interconnected nodes.
 * Not particles. Not decoration. A living grid that breathes
 * and reacts to the owner's presence (mouse position).
 */
export function Fabric() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let w = 0, h = 0;
    let frame = 0;

    // Grid configuration
    const SPACING = 80;
    let cols = 0, rows = 0;
    let nodes: { x: number; y: number; baseOpacity: number }[] = [];

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * window.devicePixelRatio;
      canvas.height = h * window.devicePixelRatio;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      cols = Math.ceil(w / SPACING) + 2;
      rows = Math.ceil(h / SPACING) + 2;
      nodes = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          nodes.push({
            x: c * SPACING,
            y: r * SPACING,
            baseOpacity: 0.02 + Math.random() * 0.015,
          });
        }
      }
    }

    resize();
    window.addEventListener('resize', resize);

    const onMouse = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', onMouse);

    let animId: number;

    function draw() {
      frame++;
      ctx.clearRect(0, 0, w, h);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const breathe = Math.sin(frame * 0.006) * 0.5 + 0.5;

      // Draw grid lines (very subtle)
      ctx.strokeStyle = `rgba(255,255,255, ${0.012 + breathe * 0.005})`;
      ctx.lineWidth = 0.5;

      for (let r = 0; r < rows; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * SPACING);
        ctx.lineTo(w, r * SPACING);
        ctx.stroke();
      }
      for (let c = 0; c < cols; c++) {
        ctx.beginPath();
        ctx.moveTo(c * SPACING, 0);
        ctx.lineTo(c * SPACING, h);
        ctx.stroke();
      }

      // Draw nodes at intersections
      for (const node of nodes) {
        const dx = node.x - mx;
        const dy = node.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const proximity = Math.max(0, 1 - dist / 250);

        // Base glow
        let opacity = node.baseOpacity + breathe * 0.008;

        // Mouse proximity boosts the node
        if (proximity > 0) {
          opacity += proximity * 0.15;

          // Draw the glow halo for nearby nodes
          const gradient = ctx.createRadialGradient(
            node.x, node.y, 0,
            node.x, node.y, 20 + proximity * 30
          );
          gradient.addColorStop(0, `rgba(184,153,62, ${proximity * 0.06})`);
          gradient.addColorStop(1, 'transparent');
          ctx.fillStyle = gradient;
          ctx.fillRect(node.x - 50, node.y - 50, 100, 100);
        }

        // Draw node dot
        ctx.beginPath();
        ctx.arc(node.x, node.y, 1 + proximity * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = proximity > 0.3
          ? `rgba(184,153,62, ${opacity * 2})`
          : `rgba(255,255,255, ${opacity})`;
        ctx.fill();
      }

      // Central ambient glow (very subtle)
      const cGrad = ctx.createRadialGradient(
        w * 0.5, h * 0.5, 0,
        w * 0.5, h * 0.5, 350
      );
      cGrad.addColorStop(0, `rgba(184,153,62, ${0.012 + breathe * 0.006})`);
      cGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = cGrad;
      ctx.fillRect(0, 0, w, h);

      animId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouse);
    };
  }, []);

  return <canvas ref={canvasRef} className="sv-fabric" aria-hidden="true" />;
}
