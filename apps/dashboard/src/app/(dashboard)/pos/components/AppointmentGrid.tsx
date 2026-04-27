'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Clock, User, Users, ShoppingCart, Loader2, Calendar,
  AlertCircle, MessageSquare,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import type { E } from '../pos-engine';
import {
  B, BS, T, TN,
  brd, bg, accentBg, accentColor, fmt,
} from '../pos-constants';

interface AppointmentService {
  id: string;
  serviceId: string;
  employeeId?: string;
  price: number;
  duration: number;
  service: { id: string; nameAr: string; price: number; duration: number };
  employee?: { id: string; fullName: string };
}

interface Appointment {
  id: string;
  clientId: string;
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  totalPrice: number;
  totalDuration: number;
  notes?: string;
  client: { id: string; fullName: string; phone: string };
  employee: { id: string; fullName: string };
  appointmentServices: AppointmentService[];
}

const STATUS_MAP: Record<string, { color: string; label: string; border: string }> = {
  confirmed:   { color: 'text-emerald-400', label: 'مؤكد',      border: 'border-s-emerald-400' },
  pending:     { color: 'text-amber-400',   label: 'بانتظار',   border: 'border-s-amber-400' },
  in_progress: { color: 'text-sky-400',     label: 'جارية',     border: 'border-s-sky-400' },
  completed:   { color: 'text-zinc-500',    label: 'مكتملة',    border: 'border-s-zinc-500' },
  cancelled:   { color: 'text-red-400',     label: 'ملغاة',     border: 'border-s-red-400' },
  no_show:     { color: 'text-red-500',     label: 'لم تحضر',   border: 'border-s-red-500' },
};

const CAN_CONVERT = new Set(['pending', 'confirmed', 'in_progress']);

export function AppointmentGrid({ e }: { e: E }) {
  const { accessToken } = useAuth();

  const { data: appointments, isLoading } = useQuery<Appointment[]>({
    queryKey: ['pos-appointments-today'],
    queryFn: () => api.get<Appointment[]>('/appointments/today', accessToken!),
    enabled: !!accessToken && e.showAppointments,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={20} className="animate-spin text-[var(--brand-accent)]" />
          <p className="text-[10px] text-[var(--muted-foreground)]">جارٍ تحميل المواعيد...</p>
        </div>
      </div>
    );
  }

  const list = appointments ?? [];

  if (list.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-[var(--muted-foreground)]" style={{ opacity: 0.2 }}>
        <Calendar size={28} strokeWidth={1} />
        <p className="text-[10px]">لا توجد مواعيد اليوم</p>
      </div>
    );
  }

  return (
    <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
      {list.map(appt => {
        const st = STATUS_MAP[appt.status] ?? STATUS_MAP.pending;
        const canConvert = CAN_CONVERT.has(appt.status);
        const services = appt.appointmentServices?.map(as => as.service?.nameAr).filter(Boolean).join(' + ') || '—';
        return (
          <div
            key={appt.id}
            className={`relative overflow-hidden rounded-2xl ${brd(3)} border ${bg(2)} border-s-[3px] ${st.border} ${T}`}
          >
            <div className="p-3 space-y-2">
              {/* Client name + Status */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${bg(4)} text-[10px] font-bold text-[var(--foreground)]`}>
                    {appt.client?.fullName?.[0] ?? '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-bold text-[var(--foreground)]">{appt.client?.fullName ?? 'عميلة'}</p>
                    <div className="flex items-center gap-1.5 text-[9px] text-[var(--muted-foreground)]">
                      <Clock size={8} />
                      <span style={TN}>{appt.startTime} - {appt.endTime}</span>
                    </div>
                  </div>
                </div>
                <span className={`shrink-0 rounded-md px-2 py-0.5 text-[7px] font-bold ${st.color}`} style={{ background: 'color-mix(in srgb, currentColor 10%, transparent)' }}>
                  {st.label}
                </span>
              </div>

              {/* Services */}
              <div className={`rounded-lg ${bg(3)} px-2.5 py-1.5`}>
                <p className="text-[9px] text-[var(--foreground)] leading-relaxed">{services}</p>
              </div>

              {/* Employee + Price */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-[9px] text-[var(--muted-foreground)]">
                  <Users size={8} />
                  <span>{appt.employee?.fullName ?? '—'}</span>
                </div>
                <span className="text-[12px] font-black" style={{ ...TN, ...accentColor }}>{fmt(appt.totalPrice)}</span>
              </div>

              {/* Notes */}
              {appt.notes && (
                <div className="flex items-start gap-1">
                  <MessageSquare size={8} className="mt-0.5 shrink-0 text-[var(--muted-foreground)]" style={{ opacity: 0.4 }} />
                  <p className="text-[8px] text-[var(--muted-foreground)] leading-relaxed">{appt.notes}</p>
                </div>
              )}

              {/* Convert to Cart button */}
              {canConvert && (
                <button
                  onClick={() => e.loadAppointment(appt)}
                  className={`${B} flex h-9 w-full items-center justify-center gap-1.5 rounded-xl text-[10px] font-bold text-black shadow-md`}
                  style={accentBg}
                >
                  <ShoppingCart size={11} />
                  تحويل للسلة
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
