'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShieldCheck, Clock, Sparkles, BarChart3,
  Calendar, CreditCard, Users, Star,
} from 'lucide-react';

/* ══════════════════════════════════════════════════════════════
   AUTH LAYOUT v3 — World-class Dark Luxury
   Visual extension of SERVIX landing page (servi-x.com)
   Landing URL is external (different subdomain).
   ══════════════════════════════════════════════════════════════ */

const LANDING_URL = 'https://servi-x.com';

const FEATURES = [
  { icon: Calendar,    title: 'إدارة المواعيد',   desc: 'نظام حجز ذكي مع تأكيد تلقائي عبر واتساب' },
  { icon: CreditCard,  title: 'فواتير ZATCA',      desc: 'فوترة إلكترونية متوافقة مع هيئة الزكاة' },
  { icon: BarChart3,   title: 'تقارير متقدمة',     desc: 'إيرادات، أداء الموظفات، تحليل الخدمات' },
  { icon: Users,       title: 'إدارة العملاء',     desc: 'نظام ولاء ونقاط ومتابعة تفصيلية' },
];

const STATS = [
  { value: '+١,٢٠٠', label: 'صالون نشط' },
  { value: '+٥٠ ألف', label: 'موعد شهرياً' },
  { value: '٩٨٪', label: 'رضا العملاء' },
];

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  const pathname = usePathname();
  const isRegister = pathname === '/register';

  return (
    <div
      className="relative flex min-h-screen overflow-hidden"
      style={{
        background: '#060606',
        fontFamily: "var(--font-cairo,'Cairo'),system-ui,sans-serif",
      }}
    >
      {/* ═══════════════════ BRAND PANEL (Desktop) ═══════════════════ */}
      <div className="relative hidden w-[55%] xl:w-[58%] lg:block">
        {/* ── Layered backgrounds ── */}
        <div className="absolute inset-0" style={{ background: '#070707' }} />
        {/* Main gold glow — center-bottom */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse 70% 45% at 50% 85%, rgba(200,169,126,0.08) 0%, transparent 55%)',
        }} />
        {/* Secondary glow — top-left */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse 50% 40% at 15% 20%, rgba(200,169,126,0.035) 0%, transparent 50%)',
        }} />
        {/* Noise texture overlay */}
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundSize: '150px 150px',
        }} />

        {/* ── Content ── */}
        <div className="relative z-10 flex h-full flex-col justify-between p-12 xl:p-16">
          {/* Top: Logo */}
          <a href={LANDING_URL} className="group inline-flex items-center gap-3.5">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-[14px] transition-transform duration-300 group-hover:scale-105"
              style={{
                background: 'linear-gradient(145deg, #D4B896, #A88D65)',
                boxShadow: '0 6px 20px rgba(200,169,126,0.25), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}
            >
              <span className="text-base font-black text-[#080808]">S</span>
            </div>
            <div>
              <div className="text-xl font-black tracking-tight" style={{ color: '#F0EDE8' }}>SERVIX</div>
              <div className="text-[11px] font-medium" style={{ color: '#807A72' }}>منصة إدارة صالونات التجميل</div>
            </div>
          </a>

          {/* Center: Hero */}
          <div className="max-w-[520px]">
            <h1 className="text-[3.5rem] xl:text-[4rem] font-black leading-[1.1] tracking-[-0.02em]" style={{ color: '#F0EDE8' }}>
              أدِري صالونك
              <br />
              <span style={{
                background: 'linear-gradient(135deg, #E8D5B5 0%, #D4B896 40%, #A88D65 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                باحترافية
              </span>
            </h1>

            <p className="mt-5 text-lg leading-[1.7]" style={{ color: '#9A948C' }}>
              منصة متكاملة تمنحك السيطرة الكاملة على صالونك — من المواعيد
              والعملاء إلى الفواتير والتقارير المتقدمة.
            </p>

            {/* Features grid 2×2 */}
            <div className="mt-10 grid grid-cols-2 gap-4">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="rounded-2xl p-4"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <div
                    className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{
                      background: 'rgba(200,169,126,0.08)',
                      border: '1px solid rgba(200,169,126,0.12)',
                    }}
                  >
                    <Icon className="h-4 w-4" style={{ color: '#D4B896' }} />
                  </div>
                  <div className="text-sm font-bold" style={{ color: '#E8E4DE' }}>{title}</div>
                  <div className="mt-1 text-xs leading-relaxed" style={{ color: '#6D675F' }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom: Stats + copyright */}
          <div>
            <div
              className="flex items-center justify-between rounded-2xl px-8 py-5"
              style={{
                background: 'rgba(255,255,255,0.015)',
                border: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              {STATS.map(({ value, label }, i) => (
                <div key={label} className="flex items-center gap-5">
                  <div className="text-center">
                    <div className="text-xl font-black" style={{ color: '#D4B896' }}>{value}</div>
                    <div className="mt-0.5 text-[11px] font-medium" style={{ color: '#6D675F' }}>{label}</div>
                  </div>
                  {i < STATS.length - 1 && (
                    <div className="h-8 w-px" style={{ background: 'rgba(255,255,255,0.05)' }} />
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between text-[11px]" style={{ color: '#4A4540' }}>
              <span>© {new Date().getFullYear()} SERVIX</span>
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} className="h-3 w-3 fill-current" style={{ color: 'rgba(200,169,126,0.3)' }} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Edge separator — golden fade line */}
        <div className="absolute inset-y-0 end-0 w-px" style={{
          background: 'linear-gradient(180deg, transparent 5%, rgba(200,169,126,0.15) 50%, transparent 95%)',
        }} />
      </div>

      {/* ═══════════════════ AUTH FORM AREA ═══════════════════ */}
      <div className="relative flex flex-1 flex-col">
        {/* Background glow for form side */}
        <div className="pointer-events-none absolute inset-0" style={{
          background: 'radial-gradient(ellipse 70% 50% at 50% 40%, rgba(200,169,126,0.025) 0%, transparent 55%)',
        }} />

        {/* Mobile header */}
        <div className="relative z-10 flex items-center justify-between px-6 py-5 lg:hidden">
          <a href={LANDING_URL} className="inline-flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: 'linear-gradient(145deg, #D4B896, #A88D65)' }}
            >
              <span className="text-xs font-black text-[#080808]">S</span>
            </div>
            <span className="text-lg font-black tracking-tight" style={{ color: '#F0EDE8' }}>SERVIX</span>
          </a>
        </div>

        {/* Centered form */}
        <div className={`relative z-10 flex flex-1 items-center justify-center px-6 sm:px-10 ${isRegister ? 'py-4' : 'py-8'}`}>
          <div className="w-full max-w-[460px]">
            {children}
          </div>
        </div>

        {/* Mobile footer */}
        <div className="relative z-10 px-6 py-4 text-center lg:hidden">
          <p className="text-[11px]" style={{ color: '#4A4540' }}>© {new Date().getFullYear()} SERVIX</p>
        </div>
      </div>

      {/* ═══════════════════ AUTH STYLES ═══════════════════ */}
      <style jsx global>{`
        /* ── Card ── */
        .auth-card {
          background: rgba(14, 14, 14, 0.9);
          backdrop-filter: blur(24px) saturate(130%);
          -webkit-backdrop-filter: blur(24px) saturate(130%);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 1.5rem;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.02),
            0 24px 80px rgba(0,0,0,0.6),
            0 8px 24px rgba(0,0,0,0.4),
            inset 0 1px 0 rgba(255,255,255,0.03);
        }

        /* ── Input ── */
        .auth-input {
          display: flex;
          width: 100%;
          height: 3.25rem;
          padding: 0 1rem;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 0.875rem;
          color: #F0EDE8;
          font-size: 0.9375rem;
          outline: none;
          transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .auth-input::placeholder {
          color: rgba(128,122,114,0.45);
        }
        .auth-input:hover {
          border-color: rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.035);
        }
        .auth-input:focus {
          border-color: rgba(212,184,150,0.45);
          background: rgba(255,255,255,0.04);
          box-shadow: 0 0 0 3px rgba(212,184,150,0.07), 0 0 24px rgba(212,184,150,0.04);
        }

        /* ── Label ── */
        .auth-label {
          display: block;
          margin-bottom: 0.5rem;
          color: #B0AAA2;
          font-size: 0.8125rem;
          font-weight: 600;
          letter-spacing: 0.01em;
        }

        /* ── Title ── */
        .auth-title {
          color: #F0EDE8;
          font-weight: 800;
          font-size: 1.625rem;
          letter-spacing: -0.015em;
        }

        /* ── Gold Button ── */
        .auth-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          width: 100%;
          height: 3.25rem;
          border: none;
          border-radius: 0.875rem;
          font-size: 0.9375rem;
          font-weight: 700;
          cursor: pointer;
          background: linear-gradient(145deg, #D4B896 0%, #B09060 100%);
          color: #080808;
          box-shadow: 0 6px 24px rgba(200,169,126,0.2), inset 0 1px 0 rgba(255,255,255,0.12);
          transition: all 0.35s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .auth-btn:hover:not(:disabled) {
          background: linear-gradient(145deg, #E8D5B5 0%, #D4B896 100%);
          box-shadow: 0 8px 36px rgba(200,169,126,0.3), inset 0 1px 0 rgba(255,255,255,0.15);
          transform: translateY(-1px);
        }
        .auth-btn:active:not(:disabled) { transform: translateY(0) scale(0.985); }
        .auth-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── Outline Button ── */
        .auth-btn-outline {
          display: flex; align-items: center; justify-content: center; gap: 0.5rem;
          width: 100%; height: 3.25rem; background: transparent;
          border: 1px solid rgba(255,255,255,0.07); border-radius: 0.875rem;
          color: #B0AAA2; font-size: 0.875rem; font-weight: 600;
          cursor: pointer; transition: all 0.25s ease;
        }
        .auth-btn-outline:hover {
          border-color: rgba(212,184,150,0.2); color: #D4B896; background: rgba(200,169,126,0.03);
        }

        /* ── Link ── */
        .auth-link { color: #D4B896; text-decoration: none; transition: color 0.2s ease; }
        .auth-link:hover { color: #E8D5B5; }

        /* ── Error ── */
        .auth-error { color: #f87171; font-size: 0.8125rem; margin-top: 0.375rem; }

        /* ── Divider ── */
        .auth-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.05) 50%, transparent 95%);
        }

        /* ── Spinner ── */
        .auth-spinner {
          display: inline-block; width: 1.125rem; height: 1.125rem;
          border: 2px solid rgba(8,8,8,0.3); border-top-color: #080808;
          border-radius: 50%; animation: auth-spin 0.6s linear infinite;
        }
        @keyframes auth-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
