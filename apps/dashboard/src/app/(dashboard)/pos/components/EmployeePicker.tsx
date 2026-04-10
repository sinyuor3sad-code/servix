'use client';

import { Scissors } from 'lucide-react';
import type { E } from '../pos-engine';
import { BS, G3, brd, accentBg, accentColor } from '../pos-constants';

export function EmployeePicker({ e, lg }: { e: E; lg?: boolean }) {
  return (
    <div className={`shrink-0 ${brd(4)} border-b ${lg ? 'p-4 space-y-2' : 'p-3 space-y-2'}`}>
      <div className="flex items-center gap-1.5"><Scissors size={lg ? 14 : 10} style={accentColor} /><span className={`${lg ? 'text-[13px]' : 'text-[10px]'} font-bold text-[var(--foreground)]`}>الموظفة</span></div>
      <div className="flex flex-wrap gap-1">
        {e.emps.map(emp => (
          <button key={emp.id} onClick={() => e.setDefEmployee(e.defEmployee?.id === emp.id ? null : emp)}
            className={`${BS} rounded-lg ${lg ? 'px-4 py-2.5 text-[12px]' : 'px-2.5 py-1.5 text-[9px]'} font-semibold ${e.defEmployee?.id === emp.id ? 'text-black shadow-md' : `${G3} text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}`}
            style={e.defEmployee?.id === emp.id ? accentBg : undefined}>{emp.fullName.split(' ')[0]}</button>
        ))}
      </div>
    </div>
  );
}
