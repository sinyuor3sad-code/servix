'use client';

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';

interface DropdownItem {
  label: string;
  icon?: ReactNode;
  color?: string;
  danger?: boolean;
  onClick: () => void;
}

interface Props {
  items: DropdownItem[];
  /** Optional custom trigger button. Defaults to MoreHorizontal icon. */
  trigger?: ReactNode;
}

export function DropdownMenu({ items, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; flipUp: boolean }>({ top: 0, left: 0, flipUp: false });
  const btnRef = useRef<HTMLButtonElement>(null);

  const recompute = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const flipUp = r.bottom + 200 > window.innerHeight;
    setPos({
      top: flipUp ? r.top : r.bottom + 4,
      left: r.right, // anchor to the right edge of button (RTL-friendly)
      flipUp,
    });
  }, []);

  const toggle = useCallback(() => {
    if (!open) recompute();
    setOpen((v) => !v);
  }, [open, recompute]);

  // Close on scroll / resize
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        className="nx-btn"
        style={{ padding: 6, border: 'none', background: 'none', minHeight: 'auto' }}
        onClick={toggle}
      >
        {trigger ?? <MoreHorizontal size={16} />}
      </button>

      {open && createPortal(
        <>
          {/* Backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
            onClick={() => setOpen(false)}
          />
          {/* Menu */}
          <div
            style={{
              position: 'fixed',
              zIndex: 9999,
              top: pos.flipUp ? undefined : pos.top,
              bottom: pos.flipUp ? (window.innerHeight - pos.top + 4) : undefined,
              right: window.innerWidth - pos.left,
              minWidth: 170,
              background: 'var(--surface-overlay)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: 6,
              boxShadow: 'var(--shadow-floating)',
              animation: 'nx-dropdown-in 0.2s var(--ease)',
            }}
          >
            {items.map((item, i) => (
              <button
                key={i}
                onClick={() => { item.onClick(); setOpen(false); }}
                style={{
                  display: 'flex',
                  width: '100%',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'none',
                  color: item.danger ? '#F87171' : (item.color || 'var(--muted)'),
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  minHeight: 40,
                }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'var(--surface-hover)'; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'none'; }}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
