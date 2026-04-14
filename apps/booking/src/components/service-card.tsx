/**
 * ServiceCard — 4 Premium Layout Variants
 * Each layout has its own unique visual identity.
 * Layout is determined by the `data-layout` attribute on #salon-root.
 */
import Link from 'next/link';
import { Timer, ArrowLeft, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BookingService } from '@/lib/api';

interface ServiceCardProps {
  service: BookingService;
  slug: string;
  featured?: boolean;
  layout: 'classic' | 'cards' | 'compact' | 'elegant';
  index?: number;
}

/* ─── VIP / Luxury (elegant) ────────────────────────────────────────────── */
function ElegantCard({ service, slug, featured, index = 0 }: Omit<ServiceCardProps, 'layout'>) {
  return (
    <article
      className="svc-elegant group relative overflow-hidden rounded-2xl animate-fade-up"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Glass background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[rgba(255,255,255,0.06)] to-[rgba(255,255,255,0.02)]" />
      
      {/* Shimmer on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-[linear-gradient(105deg,transparent_35%,rgba(255,255,255,0.08)_45%,transparent_55%)]" />

      {featured && (
        <div className="absolute top-3 start-3 z-10">
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
            style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}>
            <Sparkles className="h-3 w-3" />
            مميّزة
          </span>
        </div>
      )}

      <div className="relative z-10 p-5 sm:p-6">
        {/* Name */}
        <h3 className="font-heading text-lg sm:text-xl font-bold leading-tight"
            style={{ color: 'var(--color-text)' }}>
          {service.nameAr}
        </h3>

        {service.descriptionAr && (
          <p className="mt-2 text-sm leading-relaxed line-clamp-2 opacity-60"
             style={{ color: 'var(--color-text)' }}>
            {service.descriptionAr}
          </p>
        )}

        {/* Divider */}
        <div className="my-4 h-px w-12 rounded-full"
             style={{ background: 'var(--color-primary)', opacity: 0.3 }} />

        {/* Footer */}
        <div className="flex items-end justify-between">
          <div>
            <span className="font-heading text-3xl font-black"
                  style={{ color: 'var(--color-primary)' }}>
              {service.price.toLocaleString('ar-SA')}
            </span>
            <span className="ms-1 text-xs font-medium opacity-50"
                  style={{ color: 'var(--color-text)' }}>
              ر.س
            </span>
            <div className="flex items-center gap-1.5 mt-1 text-xs opacity-50"
                 style={{ color: 'var(--color-text)' }}>
              <Timer className="h-3 w-3" />
              {service.duration} دقيقة
            </div>
          </div>

          <Link
            href={`/${slug}/book?service=${service.id}`}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl active:scale-95 transition-all"
          >
            احجز
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </div>
      </div>
    </article>
  );
}

/* ─── Magazine (cards) ───────────────────────────────────────────────── */
function MagazineCard({ service, slug, featured, index = 0 }: Omit<ServiceCardProps, 'layout'>) {
  return (
    <article
      className="svc-magazine group relative overflow-hidden rounded-3xl animate-fade-up"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Image or Gradient */}
      <div className="aspect-[4/3] overflow-hidden relative">
        {service.imageUrl ? (
          <img
            src={service.imageUrl}
            alt={service.nameAr}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full" style={{ background: 'var(--hero-gradient)' }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-6xl font-black opacity-20"
                    style={{ color: 'var(--color-primary-fg)' }}>
                {service.nameAr.charAt(0)}
              </span>
            </div>
          </div>
        )}
        
        {/* Bottom gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        
        {/* Content over image */}
        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          {featured && (
            <span className="mb-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur-sm">
              <Sparkles className="h-3 w-3" />
              الأكثر طلباً
            </span>
          )}
          <h3 className="font-heading text-xl font-bold">{service.nameAr}</h3>
          <div className="mt-2 flex items-center gap-3 text-sm opacity-80">
            <span className="font-bold text-lg">{service.price.toLocaleString('ar-SA')} ر.س</span>
            <span className="text-xs">•</span>
            <span className="flex items-center gap-1">
              <Timer className="h-3.5 w-3.5" />
              {service.duration} دقيقة
            </span>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="p-4" style={{ background: 'var(--color-surface)' }}>
        {service.descriptionAr && (
          <p className="mb-3 text-xs leading-relaxed line-clamp-2"
             style={{ color: 'var(--color-text-muted)' }}>
            {service.descriptionAr}
          </p>
        )}
        <Link
          href={`/${slug}/book?service=${service.id}`}
          className="btn-primary flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold active:scale-[0.98] transition-all"
        >
          احجز الآن
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        </Link>
      </div>
    </article>
  );
}

/* ─── Fast / Compact ─────────────────────────────────────────────────── */
function CompactCard({ service, slug, featured, index = 0 }: Omit<ServiceCardProps, 'layout'>) {
  return (
    <article
      className="svc-compact group flex items-center gap-4 rounded-2xl p-4 transition-all duration-300 animate-fade-up"
      style={{
        background: 'var(--color-surface)',
        border: '1.5px solid var(--color-border)',
        animationDelay: `${index * 50}ms`,
      }}
    >
      {/* Icon / Initial */}
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-xl font-black transition-transform duration-300 group-hover:scale-110"
           style={{ 
             background: featured ? 'var(--color-primary)' : 'var(--color-primary-subtle)', 
             color: featured ? 'var(--color-primary-fg)' : 'var(--color-primary)' 
           }}>
        {service.nameAr.charAt(0)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-heading text-sm font-bold truncate"
            style={{ color: 'var(--color-text)' }}>
          {service.nameAr}
        </h3>
        <div className="mt-1 flex items-center gap-2 text-xs"
             style={{ color: 'var(--color-text-muted)' }}>
          <Timer className="h-3 w-3" />
          {service.duration} دقيقة
        </div>
      </div>

      {/* Price + CTA */}
      <div className="shrink-0 text-end">
        <div className="font-heading text-lg font-black"
             style={{ color: 'var(--color-primary)' }}>
          {service.price.toLocaleString('ar-SA')}
          <span className="text-[10px] font-medium opacity-60 ms-0.5">ر.س</span>
        </div>
        <Link
          href={`/${slug}/book?service=${service.id}`}
          className="mt-1.5 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-all active:scale-95"
          style={{ 
            background: 'var(--color-primary)', 
            color: 'var(--color-primary-fg)' 
          }}
        >
          احجز
          <ArrowLeft className="h-3 w-3 rtl:rotate-180" />
        </Link>
      </div>
    </article>
  );
}

/* ─── Classic (scroll-spy tabs) ──────────────────────────────────────── */
function ClassicCard({ service, slug, featured, index = 0 }: Omit<ServiceCardProps, 'layout'>) {
  return (
    <article
      className="svc-classic group relative overflow-hidden rounded-2xl transition-all duration-300 animate-fade-up"
      style={{
        background: 'var(--color-surface)',
        border: '1.5px solid var(--color-border)',
        animationDelay: `${index * 60}ms`,
      }}
    >
      {featured && (
        <div className="absolute top-0 end-0">
          <div className="rounded-es-xl px-3 py-1 text-[10px] font-bold"
               style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}>
            ⭐ الأكثر طلباً
          </div>
        </div>
      )}

      {/* Image */}
      {service.imageUrl && (
        <div className="aspect-[16/9] overflow-hidden">
          <img
            src={service.imageUrl}
            alt={service.nameAr}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        </div>
      )}

      <div className="p-4 sm:p-5">
        <h3 className="font-heading text-base font-bold"
            style={{ color: 'var(--color-text)' }}>
          {service.nameAr}
        </h3>

        {service.descriptionAr && (
          <p className="mt-1.5 text-xs leading-relaxed line-clamp-2"
             style={{ color: 'var(--color-text-muted)' }}>
            {service.descriptionAr}
          </p>
        )}

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between border-t pt-3"
             style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <span className="font-heading text-xl font-black"
                  style={{ color: 'var(--color-primary)' }}>
              {service.price.toLocaleString('ar-SA')}
            </span>
            <span className="ms-1 text-xs font-medium"
                  style={{ color: 'var(--color-text-muted)' }}>ر.س</span>
            <div className="flex items-center gap-1 mt-0.5 text-xs"
                 style={{ color: 'var(--color-text-muted)' }}>
              <Timer className="h-3 w-3" />
              {service.duration} دقيقة
            </div>
          </div>

          <Link
            href={`/${slug}/book?service=${service.id}`}
            className="btn-primary flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl active:scale-95 transition-all"
          >
            احجز
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </div>
      </div>
    </article>
  );
}

/* ─── Main Export (dispatches to correct variant) ────────────────────── */
export default function ServiceCard(props: ServiceCardProps) {
  switch (props.layout) {
    case 'elegant':  return <ElegantCard  {...props} />;
    case 'cards':    return <MagazineCard {...props} />;
    case 'compact':  return <CompactCard  {...props} />;
    case 'classic':
    default:         return <ClassicCard  {...props} />;
  }
}
