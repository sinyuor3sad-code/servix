'use client';

/**
 * ServicesSection — Client Component
 * Handles search, category filtering, and layout-aware rendering.
 */

import { useState, useMemo } from 'react';
import { Search, Sparkles } from 'lucide-react';
import ServiceCard from '@/components/service-card';
import type { ServiceCategory, BookingService } from '@/lib/api';

type Layout = 'luxe' | 'bloom' | 'glamour' | 'golden' | 'banan';

interface Props {
  categories: ServiceCategory[];
  slug: string;
  layout: Layout;
  totalServices: number;
}

// Layouts that show category tabs + search
const TABBED_LAYOUTS: Layout[] = ['bloom', 'glamour', 'golden', 'banan'];

export default function ServicesSection({ categories, slug, layout, totalServices }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const showTabs = TABBED_LAYOUTS.includes(layout);

  const featuredServiceIds = useMemo(() => new Set(
    categories.map(c => c.services[0]?.id).filter(Boolean),
  ), [categories]);

  const filteredCategories = useMemo(() => {
    let cats = categories;

    if (activeCategory !== 'all') {
      cats = cats.filter(c => c.id === activeCategory);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      cats = cats.map(c => ({
        ...c,
        services: c.services.filter(s =>
          s.nameAr.includes(q) ||
          s.nameEn?.toLowerCase().includes(q) ||
          s.descriptionAr?.includes(q)
        ),
      })).filter(c => c.services.length > 0);
    }

    return cats;
  }, [categories, activeCategory, search]);

  const allFiltered = useMemo(() =>
    filteredCategories.flatMap(c => c.services),
    [filteredCategories]
  );

  const isDark = layout === 'golden';

  return (
    <section
      className="px-4 py-10 md:py-14"
      style={{
        background: isDark
          ? 'linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%)'
          : 'var(--color-bg-2)',
      }}
    >
      <div className={`mx-auto ${layout === 'bloom' ? 'max-w-2xl' : 'max-w-5xl'}`}>

        {/* Section heading */}
        <div className="mb-6 text-center">
          <div className="mb-2 flex items-center justify-center gap-2">
            <Sparkles className="h-5 w-5" style={{ color: isDark ? '#D4AF37' : 'var(--color-primary)' }} />
            <h2
              className="font-heading text-2xl font-bold sm:text-3xl"
              style={{ color: isDark ? '#f5f5f5' : 'var(--color-text)' }}
            >
              خدماتنا
            </h2>
          </div>
          {totalServices > 0 && (
            <p className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'var(--color-text-muted)' }}>
              {totalServices} خدمة متاحة
            </p>
          )}
        </div>

        {/* Category tabs + Search (for tabbed layouts) */}
        {showTabs && (
          <div className="mb-6 space-y-3">
            {/* Category pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setActiveCategory('all')}
                className="shrink-0 rounded-full px-5 py-2.5 text-xs font-bold transition-all"
                style={activeCategory === 'all' ? {
                  background: isDark ? '#D4AF37' : 'var(--color-primary)',
                  color: isDark ? '#000' : 'var(--color-primary-fg)',
                } : {
                  background: isDark ? 'rgba(255,255,255,0.08)' : 'var(--color-surface)',
                  color: isDark ? 'rgba(255,255,255,0.6)' : 'var(--color-text-muted)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'var(--color-border)'}`,
                }}
              >
                الكل
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className="shrink-0 rounded-full px-5 py-2.5 text-xs font-bold transition-all"
                  style={activeCategory === cat.id ? {
                    background: isDark ? '#D4AF37' : 'var(--color-primary)',
                    color: isDark ? '#000' : 'var(--color-primary-fg)',
                  } : {
                    background: isDark ? 'rgba(255,255,255,0.08)' : 'var(--color-surface)',
                    color: isDark ? 'rgba(255,255,255,0.6)' : 'var(--color-text-muted)',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'var(--color-border)'}`,
                  }}
                >
                  {cat.nameAr}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4"
                style={{ color: isDark ? 'rgba(255,255,255,0.3)' : 'var(--color-text-muted)' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ابحثي عن خدمة..."
                className="w-full rounded-xl py-2.5 ps-10 pe-4 text-sm outline-none transition-all"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'var(--color-surface)',
                  border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'var(--color-border)'}`,
                  color: isDark ? '#f5f5f5' : 'var(--color-text)',
                }}
              />
            </div>
          </div>
        )}

        {/* ─── LUXE layout: 2×2 grid, grouped by category ─── */}
        {layout === 'luxe' && (
          <div className="space-y-8">
            {filteredCategories.map(cat => (
              <div key={cat.id}>
                <div className="mb-4 flex items-center gap-3">
                  <span className="h-0.5 w-6 rounded-full" style={{ background: 'var(--color-primary)' }} />
                  <h3 className="font-heading text-base font-semibold" style={{ color: 'var(--color-text)' }}>
                    {cat.nameAr}
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {cat.services.map((s, i) => (
                    <ServiceCard key={s.id} service={s} slug={slug} layout="luxe"
                      featured={featuredServiceIds.has(s.id)} index={i} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─── BLOOM layout: vertical list ─── */}
        {layout === 'bloom' && (
          <div className="space-y-3">
            {allFiltered.map((s, i) => (
              <ServiceCard key={s.id} service={s} slug={slug} layout="bloom"
                featured={featuredServiceIds.has(s.id)} index={i} />
            ))}
          </div>
        )}

        {/* ─── GLAMOUR layout: 2-col grid ─── */}
        {layout === 'glamour' && (
          <div className="grid grid-cols-2 gap-4 sm:gap-5">
            {allFiltered.map((s, i) => (
              <ServiceCard key={s.id} service={s} slug={slug} layout="glamour"
                featured={featuredServiceIds.has(s.id)} index={i} />
            ))}
          </div>
        )}

        {/* ─── GOLDEN layout: vertical dark list ─── */}
        {layout === 'golden' && (
          <div className="space-y-3">
            {allFiltered.map((s, i) => (
              <ServiceCard key={s.id} service={s} slug={slug} layout="golden"
                featured={featuredServiceIds.has(s.id)} index={i} />
            ))}
          </div>
        )}

        {/* ─── BANAN layout: single column centered ─── */}
        {layout === 'banan' && (
          <div className="max-w-md mx-auto space-y-6">
            {allFiltered.map((s, i) => (
              <ServiceCard key={s.id} service={s} slug={slug} layout="banan"
                featured={featuredServiceIds.has(s.id)} index={i} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {allFiltered.length === 0 && search && (
          <div className="py-12 text-center">
            <p className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'var(--color-text-muted)' }}>
              لا توجد نتائج لـ "{search}"
            </p>
          </div>
        )}

      </div>
    </section>
  );
}
