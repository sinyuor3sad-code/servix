'use client';

import { useDeviceMode, usePOSEngine } from './pos-engine';
import { DesktopPOS } from './components/DesktopPOS';
import { TouchPOS } from './components/TouchPOS';
import { LoadingShell } from './components/LoadingShell';

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE — Auto-detects device, renders appropriate layout
   ═══════════════════════════════════════════════════════════════════════════════ */

export default function POSPage() {
  const mode = useDeviceMode();
  const engine = usePOSEngine();

  if (!mode) return <LoadingShell />;
  return mode === 'desktop' ? <DesktopPOS e={engine} /> : <TouchPOS e={engine} />;
}
