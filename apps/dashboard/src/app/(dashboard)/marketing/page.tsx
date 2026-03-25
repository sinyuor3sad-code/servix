'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import {
  Megaphone,
  Plus,
  Send,
  Pause,
  Play,
  CalendarClock,
  Users,
  Clock,
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
import type { Campaign, CampaignStatus, CalendarGap } from '@/types';

const statusConfig: Record<CampaignStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  draft: { label: 'مسودة', variant: 'secondary' },
  active: { label: 'نشطة', variant: 'success' },
  completed: { label: 'مكتملة', variant: 'default' },
  paused: { label: 'متوقفة', variant: 'warning' },
};

const triggerLabels: Record<string, string> = {
  manual: 'يدوي',
  churn_risk: 'خطر فقدان',
  calendar_gap: 'فجوة تقويم',
  post_visit: 'بعد الزيارة',
  birthday: 'عيد ميلاد',
};

const channelLabels: Record<string, string> = {
  whatsapp: 'واتساب',
  sms: 'رسالة نصية',
  notification: 'إشعار',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ar-SA', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours, 10);
  const period = h >= 12 ? 'م' : 'ص';
  return `${h % 12 || 12}:${minutes} ${period}`;
}

export default function MarketingPage(): React.ReactElement {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    nameAr: '', trigger: 'manual', messageAr: '', channel: 'whatsapp',
  });

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['marketing', 'campaigns'],
    queryFn: () => dashboardService.getCampaigns(accessToken!),
    enabled: !!accessToken,
  });

  const { data: gaps } = useQuery({
    queryKey: ['marketing', 'gaps'],
    queryFn: () => dashboardService.getCalendarGaps(accessToken!),
    enabled: !!accessToken,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Campaign>) => dashboardService.createCampaign(data, accessToken!),
    onSuccess: () => {
      toast.success('تم إنشاء الحملة');
      queryClient.invalidateQueries({ queryKey: ['marketing'] });
      setShowForm(false);
      setNewCampaign({ nameAr: '', trigger: 'manual', messageAr: '', channel: 'whatsapp' });
    },
    onError: () => toast.error('فشل إنشاء الحملة'),
  });

  const executeMutation = useMutation({
    mutationFn: (id: string) => dashboardService.executeCampaign(id, accessToken!),
    onSuccess: (data) => {
      toast.success(`تم إرسال الحملة لـ ${data.sent} عميل`);
      queryClient.invalidateQueries({ queryKey: ['marketing'] });
    },
    onError: () => toast.error('فشل إرسال الحملة'),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="التسويق"
        description="الحملات التسويقية الآلية وكشف الفجوات"
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 me-2" />
            حملة جديدة
          </Button>
        }
      />

      {/* Calendar Gaps Alert */}
      {gaps && gaps.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <CalendarClock className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-800">فجوات في التقويم</p>
                  <p className="text-sm text-blue-600 mb-2">
                    {gaps.length} فترة فارغة في الأسبوع القادم — فرصة للتسويق!
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {gaps.slice(0, 4).map((gap, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                        <Clock className="h-3 w-3" />
                        {formatDate(gap.date)} {formatTime(gap.startTime)}-{formatTime(gap.endTime)}
                      </span>
                    ))}
                    {gaps.length > 4 && <span className="text-xs text-blue-500">+{gaps.length - 4} أخرى</span>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Create Campaign Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>حملة تسويقية جديدة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input placeholder="اسم الحملة *" value={newCampaign.nameAr} onChange={(e) => setNewCampaign(c => ({ ...c, nameAr: e.target.value }))} />
              <select
                className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm"
                value={newCampaign.trigger}
                onChange={(e) => setNewCampaign(c => ({ ...c, trigger: e.target.value }))}
              >
                {Object.entries(triggerLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <select
                className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm"
                value={newCampaign.channel}
                onChange={(e) => setNewCampaign(c => ({ ...c, channel: e.target.value }))}
              >
                {Object.entries(channelLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <textarea
              placeholder="نص الرسالة *"
              rows={3}
              className="mt-4 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              value={newCampaign.messageAr}
              onChange={(e) => setNewCampaign(c => ({ ...c, messageAr: e.target.value }))}
            />
            <div className="flex gap-2 mt-4">
              <Button
                disabled={!newCampaign.nameAr || !newCampaign.messageAr || createMutation.isPending}
                onClick={() => createMutation.mutate(newCampaign as Partial<Campaign>)}
              >
                إنشاء
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campaigns List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : !campaigns || campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="لا توجد حملات"
          description="أنشئ حملة تسويقية لاستهداف عملائك"
          actionLabel="حملة جديدة"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign, i) => {
            const config = statusConfig[campaign.status];

            return (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-semibold text-[var(--foreground)]">{campaign.nameAr}</h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-[var(--muted-foreground)]">
                          <span className="flex items-center gap-1">
                            <Megaphone className="h-3.5 w-3.5" />
                            {triggerLabels[campaign.trigger] || campaign.trigger}
                          </span>
                          <span>·</span>
                          <span>{channelLabels[campaign.channel] || campaign.channel}</span>
                          {campaign.executedAt && (
                            <>
                              <span>·</span>
                              <span>{formatDate(campaign.executedAt)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Badge variant={config.variant}>{config.label}</Badge>
                    </div>

                    <p className="text-sm text-[var(--muted-foreground)] bg-[var(--muted)] rounded-lg p-3 mb-3 line-clamp-2">
                      {campaign.messageAr}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                        <Users className="h-4 w-4" />
                        <span>{campaign.sentCount} أُرسلت</span>
                      </div>

                      {campaign.status === 'draft' && (
                        <Button
                          size="sm"
                          onClick={() => executeMutation.mutate(campaign.id)}
                          disabled={executeMutation.isPending}
                        >
                          <Send className="h-3.5 w-3.5 me-1" />
                          إرسال الآن
                        </Button>
                      )}
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
