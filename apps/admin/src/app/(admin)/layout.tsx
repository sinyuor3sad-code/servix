'use client';

import { useState, useCallback, type ReactNode, type ReactElement } from 'react';
import { NerveRail, CommandBar, MobileNav } from '@/components/layout/NerveRail';

export default function AdminLayout({ children }: { children: ReactNode }): ReactElement {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--nx-void)' }}>
      {/* Nerve Rail — Desktop */}
      <NerveRail />

      {/* Mobile Nav */}
      <MobileNav open={mobileOpen} onClose={useCallback(() => setMobileOpen(false), [])} />

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Command Bar */}
        <CommandBar onMenuToggle={useCallback(() => setMobileOpen(p => !p), [])} />

        {/* Content */}
        <main className="relative flex-1 overflow-y-auto">
          {/* Ambient orbs — very subtle */}
          <div className="nx-orb" style={{
            top: '-250px', right: '-150px', width: '600px', height: '600px',
            background: 'radial-gradient(circle, rgba(212,168,83,0.03) 0%, transparent 60%)',
          }} />
          <div className="nx-orb" style={{
            bottom: '-150px', left: '-100px', width: '500px', height: '500px',
            background: 'radial-gradient(circle, rgba(129,140,248,0.025) 0%, transparent 60%)',
          }} />

          {/* Content with padding */}
          <div className="relative z-10 p-5 md:p-7 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
