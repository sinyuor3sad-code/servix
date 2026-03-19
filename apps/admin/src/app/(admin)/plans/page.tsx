'use client';

import { useState, type ReactElement } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Package, Check, X, Edit2, Save } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { adminService, type Plan } from '@/services/admin.service';
import { ApiError } from '@/lib/api';

function PlansSkeleton(): ReactElement {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-[400px]" />
      ))}
    </div>
  );
}

function PlanCard({ plan }: { plan: Plan }): ReactElement {
  const [editing, setEditing] = useState(false);
  const [monthlyPrice, setMonthlyPrice] = useState(String(plan.monthlyPrice));
  const [yearlyPrice, setYearlyPrice] = useState(String(plan.yearlyPrice));
  const [maxEmployees, setMaxEmployees] = useState(String(plan.maxEmployees));
  const [maxClients, setMaxClients] = useState(String(plan.maxClients));
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Plan>) => adminService.updatePlan(plan.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
      toast.success('تم تحديث الباقة بنجاح');
      setEditing(false);
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('حدث خطأ أثناء تحديث الباقة');
      }
    },
  });

  function handleSave(): void {
    updateMutation.mutate({
      monthlyPrice: Number(monthlyPrice),
      yearlyPrice: Number(yearlyPrice),
      maxEmployees: Number(maxEmployees),
      maxClients: Number(maxClients),
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[var(--primary-50)] p-2 text-[var(--brand-primary)]">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>{plan.nameAr}</CardTitle>
              <p className="mt-0.5 text-sm text-[var(--muted-foreground)]" dir="ltr">
                {plan.code}
              </p>
            </div>
          </div>
          <Badge variant={plan.isActive ? 'success' : 'secondary'}>
            {plan.isActive ? 'مفعّلة' : 'غير مفعّلة'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[var(--muted-foreground)]">السعر الشهري (ر.س)</label>
                <input
                  type="number"
                  value={monthlyPrice}
                  onChange={(e) => setMonthlyPrice(e.target.value)}
                  className="mt-1 flex h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--muted-foreground)]">السعر السنوي (ر.س)</label>
                <input
                  type="number"
                  value={yearlyPrice}
                  onChange={(e) => setYearlyPrice(e.target.value)}
                  className="mt-1 flex h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--muted-foreground)]">الحد الأقصى للموظفين</label>
                <input
                  type="number"
                  value={maxEmployees}
                  onChange={(e) => setMaxEmployees(e.target.value)}
                  className="mt-1 flex h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--muted-foreground)]">الحد الأقصى للعملاء</label>
                <input
                  type="number"
                  value={maxClients}
                  onChange={(e) => setMaxClients(e.target.value)}
                  className="mt-1 flex h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  dir="ltr"
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                  <Save className="h-4 w-4" />
                  حفظ
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                  إلغاء
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-[var(--muted-foreground)]">شهري</p>
                  <p className="text-lg font-bold">{plan.monthlyPrice} ر.س</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted-foreground)]">سنوي</p>
                  <p className="text-lg font-bold">{plan.yearlyPrice} ر.س</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted-foreground)]">الموظفين</p>
                  <p className="font-medium">
                    {plan.maxEmployees === -1 ? 'غير محدود' : plan.maxEmployees}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted-foreground)]">العملاء</p>
                  <p className="font-medium">
                    {plan.maxClients === -1 ? 'غير محدود' : plan.maxClients}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">الميزات</p>
                <div className="space-y-1.5">
                  {plan.features.map((pf) => (
                    <div key={pf.id} className="flex items-center gap-2 text-sm">
                      {pf.enabled ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <X className="h-4 w-4 text-red-400" />
                      )}
                      <span className={pf.enabled ? '' : 'text-[var(--muted-foreground)]'}>
                        {pf.featureNameAr}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="w-full">
                <Edit2 className="h-4 w-4" />
                تعديل
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PlansPage(): ReactElement {
  const { data: plans, isLoading } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: () => adminService.getPlans(),
  });

  return (
    <>
      <PageHeader
        title="الباقات"
        description="إدارة باقات الاشتراك"
      />

      {isLoading ? (
        <PlansSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {(plans ?? []).map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}
    </>
  );
}
