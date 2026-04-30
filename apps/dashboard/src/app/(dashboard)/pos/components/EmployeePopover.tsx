'use client';

import { useEffect, useRef } from 'react';
import { X, User } from 'lucide-react';
import type { Service, Employee } from '@/types';
import { B, T, TN, accentBg, accentColor, fmt } from '../pos-constants';

interface EmployeePopoverProps {
  service: Service;
  employees: Employee[];
  onSelect: (emp: Employee | null) => void;
  onCancel: () => void;
}

export function EmployeePopover({ service, employees, onSelect, onCancel }: EmployeePopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handler = (ev: MouseEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) onCancel();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onCancel]);

  // Close on Escape
  useEffect(() => {
    const handler = (ev: KeyboardEvent) => { if (ev.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <>
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
        style={{ animation: 'empOverlay 150ms ease-out' }}
      />

      {/* Popover */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          ref={ref}
          className="w-full max-w-[320px] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
          style={{
            background: 'linear-gradient(170deg, #1e1e34 0%, #16162a 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            animation: 'empSlide 250ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-bold text-white">{service.nameAr}</p>
              <p className="text-[12px] font-bold text-white/25" style={TN}>{fmt(service.price)} ر.س</p>
            </div>
            <button
              onClick={onCancel}
              className={`${B} flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-white/30 hover:bg-white/10 hover:text-white/60`}
            >
              <X size={12} />
            </button>
          </div>

          {/* Divider */}
          <div className="mx-5 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

          {/* Label */}
          <div className="px-5 pt-3 pb-2">
            <p className="text-[11px] font-semibold text-white/35">اختر الموظفة</p>
          </div>

          {/* Employee buttons */}
          <div className="px-5 pb-2 grid grid-cols-2 gap-2">
            {employees.map(emp => (
              <button
                key={emp.id}
                onClick={() => onSelect(emp)}
                className={`${B} flex items-center gap-2 rounded-xl px-3 py-3 text-start hover:scale-[1.02]`}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold"
                  style={{ ...accentColor, background: 'color-mix(in srgb, var(--brand-accent) 12%, transparent)' }}
                >
                  {emp.fullName.charAt(0)}
                </div>
                <span className="truncate text-[12px] font-semibold text-white/80">
                  {emp.fullName.split(' ')[0]}
                </span>
              </button>
            ))}
          </div>

          {/* Skip button */}
          <div className="px-5 pb-4 pt-1">
            <button
              onClick={() => onSelect(null)}
              className={`${B} flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-semibold text-white/30 hover:text-white/50 hover:bg-white/3`}
              style={{ border: '1px dashed rgba(255,255,255,0.08)' }}
            >
              <User size={11} />
              بدون تحديد موظفة
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes empOverlay {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes empSlide {
          from {
            opacity: 0;
            transform: scale(0.92) translateY(8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </>
  );
}
