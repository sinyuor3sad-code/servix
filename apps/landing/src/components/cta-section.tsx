'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { Sparkles, ArrowLeft, ShieldCheck, Clock, Headphones } from 'lucide-react';

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000';
const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export default function CTASection(): React.ReactElement {
  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      {/* Pulsing core glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 mx-auto h-[500px] w-[500px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(147,51,234,0.25) 0%, rgba(99,102,241,0.1) 40%, transparent 70%)',
          filter: 'blur(80px)',
          animation: 'float-orb-slow 12s ease-in-out infinite',
        }}
      />

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 36, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: EASE }}
          className="relative overflow-hidden rounded-3xl p-10 text-center sm:p-16"
          style={{
            background: 'linear-gradient(145deg, rgba(168,85,247,0.12) 0%, rgba(99,102,241,0.07) 50%, rgba(34,211,238,0.05) 100%)',
            border: '1px solid rgba(168,85,247,0.3)',
            backdropFilter: 'blur(30px)',
            boxShadow: '0 0 80px rgba(168,85,247,0.15), 0 40px 100px rgba(168,85,247,0.08)',
          }}
        >
          {/* Top edge neon line */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent 5%, rgba(168,85,247,0.7) 40%, rgba(34,211,238,0.5) 60%, transparent 95%)' }}
          />

          {/* Corner orbs */}
          <div aria-hidden className="absolute -top-16 -end-16 h-48 w-48 rounded-full opacity-50"
            style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.4) 0%, transparent 70%)', filter: 'blur(30px)' }} />
          <div aria-hidden className="absolute -bottom-16 -start-16 h-48 w-48 rounded-full opacity-35"
            style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.35) 0%, transparent 70%)', filter: 'blur(30px)' }} />

          <div aria-hidden className="dot-grid absolute inset-0 opacity-25" />
          <div aria-hidden className="scan-lines absolute inset-0 opacity-30" />

          {/* Content */}
          <div className="relative z-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5"
              style={{ border: '1px solid rgba(168,85,247,0.35)', background: 'rgba(168,85,247,0.12)' }}
            >
              <Sparkles className="h-4 w-4 text-violet-300" />
              <span className="text-sm font-bold text-violet-300">١٤ يوم مجاناً — بلا بطاقة</span>
            </motion.div>

            <h2 className="mt-2 text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              جاهزة لبدء رحلتك
              <br />
              <span className="neon-text">مع SERVIX؟</span>
            </h2>

            <p className="mx-auto mt-6 max-w-lg text-lg text-white/50">
              انضمي لمئات صاحبات الصالونات اللواتي حوّلن إدارة صالوناتهن بالكامل.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href={`${DASHBOARD_URL}/register`}
                className="btn-primary group inline-flex items-center gap-3 rounded-2xl px-9 py-4 text-lg font-bold text-white"
              >
                <Sparkles className="h-5 w-5" />
                ابدئي تجربتك المجانية
                <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
              </Link>
            </div>

            {/* Micro-trust row */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
              {[
                { icon: ShieldCheck, label: 'لا بطاقة ائتمان' },
                { icon: Clock,       label: 'إلغاء في أي وقت' },
                { icon: Headphones,  label: 'دعم عربي ٢٤/٧' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-sm text-white/35">
                  <Icon className="h-3.5 w-3.5 text-violet-400/60" />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
