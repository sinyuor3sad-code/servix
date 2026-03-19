'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Search,
  Minus,
  Plus,
  Trash2,
  Banknote,
  CreditCard,
  ShoppingCart,
  UserPlus,
  ArrowRight,
} from 'lucide-react';
import {
  Button,
  Input,
  Badge,
  Skeleton,
  EmptyState,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { dashboardService } from '@/services/dashboard.service';
import { api } from '@/lib/api';
import type { Service, ServiceCategory, Client, Employee } from '@/types';

interface CartItem {
  service: Service;
  quantity: number;
}

function formatCurrency(value: number): string {
  return `${value.toLocaleString('ar-SA')} ر.س`;
}

const TAX_RATE = 0.15;

export default function QuickPOSPage(): React.ReactElement {
  const { accessToken } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [serviceSearch, setServiceSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [discountInput, setDiscountInput] = useState('');
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [showWalkInForm, setShowWalkInForm] = useState(false);
  const [sendWhatsApp, setSendWhatsApp] = useState(true);

  const { data: categories, isLoading: loadingCategories } = useQuery<ServiceCategory[]>({
    queryKey: ['categories'],
    queryFn: () => dashboardService.getCategories(accessToken!),
    enabled: !!accessToken,
  });

  const { data: servicesData } = useQuery({
    queryKey: ['services', 'pos-all'],
    queryFn: () => dashboardService.getServices({ limit: 500 }, accessToken!),
    enabled: !!accessToken,
  });

  const { data: employeesData } = useQuery({
    queryKey: ['employees', 'pos'],
    queryFn: () => dashboardService.getEmployees({ limit: 50 }, accessToken!),
    enabled: !!accessToken,
  });

  const { data: clientsData } = useQuery({
    queryKey: ['clients', 'pos-search', clientSearch],
    queryFn: () =>
      dashboardService.getClients({ search: clientSearch, limit: 5 }, accessToken!),
    enabled: !!accessToken && clientSearch.length >= 2 && !showWalkInForm,
  });

  const allServices = useMemo(() => servicesData?.items ?? [], [servicesData]);
  const employees = useMemo(() => employeesData?.items ?? [], [employeesData]);

  const filteredServices = useMemo(() => {
    let services = allServices;
    if (selectedCategory) {
      services = services.filter((s) => s.categoryId === selectedCategory);
    }
    if (serviceSearch) {
      const q = serviceSearch.toLowerCase();
      services = services.filter(
        (s) =>
          s.nameAr.toLowerCase().includes(q) ||
          (s.nameEn?.toLowerCase().includes(q) ?? false),
      );
    }
    return services.filter((s) => s.isActive);
  }, [allServices, selectedCategory, serviceSearch]);

  const addToCart = useCallback((service: Service) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.service.id === service.id);
      if (existing) {
        return prev.map((item) =>
          item.service.id === service.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [...prev, { service, quantity: 1 }];
    });
  }, []);

  const updateQuantity = useCallback((serviceId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.service.id === serviceId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }, []);

  const removeFromCart = useCallback((serviceId: string) => {
    setCart((prev) => prev.filter((item) => item.service.id !== serviceId));
  }, []);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.service.price * item.quantity, 0),
    [cart],
  );

  const discount = useMemo(() => {
    const val = parseFloat(discountInput);
    return isNaN(val) || val < 0 ? 0 : val;
  }, [discountInput]);

  const taxableAmount = Math.max(0, subtotal - discount);
  const tax = taxableAmount * TAX_RATE;
  const total = taxableAmount + tax;

  const createClientMutation = useMutation({
    mutationFn: (data: { fullName: string; phone: string }) =>
      dashboardService.createClient(
        { ...data, source: 'walk_in' },
        accessToken!,
      ),
  });

  const payMutation = useMutation({
    mutationFn: async (opts: {
      method: 'cash' | 'card';
      sendWhatsApp: boolean;
    }) => {
      let clientId = selectedClient?.id;
      if (!clientId && showWalkInForm && walkInName.trim() && walkInPhone.trim()) {
        const client = await createClientMutation.mutateAsync({
          fullName: walkInName.trim(),
          phone: walkInPhone.trim(),
        });
        clientId = client.id;
      }
      if (!clientId) {
        throw new Error('العميل مطلوب');
      }
      if (!selectedEmployee) {
        throw new Error('اختر الموظفة');
      }
      if (cart.length === 0) {
        throw new Error('السلة فارغة');
      }

      const payload = {
        clientId,
        items: cart.map((item) => ({
          serviceId: item.service.id,
          description: item.service.nameAr,
          quantity: item.quantity,
          unitPrice: item.service.price,
          employeeId: selectedEmployee.id,
        })),
      };

      const invoice = await api.post<{ id: string }>(
        '/invoices',
        payload,
        accessToken!,
      );

      if (discount > 0) {
        await dashboardService.addInvoiceDiscount(
          invoice.id,
          { type: 'fixed', value: discount },
          accessToken!,
        );
      }

      await dashboardService.recordInvoicePayment(
        invoice.id,
        { amount: total, method: opts.method },
        accessToken!,
      );

      if (opts.sendWhatsApp) {
        try {
          await dashboardService.sendInvoice(invoice.id, 'whatsapp', accessToken!);
        } catch {
          // Don't fail the whole flow if WhatsApp fails
        }
      }

      return invoice;
    },
    onSuccess: (_, opts) => {
      toast.success(
        opts.sendWhatsApp
          ? 'تم الدفع وإرسال الفاتورة عبر واتساب'
          : 'تم الدفع بنجاح',
      );
      setCart([]);
      setSelectedClient(null);
      setWalkInName('');
      setWalkInPhone('');
      setShowWalkInForm(false);
      setDiscountInput('');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'حدث خطأ');
    },
  });

  function handlePay(method: 'cash' | 'card'): void {
    if (cart.length === 0) {
      toast.error('السلة فارغة');
      return;
    }
    if (!selectedEmployee) {
      toast.error('اختر الموظفة');
      return;
    }
    if (!selectedClient && !(showWalkInForm && walkInName.trim() && walkInPhone.trim())) {
      toast.error('اختر عميلاً أو أضف عميل ووك إن');
      return;
    }
    payMutation.mutate({ method, sendWhatsApp });
  }

  const canPay =
    cart.length > 0 &&
    selectedEmployee &&
    (selectedClient || (showWalkInForm && walkInName.trim() && walkInPhone.trim()));

  return (
    <div className="-m-4 flex min-h-[calc(100dvh-8rem)] flex-col bg-[var(--background)] md:-m-6">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--background)] px-4 py-3">
        <Link
          href="/pos"
          className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <ArrowRight className="h-4 w-4" />
          الكاشير العادي
        </Link>
        <h1 className="text-lg font-bold text-[var(--foreground)]">كاشير سريع</h1>
        <div className="w-24" />
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Services */}
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
          <div className="flex shrink-0 flex-col gap-3 border-b border-[var(--border)] p-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <input
                type="text"
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                placeholder="بحث عن خدمة..."
                className="flex h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] ps-10 pe-3 py-2 text-base text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto p-3 pb-2">
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                selectedCategory === null
                  ? 'bg-[var(--brand-primary)] text-white'
                  : 'bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--muted)]/80'
              }`}
            >
              الكل
            </button>
            {categories?.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-[var(--brand-primary)] text-white'
                    : 'bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--muted)]/80'
                }`}
              >
                {cat.nameAr}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {loadingCategories ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))}
              </div>
            ) : filteredServices.length === 0 ? (
              <EmptyState
                title="لا توجد خدمات"
                description="جرّب تغيير التصنيف أو البحث"
              />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {filteredServices.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => addToCart(service)}
                    className="flex flex-col items-start gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 text-start transition-all hover:border-[var(--brand-primary)] hover:shadow-md active:scale-[0.98] touch-manipulation"
                  >
                    <span className="text-base font-medium text-[var(--foreground)] line-clamp-2">
                      {service.nameAr}
                    </span>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {service.duration} د
                    </span>
                    <span className="mt-auto text-base font-bold text-[var(--brand-primary)]">
                      {formatCurrency(service.price)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cart Panel */}
        <div className="flex w-full flex-col border-s border-[var(--border)] bg-[var(--background)] md:w-[380px] lg:w-[420px]">
          <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] p-3">
            <ShoppingCart className="h-5 w-5 text-[var(--brand-primary)]" />
            <span className="font-semibold">السلة</span>
            <Badge variant="secondary" className="ms-auto">
              {cart.reduce((sum, item) => sum + item.quantity, 0)}
            </Badge>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {/* Client */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">العميل</label>
              {showWalkInForm ? (
                <div className="space-y-2">
                  <Input
                    value={walkInName}
                    onChange={(e) => setWalkInName(e.target.value)}
                    placeholder="الاسم"
                    className="h-10"
                  />
                  <Input
                    value={walkInPhone}
                    onChange={(e) => setWalkInPhone(e.target.value)}
                    placeholder="الجوال"
                    className="h-10"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowWalkInForm(false);
                      setWalkInName('');
                      setWalkInPhone('');
                    }}
                  >
                    إلغاء
                  </Button>
                </div>
              ) : selectedClient ? (
                <div className="flex items-center justify-between rounded-xl border border-[var(--border)] p-2.5">
                  <span className="font-medium">{selectedClient.fullName}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedClient(null)}
                  >
                    تغيير
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="بحث عن عميل..."
                    className="flex h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => setShowWalkInForm(true)}
                  >
                    <UserPlus className="h-4 w-4 me-2" />
                    عميل ووك إن
                  </Button>
                  {clientsData?.items.length && clientSearch.length >= 2 ? (
                    <div className="absolute start-0 end-0 top-full z-10 mt-1 rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-lg">
                      {clientsData.items.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedClient(c);
                            setClientSearch('');
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-start text-sm hover:bg-[var(--muted)]"
                        >
                          <span className="font-medium">{c.fullName}</span>
                          <span className="text-xs text-[var(--muted-foreground)]">
                            {c.phone}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Employee */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">الموظفة</label>
              <div className="flex flex-wrap gap-2">
                {employees.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => setSelectedEmployee(emp)}
                    className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      selectedEmployee?.id === emp.id
                        ? 'bg-[var(--brand-primary)] text-white'
                        : 'bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--muted)]/80'
                    }`}
                  >
                    {emp.fullName}
                  </button>
                ))}
              </div>
            </div>

            {/* Cart Items */}
            <div className="space-y-2">
              {cart.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                  السلة فارغة
                </p>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.service.id}
                    className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {item.service.nameAr}
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {formatCurrency(item.service.price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(item.service.id, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-7 text-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(item.service.id, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500"
                        onClick={() => removeFromCart(item.service.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Totals */}
            <div className="space-y-2 border-t border-[var(--border)] pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--muted-foreground)]">المجموع الفرعي</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-sm text-[var(--muted-foreground)]">
                  الخصم
                </span>
                <Input
                  type="number"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  placeholder="0"
                  className="h-9 text-sm"
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--muted-foreground)]">الضريبة (15%)</span>
                <span>{formatCurrency(tax)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>الإجمالي</span>
                <span className="text-[var(--brand-primary)]">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment */}
          <div className="shrink-0 space-y-2 border-t border-[var(--border)] p-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sendWhatsApp}
                onChange={(e) => setSendWhatsApp(e.target.checked)}
                className="rounded"
              />
              إرسال الفاتورة واتساب مع الدفع
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => handlePay('cash')}
                disabled={payMutation.isPending || !canPay}
                className="flex flex-col gap-1 py-4 text-base"
              >
                <Banknote className="h-6 w-6" />
                نقدي
              </Button>
              <Button
                onClick={() => handlePay('card')}
                disabled={payMutation.isPending || !canPay}
                variant="outline"
                className="flex flex-col gap-1 py-4 text-base"
              >
                <CreditCard className="h-6 w-6" />
                بطاقة
              </Button>
            </div>
            <p className="text-center text-xs text-[var(--muted-foreground)]">
              {sendWhatsApp ? 'سيتم إرسال الفاتورة واتساب مع الدفع' : ''}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
