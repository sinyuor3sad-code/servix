'use client';

import { type ReactNode, type ReactElement, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/nexus/Sidebar';
import { MobileNav } from '@/components/nexus/MobileNav';
import { useAuthStore } from '@/stores/auth.store';

export default function AdminLayout({ children }: { children: ReactNode }): ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const isDashboard = pathname === '/dashboard';
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Wait for Zustand to hydrate from localStorage before checking auth
    if (!hasHydrated) return;

    // Client-side auth guard — redirect to login if not authenticated
    if (!user || !accessToken) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    } else {
      setChecked(true);
    }
  }, [user, accessToken, hasHydrated, router, pathname]);

  // Show nothing while checking auth (or waiting for hydration)
  if (!checked) {
    return (
      <div style={{
        height: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(168deg, #020208 0%, #06061a 35%, #0a0812 65%, #030305 100%)',
      }}>
        <div style={{
          fontSize: 36, fontWeight: 900, letterSpacing: '0.12em',
          color: 'rgba(212,175,55, 0.15)',
          textShadow: '0 0 40px rgba(212,175,55,0.08)',
          animation: 'nx-brand-pulse 2s ease-in-out infinite',
          fontFamily: '"Inter", system-ui, sans-serif',
        }}>
          S
        </div>
        <style>{`
          @keyframes nx-brand-pulse {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.05); text-shadow: 0 0 60px rgba(212,175,55,0.15); }
          }
        `}</style>
      </div>
    );
  }

  // Dashboard has its own full-viewport layout but still needs mobile nav
  if (isDashboard) {
    return <><MobileNav />{children}</>;
  }

  return (
    <div className="nx-shell">
      <Sidebar />
      <MobileNav />
      <main className="nx-content">
        {children}
      </main>
    </div>
  );
}

