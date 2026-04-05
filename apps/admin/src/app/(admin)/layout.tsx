'use client';

import { type ReactNode, type ReactElement } from 'react';
import { CommandBar } from '@/components/command/CommandBar';

export default function AdminLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--os-void, #030305)' }}>
      {children}
      <CommandBar />
    </div>
  );
}
