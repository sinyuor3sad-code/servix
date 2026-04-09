'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck, Clock, Sparkles, BarChart3, Calendar, Users } from 'lucide-react';

/* ══════════════════════════════════════════════════════════════
   AUTH LAYOUT — Premium Dark Luxury
   Designed as a direct visual extension of the SERVIX landing page.
   ══════════════════════════════════════════════════════════════ */

const FEATURES = [
  { icon: ShieldCheck, title: 'حماية كاملة', desc: 'بياناتك مشفّرة ومحمية بأعلى المعايير' },
  { icon: Clock,       title: 'تجربة مجانية', desc: '١٤ يوم كاملة — بلا بطاقة ائتمان' },
  { icon: Sparkles,    title: 'كل شيء مدمج', desc: 'مواعيد، فواتير ZATCA، واتساب، تقارير' },
];

const STATS = [
  { value: '+١,٢٠٠', label: 'صالون نشط' },
  { value: '+٥٠,٠٠٠', label: 'موعد شهرياً' },
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
      {/* ═══════════════════════════════════════════
          LEFT: BRAND PANEL — Desktop only
         ═══════════════════════════════════════════ */}
      <div className="relative hidden w-[50%] lg:flex lg:flex-col">
        {/* Layered background effects */}
        <div className="absolute inset-0" style={{ background: '#080808' }} />
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(200,169,126,0.07) 0%, transparent 60%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 60% 50% at 20% 30%, rgba(200,169,126,0.03) 0%, transparent 50%)',
          }}
        />

        {/* Decorative grid pattern - very subtle */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14">

          {/* Top: Logo */}
          <div>
            <Link href="/" className="group inline-flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, #D4B896, #A88D65)',
                  boxShadow: '0 4px 16px rgba(200,169,126,0.2)',
                }}
              >
                <span className="text-sm font-black text-[#080808]">S</span>
              </div>
              <div>
                <span className="text-xl font-black tracking-tight" style={{ color: '#F0EDE8' }}>
                  SERVIX
                </span>
                <span className="block text-[11px]" style={{ color: '#807A72' }}>
                  منصة إدارة صالونات التجميل
                </span>
              </div>
            </Link>
          </div>

          {/* Center: Hero content */}
          <div className="max-w-lg">
            <h1
              className="text-5xl font-black leading-[1.15] tracking-tight xl:text-[3.5rem]"
              style={{ color: '#F0EDE8' }}
            >
              أدِري صالونك
              <br />
              <span
                style={{
                  background: 'linear-gradient(135deg, #E8D5B5, #D4B896, #A88D65)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                باحترافية
              </span>
            </h1>

            <p
              className="mt-6 text-lg leading-relaxed"
              style={{ color: '#B0AAA2' }}
            >
              منصة متكاملة تمنحك السيطرة الكاملة على صالونك — من المواعيد والعملاء إلى الفواتير والتقارير.
            </p>

            {/* Feature list */}
            <div className="mt-10 space-y-5">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-4">
                  <div
                    className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background: 'rgba(200,169,126,0.07)',
                      border: '1px solid rgba(200,169,126,0.12)',
                    }}
                  >
                    <Icon className="h-[18px] w-[18px]" style={{ color: '#D4B896' }} />
                  </div>
                  <div>
                    <div className="text-[15px] font-bold" style={{ color: '#F0EDE8' }}>
                      {title}
                    </div>
                    <div className="mt-0.5 text-sm" style={{ color: '#807A72' }}>
                      {desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom: Stats bar + copyright */}
          <div>
            {/* Stats */}
            <div
              className="mb-8 flex items-center gap-8 rounded-2xl px-6 py-5"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {STATS.map(({ value, label }, i) => (
                <div key={label} className="flex items-center gap-4">
                  <div>
                    <div className="text-2xl font-black" style={{ color: '#D4B896' }}>{value}</div>
                    <div className="text-xs" style={{ color: '#807A72' }}>{label}</div>
                  </div>
                  {i < STATS.length - 1 && (
                    <div className="ms-4 h-8 w-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                  )}
                </div>
              ))}
            </div>

            <p className="text-xs" style={{ color: 'rgba(128,122,114,0.6)' }}>
              © {new Date().getFullYear()} SERVIX. جميع الحقوق محفوظة.
            </p>
          </div>
        </div>

        {/* Right edge separator */}
        <div
          className="absolute inset-y-0 end-0 w-px"
          style={{ background: 'linear-gradient(180deg, transparent 10%, rgba(200,169,126,0.12) 50%, transparent 90%)' }}
        />
      </div>

      {/* ═══════════════════════════════════════════
          RIGHT: AUTH FORM AREA
         ═══════════════════════════════════════════ */}
      <div className="relative flex flex-1 flex-col">
        {/* Subtle background glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 60% 40% at 50% 30%, rgba(200,169,126,0.03) 0%, transparent 60%)',
          }}
        />

        {/* Mobile header */}
        <div className="relative z-10 flex items-center justify-between p-5 lg:hidden">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{
                background: 'linear-gradient(135deg, #D4B896, #A88D65)',
              }}
            >
              <span className="text-xs font-black text-[#080808]">S</span>
            </div>
            <span className="text-lg font-black tracking-tight" style={{ color: '#F0EDE8' }}>
              SERVIX
            </span>
          </Link>
        </div>

        {/* Center form */}
        <div className={`relative z-10 flex flex-1 items-center justify-center px-5 sm:px-8 ${isRegister ? 'py-6' : 'py-10'}`}>
          <div className="w-full max-w-[440px]">
            {children}
          </div>
        </div>

        {/* Mobile footer */}
        <div className="relative z-10 p-5 text-center lg:hidden">
          <p className="text-xs" style={{ color: 'rgba(128,122,114,0.5)' }}>
            © {new Date().getFullYear()} SERVIX. جميع الحقوق محفوظة.
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          GLOBAL AUTH STYLES
         ═══════════════════════════════════════════ */}
      <style jsx global>{`
        /* ── Auth Card ── */
        .auth-card {
          background: rgba(17, 17, 17, 0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 1.25rem;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.03),
            0 20px 60px rgba(0,0,0,0.5),
            0 8px 20px rgba(0,0,0,0.4);
        }

        /* ── Input ── */
        .auth-input {
          display: flex;
          width: 100%;
          height: 3rem;
          padding: 0 0.875rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 0.75rem;
          color: #F0EDE8;
          font-size: 0.9375rem;
          outline: none;
          transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .auth-input::placeholder {
          color: rgba(128,122,114,0.5);
        }
        .auth-input:hover {
          border-color: rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
        }
        .auth-input:focus {
          border-color: rgba(212,184,150,0.5);
          background: rgba(255,255,255,0.04);
          box-shadow: 0 0 0 3px rgba(212,184,150,0.06);
        }

        /* ── Label ── */
        .auth-label {
          display: block;
          margin-bottom: 0.5rem;
          color: #B0AAA2;
          font-size: 0.8125rem;
          font-weight: 600;
        }

        /* ── Title ── */
        .auth-title {
          color: #F0EDE8;
          font-weight: 800;
          font-size: 1.5rem;
          letter-spacing: -0.01em;
        }

        /* ── Gold CTA Button ── */
        .auth-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          width: 100%;
          height: 3rem;
          border: none;
          border-radius: 0.75rem;
          font-size: 0.9375rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
          background: linear-gradient(135deg, #D4B896 0%, #B8975D 100%);
          color: #080808;
          box-shadow: 0 4px 20px rgba(200,169,126,0.18);
        }
        .auth-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #E8D5B5 0%, #D4B896 100%);
          box-shadow: 0 8px 32px rgba(200,169,126,0.28);
          transform: translateY(-1px);
        }
        .auth-btn:active:not(:disabled) {
          transform: translateY(0) scale(0.98);
        }
        .auth-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* ── Outline Button ── */
        .auth-btn-outline {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          width: 100%;
          height: 3rem;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 0.75rem;
          color: #B0AAA2;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s ease;
        }
        .auth-btn-outline:hover {
          border-color: rgba(212,184,150,0.25);
          color: #D4B896;
          background: rgba(200,169,126,0.04);
        }

        /* ── Link ── */
        .auth-link {
          color: #D4B896;
          text-decoration: none;
          transition: color 0.2s ease;
        }
        .auth-link:hover {
          color: #E8D5B5;
        }

        /* ── Error ── */
        .auth-error {
          color: #f87171;
          font-size: 0.8125rem;
          margin-top: 0.375rem;
        }

        /* ── Divider ── */
        .auth-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
        }

        /* ── Muted text ── */
        .auth-muted { color: #807A72; }

        /* ── Spinner ── */
        .auth-spinner {
          display: inline-block;
          width: 1rem;
          height: 1rem;
          border: 2px solid #080808;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
