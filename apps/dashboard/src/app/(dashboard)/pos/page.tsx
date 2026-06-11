'use client';

import { useDeviceMode, usePOSEngine } from './pos-engine';
import { DesktopPOS } from './components/DesktopPOS';
import { TouchPOS } from './components/TouchPOS';
import { LoadingShell } from './components/LoadingShell';
import { ShiftGate } from './components/ShiftGate';

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE — Auto-detects device, renders appropriate layout
   ShiftGate enforces open shift before showing POS
   ═══════════════════════════════════════════════════════════════════════════════ */

export default function POSPage() {
  const mode = useDeviceMode();
  const engine = usePOSEngine();

  if (!mode) return <LoadingShell />;

  return (
    <ShiftGate>
      {(shift) =>
        mode === 'desktop'
          ? <DesktopPOS e={engine} shift={shift} />
          : <TouchPOS e={engine} />
      }
    </ShiftGate>
  );
}
