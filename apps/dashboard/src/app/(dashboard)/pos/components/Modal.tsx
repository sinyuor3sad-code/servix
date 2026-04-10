'use client';

import { X } from 'lucide-react';
import { G2, BS, bg } from '../pos-constants';

export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--background)_85%,transparent)] backdrop-blur-xl" />
      <div onClick={e => e.stopPropagation()} className={`relative max-h-[85vh] overflow-y-auto rounded-2xl ${G2} ${wide ? 'w-full max-w-lg' : 'w-full max-w-md'} p-6`}>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-sm font-bold text-[var(--foreground)]">{title}</h3>
          <button onClick={onClose} className={`${BS} flex h-8 w-8 items-center justify-center rounded-xl ${bg(5)} text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}><X size={14} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
