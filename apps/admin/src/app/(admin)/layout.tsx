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
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '2px solid var(--gold, #C9A84C)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
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

