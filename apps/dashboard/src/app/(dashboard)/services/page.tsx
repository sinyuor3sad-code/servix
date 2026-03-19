'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, ChevronDown, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader, Button, Badge, Spinner } from '@/components/ui';
import { dashboardService } from '@/services/dashboard.service';
import { useAuth } from '@/hooks/useAuth';
import type { ServiceCategory } from '@/types';

export default function ServicesPage() {
  const { accessToken } = useAuth();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => dashboardService.getCategories(accessToken!),
    enabled: !!accessToken,
  });

  const { data: servicesData } = useQuery({
    queryKey: ['services', 'all'],
    queryFn: () => dashboardService.getServices({ limit: 500 }, accessToken!),
    enabled: !!accessToken,
  });

  function toggleCategory(categoryId: string) {
    setCollapsed((prev) => ({ ...prev, [categoryId]: !prev[categoryId] }));
  }

  function getServicesForCategory(categoryId: string) {
    return servicesData?.items.filter((s) => s.categoryId === categoryId) ?? [];
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="الخدمات"
        actions={
          <div className="flex gap-2">
            <Link href="/services/categories">
              <Button variant="outline">إدارة التصنيفات</Button>
            </Link>
            <Link href="/services/new">
              <Button>
                <Plus className="h-4 w-4" />
                إضافة خدمة
              </Button>
            </Link>
          </div>
        }
      />

      {categories && categories.length > 0 ? (
        <div className="space-y-4">
          {categories.map((category: ServiceCategory) => {
            const services = getServicesForCategory(category.id);
            const isCollapsed = collapsed[category.id];

            return (
              <div
                key={category.id}
                className="rounded-xl border border-[var(--border)] overflow-hidden"
              >
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="flex w-full items-center justify-between bg-[var(--muted)]/30 px-4 py-3 text-start transition-colors hover:bg-[var(--muted)]/50"
                >
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">
                      {category.nameAr}
                    </h3>
                    <Badge variant="secondary">{services.length} خدمة</Badge>
                  </div>
                  {isCollapsed ? (
                    <ChevronLeft className="h-4 w-4 text-[var(--muted-foreground)]" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-[var(--muted-foreground)]" />
                  )}
                </button>

                {!isCollapsed && (
                  <div className="divide-y divide-[var(--border)]">
                    {services.length > 0 ? (
                      services.map((service) => (
                        <div
                          key={service.id}
                          className="flex items-center justify-between px-4 py-3"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-[var(--foreground)]">
                              {service.nameAr}
                            </p>
                            {service.nameEn && (
                              <p className="text-xs text-[var(--muted-foreground)]">
                                {service.nameEn}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-[var(--muted-foreground)]">
                              {service.duration} دقيقة
                            </span>
                            <span className="text-sm font-semibold text-[var(--foreground)]">
                              {service.price} ر.س
                            </span>
                            <Badge variant={service.isActive ? 'success' : 'secondary'}>
                              {service.isActive ? 'نشطة' : 'معطلة'}
                            </Badge>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="px-4 py-6 text-center text-sm text-[var(--muted-foreground)]">
                        لا توجد خدمات في هذا التصنيف
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-[var(--muted-foreground)]">لا توجد تصنيفات بعد</p>
          <Link href="/services/categories" className="mt-2 inline-block">
            <Button variant="outline" size="sm">إنشاء تصنيف</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
