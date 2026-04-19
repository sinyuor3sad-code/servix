'use client';

import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, Send, Ban, CreditCard, Receipt, User, Calendar, Hash, CheckCircle2, Clock, XCircle, AlertCircle, Banknote, CreditCard as CardIcon, Building, Wallet, Printer, Download, FileText, ExternalLink, Copy, QrCode, Link, ShieldOff, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button, Spinner, Input, Select, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui';
import { dashboardService } from '@/services/dashboard.service';
import { useAuth } from '@/hooks/useAuth';
import type { InvoiceStatus, PaymentMethod, PaymentStatus } from '@/types';

const STATUS: Record<InvoiceStatus, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  paid: { label: 'مدفوعة', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
  draft: { label: 'مسودة', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200', icon: Clock },
  partially_paid: { label: 'مدفوعة جزئياً', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: AlertCircle },
  void: { label: 'ملغية', color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: XCircle },
  refunded: { label: 'مستردة', color: 'text-violet-600', bg: 'bg-violet-50 border-violet-200', icon: Receipt },
};

const METHOD_ICONS: Record<PaymentMethod, { icon: typeof Banknote; label: string }> = {
  cash: { icon: Banknote, label: 'نقداً' },
  card: { icon: CardIcon, label: 'بطاقة' },
  bank_transfer: { icon: Building, label: 'تحويل بنكي' },
  wallet: { icon: Wallet, label: 'محفظة' },
};

const PAY_STATUS: Record<PaymentStatus, string> = {
  completed: 'مكتمل', pending: 'معلق', failed: 'فاشل', refunded: 'مسترد',
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken, currentTenant } = useAuth();
  const qc = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);

  const [showPay, setShowPay] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [downloading, setDownloading] = useState(false);
  const [showConfirm, setShowConfirm] = useState<'revoke' | 'regenerate' | null>(null);
  const [showQR, setShowQR] = useState(false);

  const { data: inv, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => dashboardService.getInvoice(id, accessToken!),
    enabled: !!accessToken && !!id,
  });

  const payMut = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/pay`, { amount: Number(payAmount), method: payMethod }, accessToken!),
    onSuccess: () => { toast.success('✅ تم تسجيل الدفعة'); qc.invalidateQueries({ queryKey: ['invoice', id] }); setShowPay(false); setPayAmount(''); },
    onError: () => toast.error('خطأ في تسجيل الدفعة'),
  });

  const voidMut = useMutation({
    mutationFn: () => api.put(`/invoices/${id}/void`, {}, accessToken!),
    onSuccess: () => { toast.success('تم إلغاء الفاتورة'); qc.invalidateQueries({ queryKey: ['invoice', id] }); },
    onError: () => toast.error('خطأ'),
  });

  const sendMut = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/send`, { channel: 'whatsapp' }, accessToken!),
    onSuccess: () => toast.success('تم الإرسال'),
    onError: () => toast.error('خطأ في الإرسال'),
  });

  // Token mutations
  const generateTokenMut = useMutation({
    mutationFn: () => api.post<{ publicToken: string }>(`/invoices/${id}/generate-token`, {}, accessToken!),
    onSuccess: () => { toast.success('✅ تم توليد الرابط العام'); qc.invalidateQueries({ queryKey: ['invoice', id] }); },
    onError: () => toast.error('خطأ في توليد الرابط'),
  });

  const revokeTokenMut = useMutation({
    mutationFn: () => api.delete(`/invoices/${id}/revoke-token`, accessToken!),
    onSuccess: () => { toast.success('تم تعطيل الرابط'); qc.invalidateQueries({ queryKey: ['invoice', id] }); setShowConfirm(null); },
    onError: () => toast.error('خطأ'),
  });

  const regenerateTokenMut = useMutation({
    mutationFn: () => api.post<{ publicToken: string }>(`/invoices/${id}/regenerate-token`, {}, accessToken!),
    onSuccess: () => { toast.success('✅ تم إعادة توليد الرابط'); qc.invalidateQueries({ queryKey: ['invoice', id] }); setShowConfirm(null); },
    onError: () => toast.error('خطأ'),
  });

  // 🖨️ Print receipt
  const handlePrint = () => {
    if (!printRef.current) return;
    const printContent = printRef.current.innerHTML;
    const printWindow = window.open('', '_blank', 'width=350,height=600');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>فاتورة ${inv?.invoiceNumber}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, sans-serif; width: 80mm; padding: 4mm; font-size: 11px; color: #000; direction: rtl; }
          .center { text-align: center; }
          .salon-name { font-size: 16px; font-weight: 900; margin-bottom: 4px; }
          .divider { border-top: 1px dashed #999; margin: 6px 0; }
          .row { display: flex; justify-content: space-between; padding: 2px 0; }
          .bold { font-weight: 700; }
          .total-row { font-size: 14px; font-weight: 900; border-top: 2px solid #000; padding-top: 4px; margin-top: 4px; }
          .footer { font-size: 10px; color: #666; margin-top: 10px; text-align: center; }
          .qr-placeholder { width: 80px; height: 80px; margin: 8px auto; border: 1px dashed #ccc; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #999; }
        </style>
      </head>
      <body>
        ${printContent}
        <script>window.onload = function() { window.print(); window.close(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // 📄 Download PDF
  const handleDownloadPdf = async () => {
    if (!accessToken || !id) return;
    setDownloading(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
      const res = await fetch(`${apiBase}/invoices/${id}/pdf`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${inv?.invoiceNumber || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('تم تحميل الفاتورة');
    } catch {
      toast.error('فشل تحميل الفاتورة');
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;
  if (!inv) return (
    <div className="p-6 text-center">
      <p className="text-[var(--muted-foreground)]">لم يتم العثور على الفاتورة</p>
      <Button variant="outline" className="mt-4" onClick={() => router.push('/invoices')}>العودة</Button>
    </div>
  );

  const s = STATUS[inv.status] || STATUS.draft;
  const Icon = s.icon;
  const canPay = ['draft', 'partially_paid'].includes(inv.status);
  const canVoid = ['draft', 'partially_paid'].includes(inv.status);
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' });
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: true });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/invoices')} className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] transition">
            <ArrowRight className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black font-mono">{inv.invoiceNumber}</h1>
              <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold', s.bg, s.color)}>
                <Icon className="h-3 w-3" /> {s.label}
              </span>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{fmtDate(inv.createdAt)} · {fmtTime(inv.createdAt)}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* 🖨️ Print & 📄 PDF Buttons */}
          <Button size="sm" variant="outline" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5" /> طباعة
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownloadPdf} disabled={downloading}>
            <Download className="h-3.5 w-3.5" /> {downloading ? '...' : 'PDF'}
          </Button>
          {canPay && <Button size="sm" onClick={() => setShowPay(true)}><CreditCard className="h-3.5 w-3.5" /> دفع</Button>}
          {inv.status !== 'void' && <Button size="sm" variant="outline" onClick={() => sendMut.mutate()} disabled={sendMut.isPending}><Send className="h-3.5 w-3.5" /> إرسال</Button>}
          {canVoid && <Button size="sm" variant="destructive" onClick={() => voidMut.mutate()} disabled={voidMut.isPending}><Ban className="h-3.5 w-3.5" /> إلغاء</Button>}
        </div>
      </div>

      {/* Total Card */}
      <div className="rounded-2xl bg-gradient-to-l from-[var(--brand-primary)] to-[var(--brand-primary)]/80 p-6 text-white">
        <p className="text-xs opacity-70 mb-1">الإجمالي</p>
        <div className="text-4xl font-black tabular-nums" dir="ltr">{Number(inv.total).toLocaleString('en')} <span className="text-base font-medium opacity-70">SAR</span></div>
        <div className="flex items-center gap-4 mt-3 text-[11px] opacity-80">
          <span className="flex items-center gap-1"><User className="h-3 w-3" /> {inv.client?.fullName ?? 'زائر'}</span>
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {fmtDate(inv.createdAt)}</span>
        </div>
      </div>

      {/* ── Token Management Bar (only for paid invoices) ── */}
      {inv.status === 'paid' && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="flex items-center gap-2 mb-3">
            <QrCode className="h-4 w-4 text-[var(--brand-primary)]" />
            <span className="text-xs font-bold text-[var(--muted-foreground)]">الرابط العام</span>
            {(inv as any).publicToken && (inv as any).publicTokenStatus === 'active' && (
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[9px] font-bold text-emerald-700">نشط</span>
            )}
            {(inv as any).publicTokenStatus === 'revoked' && (
              <span className="rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[9px] font-bold text-red-600">معطّل</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {/* No token → Generate */}
            {!(inv as any).publicToken && (
              <Button size="sm" variant="outline" onClick={() => generateTokenMut.mutate()} disabled={generateTokenMut.isPending}>
                <Link className="h-3.5 w-3.5" /> {generateTokenMut.isPending ? '...' : 'توليد الرابط'}
              </Button>
            )}

            {/* Active token → View, Copy, QR, Revoke */}
            {(inv as any).publicToken && (inv as any).publicTokenStatus === 'active' && (
              <>
                <Button size="sm" variant="outline" onClick={() => {
                  const slug = currentTenant?.slug || 'salon';
                  window.open(`/${slug}/invoice/${(inv as any).publicToken}`, '_blank');
                }}>
                  <ExternalLink className="h-3.5 w-3.5" /> عرض
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  const slug = currentTenant?.slug || 'salon';
                  const bookingBase = process.env.NEXT_PUBLIC_BOOKING_URL || window.location.origin;
                  const url = `${bookingBase}/${slug}/invoice/${(inv as any).publicToken}`;
                  navigator.clipboard.writeText(url);
                  toast.success('تم نسخ الرابط ✅');
                }}>
                  <Copy className="h-3.5 w-3.5" /> نسخ
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowQR(true)}>
                  <QrCode className="h-3.5 w-3.5" /> QR
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setShowConfirm('revoke')}>
                  <ShieldOff className="h-3.5 w-3.5" /> تعطيل
                </Button>
              </>
            )}

            {/* Revoked token → Regenerate */}
            {(inv as any).publicTokenStatus === 'revoked' && (
              <Button size="sm" variant="outline" onClick={() => setShowConfirm('regenerate')}>
                <RefreshCw className="h-3.5 w-3.5" /> إعادة إنشاء
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Items */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--muted)]/30">
          <h3 className="text-xs font-bold text-[var(--muted-foreground)]">البنود</h3>
        </div>
        {inv.items && inv.items.length > 0 ? (
          <div className="divide-y divide-[var(--border)]">
            {inv.items.map(item => (
              <div key={item.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-bold text-[var(--foreground)]">{item.description}</p>
                  <p className="text-[11px] text-[var(--muted-foreground)]">{item.quantity} × {Number(item.unitPrice).toLocaleString('en')} SAR</p>
                </div>
                <span className="text-sm font-black tabular-nums" dir="ltr">{Number(item.totalPrice).toLocaleString('en')} SAR</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center py-6 text-sm text-[var(--muted-foreground)]">لا توجد بنود</p>
        )}
        {/* Totals */}
        <div className="border-t border-[var(--border)] bg-[var(--muted)]/20 px-5 py-3 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-[var(--muted-foreground)]">المجموع الفرعي</span>
            <span className="tabular-nums font-medium" dir="ltr">{Number(inv.subtotal).toLocaleString('en')} SAR</span>
          </div>
          {inv.discountAmount > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-[var(--muted-foreground)]">الخصم</span>
              <span className="text-red-500 font-medium tabular-nums" dir="ltr">-{Number(inv.discountAmount).toLocaleString('en')} SAR</span>
            </div>
          )}
          {inv.taxAmount > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-[var(--muted-foreground)]">الضريبة (15%)</span>
              <span className="tabular-nums font-medium" dir="ltr">{Number(inv.taxAmount).toLocaleString('en')} SAR</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-black pt-1.5 border-t border-[var(--border)]">
            <span>الإجمالي</span>
            <span className="text-[var(--brand-primary)] tabular-nums" dir="ltr">{Number(inv.total).toLocaleString('en')} SAR</span>
          </div>
        </div>
      </div>

      {/* Payments */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--muted)]/30 flex items-center justify-between">
          <h3 className="text-xs font-bold text-[var(--muted-foreground)]">المدفوعات</h3>
          {canPay && (
            <button onClick={() => setShowPay(true)} className="text-[10px] font-bold text-[var(--brand-primary)] hover:underline">
              + إضافة دفعة
            </button>
          )}
        </div>
        {inv.payments && inv.payments.length > 0 ? (
          <div className="divide-y divide-[var(--border)]">
            {inv.payments.map(pay => {
              const m = METHOD_ICONS[pay.method] || METHOD_ICONS.cash;
              const MIcon = m.icon;
              return (
                <div key={pay.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                    <MIcon className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold tabular-nums" dir="ltr">{Number(pay.amount).toLocaleString('en')} SAR</p>
                    <p className="text-[10px] text-[var(--muted-foreground)]">{m.label} · {PAY_STATUS[pay.status]} · {fmtDate(pay.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-center py-8 text-sm text-[var(--muted-foreground)]">لا توجد مدفوعات</p>
        )}
      </div>

      {/* 🖨️ Hidden Print Receipt Template */}
      <div className="hidden">
        <div ref={printRef}>
          <div className="center salon-name">✨ فاتورة ✨</div>
          <div className="divider"></div>
          <div className="row"><span>رقم الفاتورة:</span><span className="bold">{inv.invoiceNumber}</span></div>
          <div className="row"><span>التاريخ:</span><span>{fmtDate(inv.createdAt)}</span></div>
          <div className="row"><span>الوقت:</span><span>{fmtTime(inv.createdAt)}</span></div>
          {inv.client && <div className="row"><span>العميل:</span><span>{inv.client.fullName}</span></div>}
          <div className="divider"></div>
          {inv.items?.map((item, i) => (
            <div key={i} className="row">
              <span>{item.description}</span>
              <span className="bold">{Number(item.totalPrice).toLocaleString('en')} SAR</span>
            </div>
          ))}
          <div className="divider"></div>
          <div className="row"><span>المجموع الفرعي</span><span>{Number(inv.subtotal).toLocaleString('en')} SAR</span></div>
          {inv.discountAmount > 0 && <div className="row"><span>الخصم</span><span>-{Number(inv.discountAmount).toLocaleString('en')} SAR</span></div>}
          {inv.taxAmount > 0 && <div className="row"><span>الضريبة (15%)</span><span>{Number(inv.taxAmount).toLocaleString('en')} SAR</span></div>}
          <div className="row total-row"><span>الإجمالي</span><span>{Number(inv.total).toLocaleString('en')} SAR</span></div>
          {inv.payments && inv.payments.length > 0 && (
            <>
              <div className="divider"></div>
              <div className="row"><span>طريقة الدفع:</span><span>{METHOD_ICONS[inv.payments[0].method]?.label || inv.payments[0].method}</span></div>
              <div className="row"><span>الحالة:</span><span className="bold">{STATUS[inv.status]?.label}</span></div>
            </>
          )}
          <div className="divider"></div>
          <div className="footer">شكراً لزيارتكم 💖</div>
          <div className="footer" style={{ marginTop: '4px' }}>Powered by SERVIX</div>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPay} onOpenChange={setShowPay}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تسجيل دفعة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">المبلغ</label>
              <input type="number" dir="ltr" inputMode="decimal" placeholder="0" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-lg font-bold text-center focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">طريقة الدفع</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(METHOD_ICONS) as [PaymentMethod, typeof METHOD_ICONS.cash][]).map(([key, val]) => {
                  const MI = val.icon;
                  return (
                    <button key={key} type="button" onClick={() => setPayMethod(key)}
                      className={cn('flex items-center gap-2 p-3 rounded-xl border-2 text-xs font-bold transition-all',
                        payMethod === key ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 text-[var(--brand-primary)]' : 'border-[var(--border)] hover:border-[var(--brand-primary)]/30')}>
                      <MI className="h-4 w-4" /> {val.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPay(false)}>إلغاء</Button>
            <Button onClick={() => payMut.mutate()} disabled={!payAmount || payMut.isPending}>
              {payMut.isPending ? '...' : 'تسجيل الدفعة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Revoke/Regenerate Dialog ── */}
      <Dialog open={showConfirm !== null} onOpenChange={() => setShowConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{showConfirm === 'revoke' ? 'تأكيد تعطيل الرابط' : 'تأكيد إعادة إنشاء الرابط'}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--muted-foreground)] py-4">
            {showConfirm === 'revoke'
              ? 'سيتم تعطيل الرابط العام للفاتورة. لن يتمكن العملاء من الوصول للفاتورة عبر الرابط الحالي.'
              : 'سيتم إنشاء رابط جديد للفاتورة. الرابط القديم سيتوقف عن العمل تلقائياً.'}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(null)}>إلغاء</Button>
            <Button
              variant={showConfirm === 'revoke' ? 'destructive' : 'default'}
              onClick={() => showConfirm === 'revoke' ? revokeTokenMut.mutate() : regenerateTokenMut.mutate()}
              disabled={revokeTokenMut.isPending || regenerateTokenMut.isPending}
            >
              {(revokeTokenMut.isPending || regenerateTokenMut.isPending) ? '...' : 'تأكيد'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── QR Modal ── */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR Code — {inv.invoiceNumber}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="rounded-2xl bg-white p-6 shadow-inner">
              {/* Real QR Code via Google Charts API — no npm package needed */}
              {(() => {
                const slug = currentTenant?.slug || 'salon';
                const bookingBase = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_BOOKING_URL || window.location.origin) : '';
                const invoiceUrl = `${bookingBase}/${slug}/invoice/${(inv as any).publicToken}`;
                const qrSrc = `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(invoiceUrl)}&choe=UTF-8`;
                return (
                  <img
                    src={qrSrc}
                    alt={`QR Code — ${inv.invoiceNumber}`}
                    width={200}
                    height={200}
                    className="rounded-lg"
                    style={{ imageRendering: 'pixelated' }}
                  />
                );
              })()}
            </div>
            <p className="text-xs text-[var(--muted-foreground)] text-center">امسح الكود للوصول إلى صفحة الفاتورة</p>
            <Button size="sm" variant="outline" onClick={() => {
              const slug = currentTenant?.slug || 'salon';
              const bookingBase = process.env.NEXT_PUBLIC_BOOKING_URL || window.location.origin;
              const url = `${bookingBase}/${slug}/invoice/${(inv as any).publicToken}`;
              navigator.clipboard.writeText(url);
              toast.success('تم نسخ الرابط ✅');
            }}>
              <Copy className="h-3.5 w-3.5" /> نسخ الرابط
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

