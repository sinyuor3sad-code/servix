'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { UserPlus, Shield } from 'lucide-react';
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Select,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Skeleton,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import type { Role } from '@/types';

interface TenantUserItem {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  roleName: string;
  roleNameAr: string;
  status: 'active' | 'inactive';
}

interface UsersData {
  users: TenantUserItem[];
  roles: Role[];
}

const roleVariants: Record<string, 'default' | 'secondary' | 'success' | 'warning'> = {
  owner: 'default',
  manager: 'success',
  receptionist: 'warning',
  cashier: 'secondary',
  staff: 'secondary',
};

export default function UsersSettingsPage(): React.ReactElement {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('');

  const { data, isLoading } = useQuery<UsersData>({
    queryKey: ['settings', 'users'],
    queryFn: () => api.get<UsersData>('/settings/users', accessToken!),
    enabled: !!accessToken,
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      api.post(
        '/settings/users/invite',
        { email: inviteEmail, roleId: inviteRole },
        accessToken!,
      ),
    onSuccess: () => {
      toast.success('تم إرسال الدعوة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['settings', 'users'] });
      setInviteEmail('');
      setInviteRole('');
    },
    onError: () => {
      toast.error('حدث خطأ أثناء إرسال الدعوة');
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const roles = data?.roles ?? [];
  const users = data?.users ?? [];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="المستخدمين والصلاحيات" description="إدارة فريق العمل والأدوار" />

      <div className="mx-auto max-w-4xl space-y-6">
        {/* Invite User */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              دعوة مستخدم
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Input
                label="البريد الإلكتروني"
                type="email"
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1"
              />
              <Select
                label="الدور"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                options={[
                  { value: '', label: 'اختيار الدور' },
                  ...roles.map((r) => ({ value: r.id, label: r.nameAr })),
                ]}
              />
              <Button
                onClick={() => inviteMutation.mutate()}
                disabled={inviteMutation.isPending || !inviteEmail || !inviteRole}
                className="shrink-0"
              >
                {inviteMutation.isPending ? 'جارٍ الإرسال...' : 'إرسال دعوة'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Users List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              الفريق
            </CardTitle>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
                لا يوجد مستخدمين
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الاسم</TableHead>
                      <TableHead>البريد الإلكتروني</TableHead>
                      <TableHead>الدور</TableHead>
                      <TableHead>الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.fullName}</TableCell>
                        <TableCell dir="ltr" className="text-end">{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={roleVariants[user.roleName] ?? 'secondary'}>
                            {user.roleNameAr}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={user.status === 'active' ? 'success' : 'secondary'}
                          >
                            {user.status === 'active' ? 'نشط' : 'غير نشط'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
