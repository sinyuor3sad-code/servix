'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Lock, Unlock, Receipt, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import type { PosShiftData } from '../pos-types';
import {
  B, T, TN, G2, INP,
  brd, bg, accentBg, accentColor, primaryBg, fmt,
} from '../pos-constants';

interface ShiftGateProps {
  children: (shift: PosShiftData) => React.ReactNode;
}

export function ShiftGate({ children }: ShiftGateProps) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [openingAmount, setOpeningAmount] = useState('');

  const { data: shift, isLoading, error } = useQuery<PosShiftData | null>({
    queryKey: ['pos-shift-current'],
    queryFn: async () => {
      if (!accessToken) return null;
      try {
        return await api.get<PosShiftData>('/pos-shifts/current', accessToken);
      } catch {
        return null; // 404 = no open shift
      }
    },
    enabled: !!accessToken,
    refetchOnWindowFocus: false,
  });

  const openMut = useMutation({
    mutationFn: async () => {
      const balance = parseFloat(openingAmount);
      if (isNaN(balance) || balance < 0) throw new Error('أدخل مبلغ صحيح');
      return api.post<PosShiftData>('/pos-shifts/open', { openingBalance: balance }, accessToken!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-shift-current'] });
      toast.success('تم فتح الوردية');
      setOpeningAmount('');
    },
    onError: (e: Error) => toast.error(e.message || 'فشل فتح الوردية'),
  });

  if (isLoading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-[var(--background)]" dir="rtl">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-[var(--brand-accent)] border-t-transparent" />
          <p className="text-[12px] text-[var(--muted-foreground)]">جارٍ التحقق من الوردية...</p>
        </div>
      </div>
    );
  }

  // Shift is open — render POS
  if (shift && shift.status === 'open') {
    return <>{children(shift)}</>;
  }

  // No open shift — show Open Shift screen
  return (
    <div className="flex h-[100dvh] items-center justify-center bg-[var(--background)]" dir="rtl">
      <div className={`mx-4 w-full max-w-[420px] rounded-3xl ${brd(4)} border backdrop-blur-xl ${G2} p-8 space-y-6`}>
        {/* Header */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl shadow-2xl" style={primaryBg}>
            <Lock size={32} className="text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-[20px] font-black text-[var(--foreground)]">فتح وردية جديدة</h1>
            <p className="mt-1 text-[12px] text-[var(--muted-foreground)]">أدخلي مبلغ البداية في الصندوق لبدء العمل</p>
          </div>
        </div>

        {/* Amount Input */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-[var(--muted-foreground)]">مبلغ البداية في الصندوق</label>
          <input
            type="number"
            value={openingAmount}
            onChange={e => setOpeningAmount(e.target.value)}
            placeholder="0.00"
            dir="ltr"
            className={`w-full rounded-2xl ${brd(5)} border ${bg(3)} px-4 py-4 text-center text-[24px] font-black text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]/30 ${T}`}
            style={TN}
            onKeyDown={e => { if (e.key === 'Enter') openMut.mutate(); }}
          />
          <p className="text-center text-[9px] text-[var(--muted-foreground)]" style={{ opacity: 0.5 }}>ر.س</p>
        </div>

        {/* Quick amounts */}
        <div className="flex gap-2">
          {[0, 100, 200, 500, 1000].map(v => (
            <button
              key={v}
              onClick={() => setOpeningAmount(String(v))}
              className={`${B} flex-1 rounded-xl ${brd(4)} border py-2.5 text-[11px] font-bold text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:${bg(4)}`}
              style={TN}
            >
              {v === 0 ? 'صفر' : v}
            </button>
          ))}
        </div>

        {/* Open Button */}
        <button
          onClick={() => openMut.mutate()}
          disabled={openMut.isPending}
          className={`${B} flex h-14 w-full items-center justify-center gap-3 rounded-2xl text-[14px] font-black shadow-xl disabled:opacity-30`}
          style={{ background: 'linear-gradient(135deg, var(--brand-accent), color-mix(in srgb, var(--brand-accent) 80%, #000))', color: '#000' }}
        >
          {openMut.isPending ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <>
              <Unlock size={18} />
              فتح الوردية
            </>
          )}
        </button>

        {/* Branding */}
        <div className="flex items-center justify-center gap-2 pt-2" style={{ opacity: 0.15 }}>
          <Receipt size={12} />
          <span className="text-[9px] font-bold tracking-wider text-[var(--foreground)]">SERVIX POS</span>
        </div>
      </div>
    </div>
  );
}
