'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, Globe, ArrowLeft } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000';
const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export default function Navbar(): React.ReactElement {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { locale, toggle, t } = useI18n();

  const navLinks = [
    { label: t('nav.capabilities'), href: '#capabilities' },
    { label: t('nav.howItWorks'),    href: '#how-it-works' },
    { label: t('nav.pricing'),       href: '#pricing' },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="fixed inset-x-0 top-0 z-50 transition-all duration-500"
        style={scrolled ? {
          background: 'rgba(8,8,8,0.85)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border)',
          padding: '12px 0',
        } : {
          background: 'transparent',
          padding: '20px 0',
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 sm:px-8">

          {/* Logo */}
          <Link href="/" className="group flex items-center gap-2">
            <span className="text-xl font-black tracking-tight" style={{ color: 'var(--fg)' }}>
              SERVIX
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200"
                style={{ color: 'var(--fg-secondary)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--fg)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--fg-secondary)'}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden items-center gap-4 md:flex">
            <button
              onClick={toggle}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              style={{ color: 'var(--fg-muted)' }}
              aria-label={locale === 'ar' ? 'Switch to English' : 'التبديل للعربية'}
            >
              <Globe className="h-4 w-4" />
              <span>{locale === 'ar' ? 'EN' : 'عربي'}</span>
            </button>

            <Link
              href={`${DASHBOARD_URL}/login`}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              style={{ color: 'var(--fg-secondary)' }}
            >
              {t('nav.login')}
            </Link>

            <Link
              href={`${DASHBOARD_URL}/register`}
              className="btn-gold rounded-xl px-6 py-2.5 text-sm"
            >
              {t('nav.cta')}
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-xl transition-all md:hidden"
            style={{ border: '1px solid var(--border)', color: 'var(--fg-secondary)' }}
            aria-label="القائمة"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </motion.header>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-x-0 top-[60px] z-40 px-4 pb-6 pt-4 md:hidden"
            style={{
              background: 'rgba(8,8,8,0.95)',
              backdropFilter: 'blur(24px)',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-4 py-3 text-base font-medium transition-colors"
                  style={{ color: 'var(--fg-secondary)' }}
                >
                  {link.label}
                </a>
              ))}

              <button
                onClick={() => { toggle(); setMenuOpen(false); }}
                className="flex items-center gap-2 rounded-xl px-4 py-3 text-base font-medium transition-all"
                style={{ color: 'var(--fg-secondary)' }}
              >
                <Globe className="h-4 w-4" />
                {locale === 'ar' ? 'English' : 'العربية'}
              </button>

              <div className="mt-4 flex flex-col gap-2 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                <Link
                  href={`${DASHBOARD_URL}/login`}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl py-3 text-center text-sm font-medium transition-colors"
                  style={{ border: '1px solid var(--border)', color: 'var(--fg-secondary)' }}
                >
                  {t('nav.login')}
                </Link>
                <Link
                  href={`${DASHBOARD_URL}/register`}
                  onClick={() => setMenuOpen(false)}
                  className="btn-gold justify-center rounded-xl py-3 text-sm"
                >
                  {t('nav.ctaMobile')}
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
