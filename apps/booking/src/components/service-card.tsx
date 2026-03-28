/**
 * ServiceCard — النسخة النهائية المحسنة 2026
 * 100% theme-aware + RTL كامل + أداء عالي
 */
import Link from 'next/link';
import { Timer, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BookingService } from '@/lib/api';

interface ServiceCardProps {
  service: BookingService;
  slug: string;
  featured?: boolean;
}

export default function ServiceCard({
  service,
  slug,
  featured,
}: ServiceCardProps) {
  return (
    <article
      className={cn(
        'card group relative flex flex-col overflow-hidden rounded-2xl transition-all hover:shadow-xl',
        featured && 'ring-2 ring-[var(--color-primary)] scale-[1.02]'
      )}
    >
      {/* Featured Badge */}
      {featured && (
        <span className="badge absolute top-4 start-4 z-20 px-3 py-1 text-xs font-bold">
          الأكثر طلباً
        </span>
      )}

      {/* Service Image */}
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

      {/* Card Content */}
      <div className="flex flex-1 flex-col p-5">
        <h3 
          className="font-heading text-lg font-bold leading-snug"
          style={{ color: 'var(--color-text)' }}
        >
          {service.nameAr}
        </h3>

        {service.descriptionAr && (
          <p 
            className="mt-2 text-sm leading-relaxed line-clamp-2"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {service.descriptionAr}
          </p>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between border-t pt-4 mt-4"
             style={{ borderColor: 'var(--color-border)' }}>
          
          {/* Price & Duration */}
          <div>
            <div className="flex items-baseline gap-1">
              <span 
                className="font-heading text-2xl font-black"
                style={{ color: 'var(--color-primary)' }}
              >
                {service.price.toLocaleString('ar-SA')}
              </span>
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
                ر.س
              </span>
            </div>
            
            <div className="flex items-center gap-1.5 text-xs mt-1"
                 style={{ color: 'var(--color-text-muted)' }}>
              <Timer className="h-3.5 w-3.5" />
              {service.duration} دقيقة
            </div>
          </div>

          {/* Book Button */}
          <Link
            href={`/${slug}/book?service=${service.id}`}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl transition-all active:scale-95"
          >
            احجز
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </div>
      </div>
    </article>
  );
}
