'use client';

import { useState, useEffect } from 'react';

/**
 * iOS-specific "Add to Home Screen" guide.
 * iOS Safari doesn't fire beforeinstallprompt, so we show a manual guide.
 */
export default function IOSInstallGuide(): React.ReactElement | null {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only show on iOS Safari, not already in standalone
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;
    const isSafari = /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|Chrome/.test(navigator.userAgent);

    if (isIOS && !isStandalone && isSafari) {
      const dismissed = localStorage.getItem('ios-install-dismissed');
      if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return;
      setTimeout(() => setShow(true), 5000);
    }
  }, []);

  if (!show) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '1rem',
        right: '1rem',
        zIndex: 9998,
        maxWidth: '380px',
        margin: '0 auto',
        borderRadius: '1.25rem',
        background: 'rgba(20, 16, 40, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        padding: '1.25rem',
        direction: 'rtl',
        animation: 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
        <p style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>
          📲 أضف التطبيق للشاشة الرئيسية
        </p>
        <button
          onClick={() => {
            localStorage.setItem('ios-install-dismissed', Date.now().toString());
            setShow(false);
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            fontSize: '1.1rem',
            padding: '0',
            lineHeight: 1,
          }}
          aria-label="إغلاق"
        >
          ✕
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <Step num={1} text='اضغط على أيقونة المشاركة' icon="⬆️" subtext="(الأيقونة المربعة مع سهم للأعلى)" />
        <Step num={2} text='اختر "إضافة إلى الشاشة الرئيسية"' icon="➕" />
        <Step num={3} text='اضغط "إضافة"' icon="✅" />
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function Step({ num, text, icon, subtext }: { num: number; text: string; icon: string; subtext?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
      <span style={{
        width: '28px',
        height: '28px',
        borderRadius: '8px',
        background: 'rgba(139, 92, 246, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.85rem',
        flexShrink: 0,
      }}>
        {icon}
      </span>
      <div>
        <p style={{ color: '#fff', fontSize: '0.78rem', margin: 0, fontWeight: 600 }}>
          {num}. {text}
        </p>
        {subtext && (
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', margin: '1px 0 0' }}>{subtext}</p>
        )}
      </div>
    </div>
  );
}
