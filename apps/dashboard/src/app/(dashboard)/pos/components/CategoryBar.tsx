'use client';

import { Star, Package, Scissors } from 'lucide-react';
import type { E } from '../pos-engine';
import { BS, G3, bg, accentBg, accentColor, primaryBg, CAT_ICO } from '../pos-constants';

export function CategoryBar({ e, lg }: { e: E; lg?: boolean }) {
  const sz = lg ? 'px-5 py-3 text-[13px] rounded-2xl gap-1.5' : 'px-3 py-2 text-[10px] rounded-xl gap-1';
  return (
    <div className={`flex shrink-0 ${lg ? 'gap-2 px-4 pb-2' : 'gap-1.5 px-3 pb-1.5'}`}>
      <button onClick={() => { e.setShowFavs(!e.showFavs); e.setShowBundles(false); }} className={`${BS} flex items-center ${sz} font-bold ${e.showFavs ? 'text-black shadow-md' : `${G3} text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}`} style={e.showFavs ? accentBg : undefined}><Star size={lg ? 14 : 10} /> المفضلة</button>
      <button onClick={() => { e.setShowBundles(!e.showBundles); e.setShowFavs(false); }} className={`${BS} flex items-center ${sz} font-bold ${e.showBundles ? 'text-black shadow-md' : `${G3} text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}`} style={e.showBundles ? accentBg : undefined}><Package size={lg ? 14 : 10} /> الباقات</button>
      <div className={`w-px ${bg(4)}`} />
      <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <button onClick={() => { e.setSelCat(null); e.setShowFavs(false); e.setShowBundles(false); }} className={`${BS} flex shrink-0 items-center ${sz} font-bold ${!e.selCat && !e.showFavs && !e.showBundles ? 'text-white shadow-md' : `${G3} text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}`} style={!e.selCat && !e.showFavs && !e.showBundles ? primaryBg : undefined}>الكل</button>
        {e.cats?.map(c => { const I = CAT_ICO[c.nameAr] ?? Scissors; return (
          <button key={c.id} onClick={() => { e.setSelCat(c.id); e.setShowFavs(false); e.setShowBundles(false); }} className={`${BS} flex shrink-0 items-center ${sz} font-bold ${e.selCat === c.id ? 'text-white shadow-md' : `${G3} text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}`} style={e.selCat === c.id ? primaryBg : undefined}><I size={lg ? 14 : 10} /> {c.nameAr}</button>
        ); })}
      </div>
    </div>
  );
}
