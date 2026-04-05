'use client';

import { type ReactNode, type ReactElement } from 'react';
import { CommandBar } from '@/components/command/CommandBar';

export default function AdminLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <div className="min-h-screen" style={{ background: 'var(--os-bg)' }}>
      {/* Main content — full bleed, no sidebar */}
      <main className="mx-auto max-w-[1400px] px-5 md:px-8 lg:px-12">
        {children}
      </main>

      {/* Floating Command Bar */}
      <CommandBar />
    </div>
  );
}
