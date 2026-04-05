'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import {
  PackageOpen,
  Plus,
  Trash2,
  Tag,
  Clock,
  Percent,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { dashboardService } from '@/services/dashboard.service';
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Input,
  Skeleton,
  EmptyState,
} from '@/components/ui';
import type { Package, Service } from '@/types';

function formatCurrency(value: number): string {
  return `${value.toLocaleString('en')} ر.س`;
}

export default function PackagesPage(): React.ReactElement {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [newPackage, setNewPackage] = useState({ nameAr: '', nameEn: '', packagePrice: '' });
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  const { data: packages, isLoading } = useQuery({
    queryKey: ['packages'],
    queryFn: () => dashboardService.getPackages(accessToken!),
    enabled: !!accessToken,
  });

  const { data: servicesData } = useQuery({
    queryKey: ['services-for-packages'],
    queryFn: () => dashboardService.getServices({}, accessToken!),
    enabled: !!accessToken && showForm,
  });

  const services = servicesData?.items ?? servicesData ?? [];

  const createMutation = useMutation({
    mutationFn: (data: { nameAr: string; nameEn?: string; serviceIds: string[]; packagePrice: number }) =>
      dashboardService.createPackage(data, accessToken!),
    onSuccess: () => {
      toast.success('تم إنشاء الباقة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      setShowForm(false);
      setNewPackage({ nameAr: '', nameEn: '', packagePrice: '' });
      setSelectedServiceIds([]);
    },
    onError: () => toast.error('فشل إنشاء الباقة'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dashboardService.deletePackage(id, accessToken!),
    onSuccess: () => {
      toast.success('تم حذف الباقة');
      queryClient.invalidateQueries({ queryKey: ['packages'] });
    },
    onError: () => toast.error('فشل حذف الباقة'),
  });

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const selectedTotal = (Array.isArray(services) ? services : [])
    .filter((s: Service) => selectedServiceIds.includes(s.id))
    .reduce((sum: number, s: Service) => sum + s.price, 0);

  const discount = selectedTotal > 0 && parseFloat(newPackage.packagePrice) > 0
    ? Math.round(((selectedTotal - parseFloat(newPackage.packagePrice)) / selectedTotal) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="الباقات"
        description="إنشاء باقات من عدة خدمات بسعر مخفض"
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 me-2" />
            باقة جديدة
          </Button>
        }
      />

      {/* Info Card */}
      <Card className="border-teal-200 bg-gradient-to-r from-teal-50 to-emerald-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100">
              <PackageOpen className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <p className="font-medium text-[var(--foreground)]">ما هي الباقات؟</p>
              <p className="text-sm text-[var(--muted-foreground)]">
                مجموعة خدمات بسعر مخفض — مثل &quot;باقة العروس&quot; = مكياج + شعر + أظافر بسعر أقل من المجموع
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Package Form */}
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader>
              <CardTitle>باقة جديدة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Input
                  placeholder="اسم الباقة بالعربي *"
                  value={newPackage.nameAr}
                  onChange={(e) => setNewPackage((p) => ({ ...p, nameAr: e.target.value }))}
                />
                <Input
                  placeholder="اسم الباقة بالإنجليزي"
                  value={newPackage.nameEn}
                  onChange={(e) => setNewPackage((p) => ({ ...p, nameEn: e.target.value }))}
                />
                <Input
                  type="number"
                  placeholder="سعر الباقة *"
                  value={newPackage.packagePrice}
                  onChange={(e) => setNewPackage((p) => ({ ...p, packagePrice: e.target.value }))}
                />
              </div>

              {/* Service Selector */}
              <div>
                <p className="text-sm font-medium text-[var(--foreground)] mb-3">
                  اختر الخدمات (حد أدنى 2):
                </p>
                {Array.isArray(services) && services.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {services.map((service: Service) => {
                      const isSelected = selectedServiceIds.includes(service.id);
                      return (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => toggleService(service.id)}
                          className={`flex items-center gap-3 rounded-xl border p-3 text-right transition-all ${
                            isSelected
                              ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 ring-1 ring-[var(--brand-primary)]'
                              : 'border-[var(--border)] hover:border-[var(--brand-primary)]/50'
                          }`}
                        >
                          <div className={`flex h-6 w-6 items-center justify-center rounded-full shrink-0 ${
                            isSelected ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--muted)]'
                          }`}>
                            {isSelected && <CheckCircle2 className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{service.nameAr}</p>
                            <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                              <span className="flex items-center gap-0.5">
                                <Tag className="h-3 w-3" />
                                {formatCurrency(service.price)}
                              </span>
                              <span className="flex items-center gap-0.5">
                                <Clock className="h-3 w-3" />
                                {service.duration} دقيقة
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--muted-foreground)] text-center py-4">جارِ تحميل الخدمات...</p>
                )}
              </div>

              {/* Summary */}
              {selectedServiceIds.length >= 2 && (
                <div className="flex items-center gap-4 rounded-xl bg-[var(--muted)] p-4">
                  <div className="flex-1">
                    <p className="text-sm text-[var(--muted-foreground)]">
                      السعر الأصلي: <span className="line-through">{formatCurrency(selectedTotal)}</span>
                    </p>
                    <p className="text-lg font-bold text-[var(--foreground)]">
                      سعر الباقة: {newPackage.packagePrice ? formatCurrency(parseFloat(newPackage.packagePrice)) : '—'}
                    </p>
                  </div>
                  {discount > 0 && (
                    <Badge variant="success" className="text-base px-3 py-1">
                      <Percent className="h-4 w-4 me-1" />
                      خصم {discount}%
                    </Badge>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  disabled={
                    !newPackage.nameAr ||
                    !newPackage.packagePrice ||
                    selectedServiceIds.length < 2 ||
                    createMutation.isPending
                  }
                  onClick={() =>
                    createMutation.mutate({
                      nameAr: newPackage.nameAr,
                      nameEn: newPackage.nameEn || undefined,
                      serviceIds: selectedServiceIds,
                      packagePrice: parseFloat(newPackage.packagePrice),
                    })
                  }
                >
                  إنشاء الباقة
                </Button>
                <Button variant="outline" onClick={() => { setShowForm(false); setSelectedServiceIds([]); }}>إلغاء</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Packages Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : !packages || packages.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title="لا توجد باقات"
          description="أنشئ باقة جديدة لتقدم خدمات متعددة بسعر مخفض"
          actionLabel="إنشاء باقة"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg: Package, i: number) => {
            const savings = pkg.originalPrice - pkg.packagePrice;
            const savingPct = pkg.originalPrice > 0 ? Math.round((savings / pkg.originalPrice) * 100) : 0;

            return (
              <motion.div
                key={pkg.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="hover:shadow-lg transition-all group relative overflow-hidden">
                  {/* Discount Badge */}
                  {savingPct > 0 && (
                    <div className="absolute top-3 left-3 z-10">
                      <Badge variant="success" className="shadow-sm">
                        وفّر {savingPct}%
                      </Badge>
                    </div>
                  )}

                  <CardContent className="p-5">
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-[var(--foreground)]">{pkg.nameAr}</h3>
                      {pkg.nameEn && (
                        <p className="text-xs text-[var(--muted-foreground)]">{pkg.nameEn}</p>
                      )}
                    </div>

                    {/* Services */}
                    <div className="space-y-2 mb-4">
                      {pkg.services.map((service) => (
                        <div key={service.id} className="flex items-center justify-between text-sm">
                          <span className="text-[var(--foreground)]">{service.nameAr}</span>
                          <span className="text-[var(--muted-foreground)] line-through text-xs">
                            {formatCurrency(service.price)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Price */}
                    <div className="rounded-xl bg-gradient-to-l from-[var(--brand-primary)]/10 to-transparent p-3 mb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-[var(--muted-foreground)]">السعر الأصلي</p>
                          <p className="text-sm line-through text-[var(--muted-foreground)]">
                            {formatCurrency(pkg.originalPrice)}
                          </p>
                        </div>
                        <div className="text-left">
                          <p className="text-xs text-[var(--brand-primary)]">سعر الباقة</p>
                          <p className="text-xl font-black text-[var(--brand-primary)]">
                            {formatCurrency(pkg.packagePrice)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Delete */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => {
                        if (window.confirm('هل تريد حذف هذه الباقة؟')) {
                          deleteMutation.mutate(pkg.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5 me-1" />
                      حذف الباقة
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
