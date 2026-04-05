'use client';

import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  color: string;
  life: number;
  maxLife: number;
}

export function AmbientCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const particlesRef = useRef<Particle[]>([]);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
    };
    window.addEventListener('resize', resize);

    const onMouse = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', onMouse);

    // Initialize particles
    const PARTICLE_COUNT = 60;
    const particles: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(createParticle(w, h));
    }
    particlesRef.current = particles;

    function createParticle(w: number, h: number): Particle {
      const isGold = Math.random() > 0.7;
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.1 - 0.05,
        size: Math.random() * 1.5 + 0.3,
        opacity: Math.random() * 0.3 + 0.05,
        color: isGold ? '201,168,76' : '99,102,241',
        life: 0,
        maxLife: Math.random() * 600 + 300,
      };
    }

    let animId: number;
    function animate() {
      frameRef.current++;
      ctx!.clearRect(0, 0, w, h);

      // Draw subtle radial gradient pulse in center
      const pulsePhase = Math.sin(frameRef.current * 0.008) * 0.5 + 0.5;
      const gradient = ctx!.createRadialGradient(
        w * 0.5, h * 0.45, 0,
        w * 0.5, h * 0.45, 400 + pulsePhase * 50
      );
      gradient.addColorStop(0, `rgba(201,168,76, ${0.015 + pulsePhase * 0.008})`);
      gradient.addColorStop(0.5, `rgba(201,168,76, ${0.005 + pulsePhase * 0.003})`);
      gradient.addColorStop(1, 'transparent');
      ctx!.fillStyle = gradient;
      ctx!.fillRect(0, 0, w, h);

      // Draw and update particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.life++;

        // Fade in/out
        const lifeRatio = p.life / p.maxLife;
        let alpha = p.opacity;
        if (lifeRatio < 0.1) alpha *= lifeRatio / 0.1;
        if (lifeRatio > 0.8) alpha *= (1 - lifeRatio) / 0.2;

        // Mouse repulsion
        const dx = p.x - mouseRef.current.x;
        const dy = p.y - mouseRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          const force = (150 - dist) / 150 * 0.3;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }

        // Damping
        p.vx *= 0.995;
        p.vy *= 0.995;

        p.x += p.vx;
        p.y += p.vy;

        // Draw particle
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${p.color}, ${alpha})`;
        ctx!.fill();

        // Draw subtle glow
        if (p.size > 1) {
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(${p.color}, ${alpha * 0.1})`;
          ctx!.fill();
        }

        // Reset if dead or out of bounds
        if (p.life > p.maxLife || p.x < -50 || p.x > w + 50 || p.y < -50 || p.y > h + 50) {
          Object.assign(particles[i], createParticle(w, h));
        }
      }

      // Draw faint horizontal scan line
      const scanY = (frameRef.current * 0.3) % h;
      ctx!.fillStyle = `rgba(201,168,76, 0.008)`;
      ctx!.fillRect(0, scanY, w, 1);

      animId = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouse);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="nx-ambient-canvas" aria-hidden="true" />
  );
}
