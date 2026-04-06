'use client';

import { useState, useEffect, type ReactElement } from 'react';
import { FileText, Search, Download, Eye, DollarSign } from 'lucide-react';
import { Glass, PageTitle, TN } from '@/components/ui/glass';
import { adminService, type PlatformInvoice } from '@/services/admin.service';

const ST: Record<string, { label: string; badge: string }> = {
  paid:      { label: 'مدفوعة', badge: 'nx-badge--green' },
  pending:   { label: 'معلّقة', badge: 'nx-badge--amber' },
  overdue:   { label: 'متأخرة', badge: 'nx-badge--red' },
  cancelled: { label: 'ملغاة', badge: 'nx-badge--violet' },
};

export default function InvoicesPage(): ReactElement {
  const [invoices, setInvoices] = useState<PlatformInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    adminService.getInvoices(params.toString())
      .then(res => { setInvoices(res.data ?? []); setTotal(res.meta?.total ?? 0); })
      .catch((e) => { console.error('Invoices fetch error:', e); setInvoices([]); })
      .finally(() => setLoading(false));
  }, [search]);

  const totalPaid = invoices.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + (i.amount ?? 0), 0);

  return (
    <div className="nx-space-y">
      <PageTitle title="الفواتير والمدفوعات" desc={loading ? 'جاري التحميل...' : `${total} فاتورة`}
        icon={<FileText size={20} style={{ color: '#34D399' }} strokeWidth={1.5} />}
      >
        {totalPaid > 0 && (
          <span className="nx-badge nx-badge--gold" style={{ fontSize: 13, padding: '8px 14px' }}>
            <DollarSign size={14} />{totalPaid.toLocaleString()} ر.س محصّلة
          </span>
        )}
      </PageTitle>

      <Glass>
        <div style={{ padding: 14 }}>
          <div className="nx-input-icon" style={{ maxWidth: 320 }}>
            <Search size={16} />
            <input className="nx-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث برقم الفاتورة أو الصالون..." />
          </div>
        </div>
      </Glass>

      <Glass>
        {loading ? (
          <div className="nx-empty">
            <div style={{ width: 28, height: 28, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p className="nx-empty-desc" style={{ marginTop: 12 }}>جاري التحميل...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="nx-empty">
            <div className="nx-empty-icon"><FileText size={22} /></div>
            <p className="nx-empty-title">لا توجد فواتير</p>
          </div>
        ) : (
          <div className="nx-table-mobile-wrap">
            <table className="nx-table">
              <thead>
                <tr>
                  <th>رقم الفاتورة</th>
                  <th>الصالون</th>
                  <th>المبلغ</th>
                  <th>تاريخ الإصدار</th>
                  <th>الحالة</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: any) => {
                  const st = ST[inv.status] || ST.pending;
                  return (
                    <tr key={inv.id}>
                      <td data-label="رقم الفاتورة" style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#A78BFA' }}>
                        {inv.invoiceNumber || inv.id?.slice(0, 8)}
                      </td>
                      <td className="nx-td-primary">{inv.tenant?.nameAr || inv.tenantId?.slice(0, 8) || '—'}</td>
                      <td data-label="المبلغ" style={{ color: 'var(--gold)', fontWeight: 700, ...TN }}>
                        {(inv.amount ?? 0).toLocaleString()} <span style={{ fontSize: 10, color: 'var(--ghost)' }}>ر.س</span>
                      </td>
                      <td data-label="التاريخ" style={TN}>
                        {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }) : '—'}
                      </td>
                      <td data-label="الحالة"><span className={`nx-badge ${st.badge}`}><span className="nx-badge-dot" />{st.label}</span></td>
                      <td data-label="">
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="nx-btn" style={{ padding: 6, border: 'none', background: 'none' }}><Eye size={15} /></button>
                          <button className="nx-btn" style={{ padding: 6, border: 'none', background: 'none' }}><Download size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Glass>
    </div>
  );
}
