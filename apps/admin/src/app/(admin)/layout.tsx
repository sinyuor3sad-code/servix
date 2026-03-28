'use client';

import { useState, useCallback, type ReactNode, type ReactElement } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

export default function AdminLayout({ children }: { children: ReactNode }): ReactElement {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#06060a]">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={useCallback(() => setMobileOpen(false), [])} />
      <div className="flex flex-1 flex-col">
        <Header onMenuToggle={useCallback(() => setMobileOpen(p => !p), [])} />
        <main
          className="relative flex-1 overflow-y-auto p-5 md:p-7"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.025) 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        >
          {/* Ambient orbs */}
          <div className="pointer-events-none fixed top-[-200px] right-[-150px] h-[600px] w-[600px] rounded-full opacity-60" style={{ background: 'radial-gradient(circle, rgba(234,179,8,0.05) 0%, transparent 65%)', filter: 'blur(80px)' }} />
          <div className="pointer-events-none fixed bottom-[-100px] left-[-100px] h-[400px] w-[400px] rounded-full opacity-60" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.04) 0%, transparent 65%)', filter: 'blur(80px)' }} />
          <div className="relative z-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
