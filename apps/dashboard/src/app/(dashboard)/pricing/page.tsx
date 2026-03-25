'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import {
  TrendingUp,
  Plus,
  Zap,
  Moon,
  Sun,
  CalendarDays,
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
import type { PricingRule } from '@/types';

const ruleTypeConfig: Record<string, { label: string; icon: typeof Sun; color: string }> = {
  peak_hours: { label: 'ساعات الذروة', icon: Sun, color: 'text-amber-500' },
  off_peak: { label: 'خارج الذروة', icon: Moon, color: 'text-blue-500' },
  prayer_time: { label: 'أوقات الصلاة', icon: Moon, color: 'text-indigo-500' },
  weekend: { label: 'نهاية الأسبوع', icon: CalendarDays, color: 'text-violet-500' },
  demand: { label: 'حسب الطلب', icon: TrendingUp, color: 'text-emerald-500' },
  custom: { label: 'مخصص', icon: Zap, color: 'text-gray-500' },
};

function formatMultiplier(m: number): string {
  if (m > 1) return `+${((m - 1) * 100).toFixed(0)}%`;
  if (m < 1) return `-${((1 - m) * 100).toFixed(0)}%`;
  return '0%';
}

export default function PricingPage(): React.ReactElement {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [newRule, setNewRule] = useState({
    nameAr: '', ruleType: 'peak_hours', multiplier: '1.2', priority: '1', serviceId: '',
  });

  const { data: rules, isLoading } = useQuery({
    queryKey: ['pricing', 'rules'],
    queryFn: () => dashboardService.getPricingRules(accessToken!),
    enabled: !!accessToken,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<PricingRule>) => dashboardService.createPricingRule(data, accessToken!),
    onSuccess: () => {
      toast.success('تمت إضافة القاعدة');
      queryClient.invalidateQueries({ queryKey: ['pricing'] });
      setShowForm(false);
      setNewRule({ nameAr: '', ruleType: 'peak_hours', multiplier: '1.2', priority: '1', serviceId: '' });
    },
    onError: () => toast.error('فشل إضافة القاعدة'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      dashboardService.updatePricingRule(id, { isActive }, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing'] });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="التسعير الديناميكي"
        description="إدارة قواعد التسعير الذكي — ذروة، صلاة، عطلات"
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 me-2" />
            قاعدة جديدة
          </Button>
        }
      />

      {/* Info Card */}
      <Card className="border-violet-200 bg-gradient-to-r from-violet-50 to-fuchsia-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100">
              <Zap className="h-5 w-5 text-[var(--brand-primary)]" />
            </div>
            <div>
              <p className="font-medium text-[var(--foreground)]">كيف يعمل التسعير الديناميكي؟</p>
              <p className="text-sm text-[var(--muted-foreground)]">
                يُعدّل السعر تلقائياً بناءً على الوقت واليوم. مثال: +20% ساعات الذروة، -15% أوقات الصلاة
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Rule Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>قاعدة تسعير جديدة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Input placeholder="اسم القاعدة *" value={newRule.nameAr} onChange={(e) => setNewRule(r => ({ ...r, nameAr: e.target.value }))} />
              <select
                className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm"
                value={newRule.ruleType}
                onChange={(e) => setNewRule(r => ({ ...r, ruleType: e.target.value }))}
              >
                {Object.entries(ruleTypeConfig).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <Input
                type="number"
                step="0.05"
                placeholder="المضاعف (1.2 = +20%)"
                value={newRule.multiplier}
                onChange={(e) => setNewRule(r => ({ ...r, multiplier: e.target.value }))}
              />
              <Input
                type="number"
                placeholder="الأولوية"
                value={newRule.priority}
                onChange={(e) => setNewRule(r => ({ ...r, priority: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                disabled={!newRule.nameAr || createMutation.isPending}
                onClick={() => createMutation.mutate({
                  nameAr: newRule.nameAr,
                  ruleType: newRule.ruleType,
                  multiplier: parseFloat(newRule.multiplier),
                  priority: parseInt(newRule.priority),
                  serviceId: newRule.serviceId || undefined,
                } as Partial<PricingRule>)}
              >
                حفظ
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rules List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : !rules || rules.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="لا توجد قواعد تسعير"
          description="أضف أول قاعدة لتعديل الأسعار تلقائياً"
          actionLabel="إضافة قاعدة"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <div className="space-y-3">
          {rules.map((rule, i) => {
            const config = ruleTypeConfig[rule.ruleType] || ruleTypeConfig.custom;
            const Icon = config.icon;

            return (
              <motion.div
                key={rule.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--muted)]`}>
                          <Icon className={`h-5 w-5 ${config.color}`} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-[var(--foreground)]">{rule.nameAr}</h3>
                          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                            <span>{config.label}</span>
                            {rule.service && (
                              <>
                                <span>·</span>
                                <span>{rule.service.nameAr}</span>
                              </>
                            )}
                            <span>·</span>
                            <span>أولوية: {rule.priority}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`text-lg font-bold ${rule.multiplier >= 1 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {formatMultiplier(rule.multiplier)}
                        </span>

                        <Badge
                          variant={rule.isActive ? 'success' : 'secondary'}
                          className="cursor-pointer"
                          onClick={() => toggleMutation.mutate({ id: rule.id, isActive: !rule.isActive })}
                        >
                          {rule.isActive ? 'مفعّل' : 'معطّل'}
                        </Badge>
                      </div>
                    </div>
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
