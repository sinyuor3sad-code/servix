'use client';

import { useState, useCallback } from 'react';
import { QrCode, Loader2, Search, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import type { E } from '../pos-engine';
import type { Service } from '@/types';
import {
  B, BS, T, TN,
  brd, bg,
  accentBg, accentColor,
} from '../pos-constants';

interface OrderService {
  serviceId: string;
  nameAr: string;
  nameEn: string | null;
  price: number;
  duration: number;
}

interface OrderData {
  id: string;
  orderCode: string;
  status: string;
  services: OrderService[];
  totalEstimate: number;
}

export function OrderInput({ e }: { e: E }) {
  const { accessToken } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchOrder = useCallback(async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || loading) return;

    setLoading(true);
    setError('');

    try {
      // 1. Fetch the order
      const order = await api.get<OrderData>(
        `/salon/orders/${trimmed}`,
        accessToken!,
      );

      // 2. Auto-claim it
      try {
        await api.post(`/salon/orders/${trimmed}/claim`, {}, accessToken!);
      } catch (claimErr: unknown) {
        const err = claimErr as { statusCode?: number; message?: string };
        if (err.statusCode === 409) {
          setError('هذا الطلب مأخوذ من كاشيرة أخرى');
          setLoading(false);
          return;
        }
        // If claim fails for other reasons, continue anyway — services still load
      }

      // 3. Add services to cart
      const services = order.services || [];
      for (const svc of services) {
        // Try to find the service in POS data
        const existing = e.allSvcs.find((s: Service) => s.id === svc.serviceId);
        if (existing) {
          e.addToCart(existing);
        } else {
          // Service not found in POS — create a synthetic one
          e.addToCart({
            id: svc.serviceId,
            nameAr: svc.nameAr,
            nameEn: svc.nameEn ?? '',
            price: svc.price,
            duration: svc.duration,
            isActive: true,
            categoryId: '',
            sortOrder: 0,
          } as Service);
        }
      }

      toast.success(`✅ تم جلب الطلب ${trimmed}`);
      setCode('');

      // Link this self-order to the invoice that will be created
      e.setSelfOrderId(order.id);
    } catch (err: unknown) {
      const apiErr = err as { statusCode?: number; message?: string };
      if (apiErr.statusCode === 404) {
        setError('الطلب غير موجود أو منتهي الصلاحية');
      } else {
        setError(apiErr.message || 'حدث خطأ');
      }
    } finally {
      setLoading(false);
    }
  }, [code, loading, accessToken, e]);

  const handleKeyDown = (ev: React.KeyboardEvent) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      fetchOrder();
    }
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-2 ${brd(4)} border-b`}>
      {/* Icon */}
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={accentBg}>
        <QrCode size={12} className="text-black" />
      </div>

      {/* Input */}
      <div className="relative flex-1">
        <input
          type="text"
          value={code}
          onChange={ev => setCode(ev.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          placeholder="رقم الطلب (مثل A482)"
          maxLength={10}
          dir="ltr"
          className={`w-full rounded-xl ${brd(5)} border ${bg(3)} px-3 py-2 text-center text-[11px] font-bold text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] placeholder:font-normal focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]/30 ${T}`}
          style={{ ...TN, letterSpacing: '0.15em' }}
        />
      </div>

      {/* Button */}
      <button
        onClick={fetchOrder}
        disabled={!code.trim() || loading}
        className={`${BS} flex h-8 items-center gap-1 rounded-xl px-3 text-[9px] font-bold text-black disabled:opacity-20 disabled:pointer-events-none`}
        style={accentBg}
      >
        {loading ? (
          <Loader2 size={11} className="animate-spin" />
        ) : (
          <>
            <Search size={10} />
            جلب
          </>
        )}
      </button>

      {/* Error badge */}
      {error && (
        <div className="flex items-center gap-1 rounded-lg bg-red-500/10 px-2 py-1 text-[8px] font-bold text-red-400">
          <AlertCircle size={9} />
          <span className="max-w-[120px] truncate">{error}</span>
          <button onClick={() => setError('')} className={`${BS} ms-0.5 text-red-400/50 hover:text-red-400`}>×</button>
        </div>
      )}
    </div>
  );
}
