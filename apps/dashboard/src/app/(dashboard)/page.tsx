'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import {
  Calendar,
  DollarSign,
  Users,
  UserCog,
  Plus,
  UserPlus,
  FileText,
  Clock,
  ClipboardCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { dashboardService } from '@/services/dashboard.service';
import {
  StatCard,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
  Skeleton,
  PageHeader,
  EmptyState,
} from '@/components/ui';
import type { DashboardStats, Appointment } from '@/types';

const statusLabels: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  pending: { label: 'بانتظار', variant: 'warning' },
  confirmed: { label: 'مؤكد', variant: 'default' },
  in_progress: { label: 'جاري', variant: 'secondary' },
  completed: { label: 'مكتمل', variant: 'success' },
  cancelled: { label: 'ملغي', variant: 'destructive' },
  no_show: { label: 'لم يحضر', variant: 'destructive' },
};

function formatCurrency(value: number): string {
  return `${value.toLocaleString('ar-SA')} ر.س`;
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours, 10);
  const period = h >= 12 ? 'م' : 'ص';
  const displayHour = h % 12 || 12;
  return `${displayHour}:${minutes} ${period}`;
}

const cardFadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

function StatsSection({ stats }: { stats: DashboardStats }): React.ReactElement {
  return (
    <motion.div
      className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      initial="initial"
      animate="animate"
      variants={{
        animate: {
          transition: { staggerChildren: 0.06 },
        },
      }}
    >
      <motion.div variants={cardFadeIn}>
        <StatCard
          icon={Calendar}
          label="مواعيد اليوم"
          value={stats.todayAppointments}
          trend={{ value: 12, direction: 'up' }}
          animateValue
        />
      </motion.div>
      <motion.div variants={cardFadeIn}>
        <StatCard
          icon={DollarSign}
          label="إيرادات اليوم"
          value={stats.todayRevenue}
          animateValue
          valueFormat={(n) => formatCurrency(n)}
        />
      </motion.div>
      <motion.div variants={cardFadeIn}>
        <StatCard
          icon={Users}
          label="إجمالي العملاء"
          value={stats.totalClients}
          animateValue
        />
      </motion.div>
      <motion.div variants={cardFadeIn}>
        <StatCard
          icon={UserCog}
          label="إجمالي الموظفات"
          value={stats.totalEmployees}
          animateValue
        />
      </motion.div>
    </motion.div>
  );
}

function StatsSkeleton(): React.ReactElement {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} variant="card" className="h-[120px]" />
      ))}
    </div>
  );
}

function RevenueChart({ data }: { data: DashboardStats['revenueChart'] }): React.ReactElement {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
    >
    <Card>
      <CardHeader>
        <CardTitle>إيرادات الأسبوع</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--brand-primary)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--brand-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                stroke="var(--muted-foreground)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val: number) => `${val}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--background)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  fontFamily: 'var(--font-cairo), sans-serif',
                }}
                formatter={(val: number) => [formatCurrency(val), 'الإيرادات']}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="var(--brand-primary)"
                strokeWidth={2}
                fill="url(#revenueGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
    </motion.div>
  );
}

function AppointmentRow({ appointment }: { appointment: Appointment }): React.ReactElement {
  const status = statusLabels[appointment.status] ?? { label: appointment.status, variant: 'secondary' as const };

  return (
    <Link href={`/dashboard/appointments/${appointment.id}`}>
      <div className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-[var(--muted)]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-50)] text-[var(--brand-primary)]">
        <Clock className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--foreground)]">
          {appointment.client?.fullName || 'عميل'}
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">
          {formatTime(appointment.startTime)} — {appointment.employee?.fullName || 'غير محدد'}
        </p>
      </div>
      <Badge variant={status.variant}>{status.label}</Badge>
    </div>
    </Link>
  );
}

function TodayAppointments({ appointments }: { appointments: Appointment[] }): React.ReactElement {
  const router = useRouter();
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.15 }}
    >
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>مواعيد اليوم</CardTitle>
        <Link href="/dashboard/appointments">
          <Button variant="ghost" size="sm">
            عرض الكل
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {appointments.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="لا توجد مواعيد اليوم"
            description="لم يتم حجز أي مواعيد لهذا اليوم بعد"
            actionLabel="حجز جديد"
            onAction={() => router.push('/dashboard/appointments/new')}
          />
        ) : (
          <div className="space-y-1">
            {appointments.slice(0, 5).map((apt) => (
              <AppointmentRow key={apt.id} appointment={apt} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
    </motion.div>
  );
}

function QuickActions(): React.ReactElement {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 }}
    >
    <Card>
      <CardHeader>
        <CardTitle>إجراءات سريعة</CardTitle>
        <p className="text-sm text-[var(--muted-foreground)]">
          الوصول السريع للمهام الشائعة
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link href="/dashboard/appointments/new">
            <Button variant="outline" className="h-auto w-full flex-col gap-2 py-4">
              <Plus className="h-5 w-5 text-[var(--brand-primary)]" />
              <span>حجز جديد</span>
            </Button>
          </Link>
          <Link href="/dashboard/clients/new">
            <Button variant="outline" className="h-auto w-full flex-col gap-2 py-4">
              <UserPlus className="h-5 w-5 text-[var(--success)]" />
              <span>عميل جديد</span>
            </Button>
          </Link>
          <Link href="/dashboard/pos">
            <Button variant="outline" className="h-auto w-full flex-col gap-2 py-4">
              <FileText className="h-5 w-5 text-[var(--brand-secondary)]" />
              <span>الكاشير</span>
            </Button>
          </Link>
          <Link href="/dashboard/attendance">
            <Button variant="outline" className="h-auto w-full flex-col gap-2 py-4">
              <ClipboardCheck className="h-5 w-5 text-[var(--brand-primary)]" />
              <span>الحضور</span>
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
    </motion.div>
  );
}

const placeholderChartData = [
  { date: 'السبت', revenue: 1200, appointments: 5 },
  { date: 'الأحد', revenue: 1800, appointments: 8 },
  { date: 'الإثنين', revenue: 900, appointments: 4 },
  { date: 'الثلاثاء', revenue: 2200, appointments: 10 },
  { date: 'الأربعاء', revenue: 1600, appointments: 7 },
  { date: 'الخميس', revenue: 2800, appointments: 12 },
  { date: 'الجمعة', revenue: 500, appointments: 2 },
];

export default function DashboardPage(): React.ReactElement {
  const { accessToken } = useAuth();

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardService.getStats(accessToken!),
    enabled: !!accessToken,
    staleTime: 2 * 60 * 1000,
  });

  const chartData = useMemo(
    () => stats?.revenueChart ?? placeholderChartData,
    [stats],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="الرئيسية"
        description="نظرة عامة على أداء الصالون"
      />

      {/* Stat Cards */}
      {isLoading ? (
        <StatsSkeleton />
      ) : (
        <StatsSection
          stats={stats ?? {
            todayAppointments: 0,
            todayRevenue: 0,
            totalClients: 0,
            totalEmployees: 0,
            monthlyRevenue: 0,
            monthlyAppointments: 0,
            recentAppointments: [],
            revenueChart: [],
          }}
        />
      )}

      {/* Quick Actions */}
      <QuickActions />

      {/* Charts + Today's Appointments */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RevenueChart data={chartData} />
        <TodayAppointments appointments={stats?.recentAppointments ?? []} />
      </div>
    </div>
  );
}
