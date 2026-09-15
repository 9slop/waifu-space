// Incoming-call ring tone, synthesized directly through the Web Audio API so
// no audio asset is needed. A soft two-frequency "brring" burst is repeated
// (~1.2s audible, ~0.6s gap) until the callee picks up, declines, or the offer
// is cancelled elsewhere. Suppressed whenever `state.settings.soundEnabled` is
// off, and every path degrades to a silent no-op if audio is unavailable
// (missing Web Audio, autoplay policy, closed context, throttled tab, ...).

import { state } from '../store';

let audioCtx: AudioContext | null = null;
let ringTimer: number | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!audioCtx) audioCtx = new Ctor();
    if (audioCtx.state === 'closed') return null;
    if (audioCtx.state === 'suspended') void audioCtx.resume().catch(() => {});
    return audioCtx;
  } catch {
    return null;
  }
}

/** One ~1.2s "ring" burst (425Hz + 380Hz beating) anchored at `at`. */
function burst(ctx: AudioContext, at: number): void {
  try {
    const master = ctx.createGain();
    master.connect(ctx.destination);
    master.gain.setValueAtTime(0.0001, at);
    master.gain.exponentialRampToValueAtTime(0.14, at + 0.03);
    master.gain.setValueAtTime(0.14, at + 1.05);
    master.gain.exponentialRampToValueAtTime(0.0001, at + 1.2);
    for (const f of [425, 380]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, at);
      osc.connect(master);
      osc.start(at);
      osc.stop(at + 1.2);
    }
  } catch {
    // Audio unavailable: silently skip the ring.
  }
}

/** Start looping the incoming-call ring (idempotent; respects soundEnabled). */
export function startIncomingRing(): void {
  stopIncomingRing();
  if (!state.settings.soundEnabled) return;
  const ctx = getCtx();
  if (!ctx) return;

  let next = Math.max(0.05, ctx.currentTime + 0.05);
  ringTimer = window.setInterval(() => {
    if (!state.settings.soundEnabled) {
      stopIncomingRing();
      return;
    }
    const live = getCtx();
    if (!live) return;
    burst(live, Math.max(live.currentTime, next));
    next += 1.8;
  }, 1800);
}

/** Stop the looping ring tone immediately (safe to call when not ringing). */
export function stopIncomingRing(): void {
  if (ringTimer !== null) {
    window.clearInterval(ringTimer);
    ringTimer = null;
  }
}