'use client';

import { useState, useEffect, type ReactElement } from 'react';
import {
  Search, ChevronLeft, ChevronRight, X,
  Building2, MapPin, Eye, Ban, MoreHorizontal, Plus,
} from 'lucide-react';
import { Glass, PageTitle, TN } from '@/components/ui/glass';
import { adminService, type Tenant as ApiTenant } from '@/services/admin.service';

const ST: Record<string, { label: string; badge: string }> = {
  active:    { label: 'نشط',    badge: 'nx-badge--green' },
  suspended: { label: 'معلّق',  badge: 'nx-badge--amber' },
  pending:   { label: 'بانتظار', badge: 'nx-badge--violet' },
};

/* ── Create Tenant Modal ── */
function CreateTenantModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    nameAr: '', nameEn: '', email: '', phone: '', city: '',
    ownerName: '', ownerPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const submit = async () => {
    if (!form.nameAr || !form.email || !form.phone || !form.ownerName || !form.ownerPassword) {
      setError('يرجى تعبئة جميع الحقول المطلوبة');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await adminService.createTenant(form);
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'حدث خطأ أثناء إنشاء الصالون');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nx-modal-overlay" onClick={onClose}>
      <div className="nx-modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 className="nx-modal-title" style={{ marginBottom: 0 }}>إنشاء صالون جديد</h2>
          <button className="nx-hamburger" style={{ width: 32, height: 32 }} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#F87171', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div className="nx-form-row">
          <div className="nx-form-group">
            <label className="nx-form-label">اسم الصالون (عربي) *</label>
            <input className="nx-form-input" value={form.nameAr} onChange={e => set('nameAr', e.target.value)} placeholder="صالون الأناقة" />
          </div>
          <div className="nx-form-group">
            <label className="nx-form-label">اسم الصالون (إنجليزي)</label>
            <input className="nx-form-input" value={form.nameEn} onChange={e => set('nameEn', e.target.value)} placeholder="Al-Anaqa Salon" dir="ltr" />
          </div>
        </div>

        <div className="nx-form-row">
          <div className="nx-form-group">
            <label className="nx-form-label">البريد الإلكتروني *</label>
            <input className="nx-form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="info@salon.com" dir="ltr" />
          </div>
          <div className="nx-form-group">
            <label className="nx-form-label">الهاتف *</label>
            <input className="nx-form-input" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="05xxxxxxxx" dir="ltr" />
          </div>
        </div>

        <div className="nx-form-group">
          <label className="nx-form-label">المدينة</label>
          <select className="nx-form-input" value={form.city} onChange={e => set('city', e.target.value)} style={{ appearance: 'none' }}>
            <option value="">اختر المدينة</option>
            {['الرياض', 'جدة', 'مكة', 'المدينة', 'الدمام', 'الخبر', 'أبها', 'تبوك', 'الطائف', 'حائل', 'نجران', 'جيزان', 'ينبع', 'القصيم', 'الجبيل'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 16 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate)', marginBottom: 12 }}>حساب مالك الصالون</h4>
          <div className="nx-form-row">
            <div className="nx-form-group" style={{ marginBottom: 0 }}>
              <label className="nx-form-label">الاسم الكامل *</label>
              <input className="nx-form-input" value={form.ownerName} onChange={e => set('ownerName', e.target.value)} placeholder="محمد أحمد" />
            </div>
            <div className="nx-form-group" style={{ marginBottom: 0 }}>
              <label className="nx-form-label">كلمة المرور *</label>
              <input className="nx-form-input" type="password" value={form.ownerPassword} onChange={e => set('ownerPassword', e.target.value)} placeholder="••••••••" dir="ltr" />
            </div>
          </div>
        </div>

        <div className="nx-form-actions">
          <button className="nx-btn" onClick={onClose}>إلغاء</button>
          <button className="nx-btn nx-btn--primary" onClick={submit} disabled={loading}>
            {loading ? (
              <span style={{ width: 16, height: 16, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 1s linear infinite', display: 'inline-block' }} />
            ) : (
              <><Plus size={14} /> إنشاء الصالون</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Action dropdown ── */
function Actions({ t, onStatus }: { t: ApiTenant; onStatus: (id: string, status: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button className="nx-btn" style={{ padding: 6, border: 'none', background: 'none' }} onClick={() => setOpen(!open)}>
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', left: 0, top: '100%', zIndex: 50, marginTop: 4, width: 160, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 6, boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}>
            <button
              onClick={() => { onStatus(t.id, t.status === 'active' ? 'suspended' : 'active'); setOpen(false); }}
              style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: 'none', background: 'none', color: t.status === 'active' ? '#FBBF24' : '#34D399', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {t.status === 'active' ? <Ban size={14} /> : <Eye size={14} />}
              {t.status === 'active' ? 'تعليق' : 'تفعيل'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function TenantsPage(): ReactElement {
  const [tenants, setTenants] = useState<ApiTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const PER = 10;

  const fetchTenants = () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('perPage', PER.toString());
    if (search) params.set('search', search);
    if (status) params.set('status', status);

    adminService.getTenants(params.toString())
      .then((res) => { setTenants(res.items ?? []); setTotal(res.meta?.total ?? 0); })
      .catch(() => { setTenants([]); setTotal(0); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTenants(); }, [page, search, status]);

  const pages = Math.max(1, Math.ceil(total / PER));

  const handleStatus = async (id: string, s: string) => {
    try {
      await adminService.updateTenantStatus(id, s);
      setTenants(prev => prev.map(t => t.id === id ? { ...t, status: s as ApiTenant['status'] } : t));
    } catch {}
  };

  const actCount = tenants.filter(t => t.status === 'active').length;
  const pendCount = tenants.filter(t => t.status === 'pending').length;

  return (
    <div className="nx-space-y">
      <PageTitle
        title="إدارة الأقاليم"
        desc={loading ? 'جاري التحميل...' : `${total} صالون مسجل في المنصة`}
        icon={<Building2 size={20} style={{ color: '#8B5CF6' }} strokeWidth={1.5} />}
      >
        <button className="nx-btn nx-btn--primary" onClick={() => setShowCreate(true)}>
          <Plus size={14} /> إنشاء صالون
        </button>
      </PageTitle>

      {/* Stats */}
      <div className="nx-stats-grid">
        {[
          { label: 'إجمالي', value: total, color: '#6366F1' },
          { label: 'نشط', value: actCount, color: '#34D399' },
          { label: 'بانتظار', value: pendCount, color: '#A78BFA' },
        ].map(k => (
          <Glass key={k.label} hover>
            <div className="nx-stat">
              <div className="nx-stat-icon" style={{ background: `${k.color}10` }}>
                <Building2 size={16} style={{ color: k.color, opacity: 0.8 }} strokeWidth={1.5} />
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
          <div className="nx-input-icon" style={{ flex: 1, minWidth: 180 }}>
            <Search size={16} />
            <input className="nx-input" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="بحث بالاسم أو الهاتف..." />
          </div>
          <select className="nx-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">جميع الحالات</option>
            <option value="active">نشطة</option>
            <option value="suspended">معلّقة</option>
            <option value="pending">بانتظار</option>
          </select>
          {(search || status) && (
            <button className="nx-btn" onClick={() => { setSearch(''); setStatus(''); setPage(1); }}>
              <X size={14} /> مسح
            </button>
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
        ) : tenants.length === 0 ? (
          <div className="nx-empty">
            <div className="nx-empty-icon"><Building2 size={22} /></div>
            <p className="nx-empty-title">لا توجد صالونات مسجلة</p>
            <p className="nx-empty-desc">اضغط "إنشاء صالون" لإضافة أول صالون</p>
          </div>
        ) : (
          <>
            <div className="nx-table-mobile-wrap">
              <table className="nx-table">
                <thead>
                  <tr>
                    <th>الصالون</th>
                    <th>المدينة</th>
                    <th>الهاتف</th>
                    <th>الحالة</th>
                    <th>التسجيل</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => {
                    const st = ST[t.status] || ST.pending;
                    return (
                      <tr key={t.id}>
                        <td className="nx-td-primary">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 14, fontWeight: 800, color: 'var(--ghost)' }}>
                              {(t.nameAr || t.nameEn || '?').charAt(0)}
                            </div>
                            <div>
                              <div>{t.nameAr || t.nameEn}</div>
                              <div style={{ fontSize: 10, color: 'var(--ghost)', marginTop: 2 }}>{t.slug}</div>
                            </div>
                          </div>
                        </td>
                        <td><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} style={{ color: 'var(--ghost)' }} />{t.city || '—'}</span></td>
                        <td style={TN}>{t.phone || '—'}</td>
                        <td><span className={`nx-badge ${st.badge}`}><span className="nx-badge-dot" />{st.label}</span></td>
                        <td style={TN}>{new Date(t.createdAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                        <td><Actions t={t} onStatus={handleStatus} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="nx-pagination">
                <span className="nx-pagination-info">صفحة {page} من {pages} · {total} صالون</span>
                <div className="nx-pagination-btns">
                  <button className="nx-pagination-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                    <ChevronRight size={14} />
                  </button>
                  {Array.from({ length: Math.min(pages, 7) }, (_, i) => i + 1).map(p => (
                    <button key={p} className={`nx-pagination-btn ${page === p ? 'nx-pagination-btn--active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                  ))}
                  <button className="nx-pagination-btn" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}>
                    <ChevronLeft size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Glass>

      {/* Create Modal */}
      {showCreate && <CreateTenantModal onClose={() => setShowCreate(false)} onCreated={fetchTenants} />}
    </div>
  );
}
