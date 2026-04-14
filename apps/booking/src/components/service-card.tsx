/**
 * ServiceCard — 5 Premium Layout Variants
 * Each layout has a unique visual identity inspired by real salon apps.
 */
import Link from 'next/link';
import { Timer, ArrowLeft, Sparkles } from 'lucide-react';
import type { BookingService } from '@/lib/api';

interface ServiceCardProps {
  service: BookingService;
  slug: string;
  featured?: boolean;
  layout: 'luxe' | 'bloom' | 'glamour' | 'golden' | 'banan';
  index?: number;
}

/** Circular image or initial fallback */
function ServiceImage({ service, size = 80, className = '' }: { service: BookingService; size?: number; className?: string }) {
  return service.imageUrl ? (
    <img
      src={service.imageUrl}
      alt={service.nameAr}
      className={`rounded-full object-cover ${className}`}
      style={{ width: size, height: size }}
      loading="lazy"
    />
  ) : (
    <div
      className={`rounded-full flex items-center justify-center font-heading font-black ${className}`}
      style={{
        width: size,
        height: size,
        background: 'var(--hero-gradient)',
        color: 'var(--color-primary-fg)',
        fontSize: size * 0.35,
      }}
    >
      {service.nameAr.charAt(0)}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. LUXE ROSE — Square cards with centered circular images (2×2 grid)
   ═══════════════════════════════════════════════════════════════════════════ */
function LuxeCard({ service, slug, featured, index = 0 }: Omit<ServiceCardProps, 'layout'>) {
  return (
    <article
      className="svc-luxe group animate-fade-up text-center"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {featured && (
        <span className="svc-luxe__badge">
          <Sparkles className="h-3 w-3" /> مميّزة
        </span>
      )}

      {/* Circular image */}
      <div className="mx-auto mb-4 relative">
        <div className="svc-luxe__ring" />
        <ServiceImage service={service} size={100} className="relative z-10 shadow-lg" />
      </div>

      {/* Info */}
      <h3 className="font-heading text-sm font-bold leading-tight mb-1"
          style={{ color: 'var(--color-text)' }}>
        {service.nameAr}
      </h3>

      {service.descriptionAr && (
        <p className="text-[11px] leading-relaxed line-clamp-2 mb-2 px-2"
           style={{ color: 'var(--color-text-muted)' }}>
          {service.descriptionAr}
        </p>
      )}

      <div className="flex items-center justify-center gap-2 text-xs mb-3"
           style={{ color: 'var(--color-text-muted)' }}>
        <Timer className="h-3 w-3" />
        <span>{service.duration} دقيقة</span>
      </div>

      <div className="font-heading text-xl font-black mb-3"
           style={{ color: 'var(--color-primary)' }}>
        {service.price.toLocaleString('ar-SA')}
        <span className="text-[10px] font-medium opacity-60 ms-1">ر.س</span>
      </div>

      <Link
        href={`/${slug}/book?service=${service.id}`}
        className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl active:scale-95 transition-all"
      >
        احجزي الآن
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
      </Link>
    </article>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. BLOOM — Horizontal cards with side circular image
   ═══════════════════════════════════════════════════════════════════════════ */
function BloomCard({ service, slug, featured, index = 0 }: Omit<ServiceCardProps, 'layout'>) {
  return (
    <article
      className="svc-bloom group flex items-center gap-4 animate-fade-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Circular image */}
      <div className="shrink-0 relative">
        <ServiceImage service={service} size={72} className="shadow-md group-hover:scale-105 transition-transform duration-300" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-heading text-sm font-bold truncate"
            style={{ color: 'var(--color-text)' }}>
          {service.nameAr}
        </h3>
        {service.descriptionAr && (
          <p className="text-[11px] line-clamp-1 mt-0.5"
             style={{ color: 'var(--color-text-muted)' }}>
            {service.descriptionAr}
          </p>
        )}
        <div className="mt-1.5 font-heading text-base font-black"
             style={{ color: 'var(--color-primary)' }}>
          {service.price.toLocaleString('ar-SA')}
          <span className="text-[10px] font-medium opacity-50 ms-1">ر.س</span>
          <span className="text-[10px] ms-2 font-normal" style={{ color: 'var(--color-text-muted)' }}>
            • {service.duration} دقيقة
          </span>
        </div>
      </div>

      {/* CTA */}
      <Link
        href={`/${slug}/book?service=${service.id}`}
        className="shrink-0 flex items-center gap-1.5 rounded-xl px-4 py-2 text-[11px] font-bold transition-all active:scale-95"
        style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}
      >
        احجزي الآن
      </Link>
    </article>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. GLAMOUR — 2-column grid with large centered circles
   ═══════════════════════════════════════════════════════════════════════════ */
function GlamourCard({ service, slug, featured, index = 0 }: Omit<ServiceCardProps, 'layout'>) {
  return (
    <article
      className="svc-glamour group text-center animate-fade-up"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Large circular image */}
      <div className="mx-auto mb-3">
        <ServiceImage service={service} size={120} className="shadow-lg group-hover:scale-105 transition-transform duration-500" />
      </div>

      <h3 className="font-heading text-sm font-bold mb-1"
          style={{ color: 'var(--color-text)' }}>
        {service.nameAr}
      </h3>

      {service.descriptionAr && (
        <p className="text-[10px] leading-relaxed line-clamp-2 mb-2 px-1"
           style={{ color: 'var(--color-text-muted)' }}>
          {service.descriptionAr}
        </p>
      )}

      <div className="flex items-center justify-center gap-3 mb-3">
        <span className="font-heading text-lg font-black"
              style={{ color: 'var(--color-primary)' }}>
          {service.price.toLocaleString('ar-SA')} ر.س
        </span>
      </div>

      <Link
        href={`/${slug}/book?service=${service.id}`}
        className="btn-primary inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-full active:scale-95 transition-all"
      >
        احجزي الآن
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
      </Link>
    </article>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. GOLDEN GLOW — Dark luxury with gold accents, horizontal cards
   ═══════════════════════════════════════════════════════════════════════════ */
function GoldenCard({ service, slug, featured, index = 0 }: Omit<ServiceCardProps, 'layout'>) {
  return (
    <article
      className="svc-golden group flex items-center gap-4 animate-fade-up"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      {/* Rectangular image or gold initial */}
      <div className="shrink-0 overflow-hidden rounded-xl">
        {service.imageUrl ? (
          <img
            src={service.imageUrl}
            alt={service.nameAr}
            className="w-20 h-20 object-cover group-hover:scale-110 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-20 h-20 flex items-center justify-center text-2xl font-black"
               style={{ background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)', color: '#D4AF37' }}>
            {service.nameAr.charAt(0)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        {featured && (
          <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[9px] font-bold mb-1"
                style={{ background: '#D4AF37', color: '#000' }}>
            ⭐ 24K
          </span>
        )}
        <h3 className="font-heading text-sm font-bold truncate" style={{ color: '#f5f5f5' }}>
          {service.nameAr}
        </h3>
        <div className="mt-1 font-heading text-base font-black" style={{ color: '#D4AF37' }}>
          {service.price.toLocaleString('ar-SA')}
          <span className="text-[10px] font-medium opacity-60 ms-1">SAR</span>
        </div>
      </div>

      {/* CTA */}
      <Link
        href={`/${slug}/book?service=${service.id}`}
        className="shrink-0 flex items-center gap-1 rounded-lg px-4 py-2 text-[11px] font-bold transition-all active:scale-95"
        style={{ background: '#D4AF37', color: '#000' }}
      >
        BOOK NOW
      </Link>
    </article>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. BANAN — Centered large circles with natural/organic feel
   ═══════════════════════════════════════════════════════════════════════════ */
function BananCard({ service, slug, featured, index = 0 }: Omit<ServiceCardProps, 'layout'>) {
  return (
    <article
      className="svc-banan group text-center animate-fade-up"
      style={{ animationDelay: `${index * 90}ms` }}
    >
      {/* Large circle with decorative border */}
      <div className="mx-auto mb-4 relative">
        <div className="svc-banan__ring" />
        <ServiceImage service={service} size={110} className="relative z-10" />
      </div>

      <h3 className="font-heading text-base font-bold mb-1"
          style={{ color: 'var(--color-text)' }}>
        {service.nameAr}
      </h3>

      {service.descriptionAr && (
        <p className="text-[11px] leading-relaxed line-clamp-2 mb-2"
           style={{ color: 'var(--color-text-muted)' }}>
          {service.descriptionAr}
        </p>
      )}

      <div className="font-heading text-lg font-black mb-3"
           style={{ color: 'var(--color-primary)' }}>
        {service.price.toLocaleString('ar-SA')}
        <span className="text-[10px] font-medium opacity-50 ms-1">SAR</span>
      </div>

      <Link
        href={`/${slug}/book?service=${service.id}`}
        className="svc-banan__btn inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold rounded-full active:scale-95 transition-all"
      >
        Book Now | احجزي الآن
      </Link>
    </article>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Export — dispatches to correct variant
   ═══════════════════════════════════════════════════════════════════════════ */
export default function ServiceCard(props: ServiceCardProps) {
  switch (props.layout) {
    case 'luxe':    return <LuxeCard    {...props} />;
    case 'bloom':   return <BloomCard   {...props} />;
    case 'glamour': return <GlamourCard {...props} />;
    case 'golden':  return <GoldenCard  {...props} />;
    case 'banan':   return <BananCard   {...props} />;
    default:        return <BloomCard   {...props} />;
  }
}
