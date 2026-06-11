'use client';

import {
  Search, Clock, Star, StarOff,
} from 'lucide-react';
import type { E } from '../pos-engine';
import { BS, brd, bg, TN, accentColor, primaryBg, fmt } from '../pos-constants';

export function ServiceGrid({ e, lg }: { e: E; lg?: boolean }) {
  const list = e.showFavs ? e.favSvcs : e.filtered;
  if (!list.length) return <div className="flex h-full flex-col items-center justify-center gap-2 text-[var(--muted-foreground)]" style={{ opacity: 0.2 }}><Search size={32} strokeWidth={1} /><p className="text-[11px]">{e.showFavs ? 'لا توجد خدمات مفضلة' : 'لا توجد خدمات'}</p></div>;
  return (
    <div className={`grid ${lg ? 'grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' : 'grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'}`}>
      {list.map(svc => {
        const qty = e.cart.filter(c => c.service.id === svc.id).reduce((s, i) => s + i.quantity, 0);
        const isFav = e.favIds.includes(svc.id);
        return (
          <div key={svc.id} className="relative group">
            <button data-testid={`pos-service-${svc.id}`} onClick={() => e.addToCart(svc)} className={`${BS} flex w-full flex-col items-start gap-0.5 rounded-xl border ${lg ? 'p-5 min-h-[120px] rounded-2xl gap-1.5' : 'p-3'} text-start ${qty > 0 ? `${brd(0)} shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--brand-primary)_25%,transparent)]` : `${brd(3)} ${bg(2)} hover:${bg(4)}`}`} style={qty > 0 ? { background: 'color-mix(in srgb, var(--brand-primary) 5%, transparent)' } : undefined}>
              {qty > 0 && <span className={`absolute end-2 top-2 flex items-center justify-center rounded-md text-[8px] font-black text-white ${lg ? 'h-8 w-8 rounded-xl text-[12px]' : 'h-5 w-5'}`} style={{ ...TN, ...primaryBg }}>{qty}</span>}
              <span className={`${lg ? 'text-[15px]' : 'text-[14px]'} font-semibold leading-snug text-[var(--foreground)] line-clamp-2`}>{svc.nameAr}</span>
              <span className={`flex items-center gap-1 ${lg ? 'text-[11px]' : 'text-[10px]'} text-[var(--muted-foreground)]`} style={{ opacity: 0.5 }}><Clock size={lg ? 11 : 10} />{svc.duration}د</span>
              <span className={`mt-auto pt-0.5 ${lg ? 'text-[18px]' : 'text-[16px]'} font-black`} style={{ ...TN, ...accentColor }}>{fmt(svc.price)}<span className={`${lg ? 'text-[10px]' : 'text-[9px]'} font-semibold opacity-40 ms-0.5`}>ر.س</span></span>
            </button>
            <button onClick={() => e.toggleFav(svc.id)} className={`${BS} absolute start-1.5 top-1.5 rounded-md p-1 ${isFav ? '' : 'opacity-0 group-hover:opacity-60'} hover:opacity-100`} style={isFav ? accentColor : { color: 'var(--muted-foreground)' }}>{isFav ? <Star size={9} fill="currentColor" /> : <StarOff size={9} />}</button>
          </div>
        );
      })}
    </div>
  );
}
