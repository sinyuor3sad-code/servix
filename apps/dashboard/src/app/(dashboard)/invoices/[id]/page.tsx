'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Send, Ban, CreditCard } from 'lucide-react';
import { api } from '@/lib/api';
import {
  PageHeader,
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Spinner,
  Input,
  Select,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui';
import { dashboardService } from '@/services/dashboard.service';
import { useAuth } from '@/hooks/useAuth';
import type { InvoiceStatus, PaymentMethod, PaymentStatus } from '@/types';

const STATUS_CONFIG: Record<
  InvoiceStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'outline' }
> = {
  draft: { label: 'مسودة', variant: 'secondary' },
  paid: { label: 'مدفوعة', variant: 'success' },
  partially_paid: { label: 'مدفوعة جزئياً', variant: 'warning' },
  void: { label: 'ملغية', variant: 'destructive' },
  refunded: { label: 'مستردة', variant: 'outline' },
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'نقداً',
  card: 'بطاقة',
  bank_transfer: 'تحويل بنكي',
  wallet: 'محفظة',
};

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  completed: 'مكتمل',
  pending: 'معلق',
  failed: 'فاشل',
  refunded: 'مسترد',
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => dashboardService.getInvoice(id, accessToken!),
    enabled: !!accessToken && !!id,
  });

  const paymentMutation = useMutation({
    mutationFn: () =>
      api.post(`/invoices/${id}/payments`, {
        amount: Number(paymentAmount),
        method: paymentMethod,
      }, accessToken!),
    onSuccess: () => {
      toast.success('تم تسجيل الدفعة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      setShowPaymentDialog(false);
      setPaymentAmount('');
    },
    onError: () => toast.error('حدث خطأ أثناء تسجيل الدفعة'),
  });

  const voidMutation = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/void`, {}, accessToken!),
    onSuccess: () => {
      toast.success('تم إلغاء الفاتورة');
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
    },
    onError: () => toast.error('حدث خطأ أثناء إلغاء الفاتورة'),
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      api.post(`/invoices/${id}/send`, { channel: 'whatsapp' }, accessToken!),
    onSuccess: () => toast.success('تم إرسال الفاتورة'),
    onError: () => toast.error('حدث خطأ أثناء إرسال الفاتورة'),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 text-center">
        <p className="text-[var(--muted-foreground)]">لم يتم العثور على الفاتورة</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/invoices')}>
          العودة للفواتير
        </Button>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[invoice.status];
  const canPay = ['draft', 'partially_paid'].includes(invoice.status);
  const canVoid = ['draft', 'partially_paid'].includes(invoice.status);
  const canSend = invoice.status !== 'void';

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={`فاتورة ${invoice.invoiceNumber}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {canPay && (
              <Button onClick={() => setShowPaymentDialog(true)}>
                <CreditCard className="h-4 w-4" />
                تسجيل دفعة
              </Button>
            )}
            {canSend && (
              <Button
                variant="outline"
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending}
              >
                <Send className="h-4 w-4" />
                إرسال
              </Button>
            )}
            {canVoid && (
              <Button
                variant="destructive"
                onClick={() => voidMutation.mutate()}
                disabled={voidMutation.isPending}
              >
                <Ban className="h-4 w-4" />
                إلغاء الفاتورة
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>بيانات الفاتورة</CardTitle>
                <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-[var(--muted-foreground)]">رقم الفاتورة</dt>
                  <dd className="font-mono font-medium text-[var(--foreground)]">
                    {invoice.invoiceNumber}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-[var(--muted-foreground)]">التاريخ</dt>
                  <dd className="font-medium text-[var(--foreground)]">
                    {new Intl.DateTimeFormat('ar-SA', { dateStyle: 'long' }).format(
                      new Date(invoice.createdAt),
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-[var(--muted-foreground)]">العميل</dt>
                  <dd className="font-medium text-[var(--foreground)]">
                    {invoice.client?.fullName ?? '—'}
                  </dd>
                </div>
                {invoice.paidAt && (
                  <div>
                    <dt className="text-sm text-[var(--muted-foreground)]">تاريخ السداد</dt>
                    <dd className="font-medium text-[var(--foreground)]">
                      {new Intl.DateTimeFormat('ar-SA', { dateStyle: 'long' }).format(
                        new Date(invoice.paidAt),
                      )}
                    </dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>البنود</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-[var(--border)] overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الخدمة</TableHead>
                      <TableHead>الكمية</TableHead>
                      <TableHead>سعر الوحدة</TableHead>
                      <TableHead>الإجمالي</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.items && invoice.items.length > 0 ? (
                      invoice.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.description}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{item.unitPrice} ر.س</TableCell>
                          <TableCell className="font-medium">{item.totalPrice} ر.س</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-[var(--muted-foreground)]">
                          لا توجد بنود
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--muted-foreground)]">المجموع الفرعي</span>
                  <span className="text-[var(--foreground)]">{invoice.subtotal} ر.س</span>
                </div>
                {invoice.discountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--muted-foreground)]">الخصم</span>
                    <span className="text-red-600">-{invoice.discountAmount} ر.س</span>
                  </div>
                )}
                {invoice.taxAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--muted-foreground)]">الضريبة</span>
                    <span className="text-[var(--foreground)]">{invoice.taxAmount} ر.س</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-[var(--border)] pt-2 text-base font-bold">
                  <span className="text-[var(--foreground)]">الإجمالي</span>
                  <span className="text-[var(--foreground)]">{invoice.total} ر.س</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>سجل المدفوعات</CardTitle>
            </CardHeader>
            <CardContent>
              {invoice.payments && invoice.payments.length > 0 ? (
                <div className="space-y-3">
                  {invoice.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="rounded-lg border border-[var(--border)] p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-[var(--foreground)]">
                          {payment.amount} ر.س
                        </span>
                        <Badge variant="outline">
                          {PAYMENT_STATUS_LABELS[payment.status]}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                        <span>{PAYMENT_METHOD_LABELS[payment.method]}</span>
                        <span>
                          {new Intl.DateTimeFormat('ar-SA', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          }).format(new Date(payment.createdAt))}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                  لا توجد مدفوعات مسجلة
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تسجيل دفعة جديدة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              type="number"
              label="المبلغ (ر.س)"
              placeholder="0"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
            />
            <Select
              label="طريقة الدفع"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              options={[
                { value: 'cash', label: 'نقداً' },
                { value: 'card', label: 'بطاقة' },
                { value: 'bank_transfer', label: 'تحويل بنكي' },
                { value: 'wallet', label: 'محفظة' },
              ]}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPaymentDialog(false)}
            >
              إلغاء
            </Button>
            <Button
              onClick={() => paymentMutation.mutate()}
              disabled={!paymentAmount || paymentMutation.isPending}
            >
              {paymentMutation.isPending ? 'جارٍ التسجيل...' : 'تسجيل الدفعة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
