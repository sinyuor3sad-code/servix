'use client';

import { type ReactNode, type ReactElement } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/nexus/Sidebar';
import { MobileNav } from '@/components/nexus/MobileNav';

export default function AdminLayout({ children }: { children: ReactNode }): ReactElement {
  const pathname = usePathname();
  const isDashboard = pathname === '/dashboard';

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
