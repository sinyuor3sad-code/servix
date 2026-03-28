/**
 * SeasonalParticles — Client wrapper that lazy-loads <Particles />
 * Used by [slug]/layout.tsx (Server Component) to conditionally render particles.
 */
'use client';

import dynamic from 'next/dynamic';

const Particles = dynamic(() => import('@/components/particles'), { ssr: false });

interface SeasonalParticlesProps {
  enabled: boolean;
}

export default function SeasonalParticles({ enabled }: SeasonalParticlesProps) {
  if (!enabled) return null;
  return <Particles zIndex={-1} />;
}
