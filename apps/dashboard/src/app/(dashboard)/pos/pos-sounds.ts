'use client';

let ctx: AudioContext | null = null;

function getCtx() {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

/** 1000Hz, 80ms — item added to cart */
export function playBeep() {
  try {
    const c = getCtx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.frequency.value = 1000;
    g.gain.value = 0.08;
    o.start(); o.stop(c.currentTime + 0.08);
  } catch { /* audio not available */ }
}

/** Two-tone rising — successful payment */
export function playSuccess() {
  try {
    const c = getCtx();
    [800, 1200].forEach((freq, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.frequency.value = freq;
      g.gain.value = 0.06;
      o.start(c.currentTime + i * 0.12);
      o.stop(c.currentTime + i * 0.12 + 0.1);
    });
  } catch { /* audio not available */ }
}

/** Low buzz — error */
export function playError() {
  try {
    const c = getCtx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.type = 'square';
    o.frequency.value = 200;
    g.gain.value = 0.06;
    o.start(); o.stop(c.currentTime + 0.2);
  } catch { /* audio not available */ }
}
