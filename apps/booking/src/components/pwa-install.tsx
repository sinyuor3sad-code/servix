'use client';

import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * PWA Install Banner — shows a sleek install prompt for supported browsers.
 * Auto-hides if already installed or dismissed recently.
 */
export default function PWAInstall(): React.ReactElement | null {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if dismissed recently (24h cooldown)
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed && Date.now() - parseInt(dismissed) < 24 * 60 * 60 * 1000) {
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Delay showing the banner for better UX
      setTimeout(() => setShowBanner(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    setShowBanner(false);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    setShowBanner(false);
  }, []);

  if (isInstalled || !showBanner) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '1rem',
        right: '1rem',
        zIndex: 9999,
        maxWidth: '420px',
        margin: '0 auto',
        borderRadius: '1.25rem',
        background: 'linear-gradient(135deg, rgba(139,92,246,0.95), rgba(124,58,237,0.95))',
        backdropFilter: 'blur(20px)',
        padding: '1rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        boxShadow: '0 8px 32px rgba(139,92,246,0.3), 0 2px 8px rgba(0,0,0,0.2)',
        animation: 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        direction: 'rtl',
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '12px',
          background: 'rgba(255,255,255,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: '1.5rem',
        }}
      >
        📲
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>
          ثبّت التطبيق
        </p>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem', margin: '2px 0 0' }}>
          وصول أسرع — بدون متصفح
        </p>
      </div>

      {/* Install Button */}
      <button
        onClick={handleInstall}
        style={{
          padding: '0.5rem 1rem',
          borderRadius: '0.75rem',
          border: '2px solid rgba(255,255,255,0.3)',
          background: 'rgba(255,255,255,0.15)',
          color: '#fff',
          fontWeight: 700,
          fontSize: '0.78rem',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          transition: 'all 0.2s',
        }}
      >
        تثبيت
      </button>

      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.6)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1rem',
          flexShrink: 0,
          lineHeight: 1,
        }}
        aria-label="إغلاق"
      >
        ✕
      </button>

      {/* Animation keyframe */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
