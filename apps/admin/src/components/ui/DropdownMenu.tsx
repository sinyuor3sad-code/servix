'use client';

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, X } from 'lucide-react';

interface DropdownItem {
  label?: string;
  icon?: ReactNode;
  color?: string;
  danger?: boolean;
  divider?: boolean;
  onClick?: () => void;
}

interface Props {
  items: DropdownItem[];
  trigger?: ReactNode;
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return mobile;
}

export function DropdownMenu({ items, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; flipUp: boolean }>({ top: 0, left: 0, flipUp: false });
  const btnRef = useRef<HTMLButtonElement>(null);
  const isMobile = useIsMobile();

  const recompute = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const flipUp = r.bottom + 200 > window.innerHeight;
    setPos({
      top: flipUp ? r.top : r.bottom + 4,
      left: r.right,
      flipUp,
    });
  }, []);

  const toggle = useCallback(() => {
    if (!open) recompute();
    setOpen((v) => !v);
  }, [open, recompute]);

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

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // Prevent body scroll when mobile sheet is open
  useEffect(() => {
    if (open && isMobile) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open, isMobile]);

  const renderItem = (item: DropdownItem, i: number) => {
    if (item.divider) {
      return <div key={`d-${i}`} style={{ height: 1, background: 'var(--border)', margin: '4px 8px' }} />;
    }
    return (
      <button
        key={i}
        onClick={() => { item.onClick?.(); setOpen(false); }}
        style={{
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          gap: 10,
          padding: isMobile ? '14px 16px' : '10px 12px',
          borderRadius: 8,
          border: 'none',
          background: 'none',
          color: item.danger ? '#F87171' : (item.color || 'var(--muted)'),
          fontSize: isMobile ? 15 : 13,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background 0.15s',
          minHeight: isMobile ? 48 : 40,
          textAlign: 'start',
          fontFamily: 'inherit',
        }}
        onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'var(--surface-hover)'; }}
        onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'none'; }}
      >
        {item.icon}
        {item.label}
      </button>
    );
  };

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
            style={{
              position: 'fixed', inset: 0, zIndex: 9998,
              background: isMobile ? 'rgba(0,0,0,0.5)' : 'transparent',
              backdropFilter: isMobile ? 'blur(4px)' : 'none',
            }}
            onClick={() => setOpen(false)}
          />

          {isMobile ? (
            /* ══ Mobile Bottom Sheet ══ */
            <div
              style={{
                position: 'fixed',
                zIndex: 9999,
                bottom: 0,
                left: 0,
                right: 0,
                maxHeight: '80vh',
                overflowY: 'auto',
                background: 'var(--surface-overlay, #111118)',
                backdropFilter: 'blur(40px)',
                WebkitBackdropFilter: 'blur(40px)',
                border: '1px solid var(--border)',
                borderBottom: 'none',
                borderRadius: '20px 20px 0 0',
                padding: '8px 8px 20px',
                boxShadow: '0 -10px 40px rgba(0,0,0,0.4)',
                animation: 'nx-sheet-up 0.3s ease',
              }}
            >
              {/* Handle bar */}
              <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 12px' }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
              </div>

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px 12px' }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--slate)' }}>الإجراءات</span>
                <button
                  onClick={() => setOpen(false)}
                  style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ghost)' }}
                >
                  <X size={14} />
                </button>
              </div>

              {items.map(renderItem)}

              {/* Safe area for bottom tabs */}
              <div style={{ height: 'env(safe-area-inset-bottom, 16px)' }} />
            </div>
          ) : (
            /* ══ Desktop Dropdown ══ */
            <div
              style={{
                position: 'fixed',
                zIndex: 9999,
                top: pos.flipUp ? undefined : pos.top,
                bottom: pos.flipUp ? (window.innerHeight - pos.top + 4) : undefined,
                right: window.innerWidth - pos.left,
                minWidth: 200,
                maxHeight: '70vh',
                overflowY: 'auto',
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
              {items.map(renderItem)}
            </div>
          )}
        </>,
        document.body,
      )}
    </>
  );
}
