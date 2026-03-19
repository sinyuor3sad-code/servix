'use client';

import { useState, useCallback, type ReactNode, type ReactElement } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleMenuToggle = useCallback((): void => {
    setMobileOpen((prev) => !prev);
  }, []);

  const handleMobileClose = useCallback((): void => {
    setMobileOpen(false);
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={handleMobileClose} />
      <div className="flex flex-1 flex-col">
        <Header onMenuToggle={handleMenuToggle} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
