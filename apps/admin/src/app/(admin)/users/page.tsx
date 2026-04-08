'use client';

import { useState, useEffect, type ReactElement, useCallback } from 'react';
import {
  Search, ChevronLeft, ChevronRight, X,
  Users, Mail, Phone, ShieldCheck, ShieldX, Crown,
  Eye, Edit3, Ban, CheckCircle, Key, Send, UserCog,
  UserX, RotateCcw, LogOut, Shield, Trash2, MoreHorizontal,
  AlertTriangle, Copy, Clock, Zap,
} from 'lucide-react';
import { Glass, PageTitle, TN } from '@/components/ui/glass';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { adminService } from '@/services/admin.service';

/* ── Confirm Dialog ── */
function ConfirmDialog({ title, message, danger, onConfirm, onClose }: {
  title: string; message: string; danger?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const go = async () => { setLoading(true); await onConfirm(); setLoading(false); };
  return (
    <div className="nx-modal-overlay" onClick={onClose}>
      <div className="nx-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          {danger && <AlertTriangle size={20} style={{ color: '#F87171' }} />}
          <h2 className="nx-modal-title" style={{ marginBottom: 0 }}>{title}</h2>
        </div>
        <p style={{ fontSize: 14, color: 'var(--ghost)', lineHeight: 1.7, marginBottom: 20 }}>{message}</p>
        <div className="nx-form-actions">
          <button className="nx-btn" onClick={onClose}>إلغاء</button>
          <button className={`nx-btn ${danger ? 'nx-btn--danger' : 'nx-btn--primary'}`} onClick={go} disabled={loading}>
            {loading ? <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite', display: 'inline-block' }} /> : 'تأكيد'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── User Detail Modal ── */
function UserDetailModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    adminService.getUserById(userId).then(setUser).finally(() => setLoading(false));
  }, [userId]);

  if (loading) return (
    <div className="nx-modal-overlay" onClick={onClose}>
      <div className="nx-modal" onClick={e => e.stopPropagation()}>
        <div className="nx-empty">
          <div style={{ width: 28, height: 28, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
      </div>
    </div>
  );

  if (!user) return null;

  return (
    <div className="nx-modal-overlay" onClick={onClose}>
      <div className="nx-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 className="nx-modal-title" style={{ marginBottom: 0 }}>تفاصيل المستخدم</h2>
          <button className="nx-hamburger" style={{ width: 32, height: 32 }} onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
          {[
            { label: 'الاسم', value: user.fullName },
            { label: 'البريد', value: user.email, dir: 'ltr' },
            { label: 'الهاتف', value: user.phone, dir: 'ltr' },
            { label: 'مصدر التسجيل', value: user.authProvider },
            { label: 'تأكيد الإيميل', value: user.isEmailVerified ? '✅ مؤكد' : '❌ غير مؤكد' },
            { label: 'تأكيد الجوال', value: user.isPhoneVerified ? '✅ مؤكد' : '❌ غير مؤكد' },
            { label: 'المصادقة الثنائية', value: user.twoFactorEnabled ? '✅ مفعلة' : '❌ غير مفعلة' },
            { label: 'آخر دخول', value: user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('ar-SA') : 'لم يسجل دخول' },
            { label: 'تاريخ التسجيل', value: new Date(user.createdAt).toLocaleString('ar-SA') },
            { label: 'آخر تحديث', value: new Date(user.updatedAt).toLocaleString('ar-SA') },
          ].map(item => (
            <div key={item.label}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ghost)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', ...(item.dir ? { direction: 'ltr' as const, textAlign: 'start' as const } : {}), ...TN }}>{item.value}</div>
            </div>
          ))}
        </div>

        {user.tenantUsers?.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', marginBottom: 8 }}>الصالونات المرتبطة</div>
            {user.tenantUsers.map((tu: any) => (
              <div key={tu.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 6 }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{tu.tenant?.nameAr || tu.tenant?.nameEn}</span>
                  {tu.isOwner && <span style={{ fontSize: 10, color: '#D4AF37', marginInlineStart: 8 }}>👑 مالك</span>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span className={`nx-badge ${tu.status === 'active' ? 'nx-badge--green' : 'nx-badge--red'}`}><span className="nx-badge-dot" />{tu.status}</span>
                  <span className="nx-badge nx-badge--violet"><span className="nx-badge-dot" />{tu.role?.nameAr || tu.role?.name}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Edit User Modal ── */
function EditUserModal({ user, onClose, onSaved }: { user: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ fullName: user.fullName, email: user.email, phone: user.phone });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const submit = async () => {
    setLoading(true); setError('');
    try {
      await adminService.updateUser(user.id, form);
      onSaved(); onClose();
    } catch (e: any) { setError(e?.message || 'حدث خطأ'); }
    finally { setLoading(false); }
  };

  return (
    <div className="nx-modal-overlay" onClick={onClose}>
      <div className="nx-modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 className="nx-modal-title" style={{ marginBottom: 0 }}>تعديل بيانات المستخدم</h2>
          <button className="nx-hamburger" style={{ width: 32, height: 32 }} onClick={onClose}><X size={16} /></button>
        </div>
        {error && <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#F87171', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{error}</div>}
        <div className="nx-form-group"><label className="nx-form-label">الاسم الكامل</label><input className="nx-form-input" value={form.fullName} onChange={e => set('fullName', e.target.value)} /></div>
        <div className="nx-form-group"><label className="nx-form-label">البريد الإلكتروني</label><input className="nx-form-input" value={form.email} onChange={e => set('email', e.target.value)} dir="ltr" /></div>
        <div className="nx-form-group"><label className="nx-form-label">رقم الهاتف</label><input className="nx-form-input" value={form.phone} onChange={e => set('phone', e.target.value)} dir="ltr" /></div>
        <div className="nx-form-actions">
          <button className="nx-btn" onClick={onClose}>إلغاء</button>
          <button className="nx-btn nx-btn--primary" onClick={submit} disabled={loading}>{loading ? '...' : '💾 حفظ'}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Reset Password Modal ── */
function ResetPasswordModal({ user, onClose, onDone }: { user: any; onClose: () => void; onDone: () => void }) {
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (pw.length < 8) { setError('8 أحرف على الأقل'); return; }
    setLoading(true); setError('');
    try { await adminService.resetUserPassword(user.id, pw); onDone(); onClose(); }
    catch (e: any) { setError(e?.message || 'خطأ'); }
    finally { setLoading(false); }
  };

  return (
    <div className="nx-modal-overlay" onClick={onClose}>
      <div className="nx-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <h2 className="nx-modal-title">إعادة تعيين كلمة المرور</h2>
        <p style={{ fontSize: 13, color: 'var(--ghost)', marginBottom: 16 }}>للمستخدم: <strong>{user.fullName}</strong> ({user.email})</p>
        {error && <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(248,113,113,0.08)', color: '#F87171', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div className="nx-form-group">
          <label className="nx-form-label">كلمة المرور الجديدة</label>
          <input className="nx-form-input" type="password" value={pw} onChange={e => setPw(e.target.value)} dir="ltr" placeholder="8 أحرف على الأقل" />
        </div>
        <div className="nx-form-actions">
          <button className="nx-btn" onClick={onClose}>إلغاء</button>
          <button className="nx-btn nx-btn--primary" onClick={submit} disabled={loading}>{loading ? '...' : '🔑 تعيين'}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Impersonate Result Modal ── */
function ImpersonateModal({ data, onClose }: { data: any; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(data.accessToken); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div className="nx-modal-overlay" onClick={onClose}>
      <div className="nx-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <h2 className="nx-modal-title">🎭 جلسة انتحال هوية</h2>
        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(248,113,113,0.04)', border: '1px solid rgba(248,113,113,0.15)', marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#F87171', margin: 0 }}>⚠️ تحذير أمني: هذه الجلسة مسجلة في سجل الأحداث وتنتهي خلال 15 دقيقة</p>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <div><span style={{ fontSize: 11, color: 'var(--ghost)' }}>المستخدم:</span> <strong>{data.user.fullName}</strong> ({data.user.email})</div>
          <div><span style={{ fontSize: 11, color: 'var(--ghost)' }}>الصالون:</span> <strong>{data.tenant.nameAr}</strong></div>
          <div><span style={{ fontSize: 11, color: 'var(--ghost)' }}>ينتهي خلال:</span> <strong style={{ color: '#FBBF24' }}>15 دقيقة</strong></div>
        </div>
        <div style={{ marginTop: 16 }}>
          <label className="nx-form-label">التوكن (انسخه واستخدمه في الداشبورد)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="nx-form-input" value={data.accessToken} readOnly dir="ltr" style={{ fontSize: 11, fontFamily: 'monospace' }} />
            <button className="nx-btn nx-btn--primary" onClick={copy} style={{ flexShrink: 0 }}>
              {copied ? '✓' : <><Copy size={14} /> نسخ</>}
            </button>
          </div>
        </div>
        <div className="nx-form-actions" style={{ marginTop: 16 }}>
          <button className="nx-btn" onClick={onClose}>إغلاق</button>
        </div>
      </div>
    </div>
  );
}

/* ── Delete User Modal (Two Options) ── */
function DeleteUserModal({ user, onClose, onDone }: { user: any; onClose: () => void; onDone: (msg: string) => void }) {
  const [loading, setLoading] = useState<'immediate' | 'grace' | null>(null);

  const handleDelete = async (immediate: boolean) => {
    setLoading(immediate ? 'immediate' : 'grace');
    try {
      const res = await adminService.deleteUser(user.id, immediate);
      onDone(res.message || 'تم الحذف');
      onClose();
    } catch { setLoading(null); }
  };

  return (
    <div className="nx-modal-overlay" onClick={onClose}>
      <div className="nx-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <AlertTriangle size={20} style={{ color: '#F87171' }} />
          <h2 className="nx-modal-title" style={{ marginBottom: 0 }}>حذف المستخدم</h2>
        </div>
        <p style={{ fontSize: 14, color: 'var(--ghost)', lineHeight: 1.7, marginBottom: 20 }}>
          أنت على وشك حذف حساب <strong style={{ color: 'var(--slate)' }}>{user.fullName}</strong> ({user.email}). اختر طريقة الحذف:
        </p>

        <div style={{ display: 'grid', gap: 10 }}>
          {/* Grace Period Option */}
          <button
            onClick={() => handleDelete(false)}
            disabled={!!loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '16px 18px', borderRadius: 12,
              border: '1px solid rgba(251,191,36,0.2)',
              background: 'rgba(251,191,36,0.04)',
              cursor: 'pointer', textAlign: 'start',
              transition: 'all 0.2s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(251,191,36,0.08)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(251,191,36,0.04)'; }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(251,191,36,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {loading === 'grace' ? <div style={{ width: 16, height: 16, border: '2px solid #FBBF24', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : <Clock size={18} style={{ color: '#FBBF24' }} />}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#FBBF24', marginBottom: 3 }}>⏱️ حذف مع مهلة</div>
              <div style={{ fontSize: 12, color: 'var(--ghost)', lineHeight: 1.5 }}>يُعلّق الحساب الآن ويُحذف نهائياً بعد المهلة المحددة (قابلة للتعديل من الإعدادات). يمكنك الاستعادة قبل انتهاء المهلة.</div>
            </div>
          </button>

          {/* Immediate Option */}
          <button
            onClick={() => handleDelete(true)}
            disabled={!!loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '16px 18px', borderRadius: 12,
              border: '1px solid rgba(248,113,113,0.2)',
              background: 'rgba(248,113,113,0.04)',
              cursor: 'pointer', textAlign: 'start',
              transition: 'all 0.2s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.08)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.04)'; }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(248,113,113,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {loading === 'immediate' ? <div style={{ width: 16, height: 16, border: '2px solid #F87171', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : <Zap size={18} style={{ color: '#F87171' }} />}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#F87171', marginBottom: 3 }}>⚡ حذف فوري</div>
              <div style={{ fontSize: 12, color: 'var(--ghost)', lineHeight: 1.5 }}>يُحذف الحساب ويُخفى فوراً (إخفاء البيانات). لا يزال قابلاً للاستعادة لكن البيانات الحساسة تُخفى فوراً.</div>
            </div>
          </button>
        </div>

        <div className="nx-form-actions" style={{ marginTop: 20 }}>
          <button className="nx-btn" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════ Main Page ════════════════════ */
export default function UsersPage(): ReactElement {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [verified, setVerified] = useState('');
  const [page, setPage] = useState(1);
  const PER = 20;

  // Modals
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<any>(null);
  const [resetPwUser, setResetPwUser] = useState<any>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; danger?: boolean; action: () => Promise<void> } | null>(null);
  const [impersonateData, setImpersonateData] = useState<any>(null);
  const [deleteUserData, setDeleteUserData] = useState<any>(null);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const fetchUsers = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('perPage', PER.toString());
    if (search) params.set('search', search);
    if (verified) params.set('verified', verified);

    adminService.getUsers(params.toString())
      .then((res) => { setUsers(res.data ?? []); setTotal(res.meta?.total ?? 0); })
      .catch(() => { setUsers([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [page, search, verified]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const pages = Math.max(1, Math.ceil(total / PER));
  const verifiedCount = users.filter(u => u.isEmailVerified).length;
  const unverifiedCount = users.filter(u => !u.isEmailVerified).length;

  const isDeleted = (u: any) => u.fullName?.startsWith('[محذوف]') || u.fullName?.startsWith('[قيد الحذف]');

  const buildActions = (u: any) => {
    const items: any[] = [
      { label: 'عرض التفاصيل', icon: <Eye size={14} />, onClick: () => setDetailId(u.id) },
      { label: 'تعديل البيانات', icon: <Edit3 size={14} />, onClick: () => setEditUser(u) },
      { divider: true },
    ];

    // Status
    const tuStatus = u.tenantUsers?.[0]?.status;
    if (tuStatus === 'active') {
      items.push({ label: 'تعليق الحساب', icon: <Ban size={14} />, color: '#FBBF24', onClick: () => setConfirm({
        title: 'تعليق الحساب', message: `هل تريد تعليق حساب "${u.fullName}"؟ لن يتمكن من الدخول.`, danger: true,
        action: async () => { await adminService.updateUserStatus(u.id, 'suspended'); showToast('تم تعليق الحساب'); fetchUsers(); },
      })});
    } else {
      items.push({ label: 'تفعيل الحساب', icon: <CheckCircle size={14} />, color: '#34D399', onClick: () => setConfirm({
        title: 'تفعيل الحساب', message: `هل تريد تفعيل حساب "${u.fullName}"؟`,
        action: async () => { await adminService.updateUserStatus(u.id, 'active'); showToast('تم تفعيل الحساب'); fetchUsers(); },
      })});
    }

    items.push({ divider: true });

    // Password
    items.push({ label: 'إعادة تعيين كلمة المرور', icon: <Key size={14} />, onClick: () => setResetPwUser(u) });
    items.push({ label: 'إرسال رابط تعيين', icon: <Send size={14} />, onClick: () => setConfirm({
      title: 'إرسال رابط', message: `سيتم إرسال رابط تعيين كلمة المرور إلى ${u.email}`,
      action: async () => { await adminService.sendResetLink(u.id); showToast(`تم إرسال الرابط إلى ${u.email}`); },
    })});

    items.push({ divider: true });

    // Verification
    items.push({ label: u.isEmailVerified ? '❌ إلغاء توثيق الإيميل' : '✅ توثيق الإيميل يدوياً', icon: <Shield size={14} />, color: u.isEmailVerified ? '#F87171' : '#34D399', onClick: () => setConfirm({
      title: u.isEmailVerified ? 'إلغاء توثيق الإيميل' : 'توثيق الإيميل يدوياً',
      message: u.isEmailVerified ? `هل تريد إلغاء توثيق إيميل "${u.email}"؟` : `هل تريد توثيق إيميل "${u.email}" يدوياً؟`,
      danger: u.isEmailVerified,
      action: async () => { await adminService.updateVerification(u.id, { isEmailVerified: !u.isEmailVerified }); showToast('تم التحديث'); fetchUsers(); },
    })});
    items.push({ label: u.isPhoneVerified ? '❌ إلغاء توثيق الجوال' : '✅ توثيق الجوال يدوياً', icon: <Phone size={14} />, color: u.isPhoneVerified ? '#F87171' : '#34D399', onClick: () => setConfirm({
      title: u.isPhoneVerified ? 'إلغاء توثيق الجوال' : 'توثيق الجوال يدوياً',
      message: u.isPhoneVerified ? `هل تريد إلغاء توثيق جوال "${u.phone}"؟` : `هل تريد توثيق جوال "${u.phone}" يدوياً؟`,
      danger: u.isPhoneVerified,
      action: async () => { await adminService.updateVerification(u.id, { isPhoneVerified: !u.isPhoneVerified }); showToast('تم التحديث'); fetchUsers(); },
    })});

    items.push({ divider: true });

    // Impersonate
    items.push({ label: '🎭 الدخول كمستخدم', icon: <UserCog size={14} />, color: '#A78BFA', onClick: () => setConfirm({
      title: 'انتحال هوية (Impersonate)', message: `ستحصل على توكن مؤقت (15 دقيقة) لدخول لوحة "${u.fullName}". هذا الإجراء مُسجل أمنياً.`, danger: true,
      action: async () => { const res = await adminService.impersonateUser(u.id); setImpersonateData(res); },
    })});

    // Force logout
    items.push({ label: 'تسجيل خروج شامل', icon: <LogOut size={14} />, color: '#FBBF24', onClick: () => setConfirm({
      title: 'تسجيل خروج شامل', message: `سيتم تسجيل خروج "${u.fullName}" من جميع الأجهزة فوراً.`, danger: true,
      action: async () => { await adminService.forceLogoutUser(u.id); showToast('تم تسجيل الخروج من جميع الأجهزة'); },
    })});

    items.push({ divider: true });

    // Delete / Restore
    if (isDeleted(u)) {
      items.push({ label: '♻️ استعادة المستخدم', icon: <RotateCcw size={14} />, color: '#34D399', onClick: () => setConfirm({
        title: 'استعادة المستخدم', message: `هل تريد استعادة حساب "${u.fullName.replace('[محذوف] ', '').replace('[قيد الحذف] ', '')}"؟`,
        action: async () => { await adminService.restoreUser(u.id); showToast('تم استعادة المستخدم'); fetchUsers(); },
      })});
    } else {
      items.push({ label: '🗑️ حذف المستخدم', icon: <Trash2 size={14} />, color: '#F87171', onClick: () => setDeleteUserData(u) });
    }

    return items;
  };

  return (
    <div className="nx-space-y">
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          padding: '10px 24px', borderRadius: 10, background: 'rgba(52,211,153,0.15)',
          border: '1px solid rgba(52,211,153,0.3)', color: '#34D399',
          fontSize: 14, fontWeight: 700, zIndex: 9999, backdropFilter: 'blur(12px)',
          animation: 'fadeIn 0.3s ease',
        }}>{toast}</div>
      )}

      <PageTitle
        title="المستخدمون"
        desc={loading ? 'جاري التحميل...' : `${total} مستخدم مسجل في المنصة`}
        icon={<Users size={20} style={{ color: '#6366F1' }} strokeWidth={1.5} />}
      />

      {/* Stats */}
      <div className="nx-stats-grid">
        {[
          { label: 'إجمالي المستخدمين', value: total, color: '#6366F1', icon: Users },
          { label: 'إيميل مُؤكد', value: verifiedCount, color: '#34D399', icon: ShieldCheck },
          { label: 'غير مُؤكد', value: unverifiedCount, color: '#F87171', icon: ShieldX },
        ].map(k => (
          <Glass key={k.label} hover>
            <div className="nx-stat">
              <div className="nx-stat-icon" style={{ background: `${k.color}10` }}>
                <k.icon size={16} style={{ color: k.color, opacity: 0.8 }} strokeWidth={1.5} />
              </div>
              <div>
                <div className="nx-stat-label">{k.label}</div>
                <div className="nx-stat-value" style={TN}>{loading ? '—' : k.value}</div>
              </div>
            </div>
          </Glass>
        ))}
      </div>

      {/* Filters */}
      <Glass>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 14 }}>
          <div className="nx-input-icon" style={{ flex: 1, minWidth: 200 }}>
            <Search size={16} />
            <input className="nx-input" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="بحث بالاسم أو الإيميل أو الهاتف..." />
          </div>
          <select className="nx-select" value={verified} onChange={(e) => { setVerified(e.target.value); setPage(1); }}>
            <option value="">جميع الحالات</option>
            <option value="true">إيميل مُؤكد ✅</option>
            <option value="false">غير مُؤكد ❌</option>
          </select>
          {(search || verified) && (
            <button className="nx-btn" onClick={() => { setSearch(''); setVerified(''); setPage(1); }}><X size={14} /> مسح</button>
          )}
        </div>
      </Glass>

      {/* Table */}
      <Glass>
        {loading ? (
          <div className="nx-empty">
            <div style={{ width: 28, height: 28, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p className="nx-empty-desc" style={{ marginTop: 12 }}>جاري التحميل...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="nx-empty">
            <div className="nx-empty-icon"><Users size={22} /></div>
            <p className="nx-empty-title">لا يوجد مستخدمون</p>
          </div>
        ) : (
          <>
            <div className="nx-table-mobile-wrap">
              <table className="nx-table">
                <thead>
                  <tr>
                    <th>المستخدم</th>
                    <th>البريد الإلكتروني</th>
                    <th>رقم الهاتف</th>
                    <th>التحقق</th>
                    <th>الصالون</th>
                    <th>التسجيل</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const tenant = u.tenantUsers?.[0];
                    const deleted = isDeleted(u);
                    return (
                      <tr key={u.id} style={deleted ? { opacity: 0.5 } : undefined}>
                        <td className="nx-td-primary">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: 10,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: deleted ? 'rgba(148,148,148,0.08)' : u.isEmailVerified ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)',
                              border: `1px solid ${deleted ? 'rgba(148,148,148,0.2)' : u.isEmailVerified ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}`,
                              fontSize: 14, fontWeight: 800,
                              color: deleted ? '#949494' : u.isEmailVerified ? '#34D399' : '#F87171',
                            }}>
                              {deleted ? <UserX size={16} /> : (u.fullName || '?').charAt(0)}
                            </div>
                            <div>
                              <div>{u.fullName}</div>
                              {tenant?.isOwner && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#D4AF37', marginTop: 2 }}>
                                  <Crown size={10} /> مالك
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td data-label="الإيميل">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Mail size={12} style={{ color: 'var(--ghost)', flexShrink: 0 }} />
                            <span dir="ltr" style={{ ...TN, fontSize: 13 }}>{u.email}</span>
                          </div>
                        </td>
                        <td data-label="الهاتف">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Phone size={12} style={{ color: 'var(--ghost)', flexShrink: 0 }} />
                            <span dir="ltr" style={{ ...TN, fontSize: 13 }}>{u.phone}</span>
                          </div>
                        </td>
                        <td data-label="التحقق">
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            <span className={`nx-badge ${u.isEmailVerified ? 'nx-badge--green' : 'nx-badge--red'}`} style={{ fontSize: 10 }}>
                              <span className="nx-badge-dot" />{u.isEmailVerified ? 'إيميل ✓' : 'إيميل ✗'}
                            </span>
                            <span className={`nx-badge ${u.isPhoneVerified ? 'nx-badge--green' : 'nx-badge--red'}`} style={{ fontSize: 10 }}>
                              <span className="nx-badge-dot" />{u.isPhoneVerified ? 'جوال ✓' : 'جوال ✗'}
                            </span>
                          </div>
                        </td>
                        <td data-label="الصالون">{tenant ? <span style={{ fontSize: 13 }}>{tenant.tenant?.nameAr || '—'}</span> : <span style={{ color: 'var(--ghost)', fontSize: 12 }}>—</span>}</td>
                        <td data-label="التسجيل" style={TN}>{new Date(u.createdAt).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}</td>
                        <td>
                          <DropdownMenu items={buildActions(u)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="nx-pagination">
                <span className="nx-pagination-info">صفحة {page} من {pages} · {total} مستخدم</span>
                <div className="nx-pagination-btns">
                  <button className="nx-pagination-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronRight size={14} /></button>
                  {Array.from({ length: Math.min(pages, 7) }, (_, i) => i + 1).map(p => (
                    <button key={p} className={`nx-pagination-btn ${page === p ? 'nx-pagination-btn--active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                  ))}
                  <button className="nx-pagination-btn" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}><ChevronLeft size={14} /></button>
                </div>
              </div>
            )}
          </>
        )}
      </Glass>

      {/* Modals */}
      {detailId && <UserDetailModal userId={detailId} onClose={() => setDetailId(null)} />}
      {editUser && <EditUserModal user={editUser} onClose={() => setEditUser(null)} onSaved={fetchUsers} />}
      {resetPwUser && <ResetPasswordModal user={resetPwUser} onClose={() => setResetPwUser(null)} onDone={() => showToast('تم تعيين كلمة المرور')} />}
      {confirm && <ConfirmDialog title={confirm.title} message={confirm.message} danger={confirm.danger} onConfirm={async () => { await confirm.action(); setConfirm(null); }} onClose={() => setConfirm(null)} />}
      {impersonateData && <ImpersonateModal data={impersonateData} onClose={() => setImpersonateData(null)} />}
      {deleteUserData && <DeleteUserModal user={deleteUserData} onClose={() => setDeleteUserData(null)} onDone={(msg) => { showToast(msg); fetchUsers(); }} />}
    </div>
  );
}
