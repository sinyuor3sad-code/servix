'use client';

import { useState, useEffect, type ReactElement } from 'react';
import {
  Search, ChevronLeft, ChevronRight, X,
  Users, Mail, Phone, ShieldCheck, ShieldX, Crown,
} from 'lucide-react';
import { Glass, PageTitle, TN } from '@/components/ui/glass';
import { adminService } from '@/services/admin.service';

export default function UsersPage(): ReactElement {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [verified, setVerified] = useState('');
  const [page, setPage] = useState(1);
  const PER = 20;

  const fetchUsers = () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('perPage', PER.toString());
    if (search) params.set('search', search);
    if (verified) params.set('verified', verified);

    adminService.getUsers(params.toString())
      .then((res) => { setUsers(res.data ?? []); setTotal(res.meta?.total ?? 0); })
      .catch((e) => { console.error('Users fetch error:', e); setUsers([]); setTotal(0); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, [page, search, verified]); // eslint-disable-line

  const pages = Math.max(1, Math.ceil(total / PER));
  const verifiedCount = users.filter(u => u.isEmailVerified).length;
  const unverifiedCount = users.filter(u => !u.isEmailVerified).length;

  return (
    <div className="nx-space-y">
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
            <input
              className="nx-input"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="بحث بالاسم أو الإيميل أو الهاتف..."
            />
          </div>
          <select
            className="nx-select"
            value={verified}
            onChange={(e) => { setVerified(e.target.value); setPage(1); }}
          >
            <option value="">جميع الحالات</option>
            <option value="true">إيميل مُؤكد ✅</option>
            <option value="false">غير مُؤكد ❌</option>
          </select>
          {(search || verified) && (
            <button className="nx-btn" onClick={() => { setSearch(''); setVerified(''); setPage(1); }}>
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
        ) : users.length === 0 ? (
          <div className="nx-empty">
            <div className="nx-empty-icon"><Users size={22} /></div>
            <p className="nx-empty-title">لا يوجد مستخدمون</p>
            <p className="nx-empty-desc">لم يتم تسجيل أي مستخدم بعد</p>
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
                    <th>آخر دخول</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const tenant = u.tenantUsers?.[0];
                    return (
                      <tr key={u.id}>
                        <td className="nx-td-primary">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: 10,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: u.isEmailVerified ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)',
                              border: `1px solid ${u.isEmailVerified ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}`,
                              fontSize: 14, fontWeight: 800,
                              color: u.isEmailVerified ? '#34D399' : '#F87171',
                            }}>
                              {(u.fullName || '?').charAt(0)}
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
                          <div style={{ display: 'flex', gap: 6 }}>
                            <span className={`nx-badge ${u.isEmailVerified ? 'nx-badge--green' : 'nx-badge--red'}`}>
                              <span className="nx-badge-dot" />
                              {u.isEmailVerified ? 'الإيميل ✓' : 'الإيميل ✗'}
                            </span>
                          </div>
                        </td>
                        <td data-label="الصالون">
                          {tenant ? (
                            <span style={{ fontSize: 13 }}>{tenant.tenant?.nameAr || tenant.tenant?.nameEn || '—'}</span>
                          ) : (
                            <span style={{ color: 'var(--ghost)', fontSize: 12 }}>—</span>
                          )}
                        </td>
                        <td data-label="التسجيل" style={TN}>
                          {new Date(u.createdAt).toLocaleDateString('ar-SA', {
                            year: 'numeric', month: 'short', day: 'numeric',
                          })}
                        </td>
                        <td data-label="آخر دخول" style={TN}>
                          {u.lastLoginAt
                            ? new Date(u.lastLoginAt).toLocaleDateString('ar-SA', {
                                year: 'numeric', month: 'short', day: 'numeric',
                              })
                            : <span style={{ color: 'var(--ghost)', fontSize: 12 }}>لم يسجل دخول</span>
                          }
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
    </div>
  );
}
