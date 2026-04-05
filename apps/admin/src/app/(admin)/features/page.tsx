'use client';

import { type ReactElement } from 'react';
import { ToggleRight, Shield, Sparkles, Crown, Check, X } from 'lucide-react';
import { Glass, PageTitle } from '@/components/ui/glass';

const FEATURES = [
  { name: 'إدارة الخدمات', basic: true, pro: true, enterprise: true },
  { name: 'إدارة العملاء', basic: true, pro: true, enterprise: true },
  { name: 'المواعيد والحجوزات', basic: true, pro: true, enterprise: true },
  { name: 'نقاط البيع (POS)', basic: true, pro: true, enterprise: true },
  { name: 'صفحة الحجز الإلكتروني', basic: false, pro: true, enterprise: true },
  { name: 'التقارير المتقدمة', basic: false, pro: true, enterprise: true },
  { name: 'الصلاحيات التفصيلية', basic: false, pro: true, enterprise: true },
  { name: 'الكوبونات', basic: false, pro: false, enterprise: true },
  { name: 'نظام الولاء', basic: false, pro: false, enterprise: true },
  { name: 'واتساب بزنس', basic: false, pro: false, enterprise: true },
  { name: 'فوترة ZATCA', basic: false, pro: true, enterprise: true },
  { name: 'متعدد الفروع', basic: false, pro: false, enterprise: true },
];

function Chk({ on }: { on: boolean }) {
  return on
    ? <span style={{ width: 24, height: 24, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(52,211,153,0.1)' }}>
        <Check size={14} style={{ color: '#34D399' }} strokeWidth={2.5} />
      </span>
    : <span style={{ width: 24, height: 24, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)' }}>
        <X size={14} style={{ color: 'var(--ghost)', opacity: 0.4 }} />
      </span>;
}

export default function FeaturesPage(): ReactElement {
  return (
    <div className="nx-space-y">
      <PageTitle title="إدارة الميزات" desc="مصفوفة الميزات حسب كل باقة"
        icon={<ToggleRight size={20} style={{ color: '#A78BFA' }} strokeWidth={1.5} />}
      />

      <Glass>
        <div className="nx-table-mobile-wrap"><table className="nx-table">
          <thead>
            <tr>
              <th style={{ width: '40%' }}>الميزة</th>
              <th style={{ textAlign: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Shield size={12} style={{ color: 'var(--muted)' }} />Basic
                </span>
              </th>
              <th style={{ textAlign: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Sparkles size={12} style={{ color: '#A78BFA' }} />Pro
                </span>
              </th>
              <th style={{ textAlign: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Crown size={12} style={{ color: '#C9A84C' }} />Enterprise
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((f) => (
              <tr key={f.name}>
                <td className="nx-td-primary" style={{ fontWeight: 500 }}>{f.name}</td>
                <td style={{ textAlign: 'center' }}><div style={{ display: 'flex', justifyContent: 'center' }}><Chk on={f.basic} /></div></td>
                <td style={{ textAlign: 'center' }}><div style={{ display: 'flex', justifyContent: 'center' }}><Chk on={f.pro} /></div></td>
                <td style={{ textAlign: 'center' }}><div style={{ display: 'flex', justifyContent: 'center' }}><Chk on={f.enterprise} /></div></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Glass>
    </div>
  );
}
