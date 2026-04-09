'use client';

import Link from 'next/link';
import { ShieldCheck, Clock, Sparkles } from 'lucide-react';

/* ══════════════════════════════════════════════════════════════
   AUTH LAYOUT — Architectural Luxury (aligned with Landing Page)
   
   Colors & tokens from landing globals.css:
   --bg:        #080808   --fg:            #F0EDE8
   --bg-surface:#111111   --fg-secondary:  #B0AAA2
   --gold:      #D4B896   --gold-light:    #E8D5B5
   --border:    rgba(255,255,255,0.08)
   ══════════════════════════════════════════════════════════════ */

const FEATURES = [
  { icon: ShieldCheck, text: 'بياناتك محمية ومشفّرة بالكامل' },
  { icon: Clock,       text: '١٤ يوم تجربة مجانية — بلا بطاقة' },
  { icon: Sparkles,    text: 'مواعيد، فواتير ZATCA، واتساب، تقارير' },
];

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  return (
    <div
      className="relative flex min-h-screen"
      style={{ background: '#080808', fontFamily: "var(--font-cairo,'Cairo'),system-ui,sans-serif" }}
    >
      {/* ─── Subtle background glow (matches landing hero) ─── */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 50% 40% at 50% 20%, rgba(200,169,126,0.04) 0%, transparent 70%)',
        }}
      />

      {/* ═══════════════════════════════════════════
          DESKTOP BRAND PANEL — left side
         ═══════════════════════════════════════════ */}
      <div
        className="relative hidden w-[44%] flex-col justify-between overflow-hidden p-12 lg:flex"
        style={{
          borderInlineEnd: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Gold radial accent */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 30% 70%, rgba(200,169,126,0.06) 0%, transparent 70%)',
          }}
        />

        {/* Top — Logo */}
        <div className="relative z-10">
          <Link href="/" className="inline-block">
            <span
              className="text-2xl font-black tracking-tight"
              style={{ color: '#F0EDE8' }}
            >
              SERVIX
            </span>
          </Link>
          <p
            className="mt-2 text-sm"
            style={{ color: '#B0AAA2' }}
          >
            منصة إدارة صالونات التجميل
          </p>
        </div>

        {/* Center — Hero text */}
        <div className="relative z-10 max-w-md">
          <h2
            className="text-4xl font-black leading-tight tracking-tight"
            style={{ color: '#F0EDE8' }}
          >
            أدِري صالونك
            <br />
            <span style={{ color: '#D4B896' }}>بذكاء</span>
          </h2>
          <p
            className="mt-5 text-base leading-relaxed"
            style={{ color: '#B0AAA2' }}
          >
            مواعيد ذكية، فواتير ZATCA، واتساب مخصص، وتقارير متقدمة — كل شيء في منصة واحدة.
          </p>

          {/* Trust features */}
          <div className="mt-10 space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: 'rgba(200,169,126,0.08)',
                    border: '1px solid rgba(200,169,126,0.15)',
                  }}
                >
                  <Icon className="h-4 w-4" style={{ color: '#D4B896' }} />
                </div>
                <span className="text-sm" style={{ color: '#B0AAA2' }}>
                  {text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom — Copyright */}
        <p
          className="relative z-10 text-sm"
          style={{ color: 'rgba(176,170,162,0.5)' }}
        >
          © {new Date().getFullYear()} SERVIX. جميع الحقوق محفوظة.
        </p>
      </div>

      {/* ═══════════════════════════════════════════
          AUTH FORM AREA — right side (or full mobile)
         ═══════════════════════════════════════════ */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-5 py-10 sm:px-8">
        {/* Mobile branding (hidden on desktop) */}
        <div className="mb-10 text-center lg:hidden">
          <Link href="/" className="inline-block">
            <span
              className="text-2xl font-black tracking-tight"
              style={{ color: '#F0EDE8' }}
            >
              SERVIX
            </span>
          </Link>
          <p
            className="mt-1.5 text-sm"
            style={{ color: '#B0AAA2' }}
          >
            منصة إدارة صالونات التجميل
          </p>
        </div>

        {/* Auth card container */}
        <div className="w-full max-w-md">
          {children}
        </div>

        {/* Mobile copyright */}
        <p
          className="mt-10 text-sm lg:hidden"
          style={{ color: 'rgba(176,170,162,0.4)' }}
        >
          © {new Date().getFullYear()} SERVIX
        </p>
      </div>

      {/* ─── Auth CSS overrides ─── */}
      <style jsx global>{`
        /* ═══ Force dark premium for auth pages ═══ */

        /* Card — dark glass surface */
        [class*="(auth)"] .card,
        .auth-card-override {
          --card: #111111;
          --card-foreground: #F0EDE8;
          --border: rgba(255,255,255,0.08);
        }

        /* Override all auth-area variables */
        .auth-card-luxury {
          background: #111111;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 1rem;
          box-shadow: 0 20px 60px rgba(0,0,0,0.4), 0 8px 20px rgba(0,0,0,0.3);
        }

        /* Inputs inside auth */
        .auth-input {
          background: #0C0C0C !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          color: #F0EDE8 !important;
          border-radius: 0.75rem !important;
          height: 2.875rem !important;
          font-size: 0.9375rem !important;
          transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1) !important;
        }
        .auth-input::placeholder {
          color: rgba(176,170,162,0.4) !important;
        }
        .auth-input:focus {
          border-color: rgba(212,184,150,0.4) !important;
          box-shadow: 0 0 0 3px rgba(212,184,150,0.08), 0 0 20px rgba(212,184,150,0.06) !important;
          outline: none !important;
        }
        .auth-input:hover:not(:focus) {
          border-color: rgba(255,255,255,0.12) !important;
        }

        /* Labels inside auth */
        .auth-label {
          color: #B0AAA2 !important;
          font-size: 0.875rem !important;
          font-weight: 500 !important;
        }

        /* Gold CTA button */
        .auth-btn-gold {
          background: linear-gradient(135deg, #D4B896 0%, #A88D65 100%) !important;
          color: #080808 !important;
          font-weight: 700 !important;
          border: none !important;
          border-radius: 0.75rem !important;
          height: 2.875rem !important;
          font-size: 0.9375rem !important;
          transition: all 0.35s cubic-bezier(0.22, 1, 0.36, 1) !important;
          box-shadow: 0 4px 16px rgba(200,169,126,0.15) !important;
        }
        .auth-btn-gold:hover:not(:disabled) {
          background: linear-gradient(135deg, #E8D5B5 0%, #D4B896 100%) !important;
          box-shadow: 0 8px 32px rgba(200,169,126,0.25) !important;
          transform: translateY(-1px) !important;
        }
        .auth-btn-gold:active:not(:disabled) {
          transform: translateY(0) scale(0.98) !important;
        }
        .auth-btn-gold:disabled {
          opacity: 0.6 !important;
        }

        /* Error messages */
        .auth-error {
          color: #f87171 !important;
          font-size: 0.8125rem !important;
        }

        /* Links */
        .auth-link {
          color: #D4B896 !important;
          text-decoration: none !important;
          transition: color 0.2s ease !important;
        }
        .auth-link:hover {
          color: #E8D5B5 !important;
        }

        /* Muted text */
        .auth-muted {
          color: #807A72 !important;
        }

        /* Title text */
        .auth-title {
          color: #F0EDE8 !important;
          font-weight: 800 !important;
          font-size: 1.375rem !important;
        }

        /* Divider */
        .auth-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
        }
      `}</style>
    </div>
  );
}
