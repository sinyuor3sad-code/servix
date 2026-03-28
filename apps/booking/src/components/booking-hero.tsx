/**
 * BookingHero — النسخة النهائية المحسنة 2026
 * 100% theme-aware + RTL كامل + Thumb-friendly CTA + Mobile-first
 */
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Phone, Star, Clock, ChevronLeft } from 'lucide-react';
import AnnouncementBar from '@/components/announcement-bar';
import type { SalonInfo } from '@/lib/api';

interface BookingHeroProps {
  salon: SalonInfo;
  slug: string;
  rating?: number;
  reviewCount?: number;
  announcement?: string | null;
}

export default function BookingHero({
  salon,
  slug,
  rating,
  reviewCount,
  announcement,
}: BookingHeroProps) {
  const initials = salon.nameAr.charAt(0);

  return (
    <header className="relative">
      {/* Announcement Bar */}
      {announcement && (
        <AnnouncementBar 
          message={announcement} 
          storageKey={`servix-ann-${slug}`} 
        />
      )}

      <div className="relative overflow-hidden" style={{ minHeight: 'clamp(340px, 52vh, 560px)' }}>
        {/* Background Layer */}
        {salon.coverUrl ? (
          <>
            <Image
              src={salon.coverUrl}
              alt={`${salon.nameAr} — غلاف`}
              fill
              priority
              className="object-cover"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-[var(--hero-overlay)]" />
          </>
        ) : (
          <div className="absolute inset-0 bg-[var(--hero-gradient)]" />
        )}

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-5 py-16 text-center text-[var(--hero-text-color)]">
          
          {/* Logo / Avatar */}
          <div className="relative mb-6">
            <div 
              className="absolute inset-0 rounded-full animate-pulse-ring" 
              style={{ border: '2px solid var(--hero-ring-color)' }}
            />
            {salon.logoUrl ? (
              <Image
                src={salon.logoUrl}
                alt={salon.nameAr}
                width={112}
                height={112}
                className="rounded-full object-cover ring-4 ring-[var(--hero-ring-color)] shadow-2xl"
                priority
              />
            ) : (
              <div 
                className="flex h-28 w-28 items-center justify-center rounded-full text-5xl font-black"
                style={{
                  background: 'var(--hero-avatar-bg)',
                  border: '4px solid var(--hero-ring-color)',
                }}
              >
                {initials}
              </div>
            )}
          </div>

          {/* Salon Name */}
          <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
            {salon.nameAr}
          </h1>

          {/* Rating */}
          {rating && reviewCount && reviewCount > 0 && (
            <div className="mt-3 flex items-center gap-1.5">
              <Star className="h-5 w-5 fill-[var(--color-accent)] text-[var(--color-accent)]" />
              <span className="font-semibold">{rating.toFixed(1)}</span>
              <span className="text-sm opacity-75">({reviewCount} تقييم)</span>
            </div>
          )}

          {/* Description */}
          {salon.descriptionAr && (
            <p className="mx-auto mt-4 max-w-md text-base leading-relaxed opacity-90">
              {salon.descriptionAr}
            </p>
          )}

          {/* Info Chips */}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {salon.city && (
              <span 
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm backdrop-blur-md"
                style={{ 
                  background: 'var(--hero-chip-bg)', 
                  border: '1px solid var(--hero-chip-border)' 
                }}
              >
                <MapPin className="h-4 w-4" />
                {salon.city}
              </span>
            )}
            {salon.phone && (
              <a 
                href={`tel:${salon.phone}`} 
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm backdrop-blur-md hover:opacity-90 transition"
                style={{ 
                  background: 'var(--hero-chip-bg)', 
                  border: '1px solid var(--hero-chip-border)' 
                }}
              >
                <Phone className="h-4 w-4" />
                <span dir="ltr">{salon.phone}</span>
              </a>
            )}
          </div>

          {/* Thumb-friendly CTA */}
          <div className="mt-10 w-full max-w-sm px-4">
            <Link
              href={`/${slug}/book`}
              className="btn-primary flex h-14 w-full items-center justify-center gap-3 rounded-2xl text-base font-semibold shadow-xl active:scale-[0.985] transition-all"
            >
              <Clock className="h-5 w-5" />
              احجز موعدك الآن
              <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
            </Link>
          </div>

          <p className="mt-8 text-xs opacity-50 tracking-wide">مدعوم بـ SERVIX</p>
        </div>
      </div>
    </header>
  );
}
