'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Phone, Mail, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader, Badge, Button, Spinner } from '@/components/ui';
import { dashboardService } from '@/services/dashboard.service';
import { useAuth } from '@/hooks/useAuth';
import type { Employee, EmployeeRole } from '@/types';
import { cn } from '@/lib/utils';

/* ───────── Role Config ───────── */
const ROLE_CONFIG: Record<EmployeeRole, { label: string; icon: string; color: string }> = {
  stylist: { label: 'مصففة', icon: '✂️', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  cashier: { label: 'كاشيرة', icon: '💵', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  makeup: { label: 'مكياج', icon: '💄', color: 'bg-pink-100 text-pink-700 border-pink-200' },
  nails: { label: 'أظافر', icon: '💅', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  skincare: { label: 'عناية بالبشرة', icon: '🧴', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
};

export default function EmployeesPage() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['employees', 'all', search, filterRole],
    queryFn: () =>
      dashboardService.getEmployees(
        { limit: 100, search: search || undefined, role: filterRole || undefined } as any,
        accessToken!,
      ),
    enabled: !!accessToken,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dashboardService.deleteEmployee(id, accessToken!),
    onSuccess: () => {
      toast.success('تم حذف الموظفة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: () => toast.error('فشل في حذف الموظفة'),
  });

  const employees = data?.items ?? [];

  const handleDelete = (emp: Employee) => {
    if (window.confirm(`هل أنتِ متأكدة من حذف "${emp.fullName}"؟`)) {
      deleteMutation.mutate(emp.id);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="الموظفات"
        description="إدارة فريق العمل"
        actions={
          <Link href="/employees/new">
            <Button>
              <Plus className="h-4 w-4" />
              إضافة موظفة
            </Button>
          </Link>
        }
      />

      {/* ── Filter Bar ── */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="🔍 بحث بالاسم..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm placeholder:text-[var(--muted-foreground)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none transition-all"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto">
          <button
            onClick={() => setFilterRole('')}
            className={cn(
              'px-3 py-2 rounded-lg text-xs font-medium border transition-all whitespace-nowrap',
              !filterRole
                ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]'
                : 'border-[var(--border)] hover:border-[var(--brand-primary)]/50',
            )}
          >
            الكل
          </button>
          {Object.entries(ROLE_CONFIG).map(([key, config]) => (
            <button
              key={key}
              onClick={() => setFilterRole(filterRole === key ? '' : key)}
              className={cn(
                'px-3 py-2 rounded-lg text-xs font-medium border transition-all whitespace-nowrap',
                filterRole === key
                  ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]'
                  : 'border-[var(--border)] hover:border-[var(--brand-primary)]/50',
              )}
            >
              {config.icon} {config.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Employee Cards ── */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : employees.length === 0 ? (
        <div className="text-center py-20">
          <Sparkles className="h-12 w-12 mx-auto text-[var(--muted-foreground)] mb-3" />
          <p className="text-[var(--muted-foreground)]">لا توجد موظفات</p>
          <Link href="/employees/new">
            <Button className="mt-4">
              <Plus className="h-4 w-4" />
              إضافة أول موظفة
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-6">
          {employees.map((emp) => {
            const roleConfig = ROLE_CONFIG[emp.role as EmployeeRole] || ROLE_CONFIG.stylist;
            const initials = emp.fullName
              ?.split(' ')
              .map((w: string) => w[0])
              .slice(0, 2)
              .join('');

            return (
              <div
                key={emp.id}
                className="group relative p-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] hover:shadow-lg hover:border-[var(--brand-primary)]/30 transition-all duration-300"
              >
                {/* Delete button */}
                <button
                  onClick={() => handleDelete(emp)}
                  className="absolute top-3 left-3 p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                  title="حذف"
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                {/* Avatar + Name */}
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold',
                    emp.isActive
                      ? 'bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary)]/70 text-white'
                      : 'bg-[var(--muted)] text-[var(--muted-foreground)]',
                  )}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/employees/${emp.id}`}
                      className="text-sm font-bold text-[var(--foreground)] hover:text-[var(--brand-primary)] transition-colors truncate block"
                    >
                      {emp.fullName}
                    </Link>
                    <div className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border mt-1',
                      roleConfig.color,
                    )}>
                      <span>{roleConfig.icon}</span>
                      <span>{roleConfig.label}</span>
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="mt-3 space-y-1.5">
                  {emp.phone && (
                    <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                      <Phone className="h-3 w-3" />
                      <span dir="ltr">{emp.phone}</span>
                    </div>
                  )}
                  {emp.email && (
                    <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                      <Mail className="h-3 w-3" />
                      <span className="truncate">{emp.email}</span>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between">
                  <div className="text-xs">
                    {emp.commissionType === 'percentage' && emp.commissionValue ? (
                      <span className="text-[var(--brand-primary)] font-semibold">{emp.commissionValue}% عمولة</span>
                    ) : emp.commissionType === 'fixed' && emp.commissionValue ? (
                      <span className="text-[var(--brand-primary)] font-semibold">{emp.commissionValue} ر.س عمولة</span>
                    ) : (
                      <span className="text-[var(--muted-foreground)]">بدون عمولة</span>
                    )}
                  </div>
                  <Badge variant={emp.isActive ? 'success' : 'destructive'}>
                    {emp.isActive ? 'نشطة' : 'معطلة'}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
