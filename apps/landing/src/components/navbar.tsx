'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, Sparkles, Zap } from 'lucide-react';

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000';
const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

const navLinks = [
  { label: 'المميزات',  href: '#features' },
  { label: 'كيف تبدأين', href: '#how-it-works' },
  { label: 'الأجهزة',   href: '#devices' },
  { label: 'الأسعار',   href: '#pricing' },
];

export default function Navbar(): React.ReactElement {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
          background: 'rgba(7,5,26,0.75)',
          backdropFilter: 'blur(24px) saturate(160%)',
          borderBottom: '1px solid rgba(168,85,247,0.12)',
          padding: '10px 0',
        } : {
          background: 'transparent',
          padding: '20px 0',
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6">

          {/* Logo */}
          <Link href="/" className="group flex items-center gap-2.5">
            <div
              className="relative flex h-9 w-9 items-center justify-center rounded-xl glow-sm transition-all duration-300 group-hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #9333ea, #6366f1)',
                boxShadow: '0 0 20px rgba(147,51,234,0.5)',
              }}
            >
              <Zap className="h-4 w-4 text-white" />
              {/* Corner chip */}
              <div
                className="absolute -top-0.5 -end-0.5 h-2 w-2 rounded-full"
                style={{ background: '#22d3ee', boxShadow: '0 0 6px #22d3ee' }}
              />
            </div>
            <span
              className="text-xl font-black tracking-tight text-white"
              style={{ textShadow: '0 0 20px rgba(168,85,247,0.4)' }}
            >
              SERVIX
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-0.5 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="relative rounded-lg px-3.5 py-2 text-sm font-medium text-white/55 transition-all duration-200 hover:text-white group"
              >
                <span className="relative z-10">{link.label}</span>
                <span
                  className="absolute inset-0 rounded-lg opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                  style={{ background: 'rgba(168,85,247,0.08)' }}
                />
              </a>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden items-center gap-3 md:flex">
            <Link
              href={`${DASHBOARD_URL}/login`}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors"
            >
              تسجيل الدخول
            </Link>
            <Link
              href={`${DASHBOARD_URL}/register`}
              className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white"
            >
              <Sparkles className="h-4 w-4" />
              جرّب مجاناً
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-white/70 hover:text-white transition-all md:hidden"
            style={{ border: '1px solid rgba(168,85,247,0.15)', background: 'rgba(168,85,247,0.06)' }}
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
              background: 'rgba(7,5,26,0.92)',
              backdropFilter: 'blur(30px)',
              borderBottom: '1px solid rgba(168,85,247,0.12)',
            }}
          >
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-4 py-3 text-base font-medium text-white/65 hover:text-white transition-all"
                  style={{ border: '1px solid transparent' }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(168,85,247,0.15)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-4 flex flex-col gap-2 border-t pt-4" style={{ borderColor: 'rgba(168,85,247,0.12)' }}>
                <Link
                  href={`${DASHBOARD_URL}/login`}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl py-3 text-center text-sm font-medium text-white/65 hover:text-white transition-colors"
                  style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  تسجيل الدخول
                </Link>
                <Link
                  href={`${DASHBOARD_URL}/register`}
                  onClick={() => setMenuOpen(false)}
                  className="btn-primary inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white"
                >
                  <Sparkles className="h-4 w-4" />
                  جرّب مجاناً ١٤ يوم
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
