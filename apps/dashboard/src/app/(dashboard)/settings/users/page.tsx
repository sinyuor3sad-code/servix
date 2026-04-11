'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, UserPlus, Shield, Mail, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import type { Role } from '@/types';

interface TenantUser { id: string; fullName: string; email: string; phone: string; roleName: string; roleNameAr: string; status: 'active' | 'inactive'; }
interface UsersData { users: TenantUser[]; roles: Role[]; }

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-50 text-amber-700 border-amber-200',
  manager: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  receptionist: 'bg-sky-50 text-sky-700 border-sky-200',
  cashier: 'bg-violet-50 text-violet-700 border-violet-200',
  staff: 'bg-slate-50 text-slate-700 border-slate-200',
};

const inputClass = "w-full px-4 py-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] text-sm focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none";

export default function UsersSettingsPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('');

  const { data, isLoading } = useQuery<any>({
    queryKey: ['settings', 'users'],
    queryFn: () => api.get<any>('/employees?limit=50', accessToken!),
    enabled: !!accessToken,
  });

  const invMut = useMutation({
    mutationFn: () => api.post('/settings/users/invite', { email: inviteEmail, roleId: inviteRole }, accessToken!),
    onSuccess: () => { toast.success('✅ تم إرسال الدعوة'); qc.invalidateQueries({ queryKey: ['settings', 'users'] }); setInviteEmail(''); setInviteRole(''); },
    onError: () => toast.error('خطأ في إرسال الدعوة'),
  });

  const roles: Role[] = [];
  const users: TenantUser[] = (data?.items ?? []).map((emp: any) => ({
    id: emp.id,
    fullName: emp.fullName,
    email: emp.email || '',
    phone: emp.phone || '',
    roleName: emp.role || 'staff',
    roleNameAr: emp.role === 'owner' ? 'مالك' : emp.role === 'manager' ? 'مديرة' : emp.role === 'receptionist' ? 'استقبال' : emp.role === 'cashier' ? 'كاشير' : 'موظفة',
    status: emp.isActive ? 'active' as const : 'inactive' as const,
  }));

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/settings')} className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] transition"><ArrowRight className="h-4 w-4" /></button>
        <div>
          <h1 className="text-xl font-black">المستخدمين والصلاحيات</h1>
          <p className="text-xs text-[var(--muted-foreground)]">إدارة فريق العمل</p>
        </div>
      </div>

      {/* Invite */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-l from-emerald-500 to-teal-600 text-white flex items-center gap-2">
          <UserPlus className="h-4 w-4 opacity-70" /><span className="text-xs font-bold">دعوة مستخدم جديد</span>
        </div>
        <div className="p-5 flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 w-full">
            <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">البريد الإلكتروني</label>
            <input type="email" dir="ltr" placeholder="user@example.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className={inputClass} />
          </div>
          <div className="w-full sm:w-44">
            <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">الدور</label>
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
              className={cn(inputClass, 'appearance-none')}>
              <option value="">اختيار الدور</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.nameAr}</option>)}
            </select>
          </div>
          <Button onClick={() => invMut.mutate()} disabled={invMut.isPending || !inviteEmail || !inviteRole} className="shrink-0 py-3">
            {invMut.isPending ? '...' : '📩 إرسال'}
          </Button>
        </div>
      </div>

      {/* Team */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-l from-violet-500 to-purple-600 text-white flex items-center gap-2">
          <Shield className="h-4 w-4 opacity-70" /><span className="text-xs font-bold">الفريق ({users.length})</span>
        </div>
        {users.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-10 w-10 mx-auto text-[var(--muted-foreground)] opacity-20 mb-2" />
            <p className="font-bold">لا يوجد مستخدمين</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {users.map(u => (
              <div key={u.id} className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--muted)]/20 transition">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--brand-primary)]/10 to-[var(--brand-primary)]/5 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-black text-[var(--brand-primary)]">{u.fullName[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{u.fullName}</p>
                  <p className="text-[10px] text-[var(--muted-foreground)]" dir="ltr">{u.email}</p>
                </div>
                <span className={cn('px-2.5 py-1 rounded-lg border text-[10px] font-bold', ROLE_COLORS[u.roleName] || ROLE_COLORS.staff)}>
                  {u.roleNameAr}
                </span>
                <span className={cn('px-2 py-0.5 rounded-md text-[9px] font-bold',
                  u.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-500')}>
                  {u.status === 'active' ? 'نشط' : 'غير نشط'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
